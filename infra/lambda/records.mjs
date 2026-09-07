import { encryptedPiiFields } from './config.mjs'
import { decryptText, encryptText, hashLookupValue } from './security.mjs'

export const candidateToItem = (candidate, monthKey) => {
  const item = {
    id: { S: candidate.id },
    type: { S: candidate.type },
    monthKey: { S: monthKey },
    createdAt: { S: candidate.createdAt },
    updatedAt: { S: candidate.updatedAt },
    status: { S: candidate.status },
    scanStatus: { S: candidate.scanStatus },
    piiEncryptionVersion: { N: '1' },
  }

  for (const field of encryptedPiiFields) {
    item[field] = { S: encryptText(candidate[field]) }
  }

  const emailHash = hashLookupValue(candidate.email)
  if (emailHash) item.emailHash = { S: emailHash }

  if (candidate.cvKey) {
    item.cvKey = { S: candidate.cvKey }
    item.cvFilename = { S: candidate.cvFilename }
    item.cvMimeType = { S: candidate.cvMimeType }
    item.cvSize = { N: String(candidate.cvSize) }
  }

  return item
}

export const itemToCandidate = (item) => ({
  id: item.id?.S ?? '',
  createdAt: item.createdAt?.S ?? '',
  updatedAt: item.updatedAt?.S ?? '',
  approvedAt: item.approvedAt?.S,
  status: item.status?.S ?? 'potential_scan_pending',
  scanStatus: item.scanStatus?.S ?? 'PENDING',
  type: item.type?.S ?? 'candidate',
  name: decryptText(item.name?.S),
  email: decryptText(item.email?.S),
  phone: decryptText(item.phone?.S),
  role: decryptText(item.role?.S),
  message: decryptText(item.message?.S),
  company: decryptText(item.company?.S),
  jobTitle: decryptText(item.jobTitle?.S),
  notes: decryptText(item.notes?.S),
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
