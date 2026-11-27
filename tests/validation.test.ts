import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockedHost, parseHosts, readSettings, resolveAddress, spotifyAppUri, spotifyPlayerUrl, webUrl } from '../src/shared/validation.ts'

test('address bar only admits web schemes and resolves search text', () => {
  assert.equal(resolveAddress('example.com/docs', 'DuckDuckGo'), 'https://example.com/docs')
  assert.equal(resolveAddress('https://example.com', 'Google'), 'https://example.com/')
  assert.equal(resolveAddress('nexus gaming', 'DuckDuckGo'), 'https://duckduckgo.com/?q=nexus%20gaming')
  assert.equal(resolveAddress('javascript:alert(1)', 'Google'), undefined)
  assert.equal(webUrl('file:///etc/passwd'), undefined)
  assert.equal(webUrl('https://user:secret@example.com/'), undefined)
})

test('settings clamp numeric fields and reject CSS or prototype keys', () => {
  const value = readSettings({ scale: 2000, engine: 'constructor', sleepMinutes: -2, theme: { accent: 'url(file:///etc/passwd)' } })
  assert.equal(value.scale, 135)
  assert.equal(value.sleepMinutes, 1)
  assert.equal(value.engine, 'DuckDuckGo')
  assert.match(value.theme.accent, /^#[\da-f]{6}$/i)
})

test('filters match complete DNS labels and their subdomains', () => {
  const hosts = parseHosts('# comment\n0.0.0.0 ads.example\n127.0.0.1 bad.example # listed')
  assert.equal(blockedHost('IMG.ADS.EXAMPLE.', hosts), true)
  assert.equal(blockedHost('notads.example', hosts), false)
  assert.equal(blockedHost('bad.example.legit.org', hosts), false)
})

test('Spotify handoff only permits the exact HTTPS web player origin', () => {
  const track = 'https://open.spotify.com/track/example'
  assert.equal(spotifyPlayerUrl(track), track)
  assert.equal(spotifyPlayerUrl('https://open.spotify.com.example.org/track/example'), undefined)
  assert.equal(spotifyPlayerUrl('https://open.spotify.com:1234/'), undefined)
  assert.equal(spotifyPlayerUrl('http://open.spotify.com/'), undefined)
})

test('Spotify application links retain only recognized resource types and IDs', () => {
  const id = '6rqhFgbbKwnb9MLmUQDhG6'
  assert.equal(spotifyAppUri(`https://open.spotify.com/intl-pl/track/${id}?si=abc`), `spotify:track:${id}`)
  assert.equal(spotifyAppUri(`https://open.spotify.com.example.com/track/${id}`), undefined)
  assert.equal(spotifyAppUri(`https://open.spotify.com/search/${id}`), undefined)
  assert.equal(spotifyAppUri(`https://open.spotify.com/track/${id}%2F`), undefined)
})
