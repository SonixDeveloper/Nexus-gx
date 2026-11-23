import assert from 'node:assert/strict'
import { once } from 'node:events'
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

export async function runSmoke(browser: BrowserForTest, privateSessionForTest: () => Electron.Session | undefined) {
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
  await browser.execute({ type: 'settings', value: { ...browser.snapshot().settings, language: 'en', scale: 115 } })
  assert.equal(browser.snapshot().settings.scale, 115)
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
  assert.equal((await privateSession.cookies.get({ name: 'nexus-test' })).length, 0)
  privateWindow.close()
  await browser.execute({ type: 'navigate', value: 'https://example.com/' })
  const page = browser.tab?.view?.webContents
  assert.ok(page)
  if (page.isLoading()) await once(page, 'did-stop-loading')
  assert.equal(page.getURL(), 'https://example.com/')
  assert.equal(await page.executeJavaScript('[typeof window.nexus, typeof window.require].join(",")'), 'undefined,undefined')
  assert.equal(browser.snapshot().history[0]?.url, 'https://example.com/')
  await browser.execute({ type: 'bookmark' })
  assert.equal(browser.snapshot().bookmarks[0]?.url, 'https://example.com/')
  await browser.execute({ type: 'close', id: browser.snapshot().active })
  assert.equal(browser.snapshot().tabs.length, 1)
  await browser.execute({ type: 'restore' })
  assert.equal(browser.snapshot().tabs.length, 2)
  await browser.execute({ type: 'clear' })
  assert.equal(browser.snapshot().history.length, 0)
  console.log('Chromium navigation, IPC isolation, bookmarks, tabs and history passed')
}
