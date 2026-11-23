import { webUrl } from '../shared/validation'
import type { Visit } from '../shared/model'

export function parseBookmarks(html: string): Visit[] {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const bookmarks: Visit[] = []
  for (const link of document.querySelectorAll('dl a[href]')) {
    const url = webUrl(link.getAttribute('href'))
    if (!url) continue
    const folders: string[] = []
    for (let list = link.closest('dl'); list; list = list.parentElement?.closest('dl') ?? null) {
      const header = list.previousElementSibling
      const title = header?.matches('h3') ? header : header?.matches('dt') ? header.querySelector('h3') : null
      if (title?.textContent?.trim()) folders.unshift(title.textContent.trim())
    }
    bookmarks.push({ url, title: link.textContent?.trim() || url, folder: folders.join(' / '), at: Date.now() })
    if (bookmarks.length === 1000) break
  }
  return bookmarks
}
