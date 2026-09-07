import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  DeleteItemCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetItemCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutItemCommand,
  PutObjectCommand,
  S3Client,
  ScanCommand,
  SendEmailCommand,
  UpdateItemCommand,
  apiEvent,
  importHandler,
  multipartBody,
  parseBody,
  sendMock,
  signedUrlMock,
} from './submissions.handler.test-support.mjs'

describe('submission Lambda handler', () => {
  it('stores JSON submissions with encrypted PII and sends escaped email notifications', async () => {
    const { handler, __security } = await importHandler()
    sendMock.mockResolvedValue({})

    const response = await handler(
      apiEvent({
        body: JSON.stringify({
          type: 'business',
          company: '<Acme>',
          email: 'alex@example.com',
          jobTitle: 'CTO',
          message: '<script>alert("x")</script>',
          name: 'Alex Morgan',
          phone: '07700900123',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.statusCode).toBe(201)
    expect(parseBody(response).message).toBe('Thanks. Your enquiry has been received.')

    const put = sendMock.mock.calls.find(([command]) => command instanceof PutItemCommand)?.[0]
    expect(put.input.TableName).toBe('submissions')
    expect(put.input.Item.email.S).not.toBe('alex@example.com')
    expect(__security.decryptText(put.input.Item.email.S)).toBe('alex@example.com')
    expect(put.input.Item.emailHash.S).toBe(__security.hashLookupValue('alex@example.com'))

    const email = sendMock.mock.calls.find(([command]) => command instanceof SendEmailCommand)?.[0]
    expect(email.input.Destination.ToAddresses).toEqual(['notifications@example.com'])
    expect(email.input.Message.Body.Html.Data).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(email.input.Message.Body.Html.Data).not.toContain('<script>alert("x")</script>')
  })

  it('stores JSON submissions with safe default values for optional fields', async () => {
    const { handler, __security } = await importHandler()
    sendMock.mockResolvedValue({})

    const response = await handler(
      apiEvent({
        body: JSON.stringify({ email: 'sparse@example.com' }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.statusCode).toBe(201)
    const put = sendMock.mock.calls.find(([command]) => command instanceof PutItemCommand)?.[0]
    expect(put.input.Item.type).toEqual({ S: 'other' })
    expect(__security.decryptText(put.input.Item.name.S)).toBe('')
    expect(put.input.Item.emailHash.S).toBe(__security.hashLookupValue('sparse@example.com'))
  })

  it('rejects invalid contact fields before storing submissions or upload records', async () => {
    const { handler } = await importHandler()

    const invalidEmail = await handler(
      apiEvent({
        body: JSON.stringify({
          type: 'business',
          email: 'alex.example.com',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(invalidEmail.statusCode).toBe(400)
    expect(parseBody(invalidEmail).message).toBe('Please enter a valid email address.')

    const invalidPhone = await handler(
      apiEvent({
        path: '/api/submissions/init',
        body: JSON.stringify({
          type: 'candidate',
          email: 'sam@example.com',
          phone: '075454244831',
          file: {
            filename: 'sam-cv.pdf',
            mimeType: 'application/pdf',
            size: 2048,
          },
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(invalidPhone.statusCode).toBe(400)
    expect(parseBody(invalidPhone).message).toBe('Please enter a phone number using up to 11 digits only.')
    expect(sendMock).not.toHaveBeenCalledWith(expect.any(PutItemCommand))
  })

  it('creates presigned encrypted CV upload requests', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({ Items: [] })

    const response = await handler(
      apiEvent({
        path: '/api/submissions/init',
        body: JSON.stringify({
          type: 'candidate',
          name: 'Sam Lee',
          email: 'sam@example.com',
          role: 'Engineer',
          file: {
            filename: 'sam-cv.pdf',
            mimeType: 'application/pdf',
            size: 2048,
          },
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.statusCode).toBe(201)
    expect(parseBody(response).upload.headers).toEqual({
      'content-type': 'application/pdf',
      'x-amz-server-side-encryption': 'AES256',
    })
    expect(signedUrlMock).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'cv-bucket',
          ContentType: 'application/pdf',
          ServerSideEncryption: 'AES256',
        }),
      }),
      { expiresIn: 300 },
    )
  })

  it('rejects invalid upload metadata before creating a candidate record', async () => {
    const { handler } = await importHandler()

    const response = await handler(
      apiEvent({
        path: '/api/submissions/init',
        body: JSON.stringify({
          type: 'candidate',
          email: 'sam@example.com',
          file: {
            filename: 'sam-cv.exe',
            mimeType: 'application/octet-stream',
            size: 200,
          },
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.statusCode).toBe(400)
    expect(parseBody(response).message).toBe('Only PDF and DOCX files are accepted')
    expect(sendMock).not.toHaveBeenCalledWith(expect.any(PutItemCommand))
  })

  it('stores legacy multipart CV submissions and uploads the object encrypted', async () => {
    const { handler } = await importHandler()
    sendMock.mockImplementation((command) => {
      if (command instanceof ScanCommand) return Promise.resolve({ Items: [] })
      return Promise.resolve({})
    })
    const boundary = '----truecraft-boundary'

    const response = await handler(
      apiEvent({
        body: multipartBody({
          boundary,
          fields: {
            type: 'candidate',
            name: 'Priya Shah',
            email: 'priya@example.com',
            role: 'Platform Engineer',
            message: 'Please consider my CV.',
          },
          file: {
            filename: 'priya-cv.pdf',
            mimeType: 'application/pdf',
            content: '%PDF-1.7 content',
          },
        }),
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      }),
    )

    expect(response.statusCode).toBe(201)
    expect(parseBody(response).message).toContain('waiting for security scanning')
    const upload = sendMock.mock.calls.find(([command]) => command instanceof PutObjectCommand)?.[0]
    expect(upload.input).toMatchObject({
      Bucket: 'cv-bucket',
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
      Metadata: {
        originalFilename: 'priya-cv.pdf',
      },
    })
    expect(upload.input.Body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('stores legacy multipart submissions without files as normal enquiries', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({})
    const boundary = '----truecraft-boundary'

    const response = await handler(
      apiEvent({
        body: multipartBody({
          boundary,
          fields: {
            type: 'partnership',
            name: 'Morgan Smith',
            email: 'morgan@example.com',
            jobTitle: 'Operations Lead',
          },
        }),
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      }),
    )

    expect(response.statusCode).toBe(201)
    expect(parseBody(response).message).toBe('Thanks. Your enquiry has been received.')
    const put = sendMock.mock.calls.find(([command]) => command instanceof PutItemCommand)?.[0]
    expect(put.input.Item.status).toEqual({ S: 'potential' })
    expect(put.input.Item.scanStatus).toEqual({ S: 'NOT_REQUIRED' })
    expect(put.input.Item.cvKey).toBeUndefined()
  })

  it('rejects malformed multipart requests and unsupported CV signatures', async () => {
    const { handler } = await importHandler()
    const missingBoundary = await handler(
      apiEvent({
        body: '',
        headers: { 'content-type': 'multipart/form-data' },
      }),
    )
    expect(missingBoundary.statusCode).toBe(400)
    expect(parseBody(missingBoundary).message).toBe('Missing multipart boundary')

    const boundary = '----truecraft-boundary'
    const invalidSignature = await handler(
      apiEvent({
        body: multipartBody({
          boundary,
          fields: { type: 'candidate', email: 'candidate@example.com' },
          file: {
            filename: 'candidate.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            content: 'not-a-docx',
          },
        }),
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      }),
    )
    expect(invalidSignature.statusCode).toBe(400)
    expect(parseBody(invalidSignature).message).toBe('The DOCX file signature is invalid')
  })

  it('rejects uploads when the monthly scanning cap would be exceeded', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({ Items: [{ cvSize: { N: String(1024 * 1024 * 1024) } }] })

    const response = await handler(
      apiEvent({
        path: '/api/submissions/init',
        body: JSON.stringify({
          type: 'candidate',
          email: 'sam@example.com',
          file: {
            filename: 'sam-cv.pdf',
            mimeType: 'application/pdf',
            size: 1,
          },
        }),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.statusCode).toBe(429)
    expect(parseBody(response).message).toBe('Monthly CV scanning limit reached. Please try again later.')
  })

  it('returns not found when a completed upload or CV download references a missing candidate', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({ Item: undefined })

    const complete = await handler(apiEvent({ path: '/api/submissions/missing/complete' }))
    expect(complete.statusCode).toBe(404)
    expect(parseBody(complete).message).toBe('Submission not found')

    const cv = await handler(
      apiEvent({
        method: 'POST',
        path: '/api/admin/candidates/missing/cv-url',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )
    expect(cv.statusCode).toBe(404)
    expect(parseBody(cv).message).toBe('CV not found')
  })

  it('rejects completion for already completed uploads and unauthenticated CV URL requests', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({
      Item: {
        id: { S: 'candidate-1' },
        status: { S: 'potential_scan_pending' },
        scanStatus: { S: 'PENDING' },
        cvKey: { S: 'incoming/2026-08/candidate-1.pdf' },
        cvFilename: { S: 'candidate-1.pdf' },
        cvMimeType: { S: 'application/pdf' },
        cvSize: { N: '1024' },
      },
    })

    const complete = await handler(apiEvent({ path: '/api/submissions/candidate-1/complete' }))
    expect(complete.statusCode).toBe(409)
    expect(parseBody(complete).message).toBe('Submission upload is already complete')

    const cv = await handler(
      apiEvent({
        method: 'POST',
        path: '/api/admin/candidates/candidate-1/cv-url',
      }),
    )
    expect(cv.statusCode).toBe(401)
  })

  it('completes valid uploaded CVs and rejects invalid object signatures', async () => {
    const { handler, __security } = await importHandler()
    const item = {
      id: { S: 'candidate-1' },
      createdAt: { S: '2026-08-31T10:00:00.000Z' },
      updatedAt: { S: '2026-08-31T10:00:00.000Z' },
      status: { S: 'awaiting_upload' },
      scanStatus: { S: 'AWAITING_UPLOAD' },
      type: { S: 'candidate' },
      name: { S: __security.encryptText('Alex Morgan') },
      email: { S: __security.encryptText('alex@example.com') },
      phone: { S: '' },
      role: { S: 'Engineer' },
      message: { S: '' },
      company: { S: '' },
      jobTitle: { S: '' },
      notes: { S: '' },
      cvKey: { S: 'incoming/2026-08/candidate-1.pdf' },
      cvFilename: { S: 'alex-cv.pdf' },
      cvMimeType: { S: 'application/pdf' },
      cvSize: { N: '2048' },
    }
    let validSignature = true
    sendMock.mockImplementation((command) => {
      if (command instanceof GetItemCommand) return Promise.resolve({ Item: item })
      if (command instanceof HeadObjectCommand) {
        return Promise.resolve({ ContentLength: 2048, ContentType: 'application/pdf' })
      }
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({
          Body: Readable.from([validSignature ? Buffer.from('%PDF-valid') : Buffer.from('not-pdf')]),
        })
      }
      return Promise.resolve({})
    })

    const completed = await handler(apiEvent({ path: '/api/submissions/candidate-1/complete' }))
    expect(completed.statusCode).toBe(200)
    expect(parseBody(completed).message).toContain('waiting for security scanning')

    validSignature = false
    const rejected = await handler(apiEvent({ path: '/api/submissions/candidate-1/complete' }))
    expect(rejected.statusCode).toBe(400)
    expect(parseBody(rejected).message).toBe('The PDF file signature is invalid')
    expect(sendMock.mock.calls.some(([command]) => command instanceof DeleteObjectCommand)).toBe(true)
  })

  it('returns not found for unknown routes', async () => {
    const { handler } = await importHandler()

    const response = await handler(apiEvent({ method: 'GET', path: '/api/nope' }))

    expect(response.statusCode).toBe(404)
    expect(parseBody(response).message).toBe('Not found')
  })
})
