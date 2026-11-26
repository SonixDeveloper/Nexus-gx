import { test } from 'node:test'
import assert from 'node:assert/strict'
import { httpsUrl, resolveAddress } from './browser.ts'

test('HTTPS sites and searches resolve', () => {
  assert.equal(resolveAddress('example.com/help'), 'https://example.com/help')
  assert.equal(resolveAddress('nexus gx'), 'https://duckduckgo.com/?q=nexus%20gx')
})

test('native and unencrypted navigation is rejected', () => {
  for (const value of ['http://example.com', 'file:///tmp/test', 'javascript:alert(1)', 'https://user:pass@example.com/']) {
    assert.equal(httpsUrl(value), undefined)
    assert.equal(resolveAddress(value), undefined)
  }
})

test('mini player reports and controls a playing media element', async () => {
  const { runInNewContext } = await import('node:vm')
  const { readPlayback, togglePlayback, watchPlayback } = await import('./media.ts')
  const messages: string[] = []
  const document = new EventTarget()
  const window = new EventTarget()
  const player = {
    paused: false, ended: false, isConnected: true, readyState: 4,
    pause() { this.paused = true; document.dispatchEvent(new Event('pause')) },
    async play() { this.paused = false; document.dispatchEvent(new Event('playing')) }
  }
  const context = {
    Event,
    document: Object.assign(document, { querySelectorAll: () => [player] }),
    window: Object.assign(window, { ReactNativeWebView: { postMessage: (message: string) => messages.push(message) } })
  }
  runInNewContext(watchPlayback, context)
  assert.equal(readPlayback(messages.at(-1)!), 'playing')
  runInNewContext(togglePlayback, context)
  assert.equal(player.paused, true)
  assert.equal(readPlayback(messages.at(-1)!), 'paused')
  runInNewContext(togglePlayback, context)
  assert.equal(player.paused, false)
  assert.equal(readPlayback(messages.at(-1)!), 'playing')
  player.ended = true
  document.dispatchEvent(new Event('ended'))
  assert.equal(readPlayback(messages.at(-1)!), 'idle')
  assert.equal(readPlayback('{"action":"open"}'), undefined)
})
