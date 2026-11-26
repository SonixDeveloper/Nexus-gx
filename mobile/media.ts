export type Playback = 'playing' | 'paused' | 'idle'

export function readPlayback(message: string): Playback | undefined {
  switch (message) {
    case 'nexus-media:playing': return 'playing'
    case 'nexus-media:paused': return 'paused'
    case 'nexus-media:idle': return 'idle'
  }
}

// The bridge carries display state only. Websites cannot issue native commands.
export const watchPlayback = `
(() => {
  let selected;
  let reported;
  const bridge = window.ReactNativeWebView;
  function report() {
    const playing = Array.from(document.querySelectorAll('video, audio'))
      .find(media => !media.paused && !media.ended && media.readyState > 0);
    if (playing) selected = playing;
    const state = playing ? 'playing' : selected?.isConnected && !selected.ended ? 'paused' : 'idle';
    if (state !== reported) {
      reported = state;
      bridge.postMessage('nexus-media:' + state);
    }
  }
  for (const event of ['playing', 'pause', 'ended', 'emptied']) {
    document.addEventListener(event, report, true);
  }
  window.addEventListener('nexus-media-toggle', () => {
    if (!selected?.isConnected || selected.ended) return;
    if (selected.paused) selected.play().catch(() => report());
    else selected.pause();
  });
  window.addEventListener('pageshow', report);
  report();
})();
true;
`

export const togglePlayback = "window.dispatchEvent(new Event('nexus-media-toggle')); true;"
