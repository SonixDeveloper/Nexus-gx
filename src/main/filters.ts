import { readFile, writeFile, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { blockedHost, parseHosts } from '../shared/validation'

const feeds = [
  ['ads-malware', 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'],
  ['phishing', 'https://blocklistproject.github.io/Lists/phishing.txt']
] as const
const limit = 24 * 1024 * 1024
const maxAge = 86400000

interface FilterEntry { id: string; url: string; domains: Set<string>; updated: number }

export class Filters {
  #entries: FilterEntry[] = feeds.map(([id, url]) => ({ id, url, domains: new Set<string>(), updated: 0 }))
  #inFlight?: Promise<void>

  constructor(private readonly root: string) {}

  get updated() {
    if (this.#entries.every(entry => entry.updated)) return Math.min(...this.#entries.map(entry => entry.updated))
    return 0
  }

  get loaded() { return this.#entries.filter(entry => entry.updated > 0).length }

  async load() {
    await Promise.all(this.#entries.map(async entry => {
      const path = join(this.root, 'nexus-' + entry.id + '.hosts')
      try {
        const metadata = await stat(path)
        if (metadata.size > limit) return
        const entries = parseHosts(await readFile(path, 'utf8'))
        if (!entries.size) return
        entry.domains = entries
        entry.updated = metadata.mtimeMs
      } catch { /* Each cache can be missing independently. */ }
    }))
  }

  contains(url: string) {
    try {
      const host = new URL(url).hostname
      return this.#entries.some(entry => blockedHost(host, entry.domains))
    } catch { return false }
  }

  refresh(force = false) {
    const entries = this.#entries.filter(entry => force || Date.now() - entry.updated > maxAge)
    this.#inFlight ??= (async () => {
      const result = await Promise.allSettled(entries.map(entry => this.#refresh(entry)))
      const failed = result.flatMap((item, index) => item.status === 'rejected' ? [entries[index].id] : [])
      if (failed.length) throw new Error('Filter feed unavailable: ' + failed.join(', '))
    })().finally(() => { this.#inFlight = undefined })
    return this.#inFlight
  }

  async #refresh(entry: FilterEntry) {
    const response = await fetch(entry.url, { redirect: 'error', signal: AbortSignal.timeout(30000) })
    if (!response.ok || !response.body) throw new Error('Filter feed unavailable')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let bytes = 0
    let text = ''
    for (;;) {
      const result = await reader.read()
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw new Error('Filter feed too large')
      }
      text += decoder.decode(result.value, { stream: true })
    }
    text += decoder.decode()
    const domains = parseHosts(text)
    if (!domains.size) throw new Error('Filter feed is empty')
    const path = join(this.root, 'nexus-' + entry.id + '.hosts')
    await writeFile(path + '.tmp', text, { mode: 0o600 })
    await rename(path + '.tmp', path)
    entry.domains = domains
    entry.updated = Date.now()
  }
}
