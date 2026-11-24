import { createRoot } from 'react-dom/client'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react'
import { create } from 'zustand'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, ChevronDown, Clock3, Download, Gamepad2, Globe2, House, Menu, Palette, Plus, RotateCw, Search, Settings2, Shield, X, Zap, LockKeyhole, Radio, Pin, VolumeX, Moon, Youtube, Twitch, Music2, MessagesSquare, Puzzle } from 'lucide-react'
import type { BrowserAPI, Command, Settings, Snapshot, Tab, Theme } from '../shared/model'
import { defaults, engines, presets } from '../shared/model'
import { originOf, readTheme, sitePermissions, spotifyPlayerUrl, webUrl } from '../shared/validation'
import { parseBookmarks } from './bookmarks'
import './style.css'

declare global { interface Window { nexus: BrowserAPI } }
const useBrowser = create<{ snapshot?: Snapshot; set: (snapshot: Snapshot) => void }>(set => ({ set: snapshot => set({ snapshot }) }))
type Panel = 'menu' | 'theme' | 'gaming' | 'privacy' | 'history' | 'bookmarks' | 'downloads' | 'extensions' | 'settings'
const services = [
  [MessagesSquare, 'Discord', 'https://discord.com/app', '#a193ff'],
  [Twitch, 'Twitch', 'https://www.twitch.tv/', '#c289ff'],
  [Youtube, 'YouTube', 'https://www.youtube.com/', '#ff657b'],
  [Gamepad2, 'Steam', 'https://store.steampowered.com/', '#76bdff'],
  [Music2, 'Spotify', 'https://open.spotify.com/', '#66e7a4'],
  [Radio, 'Reddit', 'https://www.reddit.com/', '#ff9869']
] as const
const format = (bytes: number) => (bytes / 1048576).toFixed(1) + ' MiB'

function App() {
  const snapshot = useBrowser(state => state.snapshot)
  const setSnapshot = useBrowser(state => state.set)
  const [panel, setPanel] = useState<Panel>()
  const [query, setQuery] = useState('')
  const [find, setFind] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [profileName, setProfileName] = useState('')
  const [shortcutName, setShortcutName] = useState('')
  const [shortcutUrl, setShortcutUrl] = useState('')
  const [bookmarkFolder, setBookmarkFolder] = useState('')
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState('')
  const [context, setContext] = useState<string>()
  const [dragged, setDragged] = useState<string>()
  const [live, setLive] = useState<Settings>()
  const [background, setBackground] = useState<{ src: string; mime: string }>()
  const [release, setRelease] = useState<Awaited<ReturnType<BrowserAPI['checkUpdates']>>>()
  const [checking, setChecking] = useState(false)
  const [metrics, setMetrics] = useState<Awaited<ReturnType<BrowserAPI['metrics']>>>()
  const [now, setNow] = useState(new Date())
  const address = useRef<HTMLInputElement>(null)
  const page = useRef<HTMLElement>(null)
  const findInput = useRef<HTMLInputElement>(null)
  const state = live ?? snapshot?.settings ?? defaults
  const tab = snapshot?.tabs.find(tab => tab.id === snapshot.active)
  const workspaceTabs = snapshot?.tabs.filter(tab => tab.workspace === snapshot.workspace)
  const pl = state.language === 'pl'
  const tr = (polish: string, english: string) => pl ? polish : english
  const animated = state.animations && state.profile !== 'ECO' && !state.focusGaming
  const privateMode = snapshot?.private === true
  const openPanel = (next: Panel) => { setContext(undefined); setPanel(current => current === next ? undefined : next) }
  const send = (command: Command) => window.nexus.command(command).catch((error: Error) => setNotice(error.message))
  const update = (patch: Partial<Settings>) => {
    const next = { ...state, ...patch }
    setLive(next)
    void window.nexus.command({ type: 'settings', value: next })
      .then(() => window.nexus.state())
      .then(setSnapshot)
      .catch(error => setNotice(String(error)))
      .finally(() => setLive(current => current === next ? undefined : current))
  }
  const theme = (patch: Partial<Theme>) => update({ theme: { ...state.theme, ...patch } })

  useEffect(() => {
    let active = true
    const off = window.nexus.subscribe(setSnapshot)
    void window.nexus.state().then(value => { if (active) setSnapshot(value) }).catch(error => setNotice(String(error)))
    const focusOff = window.nexus.focus(target => {
      if (target === 'l') { address.current?.focus(); address.current?.select() }
      else setFind(true)
    })
    return () => { active = false; off(); focusOff() }
  }, [setSnapshot])
  useEffect(() => { setQuery(tab?.url ?? '') }, [tab?.id, tab?.url])
  useEffect(() => { if (find) findInput.current?.focus() }, [find])
  useEffect(() => {
    document.documentElement.lang = state.language
    const tick = window.setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [state.language])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 7000)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (snapshot === undefined) return
    let active = true
    let src: string | undefined
    void window.nexus.wallpaper().then(value => {
      if (!active) return
      if (!value) { setBackground(undefined); return }
      const data = Uint8Array.from(atob(value.bytes), char => char.charCodeAt(0))
      src = URL.createObjectURL(new Blob([data], { type: value.mime }))
      setBackground({ src, mime: value.mime })
    }).catch(error => setNotice(String(error)))
    return () => { active = false; if (src) URL.revokeObjectURL(src) }
  // Retrieve the binary only when its revision changes.
  }, [snapshot?.wallpaperRevision])
  useEffect(() => {
    if (panel !== 'gaming') return
    let active = true
    const refresh = () => void window.nexus.metrics().then(value => { if (active) setMetrics(value) }).catch(error => setNotice(String(error)))
    refresh()
    const timer = setInterval(refresh, 1500)
    return () => { active = false; clearInterval(timer) }
  }, [panel])
  useLayoutEffect(() => {
    const element = page.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      void window.nexus.command({ type: 'bounds', x: rect.left, y: rect.top, right: innerWidth - rect.right, tab: tab?.id, url: tab?.url, visible: !panel && !context }).catch(error => setNotice(String(error)))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [panel, context, find, state.scale, state.sidebar, state.vertical, tab?.id, tab?.url])
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPanel(undefined)
      setContext(undefined)
      setFind(false)
      void window.nexus.command({ type: 'find', value: '' }).catch(error => setNotice(String(error)))
    }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [])

  function navigate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = new FormData(event.currentTarget).get('address')
    if (typeof input === 'string' && input.trim()) {
      void send({ type: 'navigate', value: input })
      setPanel(undefined)
    }
  }

  function tabButton(item: Tab) {
    return <div key={item.id} className={item.id === snapshot?.active ? 'tab active' : 'tab'} draggable
      onDragStart={event => { event.dataTransfer.setData('text/plain', item.id); setDragged(item.id) }} onDragEnd={() => setDragged(undefined)}
      onDragOver={event => { if (dragged) event.preventDefault() }}
      onDrop={event => { event.preventDefault(); if (dragged) void send({ type: 'move', id: dragged, before: item.id }); setDragged(undefined) }}
      onContextMenu={event => { event.preventDefault(); setPanel(undefined); setContext(item.id) }}>
      <button title={item.url || tr('Nowa karta', 'New tab')} onClick={() => void send({ type: 'select', id: item.id })}>
        {item.pinned ? <Pin /> : item.sleeping ? <Moon /> : item.muted ? <VolumeX /> : item.url ? <Globe2 /> : <Zap />}
        <span>{item.group && item.group + ' · '}{item.title || (item.url ? new URL(item.url).hostname : tr('Nowa karta', 'New tab'))}</span>
      </button>
      <button className="close-tab" title={tr('Zamknij kartę', 'Close tab')} onClick={() => void send({ type: 'close', id: item.id })}><X /></button>
    </div>
  }

  const action = (label: string, type: Extract<Command, { type: string }>['type']) => ({
    label, run: () => { void send({ type } as Command); setPanel(undefined) }
  })
  const addShortcut = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const url = webUrl(shortcutUrl)
    const label = shortcutName.trim()
    if (!url || !label) { setNotice(tr('Wpisz nazwę i adres HTTP(S).', 'Enter a name and HTTP(S) address.')); return }
    update({ customShortcuts: [...state.customShortcuts, { label, url }] })
    setShortcutName('')
    setShortcutUrl('')
  }
  const color = state.theme.background
  const light = parseInt(color.slice(1, 3), 16) * .2126 + parseInt(color.slice(3, 5), 16) * .7152 + parseInt(color.slice(5, 7), 16) * .0722 > 150
  const custom = { '--accent': state.theme.accent, '--base': color, '--scale': state.scale / 100, '--radius': state.theme.rounded ? '13px' : '2px', '--glow': state.theme.glow / 100, '--glass': state.theme.glass + '%', '--address-radius': state.theme.addressRounded ? '13px' : '2px' } as CSSProperties
  const titles: Record<Panel, string> = {
    menu: 'NEXUS GX', theme: 'NEXUS Theme Studio', gaming: 'Gaming Control Center', privacy: tr('Prywatność', 'Privacy'),
    history: tr('Historia', 'History'), bookmarks: tr('Zakładki', 'Bookmarks'), downloads: tr('Pobrane pliki', 'Downloads'), extensions: tr('Rozszerzenia', 'Extensions'), settings: tr('Ustawienia', 'Settings')
  }
  const toggle = (label: string, key: 'animations' | 'vertical' | 'block' | 'httpsOnly' | 'history' | 'clearHistoryOnExit' | 'focusGaming' | 'clock' | 'shortcuts') =>
    <label className="setting"><span>{label}</span><input type="checkbox" checked={state[key]} onChange={event => update({ [key]: event.target.checked })} /></label>
  const openPrivacyPage = (url: string) => {
    void send({ type: 'new', url })
    setPanel(undefined)
  }
  const protonDownload = snapshot?.platform === 'windows' ? 'https://protonvpn.com/download-windows'
    : snapshot?.platform === 'linux' ? 'https://protonvpn.com/download-linux' : 'https://protonvpn.com/download'
  const spotifyTab = Boolean(spotifyPlayerUrl(tab?.url))
  const origin = originOf(tab?.url)
  const blockedByClient = tab?.error === 'ERR_BLOCKED_BY_CLIENT'
  const blockedByHttps = blockedByClient && state.httpsOnly && tab?.url.startsWith('http:')
  const blockedByFilter = blockedByClient && !blockedByHttps && state.block
  const secureOrigin = originOf(tab?.url, true)
  const permissionLabels = [tr('Kamera', 'Camera'), tr('Mikrofon', 'Microphone'), tr('Lokalizacja', 'Location'), tr('Powiadomienia', 'Notifications')]
  const activeContext = snapshot?.tabs.find(item => item.id === context)
  const rail = <aside className="rail">
    <button className="brand-icon" title={tr('Strona startowa', 'Home')} onClick={() => {setPanel(undefined); void send({ type: 'home' })}}><Zap fill="currentColor" /></button>
    <div className="rail-divider" />
    <IconButton icon={Gamepad2} label={titles.gaming} active={panel === 'gaming'} onClick={() => openPanel('gaming')} />
    <IconButton icon={Palette} label={titles.theme} active={panel === 'theme'} onClick={() => openPanel('theme')} />
    <IconButton icon={Shield} label={titles.privacy} active={panel === 'privacy'} onClick={() => openPanel('privacy')} />
    <IconButton icon={Bookmark} label={titles.bookmarks} active={panel === 'bookmarks'} onClick={() => openPanel('bookmarks')} />
    <IconButton icon={Clock3} label={titles.history} active={panel === 'history'} onClick={() => openPanel('history')} />
    <IconButton icon={Download} label={titles.downloads} active={panel === 'downloads'} onClick={() => openPanel('downloads')} />
    <div className="rail-sites">
      {services.map(([Icon, label, url]) => <IconButton key={label} icon={Icon} label={label} onClick={() => { setPanel(undefined); void send({ type: 'new', url }) }} />)}
      {state.customShortcuts.map(({ label, url }, index) => <IconButton key={index} icon={Globe2} label={label} onClick={() => { setPanel(undefined); void send({ type: 'new', url }) }} />)}
    </div>
    <span className="spacer" />
    {!privateMode && <IconButton icon={Puzzle} label={titles.extensions} active={panel === 'extensions'} onClick={() => openPanel('extensions')} />}
    <IconButton icon={Settings2} label={titles.settings} active={panel === 'settings'} onClick={() => openPanel('settings')} />
  </aside>

  return <div className={['shell', light ? 'light' : '', animated ? '' : 'still', state.theme.font, state.theme.rainbow ? 'rainbow' : ''].join(' ')} style={custom}>
    <header>
      <div className="tab-strip">
        <span className="wordmark"><Zap fill="currentColor" /> NEXUS<span>GX</span></span>
        {!state.vertical && <div className="tab-list">{workspaceTabs?.map(tabButton)}</div>}
        <IconButton icon={Plus} label={tr('Nowa karta', 'New tab')} onClick={() => { setPanel(undefined); void send({ type: 'new' }) }} />
        <span className="spacer" />
        {snapshot && snapshot.workspaces.length > 1 && <select className="workspace-select" aria-label={tr('Przestrzeń robocza', 'Workspace')} value={snapshot.workspace} onChange={event => void send({ type: 'workspace', value: event.target.value })}>
          {snapshot.workspaces.map(name => <option key={name} value={name}>{name || tr('Główna', 'Main')}</option>)}
        </select>}
        {privateMode && <span className="private-label"><Shield size={14} /> {tr('Okno prywatne', 'Private window')}</span>}
        <IconButton icon={Menu} label={tr('Menu przeglądarki', 'Browser menu')} onClick={() => openPanel('menu')} />
      </div>
      <div className="toolbar">
        <IconButton icon={ArrowLeft} label={tr('Wstecz', 'Back')} disabled={!tab?.back} onClick={() => void send({ type: 'back' })} />
        <IconButton icon={ArrowRight} label={tr('Dalej', 'Forward')} disabled={!tab?.forward} onClick={() => void send({ type: 'forward' })} />
        <IconButton icon={RotateCw} label={tr('Odśwież', 'Reload')} disabled={!tab?.url} onClick={() => void send({ type: 'reload' })} />
        <IconButton icon={House} label={tr('Start', 'Home')} onClick={() => { setPanel(undefined); void send({ type: 'home' }) }} />
        <form className="address" onSubmit={navigate}>
          {tab?.url.startsWith('https:') && !tab.error ? <LockKeyhole size={15} /> : <Globe2 size={15} />}
          <input ref={address} name="address" aria-label={tr('Adres lub wyszukiwanie', 'Address or search')} placeholder={tr('Wpisz adres lub wyszukaj', 'Enter an address or search')} value={query} onChange={event => setQuery(event.target.value)} />
          {tab?.loading && <span className="loading" aria-label={tr('Wczytywanie', 'Loading')} />}
          <IconButton icon={Bookmark} label={tr('Przełącz zakładkę', 'Toggle bookmark')} active={snapshot?.bookmarks.some(entry => entry.url === tab?.url)} disabled={!tab?.url || privateMode} onClick={() => void send({ type: 'bookmark' })} />
        </form>
        <IconButton icon={Shield} label={titles.privacy} onClick={() => openPanel('privacy')} />
      </div>
      {spotifyTab && <div className="media-bar"><Music2 size={15} />
        <span>{tr('Spotify · odtwarzanie muzyki wymaga obsługi DRM.', 'Spotify · music playback requires DRM support.')}</span>
        {!privateMode && <button type="button" onClick={() => void send({ type: 'spotifyExternal' })}>{tr('Otwórz w domyślnej przeglądarce', 'Open in default browser')}</button>}
      </div>}
      {notice && <div className="notice-bar" role="status">{notice}<IconButton icon={X} label={tr('Zamknij', 'Close')} onClick={() => setNotice('')} /></div>}
      {find && <div className="find-bar"><input ref={findInput} placeholder={tr('Znajdź na stronie', 'Find in page')} aria-label={tr('Znajdź na stronie', 'Find in page')} onChange={event => void send({ type: 'find', value: event.target.value })} /><IconButton icon={X} label={tr('Zamknij', 'Close')} onClick={() => { setFind(false); void send({ type: 'find', value: '' }) }} /></div>}
    </header>
    <div className="body">
      {state.sidebar === 'left' && rail}
      {state.vertical && <aside className="vertical-tabs">{workspaceTabs?.map(tabButton)}</aside>}
      <main ref={page} className="page">
        {(!tab?.url || tab.error) && <>
          <div className="wall" aria-hidden="true">
            {background && (background.mime.startsWith('video/') ? <video key={background.src} src={background.src} loop muted autoPlay={animated} playsInline ref={element => { if (element) { if (!animated) element.pause(); else void element.play().catch(() => {}) } }} /> : (animated || background.mime !== 'image/gif') && <img src={background.src} alt="" />)}
            <div className="grid-plane" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
          </div>
          {tab?.error ? <section className="error-box"><Shield size={36} /><h1>{tr('Nie udało się otworzyć strony', 'Could not open this page')}</h1><p>{blockedByHttps ? tr('Tryb HTTPS blokuje ten nieszyfrowany adres HTTP.', 'HTTPS-only mode blocks this unencrypted HTTP address.') :
            blockedByFilter ? tr('Filtr NEXUS GX zablokował tę stronę.', 'The NEXUS GX filter blocked this page.') : tab.error}</p>
            <button className="solid" onClick={() => void send({ type: 'reload' })}>{tr('Spróbuj ponownie', 'Try again')}</button>
            {blockedByClient && <button className="solid" onClick={() => openPanel('privacy')}>{tr('Sprawdź ustawienia prywatności', 'Review privacy settings')}</button>}</section> :
            <motion.section className="start" initial={false} animate={{ opacity: 1 }} transition={{ duration: animated ? .25 : 0 }}>
              {privateMode ? <><Shield size={55} /><h1 className="private-title">{tr('Przeglądanie prywatne', 'Private browsing')}</h1><p>{tr('To okno używa oddzielnej sesji w pamięci.', 'This window uses a separate in-memory session.')}</p></> :
                state.clock && <div className="time"><time>{now.toLocaleTimeString(pl ? 'pl-PL' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</time><p>{now.toLocaleDateString(pl ? 'pl-PL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>}
              <form className="hero-search" onSubmit={navigate}><Search size={21} /><input name="address" aria-label={tr('Szukaj w internecie', 'Search the web')} placeholder={tr('Dokąd dziś wyruszasz?', 'Where to today?')} /><button title={tr('Szukaj', 'Search')}><ArrowUpRight size={20} /></button></form>
              {!privateMode && state.shortcuts && !state.focusGaming && <section className="quick"><h2>{tr('Szybki dostęp', 'Quick access')}</h2><div className="services">{services.map(([Icon, label, url, color]) => <button key={label} onClick={() => void send({ type: 'navigate', value: url })}><span style={{ color }}><Icon size={23} /></span>{label}</button>)}</div></section>}
            </motion.section>}
          {!tab?.url && <footer className="start-footer"><button onClick={() => openPanel('gaming')}><Zap size={14} /> {state.profile}</button><button onClick={() => openPanel('theme')}><Palette size={15} /> {tr('Personalizuj', 'Customize')}</button></footer>}
        </>}
        {(panel || activeContext) && <button className="scrim" aria-label={tr('Zamknij panel', 'Close panel')} onClick={() => { setPanel(undefined); setContext(undefined) }} />}
        {activeContext && <section className="drawer"><div className="drawer-head"><h2>{tr('Opcje karty', 'Tab options')}</h2><IconButton icon={X} label={tr('Zamknij', 'Close')} onClick={() => setContext(undefined)} /></div>
          {([['pin', tr('Przełącz przypięcie', 'Toggle pin')], ['mute', tr('Przełącz wyciszenie', 'Toggle mute')], ['sleep', tr('Uśpij kartę', 'Sleep tab')], ['close', tr('Zamknij kartę', 'Close tab')]] as const).map(([type, label]) => <button key={type} className="row" onClick={() => { void send({ type, id: activeContext.id }); setContext(undefined) }}>{label}</button>)}
          {snapshot && snapshot.workspaces.length > 1 && <label className="setting">{tr('Przenieś do przestrzeni', 'Move to workspace')}<select value={activeContext.workspace} onChange={event => {
            void send({ type: 'moveWorkspace', id: activeContext.id, value: event.target.value })
            setContext(undefined)
          }}>{snapshot.workspaces.map(name => <option key={name} value={name}>{name || tr('Główna', 'Main')}</option>)}</select></label>}
          <label className="setting">{tr('Grupa', 'Group')}<input key={activeContext.id} defaultValue={activeContext.group} maxLength={32} onBlur={event => void send({ type: 'group', id: activeContext.id, value: event.target.value })} /></label>
        </section>}
        {panel && <section className="drawer" aria-label={titles[panel]}>
          <div className="drawer-head"><h2>{titles[panel]}</h2><IconButton icon={X} label={tr('Zamknij', 'Close')} onClick={() => setPanel(undefined)} /></div>
          {panel === 'theme' && <>
            <div className="presets">{presets.map(([name, accent, background]) => <button key={name} aria-pressed={state.theme.name === name} className={state.theme.name === name ? 'chosen' : ''} onClick={() => theme({ name, accent, background, rainbow: name === 'RGB Rainbow' })}><i style={{ background: accent, borderColor: background }} />{name}</button>)}</div>
            <label className="setting">{tr('Nazwa', 'Name')}<input key={state.theme.name} defaultValue={state.theme.name} maxLength={48} onBlur={event => theme({ name: event.target.value })} /></label>
            <label className="setting">{tr('Akcent', 'Accent')}<input type="color" value={state.theme.accent} onChange={event => theme({ accent: event.target.value })} /></label>
            <label className="setting">{tr('Tło', 'Background')}<input type="color" value={state.theme.background} onChange={event => theme({ background: event.target.value })} /></label>
            <label className="setting">{tr('Poświata', 'Glow')}<input type="range" min="0" max="100" value={state.theme.glow} onChange={event => theme({ glow: Number(event.target.value) })} /></label>
            <label className="setting">{tr('Zaokrąglone karty', 'Rounded tabs')}<input type="checkbox" checked={state.theme.rounded} onChange={event => theme({ rounded: event.target.checked })} /></label>
            <label className="setting">{tr('Zaokrąglony pasek adresu', 'Rounded address bar')}<input type="checkbox" checked={state.theme.addressRounded} onChange={event => theme({ addressRounded: event.target.checked })} /></label>
            <label className="setting">{tr('Krycie paneli', 'Panel opacity')}<input type="range" min="0" max="100" value={state.theme.glass} onChange={event => theme({ glass: Number(event.target.value) })} /></label>
            <label className="setting">{tr('Czcionka', 'Font')}<select value={state.theme.font} onChange={event => theme({ font: event.target.value as Theme['font'] })}><option value="system">System</option><option value="mono">Monospace</option><option value="serif">Serif</option></select></label>
            <label className="setting">{tr('Cykl RGB', 'RGB cycling')}<input type="checkbox" checked={state.theme.rainbow} onChange={event => theme({ rainbow: event.target.checked })} /></label>
            <div className="actions"><button onClick={() => {
              const savedThemes = state.savedThemes.filter(item => item.name !== state.theme.name)
              update({ savedThemes: [state.theme, ...savedThemes].slice(0, 24) })
            }}>{tr('Zapisz do biblioteki', 'Save to library')}</button>{state.savedThemes.map(item => <button key={item.name} onClick={() => theme(item)}>{item.name}</button>)}</div>
            <div className="actions"><button onClick={() => void send({ type: 'wallpaper' })}>{tr('Wybierz tapetę', 'Choose wallpaper')}</button><button onClick={() => void send({ type: 'removeWallpaper' })}>{tr('Usuń tapetę', 'Remove wallpaper')}</button></div>
            <div className="actions"><button onClick={() => {
              const url = URL.createObjectURL(new Blob([JSON.stringify(state.theme, null, 2)], { type: 'application/json' }))
              const link = document.createElement('a')
              link.href = url; link.download = 'nexus-theme.json'; link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}>{tr('Eksportuj motyw', 'Export theme')}</button>
            <label className="file-option">{tr('Importuj motyw', 'Import theme')}<input type="file" accept=".json,application/json" onChange={event => {
              const file = event.target.files?.[0]
              if (!file || file.size > 16384) return
              void file.text().then(text => theme(readTheme(JSON.parse(text)))).catch(() => setNotice(tr('Nieprawidłowy plik motywu', 'Invalid theme file')))
              event.target.value = ''
            }} /></label><button onClick={() => theme(defaults.theme)}>{tr('Resetuj motyw', 'Reset theme')}</button></div>
          </>}
          {panel === 'gaming' && <>
            <div className="metrics"><div><b>{metrics ? format(metrics.memory) : '—'}</b><span>RAM · RSS</span></div><div><b>{metrics ? metrics.cpu.toFixed(1) + '%' : '—'}</b><span>CPU</span></div><div><b>{metrics?.processes ?? '—'}</b><span>{tr('Procesy', 'Processes')}</span></div></div>
            {toggle(tr('Focus Gaming', 'Focus Gaming'), 'focusGaming')}
            <div className="actions">{(['ECO', 'BALANCED', 'PERFORMANCE'] as const).map(profile => <button key={profile} className={profile === state.profile ? 'chosen' : ''} onClick={() => update({ profile })}>{profile}</button>)}</div>
            <label className="setting">{tr('Usypiaj po (min)', 'Sleep after (min)')}<input type="number" min="1" max="120" value={state.sleepMinutes} onChange={event => update({ sleepMinutes: Number(event.target.value) })} /></label>
            <p>{tr('ECO usypia karty po maksymalnie 3 minutach i wyłącza animacje. PERFORMANCE wyłącza automatyczne usypianie. Uśpiona karta traci stan strony.', 'ECO sleeps tabs after at most 3 minutes and turns off animations. PERFORMANCE disables automatic sleep. A sleeping tab loses its page state.')}</p>
          </>}
          {panel === 'privacy' && <>
            {toggle(tr('Filtr reklam, trackerów i szkodliwych domen', 'Ad, tracker and malicious domain filter'), 'block')}
            {toggle(tr('Blokuj nieszyfrowane HTTP i WebSocket', 'Block unencrypted HTTP and WebSockets'), 'httpsOnly')}
            {toggle(tr('Zapisuj historię i ostatnią sesję', 'Save browsing history and last session'), 'history')}
            {!state.history && <p>{tr('Historia i adresy z ostatniej sesji nie są zapisywane. Osobne okno prywatne izoluje także dane stron.', 'History and last-session addresses are not saved. A private window also isolates site data.')}</p>}
            <p>{tr('Zablokowane żądania', 'Blocked requests')} · {snapshot?.blocked ?? 0}</p>
            <p>{tr('Aktualizacja list', 'Filter update')} · {snapshot?.filterTime ? new Date(snapshot.filterTime).toLocaleString(state.language) : (snapshot?.filtersLoaded ? tr('Wczytano część list', 'Some feeds loaded') : tr('Brak wczytanej listy', 'No filter list loaded'))}</p>
            {toggle(tr('Czyść historię przy zamykaniu', 'Clear history on exit'), 'clearHistoryOnExit')}
            <p>{tr('Uprawnienia wymagają zgody dla konkretnej witryny HTTPS. Bezpośrednie połączenia UDP WebRTC są ograniczone.', 'Permissions require consent for a specific HTTPS site. Direct WebRTC UDP connections are restricted.')}</p>
            {!privateMode && origin && <label className="setting"><span>{tr('Wyjątek filtrowania', 'Filter exception')} · {origin}</span><input type="checkbox" checked={state.exceptions.includes(origin)} onChange={event => void send({ type: 'exception', allow: event.target.checked })} /></label>}
            {!privateMode && secureOrigin && !tab?.error && sitePermissions.map((permission, index) =>
              <label key={permission} className="setting"><span>{permissionLabels[index]} · {secureOrigin}</span><input type="checkbox" checked={state.permissions[secureOrigin]?.includes(permission) ?? false} onChange={event => void send({ type: 'permission', permission, allow: event.target.checked })} /></label>)}
            <div className="actions"><button onClick={() => void send({ type: 'updateFilters' })}>{tr('Zaktualizuj listy', 'Update filters')}</button>
            <button onClick={() => { if (window.confirm(tr('Wyczyścić historię i dane stron?', 'Clear history and site data?'))) void send({ type: 'clear' }) }}>{tr('Wyczyść dane stron', 'Clear site data')}</button></div>
            <h2>Proton VPN</h2>
            <p>{tr('Połącz się w oficjalnej aplikacji Proton VPN. Ruch NEXUS GX przejdzie przez systemowy tunel, jeśli przeglądarka nie jest wykluczona w ustawieniach dzielonego tunelowania.', 'Connect in the official Proton VPN app. NEXUS GX traffic uses the system tunnel if the browser is included in split-tunneling settings.')}</p>
            <div className="actions">
              <button onClick={() => openPrivacyPage(protonDownload)}>{tr('Pobierz Proton VPN', 'Get Proton VPN')}</button>
              <button onClick={() => openPrivacyPage('https://protonvpn.com/what-is-my-ip-address')}>{tr('Sprawdź publiczny adres IP', 'Check public IP address')}</button>
            </div>
            <p>{tr('NEXUS GX nie sprawdza stanu tunelu. Strona testowa otrzyma Twój publiczny adres IP.', 'NEXUS GX does not verify tunnel status. The test page receives your public IP address.')}</p>
            <h2>{tr('Konto Mozilla i Firefox', 'Mozilla account and Firefox')}</h2>
            <p>{tr('Zarządzaj kontem na stronie Mozilla. Przenieś zakładki z pliku HTML wyeksportowanego w Firefoksie. Firefox Sync wymaga osobnej integracji z Mozilla.', 'Manage your account on Mozilla’s website. Transfer bookmarks from an HTML export from Firefox. Firefox Sync requires a separate Mozilla integration.')}</p>
            <div className="actions">
              <button onClick={() => openPrivacyPage('https://accounts.firefox.com/')}>{tr('Otwórz konto Mozilla', 'Open Mozilla account')}</button>
              <button onClick={() => { setBookmarkFolder(''); openPanel('bookmarks') }}>{tr('Przenieś zakładki z Firefoksa', 'Transfer Firefox bookmarks')}</button>
            </div>
          </>}
          {panel === 'history' && <>
            {!snapshot?.history.length && <p>{state.history ? tr('Brak historii.', 'No history.') : tr('Zapisywanie historii jest wyłączone.', 'History recording is off.')}</p>}
            {snapshot?.history.map(entry => <button key={entry.url + entry.at} className="row" title={entry.url} onClick={() => { void send({ type: 'navigate', value: entry.url }); setPanel(undefined) }}><span>{entry.title}</span><small>{new URL(entry.url).hostname}</small></button>)}
          </>}
          {panel === 'bookmarks' && <>
            <label className="setting">{tr('Folder zakładek', 'Bookmarks folder')}<select value={bookmarkFolder} onChange={event => setBookmarkFolder(event.target.value)}>
              <option value="">{tr('Wszystkie', 'All')}</option>
              {[...new Set(snapshot?.bookmarks.flatMap(entry => entry.folder ? [entry.folder] : []))].sort().map(folder => <option key={folder}>{folder}</option>)}
            </select></label>
            {!privateMode && <div className="actions"><label className="file-option">{tr('Importuj zakładki HTML', 'Import HTML bookmarks')}<input type="file" accept=".html,.htm,text/html" onChange={event => {
              const file = event.target.files?.[0]
              if (!file) return
              event.target.value = ''
              if (file.size > 2 * 1024 * 1024) { setNotice(tr('Plik przekracza 2 MiB.', 'File exceeds 2 MiB.')); return }
              void file.text().then(html => {
                const value = parseBookmarks(html)
                if (!value.length) { setNotice(tr('Nie znaleziono zakładek HTTP(S).', 'No HTTP(S) bookmarks found.')); return }
                setBookmarkFolder('')
                return send({ type: 'bookmarkImport', value })
              }).catch(error => setNotice(String(error)))
            }} /></label></div>}
            {!snapshot?.bookmarks.length && <p>{tr('Brak zakładek.', 'No bookmarks.')}</p>}
            {snapshot?.bookmarks.filter(entry => !bookmarkFolder || entry.folder === bookmarkFolder).map(entry => <div key={entry.url} className="bookmark-row">
              <button className="row" title={entry.url} onClick={() => { void send({ type: 'navigate', value: entry.url }); setPanel(undefined) }}><span>{entry.title}<small>{entry.folder || new URL(entry.url).hostname}</small></span></button>
              {!privateMode && <label className="setting">{tr('Folder', 'Folder')}<input defaultValue={entry.folder} maxLength={150} onBlur={event => void send({ type: 'bookmarkFolder', url: entry.url, value: event.target.value })} /><IconButton icon={X} label={tr('Usuń zakładkę', 'Remove bookmark')} onClick={() => void send({ type: 'bookmarkRemove', url: entry.url })} /></label>}
            </div>)}
          </>}
          {panel === 'downloads' && <>
            {!snapshot?.downloads.length && <p>{tr('Brak pobrań w tym oknie.', 'No downloads in this window.')}</p>}
            {snapshot?.downloads.map(entry => <div className="download-row" key={entry.id}>
              {entry.available ? <button className="row" title={tr('Otwórz plik', 'Open file')} onClick={() => void send({ type: 'openDownload', id: entry.id })}>{entry.name}</button> : <div className="row">{entry.name}</div>}
              <div className="setting"><small>{entry.status} · {format(entry.bytes)}{entry.total > 0 && ' / ' + format(entry.total)}</small>
                {entry.available && <button onClick={() => void send({ type: 'showDownload', id: entry.id })}>{tr('Pokaż w folderze', 'Show in folder')}</button>}
                {['progressing', 'interrupted'].includes(entry.status) && <button onClick={() => void send({ type: 'cancel', id: entry.id })}>{tr('Anuluj', 'Cancel')}</button>}
              </div>
            </div>)}
          </>}
          {panel === 'extensions' && <>
            <p>{tr('Wybierz wypakowany dodatek Chromium z plikiem manifest.json. NEXUS GX obsługuje część API rozszerzeń Electron.', 'Select an unpacked Chromium extension containing manifest.json. NEXUS GX supports part of Electron’s extension APIs.')}</p>
            <div className="actions"><button onClick={() => void send({ type: 'installExtension' })}>{tr('Wczytaj lokalny dodatek', 'Load a local extension')}</button></div>
            {!snapshot?.extensions.length && <p>{tr('Brak rozszerzeń.', 'No extensions.')}</p>}
            {snapshot?.extensions.map(item => <div className="setting" key={item.id}><span>{item.name}<small>{item.active ? item.version : tr('Błąd ładowania', 'Load failed')}</small></span><button onClick={() => void send({ type: 'removeExtension', id: item.id })}>{tr('Usuń', 'Remove')}</button></div>)}
          </>}
          {panel === 'settings' && <>
            {toggle(tr('Animacje', 'Animations'), 'animations')}
            {toggle(tr('Karty pionowe', 'Vertical tabs'), 'vertical')}
            {toggle(tr('Zegar', 'Clock'), 'clock')}
            {toggle(tr('Szybki dostęp na stronie startowej', 'Quick access on the start page'), 'shortcuts')}
            <label className="setting">{tr('Skala interfejsu', 'Interface scale')}<input type="range" min="80" max="135" value={state.scale} onChange={event => update({ scale: Number(event.target.value) })} /></label>
            <label className="setting">{tr('Panel boczny', 'Sidebar')}<select value={state.sidebar} onChange={event => update({ sidebar: event.target.value === 'right' ? 'right' : 'left' })}><option value="left">{tr('Lewy', 'Left')}</option><option value="right">{tr('Prawy', 'Right')}</option></select></label>
            <label className="setting">{tr('Język', 'Language')}<select value={state.language} onChange={event => update({ language: event.target.value === 'en' ? 'en' : 'pl' })}><option value="pl">Polski</option><option value="en">English</option></select></label>
            <label className="setting">{tr('Wyszukiwarka', 'Search engine')}<select value={state.engine} onChange={event => update({ engine: event.target.value as Settings['engine'] })}>{Object.keys(engines).map(engine => <option key={engine}>{engine}</option>)}</select></label>
            {!privateMode && <>
              <h2>{tr('Profile przeglądarki', 'Browser profiles')}</h2>
              {snapshot?.profiles.map(profile => <button className="row" key={profile.id} disabled={profile.id === snapshot.profileId} onClick={() => {
                if (window.confirm(tr('Uruchomić ponownie przeglądarkę w wybranym profilu?', 'Restart the browser with this profile?'))) void send({ type: 'switchProfile', value: profile.id })
              }}>{profile.id === 'default' ? tr('Domyślny', 'Default') : profile.name}{profile.id === snapshot.profileId && ' ✓'}</button>)}
              <form className="shortcut-form" onSubmit={event => {
                event.preventDefault()
                if (!profileName.trim()) return
                void send({ type: 'addProfile', value: profileName })
                setProfileName('')
              }}><label>{tr('Nazwa profilu', 'Profile name')}<input required maxLength={40} value={profileName} onChange={event => setProfileName(event.target.value)} /></label><button className="solid">{tr('Utwórz profil', 'Create profile')}</button></form>
            </>}
            <h2>{tr('Skróty panelu bocznego', 'Sidebar shortcuts')}</h2>
            {state.customShortcuts.map(({ label, url }, index) => <div className="setting" key={index}><span>{label}<small>{url}</small></span><IconButton icon={X} label={tr('Usuń skrót', 'Remove shortcut')} onClick={() => update({ customShortcuts: state.customShortcuts.filter((_, position) => position !== index) })} /></div>)}
            {state.customShortcuts.length < 18 && <form className="shortcut-form" onSubmit={addShortcut}>
              <label>{tr('Nazwa skrótu', 'Shortcut name')} <input required maxLength={32} value={shortcutName} onChange={event => setShortcutName(event.target.value)} /></label>
              <label>{tr('Adres skrótu', 'Shortcut address')} <input type="url" required value={shortcutUrl} onChange={event => setShortcutUrl(event.target.value)} /></label>
              <button className="solid">{tr('Dodaj skrót', 'Add shortcut')}</button>
            </form>}
            <button className="row" onClick={() => void send({ type: 'defaultBrowser' })}>{tr('Ustaw domyślną przeglądarkę', 'Set default browser')}</button>
            {!privateMode && <button className="row" onClick={() => {
              if (window.confirm(tr('Usunąć karty, historię, zakładki, tapetę, ustawienia i dane witryn?', 'Remove tabs, history, bookmarks, wallpaper, settings and site data?'))) void send({ type: 'wipe' })
            }}>{tr('Wyzeruj dane przeglądarki', 'Reset browser data')}</button>}
            <h2>{tr('Aktualizacje', 'Updates')}</h2>
            <p>NEXUS GX {snapshot?.version}</p>
            {snapshot?.updateConfigured ? <>
              <button className="row" disabled={checking} onClick={() => {
                setChecking(true)
                void window.nexus.checkUpdates().then(setRelease).catch(error => setNotice(String(error))).finally(() => setChecking(false))
              }}>{checking ? tr('Sprawdzanie…', 'Checking…') : tr('Sprawdź aktualizacje', 'Check for updates')}</button>
              {release && <p>{release.available ? tr('Dostępna wersja ', 'Available version ') + release.version : tr('Masz aktualną wersję.', 'You have the latest version.')}</p>}
              {release?.available && <p className="release-notes">{release.notes}</p>}
            </> : <p>{tr('Kanał aktualizacji nie jest skonfigurowany.', 'No update channel is configured.')}</p>}
            <p>Ctrl+L · Ctrl+T · Ctrl+W · Ctrl+Shift+T · Ctrl+Tab · Ctrl+F · F11</p>
          </>}
          {panel === 'menu' && <>
            {[action(tr('Nowe okno', 'New window'), 'window'), action(tr('Nowe okno prywatne', 'New private window'), 'private'), action(tr('Przywróć zamkniętą kartę', 'Reopen closed tab'), 'restore'), action(tr('Kopiuj adres strony', 'Copy page address'), 'copy'), action(tr('Pełny ekran', 'Full screen'), 'fullscreen')].map(item => <button className="row" key={item.label} onClick={item.run}>{item.label}<ChevronDown size={12} /></button>)}
            <form className="shortcut-form" onSubmit={event => {
              event.preventDefault()
              if (!workspaceName.trim()) return
              void send({ type: 'workspace', value: workspaceName })
              setWorkspaceName('')
              setPanel(undefined)
            }}><label>{tr('Nazwa przestrzeni', 'Workspace name')}<input required maxLength={32} value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} /></label><button className="solid">{tr('Otwórz przestrzeń', 'Open workspace')}</button></form>
            <label className="setting">{tr('Szukaj kart', 'Search tabs')}<input value={filter} onChange={event => setFilter(event.target.value)} /></label>
            {snapshot?.tabs.filter(item => (item.title + ' ' + item.url).toLowerCase().includes(filter.toLowerCase())).map(item => <button className="row" key={item.id} onClick={() => { void send({ type: 'select', id: item.id }); setPanel(undefined) }}>{item.title || item.url || tr('Nowa karta', 'New tab')}</button>)}
          </>}
        </section>}
      </main>
      {state.sidebar === 'right' && rail}
    </div>
  </div>
}

function IconButton({ icon: Icon, label, active, disabled, onClick }: {
  icon: typeof Plus; label: string; active?: boolean; disabled?: boolean; onClick: () => void
}) {
  return <button type="button" className={active ? 'icon selected' : 'icon'} aria-label={label} title={label} disabled={disabled} onClick={onClick}><Icon size={18} /></button>
}

createRoot(document.getElementById('root')!).render(<App />)
