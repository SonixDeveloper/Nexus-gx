/* global document, navigator, fetch */
const selector = document.querySelector('#os')
const platform = document.querySelector('#platform')
const packages = [...document.querySelectorAll('[data-os]')]
const agent = navigator.userAgent
const detected = /Windows NT/i.test(agent) ? 'windows' : /Linux/i.test(agent) && !/Android/i.test(agent) ? 'linux' : 'all'

function select(value) {
  selector.value = value
  for (const item of packages) item.hidden = value !== 'all' && item.dataset.os !== value
}

select(detected)
if (detected === 'windows') platform.textContent = 'Windows detected. Check that you are running Windows 11 before installing.'
if (detected === 'linux') platform.textContent = 'Linux detected. Flatpak is the cross-distribution option.'
selector.addEventListener('change', () => select(selector.value))

function exposeDownload(item, files) {
  const link = item.querySelector('[data-file]')
  if (!files.includes(link.dataset.file)) return
  const url = './downloads/' + encodeURIComponent(link.dataset.file)
  return fetch(url, { method: 'HEAD', cache: 'no-cache' }).then(asset => {
    const mime = asset.headers.get('content-type') || ''
    if (!asset.ok || mime.includes('text/html')) return
    link.href = url
    link.download = link.dataset.file
    link.hidden = false
    item.querySelector('[data-unavailable]').hidden = true
  })
}

fetch('./downloads.json', { cache: 'no-cache' })
  .then(response => response.ok ? response.json() : null)
  .then(manifest => {
    if (!manifest || !Array.isArray(manifest.files)) return
    return Promise.allSettled(packages.map(item => exposeDownload(item, manifest.files)))
  })
  .catch(() => { /* The unavailable state is already visible. */ })
