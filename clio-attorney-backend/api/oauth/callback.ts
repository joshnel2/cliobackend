import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parse } from 'cookie'
import { saveTokens, type ClioTokens } from '../../lib/clio'

const CLIO_BASE_URL = process.env.CLIO_BASE_URL || 'https://app.clio.com'
const CLIENT_ID = process.env.CLIO_CLIENT_ID || ''
const CLIENT_SECRET = process.env.CLIO_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.CLIO_REDIRECT_URI || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { code, state } = req.query as { code?: string; state?: string }
    if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })

    const cookies = parse(req.headers.cookie || '')
    const cookie = cookies['clio_oauth']
    if (!cookie) return res.status(400).json({ error: 'Missing oauth cookie' })

    let parsed: { state: string; codeVerifier: string }
    try {
      parsed = JSON.parse(cookie)
    } catch {
      return res.status(400).json({ error: 'Invalid oauth cookie' })
    }
    if (parsed.state !== state) return res.status(400).json({ error: 'State mismatch' })

    const [firmId] = state.split(':')

    const tokenUrl = `${CLIO_BASE_URL}/oauth/token`
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: parsed.codeVerifier,
    })

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!resp.ok) {
      return res.status(400).json({ error: `Token exchange failed: ${resp.status} ${await resp.text()}` })
    }

    const data = await resp.json() as any
    const expiresIn: number = data.expires_in ?? 3600
    const tokens: ClioTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type ?? 'Bearer',
      scope: data.scope,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn - 60,
    }

    await saveTokens(firmId, tokens)

    res.status(200).json({ ok: true, firmId })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OAuth callback failed' })
  }
}