import crypto from 'crypto'

export function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('base64url')
}

export function sha256Base64Url(input: string): string {
  const hash = crypto.createHash('sha256').update(input).digest()
  return Buffer.from(hash).toString('base64url')
}