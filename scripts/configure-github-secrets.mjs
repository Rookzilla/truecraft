import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const args = process.argv.slice(2)

const readOption = (name, fallback) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const environment = readOption('--environment', 'production')
const rotatePiiKey = args.includes('--rotate-pii-key')

const runGh = (ghArgs, options = {}) => {
  const result = spawnSync('gh', ghArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  })

  if (result.status !== 0) {
    const message = result.stderr?.trim() || result.stdout?.trim() || `gh ${ghArgs.join(' ')} failed`
    throw new Error(message)
  }

  return result.stdout.trim()
}

const secretScopeArgs = environment ? ['--env', environment] : []

const secretExists = (name) => {
  const output = runGh(['secret', 'list', ...secretScopeArgs])
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .includes(name)
}

const setSecret = (name, value) => {
  runGh(['secret', 'set', name, ...secretScopeArgs], { input: value })
}

const buildPasswordHash = (password) => {
  const iterations = 310000
  const digest = 'sha256'
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, iterations, 32, digest)
  return `pbkdf2$${digest}$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`
}

const readAdminPassword = async () => {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD

  const readline = createInterface({ input, output })
  const password = await readline.question('Admin password to use for /admin: ')
  readline.close()
  return password
}

try {
  runGh(['auth', 'status'])
  const repository = runGh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'])
  console.log(`Configuring GitHub secrets for ${repository}${environment ? ` environment "${environment}"` : ''}.`)

  const adminPassword = await readAdminPassword()
  if (adminPassword.length < 12) {
    throw new Error('Admin password must be at least 12 characters.')
  }

  setSecret('ADMIN_PASSWORD_HASH', buildPasswordHash(adminPassword))
  console.log('Updated ADMIN_PASSWORD_HASH.')

  if (process.env.PII_ENCRYPTION_KEY_BASE64) {
    const key = Buffer.from(process.env.PII_ENCRYPTION_KEY_BASE64, 'base64')
    if (key.length !== 32) {
      throw new Error('PII_ENCRYPTION_KEY_BASE64 must be a base64-encoded 32-byte key.')
    }
    setSecret('PII_ENCRYPTION_KEY_BASE64', process.env.PII_ENCRYPTION_KEY_BASE64)
    console.log('Updated PII_ENCRYPTION_KEY_BASE64 from the local environment.')
  } else if (rotatePiiKey || !secretExists('PII_ENCRYPTION_KEY_BASE64')) {
    setSecret('PII_ENCRYPTION_KEY_BASE64', randomBytes(32).toString('base64'))
    console.log(
      rotatePiiKey
        ? 'Rotated PII_ENCRYPTION_KEY_BASE64. Existing encrypted records require migration.'
        : 'Created PII_ENCRYPTION_KEY_BASE64.',
    )
  } else {
    console.log('Left existing PII_ENCRYPTION_KEY_BASE64 unchanged.')
  }

  console.log('GitHub deployment secrets are configured.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error('Install and authenticate GitHub CLI first: https://cli.github.com/')
  process.exit(1)
}
