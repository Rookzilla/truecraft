import { Readable } from 'node:stream'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { beforeEach, vi } from 'vitest'

export const sendMock = vi.fn()
export const signedUrlMock = vi.fn()

export class DynamoDBClient {
  send(command) {
    return sendMock(command)
  }
}

export class S3Client {
  send(command) {
    return sendMock(command)
  }
}

export class SESClient {
  send(command) {
    return sendMock(command)
  }
}

export class GetItemCommand {
  constructor(input) {
    this.input = input
  }
}

export class DeleteItemCommand {
  constructor(input) {
    this.input = input
  }
}

export class PutItemCommand {
  constructor(input) {
    this.input = input
  }
}

export class ScanCommand {
  constructor(input) {
    this.input = input
  }
}

export class UpdateItemCommand {
  constructor(input) {
    this.input = input
  }
}

export class DeleteObjectCommand {
  constructor(input) {
    this.input = input
  }
}

export class DeleteObjectsCommand {
  constructor(input) {
    this.input = input
  }
}

export class GetObjectTaggingCommand {
  constructor(input) {
    this.input = input
  }
}

export class GetObjectCommand {
  constructor(input) {
    this.input = input
  }
}

export class HeadObjectCommand {
  constructor(input) {
    this.input = input
  }
}

export class ListObjectVersionsCommand {
  constructor(input) {
    this.input = input
  }
}

export class PutObjectCommand {
  constructor(input) {
    this.input = input
  }
}

export class SendEmailCommand {
  constructor(input) {
    this.input = input
  }
}

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
}))

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
}))

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient,
  SendEmailCommand,
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: signedUrlMock,
}))

export const buildPasswordHash = (password) => {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256')
  return `pbkdf2$sha256$310000$${salt.toString('base64')}$${hash.toString('base64')}`
}

export const apiEvent = ({ method = 'POST', path = '/api/submissions', body, headers = {}, authorizer } = {}) => ({
  body,
  headers,
  rawPath: path,
  requestContext: {
    authorizer,
    http: { method },
  },
})

export const parseBody = (response) => JSON.parse(response.body)

export const multipartBody = ({ boundary, fields = {}, file }) => {
  const parts = []
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    )
  }
  if (file) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n${file.content}\r\n`,
    )
  }
  parts.push(`--${boundary}--\r\n`)
  return parts.join('')
}

export const importHandler = async () => {
  vi.resetModules()
  process.env.TABLE_NAME = 'submissions'
  process.env.CV_BUCKET_NAME = 'cv-bucket'
  process.env.NOTIFICATION_EMAIL = 'notifications@example.com'
  process.env.SENDER_EMAIL = 'notifications@example.com'
  process.env.PII_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString('base64')
  process.env.ADMIN_PASSWORD_HASH = buildPasswordHash('a-long-admin-password')
  process.env.MAX_FILE_BYTES = String(10 * 1024 * 1024)
  process.env.MONTHLY_SCAN_BYTES_CAP = String(1024 * 1024 * 1024)
  return import('./submissions.mjs')
}

beforeEach(() => {
  sendMock.mockReset()
  signedUrlMock.mockReset()
  signedUrlMock.mockResolvedValue('https://example.com/signed-upload-url')
})
