import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Extensions } from './extensions'
import { fetchStoreExtension } from './chrome-store'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { setTimeout as pause } from 'node:timers/promises'
import { BrowserWindow } from 'electron'

interface BrowserForTest {
  ready: Promise<void>
  win: Electron.BrowserWindow
  ses: Electron.Session
  tab?: { view?: Electron.WebContentsView }
  snapshot(): import('../shared/model').Snapshot
  execute(command: import('../shared/model').Command): Promise<void>
}

export async function runSmoke(browser: BrowserForTest, privateSessionForTest: () => Electron.Session | undefined, extensions: Extensions) {
  const ui = browser.win.webContents
  await browser.ready
  assert.equal(await ui.executeJavaScript('typeof window.nexus.state'), 'function')
  await ui.executeJavaScript('window.nexus.command({type:"new"})')
  assert.equal(browser.snapshot().tabs.length, 2)
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await ui.executeJavaScript('Boolean(document.querySelector(".address input"))')) break
    await pause(50)
  }
  assert.equal(await ui.executeJavaScript('document.querySelector(".address input")?.tagName'), 'INPUT')
  assert.equal(browser.snapshot().settings.history, false)
  const server = createServer((_request, response) => { response.end('NEXUS HTTPS-only test') })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const local = server.address()
  assert.ok(local && typeof local !== 'string')
  const plaintext = 'http://127.0.0.1:' + local.port
  try {
    assert.equal(await (await browser.ses.fetch(plaintext)).text(), 'NEXUS HTTPS-only test')
    await browser.execute({ type: 'settings', value: { ...browser.snapshot().settings, language: 'en', scale: 115, httpsOnly: true, history: true } })
    assert.equal(browser.snapshot().settings.scale, 115)
    await assert.rejects(browser.ses.fetch(plaintext), /ERR_BLOCKED_BY_CLIENT/)
  } finally {
    server.closeAllConnections()
    server.close()
  }
  const storeFolder = await mkdtemp(join(tmpdir(), 'nexus-store-smoke-'))
  try {
    await fetchStoreExtension('nffaoalbilbmmfgbnbgppjihopabppdk', process.versions.chrome ?? '', storeFolder)
    const manifest = JSON.parse(await readFile(join(storeFolder, 'manifest.json'), 'utf8'))
    assert.equal(typeof manifest.key, 'string')
    assert.equal(typeof manifest.version, 'string')
  } finally {
    await rm(storeFolder, { recursive: true, force: true })
  }
  const extensionFolder = await mkdtemp(join(tmpdir(), 'nexus-extension-smoke-'))
  try {
    await writeFile(join(extensionFolder, 'manifest.json'), JSON.stringify({
      manifest_version: 3, name: 'NEXUS smoke extension', version: '1.0.0',
      content_scripts: [{ matches: ['https://example.com/*'], js: ['content.js'] }]
    }))
    await writeFile(join(extensionFolder, 'content.js'), "document.documentElement.dataset.nexusExtension = 'active'")
    await extensions.install(extensionFolder, async (_name, permissions) => permissions.includes('https://example.com/*'))
  } finally {
    await rm(extensionFolder, { recursive: true, force: true })
  }
  assert.equal(browser.snapshot().extensions[0]?.active, true)
  await browser.ses.cookies.set({ url: 'https://example.com/', name: 'nexus-test', value: 'normal' })
  await browser.execute({ type: 'private' })
  const privateWindow = BrowserWindow.getAllWindows().find(win => win !== browser.win)
  assert.ok(privateWindow)
  if (privateWindow.webContents.isLoading()) await once(privateWindow.webContents, 'did-stop-loading')
  await privateWindow.webContents.executeJavaScript('window.nexus.command({type:"navigate",value:"https://example.com/"})')
  assert.equal(await privateWindow.webContents.executeJavaScript('window.nexus.state().then(value => value.private)'), true)
  const privateSession = privateSessionForTest()
  assert.ok(privateSession)
  assert.notEqual(privateSession, browser.ses)
  assert.equal(privateSession.getStoragePath(), null)
  assert.equal(privateSession.extensions.getAllExtensions().some(extension => extension.name === 'NEXUS smoke extension'), false)
  assert.equal((await privateSession.cookies.get({ name: 'nexus-test' })).length, 0)
  privateWindow.close()
  await browser.execute({ type: 'navigate', value: 'https://example.com/' })
  const page = browser.tab?.view?.webContents
  assert.ok(page)
  if (page.isLoading()) await once(page, 'did-stop-loading')
  assert.equal(page.getURL(), 'https://example.com/')
  assert.equal(await page.executeJavaScript('document.documentElement.dataset.nexusExtension'), 'active')
  await browser.execute({ type: 'removeExtension', id: browser.snapshot().extensions[0].id })
  assert.equal(browser.snapshot().extensions.length, 0)
  assert.equal(await page.executeJavaScript('[typeof window.nexus, typeof window.require].join(",")'), 'undefined,undefined')
  assert.equal(browser.snapshot().history[0]?.url, 'https://example.com/')
  await browser.execute({ type: 'bookmark' })
  assert.equal(browser.snapshot().bookmarks[0]?.url, 'https://example.com/')
  const mediaTab = browser.snapshot().active
  const wave = Buffer.alloc(44 + 8000)
  wave.write('RIFF', 0)
  wave.writeUInt32LE(wave.length - 8, 4)
  wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16)
  wave.writeUInt16LE(1, 20)
  wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(8000, 24)
  wave.writeUInt32LE(8000, 28)
  wave.writeUInt16LE(1, 32)
  wave.writeUInt16LE(8, 34)
  wave.write('data', 36)
  wave.writeUInt32LE(8000, 40)
  for (let i = 44; i < wave.length; i++) wave[i] = 128 + Math.round(30 * Math.sin(i * Math.PI / 10))
  await page.executeJavaScript(`(() => {
    const audio = document.createElement('audio')
    audio.src = 'data:audio/wav;base64,${wave.toString('base64')}'
    audio.loop = true
    document.body.append(audio)
    return audio.play()
  })()`, true)
  const otherTab = browser.snapshot().tabs.find(tab => tab.id !== mediaTab)
  assert.ok(otherTab)
  await browser.execute({ type: 'select', id: otherTab.id })
  await waitFor(() => browser.snapshot().media?.id === mediaTab && browser.snapshot().media?.playing === true)
  await waitFor(() => ui.executeJavaScript('Boolean(document.querySelector(".mini-player"))'))
  assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'), false)
  await browser.execute({ type: 'sleep', id: mediaTab })
  assert.equal(browser.snapshot().tabs.find(tab => tab.id === mediaTab)?.sleeping, false)
  await ui.executeJavaScript('document.querySelector(".mini-player button[aria-label=Pause]").click()')
  await waitFor(() => browser.snapshot().media?.playing === false)
  assert.equal(await page.executeJavaScript('document.querySelector("audio").paused'), true)
  await waitFor(() => ui.executeJavaScript('Boolean(document.querySelector(".mini-player button[aria-label=Play]"))'))
  await ui.executeJavaScript('document.querySelector(".mini-player button[aria-label=Play]").click()')
  await waitFor(() => browser.snapshot().media?.playing === true)
  await browser.execute({ type: 'select', id: mediaTab })
  assert.equal(browser.snapshot().media, undefined)
  await browser.execute({ type: 'close', id: mediaTab })
  assert.equal(browser.snapshot().tabs.length, 1)
  await browser.execute({ type: 'restore' })
  assert.equal(browser.snapshot().tabs.length, 2)
  await browser.execute({ type: 'settings', value: { ...browser.snapshot().settings, history: false } })
  assert.equal(browser.snapshot().history.length, 0)
  await browser.execute({ type: 'clear' })
  assert.equal(browser.snapshot().history.length, 0)
  console.log('Chromium navigation, IPC isolation, bookmarks, tabs and history passed')
}

async function waitFor(ready: () => boolean | Promise<boolean>) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await ready()) return
    await pause(50)
  }
  assert.fail('Timed out waiting for mini-player state')
}
