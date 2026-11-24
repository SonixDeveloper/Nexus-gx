import { randomUUID } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rename, rm, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Session } from 'electron'
import type { InstalledExtension } from '../shared/model'

const directoryId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const unsupported = new Set(['nativeMessaging', 'proxy', 'contextualIdentities'])
const maxBytes = 50 * 1024 * 1024

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export class Extensions {
  readonly #entries = new Map<string, InstalledExtension & { engineId?: string; key?: string }>()
  readonly #root: string
  #busy = false

  constructor(profile: string, private readonly browsing: Session) {
    this.#root = join(profile, 'nexus-extensions')
  }

  list(): InstalledExtension[] {
    return [...this.#entries.values()].map(({ id, name, version, active }) => ({ id, name, version, active }))
  }

  async #readManifest(folder: string) {
    const path = join(folder, 'manifest.json')
    const file = await lstat(path)
    if (!file.isFile() || file.size > 1024 * 1024) throw new Error('Invalid extension manifest')
    const manifest = JSON.parse(await readFile(path, 'utf8'))
    if (![2, 3].includes(manifest?.manifest_version) || typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
      throw new Error('Expected a Chromium extension with Manifest V2 or V3')
    }
    const requested = [...new Set([
      ...strings(manifest.permissions), ...strings(manifest.optional_permissions),
      ...strings(manifest.host_permissions), ...strings(manifest.optional_host_permissions),
      ...(Array.isArray(manifest.content_scripts)
        ? manifest.content_scripts.flatMap((script: { matches?: unknown } | null) => strings(script?.matches)) : [])
    ])]
    const incompatible = requested.find(permission => unsupported.has(permission))
    if (incompatible) throw new Error('Unsupported extension permission: ' + incompatible)
    if (manifest.manifest_version === 3 && manifest.background?.scripts && !manifest.background.service_worker) {
      throw new Error('This Firefox background script needs a Chromium version of the extension')
    }
    return {
      name: manifest.name.slice(0, 140), version: manifest.version.slice(0, 40), requested,
      key: typeof manifest.key === 'string' ? Buffer.from(manifest.key, 'base64').toString('base64') : undefined
    }
  }

  async #load(id: string) {
    const folder = join(this.#root, id)
    const { name, version, key } = await this.#readManifest(folder)
    if (key && [...this.#entries.values()].some(entry => entry.active && entry.key === key)) {
      throw new Error('An extension with the same identity is already installed')
    }
    const extension = await this.browsing.extensions.loadExtension(folder, { allowFileAccess: false })
    this.#entries.set(id, { id, name: extension.name || name, version, key, engineId: extension.id, active: true })
  }

  async restore() {
    await mkdir(this.#root, { recursive: true, mode: 0o700 })
    for (const entry of await readdir(this.#root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !directoryId.test(entry.name)) continue
      try { await this.#load(entry.name) }
      catch (error) {
        console.error('Could not load extension', error)
        this.#entries.set(entry.name, { id: entry.name, name: entry.name, version: '', active: false })
      }
    }
  }

  async install(folder: string, confirm: (name: string, permissions: string[]) => Promise<boolean>) {
    if (this.#busy || this.#entries.size >= 32) throw new Error('Extension manager is busy or full')
    this.#busy = true
    const id = randomUUID()
    const pending = join(this.#root, '.' + id)
    const target = join(this.#root, id)
    try {
      let bytes = 0
      let count = 0
      await cp(folder, pending, { recursive: true, dereference: false, errorOnExist: true, force: false, filter: async path => {
        const file = await lstat(path)
        if (file.isFile()) bytes += file.size
        if (++count > 5000 || bytes > maxBytes || (!file.isFile() && !file.isDirectory())) {
          throw new Error('Unsupported extension files or package too large')
        }
        return true
      } })
      const { name, requested } = await this.#readManifest(pending)
      if (!await confirm(name, requested)) return
      await rename(pending, target)
      try { await this.#load(id) }
      catch (error) { await rm(target, { recursive: true, force: true }); throw error }
    } finally {
      this.#busy = false
      await rm(pending, { recursive: true, force: true })
    }
  }

  async remove(id: string) {
    if (this.#busy) throw new Error('Extension manager is busy')
    const entry = this.#entries.get(id)
    if (!entry) return
    this.#busy = true
    try {
      if (entry.engineId) this.browsing.extensions.removeExtension(entry.engineId)
      entry.active = false
      entry.engineId = undefined
      await rm(join(this.#root, id), { recursive: true, force: true })
      this.#entries.delete(id)
    } finally { this.#busy = false }
  }
}
