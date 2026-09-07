export const TABLE_NAME = process.env.TABLE_NAME
export const CV_BUCKET_NAME = process.env.CV_BUCKET_NAME
export const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL
export const SENDER_EMAIL = process.env.SENDER_EMAIL ?? NOTIFICATION_EMAIL
export const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 10 * 1024 * 1024)
export const MONTHLY_SCAN_BYTES_CAP = Number(process.env.MONTHLY_SCAN_BYTES_CAP ?? 1024 * 1024 * 1024)

export const allowedExtensions = new Set(['pdf', 'docx'])
export const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export const encryptedPiiFields = ['name', 'email', 'phone', 'role', 'company', 'jobTitle', 'message', 'notes']
