import { defaults, engines, type Engine, type Settings, type SitePermission, type Theme } from './model.ts'

export function webUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 8192) return
  try {
    const url = new URL(value)
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url.href
  } catch { /* Invalid absolute URL. */ }
}

export function resolveAddress(input: string, engine: Engine): string | undefined {
  const value = input.trim()
  if (!value || value.length > 4096) return
  if (/^[a-z][a-z+.-]*:\/\//i.test(value)) return webUrl(value)
  if (/^(localhost|(?:[\w-]+\.)+[\w-]+|\[[\da-f:]+\])(?::\d+)?(?:[/?#]\S*)?$/i.test(value)) return webUrl('https://' + value)
  if (/^[a-z][a-z+.-]*:/i.test(value)) return
  return engines[engine] + encodeURIComponent(value)
}

export function readTheme(value: unknown): Theme {
  const theme = (value && typeof value === 'object' ? value : {}) as Partial<Theme>
  const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
  return {
    name: typeof theme.name === 'string' ? theme.name.trim().slice(0, 48) || defaults.theme.name : defaults.theme.name,
    accent: color(theme.accent, defaults.theme.accent), background: color(theme.background, defaults.theme.background),
    glow: number(theme.glow, 0, 100, defaults.theme.glow), rounded: theme.rounded !== false,
    addressRounded: theme.addressRounded !== false, glass: number(theme.glass, 0, 100, defaults.theme.glass),
    font: theme.font === 'mono' || theme.font === 'serif' ? theme.font : 'system', rainbow: theme.rainbow === true
  }
}

function number(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback
}

export const sitePermissions = ['camera', 'microphone', 'geolocation', 'notifications'] as const

export function originOf(value: unknown, secure = false): string | undefined {
  const url = webUrl(value)
  if (url && (!secure || url.startsWith('https:'))) return new URL(url).origin
}

export function readSettings(value: unknown): Settings {
  const s = (value && typeof value === 'object' ? value : {}) as Partial<Settings>
  const permissions: Settings['permissions'] = {}
  if (s.permissions && typeof s.permissions === 'object') {
    for (const [address, values] of Object.entries(s.permissions).slice(0, 256)) {
      const origin = originOf(address, true)
      if (origin && Array.isArray(values)) permissions[origin] = values.filter((permission): permission is SitePermission => sitePermissions.includes(permission))
    }
  }
  const exceptions = Array.isArray(s.exceptions)
    ? [...new Set(s.exceptions.slice(0, 256).flatMap(value => originOf(value) ?? []))]
    : []
  return {
    theme: readTheme(s.theme),
    savedThemes: Array.isArray(s.savedThemes) ? s.savedThemes.slice(0, 24).map(readTheme) : [],
    customShortcuts: Array.isArray(s.customShortcuts) ? s.customShortcuts.slice(0, 18).flatMap(shortcut => {
      const url = webUrl(shortcut?.url)
      const label = typeof shortcut?.label === 'string' ? shortcut.label.trim().slice(0, 32) : ''
      return url && label ? [{ url, label }] : []
    }) : [],
    animations: s.animations !== false, scale: number(s.scale, 80, 135, 100),
    sidebar: s.sidebar === 'right' ? 'right' : 'left', vertical: s.vertical === true,
    language: s.language === 'en' ? 'en' : 'pl', engine: s.engine && Object.hasOwn(engines, s.engine) ? s.engine : defaults.engine,
    profile: s.profile === 'ECO' || s.profile === 'PERFORMANCE' ? s.profile : 'BALANCED',
    sleepMinutes: number(s.sleepMinutes, 1, 120, 15), focusGaming: s.focusGaming === true, block: s.block !== false, httpsOnly: s.httpsOnly === true,
    history: s.history === true, clearHistoryOnExit: s.clearHistoryOnExit === true, exceptions, permissions, clock: s.clock !== false, shortcuts: s.shortcuts !== false
  }
}

export function parseHosts(text: string): Set<string> {
  const hosts = new Set<string>()
  for (const line of text.split('\n')) {
    const host = line.trim().match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9.-]+)(?:\s|$)/i)?.[1]
    if (host?.includes('.')) hosts.add(host.toLowerCase())
  }
  return hosts
}

export function blockedHost(host: string, entries: Set<string>) {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.')
  return parts.some((_, index) => index < parts.length - 1 && entries.has(parts.slice(index).join('.')))
}

export function spotifyPlayerUrl(value: unknown): string | undefined {
  const url = webUrl(value)
  if (url && new URL(url).origin === 'https://open.spotify.com') return url
}
