import type { VercelRequest, VercelResponse } from '@vercel/node'
import { serialize } from 'cookie'
import { generateRandomString, sha256Base64Url } from '../../lib/crypto'

const CLIO_BASE_URL = process.env.CLIO_BASE_URL || 'https://app.clio.com'
const CLIENT_ID = process.env.CLIO_CLIENT_ID || ''
const REDIRECT_URI = process.env.CLIO_REDIRECT_URI || ''
const DEFAULT_SCOPE = process.env.DEFAULT_SCOPE || 'openid profile offline_access read:users'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const stateNonce = generateRandomString(16)
    const codeVerifier = generateRandomString(64)
    const codeChallenge = sha256Base64Url(codeVerifier)
    const state = `${firmId}:${stateNonce}`

    const authUrl = new URL(`${CLIO_BASE_URL}/oauth/authorize`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    authUrl.searchParams.set('scope', DEFAULT_SCOPE)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('access_type', 'offline')

    const cookiePayload = JSON.stringify({ state, codeVerifier })
    res.setHeader('Set-Cookie', serialize('clio_oauth', cookiePayload, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
      maxAge: 15 * 60,
    }))

    res.status(302).setHeader('Location', authUrl.toString()).end()
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OAuth start failed' })
  }
}