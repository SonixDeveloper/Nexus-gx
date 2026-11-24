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
