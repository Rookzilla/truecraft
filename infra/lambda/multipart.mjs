import { Buffer } from 'node:buffer'
import { readHeader } from './http.mjs'

export const parseMultipart = (event) => {
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
