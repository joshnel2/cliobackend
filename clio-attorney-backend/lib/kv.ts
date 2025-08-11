import { kv } from '@vercel/kv'

export async function setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds && ttlSeconds > 0) {
    await kv.set(key, value as unknown as any, { ex: ttlSeconds })
  } else {
    await kv.set(key, value as unknown as any)
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const value = await kv.get<T>(key)
  return value ?? null
}

export async function del(key: string): Promise<void> {
  await kv.del(key)
}