import { randomUUID } from 'node:crypto'
import { PutItemCommand, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ddb, s3 } from './clients.mjs'
import { CV_BUCKET_NAME, TABLE_NAME } from './config.mjs'
import { validateContactFields } from './contact-validation.mjs'
import {
  assertMonthlyScanCapacity,
  deleteCurrentCvObject,
  headCvObject,
  putCvObject,
  validateFile,
  validateFileMetadata,
  validateObjectSignature,
} from './files.mjs'
import { json, normaliseType, readHeader } from './http.mjs'
import { parseMultipart } from './multipart.mjs'
import { sendNotification } from './notifications.mjs'
import { candidateToItem, itemToCandidate } from './records.mjs'

export const submit = async (event) => {
  const contentType = readHeader(event.headers, 'content-type') ?? ''

  if (contentType.includes('application/json')) {
    const fields = JSON.parse(event.body ?? '{}')
    const contactValidation = validateContactFields(fields)
    if (!contactValidation.valid) return json(400, { message: contactValidation.message })

    const contactFields = contactValidation.fields
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
      email: contactFields.email,
      phone: contactFields.phone,
      role: fields.role ?? fields.jobTitle ?? '',
      company: fields.company ?? '',
      jobTitle: fields.jobTitle ?? '',
      message: fields.message ?? '',
    }

    await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: candidateToItem(candidate, now.toISOString().slice(0, 7)) }))
    await sendNotification(candidate)

    return json(201, { id, message: 'Thanks. Your enquiry has been received.' })
  }

  const { fields, file } = parseMultipart(event)
  const contactValidation = validateContactFields(fields)
  if (!contactValidation.valid) return json(400, { message: contactValidation.message })

  const contactFields = contactValidation.fields
  const type = normaliseType(fields.type)
  const extension = validateFile(file)
  const now = new Date()
  const id = randomUUID()
  const monthKey = now.toISOString().slice(0, 7)
  const cvKey = file ? `incoming/${monthKey}/${id}.${extension}` : undefined

  if (file) {
    if (!(await assertMonthlyScanCapacity(monthKey, file.content.length))) {
      return json(429, { message: 'Monthly CV scanning limit reached. Please try again later.' })
    }

    await putCvObject({
      key: cvKey,
      body: file.content,
      contentType: file.mimeType,
      filename: file.filename,
      submissionId: id,
    })
  }

  const candidate = {
    id,
    type,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: file ? 'potential_scan_pending' : 'potential',
    scanStatus: file ? 'PENDING' : 'NOT_REQUIRED',
    name: fields.name ?? '',
    email: contactFields.email,
    phone: contactFields.phone,
    role: fields.role ?? fields.jobTitle ?? '',
    company: fields.company ?? '',
    jobTitle: fields.jobTitle ?? '',
    message: fields.message ?? '',
    cvKey,
    cvFilename: file?.filename,
    cvMimeType: file?.mimeType,
    cvSize: file?.content.length,
  }

  await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: candidateToItem(candidate, monthKey) }))
  await sendNotification(candidate)

  return json(201, {
    id,
    message: file
      ? 'Thanks. Your CV has been received and is waiting for security scanning.'
      : 'Thanks. Your enquiry has been received.',
  })
}

export const initUpload = async (event) => {
  const fields = JSON.parse(event.body ?? '{}')
  const contactValidation = validateContactFields(fields)
  if (!contactValidation.valid) return json(400, { message: contactValidation.message })

  const contactFields = contactValidation.fields
  const file = fields.file
  const extension = validateFileMetadata({
    filename: file?.filename,
    mimeType: file?.mimeType,
    size: Number(file?.size),
  })
  const now = new Date()
  const monthKey = now.toISOString().slice(0, 7)

  if (!(await assertMonthlyScanCapacity(monthKey, Number(file.size)))) {
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
    email: contactFields.email,
    phone: contactFields.phone,
    role: fields.role ?? fields.jobTitle ?? '',
    company: fields.company ?? '',
    jobTitle: fields.jobTitle ?? '',
    message: fields.message ?? '',
    cvKey,
    cvFilename: file.filename,
    cvMimeType: file.mimeType,
    cvSize: Number(file.size),
  }

  await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: candidateToItem(candidate, monthKey) }))

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

export const completeUpload = async (id) => {
  const result = await ddb.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }))
  const candidate = result.Item ? itemToCandidate(result.Item) : undefined

  if (!candidate?.cv?.key) return json(404, { message: 'Submission not found' })
  if (candidate.status !== 'awaiting_upload') return json(409, { message: 'Submission upload is already complete' })

  try {
    const object = await headCvObject(candidate.cv.key)
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

    await sendNotification({ ...candidate, status: 'potential_scan_pending', scanStatus: 'PENDING' })

    return json(200, { message: 'Thanks. Your CV has been received and is waiting for security scanning.' })
  } catch (error) {
    await deleteCurrentCvObject(candidate.cv.key).catch(() => undefined)
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
