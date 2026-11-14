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
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { el, svg, clamp, lerp, prog, ease } = AD
  const fr = n => n / 30

  const CUT = 0.5
  const WORDS = ['SEE.', 'SET.', 'TRACE.', '24/5.']
  const MONO = 0.6 // advance width of the mono face, in em

  const polyline = points => {
    const segs = []
    let total = 0
    for (let i = 1; i < points.length; i++) {
      const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
      segs.push({ a: points[i - 1], b: points[i], start: total, len })
      total += len
    }
    return {
      total,
      d: 'M' + points.map(p => `${p[0]},${p[1]}`).join(' L'),
      at(s) {
        s = clamp(s, 0, total)
        for (const g of segs) if (s <= g.start + g.len) return [lerp(g.a[0], g.b[0], g.len ? (s - g.start) / g.len : 0), lerp(g.a[1], g.b[1], g.len ? (s - g.start) / g.len : 0)]
        return points[points.length - 1]
      },
    }
  }
  const layer = (parent, W, H, cls) => svg('svg', { class: 'k-svg' + (cls ? ' ' + cls : ''), width: W, height: H, viewBox: `0 0 ${W} ${H}` }, parent)

  // ── SEE. — price ladder with the spread caliper ───────────────────────────
  function ladder(bg, ctx, g) {
    const kit = AD.kit
    const { W, H, c } = g
    const fig = ctx.pick({ '16x9': 52, '9x16': 36, default: 46 })
    const pitch = ctx.pick({ '16x9': 112, '9x16': 74, default: 112 })
    const gap = ctx.pick({ '16x9': 90, '9x16': 60, default: 88 })
    const barH = Math.round(pitch * 0.8)
    const colW = Math.round(fig * MONO * 7 + fig * 1.3)
    const cx = g.wide ? Math.round(c.x + c.w * 0.675) : W / 2
    // 16:9: three rows a side, the outer ones cut by the crop. Portrait: two
    // asks and three bids fit whole between the word and the risk band.
    const count = { ask: g.wide ? 3 : 2, bid: 3 }
    let cy = Math.round(c.y + c.h / 2)
    if (!g.wide) {
      const total = (count.ask + count.bid) * pitch - (pitch - barH) + gap
      cy = Math.round(g.gTop + Math.max(0, (g.bottom - g.gTop - total) / 2) + count.ask * pitch - (pitch - barH) + gap / 2)
    }
    const askX = cx + colW / 2 + 12
    const bidX = cx - colW / 2 - 12
    const askMax = W + 60 - askX
    const bidMax = g.wide ? bidX - (c.x + 150) : bidX + 60
    // Illustrative quotes: the film's EUR/USD bid and ask, five pipettes a row.
    const BID = 108420
    const ASK = 108432
    const depth = { ask: [0.36, 0.7, 1], bid: [0.34, 0.62, 0.9] }

    const band = el('div', 'rc-gap', bg)
    band.style.cssText += `left:${cx - 620}px;width:1240px;top:${cy - gap / 2}px;height:${gap}px`
    const art = layer(bg, W, H)
    const defs = svg('defs', null, art)
    const grad = (id, color, near, far, flip) => {
      const lg = svg('linearGradient', { id, x1: flip ? 1 : 0, x2: flip ? 0 : 1, y1: 0, y2: 0 }, defs)
      svg('stop', { offset: 0, 'stop-color': color, 'stop-opacity': near }, lg)
      svg('stop', { offset: 1, 'stop-color': color, 'stop-opacity': far }, lg)
    }
    grad('rc-ask', 'var(--amber)', 0.62, 0.16, false)
    grad('rc-bid', 'var(--ice)', 0.62, 0.16, true)

    const rows = []
    for (const side of ['ask', 'bid']) {
      for (let k = 0; k < count[side]; k++) {
        const best = k === 0
        const y = side === 'ask' ? cy - gap / 2 - barH - k * pitch : cy + gap / 2 + k * pitch
        const len = (side === 'ask' ? askMax : bidMax) * depth[side][k]
        const color = side === 'ask' ? 'var(--amber)' : 'var(--ice)'
        const rect = svg('rect', { y, height: barH, fill: best ? color : `url(#rc-${side})`, opacity: best ? 0.92 : 1 }, art)
        // The 2 px edge that faces the price column.
        const edge = svg('path', { d: `M${side === 'ask' ? askX : bidX},${y} v${barH}`, stroke: color, 'stroke-width': 2, fill: 'none' }, art)
        rows.push({ side, rect, edge, len })
        // A row the crop cuts through keeps its bar and loses its figure: no half-read prices.
        if (y < c.y + 6 || y + barH > g.bottom - 2) continue
        const price = el('div', 'rc-fig', bg, ((side === 'ask' ? ASK + k * 5 : BID - k * 5) / 1e5).toFixed(5))
        price.style.fontSize = fig + 'px'
        price.style.width = colW + 'px'
        price.style.left = cx - colW / 2 + 'px'
        price.style.top = y + (barH - fig) / 2 + 'px'
        price.style.color = best ? 'var(--white)' : 'var(--grey)'
        if (best) price.style.fontWeight = '600'
      }
    }
    const cal = kit.caliper(bg, { orientation: 'v' })

    return {
      origin: [cx, cy],
      render(lt) {
        const grow = lerp(0.8, 1, prog(lt, -fr(1), fr(8), ease.snap))
        for (const r of rows) {
          const len = r.len * grow
          r.rect.setAttribute('width', len.toFixed(2))
          r.rect.setAttribute('x', (r.side === 'ask' ? askX : bidX - len).toFixed(2))
        }
        cal.set({ a: cy - gap / 2, b: cy + gap / 2, pos: cx + colW / 2 + 34, jaw: colW + 68, open: prog(lt, -fr(2), fr(8), ease.snap) })
      },
    }
  }

  // ── SET. — entry, stop and limit ──────────────────────────────────────────
  function levels(bg, ctx, g) {
    const kit = AD.kit
    const { W, H, c } = g
    const chipFs = ctx.pick({ '16x9': 28, '9x16': 24, default: 26 })
    const chipH = chipFs * 2
    let yE
    let D
    if (g.wide) {
      // The word stands on the entry line, with the limit just clear of its cap height.
      yE = Math.round(g.base + g.size * 0.045)
      D = g.bottom - chipH / 2 - 2 - yE
    } else {
      yE = Math.round((g.gTop + g.bottom) / 2)
      D = Math.round((g.bottom - g.gTop) / 2 - chipH / 2 - 4)
    }
    const LV = [
      { label: 'LIMIT', px: '1.08682', y: yE - D, color: 'var(--accent)' },
      { label: 'ENTRY', px: '1.08432', y: yE, color: 'var(--white)', dash: '12 8' },
      { label: 'STOP', px: '1.08182', y: yE + D, color: 'var(--amber)' },
    ]
    const cv = AD.canvas(bg, W, H)
    const art = layer(bg, W, H)
    const chips = LV.map(lv => {
      svg('path', { d: `M-10,${lv.y} H${W + 10}`, stroke: lv.color, 'stroke-width': 2, fill: 'none', ...(lv.dash ? { 'stroke-dasharray': lv.dash } : null) }, art)
      const chip = el('div', 'rc-chip', bg)
      chip.style.color = lv.color
      chip.style.fontSize = chipFs + 'px'
      chip.style.height = chipH + 'px'
      el('span', 'grip', chip)
      el('span', 'lbl', chip, lv.label)
      el('span', 'px', chip, lv.px)
      return { el: chip, y: lv.y }
    })
    const chipW = Math.ceil(Math.max(...chips.map(ch => ch.el.getBoundingClientRect().width)))
    const chipX = g.right - chipW
    for (const ch of chips) {
      ch.el.style.width = chipW + 'px'
      ch.el.style.top = ch.y - chipH / 2 + 'px'
    }

    // Monochrome candles ranging on both sides of entry, clear of both exits.
    const n = ctx.pick({ '16x9': 10, '9x16': 7, default: 8 })
    const raw = AD.market.candles({ seed: 41, n, base: 0, vol: 6, revert: 0.3 })
    const far = Math.max(...raw.map(k => Math.max(Math.abs(k.h), Math.abs(k.l))))
    const candles = raw.map(k => ({ o: (k.o / far) * 15, h: (k.h / far) * 15, l: (k.l / far) * 15, c: (k.c / far) * 15 }))
    const x0 = g.wide ? Math.round(Math.max(g.wordRight[1] + 80, c.x + c.w * 0.36)) : c.x
    const rect = { x: x0, y: yE - D, w: chipX - 44 - x0, h: 2 * D }

    return {
      origin: [g.wide ? (x0 + chipX) / 2 : W / 2, yE],
      render(lt) {
        const k = cv.ctx
        k.clearRect(0, 0, W, H)
        // The last two candles print during the shot (time-driven, linear).
        kit.drawCandles(k, candles, { rect, min: -25, max: 25, count: n - 2 + 2 * clamp(lt / CUT + 0.1), alpha: 0.8 })
        const slide = (1 - prog(lt, -fr(1), fr(6), ease.snap)) * 70
        chips.forEach((ch, i) => {
          ch.el.style.transform = `translate(${Math.round(chipX + slide)}px,0px)`
          // Two-frame detent as each handle seats, one frame apart.
          const f = Math.floor(lt * 30 + 1e-4) - 2 - i
          ch.el.style.filter = f === 0 ? 'brightness(1.6)' : f === 1 ? 'brightness(1.25)' : 'none'
        })
      },
    }
  }

  // ── TRACE. — the pulse arrives at CONFIRMATION and the receipt ────────────
  function route(bg, ctx, g) {
    const kit = AD.kit
    const { W, H, c } = g
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
    const ruleGap = Math.round(font * 0.45)
    const rh = padY * 2 + row * 4 + ruleGap
    if (!g.wide) {
      node[1] = Math.round(Math.max(pts[0][1] + 60 + rh / 2, (pts[0][1] + g.bottom - M) / 2 + 14))
      pts.push([node[0], node[1]])
    }
    const ry = Math.round(node[1] - rh / 2)
    const path = polyline(pts)
    const wire = `M${node[0]},${node[1]} H${rx}`

    const art = layer(bg, W, H)
    const stroke = (d, color, opacity) => svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, opacity }, art)
    stroke(path.d + ' ' + wire, 'var(--grey)', 0.7)
    const lit = stroke(path.d, 'var(--accent)', 0.7)
    const wireLit = stroke(wire, 'var(--accent)', 0.7)
    const ring = svg('circle', { cx: node[0], cy: node[1], r: R, fill: 'var(--void)', stroke: 'var(--grey)', 'stroke-width': 2 }, art)
    const dot = svg('circle', { cx: node[0], cy: node[1], r: R * 0.3, fill: 'var(--grey)' }, art)
    svg('rect', { x: rx - 5, y: node[1] - 5, width: 10, height: 10, fill: 'var(--void)', stroke: 'var(--accent)', 'stroke-width': 2 }, art)

    const glow = layer(bg, W, H, 'rc-glow')
    const halo = svg('circle', { cx: node[0], cy: node[1], r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }, glow)
    const litRing = svg('circle', { cx: node[0], cy: node[1], r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }, glow)
    const litDot = svg('circle', { cx: node[0], cy: node[1], r: R * 0.3, fill: 'var(--accent)' }, glow)
    const TAIL = [
      { lag: 0.2, width: 2, opacity: 0.25 },
      { lag: 0.13, width: 4, opacity: 0.4 },
      { lag: 0.07, width: 6, opacity: 0.7 },
      { lag: 0.03, width: 9, opacity: 1 },
    ].map(spec => ({ ...spec, path: svg('path', { d: path.d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': spec.width, opacity: spec.opacity }, glow) }))
    const head = svg('circle', { r: 11, fill: 'var(--white)', stroke: 'var(--accent)', 'stroke-width': 2 }, glow)

    // The receipt, with the same illustrative order and time-stamp as chapter 3.
    const stamp = kit.clock(window.AD_TIMELINE.scenes.find(sc => sc.id === 'trace').start + 3)
    const panel = el('div', 'rc-receipt', bg)
    panel.style.cssText += `left:${rx}px;top:${ry}px;width:${rw}px;height:${rh}px;padding:${padY - 1}px ${padX - 1}px;font-size:${font}px;line-height:${row}px`
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
    const frame = kit.brackets(bg)

    const ARRIVE = fr(7)
    const from = path.total * (g.wide ? 0.42 : 0.2)
    return {
      origin: [rx + rw / 2, node[1]],
      render(lt) {
        const pos = t => lerp(from, path.total, clamp(t / ARRIVE))
        const at = pos(lt)
        const dash = (p, a, b) => {
          p.setAttribute('stroke-dasharray', `${Math.max(0, b - a).toFixed(2)} ${(path.total + 20).toFixed(2)}`)
          p.setAttribute('stroke-dashoffset', (-a).toFixed(2))
        }
        dash(lit, 0, at)
        const arrived = lt >= ARRIVE - 1e-6
        for (const tail of TAIL) {
          const a = pos(lt - tail.lag * ARRIVE * 2)
          dash(tail.path, a, at)
          tail.path.style.opacity = at - a > 0.5 ? '' : '0'
        }
        const [hx, hy] = path.at(at)
        head.setAttribute('cx', hx.toFixed(2))
        head.setAttribute('cy', hy.toFixed(2))
        head.setAttribute('opacity', lt < ARRIVE + fr(1) ? '1' : '0')
        // The node lights as the pulse lands; the wire and the time-stamp answer.
        const ping = prog(lt, ARRIVE, fr(7), ease.cubic.out)
        halo.setAttribute('r', (R + ping * R).toFixed(2))
        halo.setAttribute('opacity', arrived ? (0.8 * (1 - ping)).toFixed(4) : '0')
        litRing.setAttribute('opacity', arrived ? '1' : '0')
        litDot.setAttribute('opacity', arrived ? '1' : '0')
        litDot.setAttribute('fill', arrived && lt < ARRIVE + fr(2) - 1e-6 ? 'var(--white)' : 'var(--accent)')
        wireLit.setAttribute('opacity', arrived ? '0.7' : '0')
        const hot = arrived && lt < ARRIVE + fr(4) - 1e-6
        for (const num of nums) num.style.color = hot ? 'var(--accent)' : 'var(--white)'
        const tight = 1 - prog(lt, ARRIVE, fr(6), ease.snap)
        const m = M + tight * 16
        frame.set({ x: rx - m, y: ry - m, w: rw + 2 * m, h: rh + 2 * m, opacity: arrived ? 1 : 0.45 })
      },
    }
  }

  // ── 24/5. — dot-grid map, light band, four session nodes ──────────────────
  function map(bg, ctx, g) {
    const { W, H, c } = g
    const pitch = ctx.pick({ '16x9': 30, '9x16': 26, default: 28 })
    const r = ctx.pick({ '16x9': 4, '9x16': 3.5, default: 3.75 })
    const R = ctx.pick({ '16x9': 26, '9x16': 20, default: 24 })
    const top = c.y - 20
    const cols = Math.ceil(W / pitch) + 2
    const rowsN = Math.ceil((g.bottom + 20 - top) / pitch) + 1
    const ox = (W - (cols - 1) * pitch) / 2
    const snapX = x => ox + Math.round((x - ox) / pitch) * pitch
    const snapY = y => top + Math.round((y - top) / pitch) * pitch
    const dots = (color, alpha) => {
      const cv = AD.canvas(bg, W, H)
      cv.ctx.fillStyle = color
      cv.ctx.globalAlpha = alpha
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rowsN; j++) {
          cv.ctx.beginPath()
          cv.ctx.arc(ox + i * pitch, top + j * pitch, r, 0, Math.PI * 2)
          cv.ctx.fill()
        }
      }
      return cv.canvas
    }
    const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    dots(token('--grey'), 0.3)
    const bright = dots(token('--accent'), 0.95)
    const bandW = ctx.pick({ '16x9': 420, '9x16': 320, default: 360 })
    const mask = 'linear-gradient(to right, transparent 0%, #000 50%, transparent 100%)'
    bright.style.webkitMaskImage = bright.style.maskImage = mask
    bright.style.webkitMaskRepeat = bright.style.maskRepeat = 'no-repeat'
    bright.style.webkitMaskSize = bright.style.maskSize = `${bandW}px 100%`

    // Four session nodes, west to east: New York, London, Tokyo, Sydney.
    const box = g.wide
      ? { x: Math.max(g.wordRight[3] + 110, c.x + c.w * 0.5), y: c.y + 60, w: 0, h: c.h - 120 }
      : { x: c.x + 36, y: g.gTop + 50, w: c.w - 72, h: g.bottom - g.gTop - 96 }
    if (g.wide) box.w = g.right - 40 - box.x
    const spots = [[0.03, 0.5], [0.36, 0.22], [0.88, 0.44], [0.97, 0.92]].map(([u, v]) => [snapX(box.x + box.w * u), snapY(box.y + box.h * v)])
    const art = layer(bg, W, H, 'rc-glow')
    // Session arcs, drawn in the order the trading day moves: east to west.
    const arcs = [[3, 2], [2, 1], [1, 0]].map(([a, b]) => {
      const [x0, y0] = spots[a]
      const [x1, y1] = spots[b]
      const lift = Math.max(R * 2.2, Math.hypot(x1 - x0, y1 - y0) * 0.34)
      const d = `M${x0},${y0} Q${(x0 + x1) / 2},${Math.min(y0, y1) - lift} ${x1},${y1}`
      return svg('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '1 2' }, art)
    })
    const rings = spots.map(([x, y], i) => {
      const halo = svg('circle', { cx: x, cy: y, r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }, art)
      svg('circle', { cx: x, cy: y, r: R, fill: 'var(--void)', stroke: 'var(--accent)', 'stroke-width': 2 }, art)
      svg('circle', { cx: x, cy: y, r: R * 0.3, fill: i === 1 ? 'var(--white)' : 'var(--accent)' }, art)
      return halo
    })
    const london = spots[1]

    return {
      origin: london,
      render(lt) {
        // The band follows the trading day westward at constant speed.
        const bx = london[0] + lerp(70, -70, clamp(lt / CUT)) - bandW / 2
        bright.style.webkitMaskPosition = bright.style.maskPosition = `${bx.toFixed(2)}px 0px`
        arcs.forEach((arc, i) => arc.setAttribute('stroke-dashoffset', (1 - prog(lt, fr(i * 2 - 4), fr(5))).toFixed(4)))
        // London's ring pings as the band sits on it.
        const ping = prog(lt, 0, fr(10), ease.cubic.out)
        rings.forEach((halo, i) => {
          halo.setAttribute('r', (R + (i === 1 ? 8 + ping * R * 0.9 : 0)).toFixed(2))
          halo.setAttribute('opacity', i === 1 ? (0.9 - 0.5 * ping).toFixed(4) : '0')
        })
      },
    }
  }

  AD.defineScene('recap', {
    css: `
      .scene--recap .rc-shot { position: absolute; inset: 0; overflow: hidden; }
      .scene--recap .k-headline .ln > span { will-change: auto; }
      .scene--recap .rc-bg { position: absolute; inset: 0; }
      .scene--recap .rc-glow { filter: drop-shadow(0 0 8px rgba(61, 225, 240, 0.7)); }
      .scene--recap .rc-fig { position: absolute; text-align: center; line-height: 1; font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums slashed-zero; white-space: nowrap; }
      .scene--recap .rc-gap { position: absolute; background: linear-gradient(to right, transparent, rgba(61, 225, 240, 0.13) 30%, rgba(61, 225, 240, 0.13) 70%, transparent); }
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

      // Graphics may run off the sides of the frame but fade out before the
      // top row and the risk band.
      const crop = `linear-gradient(to bottom, transparent ${c.y - 8}px, #000 ${c.y + 30}px, #000 ${bottom - 22}px, transparent ${bottom + 10}px)`
      const shots = WORDS.map(() => {
        const shot = el('div', 'rc-shot', root)
        const bg = el('div', 'rc-bg', shot)
        bg.style.webkitMaskImage = bg.style.maskImage = crop
        return { shot, bg }
      })

      // ── the giant word: one size and one position for all four ──
      let size = ctx.pick({ '16x9': 330, '9x16': 290, default: 360 })
      const maxW = wide ? c.w * 0.54 : c.w
      const heads = shots.map((sh, i) => {
        const h = kit.headline(sh.shot, [WORDS[i]], { tier: 'display', x: c.x, y: 0, w: W })
        h.el.style.fontSize = size + 'px'
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
      const baseOff = probe.getBoundingClientRect().bottom - heads[0].el.getBoundingClientRect().top
      probe.remove()
      const meter = document.createElement('canvas').getContext('2d')
      meter.font = `600 ${size}px "Barlow Condensed"`
      const capH = meter.measureText('E').actualBoundingBoxAscent
      // The tag keeps one corner through all four cuts: top left, where the
      // chapter tab sits in the chapters, clear of every graphic.
      const tag = kit.tag(root, null, { x: c.x, y: c.y })
      const tagBox = tag.getBoundingClientRect()
      // 16:9: word at the left, its baseline just below the middle of the stage.
      // Portrait: word across the top, graphic beneath it.
      const base = wide ? Math.round(c.y + c.h * 0.52) : Math.round(c.y + tagBox.height + 22 + capH)
      for (const h of heads) h.el.style.top = base - baseOff + 'px'
      const wordRight = widths().map(w => c.x + w)

      const g = { W, H, c, wide, bottom, right, size, base, capH, capTop: base - capH, wordRight, gTop: base + Math.round(size * 0.14) }
      const draw = [ladder, levels, route, map].map((make, i) => make(shots[i].bg, ctx, g))
      shots.forEach((sh, i) => (sh.bg.style.transformOrigin = `${draw[i].origin[0].toFixed(1)}px ${draw[i].origin[1].toFixed(1)}px`))

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
        s.draw[i].render(lt)
      })
    },
  })
})()
