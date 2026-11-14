/* S05 "the honest fan" (10-14 s): a price line is drawn up to a NOW marker;
 * beyond it the future is a perfectly symmetric cone of faint ghost paths that
 * is thrown away and re-drawn from a new seed on every beat. No path is ever
 * highlighted and the history ends level with where it began: this is a
 * statement that the next price is unknowable, never a forecast.
 *
 * The price stage (grid, history line, NOW marker, reticle, time ruler, tag)
 * is shared with S06, which pushes in on the NOW point. Both scenes build it
 * with AD.fanStage() and S06 starts from stage.rest, the exact state this
 * scene ends in, so the cut at 14.0 is seamless. S04 reads AD.fanGeo() to
 * collapse its map onto the level this scene's line starts from.
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { clamp, lerp, prog, ease } = AD

  const HIST_STEPS = 96 // points in the history line
  const HIST_SEED = 2912 // chosen for an even wander above and below the level
  const FAN_STEPS = 72 // points in each ghost path
  const FAN_PAIRS = 24 // mirrored pairs = 48 ghost paths
  const FAN_SETS = 5 // one set per beat from 10.5 s
  const ENVELOPE = 2.3 // dashed envelope, in standard deviations of the walk
  const RETICLE_R = 26

  const gaussian = r => (r() + r() + r() + r() - 2) * Math.sqrt(3)

  /** Zero-drift walk pinned at both ends (a bridge): values in -1..1, first and last exactly 0. */
  function history() {
    const r = AD.rng(HIST_SEED)
    const walk = [0]
    for (let i = 1; i <= HIST_STEPS; i++) walk.push(walk[i - 1] + gaussian(r))
    const bridge = walk.map((v, i) => v - (i / HIST_STEPS) * walk[HIST_STEPS])
    const peak = Math.max(...bridge.map(Math.abs))
    return bridge.map(v => v / peak)
  }

  /**
   * One set of ghost futures: FAN_PAIRS driftless walks from 0, in units of
   * the envelope's far-end height. Each is drawn twice, as v and as -v, so the
   * cone is symmetric about the last price by construction.
   */
  function fanSet(index) {
    const r = AD.rng(7001 + index * 977)
    const paths = []
    while (paths.length < FAN_PAIRS) {
      const v = new Float32Array(FAN_STEPS + 1)
      let w = 0
      let inside = true
      for (let k = 1; k <= FAN_STEPS && inside; k++) {
        w += gaussian(r)
        inside = Math.abs(w) < 0.95 * ENVELOPE * Math.sqrt(k)
        v[k] = w / (ENVELOPE * Math.sqrt(FAN_STEPS))
      }
      if (inside) paths.push({ v, alpha: 0.1 + 0.08 * r() })
    }
    return paths
  }

  /** Nearest line of the 48 px engineering grid (kit.grid is centred on the frame). */
  const gridLine = (v, size) => {
    const first = ((size - 48) / 2) % 48
    return first + Math.round((v - first) / 48) * 48
  }

  /**
   * Geometry shared by S04 (collapse target), S05 and S06, per format.
   * nowX / level: the NOW point, snapped to grid lines. half: cone half-height
   * at the frame's right edge. amp: largest excursion of the history line.
   * focus: where S06's push-in brings the NOW point. frames: S06 bracket sizes.
   */
  AD.fanGeo = function (ctx) {
    const c = ctx.content
    const g = ctx.pick({
      '16x9': { nowX: gridLine(c.x + c.w * 0.55, ctx.W), level: gridLine(c.y + c.h / 2 + 48, ctx.H), half: 244, amp: 88, frames: [[680, 380], [440, 270], [200, 200]] },
      '9x16': { nowX: gridLine(c.x + c.w / 2, ctx.W), level: gridLine(c.y + 420, ctx.H), half: 226, amp: 82, frames: [[600, 436], [400, 300], [190, 190]] },
      '4x5': { nowX: ctx.W / 2, level: gridLine(c.y + 610, ctx.H), half: 346, amp: 112, frames: [[760, 640], [500, 420], [220, 220]] },
    })
    g.focus = { x: ctx.landscape ? c.x + c.w / 2 : g.nowX, y: g.level }
    g.rulerY = c.y + c.h
    // 16:9 runs the NOW hairline up beside the headline; portrait formats stop it below the headline.
    g.hairTop = ctx.landscape ? c.y + 14 : g.level - g.half + 18
    return g
  }

  /**
   * Builds the price stage into `root` and returns { geo, grid, rest, draw }.
   * draw(o) paints one frame from the options alone (see `rest` for the keys).
   */
  AD.fanStage = function (root, ctx) {
    const { W, H } = ctx
    const c = ctx.content
    const geo = AD.fanGeo(ctx)
    const css = getComputedStyle(document.documentElement)
    const token = name => css.getPropertyValue('--' + name).trim()
    const COL = { void: token('void'), white: token('white'), grey: token('grey'), accent: token('accent') }

    const grid = AD.kit.grid(root)
    grid.style.transformOrigin = '0 0'
    const g = AD.canvas(root).ctx

    // The NOW chip is painted on the canvas with everything else that moves: a DOM
    // chip that slides during S06's pan is re-rastered a shade differently depending
    // on the frame shown before it, which would break frame-by-frame determinism.
    const tagSize = parseFloat(token('t-tag'))
    const chipFont = `600 ${tagSize}px ${token('font-mono')}`
    const chipTrack = tagSize * 0.14
    g.font = chipFont
    g.letterSpacing = chipTrack.toFixed(2) + 'px'
    const chipW = Math.ceil(g.measureText('NOW').width - chipTrack) + 22
    const chipH = tagSize + 12
    g.letterSpacing = '0px'
    const chipTop = geo.rulerY - 22 - chipH
    AD.kit.tag(root, undefined, { x: c.x, y: chipTop })

    const hist = history()
    const fans = Array.from({ length: FAN_SETS }, (_, i) => fanSet(i))
    const fanW = W - geo.nowX

    // The state S05 ends in and S06 starts from.
    const rest = {
      zoom: 1, // camera scale about the NOW point
      cx: geo.nowX, // where the NOW point sits on screen
      cy: geo.level,
      draw: 1, // how much of the history line is drawn, 0..1
      histAlpha: 1,
      flat: 0, // brightness of the flat line the scene opens on (S04's collapsed map)
      fan: null, // { set, grow 0..1, alpha }
      reticle: 1, // progress of the reticle landing on the NOW point, 0..1
      pulse: 0, // progress of a ring pulse leaving the NOW point, 0..1
      hairTop: geo.hairTop, // top end of the NOW hairline
    }

    function draw(options) {
      const o = { ...rest, ...options }
      const X = x => o.cx + (x - geo.nowX) * o.zoom
      const Y = y => o.cy + (y - geo.level) * o.zoom
      const still = o.zoom === 1 && o.cx === geo.nowX && o.cy === geo.level
      grid.style.transform = still ? 'none' : `translate(${(o.cx - geo.nowX * o.zoom).toFixed(3)}px,${(o.cy - geo.level * o.zoom).toFixed(3)}px) scale(${o.zoom.toFixed(5)})`

      g.clearRect(0, 0, W, H)
      g.lineJoin = 'round'
      g.lineCap = 'butt'
      const yLevel = o.cy

      // Level reference: the price the history starts and ends on, and the cone's axis.
      g.globalAlpha = 0.34
      g.fillStyle = COL.grey
      g.fillRect(0, yLevel, W, 1)

      // Time ruler along the foot of the stage; the future side is fainter.
      const step = 24 * o.zoom
      g.fillStyle = COL.grey
      for (let n = Math.ceil((c.x - o.cx) / step); o.cx + n * step <= c.x + c.w; n++) {
        const major = n % 4 === 0
        g.globalAlpha = n > 0 ? 0.32 : 0.75
        g.fillRect(Math.round(o.cx + n * step), geo.rulerY - (major ? 12 : 6), 1, major ? 12 : 6)
      }

      // The future: a symmetric cone of ghost paths inside a dashed envelope.
      if (o.fan && o.fan.alpha > 0 && o.fan.grow > 0) {
        const reach = clamp(o.fan.grow) * FAN_STEPS
        const last = Math.floor(reach)
        const frac = reach - last
        const fx = k => X(geo.nowX + (k / FAN_STEPS) * fanW)
        g.lineWidth = 1.5
        g.strokeStyle = COL.white
        for (const path of fans[o.fan.set]) {
          g.globalAlpha = clamp(path.alpha * o.fan.alpha)
          for (const side of [1, -1]) {
            g.beginPath()
            g.moveTo(fx(0), yLevel + 1)
            for (let k = 1; k <= last; k++) g.lineTo(fx(k), yLevel + 1 - side * path.v[k] * geo.half * o.zoom)
            if (frac > 0 && last < FAN_STEPS) g.lineTo(fx(reach), yLevel + 1 - side * lerp(path.v[last], path.v[last + 1], frac) * geo.half * o.zoom)
            g.stroke()
          }
        }
        g.lineWidth = 1
        g.strokeStyle = COL.grey
        g.globalAlpha = clamp(0.8 * Math.min(1, o.fan.alpha))
        g.setLineDash([7, 7])
        for (const side of [1, -1]) {
          g.beginPath()
          for (let i = 0; i <= 96; i++) {
            const u = (i / 96) * (reach / FAN_STEPS)
            const px = X(geo.nowX + u * fanW)
            const py = yLevel + 1 - side * Math.sqrt(u) * geo.half * o.zoom
            if (i === 0) g.moveTo(px, py)
            else g.lineTo(px, py)
          }
          g.stroke()
        }
        g.setLineDash([])
      }

      // The flat line the scene opens on: not yet drawn left of NOW, fading right of it.
      const head = clamp(o.draw) * HIST_STEPS
      const headX = X((head / HIST_STEPS) * geo.nowX)
      if (o.flat > 0 || o.draw < 1) {
        g.fillStyle = COL.accent
        g.globalAlpha = 1
        if (o.draw < 1) g.fillRect(headX, yLevel, X(geo.nowX) - headX, 2)
        g.globalAlpha = clamp(o.flat)
        g.fillRect(X(geo.nowX), yLevel, W - X(geo.nowX), 2)
      }

      // History: drawn left to right at constant speed, ending level with its start.
      if (head > 0) {
        const hy = i => Y(geo.level + 1 - hist[i] * geo.amp)
        const hx = i => X((i / HIST_STEPS) * geo.nowX)
        const whole = Math.floor(head)
        g.globalAlpha = clamp(o.histAlpha)
        g.strokeStyle = COL.accent
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(hx(0), hy(0))
        for (let i = 1; i <= whole; i++) g.lineTo(hx(i), hy(i))
        let tipY = hy(whole)
        if (head > whole && whole < HIST_STEPS) {
          tipY = lerp(hy(whole), hy(whole + 1), head - whole)
          g.lineTo(headX, tipY)
        }
        g.stroke()
        // The live tip while the line is being drawn.
        if (o.draw < 1) {
          g.globalAlpha = 1
          g.fillStyle = COL.white
          g.beginPath()
          g.arc(headX, tipY, 4, 0, Math.PI * 2)
          g.fill()
        }
      }

      // NOW hairline, from the chip on the ruler up through the point.
      g.globalAlpha = 0.8
      g.fillStyle = COL.accent
      g.fillRect(Math.round(o.cx), o.hairTop, 1, chipTop - o.hairTop)
      g.fillRect(Math.round(o.cx) - 1, geo.rulerY - 14, 3, 14)
      const chipX = Math.round(o.cx + 0.5 - chipW / 2)
      g.globalAlpha = 1
      g.fillStyle = COL.void
      g.strokeStyle = COL.accent
      g.lineWidth = 1
      g.beginPath()
      g.roundRect(chipX + 0.5, chipTop + 0.5, chipW - 1, chipH - 1, 3)
      g.fill()
      g.stroke()
      g.fillStyle = COL.accent
      g.font = chipFont
      g.letterSpacing = chipTrack.toFixed(2) + 'px'
      g.textBaseline = 'middle'
      g.fillText('NOW', chipX + 11, chipTop + chipH / 2 + 1)
      g.letterSpacing = '0px'

      // The one known point, and the reticle that lands on it.
      if (o.draw >= 1) {
        g.globalAlpha = 1
        g.fillStyle = COL.white
        g.beginPath()
        g.arc(o.cx + 0.5, yLevel + 1, 5, 0, Math.PI * 2)
        g.fill()
      }
      const ring = (radius, alpha) => {
        g.globalAlpha = clamp(alpha)
        g.strokeStyle = COL.accent
        g.lineWidth = 2
        const gap = (11 * Math.PI) / 180
        for (let i = 0; i < 4; i++) {
          g.beginPath()
          g.arc(o.cx + 0.5, yLevel + 1, radius, (i * Math.PI) / 2 - Math.PI / 4 + gap, (i * Math.PI) / 2 + Math.PI / 4 - gap)
          g.stroke()
        }
      }
      if (o.reticle > 0) ring(RETICLE_R * lerp(3, 1, ease.expo.out(clamp(o.reticle))), o.reticle * 4)
      if (o.pulse > 0 && o.pulse < 1) {
        g.globalAlpha = (1 - o.pulse) * 0.7
        g.strokeStyle = COL.accent
        g.lineWidth = 2
        g.beginPath()
        g.arc(o.cx + 0.5, yLevel + 1, RETICLE_R + 6 + o.pulse * 34, 0, Math.PI * 2)
        g.stroke()
      }
      g.globalAlpha = 1
    }

    return { geo, grid, rest, draw }
  }

  // Shared by S05 and S06. No layer hint on headline lines: a hinted layer keeps
  // the sub-pixel raster of whichever frame painted it first.
  const STAGE_CSS = id => `.scene--${id} .k-headline .ln > span { will-change: auto; }`
  AD.fanStage.css = STAGE_CSS

  AD.defineScene('fan', {
    css: STAGE_CSS('fan'),
    build(root, ctx) {
      const c = ctx.content
      const stage = AD.fanStage(root, ctx)
      // 16:9 sets the headline over the history side; portrait formats use the full box above the chart.
      const w = ctx.landscape ? stage.geo.nowX - c.x - 60 : c.w
      const a = AD.kit.headline(root, ['NO ONE CAN PREDICT', 'THE NEXT PRICE.'], { tier: 'display', x: c.x, y: c.y, w })
      const b = AD.kit.headline(root, ['NOT YOU. NOT US.'], { tier: 'display', x: c.x, y: c.y, w })
      return { stage, a, b }
    },
    render(t, ctx, s) {
      // Ghost futures: grown 10.5-11.0, re-seeded on 11.0, 11.5, 12.0, 12.5, gone by 13.33.
      const set = t < 1 ? 0 : Math.min(FAN_SETS - 1, Math.floor((t - 1) / 0.5) + 1)
      const sinceSwap = t < 1 ? 1 : t - (1 + (set - 1) * 0.5)
      const settle = 1 + 0.9 * (1 - prog(sinceSwap, 0, 4 / 30)) // one bright frame, then a 4-frame settle
      const fade = 1 - prog(t, 3, 1 / 3)
      s.stage.draw({
        draw: prog(t, 0, 0.5),
        flat: 1 - prog(t, 0, 0.5),
        fan: t > 0.5 && fade > 0 ? { set, grow: prog(t, 0.5, 0.5, ease.expo.out), alpha: fade * settle } : null,
        reticle: prog(t, 3, 1 / 3),
        pulse: prog(t, 3.5, 0.4),
      })

      // Headline: line pair rises on the cut, then a hard swap on the bar line at 12.0.
      s.a.show(t, { at: -1 / 30, each: 0.1 })
      s.a.el.style.visibility = t < 2 ? 'visible' : 'hidden'
      s.b.show(t, { at: 2, dur: 0 })
    },
  })
})()
