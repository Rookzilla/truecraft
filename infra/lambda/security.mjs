import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { Buffer } from 'node:buffer'
import { readHeader } from './http.mjs'

const getPiiEncryptionKey = () => {
  const key = Buffer.from(process.env.PII_ENCRYPTION_KEY_BASE64 ?? '', 'base64')
  if (key.length !== 32) {
    throw new Error('PII encryption key must be a 32-byte base64 value')
  }
  return key
}

export const encryptText = (value) => {
  const text = String(value ?? '')
  if (!text) return ''

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getPiiEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  })
}

export const decryptText = (value) => {
  if (!value) return ''

  try {
    const envelope = JSON.parse(value)
    if (envelope?.v !== 1 || envelope.alg !== 'aes-256-gcm') return value

    const decipher = createDecipheriv('aes-256-gcm', getPiiEncryptionKey(), Buffer.from(envelope.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return value
  }
}

export const hashLookupValue = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return ''

  return createHmac('sha256', getPiiEncryptionKey()).update(`truecraft-lookup:${normalized}`).digest('base64')
}

export const verifyPasswordHash = (supplied, encodedHash) => {
  const [scheme, digest, iterationsValue, saltBase64, hashBase64] = String(encodedHash ?? '').split('$')
  if (scheme !== 'pbkdf2' || digest !== 'sha256') return false

  const iterations = Number(iterationsValue)
  if (!Number.isInteger(iterations) || iterations < 100000 || !saltBase64 || !hashBase64) return false

  const salt = Buffer.from(saltBase64, 'base64')
  const expected = Buffer.from(hashBase64, 'base64')
  if (!salt.length || !expected.length) return false

  const actual = pbkdf2Sync(String(supplied ?? ''), salt, iterations, expected.length, digest)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export const requireAdmin = (event) => {
  const claims = event.requestContext?.authorizer?.jwt?.claims
  if (claims?.sub && (claims.email || claims['cognito:username'])) return true

  const supplied = readHeader(event.headers, 'x-admin-password')
  return Boolean(process.env.ADMIN_PASSWORD_HASH && supplied && verifyPasswordHash(supplied, process.env.ADMIN_PASSWORD_HASH))
}
