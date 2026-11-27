import { test } from 'node:test'
import assert from 'node:assert/strict'
import { httpsUrl, resolveAddress, spotifyPlayerUrl } from './browser.ts'

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

test('account codes and session refresh go only to the configured auth service', async () => {
  const { accountClient } = await import('./account.ts')
  const requests: Array<{ url: string; body: unknown }> = []
  const session = { refresh_token: 'refresh', access_token: 'access', user: { id: 'account', email: 'user@example.com' } }
  const client = accountClient('https://project.supabase.co', 'sb_publishable_test', async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify(session))
  })
  assert.ok(client)
  await client.sendCode('user@example.com')
  assert.deepEqual(await client.verify('user@example.com', '123456'), session)
  assert.deepEqual(await client.refresh(session.refresh_token), session)
  assert.deepEqual(requests.map(r => r.url), ['otp', 'verify', 'token?grant_type=refresh_token']
    .map(path => 'https://project.supabase.co/auth/v1/' + path))
  assert.deepEqual(requests[2]?.body, { refresh_token: 'refresh' })
  assert.equal(accountClient('https://other.example.com', 'sb_publishable_test'), undefined)
  assert.equal(accountClient('https://project.supabase.co', 'sb_secret_test'), undefined)
})

test('Spotify handoff preserves the resource and accepts only its official web player', () => {
  const track = 'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6?si=abc'
  assert.equal(spotifyPlayerUrl(track), track)
  assert.equal(spotifyPlayerUrl('https://open.spotify.com.example.org/track/abc'), undefined)
  assert.equal(spotifyPlayerUrl('https://open.spotify.com@other.example/track/abc'), undefined)
  assert.equal(spotifyPlayerUrl('http://open.spotify.com/'), undefined)
})
