export function httpsUrl(value: string): string | undefined {
  if (!value || value.length > 8192) return
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href
  } catch { /* The native URL parser rejected this address. */ }
}

export function resolveAddress(input: string): string | undefined {
  const value = input.trim()
  if (!value || value.length > 4096) return
  if (/^[a-z][a-z+.-]*:\/\//i.test(value)) return httpsUrl(value)
  if (/^(?:localhost|(?:[\w-]+\.)+[\w-]+)(?::\d+)?(?:[/?#]\S*)?$/i.test(value)) return httpsUrl('https://' + value)
  if (/^[a-z][a-z+.-]*:/i.test(value)) return
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(value)
}

export function spotifyPlayerUrl(value?: string): string | undefined {
  const safe = value && httpsUrl(value)
  if (safe && new URL(safe).origin === 'https://open.spotify.com') return safe
}

export const shortcuts = [
  ['YouTube', 'https://www.youtube.com/'], ['Twitch', 'https://www.twitch.tv/'],
  ['Discord', 'https://discord.com/'], ['Steam', 'https://store.steampowered.com/'],
  ['Spotify', 'https://open.spotify.com/'], ['Reddit', 'https://www.reddit.com/']
] as const
