/* S07 — the drop and the thesis (16.0–18.0 s, bar 9).
 *
 * "PRECISION, / NOT PREDICTION." at the largest type size in the film, set on
 * the bar line after half a beat of void. A caliper clamps the word PRECISION
 * and a tick ruler runs beneath it; a ghost of the S05 fan appears behind
 * PREDICTION and dissolves; a slow seeded particle field drifts over the
 * blueprint grid; the chapter index ticks in at the foot. The last 8 frames
 * wipe the type away to the left, ready for the "01" slam of S08.
 *
 * Landscape sets the thesis on two lines fitted to the content width; the two
 * portrait formats break it into three lines so the type can be far larger.
 */
AD.defineScene('thesis', {
  css: `
    .scene--thesis .th-lift { position: absolute; inset: 0; background: var(--hairline); opacity: 0; }
    .scene--thesis .th-type { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    /* Start far above the display tier; kit.headline shrinks the block until its longest line fits. */
    .scene--thesis .k-headline { font-size: 460px; line-height: var(--th-lh, 0.98); }
    /* Extra room below the baseline so the comma is not clipped by the reveal mask. */
    .scene--thesis .k-headline .ln { padding-bottom: 0.16em; margin-bottom: -0.16em; }
    .scene--thesis .th-rule { position: absolute; height: 1px; background: var(--grey); opacity: 0.55; }
  `,

  build(root, ctx) {
    const { el, svg } = AD
    const kit = AD.kit
    const c = ctx.content
    const W = ctx.W
    const H = ctx.H
    const stacked = !ctx.landscape
    const lines = stacked ? ['PRECISION,', 'NOT', 'PREDICTION.'] : ['PRECISION,', 'NOT PREDICTION.']
    root.style.setProperty('--th-lh', stacked ? '1' : '0.98')

    const lift = el('div', 'th-lift', root)
    kit.grid(root)
    const field = AD.canvas(root) // particle field + ghost fan, behind the type

    // ── chapter index at the foot of the stage ───────────────────────────
    // Built with the kit's chapter tab (same look as the tabs of S08–S10) but revealed here with
    // shorter fades than tab.show(), so all three items are complete well before the type leaves.
    const tabs = [['01', 'SEE'], ['02', 'SET'], ['03', 'TRACE']].map(([n, ttl]) => {
      const tb = kit.chapterTab(root, n, ttl)
      return { el: tb.el, num: tb.el.querySelector('.num'), rule: tb.el.querySelector('.rule'), ttl: tb.el.querySelector('.ttl') }
    })
    const tabH = Math.ceil(Math.max(...tabs.map(tb => tb.el.getBoundingClientRect().height)))
    const column = ctx.vertical // 9:16 stacks the index at the left
    const rowGap = 14
    const indexH = column ? tabH * 3 + rowGap * 2 : tabH
    const indexTop = c.y + c.h - indexH
    tabs.forEach((tb, i) => {
      tb.el.style.left = (column ? c.x : c.x + (i * c.w) / 3) + 'px'
      tb.el.style.top = (column ? indexTop + i * (tabH + rowGap) : indexTop) + 'px'
    })
    const ruleY = indexTop - ctx.pick({ '9x16': 16, default: 20 })
    const rule = el('div', 'th-rule', root)
    rule.style.left = c.x + 'px'
    rule.style.top = ruleY + 'px'

    // ── the thesis ───────────────────────────────────────────────────────
    const type = el('div', 'th-type', root)
    const h = kit.headline(type, lines, { tier: 'display', x: c.x, y: 0, w: c.w })
    const fs = parseFloat(getComputedStyle(h.el).fontSize)
    // Font metrics: cap height from the face itself, baselines from a probe in each line.
    const probeCtx = document.createElement('canvas').getContext('2d')
    probeCtx.font = `600 200px "Barlow Condensed"`
    const cap = (probeCtx.measureText('H').actualBoundingBoxAscent / 200 || 0.7) * fs
    const blockTop0 = h.el.getBoundingClientRect().top
    const baseOffsets = h.lines.map(line => {
      const probe = el('span', null, line.wrap)
      probe.style.cssText = 'display:inline-block;width:0;height:0'
      const y = probe.getBoundingClientRect().bottom - blockTop0
      probe.remove()
      return y
    })
    // Centre the group (caliper beam … last baseline) between the top of the content and the index.
    const calGap = Math.round(fs * 0.085)
    const groupH = calGap + 8 + (baseOffsets[baseOffsets.length - 1] - (baseOffsets[0] - cap))
    const zoneTop = c.y
    const zoneBottom = ruleY - ctx.pick({ '16x9': 30, '9x16': 26, default: 44 })
    const capTop = Math.round(zoneTop + Math.max(0, (zoneBottom - zoneTop - groupH) / 2) + calGap + 8)
    const blockTop = Math.round(capTop - (baseOffsets[0] - cap))
    h.el.style.top = blockTop + 'px'
    const base = baseOffsets.map(o => blockTop + o)

    // Horizontal extent of a run of characters inside a line.
    const span = (lineIndex, from, to) => {
      const node = h.lines[lineIndex].inner.firstChild
      const range = document.createRange()
      range.setStart(node, from)
      range.setEnd(node, to)
      const r = range.getBoundingClientRect()
      return { l: r.left, r: r.right }
    }
    const word = span(0, 0, 9) // PRECISION, without the comma
    const predLine = lines.length - 1
    const pred = span(predLine, stacked ? 0 : 4, lines[predLine].length - 1) // PREDICTION, without the full stop

    // Caliper on PRECISION and the tick ruler beneath it.
    const cal = kit.caliper(type, { orientation: 'h' })
    const calPath = cal.el.querySelector('path')
    const rulerY = Math.round(base[0] + fs * 0.075)
    const rs = svg('svg', { class: 'k-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, type)
    const rulerEdge = svg('path', { fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linecap': 'square' }, rs)
    const rulerTicks = svg('path', { fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, opacity: 0.8 }, rs)
    const rulerFront = svg('path', { fill: 'none', stroke: 'var(--white)', 'stroke-width': 2 }, rs)
    // The ruler divides the word evenly: the tick count is a multiple of ten, so the last tick
    // is a major one exactly on the word's right edge. Positions snap to whole pixels in render.
    const rulerX0 = Math.round(word.l)
    const rulerX1 = Math.round(word.r)
    const ticks = Math.max(20, Math.round((rulerX1 - rulerX0) / (fs * 0.052) / 10) * 10)
    const pitch = (rulerX1 - rulerX0) / ticks

    // ── seeded particle field ────────────────────────────────────────────
    const r = AD.rng(1607)
    const SPAN_X = W + 80
    const SPAN_Y = H + 80
    const particles = Array.from({ length: 300 }, (_, i) => {
      const z = r()
      const angle = -0.42 + (r() - 0.5) * 0.5
      const speed = AD.lerp(7, 30, z)
      return {
        x: r() * SPAN_X,
        y: r() * SPAN_Y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: z > 0.86 ? 3 : z > 0.4 ? 2 : 1.5,
        alpha: AD.lerp(0.18, 0.72, z * z),
        accent: r() < 0.14,
        seed: i,
      }
    })

    // ── ghost fan behind PREDICTION: 24 mirrored pairs, zero drift ──────
    const fanSteps = 40
    const fanSets = [51, 52, 53].map(seed => {
      const g = AD.rng(seed * 977)
      return Array.from({ length: 24 }, () => {
        const pts = [0]
        let v = 0
        for (let i = 1; i <= fanSteps; i++) {
          v += (g() + g() + g() - 1.5) * 0.62
          // Keep every path inside the square-root envelope.
          const lim = Math.sqrt(i) * 0.96
          v = AD.clamp(v, -lim, lim)
          pts.push(v / Math.sqrt(fanSteps))
        }
        return { pts, alpha: 0.1 + g() * 0.08, die: g() }
      })
    })
    const fan = {
      x0: pred.l - fs * 0.03,
      x1: W + 20,
      y: base[predLine] - cap / 2,
      half: Math.min(fs * 0.68, ctx.pick({ '16x9': 190, default: 170 })),
    }

    const style = getComputedStyle(document.documentElement)
    const colors = { white: style.getPropertyValue('--white').trim(), grey: style.getPropertyValue('--grey').trim(), accent: style.getPropertyValue('--accent').trim() }

    return {
      lift, field, tabs, rule, type, h, cal, calPath, rulerEdge, rulerTicks, rulerFront, particles, fanSets, fan, colors,
      stacked, word, rulerY, ticks, pitch, rulerX0, rulerX1, fs, cap, capTop, calGap, base, blockTop, SPAN_X, SPAN_Y,
      blockMid: (capTop + base[base.length - 1]) / 2,
    }
  },

  render(t, ctx, s) {
    const { prog, ease, lerp } = AD
    const f = 1 / AD.fps
    const c = ctx.content
    const W = ctx.W

    // 16.0: the background lifts and falls back over three frames (a luminance ramp, not a flash).
    s.lift.style.opacity = (0.62 * (1 - prog(t, 0, 3 * f))).toFixed(4)

    // ── particles + ghost fan ────────────────────────────────────────────
    const g = s.field.ctx
    g.clearRect(0, 0, s.field.w, s.field.h)
    for (const p of s.particles) {
      const x = ((((p.x + p.vx * t) % s.SPAN_X) + s.SPAN_X) % s.SPAN_X) - 40
      const y = ((((p.y + p.vy * t) % s.SPAN_Y) + s.SPAN_Y) % s.SPAN_Y) - 40
      const twinkle = 0.62 + 0.38 * AD.noise(t * 1.6 + p.seed * 0.37, 3)
      g.globalAlpha = p.alpha * twinkle
      g.fillStyle = p.accent ? s.colors.accent : s.colors.white
      g.fillRect(Math.round(x), Math.round(y), p.size, p.size)
    }

    // The fan grows out of PREDICTION's first letter at 16.5, is re-drawn from a new
    // seed every five frames (the future never holds still), then dissolves path by path.
    const fanIn = prog(t, 0.5, 8 * f, ease.expo.out)
    if (fanIn > 0 && t < 1.55) {
      const fn = s.fan
      const set = s.fanSets[Math.min(2, Math.max(0, Math.floor((t - 0.5 + 1e-6) / (5 * f))))]
      const reach = fn.x0 + (fn.x1 - fn.x0) * fanIn
      const n = set[0].pts.length - 1
      g.lineWidth = 1.5
      // Paths fade up out of the origin so the 48 overlapping starts do not read as a bright point.
      const ink = g.createLinearGradient(fn.x0, 0, fn.x0 + s.fs * 0.9, 0)
      ink.addColorStop(0, /^#[0-9a-f]{6}$/i.test(s.colors.white) ? s.colors.white + '00' : 'transparent')
      ink.addColorStop(1, s.colors.white)
      g.strokeStyle = ink
      g.save()
      g.beginPath()
      g.rect(0, 0, reach, s.field.h)
      g.clip()
      set.forEach((path, j) => {
        const alive = 1 - prog(t, 1.0 + path.die * 0.3, 4 * f)
        if (alive <= 0) return
        for (const sign of [1, -1]) {
          g.globalAlpha = path.alpha * alive * 1.25
          g.beginPath()
          for (let i = 0; i <= n; i++) {
            const x = fn.x0 + ((fn.x1 - fn.x0) * i) / n
            const y = fn.y + sign * path.pts[i] * fn.half
            if (i === 0) g.moveTo(x, y)
            else g.lineTo(x, y)
          }
          g.stroke()
        }
      })
      // Dashed envelope.
      const env = 1 - prog(t, 1.0, 10 * f)
      if (env > 0) {
        g.globalAlpha = 0.3 * env
        g.strokeStyle = s.colors.grey
        g.setLineDash([8, 9])
        for (const sign of [1, -1]) {
          g.beginPath()
          for (let i = 0; i <= 48; i++) {
            const u = i / 48
            const x = fn.x0 + (fn.x1 - fn.x0) * u
            const y = fn.y + sign * Math.sqrt(u) * fn.half
            if (i === 0) g.moveTo(x, y)
            else g.lineTo(x, y)
          }
          g.stroke()
        }
        g.setLineDash([])
      }
      g.restore()
    }
    g.globalAlpha = 1

    // ── type: first hit on 16.0, second on 16.5, six frames each ─────────
    // Each rise starts one frame early so the line is already most of the way up on its beat.
    const at = s.stacked ? [-f, 0.5 - f, 0.5 - f] : [-f, 0.5 - f]
    s.h.show(t, { at, dur: 6 * f })

    // Last 8 frames: the type scales to 90% about its left edge and wipes away to the left.
    // The scale is applied as geometry (font size and whole-pixel coordinates), not as a CSS
    // transform, so strokes stay 2 px and the frame does not depend on how it was reached.
    const exit = prog(t, ctx.dur - 8 * f, 8 * f)
    const out = ease.cubic.inOut(exit)
    const k = lerp(1, 0.9, out)
    const sx = x => Math.round(c.x + (x - c.x) * k)
    const sy = y => Math.round(s.blockMid + (y - s.blockMid) * k)
    s.h.el.style.fontSize = (s.fs * k).toFixed(2) + 'px'
    s.h.el.style.top = sy(s.blockTop) + 'px'
    s.type.style.clipPath = exit > 0 ? `inset(0px ${W - Math.round(lerp(W, c.x - 80, out))}px 0px 0px)` : 'none'

    // 17.0: the jaws close on PRECISION and the ruler ticks ripple left to right.
    const close = prog(t, 1.0 - f, 6 * f, ease.snap)
    const pad = Math.round(s.fs * 0.036)
    const detent = t >= 1.0 + 4 * f - 1e-6 && t < 1.0 + 7 * f - 1e-6
    s.cal.set({
      a: sx(s.rulerX0 - pad),
      b: sx(s.rulerX1 + pad),
      pos: sy(s.capTop - s.calGap),
      open: 1 - Math.round((1 - close) * 56) / 56,
      jaw: Math.round((s.calGap + s.cap * 0.44) * k),
    })
    // Detent: the caliper reads white for three frames as it seats (no glow filter).
    s.calPath.setAttribute('stroke', detent ? 'var(--white)' : 'var(--accent)')

    const ripple = prog(t + 1e-6, 1.0, 12 * f) // done on the frame at 17.4
    const x0 = s.rulerX0
    const y0 = sy(s.rulerY)
    const edge1 = Math.round(x0 + (s.rulerX1 - x0) * ripple)
    const tickLen = i => s.fs * (i % 10 === 0 ? 0.074 : i % 5 === 0 ? 0.05 : 0.028) * k
    let settled = ''
    let leading = ''
    for (let i = 0; ripple > 0 && i <= s.ticks; i++) {
      const x = Math.round(x0 + i * s.pitch)
      if (x > edge1) break
      const fresh = ripple < 1 && edge1 - x < 3 * s.pitch
      const seg = `M${sx(x)},${y0} l0,${Math.round(tickLen(i) * (fresh ? 1.5 : 1))} `
      if (fresh) leading += seg
      else settled += seg
    }
    s.rulerTicks.setAttribute('d', settled)
    s.rulerFront.setAttribute('d', leading)
    s.rulerEdge.setAttribute('d', ripple > 0 ? `M${sx(x0)},${y0} L${sx(edge1)},${y0}` : '')

    // ── 17.0: the chapter index ticks in with the caliper, three frames apart ──
    // Every item is at full strength by 17.37, eleven frames before the type starts to leave.
    s.rule.style.width = Math.round(c.w * prog(t, 1.0 - f, 8 * f, ease.snap)) + 'px'
    s.tabs.forEach((tb, i) => {
      const a = 1.0 + i * 3 * f
      tb.num.style.opacity = prog(t, a - f, 3 * f).toFixed(4)
      tb.rule.style.transform = `scaleX(${prog(t, a, 4 * f, ease.snap).toFixed(4)})`
      tb.ttl.style.opacity = prog(t, a + f, 4 * f).toFixed(4)
      tb.ttl.style.transform = `translateX(${Math.round((1 - prog(t, a + f, 4 * f, ease.snap)) * 14)}px)`
      // As the type leaves, the first chapter stays lit and the other two stand back a little.
      tb.el.style.opacity = (i === 0 ? 1 : lerp(1, 0.55, exit)).toFixed(4)
    })
  },
})
