import { Buffer } from 'node:buffer'
import { ScanCommand } from '@aws-sdk/client-dynamodb'
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { ddb, s3 } from './clients.mjs'
import {
  allowedExtensions,
  allowedMimeTypes,
  CV_BUCKET_NAME,
  MAX_FILE_BYTES,
  MONTHLY_SCAN_BYTES_CAP,
  TABLE_NAME,
} from './config.mjs'

export const validateFile = (file) => {
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

export const validateFileMetadata = ({ filename, mimeType, size }) => {
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

export const validateObjectSignature = async ({ key, extension }) => {
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

export const getMonthlyUploadBytes = async (monthKey) => {
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

export const assertMonthlyScanCapacity = async (monthKey, fileSize) => {
  const monthlyBytes = await getMonthlyUploadBytes(monthKey)
  if (monthlyBytes + fileSize > MONTHLY_SCAN_BYTES_CAP) {
    return false
  }
  return true
}

export const putCvObject = async ({ key, body, contentType, filename, submissionId }) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: CV_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      Metadata: {
        originalFilename: filename,
        submissionId,
      },
    }),
  )
}

export const headCvObject = (key) => s3.send(new HeadObjectCommand({ Bucket: CV_BUCKET_NAME, Key: key }))

export const deleteCurrentCvObject = (key) => s3.send(new DeleteObjectCommand({ Bucket: CV_BUCKET_NAME, Key: key }))

export const purgeCvObject = async (key) => {
  const objects = []
  let keyMarker
  let versionIdMarker

  do {
    const result = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: CV_BUCKET_NAME,
        Prefix: key,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      }),
    )

    for (const version of result.Versions ?? []) {
      if (version.Key === key) objects.push({ Key: key, VersionId: version.VersionId })
    }
    for (const marker of result.DeleteMarkers ?? []) {
      if (marker.Key === key) objects.push({ Key: key, VersionId: marker.VersionId })
    }

    keyMarker = result.NextKeyMarker
    versionIdMarker = result.NextVersionIdMarker
  } while (keyMarker)

  if (!objects.length) {
    await deleteCurrentCvObject(key)
    return
  }

  while (objects.length) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: CV_BUCKET_NAME,
        Delete: {
          Objects: objects.splice(0, 1000),
          Quiet: true,
        },
      }),
    )
  }
}
