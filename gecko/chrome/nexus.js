/* global Services */
{
  const prefName = 'nexusgx.appearance.palette'
  const apply = () => {
    const name = Services.prefs.getStringPref(prefName, NEXUS_PALETTES[0][0])
    const palette = NEXUS_PALETTES.find(item => item[0] === name) ?? NEXUS_PALETTES[0]
    const [, accent, base] = palette
    const root = document.documentElement
    const rgb = [1, 3, 5].map(offset => parseInt(base.slice(offset, offset + 2), 16))
    const isLight = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > 150
    root.setAttribute('nexus-theme', palette[0])
    root.style.setProperty('--nexus-accent', accent)
    root.style.setProperty('--nexus-base', base)
    root.style.setProperty('--nexus-foreground', isLight ? '#1d1928' : '#f3f4f7')
  }

  window.addEventListener('DOMContentLoaded', () => {
    const toolbar = document.getElementById('nav-bar')
    if (!toolbar) return
    const button = document.createXULElement('toolbarbutton')
    button.id = 'nexus-theme-button'
    button.setAttribute('label', 'NEXUS GX')
    button.setAttribute('type', 'menu')
    button.setAttribute('tooltiptext', 'NEXUS Theme Studio')
    const menu = document.createXULElement('menupopup')
    menu.setAttribute('aria-label', 'NEXUS Theme Studio')
    for (const [name] of NEXUS_PALETTES) {
      const item = document.createXULElement('menuitem')
      item.setAttribute('label', name)
      item.addEventListener('command', () => Services.prefs.setStringPref(prefName, name))
      menu.append(item)
    }
    button.append(menu)
    toolbar.append(button)
    apply()
    Services.prefs.addObserver(prefName, apply)
    window.addEventListener('unload', () => Services.prefs.removeObserver(prefName, apply), { once: true })
  }, { once: true })
}
