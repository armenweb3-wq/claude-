/* Persistent overlay, on screen for all 60 seconds: brand bug, running clock,
 * the risk-warning band (abbreviated wording until 50 s, full wording after),
 * and a 30-bar ruler in the non-critical strip. (Film grain is added by the
 * encoder in tools/render.mjs, which keeps frame capture fast.)
 */
AD.defineScene('chrome', {
  css: `
    .scene--chrome { pointer-events: none; }
    .chrome-clock { position: absolute; display: flex; align-items: center; justify-content: flex-end; color: var(--white); letter-spacing: 0.02em; }
    .chrome-clock .utc { color: var(--grey); margin-left: 0.5em; }
    .chrome-band {
      position: absolute; box-sizing: border-box; overflow: hidden;
      background: #101a26;
      border: 2px solid var(--white);
      border-radius: 4px;
      color: var(--white);
    }
    /* legal.bandTheme: 'light' in config.js gives a light placard with dark text. */
    .chrome-band.light { background: #dce4ea; border-color: #dce4ea; color: #070b10; }
    .chrome-band .txt { position: absolute; left: 0; top: 0; right: 0; box-sizing: border-box; font-family: var(--font-text); font-weight: 400; }
    .chrome-band .txt b { font-weight: 600; }
    .chrome-ruler { position: absolute; }
    .chrome-ruler .lbl { position: absolute; top: 20px; font: 500 16px var(--font-mono); color: var(--grey); letter-spacing: 0.1em; }
    .chrome-ambient { position: absolute; left: 0; opacity: 0.75; }
  `,
  build(root, ctx) {
    const L = ctx.layout
    const kit = AD.kit

    // Vertical only: the lower third sits under the apps' own buttons, so it
    // carries no message, just the film's time base ticking past a playhead.
    let ambient = null
    if (ctx.vertical) {
      const top = L.ruler.y + 78
      const c = AD.el('canvas', 'chrome-ambient', root)
      c.width = ctx.W
      c.height = ctx.H - top - 70
      c.style.top = top + 'px'
      ambient = { g: c.getContext('2d'), w: c.width, h: c.height }
    }

    // Ruler: one major tick per bar, one minor tick per beat, playhead = now.
    const ruler = AD.el('div', 'chrome-ruler', root)
    ruler.style.left = L.ruler.x + 'px'
    ruler.style.top = L.ruler.y + 'px'
    ruler.style.width = L.ruler.w + 'px'
    const rs = AD.svg('svg', { class: 'k-svg', width: L.ruler.w, height: 20, viewBox: `0 0 ${L.ruler.w} 20` }, ruler)
    let d = ''
    for (let beat = 0; beat <= 120; beat++) {
      const x = ((beat / 120) * L.ruler.w).toFixed(2)
      d += `M${x},0 l0,${beat % 4 === 0 ? 14 : 6} `
    }
    AD.svg('path', { d, stroke: 'var(--grey)', 'stroke-width': 1.5, opacity: 0.55, fill: 'none' }, rs)
    const done = AD.svg('path', { d: `M0,0 L${L.ruler.w},0`, stroke: 'var(--accent)', 'stroke-width': 2, fill: 'none', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, rs)
    const head = AD.svg('path', { d: 'M0,-6 L0,18', stroke: 'var(--accent)', 'stroke-width': 3, fill: 'none' }, rs)
    const showLabels = ctx.format !== '4x5'
    if (showLabels) {
      AD.el('div', 'lbl', ruler, '00').style.left = '0'
      AD.el('div', 'lbl', ruler, '60 s').style.right = '0'
    }

    // Brand bug.
    const bug = kit.lockup(root, { size: L.bug.markSize, x: L.bug.x, y: L.bug.y + (L.bug.h - L.bug.markSize) / 2 })

    // Clock.
    const clock = AD.el('div', 'chrome-clock t-mono', root)
    clock.style.right = ctx.W - L.clock.right + 'px'
    clock.style.top = L.clock.y + 'px'
    clock.style.height = L.clock.h + 'px'
    clock.style.fontSize = L.clock.fontSize + 'px'
    const time = AD.el('span', 'time', clock)
    AD.el('span', 'utc', clock, 'UTC')

    // Risk band.
    const band = AD.el('div', `chrome-band k-riskband${ctx.config.legal.bandTheme === 'light' ? ' light' : ''}`, root)
    band.style.left = L.band.x + 'px'
    band.style.width = L.band.w + 'px'
    const mk = kind => {
      const t = AD.el('div', 'txt', band)
      t.style.padding = `${L.bandStyle.padY - 2}px ${L.bandStyle.padX - 2}px`
      t.style.fontSize = L.bandStyle.font + 'px'
      t.style.lineHeight = L.bandStyle.line + 'px'
      t.innerHTML = kit.riskHTML(kind)
      return t
    }
    return { ambient, done, head, bug, clock, time, band, short: mk('short'), full: mk('full'), rulerW: L.ruler.w }
  },
  render(t, ctx, s, T) {
    const L = ctx.layout
    const x = (T / AD.duration) * s.rulerW
    s.done.setAttribute('stroke-dashoffset', (1 - T / AD.duration).toFixed(5))
    s.head.setAttribute('transform', `translate(${x.toFixed(2)},0)`)

    if (s.ambient) {
      // A time base, not a chart: ticks every tenth of a second scroll past a
      // fixed playhead, taller on the beat and tallest on the bar.
      const { g, w, h } = s.ambient
      // The half-second of void before the drop at 16 s is void here too.
      g.canvas.style.visibility = T >= 15.5 && T < 16 ? 'hidden' : 'visible'
      const now = Math.round(w * 0.8)
      const SPAN = 6 // seconds between the left edge and the playhead
      const mid = Math.round(h * 0.42)
      const xOf = time => now - ((T - time) / SPAN) * now
      g.clearRect(0, 0, w, h)
      g.lineWidth = 2
      for (let k = Math.ceil((T - SPAN) * 10 - 1e-6); xOf(k / 10) <= w; k++) {
        if (k < 0) continue
        const x = Math.round(xOf(k / 10))
        const bar = k % 20 === 0
        const beat = k % 5 === 0
        const len = bar ? 96 : beat ? 44 : 14
        const ahead = k / 10 > T + 1e-6
        g.strokeStyle = ahead ? 'rgba(128,148,168,0.22)' : bar ? 'rgba(234,242,248,0.8)' : 'rgba(128,148,168,0.6)'
        g.beginPath()
        g.moveTo(x, mid - len / 2)
        g.lineTo(x, mid + len / 2)
        g.stroke()
        if (bar) {
          g.font = '500 20px "JetBrains Mono", monospace'
          g.textAlign = 'center'
          g.fillStyle = ahead ? 'rgba(128,148,168,0.3)' : 'rgba(128,148,168,0.85)'
          g.fillText(String(k / 20 + 1).padStart(2, '0'), x, mid + 86)
        }
      }
      g.strokeStyle = 'rgba(61,225,240,0.5)'
      g.beginPath()
      g.moveTo(0, mid)
      g.lineTo(now, mid)
      g.stroke()
      g.strokeStyle = '#3DE1F0'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(now, mid - 78)
      g.lineTo(now, mid + 78)
      g.stroke()
      g.fillStyle = '#3DE1F0'
      g.beginPath()
      g.moveTo(now - 9, mid - 92)
      g.lineTo(now + 9, mid - 92)
      g.lineTo(now, mid - 78)
      g.closePath()
      g.fill()
    }

    const chrome = AD.chromeAt(T)
    s.bug.el.style.opacity = chrome.bug.toFixed(4)
    // While the brand scene draws the full-size lockup (4 s until it lands on
    // this corner at frame 178) the bug steps aside, so there is one logo on screen.
    const frame = Math.round(T * AD.fps)
    s.bug.el.style.visibility = frame >= 4 * AD.fps && frame < 178 ? 'hidden' : 'visible'

    // The hook scene owns a giant clock that docks here at 2.6 s.
    s.clock.style.opacity = T >= 2.6 ? '1' : '0'
    s.time.textContent = AD.kit.clock(T)

    // At 50 s the band switches to the full warning in a single frame: there
    // is never a frame where the warning is missing, faded or half-grown.
    const full = T >= 50
    const rect = full ? L.bandFull : L.band
    s.band.style.top = rect.y + 'px'
    s.band.style.height = rect.h + 'px'
    s.short.style.visibility = full ? 'hidden' : 'visible'
    s.full.style.visibility = full ? 'visible' : 'hidden'
  },
})
