{
  const polish = navigator.language.toLowerCase().startsWith('pl')
  const locale = polish ? 'pl-PL' : navigator.language
  document.documentElement.lang = locale
  if (polish) {
    document.getElementById('search-label').textContent = 'Szukaj w internecie'
    document.getElementById('search-button').textContent = 'Szukaj'
    document.getElementById('shortcuts').setAttribute('aria-label', 'Szybki dostęp')
  }
  const time = document.getElementById('clock')
  const date = document.getElementById('date')
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const refresh = () => {
    const now = new Date()
    time.dateTime = now.toISOString()
    time.textContent = timeFormat.format(now)
    date.textContent = dateFormat.format(now)
  }
  refresh()
  window.setInterval(refresh, 1000)
}
