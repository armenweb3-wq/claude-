/* S13 — recap burst (48–50 s). The fastest cutting in the film: four hard
 * cuts of exactly 15 frames, each a macro crop of one of the film's
 * set-pieces under one giant word.
 *
 *   48.0  SEE.    price ladder, ice bids left / amber asks right, caliper on the gap
 *   48.5  SET.    three level lines: limit (accent), entry (white), stop (amber)
 *   49.0  TRACE.  the route pulse arriving at CONFIRMATION and the receipt
 *   49.5  24/5.   dot-grid map, the light band and four session nodes joined by arcs
 *
 * The set-pieces themselves live in other scene files; these are simplified
 * macro versions drawn here with the same tokens. In every shot the word is
 * in the same place and readable on the first frame (it finishes rising
 * through its mask within three), the graphic settles from 104% to 100% over
 * the 15 frames, and all four share one dark background, so the passage cuts
 * fast without flashing.
 *
 * Drawing: each shot's line art is painted on a canvas that is cleared and
 * redrawn on every frame, so a frame cannot inherit anything from the frame
 * shown before it. (SVG with CSS filters, masks and gradients under the
 * settling scale was not repeatable: the browser reuses cached layers.)
 * Type, chips and the receipt are DOM; caliper and brackets come from the kit.
 * Only the canvases are scaled by CSS for the settle: the DOM parts stay at
 * 100% and are moved to the settling positions in whole pixels, so their
 * edges never sit on fractions of a pixel.
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { el, clamp, lerp, prog, ease } = AD
  const fr = n => n / 30

  const CUT = 0.5
  const WORDS = ['SEE.', 'SET.', 'TRACE.', '24/5.']
  const MONO = 0.6 // advance width of the mono face, in em
  const TAU = Math.PI * 2

  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
  function tokens() {
    const cs = getComputedStyle(document.documentElement)
    const out = {}
    for (const name of ['void', 'white', 'grey', 'accent', 'ice', 'amber']) {
      const h = cs.getPropertyValue('--' + name).trim().replace('#', '')
      out[name] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
    }
    return out
  }

  /** A polyline with arc-length lookup and slicing. */
  function polyline(points) {
    const segs = []
    let total = 0
    for (let i = 1; i < points.length; i++) {
      const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
      segs.push({ a: points[i - 1], b: points[i], start: total, len })
      total += len
    }
    const at = s => {
      s = clamp(s, 0, total)
      for (const g of segs) if (s <= g.start + g.len) return [lerp(g.a[0], g.b[0], g.len ? (s - g.start) / g.len : 0), lerp(g.a[1], g.b[1], g.len ? (s - g.start) / g.len : 0)]
      return points[points.length - 1]
    }
    /** Trace the part between two arc lengths into the current canvas path. */
    const trace = (k, from, to) => {
      from = clamp(from, 0, total)
      to = clamp(to, 0, total)
      if (to <= from) return false
      k.moveTo(...at(from))
      for (const g of segs) if (g.start + g.len > from && g.start + g.len < to) k.lineTo(g.b[0], g.b[1])
      k.lineTo(...at(to))
      return true
    }
    return { total, at, trace }
  }

  /**
   * Fade a canvas out before the top row and above the risk band (graphics may
   * still run off the sides). The canvas is scaled about `origin` while the
   * shot settles; the fade is placed so that it stays put on screen, which
   * keeps every frame of the settle clear of the band.
   */
  function crop(k, g, origin, zoom) {
    const at = y => origin[1] + (y - origin[1]) / zoom // screen y → canvas y
    const t0 = at(g.c.y + 4)
    const t1 = at(g.c.y + 38)
    const b0 = at(g.floor - g.soft)
    const b1 = at(g.floor)
    k.save()
    k.globalCompositeOperation = 'destination-out'
    const top = k.createLinearGradient(0, t0, 0, t1)
    top.addColorStop(0, 'rgba(0,0,0,1)')
    top.addColorStop(1, 'rgba(0,0,0,0)')
    k.fillStyle = top
    k.fillRect(0, 0, g.W, t1)
    const bot = k.createLinearGradient(0, b0, 0, b1)
    bot.addColorStop(0, 'rgba(0,0,0,0)')
    bot.addColorStop(1, 'rgba(0,0,0,1)')
    k.fillStyle = bot
    k.fillRect(0, b0, g.W, g.H - b0)
    k.restore()
  }
  const glowOn = (k, T, blur = 14) => {
    k.shadowColor = rgba(T.accent, 0.85)
    k.shadowBlur = blur
  }
  const glowOff = k => {
    k.shadowColor = 'rgba(0,0,0,0)'
    k.shadowBlur = 0
  }
  /** A ringed node: void centre, 2 px ring, centre dot. */
  function ring(k, T, x, y, R, { lit = true, hot = false } = {}) {
    k.fillStyle = rgba(T.void)
    k.beginPath()
    k.arc(x, y, R, 0, TAU)
    k.fill()
    if (lit) glowOn(k, T)
    k.lineWidth = 2
    k.strokeStyle = rgba(lit ? T.accent : T.grey)
    k.beginPath()
    k.arc(x, y, R, 0, TAU)
    k.stroke()
    k.fillStyle = rgba(hot ? T.white : lit ? T.accent : T.grey)
    k.beginPath()
    k.arc(x, y, R * 0.3, 0, TAU)
    k.fill()
    glowOff(k)
  }

  // ── SEE. — price ladder with the spread caliper ───────────────────────────
  function ladder(bg, fx, ctx, g) {
    const kit = AD.kit
    const { W, H, c, T } = g
    const fig = ctx.pick({ '16x9': 52, '9x16': 36, default: 46 })
    const pitch = ctx.pick({ '16x9': 112, '9x16': 70, default: 110 })
    const gap = ctx.pick({ '16x9': 90, '9x16': 58, default: 88 })
    const barH = Math.round(pitch * 0.8)
    const colW = Math.round(fig * MONO * 7 + fig * 1.3)
    const cx = g.wide ? Math.round(c.x + c.w * 0.675) : W / 2
    // 16:9: three rows a side, the outer ones cut by the crop. Portrait: two
    // asks and three bids fit whole between the word and the crop's fade.
    const count = { ask: g.wide ? 3 : 2, bid: 3 }
    const whole = g.floor - g.soft // rows above this line are untouched by the fade
    let cy = Math.round(c.y + c.h / 2)
    if (!g.wide) {
      const total = (count.ask + count.bid) * pitch - (pitch - barH) + gap
      cy = Math.round(g.gTop + Math.max(0, (whole - g.gTop - total) / 2) + count.ask * pitch - (pitch - barH) + gap / 2)
    }
    // Bars start at the edge of the price column, as on the ladder of 01 SEE.
    const askX = cx + colW / 2 + 1
    const bidX = cx - colW / 2 - 1
    const askMax = W + 60 - askX
    // 16:9: bid bars stop short of the word; portrait: they run off the frame.
    const bidMax = g.wide ? bidX - (g.wordRight[0] + 70) : bidX + 60
    // Illustrative quotes: the film's EUR/USD bid and ask, five pipettes a row.
    const BID = 108420
    const ASK = 108432
    const depth = { ask: [0.36, 0.7, 1], bid: [0.34, 0.62, 0.9] }

    const cv = AD.canvas(bg, W, H)
    const rows = []
    const figures = []
    for (const side of ['ask', 'bid']) {
      for (let k = 0; k < count[side]; k++) {
        const best = k === 0
        const y = side === 'ask' ? cy - gap / 2 - barH - k * pitch : cy + gap / 2 + k * pitch
        rows.push({ side, best, level: k, y, len: (side === 'ask' ? askMax : bidMax) * depth[side][k] })
        // A row the crop cuts through keeps its bar and loses its figure: no half-read prices.
        if (y < c.y + 38 || y + barH > whole) continue
        const price = el('div', 'rc-fig', fx, ((side === 'ask' ? ASK + k * 5 : BID - k * 5) / 1e5).toFixed(5))
        price.style.fontSize = fig + 'px'
        price.style.width = colW + 'px'
        price.style.color = best ? 'var(--white)' : 'var(--grey)'
        if (best) price.style.fontWeight = '700'
        figures.push({ el: price, y: y + barH / 2 })
      }
    }
    const cal = kit.caliper(fx, { orientation: 'v' })
    const origin = [cx, cy]

    return {
      origin,
      render(lt, zoom) {
        const sy = y => origin[1] + (y - origin[1]) * zoom
        for (const f of figures) f.el.style.transform = `translate(${Math.round(cx - colW / 2)}px,${Math.round(sy(f.y) - fig / 2)}px)`
        const k = cv.ctx
        k.clearRect(0, 0, W, H)
        // The gap itself, tinted flat across the ladder's width.
        k.fillStyle = rgba(T.accent, 0.11)
        k.fillRect(bidX - bidMax, cy - gap / 2, bidMax + colW + 2 + askMax, gap)
        // Depth bars extend the last fifth of their length as the shot opens.
        // Same treatment as the ladder of 01 SEE: flat fills that thin level
        // by level (best level solid), each with a hard 2 px cap at its end.
        const grow = lerp(0.8, 1, prog(lt, -fr(1), fr(8), ease.snap))
        rows.forEach(r => {
          const ask = r.side === 'ask'
          const col = ask ? T.amber : T.ice
          const len = Math.round(r.len * grow)
          const x = ask ? askX : bidX - len
          k.fillStyle = rgba(col, r.best ? 1 : (54 - 3 * r.level) / 100)
          k.fillRect(x, r.y, len, barH)
          k.fillStyle = rgba(col)
          k.fillRect(ask ? x + len - 2 : x, r.y, 2, barH)
          // The best quote's cell is tinted with its side's colour.
          if (r.best) {
            k.fillStyle = rgba(col, 0.18)
            k.fillRect(cx - colW / 2, r.y, colW, barH)
          }
        })
        crop(k, g, origin, zoom)
        cal.set({ a: sy(cy - gap / 2), b: sy(cy + gap / 2), pos: cx + (colW / 2 + 34) * zoom, jaw: (colW + 68) * zoom, open: prog(lt, -fr(2), fr(8), ease.snap) })
      },
    }
  }

  // ── SET. — entry, stop and limit ──────────────────────────────────────────
  function levels(bg, fx, ctx, g) {
    const kit = AD.kit
    const { W, H, c, T } = g
    const chipFs = ctx.pick({ '16x9': 28, '9x16': 24, default: 26 })
    const chipH = chipFs * 2
    let yE
    let D
    if (g.wide) {
      // The word stands on the entry line, with the limit just clear of its cap height.
      yE = Math.round(g.base + g.size * 0.045)
      D = Math.round(g.floor - chipH / 2 - 6 - yE)
    } else {
      yE = Math.round((g.gTop + g.floor) / 2)
      D = Math.round((g.floor - g.gTop) / 2 - chipH / 2 - 8)
    }
    const LV = [
      { label: 'LIMIT', px: '1.08682', y: yE - D, color: 'accent' },
      { label: 'ENTRY', px: '1.08432', y: yE, color: 'white', dash: [12, 8] },
      { label: 'STOP', px: '1.08182', y: yE + D, color: 'amber' },
    ]
    const cv = AD.canvas(bg, W, H)
    const chips = LV.map(lv => {
      const chip = el('div', 'rc-chip', fx)
      chip.style.color = `var(--${lv.color})`
      chip.style.fontSize = chipFs + 'px'
      chip.style.height = chipH + 'px'
      el('span', 'grip', chip)
      el('span', 'lbl', chip, lv.label)
      el('span', 'px', chip, lv.px)
      return { el: chip, y: lv.y }
    })
    const chipW = Math.ceil(Math.max(...chips.map(ch => ch.el.getBoundingClientRect().width)))
    const chipX = Math.round(g.right - chipW)
    for (const ch of chips) ch.el.style.width = chipW + 'px'

    // Monochrome candles ranging on both sides of entry, clear of both exits.
    const n = ctx.pick({ '16x9': 10, '9x16': 7, default: 8 })
    const raw = AD.market.candles({ seed: 41, n, base: 0, vol: 6, revert: 0.3 })
    const far = Math.max(...raw.map(q => Math.max(Math.abs(q.h), Math.abs(q.l))))
    const candles = raw.map(q => ({ o: (q.o / far) * 15, h: (q.h / far) * 15, l: (q.l / far) * 15, c: (q.c / far) * 15 }))
    const x0 = g.wide ? Math.round(Math.max(g.wordRight[1] + 80, c.x + c.w * 0.36)) : c.x
    const rect = { x: x0, y: yE - D, w: chipX - 44 - x0, h: 2 * D }

    const origin = [Math.round(g.wide ? (x0 + chipX) / 2 : W / 2), yE]

    return {
      origin,
      render(lt, zoom) {
        const k = cv.ctx
        k.clearRect(0, 0, W, H)
        // The last two candles print during the shot (time-driven, linear).
        kit.drawCandles(k, candles, { rect, min: -25, max: 25, count: n - 2 + 2 * clamp(lt / CUT + 0.1), alpha: 0.8 })
        k.lineWidth = 2
        for (const lv of LV) {
          k.strokeStyle = rgba(T[lv.color])
          k.setLineDash(lv.dash || [])
          k.beginPath()
          k.moveTo(-10, lv.y)
          k.lineTo(W + 10, lv.y)
          k.stroke()
        }
        k.setLineDash([])
        // The handles are anchored on the right edge of the content area: they
        // ride their lines up and down as the crop settles, never sideways,
        // and never leave the content area (the stop handle would otherwise
        // dip below it on the first frames).
        for (const ch of chips) {
          const y = clamp(origin[1] + (ch.y - origin[1]) * zoom, c.y + chipH / 2, g.floor - chipH / 2)
          ch.el.style.transform = `translate(${chipX}px,${Math.round(y - chipH / 2)}px)`
        }
      },
    }
  }

  // ── TRACE. — the pulse arrives at CONFIRMATION and the receipt ────────────
  function route(bg, fx, ctx, g) {
    const kit = AD.kit
    const { W, H, c, T } = g
    const R = ctx.pick({ '16x9': 46, '9x16': 32, default: 40 })
    const M = 14
    const font0 = ctx.pick({ '16x9': 40, '9x16': 30, default: 36 })
    let pts
    let node
    let rx
    if (g.wide) {
      // The trace underlines the word, turns up beside it and runs into the node.
      const yU = Math.round(g.base + g.size * 0.14)
      const yN = Math.round(c.y + c.h * 0.43)
      const xJ = Math.round(g.wordRight[2] + 56)
      node = [xJ + 108, yN]
      pts = [[-12, yU], [xJ, yU], [xJ, yN], [node[0], yN]]
      rx = node[0] + R + 54
    } else {
      // The trace runs in under the word, drops down the left edge to the node.
      const yT = g.gTop + ctx.pick({ '9x16': 34, default: 48 })
      const xJ = c.x + R + 4
      node = [xJ, 0]
      rx = xJ + R + ctx.pick({ '9x16': 40, default: 56 })
      pts = [[-12, yT], [xJ, yT]]
    }
    const rw = g.right - M - rx
    const font = Math.min(font0, Math.floor((rw - 2 * Math.round(font0 * 0.75)) / (22 * MONO)))
    const row = Math.round(font * 1.6)
    const padX = Math.round(font * 0.75)
    const padY = Math.round(font * 0.55)
    const ruleGap = Math.round(font * 0.45) | 1 // odd, so the 1 px rule sits on whole pixels
    const rh = padY * 2 + row * 4 + ruleGap
    if (!g.wide) {
      node[1] = Math.round(Math.max(pts[0][1] + 60 + rh / 2, (pts[0][1] + g.bottom - M) / 2 + 14))
      pts.push([node[0], node[1]])
    }
    const ry = Math.round(node[1] - rh / 2)
    const path = polyline(pts)
    const cv = AD.canvas(bg, W, H)

    // The receipt, with the same illustrative order and time-stamp as chapter 3.
    const stamp = kit.clock(window.AD_TIMELINE.scenes.find(sc => sc.id === 'trace').start + 3)
    const panel = el('div', 'rc-receipt', fx)
    panel.style.cssText += `left:0;top:0;width:${rw}px;height:${rh}px;padding:${padY - 1}px ${padX - 1}px;font-size:${font}px;line-height:${row}px`
    const hd = el('div', null, panel)
    el('span', null, hd, 'EUR/USD')
    el('span', 'c-amber', hd, '  BUY  ')
    el('span', null, hd, '0.10 LOT')
    el('div', 'rule', panel).style.margin = `${(ruleGap - 1) / 2}px 0`
    const nums = [['REQUESTED', '1.08432'], ['FILLED', '1.08433'], ['TIME', stamp, ' UTC']].map(([key, value, unit]) => {
      const line = el('div', 'row', panel)
      el('span', 'k', line, key)
      const val = el('span', null, line)
      const num = el('span', null, val, value)
      if (unit) el('span', 'u', val, unit)
      return num
    })
    const frame = kit.brackets(fx)
    const origin = [Math.round(rx + rw / 2), node[1]]

    const ARRIVE = fr(7)
    const from = path.total * (g.wide ? 0.42 : 0.2)
    const TAIL = [
      { lag: 0.2, width: 2, alpha: 0.3 },
      { lag: 0.13, width: 4, alpha: 0.45 },
      { lag: 0.07, width: 6, alpha: 0.75 },
      { lag: 0.03, width: 9, alpha: 1 },
    ]
    return {
      origin,
      render(lt, zoom) {
        const k = cv.ctx
        k.clearRect(0, 0, W, H)
        // The receipt keeps its size and follows the wire's end in whole pixels.
        const px = Math.round(origin[0] + (rx - origin[0]) * zoom)
        const py = ry
        panel.style.transform = `translate(${px}px,${py}px)`
        const pos = t => lerp(from, path.total, clamp(t / ARRIVE))
        const at = pos(lt)
        const arrived = lt >= ARRIVE - 1e-6
        const line = (a, b, style, width) => {
          k.beginPath()
          if (!path.trace(k, a, b)) return
          k.strokeStyle = style
          k.lineWidth = width
          k.stroke()
        }
        // Route: grey ahead of the pulse, accent behind it.
        line(0, path.total, rgba(T.grey, 0.7), 2)
        line(0, at, rgba(T.accent, 0.75), 2)
        k.strokeStyle = arrived ? rgba(T.accent, 0.75) : rgba(T.grey, 0.7)
        k.lineWidth = 2
        k.beginPath()
        k.moveTo(node[0], node[1])
        k.lineTo(rx, node[1])
        k.stroke()
        // The node lights as the pulse lands.
        const ping = prog(lt, ARRIVE, fr(7), ease.cubic.out)
        if (arrived && ping < 1) {
          k.strokeStyle = rgba(T.accent, 0.8 * (1 - ping))
          k.beginPath()
          k.arc(node[0], node[1], R + ping * R, 0, TAU)
          k.stroke()
        }
        ring(k, T, node[0], node[1], R, { lit: arrived, hot: arrived && lt < ARRIVE + fr(2) - 1e-6 })
        k.fillStyle = rgba(T.void)
        k.fillRect(rx - 5, node[1] - 5, 10, 10)
        k.strokeStyle = rgba(T.accent)
        k.strokeRect(rx - 5, node[1] - 5, 10, 10)
        // Comet: a short tail of four strokes and a white head.
        if (lt < ARRIVE + fr(4)) {
          glowOn(k, T, 18)
          for (const tail of TAIL) line(pos(lt - tail.lag * ARRIVE * 2), at, rgba(T.accent, tail.alpha), tail.width)
          if (lt < ARRIVE + fr(1) - 1e-6) {
            const [hx, hy] = path.at(at)
            k.fillStyle = rgba(T.white)
            k.strokeStyle = rgba(T.accent)
            k.lineWidth = 2
            k.beginPath()
            k.arc(hx, hy, 11, 0, TAU)
            k.fill()
            k.stroke()
          }
          glowOff(k)
        }
        // The receipt answers: figures flash accent, brackets close on it.
        const hot = arrived && lt < ARRIVE + fr(4) - 1e-6
        for (const num of nums) num.style.color = hot ? 'var(--accent)' : 'var(--white)'
        const m = M + Math.round((1 - prog(lt, ARRIVE, fr(6), ease.snap)) * 16)
        // Brackets close in from 16 px out, but never leave the content area.
        const bx0 = Math.max(c.x, px - m)
        const by0 = Math.max(c.y, py - m)
        const bx1 = Math.min(g.right, px + rw + m)
        const by1 = Math.min(g.floor, py + rh + m)
        frame.set({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, opacity: arrived ? 1 : 0.45 })
      },
    }
  }

  // ── 24/5. — dot-grid map, light band, four session nodes ──────────────────
  function map(bg, fx, ctx, g) {
    const { W, H, c, T } = g
    const pitch = ctx.pick({ '16x9': 30, '9x16': 26, default: 28 })
    const r = ctx.pick({ '16x9': 4, '9x16': 3.5, default: 3.75 })
    const R = ctx.pick({ '16x9': 26, '9x16': 20, default: 24 })
    const top = c.y - 20
    const cols = Math.ceil(W / pitch) + 2
    const rowsN = Math.ceil((g.bottom + 20 - top) / pitch) + 1
    const ox = (W - (cols - 1) * pitch) / 2
    const snapX = x => ox + Math.round((x - ox) / pitch) * pitch
    const snapY = y => top + Math.round((y - top) / pitch) * pitch
    const column = (k, i) => {
      k.beginPath()
      for (let j = 0; j < rowsN; j++) {
        k.moveTo(ox + i * pitch + r, top + j * pitch)
        k.arc(ox + i * pitch, top + j * pitch, r, 0, TAU)
      }
      k.fill()
    }
    const cv = AD.canvas(bg, W, H)
    const bandW = ctx.pick({ '16x9': 420, '9x16': 320, default: 360 })

    // Four session nodes, west to east: New York, London, Tokyo, Sydney.
    const box = g.wide
      ? { x: Math.max(g.wordRight[3] + 110, c.x + c.w * 0.5), y: c.y + 60, h: c.h - 120 }
      : { x: c.x + 36, y: g.gTop + 50, w: c.w - 72, h: g.bottom - g.gTop - 96 }
    if (g.wide) box.w = g.right - 40 - box.x
    const spots = [[0.03, 0.5], [0.36, 0.22], [0.88, 0.44], [0.97, 0.92]].map(([u, v]) => [snapX(box.x + box.w * u), snapY(box.y + box.h * v)])
    // Session arcs, drawn in the order the trading day moves: east to west.
    const arcs = [[3, 2], [2, 1], [1, 0]].map(([a, b]) => {
      const [x0, y0] = spots[a]
      const [x1, y1] = spots[b]
      const lift = Math.max(R * 2.2, Math.hypot(x1 - x0, y1 - y0) * 0.34)
      return { p0: [x0, y0], p1: [(x0 + x1) / 2, Math.min(y0, y1) - lift], p2: [x1, y1] }
    })
    const london = spots[1]
    const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]

    return {
      origin: london,
      render(lt, zoom) {
        const k = cv.ctx
        k.clearRect(0, 0, W, H)
        // The resting grid, then the band of light that follows the trading
        // day westward at constant speed.
        const bx = london[0] + lerp(70, -70, clamp(lt / CUT))
        for (let i = 0; i < cols; i++) {
          k.globalAlpha = 0.3
          k.fillStyle = rgba(T.grey)
          column(k, i)
          const a = 1 - Math.abs(ox + i * pitch - bx) / (bandW / 2)
          if (a <= 0) continue
          k.globalAlpha = 0.95 * a
          k.fillStyle = rgba(T.accent)
          column(k, i)
        }
        k.globalAlpha = 1
        crop(k, g, london, zoom)
        // Arcs draw on two frames apart; the first is under way on the cut.
        glowOn(k, T, 12)
        k.strokeStyle = rgba(T.accent)
        k.lineWidth = 2
        arcs.forEach((arc, i) => {
          const p = prog(lt, fr(i * 2 - 4), fr(5))
          if (p <= 0) return
          const q = mix(arc.p0, arc.p1, p)
          const e = mix(q, mix(arc.p1, arc.p2, p), p)
          k.beginPath()
          k.moveTo(arc.p0[0], arc.p0[1])
          k.quadraticCurveTo(q[0], q[1], e[0], e[1])
          k.stroke()
        })
        glowOff(k)
        // London's ring pings as the band sits on it.
        const ping = prog(lt, 0, fr(10), ease.cubic.out)
        k.strokeStyle = rgba(T.accent, 0.9 - 0.5 * ping)
        k.beginPath()
        k.arc(london[0], london[1], R + 8 + ping * R * 0.9, 0, TAU)
        k.stroke()
        spots.forEach(([x, y], i) => ring(k, T, x, y, R, { lit: true, hot: i === 1 }))
      },
    }
  }

  AD.defineScene('recap', {
    css: `
      .scene--recap .rc-shot { position: absolute; inset: 0; overflow: hidden; }
      .scene--recap .rc-bg { position: absolute; inset: 0; }
      .scene--recap .k-headline .ln > span { will-change: auto; }
      .scene--recap .rc-fig { position: absolute; left: 0; top: 0; text-align: center; line-height: 1; font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums slashed-zero; white-space: nowrap; }
      .scene--recap .rc-chip {
        position: absolute; left: 0; top: 0; box-sizing: border-box;
        display: flex; align-items: center; gap: 0.4em; padding: 0 0.5em 0 0.42em;
        background: var(--graphite); border: 2px solid currentColor; border-radius: 4px; white-space: nowrap;
      }
      .scene--recap .rc-chip .grip { flex: none; width: 7px; height: 0.62em; opacity: 0.8; background: linear-gradient(to right, currentColor 2px, transparent 2px) 0 0 / 5px 100%; }
      .scene--recap .rc-chip .lbl { font-family: var(--font-display); font-weight: 600; font-size: 1.1em; letter-spacing: 0.1em; min-width: 2.95em; }
      .scene--recap .rc-chip .px { font-family: var(--font-mono); font-weight: 500; color: var(--white); font-variant-numeric: tabular-nums slashed-zero; }
      .scene--recap .rc-receipt {
        position: absolute; box-sizing: border-box; background: var(--graphite); border: 1px solid var(--hairline); border-radius: var(--radius);
        font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums slashed-zero; color: var(--white); white-space: pre;
      }
      .scene--recap .rc-receipt .rule { height: 1px; background: var(--hairline); }
      .scene--recap .rc-receipt .row { display: flex; justify-content: space-between; }
      .scene--recap .rc-receipt .k, .scene--recap .rc-receipt .u { color: var(--grey); }
    `,

    build(root, ctx) {
      const kit = AD.kit
      const c = ctx.content
      const { W, H } = ctx
      const wide = ctx.landscape
      const bottom = c.y + c.h
      const right = c.x + c.w
      kit.grid(root)

      // bg: canvases, scaled for the settle. fx: DOM parts, never scaled.
      const shots = WORDS.map(() => {
        const shot = el('div', 'rc-shot', root)
        const bg = el('div', 'rc-bg', shot)
        const fx = el('div', 'rc-bg', shot)
        return { shot, bg, fx }
      })

      // ── the giant word: one size and one position for all four ──
      let size = ctx.pick({ '16x9': 330, '9x16': 290, default: 360 })
      const maxW = wide ? c.w * 0.54 : c.w
      const heads = shots.map((sh, i) => {
        const h = kit.headline(sh.shot, [WORDS[i]], { tier: 'display', x: c.x, y: 0, w: W })
        h.el.style.fontSize = size + 'px'
        // Always its own compositor layer, so the word is rasterised the same
        // way whatever is beneath it and whatever was drawn before it.
        h.el.style.willChange = 'transform'
        return h
      })
      const widths = () => heads.map(h => h.lines[0].inner.getBoundingClientRect().width)
      const widest = Math.max(...widths())
      if (widest > maxW) {
        size = Math.floor((size * maxW) / widest)
        for (const h of heads) h.el.style.fontSize = size + 'px'
      }
      // Baseline and cap height of the set word, measured rather than assumed.
      const probe = el('span', null, heads[0].lines[0].inner)
      probe.style.cssText = 'display:inline-block;width:0;height:0'
      const baseOff = Math.round(probe.getBoundingClientRect().bottom - heads[0].el.getBoundingClientRect().top)
      probe.remove()
      const meter = document.createElement('canvas').getContext('2d')
      meter.font = `600 ${size}px "Barlow Condensed"`
      const capH = Math.round(meter.measureText('E').actualBoundingBoxAscent)
      // The tag keeps one corner through all four cuts: top left, where the
      // chapter tab sits in the chapters, clear of every graphic. Whole-pixel
      // box on its own layer, so its rounded corners render the same every time.
      const tag = kit.tag(root, null, { x: c.x, y: c.y })
      const tagBox = tag.getBoundingClientRect()
      tag.style.boxSizing = 'border-box'
      tag.style.width = Math.ceil(tagBox.width) + 'px'
      tag.style.willChange = 'transform'
      // 16:9: word at the left, its baseline just below the middle of the stage.
      // Portrait: word across the top, graphic beneath it.
      const base = wide ? Math.round(c.y + c.h * 0.52) : Math.round(c.y + tagBox.height + 22 + capH)
      for (const h of heads) h.el.style.top = base - baseOff + 'px'
      const wordRight = widths().map(w => c.x + w)

      // floor: the lowest line any graphic may reach, on any frame of the
      // settle: the content edge, and at least 12 px above the risk band.
      // soft: how far above it the canvases start to fade.
      const floor = Math.min(bottom, ctx.layout.band.y - 12)
      const g = { W, H, c, wide, bottom, floor, soft: wide ? 30 : 14, right, size, base, capH, capTop: base - capH, wordRight, gTop: base + Math.round(size * 0.14), T: tokens() }
      const draw = [ladder, levels, route, map].map((make, i) => make(shots[i].bg, shots[i].fx, ctx, g))
      shots.forEach((sh, i) => (sh.bg.style.transformOrigin = `${draw[i].origin[0]}px ${draw[i].origin[1]}px`))

      const travel = heads[0].lines[0].inner.getBoundingClientRect().height * 1.08
      return { shots, heads, draw, travel }
    },

    render(t, ctx, s) {
      const n = s.shots.length
      // Hard cuts every 15 frames, decided on the frame index so a cut can never land a frame early or late.
      const frame = Math.round(t * AD.fps)
      const index = clamp(Math.floor(frame / Math.round(CUT * AD.fps)), 0, n - 1)
      s.shots.forEach((sh, i) => {
        const active = i === index
        sh.shot.style.display = active ? 'block' : 'none'
        if (!active) return
        const lt = t - i * CUT
        // The crop settles from 104% to 100% across the whole shot.
        const settle = 1 + 0.04 * (1 - prog(lt, 0, CUT, ease.expo.out))
        sh.bg.style.transform = `scale(${settle.toFixed(5)})`
        // The word rises through its mask in three frames, in whole pixels (a
        // text layer that slides by fractions of a pixel is not repeatable).
        const up = prog(lt, -fr(1), fr(3), ease.snap)
        s.heads[i].lines[0].inner.style.transform = `translate(0px,${Math.round((1 - up) * s.travel)}px)`
        s.heads[i].lines[0].inner.style.opacity = '1'
        s.draw[i].render(lt, settle)
      })
    },
  })
})()
