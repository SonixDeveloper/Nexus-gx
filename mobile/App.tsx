import { useEffect, useRef, useState, type ComponentRef } from 'react'
import {
  ActivityIndicator, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, useWindowDimensions, View
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { httpsUrl, resolveAddress, shortcuts } from './browser'

type Tab = {
  id: number
  source?: string
  url?: string
  title?: string
  back?: boolean
  forward?: boolean
  loading?: boolean
  error?: boolean
}

const themes = ['#b9ff38', '#7cd7ff', '#ff78bc', '#c0a5ff'] as const
const maxTabs = 8

function Button({ label, glyph, disabled, onPress }: {
  label: string
  glyph: string
  disabled?: boolean
  onPress: () => void
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
    onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.control}>{glyph}</Text>
  </Pressable>
}

function Browser() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 1 }])
  const [activeId, setActiveId] = useState(1)
  const [query, setQuery] = useState('')
  const [showTabs, setShowTabs] = useState(false)
  const [accent, setAccent] = useState<(typeof themes)[number]>(themes[0])
  const [notice, setNotice] = useState('')
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const editing = useRef(false)
  const nextId = useRef(2)
  const views = useRef(new Map<number, { goBack(): void; goForward(): void; reload(): void }>())
  const { width } = useWindowDimensions()
  const active = tabs.find(tab => tab.id === activeId) ?? tabs[0]

  const patch = (id: number, values: Partial<Tab>) =>
    setTabs(previous => previous.map(tab => tab.id === id ? { ...tab, ...values } : tab))

  useEffect(() => {
    if (!editing.current) setQuery(active.url ?? active.source ?? '')
  }, [active.id, active.url, active.source])

  useEffect(() => {
    const event = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showTabs) { setShowTabs(false); return true }
      if (!active.back) return false
      views.current.get(active.id)?.goBack()
      return true
    })
    return () => event.remove()
  }, [active.id, active.back, showTabs])

  function navigate(value: string) {
    const address = resolveAddress(value)
    if (!address) { setNotice('Podaj poprawny adres HTTPS lub wpisz zapytanie.'); return }
    input.current?.blur()
    editing.current = false
    setQuery(address)
    setNotice('')
    if (address === active.url && active.source) {
      patch(active.id, { error: false })
      views.current.get(active.id)?.reload()
      return
    }
    patch(active.id, { source: address, url: address, error: false, loading: true })
  }

  function select(id: number) {
    input.current?.blur()
    editing.current = false
    setActiveId(id)
    setShowTabs(false)
    setNotice('')
  }

  function add(url?: string) {
    if (tabs.length >= maxTabs) { setNotice('Limit to 8 kart. Zamknij kartę, aby otworzyć kolejną.'); return }
    const id = nextId.current++
    setTabs(previous => [...previous, { id, source: url, url, loading: Boolean(url) }])
    select(id)
  }

  function close(id: number) {
    const rest = tabs.filter(tab => tab.id !== id)
    if (!rest.length) rest.push({ id: nextId.current++ })
    setTabs(rest)
    if (id === active.id) {
      editing.current = false
      setActiveId(rest[rest.length - 1].id)
    }
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar barStyle="light-content" />
    <View style={styles.top}>
      <Text accessibilityRole="header" style={styles.logo}>NEXUS <Text style={{ color: accent }}>GX</Text></Text>
      <View style={styles.actions}>
        <Button label="Strona startowa" glyph="⌂" onPress={() => {
          patch(active.id, { source: undefined, url: undefined, title: undefined, back: false, forward: false, error: false, loading: false })
          setNotice('')
        }} />
        <Button label="Pokaż karty" glyph={String(tabs.length)} onPress={() => setShowTabs(!showTabs)} />
        <Button label="Nowa karta" glyph="+" onPress={() => add()} />
      </View>
    </View>
    <View style={styles.addressBar}>
      <Button label="Wstecz" glyph="‹" disabled={!active.back} onPress={() => views.current.get(active.id)?.goBack()} />
      {width > 380 && <Button label="Dalej" glyph="›" disabled={!active.forward} onPress={() => views.current.get(active.id)?.goForward()} />}
      <TextInput ref={input} accessibilityLabel="Adres lub wyszukiwanie" autoCapitalize="none" autoCorrect={false}
        selectTextOnFocus value={query} onChangeText={setQuery} onFocus={() => { editing.current = true }}
        onBlur={() => { editing.current = false }} onSubmitEditing={() => navigate(query)} returnKeyType="go"
        placeholder="Adres lub wyszukiwanie" placeholderTextColor="#a1a8b6" style={styles.input} />
      <Button label="Przejdź" glyph="→" onPress={() => navigate(query)} />
    </View>
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    {active.loading && <ActivityIndicator color={accent} style={styles.progress} />}
    <View style={styles.content}>
      <View style={[StyleSheet.absoluteFill, showTabs && styles.hidden]} importantForAccessibility={showTabs ? 'no-hide-descendants' : 'auto'}>
        {tabs.filter(tab => tab.source).map(tab => <View key={tab.id} style={[StyleSheet.absoluteFill, tab.id !== active.id && styles.hidden]}
          importantForAccessibility={tab.id === active.id ? 'auto' : 'no-hide-descendants'}>
          <WebView ref={view => { if (view) views.current.set(tab.id, view); else views.current.delete(tab.id) }}
            source={{ uri: tab.source! }} originWhitelist={['*']}
            onShouldStartLoadWithRequest={request => Boolean(httpsUrl(request.url)) || request.url === 'about:blank'}
            onOpenWindow={event => {
              const url = httpsUrl(event.nativeEvent.targetUrl)
              if (url) add(url)
            }}
            allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
            mixedContentMode="never" thirdPartyCookiesEnabled={false} allowsLinkPreview={false}
            onNavigationStateChange={state => {
              const url = httpsUrl(state.url)
              if (url) patch(tab.id, { url, title: state.title, back: state.canGoBack, forward: state.canGoForward, loading: state.loading })
            }}
            onLoadStart={() => patch(tab.id, { error: false, loading: true })}
            onLoadEnd={() => patch(tab.id, { loading: false })}
            onError={() => patch(tab.id, { error: true, loading: false })}
            renderError={() => <View style={styles.error}><Text style={styles.heading}>Nie udało się otworzyć strony</Text>
              <Button label="Spróbuj ponownie" glyph="↻" onPress={() => views.current.get(tab.id)?.reload()} /></View>}
          />
        </View>)}
        {!active.source && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.home}>
          <Text style={[styles.brand, { color: accent }]}>NEXUS GX</Text>
          <Text style={styles.heading}>Dokąd dziś wyruszasz?</Text>
          <Pressable accessibilityRole="button" onPress={() => input.current?.focus()} style={[styles.search, { borderColor: accent }]}>
            <Text style={styles.control}>Szukaj w internecie</Text>
          </Pressable>
          <Text style={styles.muted}>Szybki dostęp</Text>
          <View style={styles.shortcuts}>
            {shortcuts.map(([label, url]) => <Pressable accessibilityRole="button" key={label} style={styles.tile} onPress={() => navigate(url)}>
              <Text style={styles.control}>{label}</Text>
            </Pressable>)}
          </View>
          <View style={styles.actions}>{themes.map(color => <Pressable key={color} accessibilityRole="button"
            accessibilityLabel={'Kolor motywu ' + color} accessibilityState={{ selected: accent === color }}
            onPress={() => setAccent(color)} style={[styles.swatch, { backgroundColor: color, borderColor: accent === color ? '#fff' : color }]} />)}</View>
        </ScrollView>}
      </View>
      {showTabs && <ScrollView style={styles.tabs}>
        <Text style={styles.heading}>Otwarte karty</Text>
        {tabs.map(tab => <View style={styles.tab} key={tab.id}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: tab.id === active.id }} style={styles.tabTitle} onPress={() => select(tab.id)}>
            <Text style={styles.control} numberOfLines={1}>{tab.title || tab.url || 'Nowa karta'}</Text>
          </Pressable>
          <Button label="Zamknij kartę" glyph="×" onPress={() => close(tab.id)} />
        </View>)}
      </ScrollView>}
    </View>
    {active.source && <View style={styles.bottom}>
      <Text style={styles.muted} numberOfLines={1}>{active.error ? 'Błąd połączenia' : 'HTTPS'}</Text>
      {width <= 380 && <Button label="Dalej" glyph="›" disabled={!active.forward} onPress={() => views.current.get(active.id)?.goForward()} />}
      <Button label="Odśwież" glyph="↻" onPress={() => views.current.get(active.id)?.reload()} />
    </View>}
  </SafeAreaView>
}

export default function App() {
  return <SafeAreaProvider><Browser /></SafeAreaProvider>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101117' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  logo: { color: '#f8fafc', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 6 },
  input: { flex: 1, minWidth: 0, height: 44, color: '#f8fafc', borderRadius: 12, paddingHorizontal: 10, backgroundColor: '#222631' },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 5 },
  disabled: { opacity: .4 },
  control: { color: '#f3f6fb', fontSize: 16, fontWeight: '600' },
  notice: { color: '#ffb8bd', paddingHorizontal: 12, paddingVertical: 8 },
  progress: { paddingVertical: 3 },
  content: { flex: 1 },
  hidden: { display: 'none' },
  home: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 24, paddingHorizontal: 18 },
  brand: { fontSize: 38, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
  heading: { color: '#f8fafc', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  muted: { color: '#abb2c2', fontSize: 13 },
  search: { alignItems: 'center', justifyContent: 'center', minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  shortcuts: { maxWidth: 510, justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { alignItems: 'center', justifyContent: 'center', minWidth: 90, minHeight: 48, borderRadius: 10, backgroundColor: '#222631', paddingHorizontal: 10 },
  swatch: { borderRadius: 22, width: 44, height: 44, borderWidth: 2 },
  tabs: { flex: 1, padding: 14 },
  tab: { flexDirection: 'row', marginTop: 8, alignItems: 'center', borderRadius: 10, backgroundColor: '#222631' },
  tabTitle: { flex: 1, minHeight: 44, padding: 10, justifyContent: 'center' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: '#101117' }
})
