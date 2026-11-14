/* Opening sequence, part 1 of 3: the hook (0-2 s).
 *
 * "ONE SECOND." over a giant running clock. A playhead crosses a ruler in
 * exactly thirty frames, a caliper clamps the span and reads "1.000 s", and
 * the second line opens the loop: "WATCH WHAT FITS INSIDE IT."
 *
 * The three opening scenes are about one object, "the second": a ruler whose
 * end stops are one second apart. The hook measures it, `inside` (02) opens it
 * up and `brand` (03) turns the price ticks found in it into the logo mark.
 * Its geometry, data and drawing code live here as AD.opening, so both sides
 * of the cuts at 2.0 s and 4.0 s are drawn by the same code from the same
 * numbers. (02 and 03 therefore need this file to be loaded first.)
 *
 * The giant clock is not drawn here: it belongs to `inside` (lead: 2), because
 * its dock into the corner runs across the 2.0 s cut and has to stay above
 * that scene's vignette to hand over to the overlay clock without a jump.
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { clamp, lerp, prog, ease } = AD

  // ── illustrative ticks ──────────────────────────────────────────────────
  // Fourteen EUR/USD price changes inside the measured second, as offsets from
  // 1.08420 in units of 0.00001. They alternate around a mid-line half a unit
  // below 1.08420, sum to zero drift, and the last one returns to the level
  // the line came in on (LEAD), so the path ends where it started.
  const OFFSETS = [0, -2, 1, -1, 0, -3, 1, -2, 2, -1, 0, -2, 1, -1]
  const LEAD = -1
  const MID = -0.5
  const N = OFFSETS.length
  const PITCH = 0.063 // seconds between ticks; the stream is centred in the second
  const BASE = Math.round(AD.market.pair('EUR/USD').base * 1e5)
  const ticks = OFFSETS.map((off, k) => ({
    k,
    tau: 0.5 + (k - (N - 1) / 2) * PITCH,
    level: off - MID, // in units, positive = above the mid-line
    up: off > MID,
    price: ((BASE + off) / 1e5).toFixed(5),
  }))

  // ── colours for canvas work ─────────────────────────────────────────────
  let palette = null
  function colors() {
    if (palette) return palette
    const cs = getComputedStyle(document.documentElement)
    const probe = document.createElement('canvas').getContext('2d')
    const rgb = name => {
      probe.fillStyle = '#000'
      probe.fillStyle = cs.getPropertyValue('--' + name).trim()
      const n = parseInt(probe.fillStyle.slice(1), 16)
      return [n >> 16, (n >> 8) & 255, n & 255]
    }
    palette = { accent: rgb('accent'), white: rgb('white'), grey: rgb('grey'), void: rgb('void') }
    return palette
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(4)})`

  // ── geometry ────────────────────────────────────────────────────────────
  // Zoom level 0 is the hook's ruler, 1 and 2 are the two steps of the dive.
  // `band` rows are [top - content.y, height] of the ruler band at each level.
  // The second line ("WATCH WHAT FITS INSIDE IT.") stays up for nine frames
  // after the 2.0 s cut (drawn by `inside` from then on), so it must be clear of
  // the clock's path to the corner and of the band at level 1: in landscape it
  // sits under the headline and the clock shrinks away from it, in portrait it
  // sits under the ruler as a caption and the band's first step opens upwards.
  const cache = {}
  function geo(ctx) {
    if (cache[ctx.format]) return cache[ctx.format]
    const c = ctx.content
    const P = ctx.pick({
      '16x9': {
        head: ['ONE SECOND.'], hero: 148, heroFill: 1,
        line2Tier: 'h2', line2Y: 147,
        clockBase: 420, utcBase: 0, utcScale: 0.42,
        band: [[564, 30], [402, 196], [316, 322]], mid: [125, 176], unit: [10, 26],
        pitch: 124, focus: 0.5, dot: 7, price: 24, gauge: 0.8,
      },
      '9x16': {
        head: ['ONE SECOND.'], hero: 150, heroFill: 0.9,
        line2Tier: 'display', line2Y: 591,
        clockBase: 281, utcBase: 335, utcScale: 1.7,
        band: [[501, 40], [340, 238], [346, 366]], mid: [140, 204], unit: [12, 33],
        pitch: 83, focus: ticks[6].tau, dot: 7, price: 24, gauge: 0.6,
      },
      '4x5': {
        head: ['ONE', 'SECOND.'], hero: 226, heroFill: 0.9,
        line2Tier: 'display', line2Y: 854,
        clockBase: 565, utcBase: 635, utcScale: 2.1,
        band: [[776, 36], [470, 368], [400, 560]], mid: [226, 300], unit: [26, 56],
        pitch: 86, focus: ticks[6].tau, dot: 8, price: 26, gauge: 0.6,
      },
    })
    const span0 = c.w
    const span2 = P.pitch / PITCH
    const xf0 = c.x + P.focus * span0
    const xf2 = ctx.landscape ? ctx.W / 2 : c.x + c.w / 2

    /** The second on screen at zoom z (0..2). The horizontal push-in is all in step one. */
    function view(z) {
      const zh = clamp(z)
      const zv = clamp(z - 1)
      const span = span0 * Math.pow(span2 / span0, zh)
      const xa = lerp(xf0, xf2, zh) - P.focus * span
      const i = z < 1 ? 0 : 1
      const f = clamp(z - i)
      const top = c.y + lerp(P.band[i][0], P.band[i + 1][0], f)
      const h = lerp(P.band[i][1], P.band[i + 1][1], f)
      return {
        xa, xb: xa + span, span, top, h,
        mid: top + (z < 1 ? lerp(P.band[0][1] / 2, P.mid[0], zh) : lerp(P.mid[0], P.mid[1], zv)),
        unit: lerp(P.unit[0], P.unit[1], zv),
        r: P.dot * lerp(0.82, 1, zv),
      }
    }
    const dot = (k, V) => ({ x: V.xa + ticks[k].tau * V.span, y: V.mid - ticks[k].level * V.unit })
    const g = {
      P, view, dot, ticks,
      lead: LEAD - MID, // level the price line comes in on, and ends on
      ext: 12, // end stops reach this far beyond the band
      calGap: 46, // caliper beam above the band top
      jaw: 30,
    }
    cache[ctx.format] = g
    return g
  }

  // ── drawing the second ──────────────────────────────────────────────────
  /**
   * Draws the ruler band on a 2-D context. V is a view from geo.view() (xa, xb,
   * span, top, h). o:
   *   fill      alpha of the accent tint between the left stop and fillTo (0..1 of the span)
   *   head      playhead position 0..1 of the span, or null
   *   tail      0..1 strength of the comet tail behind a moving playhead
   *   major     k => 0..1 draw-on of the 100 ms tick k (1..9); majorLen its length in px
   *   minor     j => 0..1 draw-on of the 10 ms tick j (1..99); minorLen its length in px
   *   gridA     alpha of the full-height 100 ms graduations
   *   stopGlow  0..1 brightness detent on the right end stop
   *   alpha     overall opacity
   *   crisp     snap strokes to whole pixels (use when the view is at rest)
   */
  function drawSecond(g, V, o) {
    const C = colors()
    const { xa, xb, span, top, h } = V
    const W = g.canvas.width
    const bot = top + h
    const ext = o.ext === undefined ? 12 : o.ext
    const snap = o.crisp ? Math.round : v => v
    const A = o.alpha === undefined ? 1 : o.alpha
    if (A <= 0) return
    g.save()
    g.globalAlpha = A

    if (o.fill > 0 && o.fillTo > 0) {
      g.fillStyle = rgba(C.accent, o.fill)
      g.fillRect(xa, top, span * clamp(o.fillTo), h)
    }
    if (o.tail > 0 && o.head > 0) {
      const xh = xa + span * o.head
      const len = Math.min(span * 0.22, xh - xa)
      if (len > 1) {
        const grad = g.createLinearGradient(xh - len, 0, xh, 0)
        grad.addColorStop(0, rgba(C.accent, 0))
        grad.addColorStop(1, rgba(C.accent, 0.5 * o.tail))
        g.fillStyle = grad
        g.fillRect(xh - len, top, len, h)
      }
    }

    if (o.gridA > 0) {
      g.fillStyle = rgba(C.grey, 0.26 * o.gridA)
      for (let k = 1; k <= 9; k++) g.fillRect(snap(xa + (k / 10) * span), top, 1, h)
    }
    if (o.minor) {
      g.fillStyle = rgba(C.white, 0.5)
      for (let j = 1; j < 100; j++) {
        if (j % 10 === 0) continue
        const x = xa + (j / 100) * span
        if (x < -2 || x > W + 2) continue
        const p = o.minor(j)
        if (p > 0) g.fillRect(snap(x) - 1, top, 2, (j % 5 === 0 ? 1.7 : 1) * o.minorLen * p)
      }
    }
    if (o.major) {
      g.fillStyle = rgba(C.white, 0.92)
      for (let k = 1; k <= 9; k++) {
        const p = o.major(k)
        if (p > 0) g.fillRect(snap(xa + (k / 10) * span) - 1, top, 2, o.majorLen * p)
      }
    }

    // Edges: the ruler line on top, a hairline underneath.
    g.fillStyle = rgba(C.white, 0.92)
    g.fillRect(xa, snap(top) - 1, span, 2)
    g.fillStyle = rgba(C.grey, 0.7)
    g.fillRect(xa, snap(bot), span, 1)

    // Heavy end stops.
    g.fillStyle = rgba(C.white, 1)
    g.fillRect(snap(xa) - 2, top - ext, 4, h + ext * 2)
    g.fillRect(snap(xb) - 2, top - ext, 4, h + ext * 2)

    // Playhead: a cyan line with a soft halo; it comes to rest on the right stop.
    if (o.head !== null && o.head !== undefined) {
      const xh = snap(xa + span * clamp(o.head))
      g.shadowColor = rgba(C.accent, 0.9)
      g.shadowBlur = 18 + 26 * (o.stopGlow || 0)
      g.fillStyle = o.stopGlow > 0 ? rgba(C.white, 1) : rgba(C.accent, 1)
      g.fillRect(xh - 2, top - ext, 4, h + ext * 2)
      if (o.stopGlow > 0) g.fillRect(xh - 2, top - ext, 4, h + ext * 2)
      g.shadowBlur = 0
    }
    g.restore()
  }

  /** One price tick: a cyan dot with a void ring so it reads against the line under it. */
  function drawDot(g, x, y, r, alpha = 1) {
    if (r <= 0 || alpha <= 0) return
    const C = colors()
    g.beginPath()
    g.arc(x, y, r + 3, 0, Math.PI * 2)
    g.fillStyle = rgba(C.void, alpha)
    g.fill()
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = rgba(C.accent, alpha)
    g.fill()
  }

  /** The hook's second line. `inside` builds the same block to carry it across the 2.0 s cut. */
  function line2(parent, ctx) {
    const c = ctx.content
    const P = geo(ctx).P
    return AD.kit.headline(parent, ['WATCH WHAT FITS INSIDE IT.'], { tier: P.line2Tier, x: c.x, y: c.y + P.line2Y, w: c.w })
  }

  AD.opening = { geo, ticks, colors, rgba, drawSecond, drawDot, line2, N, PITCH }

  // ── scene ───────────────────────────────────────────────────────────────
  AD.defineScene('hook', {
    build(root, ctx) {
      const kit = AD.kit
      const G = geo(ctx)
      const c = ctx.content
      kit.grid(root)
      const cv = AD.canvas(root)

      // "ONE SECOND." is the one headline in the film set above the display
      // tier where the format has the room: it has to stop a scroll.
      const h1 = kit.headline(root, G.P.head, { tier: 'display', x: c.x, y: c.y, w: c.w })
      const tier = parseFloat(getComputedStyle(h1.el).fontSize)
      const size = Math.min(G.P.hero, (tier * c.w * G.P.heroFill) / h1.width)
      h1.el.style.fontSize = size.toFixed(2) + 'px'

      const h2 = line2(root, ctx)
      const labelSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-label'))
      const cal = kit.caliper(root, { labelSize })
      return { G, cv, h1, h2, cal }
    },
    render(t, ctx, s) {
      const G = s.G
      const V = G.view(0)
      const fps = AD.fps
      const f = Math.round(t * fps)

      // Headline is set from frame 0; the second line rises on the caliper's beat.
      s.h1.show(t, { at: -1 })
      s.h2.show(t, { at: 1, each: 2 / fps, dur: 8 / fps })

      // Playhead: linear, left stop to right stop in exactly 30 frames.
      const head = clamp(t)
      const g = s.cv.ctx
      g.clearRect(0, 0, ctx.W, ctx.H)
      drawSecond(g, V, {
        fill: 0.2,
        fillTo: head,
        head,
        tail: 1 - prog(t, 1, 4 / fps),
        stopGlow: f >= fps && f < fps + 2 ? 1 : 0,
        major: k => prog(t, 1.5 + (k - 2) / fps, 3 / fps, ease.snap), // first one shows on the beat frame
        majorLen: V.h,
        ext: G.ext,
        crisp: true,
      })

      s.cal.set({
        a: V.xa,
        b: V.xb,
        pos: V.top - G.calGap,
        jaw: G.jaw,
        open: prog(t, 1, 6 / fps, ease.snap),
        label: '1.000 s',
        labelGap: 14,
      })
    },
  })
})()
