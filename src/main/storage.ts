import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { readSettings, webUrl } from '../shared/validation.ts'
import type { Settings, Visit } from '../shared/model'

export interface SavedTab { url: string; pinned: boolean; muted: boolean; group: string; workspace?: string }
interface SavedData {
  historyPolicy: 1
  settings: Settings
  tabs: SavedTab[]
  active: number
  bookmarks: Visit[]
  history: Visit[]
}

export function visits(value: unknown): Visit[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 1000).flatMap(item => {
    const url = webUrl(item?.url)
    return url && typeof item.title === 'string' && Number.isFinite(item.at)
      ? [{ url, title: item.title.slice(0, 512), at: item.at, folder: typeof item.folder === 'string' ? item.folder.trim().slice(0, 150) : undefined }] : []
  })
}

export class Storage {
  readonly data: SavedData
  readonly path: string
  #timer?: NodeJS.Timeout

  constructor(root: string) {
    this.path = join(root, 'nexus-state.json')
    let raw: Partial<SavedData> = {}
    try { raw = JSON.parse(readFileSync(this.path, 'utf8')) ?? {} } catch { /* First run or damaged state. */ }
    const settings = readSettings(raw.settings)
    // Earlier versions enabled history by default, so a saved true value was ambiguous.
    if (raw.historyPolicy !== 1) settings.history = false
    this.data = {
      historyPolicy: 1, settings, history: settings.history ? visits(raw.history) : [],
      bookmarks: visits(raw.bookmarks),
      tabs: settings.history && Array.isArray(raw.tabs)
        ? raw.tabs.slice(0, 100).filter(tab => tab && (tab.url === '' || webUrl(tab.url))) : [],
      active: settings.history && Number.isInteger(raw.active) ? raw.active! : 0
    }
    if (raw.settings && (!settings.history || raw.historyPolicy !== 1)) this.flush()
  }

  schedule() {
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => this.flush(), 250)
  }

  flush() {
    clearTimeout(this.#timer)
    try {
      writeFileSync(this.path + '.tmp', JSON.stringify(this.data), { mode: 0o600 })
      renameSync(this.path + '.tmp', this.path)
    } catch (error) { console.error('Could not save NEXUS data', error) }
  }
}
