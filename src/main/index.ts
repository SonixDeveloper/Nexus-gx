import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, session, shell, webContents, WebContentsView, type DownloadItem, type IpcMainInvokeEvent, type Session, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile, rename, stat, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { defaults, type Command, type Download, type Snapshot, type Tab } from '../shared/model'
import { originOf, readSettings, resolveAddress, sitePermissions, webUrl } from '../shared/validation'
import { Storage, visits, type SavedTab } from './storage'
import { Filters } from './filters'
import { Profiles } from './profiles'
import { checkUpdates, updateConfigured } from './updates'

if (app.commandLine.hasSwitch('no-sandbox') || process.env.ELECTRON_DISABLE_SANDBOX === '1') {
  console.error('NEXUS GX requires the Chromium sandbox.')
  app.exit(1)
}
app.enableSandbox()
if (process.platform === 'linux') app.setDesktopName('io.github.nexusgx.NexusGX.desktop')
protocol.registerSchemesAsPrivileged([{ scheme: 'nexus-ui', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp')
const uiRoot = join(__dirname, '../ui')
const ui = 'nexus-ui://browser/index.html'
const smoke = !app.isPackaged && process.argv.includes('--nexus-smoke')
const windows = new Map<number, Browser>()
let storage: Storage
let profiles: Profiles
let filters: Filters
let primary: Browser | undefined
let wallpaper: { mime: string; bytes: string } | undefined
let wallpaperRevision = 0
let wallpaperPath: string
const webSessions = new WeakSet<Session>()
const owners = new Map<number, Browser>()

interface LiveTab extends Tab { view?: WebContentsView; touched: number; pending?: string }
const preferences = { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false }
const makeTab = (saved?: SavedTab, workspace = ''): LiveTab => ({
  id: randomUUID(), url: saved?.url ?? '', title: '', loading: false, back: false, forward: false,
  pinned: saved?.pinned === true, muted: saved?.muted === true, sleeping: Boolean(saved?.url),
  workspace: typeof saved?.workspace === 'string' ? saved.workspace.trim().slice(0, 32) : workspace,
  group: typeof saved?.group === 'string' ? saved.group.slice(0, 32) : '', error: '', touched: Date.now()
})

function setupSession(ses: Session) {
  if (webSessions.has(ses)) return
  webSessions.add(ses)
  const allowed = (contents: WebContents | null, permission: string, address: unknown, main: boolean, media: readonly string[] = []) => {
    const owner = contents && owners.get(contents.id)
    const origin = originOf(address, true)
    if (!contents || !owner || owner.privateMode || !main || !origin || origin !== originOf(contents.getURL(), true)) return false
    const entries = storage.data.settings.permissions[origin] ?? []
    if (permission === 'media') return media.length > 0 && media.every(type =>
      type === 'video' ? entries.includes('camera') : type === 'audio' && entries.includes('microphone'))
    return (permission === 'geolocation' || permission === 'notifications') && entries.includes(permission)
  }
  ses.setPermissionCheckHandler((contents, permission, origin, details) =>
    allowed(contents, permission, origin, details.isMainFrame === true, details.mediaType ? [details.mediaType] : []))
  ses.setPermissionRequestHandler((contents, permission, answer, details) => {
    const media = 'mediaTypes' in details && Array.isArray(details.mediaTypes) ? details.mediaTypes : []
    answer(allowed(contents, permission, details.requestingUrl, details.isMainFrame === true, media))
  })
  ses.setDisplayMediaRequestHandler((_request, answer) => answer({}))
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    const owner = owners.get(details.webContentsId ?? -1)
    const origin = originOf(details.resourceType === 'mainFrame' ? details.url : details.webContentsId ? webContents.fromId(details.webContentsId)?.getURL() : undefined)
    const excepted = !owner?.privateMode && origin && storage.data.settings.exceptions.includes(origin)
    const cancel = storage.data.settings.block && !excepted && filters.contains(details.url)
    if (cancel) owner?.countBlock()
    callback({ cancel })
  })
  ses.on('will-download', (event, item, contents) => {
    const owner = owners.get(contents.id)
    if (!owner || !webUrl(item.getURL())?.startsWith('https:') || item.getURLChain().some(url => !webUrl(url)?.startsWith('https:'))) {
      event.preventDefault()
      return
    }
    owner.download(item)
  })
}

class Browser {
  readonly win: BrowserWindow
  readonly ses: Session
  readonly ready: Promise<void>
  readonly tabs: LiveTab[] = []
  readonly closedTabs: SavedTab[] = []
  readonly downloads = new Map<string, { item?: DownloadItem; info: Download }>()
  active = ''
  blocked = 0
  bounds: Omit<Extract<Command, { type: 'bounds' }>, 'type'> = { x: 0, y: 0, right: 0, visible: false }
  attached?: WebContentsView
  #notify?: NodeJS.Timeout
  #timer: NodeJS.Timeout

  constructor(readonly privateMode: boolean, restore = false) {
    this.ses = session.fromPartition(privateMode ? randomUUID() : 'persist:nexus-web', privateMode ? { cache: false } : undefined)
    setupSession(this.ses)
    this.win = new BrowserWindow({
      width: 1440, height: 920, minWidth: 660, minHeight: 500, backgroundColor: '#101117',
      autoHideMenuBar: true, title: 'NEXUS GX', show: false, icon: join(__dirname, 'icon.png'),
      webPreferences: { ...preferences, partition: 'nexus-ui', preload: join(__dirname, 'preload.cjs') }
    })
    windows.set(this.win.webContents.id, this)
    const contents = this.win.webContents
    const id = contents.id
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', event => event.preventDefault())
    contents.on('will-frame-navigate', event => event.preventDefault())
    contents.on('will-attach-webview', event => event.preventDefault())
    this.shortcuts(contents)
    if (restore) this.tabs.push(...storage.data.tabs.map(makeTab))
    if (!this.tabs.length) this.tabs.push(makeTab())
    this.select((this.tabs[restore ? storage.data.active : 0] ?? this.tabs[0]).id)
    this.win.on('resize', () => this.layout())
    this.win.on('close', () => { this.persist(); storage.flush() })
    this.win.on('closed', () => {
      windows.delete(id)
      clearTimeout(this.#timer)
      clearTimeout(this.#notify)
      for (const tab of this.tabs) this.dispose(tab)
      for (const entry of this.downloads.values()) entry.item?.cancel()
      if (this.privateMode) void this.ses.clearStorageData().catch(console.error)
      if (primary === this) primary = undefined
    })
    this.#timer = setInterval(() => this.suspendInactive(), 15000)
    this.ready = this.win.loadURL(ui)
    if (!smoke) void this.ready.then(() => { if (!this.win.isDestroyed()) this.win.show() }).catch(error => { console.error(error); this.win.destroy() })
  }

  get workspaces() { return [...new Set(['', ...this.tabs.map(tab => tab.workspace)])] }

  get tab() { return this.tabs.find(tab => tab.id === this.active) }

  snapshot(): Snapshot {
    return {
      tabs: this.tabs.map(({ id, url, title, loading, back, forward, pinned, muted, sleeping, group, workspace, error }) =>
        ({ id, url, title, loading, back, forward, pinned, muted, sleeping, group, workspace, error })),
      active: this.active, workspace: this.tab?.workspace ?? '', workspaces: this.workspaces, private: this.privateMode, settings: storage.data.settings,
      history: this.privateMode ? [] : storage.data.history, bookmarks: storage.data.bookmarks,
      downloads: [...this.downloads.values()].map(entry => entry.info), blocked: this.blocked,
      filterTime: filters.updated, filtersLoaded: filters.loaded, version: app.getVersion(), wallpaperRevision, updateConfigured, profileId: profiles.active, profiles: profiles.entries
    }
  }

  notify() {
    this.#notify ??= setTimeout(() => {
      this.#notify = undefined
      if (!this.win.isDestroyed()) this.win.webContents.send('nexus:update', this.snapshot())
    }, 35)
  }

  countBlock() { this.blocked++; this.notify() }

  persist() {
    if (this.privateMode || primary !== this) return
    storage.data.tabs = this.tabs.map(({ url, pending, pinned, muted, group, workspace }) => ({ url: pending ?? url, pinned, muted, group, workspace }))
    storage.data.active = this.tabs.findIndex(tab => tab.id === this.active)
    storage.schedule()
  }

  create(url?: string, workspace = this.tab?.workspace ?? '') {
    if (this.tabs.length >= 100) return
    const tab = makeTab(undefined, workspace)
    this.tabs.push(tab)
    this.select(tab.id)
    if (url) this.navigate(url)
  }

  select(id: string) {
    const tab = this.tabs.find(tab => tab.id === id)
    if (!tab) return
    if (this.tab) this.tab.touched = Date.now()
    this.active = id
    tab.touched = Date.now()
    if (tab.sleeping && tab.url) this.navigate(tab.url)
    this.layout()
    this.persist()
    this.notify()
  }

  layout() {
    if (this.win.isDestroyed()) return
    const tab = this.tab
    const next = this.bounds.visible && tab && this.bounds.tab === tab.id && this.bounds.url === tab.url &&
      !tab.error && !tab.pending ? tab.view : undefined
    if (this.attached !== next) {
      if (this.attached) this.win.contentView.removeChildView(this.attached)
      this.attached = next
      if (next) this.win.contentView.addChildView(next)
    }
    if (next) {
      const [width, height] = this.win.getContentSize()
      const x = Math.min(this.bounds.x, width)
      const y = Math.min(this.bounds.y, height)
      next.setBounds({ x, y, width: Math.max(0, width - x - this.bounds.right), height: height - y })
    }
  }

  navigate(url: string) {
    const safe = webUrl(url)
    const tab = this.tab
    if (!safe || !tab) return
    const view = tab.view ?? this.createView(tab)
    tab.pending = safe
    tab.error = ''
    tab.sleeping = false
    tab.loading = true
    this.layout()
    this.persist()
    this.notify()
    void view.webContents.loadURL(safe).catch(error => {
      if (tab.view === view && tab.pending === safe && !view.webContents.isLoading()) {
        tab.pending = undefined
        tab.url = safe
        tab.error = (error as NodeJS.ErrnoException).code ?? 'ERR_NAVIGATION'
        tab.loading = false
        this.layout()
        this.notify()
      }
    })
  }

  createView(tab: LiveTab) {
    const view = new WebContentsView({ webPreferences: { ...preferences, session: this.ses, backgroundThrottling: true } })
    const contents = view.webContents
    tab.view = view
    owners.set(contents.id, this)
    contents.setAudioMuted(tab.muted)
    contents.setWindowOpenHandler(({ url }) => {
      const safe = webUrl(url)
      if (safe) setImmediate(() => { if (!this.win.isDestroyed()) this.create(safe) })
      return { action: 'deny' }
    })
    contents.on('will-frame-navigate', event => {
      if (event.isMainFrame && !webUrl(event.url)) event.preventDefault()
    })
    contents.on('will-redirect', event => { if (!webUrl(event.url)) event.preventDefault() })
    contents.on('will-attach-webview', event => event.preventDefault())
    contents.on('did-start-navigation', event => {
      if (event.isMainFrame && !event.isSameDocument && webUrl(event.url)) {
        tab.pending = event.url
        this.layout()
      }
    })
    contents.on('did-start-loading', () => { tab.loading = true; this.notify() })
    contents.on('did-stop-loading', () => {
      tab.loading = false
      if (tab.pending && contents.getURL() === tab.url) {
        tab.pending = undefined
        this.layout()
      }
      this.sync(tab)
      this.notify()
    })
    contents.on('page-title-updated', (_event, title) => { tab.title = title.slice(0, 512); this.notify() })
    contents.on('did-navigate', (_event, url) => this.record(tab, url))
    contents.on('did-navigate-in-page', (_event, url, main) => { if (main) this.record(tab, url) })
    contents.on('did-fail-load', (_event, code, description, url, main) => {
      if (!main || code === -3 || !webUrl(url)) return
      tab.pending = undefined
      tab.url = webUrl(url) ?? tab.url
      tab.error = description
      tab.loading = false
      this.layout()
      this.notify()
    })
    contents.on('render-process-gone', (_event, details) => {
      tab.url = tab.pending ?? tab.url
      tab.pending = undefined
      tab.error = details.reason
      tab.loading = false
      this.dispose(tab)
      this.notify()
    })
    this.shortcuts(contents)
    return view
  }

  sync(tab: LiveTab) {
    const contents = tab.view?.webContents
    if (!contents || contents.isDestroyed()) return
    tab.back = contents.navigationHistory.canGoBack()
    tab.forward = contents.navigationHistory.canGoForward()
    tab.title = contents.getTitle().slice(0, 512)
  }

  record(tab: LiveTab, url: string) {
    const safe = webUrl(url)
    if (!safe) return
    tab.url = safe
    tab.pending = undefined
    tab.error = ''
    this.layout()
    this.sync(tab)
    if (!this.privateMode && storage.data.settings.history) {
      const history = storage.data.history
      if (history[0]?.url !== safe) history.unshift({ url: safe, title: tab.title || safe, at: Date.now() })
      history.length = Math.min(history.length, 1000)
      storage.schedule()
    }
    this.persist()
    this.notify()
  }

  dispose(tab: LiveTab) {
    const view = tab.view
    if (!view) return
    tab.view = undefined
    tab.pending = undefined
    if (this.attached === view) {
      if (!this.win.isDestroyed()) this.win.contentView.removeChildView(view)
      this.attached = undefined
    }
    if (!view.webContents.isDestroyed()) {
      owners.delete(view.webContents.id)
      view.webContents.close()
    }
    tab.loading = tab.back = tab.forward = false
  }

  sleep(tab: LiveTab) {
    if (tab === this.tab || tab.loading || tab.view?.webContents.isCurrentlyAudible() || !tab.view || !tab.url) return
    this.dispose(tab)
    tab.sleeping = true
    this.notify()
  }

  suspendInactive() {
    const { sleepMinutes, profile } = storage.data.settings
    if (profile === 'PERFORMANCE') return
    const limit = (profile === 'ECO' ? Math.min(3, sleepMinutes) : sleepMinutes) * 60000
    for (const tab of this.tabs) if (!tab.pinned && Date.now() - tab.touched >= limit) this.sleep(tab)
  }

  shortcuts(contents: WebContents) {
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      const key = input.key.toLowerCase()
      if (key === 'f11') { event.preventDefault(); this.win.setFullScreen(!this.win.isFullScreen()); return }
      if (!input.control && !input.meta) return
      if (key === 't') { event.preventDefault(); if (input.shift) this.restore(); else this.create(); return }
      if (key === 'w') { event.preventDefault(); this.close(this.active); return }
      if (key === 'tab') {
        event.preventDefault()
        const tabs = this.tabs.filter(tab => tab.workspace === this.tab?.workspace)
        const current = tabs.findIndex(tab => tab.id === this.active)
        if (tabs.length) this.select(tabs[(current + tabs.length + (input.shift ? -1 : 1)) % tabs.length].id)
        return
      }
      if (key === 'l' || key === 'f') {
        event.preventDefault()
        this.win.webContents.focus()
        this.win.webContents.send('nexus:focus', key)
      }
      if (key === 'r' && this.tab?.url) { event.preventDefault(); this.reload() }
    })
  }

  reload() {
    const tab = this.tab
    if (!tab?.url) return
    if (tab.error || !tab.view) this.navigate(tab.url)
    else tab.view.webContents.reload()
  }

  close(id: string) {
    const index = this.tabs.findIndex(tab => tab.id === id)
    if (index < 0) return
    const [tab] = this.tabs.splice(index, 1)
    this.dispose(tab)
    if (tab.url) {
      const { url, pinned, muted, group, workspace } = tab
      this.closedTabs.unshift({ url, pinned, muted, group, workspace })
      this.closedTabs.length = Math.min(this.closedTabs.length, 25)
    }
    if (!this.tabs.length) this.tabs.push(makeTab())
    if (id === this.active) {
      const next = this.tabs.find(item => item.workspace === tab.workspace) ?? this.tabs[Math.min(index, this.tabs.length - 1)]
      this.select(next.id)
    }
    this.persist()
    this.notify()
  }

  restore() {
    if (this.tabs.length >= 100) return
    const saved = this.closedTabs.shift()
    if (!saved) return
    const tab = makeTab(saved)
    this.tabs.push(tab)
    this.select(tab.id)
  }

  download(item: DownloadItem) {
    const id = randomUUID()
    item.setSaveDialogOptions({ title: 'NEXUS GX' })
    const info = { id, name: item.getFilename(), status: 'progressing', bytes: 0, total: item.getTotalBytes() }
    this.downloads.set(id, { item, info })
    item.on('updated', (_event, state) => { info.status = state; info.bytes = item.getReceivedBytes(); this.notify() })
    item.once('done', (_event, state) => {
      info.status = state
      info.bytes = item.getReceivedBytes()
      const entry = this.downloads.get(id)
      if (entry) entry.item = undefined
      this.notify()
    })
    this.notify()
  }

  async execute(command: Command) {
    const tab = this.tab
    const contents = tab?.view?.webContents
    const target = 'id' in command ? this.tabs.find(item => item.id === command.id) : undefined
    switch (command.type) {
      case 'new': this.create(command.url && webUrl(command.url)); break
      case 'open': this.create(webUrl(command.url)); break
      case 'select': this.select(command.id); break
      case 'close': this.close(command.id); break
      case 'restore': this.restore(); break
      case 'navigate': {
        const url = typeof command.value === 'string' && resolveAddress(command.value, storage.data.settings.engine)
        if (!url) throw new Error('Invalid address')
        this.navigate(url)
        break
      }
      case 'back': contents?.navigationHistory.goBack(); break
      case 'forward': contents?.navigationHistory.goForward(); break
      case 'reload': this.reload(); break
      case 'home': if (tab) { this.dispose(tab); Object.assign(tab, { url: '', title: '', error: '', sleeping: false }) }; break
      case 'pin': if (target) target.pinned = !target.pinned; break
      case 'mute': if (target) { target.muted = !target.muted; target.view?.webContents.setAudioMuted(target.muted) }; break
      case 'sleep': if (target) this.sleep(target); break
      case 'group': if (target && typeof command.value === 'string') target.group = command.value.slice(0, 32); break
      case 'workspace': {
        if (typeof command.value !== 'string') break
        const name = command.value.trim().slice(0, 32)
        const workspaceTab = this.tabs.find(item => item.workspace === name)
        if (workspaceTab) this.select(workspaceTab.id)
        else this.create(undefined, name)
        break
      }
      case 'moveWorkspace':
        if (target && typeof command.value === 'string' && this.workspaces.includes(command.value)) target.workspace = command.value
        break
      case 'move': {
        const before = this.tabs.find(item => item.id === command.before)
        if (target && before && target !== before && target.workspace === before.workspace) {
          this.tabs.splice(this.tabs.indexOf(target), 1)
          this.tabs.splice(this.tabs.indexOf(before), 0, target)
        }
        break
      }
      case 'bounds':
        if (Number.isFinite(command.x) && Number.isFinite(command.y) && Number.isFinite(command.right)) {
          this.bounds = { x: Math.max(0, Math.round(command.x)), y: Math.max(0, Math.round(command.y)), right: Math.max(0, Math.round(command.right)), tab: command.tab, url: command.url, visible: command.visible === true }
          this.layout()
        }
        return
      case 'find':
        if (typeof command.value === 'string' && command.value) contents?.findInPage(command.value.slice(0, 512))
        else contents?.stopFindInPage('clearSelection')
        break
      case 'settings': {
        const { permissions, exceptions } = storage.data.settings
        storage.data.settings = { ...readSettings(command.value), permissions, exceptions }
        storage.schedule()
        break
      }
      case 'permission': {
        const origin = originOf(contents?.getURL(), true)
        if (!origin || this.privateMode || !sitePermissions.includes(command.permission)) break
        const entries = new Set(storage.data.settings.permissions[origin])
        if (command.allow === true) entries.add(command.permission)
        else entries.delete(command.permission)
        if (entries.size) storage.data.settings.permissions[origin] = [...entries]
        else delete storage.data.settings.permissions[origin]
        storage.schedule()
        break
      }
      case 'exception': {
        const origin = originOf(contents?.getURL() ?? tab?.url)
        if (!origin || this.privateMode) break
        const entries = new Set(storage.data.settings.exceptions)
        if (command.allow === true) entries.add(origin)
        else entries.delete(origin)
        storage.data.settings.exceptions = [...entries]
        storage.schedule()
        break
      }
      case 'private': new Browser(true); break
      case 'window': new Browser(false); break
      case 'fullscreen': this.win.setFullScreen(!this.win.isFullScreen()); break
      case 'bookmark': {
        if (!tab?.url || this.privateMode) break
        const list = storage.data.bookmarks
        const index = list.findIndex(entry => entry.url === tab.url)
        if (index >= 0) list.splice(index, 1)
        else if (list.length < 1000) list.unshift({ url: tab.url, title: tab.title || tab.url, at: Date.now() })
        storage.schedule()
        break
      }
      case 'bookmarkFolder': {
        if (this.privateMode || typeof command.value !== 'string') break
        const bookmark = storage.data.bookmarks.find(entry => entry.url === command.url)
        if (bookmark) bookmark.folder = command.value.trim().slice(0, 150)
        storage.schedule()
        break
      }
      case 'bookmarkRemove':
        if (!this.privateMode) {
          storage.data.bookmarks = storage.data.bookmarks.filter(entry => entry.url !== command.url)
          storage.schedule()
        }
        break
      case 'bookmarkImport': {
        if (this.privateMode) break
        const known = new Set(storage.data.bookmarks.map(entry => entry.url))
        for (const entry of visits(command.value)) {
          if (storage.data.bookmarks.length >= 1000) break
          if (!known.has(entry.url)) {
            storage.data.bookmarks.push(entry)
            known.add(entry.url)
          }
        }
        storage.schedule()
        break
      }
      case 'copy': if (tab?.url) clipboard.writeText(tab.url); break
      case 'clear': {
        await this.ses.clearData()
        if (!this.privateMode) { storage.data.history = []; storage.schedule() }
        break
      }
      case 'wipe': {
        if (this.privateMode) break
        for (const browser of windows.values()) {
          for (const tab of browser.tabs) browser.dispose(tab)
          browser.tabs.length = 0
          browser.closedTabs.length = 0
          browser.create()
          for (const entry of browser.downloads.values()) entry.item?.cancel()
          browser.downloads.clear()
        }
        await Promise.all([...new Set([...windows.values()].map(browser => browser.ses))].map(ses => ses.clearData()))
        await rm(wallpaperPath, { force: true })
        wallpaper = undefined
        wallpaperRevision++
        Object.assign(storage.data, { history: [], bookmarks: [], settings: readSettings(defaults) })
        storage.flush()
        break
      }
      case 'cancel': {
        const item = this.downloads.get(command.id)?.item
        item?.cancel()
        break
      }
      case 'wallpaper': await chooseWallpaper(this.win); break
      case 'removeWallpaper': await rm(wallpaperPath, { force: true }); wallpaper = undefined; wallpaperRevision++; break
      case 'updateFilters':
        try { await filters.refresh(true) } finally { windows.forEach(browser => browser.notify()) }
        break
      case 'addProfile':
        if (!this.privateMode) profiles.add(command.value)
        break
      case 'switchProfile':
        if (!this.privateMode && profiles.active !== command.value && profiles.entries.some(entry => entry.id === command.value)) {
          this.persist()
          storage.flush()
          const args = process.argv.slice(1).filter(value => !value.startsWith('--nexus-profile=') && !webUrl(value))
          app.relaunch({ args: [...args, '--nexus-profile=' + command.value] })
          app.quit()
        }
        return
      case 'defaultBrowser':
        if (!app.isPackaged) throw new Error('Install NEXUS GX before registering it')
        if (process.platform === 'win32') {
          await shell.openExternal('ms-settings:defaultapps')
          break
        }
        if (!app.setAsDefaultProtocolClient('http') || !app.setAsDefaultProtocolClient('https')) throw new Error('Select NEXUS GX in system defaults')
        break
      default: throw new Error('Unknown command')
    }
    this.persist()
    for (const browser of windows.values()) browser.notify()
  }
}

function mimeType(data: Buffer) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg'
  if (/^GIF8[79]a/.test(data.subarray(0, 6).toString('ascii'))) return 'image/gif'
  if (data.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4'
  if (data.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return 'video/webm'
}

async function readWallpaper(path: string) {
  if ((await stat(path)).size > 12 * 1024 * 1024) throw new Error('Wallpaper exceeds 12 MB')
  const data = await readFile(path)
  const mime = mimeType(data)
  if (!mime) throw new Error('Unsupported wallpaper format')
  return { data, mime, bytes: data.toString('base64') }
}

async function chooseWallpaper(win: BrowserWindow) {
  const selected = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Wallpaper', extensions: ['png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm'] }] })
  if (selected.canceled) return
  const { data, mime, bytes } = await readWallpaper(selected.filePaths[0])
  await writeFile(wallpaperPath + '.tmp', data, { mode: 0o600 })
  await rename(wallpaperPath + '.tmp', wallpaperPath)
  wallpaper = { mime, bytes }
  wallpaperRevision++
}

function guard(event: IpcMainInvokeEvent) {
  const browser = windows.get(event.sender.id)
  if (!browser || event.senderFrame !== event.sender.mainFrame || event.senderFrame?.url !== ui) throw new Error('Untrusted IPC sender')
  return browser
}

function launchLink(args: string[]) {
  const url = args.map(webUrl).find(Boolean)
  if (url) (primary ??= new Browser(false)).create(url)
}

async function main() {
  const base = smoke ? mkdtempSync(join(tmpdir(), 'nexus-smoke-')) : app.getPath('userData')
  profiles = new Profiles(base)
  mkdirSync(base, { recursive: true, mode: 0o700 })
  profiles.refresh()
  const profile = process.argv.find(value => value.startsWith('--nexus-profile='))?.slice('--nexus-profile='.length)
  app.setPath('userData', profiles.load(profile))
  if (!smoke && !app.requestSingleInstanceLock()) { app.quit(); return }
  app.on('second-instance', (_event, args) => {
    void app.whenReady().then(() => { if (storage) { launchLink(args); primary?.win.focus() } })
  })
  await app.whenReady()
  session.fromPartition('nexus-ui').protocol.handle('nexus-ui', request => {
    const url = new URL(request.url)
    if (url.host !== 'browser' || !/^\/(?:index\.html|assets\/[a-zA-Z0-9_.-]+\.(?:js|css))$/.test(url.pathname))
      return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(join(uiRoot, url.pathname.slice(1))).href)
  })
  Menu.setApplicationMenu(null)
  storage = new Storage(app.getPath('userData'))
  filters = new Filters(app.getPath('userData'))
  await filters.load()
  wallpaperPath = join(app.getPath('userData'), 'wallpaper')
  try {
    const { mime, bytes } = await readWallpaper(wallpaperPath)
    wallpaper = { mime, bytes }
  } catch { /* Wallpaper is optional. */ }
  ipcMain.handle('nexus:check-updates', event => { guard(event); return checkUpdates(app.getVersion()) })
  ipcMain.handle('nexus:wallpaper', event => { guard(event); return wallpaper })
  ipcMain.handle('nexus:state', event => guard(event).snapshot())
  ipcMain.handle('nexus:command', (event, command: Command) => guard(event).execute(command))
  ipcMain.handle('nexus:metrics', event => {
    guard(event)
    const metrics = app.getAppMetrics()
    return {
      processes: metrics.length,
      cpu: metrics.reduce((sum, process) => sum + process.cpu.percentCPUUsage, 0),
      memory: metrics.reduce((sum, process) => sum + process.memory.workingSetSize, 0) * 1024
    }
  })
  primary = new Browser(false, true)
  if (smoke) {
    const { runSmoke } = await import('./smoke')
    await runSmoke(primary, () => [...windows.values()].find(browser => browser.privateMode)?.ses)
    app.quit()
    return
  }
  launchLink(process.argv.slice(app.isPackaged ? 1 : 2))
  const refresh = () => {
    if (storage.data.settings.block && Date.now() - filters.updated > 86400000)
      void filters.refresh().catch(console.error).finally(() => windows.forEach(browser => browser.notify()))
  }
  refresh()
  setInterval(refresh, 3600000).unref()
}

app.on('before-quit', () => {
  if (storage?.data.settings.clearHistoryOnExit) {
    storage.data.history = []
    storage.flush()
  }
})
app.on('window-all-closed', () => app.quit())
void main().catch(error => { console.error(error); app.exit(1) })
