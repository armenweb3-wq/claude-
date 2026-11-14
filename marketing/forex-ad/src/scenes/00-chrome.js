/* Persistent overlay, on screen for all 60 seconds: brand bug, running clock,
 * the risk-warning band (abbreviated wording until 50 s, full wording after),
 * a 30-bar ruler in the non-critical strip, and a fine grain that keeps dark
 * gradients from banding after video compression.
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
    .chrome-grain { position: absolute; inset: 0; opacity: 0.055; mix-blend-mode: overlay; background-size: 256px 256px; }
  `,
  build(root, ctx) {
    const L = ctx.layout
    const kit = AD.kit

    // Grain: three seeded noise tiles, cycled by frame.
    const grains = [11, 23, 37].map(seed => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const g = c.getContext('2d')
      const img = g.createImageData(256, 256)
      const r = AD.rng(seed)
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(r() * 256)
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v
        img.data[i + 3] = 255
      }
      g.putImageData(img, 0, 0)
      const layer = AD.el('div', 'chrome-grain', root)
      layer.style.backgroundImage = `url(${c.toDataURL()})`
      return layer
    })

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
    return { grains, done, head, bug, clock, time, band, short: mk('short'), full: mk('full'), rulerW: L.ruler.w }
  },
  render(t, ctx, s, T) {
    const L = ctx.layout
    const frame = Math.round(T * AD.fps)
    s.grains.forEach((g, i) => (g.style.display = frame % 3 === i ? 'block' : 'none'))

    const x = (T / AD.duration) * s.rulerW
    s.done.setAttribute('stroke-dashoffset', (1 - T / AD.duration).toFixed(5))
    s.head.setAttribute('transform', `translate(${x.toFixed(2)},0)`)

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
