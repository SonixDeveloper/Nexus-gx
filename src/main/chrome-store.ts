import { createHash, createPublicKey, createVerify } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'

const publisherHash = '61f7f2a6bfcf74cd0bc1fe2497cc9b04254c658f79f2145392867ea8366367cf'
const idPattern = /^[a-p]{32}$/
const limit = 50 * 1024 * 1024

// The CRX3 header has length-delimited protobuf fields. Unknown scalar fields are skipped.
function fields(data: Buffer) {
  let cursor = 0
  const values = new Map<number, Buffer[]>()
  const varint = () => {
    let value = 0
    for (let shift = 0; shift <= 49 && cursor < data.length; shift += 7) {
      const byte = data[cursor++]
      value += (byte & 127) * 2 ** shift
      if (!(byte & 128) && Number.isSafeInteger(value)) return value
    }
    throw new Error('Malformed CRX header')
  }
  let count = 0
  while (cursor < data.length) {
    if (++count > 1000) throw new Error('Too many CRX header fields')
    const tag = varint()
    const wire = tag % 8
    const field = Math.floor(tag / 8)
    if (!field) throw new Error('Malformed CRX header')
    if (wire === 0) { varint(); continue }
    const length = wire === 2 ? varint() : wire === 1 ? 8 : wire === 5 ? 4 : -1
    const end = cursor + length
    if (length < 0 || end > data.length) throw new Error('Malformed CRX header')
    if (wire === 2) {
      const list = values.get(field) ?? []
      if (list.length >= 100) throw new Error('Too many CRX header fields')
      list.push(data.subarray(cursor, end))
      values.set(field, list)
    }
    cursor = end
  }
  return values
}

const chromeId = (bytes: Buffer) => bytes.toString('hex').replace(/[0-9a-f]/g, digit =>
  String.fromCharCode(97 + parseInt(digit, 16)))

export function verifyCrx(data: Buffer, id: string) {
  if (!idPattern.test(id) || data.length < 12 || data.subarray(0, 4).toString() !== 'Cr24' || data.readUInt32LE(4) !== 3) {
    throw new Error('Expected a signed CRX3 package')
  }
  const split = 12 + data.readUInt32LE(8)
  if (split > 1024 * 1024 || split >= data.length) throw new Error('Invalid CRX header length')
  const header = fields(data.subarray(12, split))
  const signed = header.get(10000)
  if (signed?.length !== 1) throw new Error('Missing signed CRX metadata')
  const declared = fields(signed[0]).get(1)
  if (declared?.length !== 1 || declared[0].length !== 16 || chromeId(declared[0]) !== id) {
    throw new Error('Chrome Web Store extension ID mismatch')
  }
  const size = Buffer.alloc(4)
  size.writeUInt32LE(signed[0].length)
  const archive = data.subarray(split)
  let developerKey: string | undefined
  let publisher = false
  const proofs = [...(header.get(2) ?? []), ...(header.get(3) ?? [])]
  if (proofs.length > 12) throw new Error('Too many CRX signatures')
  for (const raw of proofs) {
    const proof = fields(raw)
    const [key] = proof.get(1) ?? []
    const [signature] = proof.get(2) ?? []
    if (!key || !signature) throw new Error('Missing CRX signature')
    const hash = createHash('sha256').update(key).digest()
    const publicKey = createPublicKey({ key, format: 'der', type: 'spki' })
    const verifier = createVerify('sha256').update('CRX3 SignedData\0').update(size).update(signed[0]).update(archive)
    if (!verifier.verify(publicKey, signature)) throw new Error('Invalid CRX signature')
    if (hash.toString('hex') === publisherHash) publisher = true
    if (chromeId(hash.subarray(0, 16)) === id) developerKey = key.toString('base64')
  }
  if (!publisher || !developerKey) throw new Error('Missing Chrome Web Store publishing or developer signature')
  return { archive, developerKey }
}

async function download(id: string, chromium: string) {
  let url = new URL('https://clients2.google.com/service/update2/crx')
  url.search = new URLSearchParams({
    response: 'redirect', prodversion: chromium, acceptformat: 'crx3', x: 'id=' + id + '&installsource=ondemand&uc'
  }).toString()
  const signal = AbortSignal.timeout(30000)
  for (let redirect = 0; redirect < 5; redirect++) {
    const response = await fetch(url, { redirect: 'manual', signal })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (response.body) await response.body.cancel()
      if (!location) break
      url = new URL(location, url)
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['clients2.google.com', 'clients2.googleusercontent.com', 'edgedl.me.gvt1.com'].includes(url.hostname)) break
      continue
    }
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > limit) break
    const chunks: Buffer[] = []
    let length = 0
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      length += chunk.byteLength
      if (length > limit) throw new Error('Chrome Web Store package is too large')
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks, length)
  }
  throw new Error('Could not download the extension from Chrome Web Store')
}

async function unpack(archive: Buffer, root: string) {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.fromBuffer(archive, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true },
      (error, file) => error ? reject(error) : resolve(file)))
  await new Promise<void>((resolve, reject) => {
    let total = 0
    zip.once('error', reject)
    zip.once('end', resolve)
    if (zip.entryCount > 5000) { zip.close(); reject(new Error('Extension contains too many files')); return }
    zip.on('entry', (entry: yauzl.Entry) => {
      void (async () => {
        total += entry.uncompressedSize
        const isDir = entry.fileName.endsWith('/')
        const names = entry.fileName.replace(/\/$/, '').split('/')
        const mode = (entry.externalFileAttributes >>> 16) & 0xf000
        if (total > limit || (mode !== 0 && mode !== 0x8000 && mode !== 0x4000) ||
          names.some(name => !name || name === '.' || name === '..' || /[<>:"|?*\\]/.test(name) ||
            /[ .]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))) {
          throw new Error('Unsafe extension archive entry')
        }
        if (names[0] === '_metadata') return
        const path = join(root, ...names)
        if (isDir) { await mkdir(path, { recursive: true }); return }
        await mkdir(dirname(path), { recursive: true })
        const stream = await new Promise<NodeJS.ReadableStream>((done, fail) =>
          zip.openReadStream(entry, (error, source) => error ? fail(error) : done(source)))
        await pipeline(stream, createWriteStream(path, { flags: 'wx', mode: 0o600 }))
      })().then(() => zip.readEntry(), error => { zip.close(); reject(error) })
    })
    zip.readEntry()
  })
}

export async function fetchStoreExtension(id: string, chromium: string, folder: string) {
  if (!idPattern.test(id) || !/^\d+(?:\.\d+){3}$/.test(chromium)) throw new Error('Invalid Chrome Web Store request')
  const { archive, developerKey } = verifyCrx(await download(id, chromium), id)
  await unpack(archive, folder)
  const path = join(folder, 'manifest.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  manifest.key = developerKey
  await writeFile(path, JSON.stringify(manifest), { mode: 0o600 })
}
