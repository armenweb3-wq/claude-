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
      background: rgba(11, 17, 25, 0.95);
      border: 2px solid rgba(234, 242, 248, 0.62);
      border-radius: 4px;
    }
    .chrome-band .txt { position: absolute; left: 0; top: 0; right: 0; box-sizing: border-box; color: var(--white); font-family: var(--font-text); font-weight: 400; }
    .chrome-band .txt b { font-weight: 600; }
    .chrome-ruler { position: absolute; }
    .chrome-ruler .lbl { position: absolute; top: 20px; font: 500 16px var(--font-mono); color: var(--grey); letter-spacing: 0.1em; }
    .chrome-ambient { position: absolute; left: 0; opacity: 0.6; }
  `,
  build(root, ctx) {
    const L = ctx.layout
    const kit = AD.kit

    // Vertical only: the lower third sits under the apps' own buttons, so it
    // carries no message, just a quiet market trace that never stops moving.
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
    const band = AD.el('div', 'chrome-band k-riskband', root)
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
      const { g, w, h } = s.ambient
      const now = Math.round(w * 0.8)
      const SPAN = 9 // seconds of history across the trace
      const value = time => AD.fbm(time * 0.8, 77, 4) * 0.8 + AD.fbm(time * 4.5, 91, 2) * 0.14
      const yOf = v => h * 0.5 - v * h * 0.36
      g.clearRect(0, 0, w, h)
      g.lineWidth = 1
      g.strokeStyle = 'rgba(128,148,168,0.16)'
      g.beginPath()
      for (let i = 0; i <= 4; i++) {
        const y = Math.round((h * i) / 4) + 0.5
        g.moveTo(0, y)
        g.lineTo(w, y)
      }
      // Vertical ticks scroll with time: one per beat, taller on the bar.
      for (let k = Math.ceil((T - SPAN) / AD.beat); k * AD.beat <= T; k++) {
        const x = Math.round(now - ((T - k * AD.beat) / SPAN) * now) + 0.5
        g.moveTo(x, h)
        g.lineTo(x, h - (k % 4 === 0 ? 22 : 10))
      }
      g.stroke()
      g.lineWidth = 2
      g.lineJoin = 'round'
      g.strokeStyle = 'rgba(61,225,240,0.62)'
      g.beginPath()
      for (let x = 0; x <= now; x += 3) {
        const y = yOf(value(T - (1 - x / now) * SPAN))
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      const yNow = yOf(value(T))
      g.lineTo(now, yNow)
      g.stroke()
      g.setLineDash([6, 8])
      g.lineWidth = 1
      g.strokeStyle = 'rgba(234,242,248,0.4)'
      g.beginPath()
      g.moveTo(now, Math.round(yNow) + 0.5)
      g.lineTo(w, Math.round(yNow) + 0.5)
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#EAF2F8'
      g.beginPath()
      g.arc(now, yNow, 5, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(61,225,240,0.7)'
      g.lineWidth = 2
      g.beginPath()
      g.arc(now, yNow, 12, 0, Math.PI * 2)
      g.stroke()
    }

    const chrome = AD.chromeAt(T)
    s.bug.el.style.opacity = chrome.bug.toFixed(4)

    // The hook scene owns a giant clock that docks here at 2.6 s.
    s.clock.style.opacity = T >= 2.6 ? '1' : '0'
    s.time.textContent = AD.kit.clock(T)

    // From 50 s the band grows upward and switches to the full warning.
    const grow = AD.prog(T, 50, 0.5, AD.ease.glide)
    const top = AD.lerp(L.band.y, L.bandFull.y, grow)
    s.band.style.top = top.toFixed(2) + 'px'
    s.band.style.height = (L.band.y + L.band.h - top).toFixed(2) + 'px'
    s.short.style.opacity = (1 - AD.prog(T, 50, 0.2)).toFixed(4)
    s.full.style.opacity = AD.prog(T, 50.3, 0.25).toFixed(4)
  },
})
