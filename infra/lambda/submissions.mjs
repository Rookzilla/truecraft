import { cvUrl, deleteCandidate, listCandidates, statusFromScanTag, updateCandidate } from './admin-handlers.mjs'
import { completeUpload, initUpload, submit } from './public-handlers.mjs'
import { validateFile, validateFileMetadata } from './files.mjs'
import { json, normaliseType, readHeader, escapeHtml } from './http.mjs'
import { parseMultipart } from './multipart.mjs'
import { candidateToItem, itemToCandidate } from './records.mjs'
import { decryptText, encryptText, hashLookupValue, verifyPasswordHash } from './security.mjs'
import { normaliseContactFields, validateContactFields } from './contact-validation.mjs'

export {
  candidateToItem,
  escapeHtml,
  itemToCandidate,
  normaliseType,
  parseMultipart,
  readHeader,
  normaliseContactFields,
  statusFromScanTag,
  validateContactFields,
  validateFile,
  validateFileMetadata,
}

export const __security = {
  decryptText,
  encryptText,
  hashLookupValue,
  verifyPasswordHash,
}

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method
    const path = event.rawPath?.replace(/^\/api/, '') ?? '/'

    if (method === 'POST' && path === '/submissions') return await submit(event)
    if (method === 'POST' && path === '/submissions/init') return await initUpload(event)

    const completeMatch = path.match(/^\/submissions\/([^/]+)\/complete$/)
    if (method === 'POST' && completeMatch) return await completeUpload(completeMatch[1])

    if (method === 'GET' && path === '/admin/candidates') return await listCandidates(event)

    const updateMatch = path.match(/^\/admin\/candidates\/([^/]+)$/)
    if (method === 'PATCH' && updateMatch) return await updateCandidate(event, updateMatch[1])
    if (method === 'DELETE' && updateMatch) return await deleteCandidate(event, updateMatch[1])

    const cvMatch = path.match(/^\/admin\/candidates\/([^/]+)\/cv-url$/)
    if (method === 'POST' && cvMatch) return await cvUrl(event, cvMatch[1])

    return json(404, { message: 'Not found' })
  } catch (error) {
    console.error(error)
    return json(400, { message: error.message ?? 'Request failed' })
  }
}
