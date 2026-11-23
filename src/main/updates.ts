import { createPublicKey, verify } from 'node:crypto'
import { webUrl } from '../shared/validation'

declare const __NEXUS_UPDATE_URL__: string
declare const __NEXUS_UPDATE_KEY__: string

const feed = webUrl(__NEXUS_UPDATE_URL__)
export const updateConfigured = Boolean(feed?.startsWith('https:') && __NEXUS_UPDATE_KEY__)

function versionParts(version: unknown) {
  return typeof version === 'string' && /^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(version)
    ? version.split('.').map(Number)
    : undefined
}

export async function checkUpdates(current: string) {
  if (!updateConfigured || !feed) throw new Error('Update channel has not been configured')
  const response = await fetch(feed, { redirect: 'error', signal: AbortSignal.timeout(12000) })
  if (!response.ok || !response.body) throw new Error('Update feed unavailable')
  let size = 0
  const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength
      if (size > 32768) throw new Error('Update manifest too large')
      controller.enqueue(chunk)
    }
  }))
  const data: unknown = await new Response(stream).json()
  if (!data || typeof data !== 'object' || !('payload' in data) || !('signature' in data))
    throw new Error('Invalid update envelope')
  if (typeof data.payload !== 'string' || typeof data.signature !== 'string') throw new Error('Invalid update envelope')
  const bytes = Buffer.from(data.payload, 'base64')
  const signature = Buffer.from(data.signature, 'base64')
  const key = createPublicKey(__NEXUS_UPDATE_KEY__)
  if (key.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || !verify(null, bytes, key, signature))
    throw new Error('Invalid update signature')
  const manifest = JSON.parse(bytes.toString('utf8'))
  const running = versionParts(current)
  const release = versionParts(manifest?.version)
  const now = Date.now()
  if (manifest?.product !== 'NEXUS GX' || !running || !release || !Number.isFinite(manifest.expires) ||
      manifest.expires <= now || manifest.expires > now + 31 * 86400000 ||
      typeof manifest.notes !== 'string' || manifest.notes.length > 8000) throw new Error('Invalid update manifest')
  const firstDifference = release.findIndex((value, index) => value !== running[index])
  return { version: manifest.version as string, notes: manifest.notes as string, available: firstDifference >= 0 && release[firstDifference] > running[firstDifference] }
}
