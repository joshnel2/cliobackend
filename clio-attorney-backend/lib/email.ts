import sgMail from '@sendgrid/mail'

export interface EmailConfig {
  apiKey: string
  from: string
  to: string[]
}

export function getEmailConfigFromEnv(): EmailConfig | null {
  const apiKey = process.env.SENDGRID_API_KEY || ''
  const from = process.env.EMAIL_FROM || ''
  const toRaw = process.env.EMAIL_TO || ''
  if (!apiKey || !from || !toRaw) return null
  const to = toRaw.split(',').map(s => s.trim()).filter(Boolean)
  return { apiKey, from, to }
}

export async function sendEmailWithAttachment(subject: string, text: string, attachmentName: string, data: Buffer): Promise<void> {
  const cfg = getEmailConfigFromEnv()
  if (!cfg) throw new Error('Missing SENDGRID_API_KEY, EMAIL_FROM or EMAIL_TO')
  sgMail.setApiKey(cfg.apiKey)

  const msg = {
    to: cfg.to,
    from: cfg.from,
    subject,
    text,
    attachments: [
      {
        content: data.toString('base64'),
        filename: attachmentName,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment',
      },
    ],
  } as any

  await sgMail.send(msg, false)
}