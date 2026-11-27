import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyCrx } from '../src/main/chrome-store.ts'
import { chromeStoreId } from '../src/shared/validation.ts'

const extensionId = 'nffaoalbilbmmfgbnbgppjihopabppdk'

test('Chrome extension IDs are read only from genuine store listing URLs', () => {
  assert.equal(chromeStoreId('https://chromewebstore.google.com/detail/video-speed-controller/' + extensionId + '?hl=pl'), extensionId)
  assert.equal(chromeStoreId('https://chromewebstore.google.com.example.org/detail/' + extensionId), undefined)
  assert.equal(chromeStoreId('https://chromewebstore.google.com@othersite.example/detail/' + extensionId), undefined)
  assert.equal(chromeStoreId('https://example.org/detail/' + extensionId), undefined)
})

test('rejects archives missing their CRX3 signature metadata', () => {
  const data = Buffer.alloc(13)
  data.write('Cr24')
  data.writeUInt32LE(3, 4)
  assert.throws(() => verifyCrx(data, extensionId), /Missing signed CRX metadata/)
  assert.throws(() => verifyCrx(Buffer.from('PK\x03\x04'), extensionId), /signed CRX3/)
})
