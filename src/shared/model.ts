export const presets = [
  ['Cyberpunk Neon', '#b9ff38', '#101117'], ['Dark Purple', '#bd9aff', '#181225'],
  ['Crimson Gaming', '#ff557a', '#201117'], ['Arctic Blue', '#68dfff', '#10202c'],
  ['Matrix Green', '#48ff90', '#091810'], ['RGB Rainbow', '#ff75ea', '#1b1224'],
  ['OLED Black', '#e5acff', '#080808'], ['Minimal White', '#5634bb', '#f3f2f8'],
  ['Solar Flare', '#ffbc66', '#23160f'], ['Glitch Pink', '#ff7fc5', '#211020'],
  ['Deep Ocean', '#49e1ce', '#081d24'], ['Ultraviolet', '#bac0ff', '#112040'],
  ['Copper Circuit', '#edab83', '#221a18'], ['Aurora', '#8df1b9', '#131737'],
  ['Carbon Amber', '#ffd53e', '#18191c'], ['Mint Frost', '#006552', '#e8f6f0'],
  ['Rose Quartz', '#922350', '#fcf0f3'], ['Paper Blue', '#2046a0', '#eef3fa'],
  ['Midnight Sakura', '#ff9ea9', '#21161f'], ['Storm Grey', '#b9c9de', '#242a32']
] as const

export const engines = { DuckDuckGo: 'https://duckduckgo.com/?q=', Google: 'https://www.google.com/search?q=', Bing: 'https://www.bing.com/search?q=' }
export type Engine = keyof typeof engines
export interface Theme {
  name: string
  accent: string
  background: string
  glow: number
  rounded: boolean
  addressRounded: boolean
  glass: number
  font: 'system' | 'mono' | 'serif'
  rainbow: boolean
}
export const defaultTheme: Theme = { name: presets[0][0], accent: presets[0][1], background: presets[0][2], glow: 45, rounded: true, addressRounded: true, glass: 76, font: 'system', rainbow: false }
export type SitePermission = 'camera' | 'microphone' | 'geolocation' | 'notifications'
export interface Shortcut { label: string; url: string }
export interface Settings {
  theme: Theme
  savedThemes: Theme[]
  customShortcuts: Shortcut[]
  animations: boolean
  scale: number
  sidebar: 'left' | 'right'
  vertical: boolean
  language: 'pl' | 'en'
  engine: Engine
  profile: 'ECO' | 'BALANCED' | 'PERFORMANCE'
  sleepMinutes: number
  focusGaming: boolean
  block: boolean
  httpsOnly: boolean
  history: boolean
  clearHistoryOnExit: boolean
  exceptions: string[]
  permissions: Record<string, SitePermission[]>
  clock: boolean
  shortcuts: boolean
}
export const defaults: Settings = {
  theme: defaultTheme, savedThemes: [], customShortcuts: [], animations: true, scale: 100, sidebar: 'left', vertical: false,
  language: 'pl', engine: 'DuckDuckGo', profile: 'BALANCED', sleepMinutes: 15, focusGaming: false,
  block: true, httpsOnly: false, history: false, clearHistoryOnExit: false, exceptions: [], permissions: {}, clock: true, shortcuts: true
}
export interface Visit { url: string; title: string; at: number; folder?: string }
export interface InstalledExtension { id: string; name: string; version: string; active: boolean }
export interface Download { id: string; name: string; status: string; bytes: number; total: number; available?: boolean }
export interface Tab {
  id: string; url: string; title: string; loading: boolean; back: boolean; forward: boolean;
  pinned: boolean; muted: boolean; sleeping: boolean; group: string; workspace: string; error: string
}
export interface Snapshot {
  tabs: Tab[]; active: string; private: boolean; settings: Settings; history: Visit[];
  bookmarks: Visit[]; downloads: Download[]; blocked: number; filterTime: number; filtersLoaded: number; version: string;
  wallpaperRevision: number
  updateConfigured: boolean
  platform: 'windows' | 'linux' | 'other'
  workspace: string
  workspaces: string[]
  media?: { id: string; title: string; playing: boolean; muted: boolean }
  extensions: InstalledExtension[]
  profileId: string
  profiles: Array<{ id: string; name: string }>
}
export type Command =
  | { type: 'new'; url?: string }
  | { type: 'select' | 'close' | 'pin' | 'mute' | 'sleep' | 'cancel' | 'openDownload' | 'showDownload'; id: string }
  | { type: 'mediaPlay' | 'mediaPause' | 'mediaPictureInPicture'; id: string }
  | { type: 'removeExtension'; id: string }
  | { type: 'move'; id: string; before: string }
  | { type: 'group'; id: string; value: string }
  | { type: 'navigate' | 'find' | 'installStoreExtension'; value: string }
  | { type: 'bounds'; x: number; y: number; right: number; tab?: string; url?: string; visible: boolean }
  | { type: 'settings'; value: Settings }
  | { type: 'open'; url: string }
  | { type: 'addProfile' | 'switchProfile' | 'workspace'; value: string }
  | { type: 'moveWorkspace'; id: string; value: string }
  | { type: 'bookmarkFolder'; url: string; value: string }
  | { type: 'bookmarkImport'; value: Visit[] }
  | { type: 'bookmarkRemove'; url: string }
  | { type: 'permission'; permission: SitePermission; allow: boolean }
  | { type: 'exception'; allow: boolean }
  | { type: 'back' | 'forward' | 'reload' | 'home' | 'restore' | 'bookmark' | 'copy' | 'private' | 'window' | 'fullscreen' | 'clear' | 'wallpaper' | 'removeWallpaper' | 'updateFilters' | 'defaultBrowser' | 'installExtension' | 'spotifyExternal' | 'wipe' }
export interface BrowserAPI {
  state(): Promise<Snapshot>
  command(command: Command): Promise<void>
  metrics(): Promise<{ memory: number; cpu: number; processes: number }>
  checkUpdates(): Promise<{ available: boolean; version: string; notes: string }>
  wallpaper(): Promise<{ mime: string; bytes: string } | undefined>
  focus(callback: (target: 'l' | 'f') => void): () => void
  subscribe(callback: (snapshot: Snapshot) => void): () => void
}
