import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Storage } from '../src/main/storage.ts'

test('old default history opt-in is reset without removing bookmarks', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-storage-'))
  try {
    const path = join(root, 'nexus-state.json')
    const url = 'https://example.com/'
    const visit = { url, title: 'Example', at: 1 }
    writeFileSync(path, JSON.stringify({ settings: { history: true }, history: [visit], tabs: [{ url }], bookmarks: [visit] }))
    const migrated = new Storage(root)
    assert.equal(migrated.data.settings.history, false)
    assert.deepEqual(migrated.data.history, [])
    assert.deepEqual(migrated.data.tabs, [])
    assert.equal(migrated.data.bookmarks[0]?.url, url)
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')).history, [])
    migrated.data.settings.history = true
    migrated.data.history = [visit]
    migrated.flush()
    const reopened = new Storage(root)
    assert.equal(reopened.data.settings.history, true)
    assert.equal(reopened.data.history[0]?.url, url)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
