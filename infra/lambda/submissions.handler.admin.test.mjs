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
  it('lists candidates only for valid admin credentials and refreshes scan tags', async () => {
    const { handler, __security } = await importHandler()
    sendMock.mockImplementation((command) => {
      if (command instanceof ScanCommand) {
        return Promise.resolve({
          Items: [
            {
              id: { S: 'candidate-1' },
              createdAt: { S: '2026-08-31T10:00:00.000Z' },
              updatedAt: { S: '2026-08-31T10:00:00.000Z' },
              status: { S: 'potential_scan_pending' },
              scanStatus: { S: 'PENDING' },
              type: { S: 'candidate' },
              name: { S: __security.encryptText('Alex Morgan') },
              email: { S: __security.encryptText('alex@example.com') },
              phone: { S: '' },
              role: { S: __security.encryptText('Engineer') },
              message: { S: '' },
              company: { S: '' },
              jobTitle: { S: '' },
              notes: { S: '' },
              tags: { SS: ['aws'] },
              cvKey: { S: 'incoming/2026-08/candidate-1.pdf' },
              cvFilename: { S: 'alex-cv.pdf' },
              cvMimeType: { S: 'application/pdf' },
              cvSize: { N: '1024' },
            },
          ],
        })
      }
      if (command instanceof GetObjectTaggingCommand) {
        return Promise.resolve({
          TagSet: [{ Key: 'GuardDutyMalwareScanStatus', Value: 'NO_THREATS_FOUND' }],
        })
      }
      return Promise.resolve({})
    })

    const denied = await handler(apiEvent({ method: 'GET', path: '/api/admin/candidates' }))
    expect(denied.statusCode).toBe(401)

    const response = await handler(
      apiEvent({
        method: 'GET',
        path: '/api/admin/candidates',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )

    expect(response.statusCode).toBe(200)
    expect(parseBody(response).candidates[0]).toMatchObject({
      id: 'candidate-1',
      name: 'Alex Morgan',
      email: 'alex@example.com',
      status: 'potential',
      scanStatus: 'NO_THREATS_FOUND',
    })
    expect(sendMock.mock.calls.some(([command]) => command instanceof UpdateItemCommand)).toBe(true)
  })

  it('returns an empty admin list when DynamoDB has no items', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({})

    const response = await handler(
      apiEvent({
        method: 'GET',
        path: '/api/admin/candidates',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )

    expect(response.statusCode).toBe(200)
    expect(parseBody(response).candidates).toEqual([])
  })

  it('accepts admin requests already authorized by Cognito JWT claims', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({})

    const response = await handler(
      apiEvent({
        method: 'GET',
        path: '/api/admin/candidates',
        authorizer: {
          jwt: {
            claims: {
              'cognito:username': 'admin@example.com',
              sub: 'admin-user-id',
            },
          },
        },
      }),
    )

    expect(response.statusCode).toBe(200)
    expect(parseBody(response).candidates).toEqual([])
  })

  it('updates notes encrypted and marks approval timestamps for approved candidates', async () => {
    const { handler, __security } = await importHandler()
    sendMock.mockResolvedValue({})

    const response = await handler(
      apiEvent({
        method: 'PATCH',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
        body: JSON.stringify({
          notes: 'Great Node.js and AWS experience',
          status: 'publicly_available',
          tags: ['node', 'aws'],
        }),
      }),
    )

    expect(response.statusCode).toBe(200)
    const update = sendMock.mock.calls.find(([command]) => command instanceof UpdateItemCommand)?.[0]
    expect(update.input.ExpressionAttributeValues[':status']).toEqual({ S: 'publicly_available' })
    expect(update.input.ExpressionAttributeValues[':approvedAt'].S).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(__security.decryptText(update.input.ExpressionAttributeValues[':notes'].S)).toBe('Great Node.js and AWS experience')
    expect(update.input.ExpressionAttributeValues[':tags']).toEqual({ SS: ['node', 'aws'] })
  })

  it('moves approved candidates back to potential and clears approval timestamps', async () => {
    const { handler } = await importHandler()
    sendMock.mockResolvedValue({})

    const response = await handler(
      apiEvent({
        method: 'PATCH',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
        body: JSON.stringify({ status: 'potential' }),
      }),
    )

    expect(response.statusCode).toBe(200)
    const update = sendMock.mock.calls.find(([command]) => command instanceof UpdateItemCommand)?.[0]
    expect(update.input.ExpressionAttributeValues[':status']).toEqual({ S: 'potential' })
    expect(update.input.UpdateExpression).toContain('REMOVE approvedAt')
  })

  it('rejects unauthenticated admin updates and writes defaults for empty tag updates', async () => {
    const { handler } = await importHandler()

    const unauthorized = await handler(
      apiEvent({
        method: 'PATCH',
        path: '/api/admin/candidates/candidate-1',
        body: JSON.stringify({ notes: 'No access' }),
      }),
    )
    expect(unauthorized.statusCode).toBe(401)

    sendMock.mockResolvedValue({})
    const response = await handler(
      apiEvent({
        method: 'PATCH',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
        body: JSON.stringify({ tags: ['  ', ''] }),
      }),
    )

    expect(response.statusCode).toBe(200)
    const update = sendMock.mock.calls.find(([command]) => command instanceof UpdateItemCommand)?.[0]
    expect(update.input.ExpressionAttributeValues[':tags']).toEqual({ SS: ['untagged'] })
    expect(update.input.ExpressionAttributeNames).toBeUndefined()
  })

  it('rejects unsupported admin status updates before writing to DynamoDB', async () => {
    const { handler } = await importHandler()

    const response = await handler(
      apiEvent({
        method: 'PATCH',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
        body: JSON.stringify({ status: 'rejected_security' }),
      }),
    )

    expect(response.statusCode).toBe(400)
    expect(parseBody(response).message).toBe('Unsupported status')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('deletes cancelled candidates and their CV object for authenticated admins', async () => {
    const { handler, __security } = await importHandler()
    sendMock.mockImplementation((command) => {
      if (command instanceof GetItemCommand) {
        return Promise.resolve({
          Item: {
            id: { S: 'candidate-1' },
            createdAt: { S: '2026-08-31T10:00:00.000Z' },
            updatedAt: { S: '2026-08-31T10:00:00.000Z' },
            status: { S: 'cancelled' },
            scanStatus: { S: 'NO_THREATS_FOUND' },
            type: { S: 'candidate' },
            name: { S: __security.encryptText('Alex Morgan') },
            email: { S: __security.encryptText('alex@example.com') },
            phone: { S: '' },
            role: { S: '' },
            message: { S: '' },
            company: { S: '' },
            jobTitle: { S: '' },
            notes: { S: '' },
            cvKey: { S: 'incoming/2026-08/candidate-1.pdf' },
            cvFilename: { S: 'alex-cv.pdf' },
            cvMimeType: { S: 'application/pdf' },
            cvSize: { N: '1024' },
          },
        })
      }
      if (command instanceof ListObjectVersionsCommand) {
        return Promise.resolve({
          Versions: [{ Key: 'incoming/2026-08/candidate-1.pdf', VersionId: 'version-1' }],
          DeleteMarkers: [{ Key: 'incoming/2026-08/candidate-1.pdf', VersionId: 'marker-1' }],
        })
      }
      return Promise.resolve({})
    })

    const response = await handler(
      apiEvent({
        method: 'DELETE',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )

    expect(response.statusCode).toBe(200)
    expect(parseBody(response).message).toBe('Candidate deleted')
    const deleteObjects = sendMock.mock.calls.find(([command]) => command instanceof DeleteObjectsCommand)?.[0]
    expect(deleteObjects.input.Delete.Objects).toEqual([
      { Key: 'incoming/2026-08/candidate-1.pdf', VersionId: 'version-1' },
      { Key: 'incoming/2026-08/candidate-1.pdf', VersionId: 'marker-1' },
    ])
    expect(sendMock.mock.calls.some(([command]) => command instanceof DeleteItemCommand)).toBe(true)
  })

  it('deletes accepted candidates for authenticated admins', async () => {
    const { handler } = await importHandler()
    sendMock.mockImplementation((command) => {
      if (command instanceof GetItemCommand) {
        return Promise.resolve({
          Item: {
            id: { S: 'candidate-1' },
            status: { S: 'publicly_available' },
            scanStatus: { S: 'NOT_REQUIRED' },
          },
        })
      }
      return Promise.resolve({})
    })

    const response = await handler(
      apiEvent({
        method: 'DELETE',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )

    expect(response.statusCode).toBe(200)
    expect(sendMock.mock.calls.some(([command]) => command instanceof DeleteItemCommand)).toBe(true)
  })

  it('rejects unauthenticated, unknown, or active candidate deletion requests', async () => {
    const { handler } = await importHandler()

    const unauthorized = await handler(
      apiEvent({
        method: 'DELETE',
        path: '/api/admin/candidates/candidate-1',
      }),
    )
    expect(unauthorized.statusCode).toBe(401)

    sendMock.mockResolvedValueOnce({ Item: undefined })
    const missing = await handler(
      apiEvent({
        method: 'DELETE',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )
    expect(missing.statusCode).toBe(404)

    sendMock.mockResolvedValueOnce({
      Item: {
        id: { S: 'candidate-1' },
        status: { S: 'potential' },
      },
    })
    const active = await handler(
      apiEvent({
        method: 'DELETE',
        path: '/api/admin/candidates/candidate-1',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )
    expect(active.statusCode).toBe(409)
    expect(parseBody(active).message).toBe('Cancel or approve the candidate before deleting the record')
  })

  it('blocks CV URLs until scan status passes and signs downloads after a clean scan', async () => {
    const { handler, __security } = await importHandler()
    signedUrlMock.mockResolvedValue('https://example.com/signed-download-url')
    const item = {
      id: { S: 'candidate-1' },
      createdAt: { S: '2026-08-31T10:00:00.000Z' },
      updatedAt: { S: '2026-08-31T10:00:00.000Z' },
      status: { S: 'potential' },
      scanStatus: { S: 'NO_THREATS_FOUND' },
      type: { S: 'candidate' },
      name: { S: __security.encryptText('Alex Morgan') },
      email: { S: __security.encryptText('alex@example.com') },
      phone: { S: '' },
      role: { S: '' },
      message: { S: '' },
      company: { S: '' },
      jobTitle: { S: '' },
      notes: { S: '' },
      cvKey: { S: 'incoming/2026-08/candidate-1.pdf' },
      cvFilename: { S: 'alex"cv.pdf' },
      cvMimeType: { S: 'application/pdf' },
      cvSize: { N: '1024' },
    }
    sendMock.mockImplementation((command) => {
      if (command instanceof GetItemCommand) return Promise.resolve({ Item: item })
      if (command instanceof GetObjectTaggingCommand) {
        return Promise.resolve({
          TagSet: [{ Key: 'GuardDutyMalwareScanStatus', Value: item.scanStatus.S }],
        })
      }
      return Promise.resolve({})
    })

    item.scanStatus.S = 'PENDING'
    const blocked = await handler(
      apiEvent({
        method: 'POST',
        path: '/api/admin/candidates/candidate-1/cv-url',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )
    expect(blocked.statusCode).toBe(403)

    item.scanStatus.S = 'NO_THREATS_FOUND'
    const response = await handler(
      apiEvent({
        method: 'POST',
        path: '/api/admin/candidates/candidate-1/cv-url',
        headers: { 'x-admin-password': 'a-long-admin-password' },
      }),
    )

    expect(response.statusCode).toBe(200)
    expect(parseBody(response).url).toBe('https://example.com/signed-download-url')
    expect(signedUrlMock).toHaveBeenLastCalledWith(
      expect.any(S3Client),
      expect.objectContaining({
        input: expect.objectContaining({
          ResponseContentDisposition: 'attachment; filename="alexcv.pdf"',
        }),
      }),
      { expiresIn: 300 },
    )
  })

})
