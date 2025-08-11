import { randomBytes, createHash } from 'crypto'

/**
 * Generates a URL-safe random string of the specified length using base64url characters.
 */
export function generateRandomString(length: number): string {
  // Generate slightly more bytes than needed and then trim to length
  // Using base64url to ensure URL-safe characters
  const bytes = randomBytes(Math.ceil(length * 0.75) + 2)
  const base64url = bytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  return base64url.slice(0, length)
}

/**
 * Returns the SHA-256 digest of the input encoded as base64url without padding.
 */
export function sha256Base64Url(input: string): string {
  const digest = createHash('sha256').update(input).digest('base64')
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}