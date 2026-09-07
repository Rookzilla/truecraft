import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  __security,
  candidateToItem,
  escapeHtml,
  itemToCandidate,
  normaliseType,
  parseMultipart,
  readHeader,
  statusFromScanTag,
  validateFile,
  validateFileMetadata,
  validateContactFields,
} from './submissions.mjs'

const useTestKey = () => {
  process.env.PII_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString('base64')
}

const buildPasswordHash = (password) => {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256')
  return `pbkdf2$sha256$310000$${salt.toString('base64')}$${hash.toString('base64')}`
}

describe('submission security helpers', () => {
  it('encrypts and decrypts PII with randomized ciphertext', async () => {
    useTestKey()

    const first = __security.encryptText('sam@example.com')
    const second = __security.encryptText('sam@example.com')

    expect(first).not.toContain('sam@example.com')
    expect(second).not.toContain('sam@example.com')
    expect(first).not.toBe(second)
    expect(__security.decryptText(first)).toBe('sam@example.com')
    expect(__security.decryptText(second)).toBe('sam@example.com')
  })

  it('falls back to plaintext for legacy unencrypted values', async () => {
    useTestKey()

    expect(__security.decryptText('legacy@example.com')).toBe('legacy@example.com')
    const unknownEnvelope = JSON.stringify({ v: 2, alg: 'aes-256-gcm' })
    expect(__security.decryptText(unknownEnvelope)).toBe(unknownEnvelope)
  })

  it('creates stable keyed lookup hashes', async () => {
    useTestKey()

    expect(__security.hashLookupValue(' SAM@example.com ')).toBe(__security.hashLookupValue('sam@example.com'))
    expect(__security.hashLookupValue('sam@example.com')).not.toBe(__security.hashLookupValue('other@example.com'))
    expect(__security.hashLookupValue(undefined)).toBe('')
  })

  it('verifies PBKDF2 password hashes without accepting incorrect passwords', async () => {
    useTestKey()
    const encodedHash = buildPasswordHash('replace-with-a-long-private-password')

    expect(__security.verifyPasswordHash('replace-with-a-long-private-password', encodedHash)).toBe(true)
    expect(__security.verifyPasswordHash('wrong-password', encodedHash)).toBe(false)
  })

  it('rejects malformed password hashes and missing encryption keys', () => {
    expect(__security.verifyPasswordHash('anything', 'plain-text')).toBe(false)
    expect(__security.verifyPasswordHash('anything', 'pbkdf2$sha256$999$bad$bad')).toBe(false)
    expect(__security.verifyPasswordHash('anything', 'pbkdf2$sha1$310000$bad$bad')).toBe(false)

    delete process.env.PII_ENCRYPTION_KEY_BASE64
    expect(() => __security.encryptText('secret')).toThrow('PII encryption key must be a 32-byte base64 value')
  })

  it('reads headers case-insensitively and escapes unsafe HTML values', () => {
    expect(readHeader({ 'Content-Type': 'application/json' }, 'content-type')).toBe('application/json')
    expect(readHeader(undefined, 'content-type')).toBeUndefined()
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml('<a href="x">A&B</a>')).toBe('&lt;a href=&quot;x&quot;&gt;A&amp;B&lt;/a&gt;')
  })

  it('normalises known submission types and maps unknown types to other', () => {
    expect(normaliseType('business')).toBe('business')
    expect(normaliseType('partnership')).toBe('partnership')
    expect(normaliseType('candidate')).toBe('candidate')
    expect(normaliseType('auctioneer')).toBe('other')
  })

  it('validates contact email and phone fields', () => {
    expect(validateContactFields({ email: ' alex@example.com ', phone: '07545424483' })).toEqual({
      valid: true,
      fields: expect.objectContaining({
        email: 'alex@example.com',
        phone: '07545424483',
      }),
    })
    expect(validateContactFields({ email: 'alex.example.com', phone: '07545424483' })).toEqual({
      valid: false,
      message: 'Please enter a valid email address.',
    })
    expect(validateContactFields({ email: 'alex@example.com', phone: '075454244831' })).toEqual({
      valid: false,
      message: 'Please enter a phone number using up to 11 digits only.',
    })
    expect(validateContactFields({ email: 'alex@example.com', phone: 'phone-me' })).toEqual({
      valid: false,
      message: 'Please enter a phone number using up to 11 digits only.',
    })
  })

  it('validates direct file uploads across accepted and rejected cases', () => {
    expect(validateFile(undefined)).toBeUndefined()
    expect(validateFile({ filename: 'empty.pdf', content: Buffer.alloc(0) })).toBeUndefined()
    expect(validateFile({ filename: 'cv.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-body') })).toBe('pdf')
    expect(
      validateFile({
        filename: 'cv.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: Buffer.from('PK-body'),
      }),
    ).toBe('docx')

    expect(() => validateFile({ filename: 'cv.exe', content: Buffer.from('bad') })).toThrow('Only PDF and DOCX files are accepted')
    expect(() =>
      validateFile({
        filename: 'cv.pdf',
        mimeType: 'application/octet-stream',
        content: Buffer.from('%PDF-body'),
      }),
    ).toThrow('The uploaded CV type is not accepted')
    expect(() => validateFile({ filename: 'cv.pdf', content: Buffer.from('nope') })).toThrow('The PDF file signature is invalid')
    expect(() => validateFile({ filename: 'cv.pdf', content: Buffer.alloc(10 * 1024 * 1024 + 1) })).toThrow(
      'The CV must be 10MB or smaller',
    )
  })

  it('validates upload metadata and scan status mappings', () => {
    expect(validateFileMetadata({ filename: 'cv.pdf', mimeType: 'application/pdf', size: 1000 })).toBe('pdf')
    expect(() => validateFileMetadata({ filename: undefined, mimeType: 'application/pdf', size: 1000 })).toThrow(
      'Only PDF and DOCX files are accepted',
    )
    expect(() => validateFileMetadata({ filename: 'cv.pdf', mimeType: 'application/pdf', size: 0 })).toThrow('The CV must be 10MB or smaller')
    expect(() => validateFileMetadata({ filename: 'cv.pdf', mimeType: 'application/pdf', size: Number.NaN })).toThrow(
      'The CV must be 10MB or smaller',
    )
    expect(() => validateFileMetadata({ filename: 'cv.pdf', mimeType: 'application/octet-stream', size: 1000 })).toThrow(
      'The uploaded CV type is not accepted',
    )

    expect(statusFromScanTag(undefined, undefined)).toBe('potential_scan_pending')
    expect(statusFromScanTag('PENDING', 'awaiting_upload')).toBe('awaiting_upload')
    expect(statusFromScanTag('NO_THREATS_FOUND', 'potential_scan_pending')).toBe('potential')
    expect(statusFromScanTag('NO_THREATS_FOUND', 'publicly_available')).toBe('publicly_available')
    expect(statusFromScanTag('THREATS_FOUND', 'potential_scan_pending')).toBe('rejected_security')
    expect(statusFromScanTag('FAILED', 'potential_scan_pending')).toBe('rejected_security')
    expect(statusFromScanTag('UNKNOWN', undefined)).toBe('potential_scan_pending')
  })

  it('parses multipart bodies, including base64 encoded API Gateway payloads', () => {
    const boundary = '----boundary'
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="name"',
      '',
      'Alex Morgan',
      `--${boundary}`,
      'Content-Disposition: form-data; name="cv"; filename="alex.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-body',
      `--${boundary}--`,
      '',
    ].join('\r\n')

    const parsed = parseMultipart({
      body: Buffer.from(body).toString('base64'),
      headers: { 'content-type': `multipart/form-data; boundary="${boundary}"` },
      isBase64Encoded: true,
    })

    expect(parsed.fields).toEqual({ name: 'Alex Morgan' })
    expect(parsed.file).toMatchObject({
      fieldName: 'cv',
      filename: 'alex.pdf',
      mimeType: 'application/pdf',
    })
    expect(parsed.file.content.toString('utf8')).toBe('%PDF-body')
  })

  it('maps sparse DynamoDB records to safe candidate defaults', () => {
    useTestKey()

    expect(itemToCandidate({})).toEqual({
      id: '',
      createdAt: '',
      updatedAt: '',
      approvedAt: undefined,
      status: 'potential_scan_pending',
      scanStatus: 'PENDING',
      type: 'candidate',
      name: '',
      email: '',
      phone: '',
      role: '',
      message: '',
      company: '',
      jobTitle: '',
      notes: '',
      tags: [],
      cv: undefined,
    })

    expect(
      itemToCandidate({
        id: { S: 'candidate-1' },
        cvKey: { S: 'incoming/candidate-1.pdf' },
      }).cv,
    ).toEqual({
      key: 'incoming/candidate-1.pdf',
      filename: 'CV',
      mimeType: '',
      size: 0,
    })
  })

  it('builds encrypted DynamoDB items with optional CV metadata only when present', () => {
    useTestKey()
    const baseCandidate = {
      id: 'candidate-1',
      type: 'candidate',
      createdAt: '2026-08-31T10:00:00.000Z',
      updatedAt: '2026-08-31T10:00:00.000Z',
      status: 'potential',
      scanStatus: 'NOT_REQUIRED',
      name: 'Alex Morgan',
      email: '',
      phone: '',
      role: 'Engineer',
      company: '',
      jobTitle: '',
      message: '',
    }

    const withoutCv = candidateToItem(baseCandidate, '2026-08')
    expect(withoutCv.emailHash).toBeUndefined()
    expect(withoutCv.cvKey).toBeUndefined()
    expect(__security.decryptText(withoutCv.name.S)).toBe('Alex Morgan')

    const withCv = candidateToItem(
      {
        ...baseCandidate,
        email: 'alex@example.com',
        cvKey: 'incoming/2026-08/candidate-1.pdf',
        cvFilename: 'alex-cv.pdf',
        cvMimeType: 'application/pdf',
        cvSize: 2048,
      },
      '2026-08',
    )
    expect(withCv.emailHash.S).toBe(__security.hashLookupValue('alex@example.com'))
    expect(withCv.cvSize).toEqual({ N: '2048' })
  })
})
