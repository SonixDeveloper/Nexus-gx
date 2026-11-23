import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

export interface ProfileEntry { id: string; name: string }
const idPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/
const defaultProfile = { id: 'default', name: 'Default' }

export class Profiles {
  readonly folder: string
  active = defaultProfile.id
  entries = [defaultProfile]

  constructor(private readonly base: string) { this.folder = join(base, 'profiles') }

  load(requested: string | undefined) {
    if (!requested || !idPattern.test(requested) || !this.entries.some(entry => entry.id === requested)) return this.base
    this.active = requested
    return join(this.folder, requested)
  }

  refresh() {
    let folders: string[]
    try { folders = readdirSync(this.folder) } catch { folders = [] }
    const found = folders.filter(id => idPattern.test(id)).slice(0, 200).map(id => {
      try {
        const name = readFileSync(join(this.folder, id, 'profile-name'), 'utf8').trim().slice(0, 40)
        if (name) return { id, name }
      } catch { /* Ignore an incomplete profile. */ }
      return undefined
    })
    this.entries = [defaultProfile, ...found.filter((entry): entry is ProfileEntry => !!entry)]
  }

  add(value: unknown) {
    const name = typeof value === 'string' ? value.trim().slice(0, 40) : ''
    if (!name || this.entries.length >= 200) throw new Error('Invalid profile name or too many profiles')
    const id = randomUUID()
    const root = join(this.folder, id)
    mkdirSync(root, { recursive: true, mode: 0o700 })
    writeFileSync(join(root, 'profile-name'), name, { flag: 'wx', mode: 0o600 })
    this.refresh()
  }
}
