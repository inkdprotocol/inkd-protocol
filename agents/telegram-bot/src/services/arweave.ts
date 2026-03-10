const API_URL = process.env.INKD_API_URL ?? 'https://api.inkdprotocol.com'

type UploadReceipt = { hash: string; txId: string; url: string; bytes: number }

async function postUpload(payload: object): Promise<UploadReceipt> {
  const res = await fetch(`${API_URL}/v1/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Upload API failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<UploadReceipt>
}

export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  filename: string,
  tags?: Record<string, string>,
): Promise<UploadReceipt> {
  return postUpload({ data: buffer.toString('base64'), contentType, filename, tags })
}

export async function uploadBinary(
  buffer: Buffer,
  opts: { contentType: string; filename: string; tags?: Record<string, string> },
): Promise<UploadReceipt> {
  return postUpload({ data: buffer.toString('base64'), contentType: opts.contentType, filename: opts.filename, tags: opts.tags })
}

export async function uploadText(content: string, tags?: Record<string, string>) {
  return postUpload({
    data: Buffer.from(content, 'utf8').toString('base64'),
    contentType: 'text/plain; charset=utf-8',
    filename: `${Date.now()}.txt`,
    tags,
  })
}
