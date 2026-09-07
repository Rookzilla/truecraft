import { DeleteItemCommand, GetItemCommand, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { GetObjectCommand, GetObjectTaggingCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ddb, s3 } from './clients.mjs'
import { CV_BUCKET_NAME, TABLE_NAME } from './config.mjs'
import { purgeCvObject } from './files.mjs'
import { json } from './http.mjs'
import { itemToCandidate } from './records.mjs'
import { encryptText, requireAdmin } from './security.mjs'

export const statusFromScanTag = (tagValue, currentStatus) => {
  if (!tagValue || tagValue === 'PENDING') return currentStatus ?? 'potential_scan_pending'
  if (tagValue === 'NO_THREATS_FOUND') {
    return currentStatus === 'potential_scan_pending' ? 'potential' : currentStatus
  }
  if (tagValue === 'THREATS_FOUND') return 'rejected_security'
  if (['UNSUPPORTED', 'ACCESS_DENIED', 'FAILED'].includes(tagValue)) return 'rejected_security'
  return currentStatus ?? 'potential_scan_pending'
}

export const refreshScanStatus = async (candidate) => {
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

export const listCandidates = async (event) => {
  if (!requireAdmin(event)) return json(401, { message: 'Invalid admin password' })

  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }))
  const candidates = await Promise.all((result.Items ?? []).map((item) => refreshScanStatus(itemToCandidate(item))))

  candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return json(200, { candidates })
}

export const updateCandidate = async (event, id) => {
  if (!requireAdmin(event)) return json(401, { message: 'Invalid admin password' })

  const body = JSON.parse(event.body ?? '{}')
  const allowedStatuses = new Set(['potential', 'publicly_available', 'cancelled'])
  const expressions = ['updatedAt = :updatedAt']
  const removals = []
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
    } else if (body.status === 'potential') {
      removals.push('approvedAt')
    }
  }

  if (typeof body.notes === 'string') {
    expressions.push('notes = :notes')
    values[':notes'] = { S: encryptText(body.notes.slice(0, 4000)) }
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
      UpdateExpression: `SET ${expressions.join(', ')}${removals.length ? ` REMOVE ${removals.join(', ')}` : ''}`,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: values,
    }),
  )

  return json(200, { message: 'Candidate updated' })
}

export const deleteCandidate = async (event, id) => {
  if (!requireAdmin(event)) return json(401, { message: 'Invalid admin password' })

  const result = await ddb.send(new GetItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }))
  const candidate = result.Item ? itemToCandidate(result.Item) : undefined

  if (!candidate?.id) return json(404, { message: 'Candidate not found' })
  if (!['cancelled', 'publicly_available'].includes(candidate.status)) {
    return json(409, { message: 'Cancel or approve the candidate before deleting the record' })
  }

  if (candidate.cv?.key) {
    await purgeCvObject(candidate.cv.key)
  }

  await ddb.send(new DeleteItemCommand({ TableName: TABLE_NAME, Key: { id: { S: id } } }))

  return json(200, { message: 'Candidate deleted' })
}

export const cvUrl = async (event, id) => {
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
