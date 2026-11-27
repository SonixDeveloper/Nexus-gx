import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { accountClient, AccountError, type AccountSession } from './account'

const client = accountClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
const tokenKey = 'nexus.account.refresh.v1'

export function useNexusAccount() {
  const [session, setSession] = useState<AccountSession>()
  const [restoring, setRestoring] = useState(Boolean(client))
  const [restoreFailed, setRestoreFailed] = useState(false)
  const operation = useRef(false)

  async function remember(next: AccountSession) {
    await SecureStore.setItemAsync(tokenKey, next.refresh_token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
    setSession(next)
  }

  async function restore() {
    if (!client || operation.current) return
    operation.current = true
    setRestoring(true)
    setRestoreFailed(false)
    try {
      const token = await SecureStore.getItemAsync(tokenKey)
      if (token) await remember(await client.refresh(token))
    } catch (error) {
      if (error instanceof AccountError && [400, 401, 403].includes(error.status)) {
        try { await SecureStore.deleteItemAsync(tokenKey) } catch { setRestoreFailed(true) }
      } else setRestoreFailed(true)
    } finally {
      operation.current = false
      setRestoring(false)
    }
  }

  useEffect(() => { void restore() }, [])

  return {
    client, session, restoring, restoreFailed, restore,
    async verify(email: string, code: string) {
      if (client) await remember(await client.verify(email, code))
    },
    async logout() {
      await SecureStore.deleteItemAsync(tokenKey)
      setSession(undefined)
      if (session) await client?.logout(session.access_token).catch(() => undefined)
    }
  }
}

export function AccountPanel({ visible, close, account }: {
  visible: boolean; close: () => void; account: ReturnType<typeof useNexusAccount>
}) {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)

  async function run(action: () => Promise<void>) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setFeedback('')
    try { await action() } catch (error) {
      setFeedback(error instanceof AccountError && error.status === 429
        ? 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.'
        : 'Nie udało się wykonać tej operacji. Sprawdź połączenie i poprawność kodu.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const cleanEmail = email.trim()
  const button = (label: string, action: () => void, disabled = false) =>
    <Pressable onPress={action} disabled={disabled || busy} accessibilityRole="button"
      style={[styles.button, (disabled || busy) && styles.disabled]}><Text style={styles.label}>{label}</Text></Pressable>

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.heading}>Konto NEXUS GX</Text>
        {account.restoring ? <Text style={styles.label}>Przywracanie sesji…</Text> : account.restoreFailed ?
          <>{<Text style={styles.label}>Nie udało się przywrócić sesji. Sprawdź połączenie.</Text>}
            {button('Spróbuj ponownie', () => void account.restore())}</> : account.session ?
          <><Text style={styles.label}>{account.session.user.email}</Text>
            {button('Wyloguj', () => void run(account.logout))}</> : !account.client ?
            <Text style={styles.label}>Logowanie będzie dostępne po podłączeniu serwera kont.</Text> :
            sentTo ? <>
              <Text style={styles.label}>Wpisz kod wysłany na {sentTo}.</Text>
              <TextInput accessibilityLabel="Kod z e-maila" value={code} onChangeText={value => setCode(value.replace(/\D/g, ''))}
                inputMode="numeric" maxLength={10} autoComplete="one-time-code" style={styles.input} />
              {button('Zaloguj się', () => void run(async () => {
                await account.verify(sentTo, code)
                setCode('')
                setSentTo('')
                setEmail('')
              }), code.length < 6)}
              {button('Zmień adres e-mail', () => { setSentTo(''); setCode(''); setFeedback('') })}
            </> : <>
              <Text style={styles.label}>Jednorazowy kod utworzy konto lub zaloguje Cię ponownie.</Text>
              <TextInput accessibilityLabel="Adres e-mail" value={email} onChangeText={setEmail} autoCapitalize="none"
                autoCorrect={false} inputMode="email" autoComplete="email" maxLength={254} style={styles.input} />
              {button('Wyślij kod', () => void run(async () => {
                await account.client?.sendCode(cleanEmail)
                setSentTo(cleanEmail)
              }), !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))}
            </>}
        {feedback ? <Text accessibilityRole="alert" style={styles.label}>{feedback}</Text> : null}
        {button('Zamknij', close)}
      </View>
    </View>
  </Modal>
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: '#0009', padding: 20 },
  panel: { padding: 18, gap: 12, backgroundColor: '#222631', borderRadius: 16 },
  input: { backgroundColor: '#101117', color: '#fff', borderRadius: 8, minHeight: 48, paddingHorizontal: 10 },
  heading: { color: '#fff', fontWeight: '700', fontSize: 20 },
  label: { color: '#fff', fontSize: 15 },
  button: { minHeight: 44, borderRadius: 8, backgroundColor: '#343b49', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .45 }
})
