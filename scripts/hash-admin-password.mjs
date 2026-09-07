import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const iterations = 310000
const digest = 'sha256'
const password = process.env.ADMIN_PASSWORD ?? process.argv[2]

async function readPassword() {
  if (password) return password

  const readline = createInterface({ input, output })
  const supplied = await readline.question('Admin password: ')
  readline.close()
  return supplied
}

const suppliedPassword = await readPassword()

if (suppliedPassword.length < 12) {
  console.error('Admin password must be at least 12 characters.')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = pbkdf2Sync(suppliedPassword, salt, iterations, 32, digest)

console.log(`pbkdf2$${digest}$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`)
