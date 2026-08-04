import { randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import {
  DeleteObjectCommand,
  GetObjectTaggingCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ddb = new DynamoDBClient({})
const s3 = new S3Client({})
const ses = new SESClient({})

const TABLE_NAME = process.env.TABLE_NAME
const CV_BUCKET_NAME = process.env.CV_BUCKET_NAME
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL
const SENDER_EMAIL = process.env.SENDER_EMAIL ?? NOTIFICATION_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 10 * 1024 * 1024)
const MONTHLY_SCAN_BYTES_CAP = Number(process.env.MONTHLY_SCAN_BYTES_CAP ?? 1024 * 1024 * 1024)

const allowedExtensions = new Set(['pdf', 'docx'])
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  },
  body: JSON.stringify(body),
})

const readHeader = (headers, name) => {
  const found = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return found?.[1]
}

const requireAdmin = (event) => {
  const supplied = readHeader(event.headers, 'x-admin-password')
  return Boolean(ADMIN_PASSWORD && supplied && supplied === ADMIN_PASSWORD)
}

const parseMultipart = (event) => {
  const contentType = readHeader(event.headers, 'content-type') ?? ''
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] ?? contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2]

  if (!boundary) {
    throw new Error('Missing multipart boundary')
  }

  const body = Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8')
  const delimiter = Buffer.from(`--${boundary}`)
  const fields = {}
  let file
  let offset = body.indexOf(delimiter)

  while (offset !== -1) {
    offset += delimiter.length
    if (body.subarray(offset, offset + 2).toString() === '--') break
    if (body.subarray(offset, offset + 2).toString() === '\r\n') offset += 2

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), offset)
    if (headerEnd === -1) break

    const headerText = body.subarray(offset, headerEnd).toString('utf8')
    const nextDelimiter = body.indexOf(delimiter, headerEnd + 4)
    if (nextDelimiter === -1) break

    let value = body.subarray(headerEnd + 4, nextDelimiter)
    if (value.subarray(value.length - 2).toString() === '\r\n') {
      value = value.subarray(0, value.length - 2)
    }

    const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] ?? ''
    const name = disposition.match(/name="([^"]+)"/)?.[1]
    const filename = disposition.match(/filename="([^"]*)"/)?.[1]
    const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim()

    if (name && filename) {
      file = { fieldName: name, filename, mimeType, content: value }
    } else if (name) {
      fields[name] = value.toString('utf8').trim()
    }

    offset = nextDelimiter
  }

  return { fields, file }
}

const normaliseType = (value) => {
  if (value === 'business' || value === 'partnership' || value === 'candidate') return value
  return 'other'
}

const validateFile = (file) => {
  if (!file || !file.filename || file.content.length === 0) {
    return undefined
  }

  const extension = file.filename.split('.').pop()?.toLowerCase() ?? ''
  if (!allowedExtensions.has(extension)) {
    throw new Error('Only PDF and DOCX files are accepted')
  }

  if (file.content.length > MAX_FILE_BYTES) {
    throw new Error('The CV must be 10MB or smaller')
  }

  if (file.mimeType && !allowedMimeTypes.has(file.mimeType)) {
    throw new Error('The uploaded CV type is not accepted')
  }

  const signature = file.content.subarray(0, 5).toString('latin1')
  if (extension === 'pdf' && signature !== '%PDF-') {
    throw new Error('The PDF file signature is invalid')
  }

  if (extension === 'docx' && file.content.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new Error('The DOCX file signature is invalid')
  }

  return extension
}

const validateFileMetadata = ({ filename, mimeType, size }) => {
  const extension = filename?.split('.').pop()?.toLowerCase() ?? ''

  if (!filename || !allowedExtensions.has(extension)) {
    throw new Error('Only PDF and DOCX files are accepted')
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) {
    throw new Error('The CV must be 10MB or smaller')
  }

  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    throw new Error('The uploaded CV type is not accepted')
  }

  return extension
}

const streamToBuffer = async (stream) => {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

const validateObjectSignature = async ({ key, extension }) => {
  const object = await s3.send(new GetObjectCommand({ Bucket: CV_BUCKET_NAME, Key: key, Range: 'bytes=0-8191' }))
  const content = await streamToBuffer(object.Body)
  const signature = content.subarray(0, 5).toString('latin1')

  if (extension === 'pdf' && signature !== '%PDF-') {
    throw new Error('The PDF file signature is invalid')
  }

  if (extension === 'docx' && content.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new Error('The DOCX file signature is invalid')
  }
}

const itemToCandidate = (item) => ({
  id: item.id?.S ?? '',
  createdAt: item.createdAt?.S ?? '',
  updatedAt: item.updatedAt?.S ?? '',
  approvedAt: item.approvedAt?.S,
  status: item.status?.S ?? 'potential_scan_pending',
  scanStatus: item.scanStatus?.S ?? 'PENDING',
  type: item.type?.S ?? 'candidate',
  name: item.name?.S ?? '',
  email: item.email?.S ?? '',
  phone: item.phone?.S ?? '',
  role: item.role?.S ?? '',
  message: item.message?.S ?? '',
  company: item.company?.S ?? '',
  jobTitle: item.jobTitle?.S ?? '',
  notes: item.notes?.S ?? '',
  tags: item.tags?.SS ?? [],
  cv: item.cvKey?.S
    ? {
        key: item.cvKey.S,
        filename: item.cvFilename?.S ?? 'CV',
        mimeType: item.cvMimeType?.S ?? '',
        size: Number(item.cvSize?.N ?? 0),
      }
    : undefined,
})

const statusFromScanTag = (tagValue, currentStatus) => {
  if (!tagValue || tagValue === 'PENDING') return currentStatus ?? 'potential_scan_pending'
  if (tagValue === 'NO_THREATS_FOUND') {
    return currentStatus === 'potential_scan_pending' ? 'potential' : currentStatus
  }
  if (tagValue === 'THREATS_FOUND') return 'rejected_security'
  if (['UNSUPPORTED', 'ACCESS_DENIED', 'FAILED'].includes(tagValue)) return 'rejected_security'
  return currentStatus ?? 'potential_scan_pending'
}

const refreshScanStatus = async (candidate) => {
  if (!candidate.cv?.key) return candidate

  try {
    const tags = await s3.send(new GetObjectTaggingCommand({ Bucket: CV_BUCKET_NAME, Key: candidate.cv.key }))
    const scanStatus = tags.TagSet?.find((tag) => tag.Key === 'GuardDutyMalwareScanStatus')?.Value ?? candidate.scanStatus
    const status = statusFromScanTag(scanStatus, candidate.status)

    if (scanStatus !== candidate.scanStatus || status !== candidate.status) {
      await ddb.send(
        new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: { id: { S: candidate.id } },
          UpdateExpression: 'SET scanStatus = :scanStatus, #status = :status, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':scanStatus': { S: scanStatus },
            ':status': { S: status },
            ':updatedAt': { S: new Date().toISOString() },
          },
        }),
      )
    }

    return { ...candidate, scanStatus, status }
  } catch {
    return candidate
  }
}

const sendNotification = async (candidate) => {
  const subjectMap = {
    business: 'TrueCraft Business Partnering Enquiry',
    partnership: 'TrueCraft Partnership Enquiry',
    candidate: 'TrueCraft Candidate CV Submission',
    other: 'TrueCraft Website Enquiry',
  }
  const adminUrl = process.env.ADMIN_URL ?? '/admin'

  await ses.send(
    new SendEmailCommand({
      Source: SENDER_EMAIL,
      Destination: { ToAddresses: [NOTIFICATION_EMAIL] },
      Message: {
        Subject: { Data: subjectMap[candidate.type] ?? subjectMap.other },
        Body: {
          Text: {
            Data: [
              `Submission: ${candidate.type}`,
              `Status: ${candidate.status}`,
              `Name: ${candidate.name}`,
              `Email: ${candidate.email}`,
              `Phone: ${candidate.phone}`,
              `Role: ${candidate.role || candidate.jobTitle}`,
              `Company: ${candidate.company}`,
              '',
              candidate.message,
              '',
              `Admin dashboard: ${adminUrl}`,
            ].join('\n'),
          },
          Html: {
            Data: `<h1>${subjectMap[candidate.type] ?? subjectMap.other}</h1>
              <table cellpadding="6" cellspacing="0" border="0">
                <tr><td><strong>Status</strong></td><td>${candidate.status}</td></tr>
                <tr><td><strong>Name</strong></td><td>${candidate.name}</td></tr>
                <tr><td><strong>Email</strong></td><td>${candidate.email}</td></tr>
                <tr><td><strong>Phone</strong></td><td>${candidate.phone}</td></tr>
                <tr><td><strong>Role</strong></td><td>${candidate.role || candidate.jobTitle}</td></tr>
                <tr><td><strong>Company</strong></td><td>${candidate.company}</td></tr>
              </table>
              <h2>Message</h2>
              <p>${candidate.message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>
              <p><a href="${adminUrl}">Open admin dashboard</a></p>`,
          },
        },
      },
    }),
  )
}

const getMonthlyUploadBytes = async (monthKey) => {
  const result = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'cvSize',
      FilterExpression: 'monthKey = :monthKey',
      ExpressionAttributeValues: { ':monthKey': { S: monthKey } },
    }),
  )

  return (result.Items ?? []).reduce((sum, item) => sum + Number(item.cvSize?.N ?? 0), 0)
}

const submit = async (event) => {
  const contentType = readHeader(event.headers, 'content-type') ?? ''

  if (contentType.includes('application/json')) {
    const fields = JSON.parse(event.body ?? '{}')
    const type = normaliseType(fields.type)
    const now = new Date()
    const id = randomUUID()

    const candidate = {
      id,
      type,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: 'potential',
      scanStatus: 'NOT_REQUIRED',
      name: fields.name ?? '',
      email: fields.email ?? '',
      phone: fields.phone ?? '',
      role: fields.role ?? fields.jobTitle ?? '',
      company: fields.company ?? '',
      jobTitle: fields.jobTitle ?? '',
      message: fields.message ?? '',
    }

    await ddb.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          id: { S: candidate.id },
          type: { S: candidate.type },
          monthKey: { S: now.toISOString().slice(0, 7) },
          createdAt: { S: candidate.createdAt },
          updatedAt: { S: candidate.updatedAt },
          status: { S: candidate.status },
          scanStatus: { S: candidate.scanStatus },
          name: { S: candidate.name },
          email: { S: candidate.email },
          phone: { S: candidate.phone },
          role: { S: candidate.role },
          company: { S: candidate.company },
          jobTitle: { S: candidate.jobTitle },
          message: { S: candidate.message },
        },
      }),
    )
    await sendNotification(candidate)

    return json(201, { id, message: 'Thanks. Your enquiry has been received.' })
  }

  const { fields, file } = parseMultipart(event)
  const type = normaliseType(fields.type)
  const extension = validateFile(file)
  const now = new Date()
  const id = randomUUID()
  const monthKey = now.toISOString().slice(0, 7)
  const cvKey = file ? `incoming/${monthKey}/${id}.${extension}` : undefined

  if (file) {
    const monthlyBytes = await getMonthlyUploadBytes(monthKey)
    if (monthlyBytes + file.content.length > MONTHLY_SCAN_BYTES_CAP) {
      return json(429, { message: 'Monthly CV scanning limit reached. Please try again later.' })
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: CV_BUCKET_NAME,
        Key: cvKey,
        Body: file.content,
        ContentType: file.mimeType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          originalFilename: file.filename,
          submissionId: id,
        },
      }),
    )
  }

  const candidate = {
    id,
    type,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: file ? 'potential_scan_pending' : 'potential',
    scanStatus: file ? 'PENDING' : 'NOT_REQUIRED',
    name: fields.name ?? '',
    email: fields.email ?? '',
    phone: fields.phone ?? '',
    role: fields.role ?? fields.jobTitle ?? '',
    company: fields.company ?? '',
    jobTitle: fields.jobTitle ?? '',
    message: fields.message ?? '',
    cvKey,
    cvFilename: file?.filename,
    cvMimeType: file?.mimeType,
    cvSize: file?.content.length,
  }

  const item = {
    id: { S: candidate.id },
    type: { S: candidate.type },
    monthKey: { S: monthKey },
    createdAt: { S: candidate.createdAt },
    updatedAt: { S: candidate.updatedAt },
    status: { S: candidate.status },
    scanStatus: { S: candidate.scanStatus },
    name: { S: candidate.name },
    email: { S: candidate.email },
    phone: { S: candidate.phone },
    role: { S: candidate.role },
    company: { S: candidate.company },
    jobTitle: { S: candidate.jobTitle },
    message: { S: candidate.message },
  }

  if (candidate.cvKey) {
    item.cvKey = { S: candidate.cvKey }
    item.cvFilename = { S: candidate.cvFilename }
    item.cvMimeType = { S: candidate.cvMimeType }
    item.cvSize = { N: String(candidate.cvSize) }
  }

  await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: item }))
  await sendNotification(candidate)

  return json(201, {
    id,
    message: file
      ? 'Thanks. Your CV has been received and is waiting for security scanning.'
      : 'Thanks. Your enquiry has been received.',
  })
}

const initUpload = async (event) => {
  const fields = JSON.parse(event.body ?? '{}')
  const file = fields.file
  const extension = validateFileMetadata({
    filename: file?.filename,
    mimeType: file?.mimeType,
    size: Number(file?.size),
  })
  const now = new Date()
  const monthKey = now.toISOString().slice(0, 7)
  const monthlyBytes = await getMonthlyUploadBytes(monthKey)

  if (monthlyBytes + Number(file.size) > MONTHLY_SCAN_BYTES_CAP) {
    return json(429, { message: 'Monthly CV scanning limit reached. Please try again later.' })
  }

  const id = randomUUID()
  const cvKey = `incoming/${monthKey}/${id}.${extension}`
  const type = normaliseType(fields.type)
  const candidate = {
    id,
    type,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'awaiting_upload',
    scanStatus: 'AWAITING_UPLOAD',
    name: fields.name ?? '',
    email: fields.email ?? '',
    phone: fields.phone ?? '',
    role: fields.role ?? fields.jobTitle ?? '',
    company: fields.company ?? '',
    jobTitle: fields.jobTitle ?? '',
    message: fields.message ?? '',
    cvKey,
    cvFilename: file.filename,
    cvMimeType: file.mimeType,
    cvSize: Number(file.size),
  }

  await ddb.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id: { S: candidate.id },
        type: { S: candidate.type },
        monthKey: { S: monthKey },
        createdAt: { S: candidate.createdAt },
        updatedAt: { S: candidate.updatedAt },
        status: { S: candidate.status },
        scanStatus: { S: candidate.scanStatus },
        name: { S: candidate.name },
        email: { S: candidate.email },
        phone: { S: candidate.phone },
        role: { S: candidate.role },
        company: { S: candidate.company },
        jobTitle: { S: candidate.jobTitle },
        message: { S: candidate.message },
        cvKey: { S: candidate.cvKey },
        cvFilename: { S: candidate.cvFilename },
        cvMimeType: { S: candidate.cvMimeType },
        cvSize: { N: String(candidate.cvSize) },
      },
    }),
  )

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: CV_BUCKET_NAME,
      Key: cvKey,
      ContentType: file.mimeType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        originalFilename: file.filename,
        submissionId: id,
      },
    }),
    { expiresIn: 300 },
  )

  return json(201, {
    id,
    upload: {
      url: uploadUrl,
      headers: {
        'content-type': file.mimeType,
        'x-amz-server-side-encryption': 'AES256',
      },
    },
  })
}

const completeUpload = async (event, id) => {
  const result = await ddb.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }))
  const candidate = result.Item ? itemToCandidate(result.Item) : undefined

  if (!candidate?.cv?.key) return json(404, { message: 'Submission not found' })
  if (candidate.status !== 'awaiting_upload') return json(409, { message: 'Submission upload is already complete' })

  try {
    const object = await s3.send(new HeadObjectCommand({ Bucket: CV_BUCKET_NAME, Key: candidate.cv.key }))
    const actualSize = object.ContentLength ?? 0
    const extension = validateFileMetadata({
      filename: candidate.cv.filename,
      mimeType: object.ContentType ?? candidate.cv.mimeType,
      size: actualSize,
    })

    await validateObjectSignature({ key: candidate.cv.key, extension })

    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { id: { S: id } },
        UpdateExpression: 'SET #status = :status, scanStatus = :scanStatus, cvSize = :cvSize, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': { S: 'potential_scan_pending' },
          ':scanStatus': { S: 'PENDING' },
          ':cvSize': { N: String(actualSize) },
          ':updatedAt': { S: new Date().toISOString() },
        },
      }),
    )

    await sendNotification({
      ...candidate,
      status: 'potential_scan_pending',
      scanStatus: 'PENDING',
    })

    return json(200, {
      message: 'Thanks. Your CV has been received and is waiting for security scanning.',
    })
  } catch (error) {
    await s3.send(new DeleteObjectCommand({ Bucket: CV_BUCKET_NAME, Key: candidate.cv.key })).catch(() => undefined)
    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: { id: { S: id } },
        UpdateExpression: 'SET #status = :status, scanStatus = :scanStatus, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': { S: 'rejected_security' },
          ':scanStatus': { S: 'FAILED_VALIDATION' },
          ':updatedAt': { S: new Date().toISOString() },
        },
      }),
    )
    throw error
  }
}

const list = async (event) => {
  if (!requireAdmin(event)) return json(401, { message: 'Invalid admin password' })

  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }))
  const candidates = await Promise.all((result.Items ?? []).map((item) => refreshScanStatus(itemToCandidate(item))))

  candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return json(200, { candidates })
}

const update = async (event, id) => {
  if (!requireAdmin(event)) return json(401, { message: 'Invalid admin password' })

  const body = JSON.parse(event.body ?? '{}')
  const allowedStatuses = new Set(['potential', 'publicly_available', 'cancelled'])
  const expressions = ['updatedAt = :updatedAt']
  const names = {}
  const values = { ':updatedAt': { S: new Date().toISOString() } }

  if (body.status) {
    if (!allowedStatuses.has(body.status)) return json(400, { message: 'Unsupported status' })
    expressions.push('#status = :status')
    names['#status'] = 'status'
    values[':status'] = { S: body.status }

    if (body.status === 'publicly_available') {
      expressions.push('approvedAt = :approvedAt')
      values[':approvedAt'] = { S: new Date().toISOString() }
    }
  }

  if (typeof body.notes === 'string') {
    expressions.push('notes = :notes')
    values[':notes'] = { S: body.notes.slice(0, 4000) }
  }

  if (Array.isArray(body.tags)) {
    const tags = body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 25)
    expressions.push('tags = :tags')
    values[':tags'] = tags.length ? { SS: tags } : { SS: ['untagged'] }
  }

  await ddb.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: id } },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: values,
    }),
  )

  return json(200, { message: 'Candidate updated' })
}

const cvUrl = async (event, id) => {
  if (!requireAdmin(event)) return json(401, { message: 'Invalid admin password' })

  const result = await ddb.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }))
  const candidate = result.Item ? await refreshScanStatus(itemToCandidate(result.Item)) : undefined

  if (!candidate?.cv?.key) return json(404, { message: 'CV not found' })
  if (candidate.status === 'rejected_security' || candidate.scanStatus !== 'NO_THREATS_FOUND') {
    return json(403, { message: 'CV is not available until the security scan passes' })
  }

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: CV_BUCKET_NAME,
      Key: candidate.cv.key,
      ResponseContentDisposition: `attachment; filename="${candidate.cv.filename.replaceAll('"', '')}"`,
    }),
    { expiresIn: 300 },
  )

  return json(200, { url })
}

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method
    const path = event.rawPath?.replace(/^\/api/, '') ?? '/'

    if (method === 'POST' && path === '/submissions') return await submit(event)
    if (method === 'POST' && path === '/submissions/init') return await initUpload(event)

    const completeMatch = path.match(/^\/submissions\/([^/]+)\/complete$/)
    if (method === 'POST' && completeMatch) return await completeUpload(event, completeMatch[1])

    if (method === 'GET' && path === '/admin/candidates') return await list(event)

    const updateMatch = path.match(/^\/admin\/candidates\/([^/]+)$/)
    if (method === 'PATCH' && updateMatch) return await update(event, updateMatch[1])

    const cvMatch = path.match(/^\/admin\/candidates\/([^/]+)\/cv-url$/)
    if (method === 'POST' && cvMatch) return await cvUrl(event, cvMatch[1])

    return json(404, { message: 'Not found' })
  } catch (error) {
    console.error(error)
    return json(400, { message: error.message ?? 'Request failed' })
  }
}
