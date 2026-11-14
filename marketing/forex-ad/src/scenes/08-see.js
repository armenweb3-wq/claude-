/* S08 — chapter 01 SEE (18.0–24.0 s, bars 10–12): bid, ask and the gap
 * between them, on screen before any decision.
 *
 * A price ladder in mono figures: ask levels above the spread with amber
 * depth extending right, bid levels below it with ice depth extending left,
 * the best bid and best ask brighter, and a caliper clamped on the gap,
 * labelled SPREAD with no figure. Two large quotes tick both ways on the
 * 5-frame grid; a tick stream runs beside (16:9) or beneath (4:5) the ladder.
 * From 22.0 the camera pushes in on the gap; at 22.5 the depth at the touch
 * thins, the gap opens by a level on each side, then closes again.
 *
 * Quotes are AD.market's trendless EUR/USD path, bridged so they start at
 * 1.08420 / 1.08432 on the first beat and are back there before the cut.
 */
AD.defineScene('see', {
  css: `
    .scene--see .see-back { position: absolute; background: color-mix(in srgb, var(--void) 94%, transparent); box-shadow: 0 0 44px 34px color-mix(in srgb, var(--void) 94%, transparent); }
    .scene--see .see-view { position: absolute; overflow: hidden; }
    .scene--see .see-world { position: absolute; width: var(--W); height: var(--H); }
    .scene--see .see-hair { position: absolute; height: 1px; background: var(--hairline); }
    .scene--see .see-spine { position: absolute; width: 1px; background: var(--grey); opacity: 0.5; }
    .scene--see .see-gap { position: absolute; background: color-mix(in srgb, var(--accent) 11%, transparent); }
    .scene--see .see-price {
      position: absolute; box-sizing: border-box; display: flex; align-items: center; justify-content: flex-end;
      font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums slashed-zero; white-space: nowrap; color: var(--grey);
    }
    .scene--see .see-bar { position: absolute; box-sizing: border-box; }
    /* Flat fills only: depth reads from length and from a fill that thins level by level. */
    .scene--see .see-bar--ask { border-right: 2px solid var(--amber); }
    .scene--see .see-bar--bid { border-left: 2px solid var(--ice); }
    .scene--see .see-line { position: absolute; height: 2px; }
    .scene--see .see-quote { position: absolute; }
    .scene--see .see-quote .lbl, .scene--see .see-pair { font-family: var(--font-mono); font-weight: 600; line-height: 1; letter-spacing: 0.16em; white-space: nowrap; }
    .scene--see .see-quote .lbl { margin-bottom: 0.5em; }
    .scene--see .see-quote--bid .lbl { color: var(--ice); }
    .scene--see .see-quote--ask .lbl { color: var(--amber); text-align: right; margin-right: -0.16em; }
    .scene--see .see-pair { position: absolute; color: var(--white); }
    .scene--see .see-quote .num { font-family: var(--font-mono); font-weight: 500; line-height: 0.84; white-space: nowrap; color: var(--white); font-variant-numeric: tabular-nums slashed-zero; }
    .scene--see .see-quote .num .a, .scene--see .see-quote .num .c { font-size: 0.54em; }
    .scene--see .see-quote .num .b { font-weight: 600; margin: 0 0.04em; }
    .scene--see .see-quote .num .c { position: relative; top: -0.62em; }
    .scene--see .see-quote--bid .num .c { color: var(--ice); }
    .scene--see .see-quote--ask .num .c { color: var(--amber); }
    .scene--see .see-spark { position: absolute; }
    .scene--see .see-cap { position: absolute; color: var(--white); }
    .scene--see .see-big { position: absolute; font-family: var(--font-mono); font-weight: 600; color: var(--accent); white-space: nowrap; line-height: normal; }
  `,

  build(root, ctx) {
    const { el } = AD
    const kit = AD.kit
    const c = ctx.content
    const W = ctx.W
    const P = ctx.pick
    const wide = ctx.landscape
    const css = getComputedStyle(document.documentElement)
    const token = name => css.getPropertyValue(name).trim()
    const tagSize = parseFloat(token('--t-tag'))

    kit.grid(root)
    const back = el('div', 'see-back', root)

    // ── market model: ticks every 5 frames, integer pipettes around the base bid ──
    const pair = AD.market.pair('EUR/USD')
    const TICK = 5 / AD.fps
    const BASE = Math.round(pair.base * 1e5) // 1.08420 in pipettes
    const GAP = 12 // illustrative bid/ask gap in pipettes; the caliper never states it
    const STEP = 5 // pipettes between ladder levels
    const K0 = 6 // 19.0 s: quotes read exactly the base values
    const K1 = 35 // 23.83 s: and are back there before the cut
    const raw = k => AD.market.price(pair.sym, ctx.start + k * TICK)
    const r0 = raw(K0)
    const r1 = raw(K1)
    const bridged = k => Math.round((((raw(k) - AD.lerp(r0, r1, (k - K0) / (K1 - K0))) / 1e-5) * 0.5))
    const d0 = bridged(0)
    const n0 = AD.fbm(0, 91, 3)
    const DEV_MIN = -64
    const devs = []
    for (let k = DEV_MIN; k <= 40; k++) devs.push(k >= K1 ? 0 : k >= 0 ? bridged(k) : Math.round(d0 + (AD.fbm(k * 0.23, 91, 3) - n0) * 16))
    const dev = k => devs[AD.clamp(k, DEV_MIN, 40) - DEV_MIN]
    // Ticks 28–31 (22.67–23.33 s): the touch has thinned, the best levels are one step out.
    const wideAt = k => (k >= 28 && k <= 31 ? 1 : 0)
    const fmt = v => (v / 1e5).toFixed(pair.digits)

    // ── chapter tab, tag ─────────────────────────────────────────────────
    const tab = kit.chapterTab(root, '01', 'SEE', { x: c.x, y: c.y })
    const tabNum = tab.el.querySelector('.num')
    const numRect = tabNum.getBoundingClientRect()
    const tabH = Math.ceil(tab.el.getBoundingClientRect().height)
    const tag = kit.tag(root)
    const tagRect = tag.getBoundingClientRect()
    tag.style.left = c.x + c.w - Math.ceil(tagRect.width) + 'px'
    tag.style.top = c.y + 'px'

    // ── big quotes ───────────────────────────────────────────────────────
    const S = P({ '16x9': 80, '4x5': 86, '9x16': 74 })
    const lblSize = Math.round(tagSize * 1.15)
    const colX = Math.round(wide ? c.x + c.w * 0.69 : c.x + c.w / 2)
    // Portrait: a zone under the tab holds the words, then the second headline and caption.
    const zoneTop = c.y + tabH + P({ '9x16': 16, default: 22 })
    const zoneH = P({ '9x16': 198, '4x5': 258, default: 0 })
    const headerY = wide ? c.y : zoneTop + zoneH + P({ '9x16': 26, default: 32 })
    const mkQuote = (side, label) => {
      const node = el('div', `see-quote see-quote--${side}`, root)
      const lbl = el('div', 'lbl', node, label)
      lbl.style.fontSize = lblSize + 'px'
      const num = el('div', 'num', node)
      num.style.fontSize = S + 'px'
      const a = el('span', 'a', num, '1.08')
      const b = el('span', 'b', num, '42')
      const cc = el('span', 'c', num, '0')
      const r = node.getBoundingClientRect()
      return { el: node, a, b, c: cc, w: r.width, h: r.height, last: '' }
    }
    const qBid = mkQuote('bid', 'BID')
    const qAsk = mkQuote('ask', 'ASK')
    const gutter = P({ '16x9': 34, default: 28 })
    qBid.el.style.left = Math.round(colX - gutter - qBid.w) + 'px'
    qAsk.el.style.left = colX + gutter + 'px'
    qBid.el.style.top = qAsk.el.style.top = headerY + 'px'
    const pairEl = el('div', 'see-pair', root, pair.sym)
    pairEl.style.fontSize = lblSize + 'px'
    pairEl.style.left = Math.round(colX - pairEl.getBoundingClientRect().width / 2 + lblSize * 0.08) + 'px'
    pairEl.style.top = headerY + 'px'
    const headerH = Math.ceil(qBid.h)

    // ── ladder geometry (world coordinates = frame coordinates before the push-in) ──
    const rows = P({ '16x9': 15, '4x5': 11, '9x16': 9 })
    const N = (rows - 1) / 2
    const sparkH = P({ '4x5': 92, default: 0 })
    const ladTop = headerY + headerH + P({ '16x9': 20, default: 18 })
    const ladLimit = c.y + c.h - 2 - (sparkH ? sparkH + 18 : 0)
    const rowH = Math.floor((ladLimit - ladTop) / rows)
    const ladH = rowH * rows
    const ladBottom = ladTop + ladH
    const rowFont = Math.min(26, Math.round(rowH * 0.64))
    const colW = Math.round(rowFont * 0.6 * 7 + rowFont * 1.7)
    const colL = colX - colW / 2
    const colR = colX + colW / 2
    const barMax = wide ? 400 : Math.ceil(colL + 24) // portrait: the deepest levels bleed off both edges
    const barH = rowH - P({ '16x9': 12, default: 14 })
    const xL = colL - barMax
    const xR = colR + barMax
    const gapTop = ladTop + N * rowH
    const gapBot = gapTop + rowH
    const gapMid = gapTop + rowH / 2
    const ZOOM = 0.1

    // Backdrop: quiets the grid behind the instrument so the row hairlines read cleanly.
    const backBox = wide
      ? { x: xL - 30, y: c.y - 6, w: c.x + c.w - (xL - 30) + 10, h: c.h + 12 }
      : { x: -60, y: headerY - 10, w: W + 120, h: c.y + c.h - headerY + 14 }
    back.style.cssText += `left:${backBox.x}px;top:${backBox.y}px;width:${backBox.w}px;height:${backBox.h}px`

    // Viewport: a plain clip. Rows that the push-in carries across its edge fade out whole (see render).
    const viewL = wide ? Math.round(colX - (colW / 2 + barMax) * (1 + ZOOM) - 26) : 0
    const view = el('div', 'see-view', root)
    view.style.cssText += `left:${viewL}px;top:${ladTop}px;width:${W - viewL}px;height:${ladH + 1}px`
    // Everything inside is laid out per frame in whole pixels (see render): the push-in moves
    // real geometry instead of scaling a layer, so hairlines stay 1 px and edges stay crisp.
    const world = el('div', 'see-world', view)
    world.style.left = -viewL + 'px'
    world.style.top = -ladTop + 'px'

    const gapBand = el('div', 'see-gap', world)

    // Row boundaries: an S-shaped table (asks reach right, bids reach left, both share the price column).
    const hairs = []
    for (let j = 0; j <= rows; j++) {
      const ask = j <= N
      hairs.push({ el: el('div', 'see-hair', world), j, ask, dist: ask ? N - j : j - N - 1 })
    }
    const spines = []
    for (const left of [true, false]) for (const up of [true, false]) spines.push({ el: el('div', 'see-spine', world), left, up })
    const levels = [] // one per price row
    for (let i = 0; i < rows; i++) {
      if (i === N) continue
      const ask = i < N
      const bar = el('div', `see-bar see-bar--${ask ? 'ask' : 'bid'}`, world)
      const line = el('div', 'see-line', world)
      line.style.background = `var(--${ask ? 'amber' : 'ice'})`
      const price = el('div', 'see-price', world)
      levels.push({ ask, level: ask ? N - 1 - i : i - N - 1, i, bar, line, price, last: '' })
    }

    // ── tick stream ──────────────────────────────────────────────────────
    let spark = null
    const sparkBox = P({
      '16x9': { x: colR + 132, y: gapBot + Math.round(rowH * 1.7), w: c.x + c.w - (colR + 132), h: ladBottom - 4 - (gapBot + Math.round(rowH * 1.7)) },
      '4x5': { x: c.x, y: ladBottom + 18, w: c.w, h: sparkH },
      default: null,
    })
    if (sparkBox) {
      const cv = el('canvas', 'see-spark', root)
      cv.width = sparkBox.w
      cv.height = sparkBox.h
      cv.style.cssText += `left:${sparkBox.x}px;top:${sparkBox.y}px;width:${sparkBox.w}px;height:${sparkBox.h}px`
      spark = { cv, g: cv.getContext('2d'), w: sparkBox.w, h: sparkBox.h, dx: P({ '16x9': 13, default: 24 }) }
    }

    // ── caliper on the gap (drawn in frame space so strokes stay 2 px through the push-in) ──
    const cal = kit.caliper(root, { orientation: 'v' })
    const calInk = [[cal.el.querySelector('path'), 'stroke'], [cal.el.querySelector('text'), 'fill']]

    // ── words: BID. ASK. SPREAD. ─────────────────────────────────────────
    const WORDS = [['BID', 'c-ice'], ['ASK', 'c-amber'], ['SPREAD', 'c-accent']]
    const dotted = (line, [text, cls]) => {
      line.inner.innerHTML = `${text}<span class="${cls}">.</span>`
    }
    let words
    if (wide) {
      const h = kit.headline(root, WORDS.map(w => w[0] + '.'), { tier: 'display', x: c.x, y: 0, w: xL - 60 - c.x })
      h.lines.forEach((line, i) => dotted(line, WORDS[i]))
      h.el.style.top = Math.round(c.y + (c.h - h.height) / 2 + 12) + 'px'
      words = [{ h, line: 0 }, { h, line: 1 }, { h, line: 2 }]
    } else {
      const hs = WORDS.map(w => kit.headline(root, [w[0] + '.'], { tier: 'display', x: 0, y: 0, w: c.w }))
      const size = parseFloat(getComputedStyle(hs[0].el).fontSize)
      const space = size * 0.3
      const total = hs.reduce((sum, h) => sum + h.width, 0) + 2 * space
      const k = c.w / total // the three words together span the content width
      let x = c.x
      hs.forEach((h, i) => {
        dotted(h.lines[0], WORDS[i])
        h.el.style.fontSize = size * k + 'px'
        h.el.style.left = Math.round(x) + 'px'
        h.el.style.width = 'auto'
        h.el.style.top = Math.round(zoneTop + (zoneH - h.height * k) / 2) + 'px'
        x += (h.width + space) * k
      })
      words = hs.map(h => ({ h, line: 0 }))
    }

    // ── second headline + caption ────────────────────────────────────────
    const h2 = kit.headline(root, ['ON SCREEN', 'BEFORE YOU TRADE.'], {
      tier: wide ? 'h2' : 'display',
      x: c.x,
      y: 0,
      w: P({ '16x9': xL - 50 - c.x, '9x16': Math.round(c.w * 0.82), default: c.w }),
    })
    const cap = el('div', 'see-cap t-label', root, 'SPREADS VARY WITH MARKET CONDITIONS.')
    cap.style.left = c.x + 'px'
    kit.fit(cap, wide ? xL - 50 - c.x : c.w)
    const capH = cap.getBoundingClientRect().height
    const capGap = P({ '16x9': 26, default: 14 })
    const blockH = h2.height + capGap + capH
    const h2Top = wide ? Math.round(c.y + (c.h - blockH) / 2 + 12) : Math.round(zoneTop + (zoneH - blockH) / 2)
    h2.el.style.top = h2Top + 'px'
    const capTop = Math.round(h2Top + h2.height + capGap)

    // ── the "01" that slams in and docks into the tab ────────────────────
    const big = el('div', 'see-big', root, '01')
    const f0 = parseFloat(getComputedStyle(tabNum).fontSize)
    const bigSize = P({ '16x9': 380, '9x16': 300, '4x5': 360 }) // same as the 02 of S09

    return {
      tab, tabNum, tag, qBid, qAsk, pairEl, view, world, gapBand, hairs, spines, levels, spark, cal, calInk, words, h2, cap, big,
      dev, wideAt, fmt, BASE, GAP, STEP, TICK, N, rows, rowH, rowFont, barH, barMax, colX, colW, colL, colR, xL, xR, ladTop, ladH, gapTop, gapBot, gapMid, ZOOM, viewL, headerY, capTop, wide,
      num: { x: numRect.left, y: numRect.top, w: numRect.width, h: numRect.height, f0 },
      bigSize,
      colors: { white: token('--white'), grey: token('--grey'), ice: token('--ice'), amber: token('--amber'), accent: token('--accent'), hairline: token('--hairline') },
    }
  },

  render(t, ctx, s) {
    const { prog, ease, clamp, lerp } = AD
    const f = 1 / AD.fps
    const c = ctx.content
    const EPS = 1e-6

    // ── 18.0: "01" slams in, then shrinks into the chapter tab by 18.5 ───
    const slam = prog(t, 0, 6 * f, ease.expo.out)
    const dock = prog(t, 6 * f, 9 * f, ease.quint.inOut)
    const size = lerp(s.bigSize * lerp(1.14, 1, slam), s.num.f0, dock)
    const k = size / s.num.f0
    const cx = lerp(c.x + c.w / 2, s.num.x + s.num.w / 2, dock)
    const cy = lerp(c.y + c.h / 2, s.num.y + s.num.h / 2, dock)
    s.big.style.fontSize = size.toFixed(3) + 'px'
    s.big.style.left = (cx - (s.num.w * k) / 2).toFixed(3) + 'px'
    s.big.style.top = (cy - (s.num.h * k) / 2).toFixed(3) + 'px'
    s.big.style.opacity = t < 0.5 - EPS ? '1' : '0'
    s.tab.show(t, 0.5 - 0.08)
    s.tabNum.style.opacity = t < 0.5 - EPS ? '0' : '1'
    // The ladder starts three frames ahead of the beat so 18.5 already shows its spine.
    const LAD = 0.5 - 3 * f

    // ── clock: ticks on the 5-frame grid ─────────────────────────────────
    const kc = t / s.TICK
    const kNow = Math.floor(kc + EPS)
    const phase = kc - kNow // 0..1 inside the tick
    const wideNow = s.wideAt(kNow)
    const bidNow = s.BASE + s.dev(kNow)
    const exit = prog(t, ctx.dur - 8 * f, 8 * f) // last 8 frames: rows become lines

    // ── push-in and the gap ──────────────────────────────────────────────
    const z = 1 + s.ZOOM * prog(t, 4.0, 0.5, ease.quint.inOut)
    // Stage → frame, snapped to whole pixels.
    const zx = x => Math.round(s.colX + (x - s.colX) * z)
    const zy = y => Math.round(s.gapMid + (y - s.gapMid) * z)
    const place = (node, x, y, w, h) => {
      node.style.left = x + 'px'
      node.style.top = y + 'px'
      node.style.width = w + 'px'
      node.style.height = h + 'px'
    }
    const tops = []
    for (let j = 0; j <= s.rows; j++) tops.push(zy(s.ladTop + j * s.rowH))
    const colL = zx(s.colL)
    const colR = zx(s.colR)
    const xL = zx(s.xL)
    const xR = zx(s.xR)
    // A row leaves cleanly: it is gone by the time 30% of it has crossed the edge of the ladder.
    const ladBottom = s.ladTop + s.ladH
    const inView = i => {
      const h = tops[i + 1] - tops[i]
      const outside = Math.max(0, s.ladTop - tops[i], tops[i + 1] - ladBottom)
      return clamp(1 - outside / (0.3 * h))
    }

    // 22.5: depth at the touch drains and the jaws follow it out; 23.0: it returns.
    const drain = ease.glide(prog(t, 4.5, 10 * f)) - ease.glide(prog(t, 5.0, 10 * f))
    const widen = ease.glide(prog(t, 4.5, 12 * f)) - ease.glide(prog(t, 5.0, 12 * f))
    const jawA = s.gapTop - widen * s.rowH
    const jawB = s.gapBot + widen * s.rowH
    const clamped = prog(t, 2.0 - f, 7 * f, ease.snap)
    const release = 1 - prog(exit, 0, 0.5)
    place(s.gapBand, xL, zy(jawA), xR - xL, zy(jawB) - zy(jawA))
    s.gapBand.style.opacity = (prog(t, 2.0 + 2 * f, 6 * f) * release).toFixed(4)
    // Whole-pixel jaws: 2 px strokes stay crisp (and identical however the frame was reached).
    const beam = zx(s.colR + Math.round(s.rowH * 0.8))
    const open = clamped * release
    s.cal.set({
      a: zy(jawA),
      b: zy(jawB),
      pos: beam,
      open: 1 - Math.round((1 - open) * 56) / 56,
      jaw: beam - zx(s.colL - 14),
      label: 'SPREAD',
      labelGap: 14,
    })
    const detent = t >= 2.0 + 5 * f - EPS && t < 2.0 + 8 * f - EPS
    // Detent: the caliper reads white for three frames as it seats (no glow filter).
    for (const [node, attr] of s.calInk) node.setAttribute(attr, detent ? 'var(--white)' : 'var(--accent)')

    // ── ladder ───────────────────────────────────────────────────────────
    const stag = Math.min(2, 12 / s.N) * f
    const depthAt = (kk, side, level) => {
      const base = 0.2 + 0.8 * Math.pow((level + 0.7) / (s.N - 0.3), 0.8)
      return clamp(base * (0.7 + 0.55 * AD.hash(kk * 131 + level * 17 + side * 7919 + 5)), 0.1, 1)
    }
    const settle = AD.smoothstep(0, 0.8, phase) // bars take 4 of the 5 frames to reach the new tick
    const numOut = 1 - prog(exit, 0, 0.4)
    for (const hair of s.hairs) {
      // Each boundary draws outward from the price column.
      const p = prog(t, LAD + hair.dist * stag, 7 * f, ease.snap)
      const w = Math.round((hair.ask ? xR - colL : colR - xL) * p)
      place(hair.el, hair.ask ? colL : colR - w, tops[hair.j], w, 1)
      hair.el.style.opacity = (1 - exit).toFixed(4)
    }
    const spine = prog(t, LAD, 12 * f, ease.snap)
    for (const sp of s.spines) {
      // The column's two edges grow away from the gap.
      const full = sp.up ? tops[s.N] - tops[0] : tops[s.rows] - tops[s.N + 1]
      const h = Math.round(full * spine)
      place(sp.el, sp.left ? colL : colR, sp.up ? tops[s.N] - h : tops[s.N + 1], 1, h)
      sp.el.style.opacity = (0.5 * (1 - exit)).toFixed(4)
    }
    const reach = ease.cubic.inOut(exit)
    const lineL = Math.round(lerp(s.colX, s.viewL, reach))
    const lineR = Math.round(lerp(s.colX, ctx.W, reach))
    const barH = Math.round(s.barH * z)
    for (const row of s.levels) {
      const side = row.ask ? 1 : 0
      const L = row.level
      // Price of this level at the current tick.
      const value = row.ask ? bidNow + s.GAP + L * s.STEP : bidNow - L * s.STEP
      const text = s.fmt(value)
      if (row.last !== text) row.price.textContent = row.last = text
      const top = tops[row.i]
      const rowH = tops[row.i + 1] - top
      place(row.price, colL, top, colR - colL, rowH)
      row.price.style.fontSize = (s.rowFont * z).toFixed(2) + 'px'
      row.price.style.paddingRight = Math.round(s.rowFont * 0.85 * z) + 'px'
      const seen = inView(row.i)
      const shown = prog(t, LAD + L * stag + f, 4 * f) * seen
      const best = L === wideNow
      const gone = L < wideNow // level emptied while the gap is open
      row.price.style.opacity = (shown * numOut * (gone ? 0.42 : 1)).toFixed(4)
      row.price.style.color = best && shown > 0 ? s.colors.white : s.colors.grey
      row.price.style.fontWeight = best ? '700' : '500'
      const sideOn = prog(t, (row.ask ? 1.5 : 1.0) - f, 4 * f)
      row.price.style.background = best ? `color-mix(in srgb, var(--${row.ask ? 'amber' : 'ice'}) ${(18 * sideOn * numOut).toFixed(1)}%, transparent)` : 'transparent'

      // Depth bar: eased between ticks, with a little seeded shimmer every frame.
      const grow = prog(t, (row.ask ? 1.5 : 1.0) - f + L * f, 8 * f, ease.snap)
      const thin = 1 - drain * (L === 0 ? 1 : 0.5 / L)
      const shimmer = 1 + 0.03 * (AD.noise(t * 9 + L * 3.1, 40 + side) * 2 - 1)
      const depth = lerp(depthAt(kNow - 1, side, L), depthAt(kNow, side, L), settle) * shimmer * thin * grow
      const len = Math.round(clamp(depth) * s.barMax * z)
      // Exit: the bar flattens into a 2 px line.
      const flat = prog(exit, 0, 0.5, ease.snap)
      const hgt = Math.round(lerp(barH, 2, flat))
      place(row.bar, row.ask ? colR + 1 : colL - 1 - len, top + Math.round((rowH - hgt) / 2), len, hgt)
      row.bar.style.visibility = len < 2 || seen <= 0 ? 'hidden' : 'visible'
      const ink = Math.round((best ? 100 : 54 - Math.min(L, 6) * 3) * seen)
      row.bar.style.background = `color-mix(in srgb, var(--${row.ask ? 'amber' : 'ice'}) ${ink}%, transparent)`
      // … and the line stretches out of the price column across the stage.
      place(row.line, lineL, top + Math.round(rowH / 2) - 1, lineR - lineL, 2)
      row.line.style.opacity = (prog(exit, 0.05, 0.3) * 0.85 * seen).toFixed(4)
    }

    // ── big quotes ───────────────────────────────────────────────────────
    const quote = (q, at, value) => {
      const text = s.fmt(value)
      if (q.last !== text) {
        q.last = text
        q.a.textContent = text.slice(0, 4)
        q.b.textContent = text.slice(4, 6)
        q.c.textContent = text.slice(6)
      }
      const on = prog(t, at, 5 * f)
      q.el.style.top = s.headerY + Math.round((1 - prog(t, at, 8 * f, ease.snap)) * 12) + 'px'
      q.el.style.opacity = on.toFixed(4)
    }
    const bidAt = kk => s.BASE + s.dev(kk) - s.wideAt(kk) * s.STEP
    const askAt = kk => s.BASE + s.dev(kk) + s.GAP + s.wideAt(kk) * s.STEP
    quote(s.qBid, 1.0 - f, bidAt(kNow))
    quote(s.qAsk, 1.5 - f, askAt(kNow))
    s.pairEl.style.opacity = prog(t, LAD, 5 * f).toFixed(4)

    // ── tick stream ──────────────────────────────────────────────────────
    if (s.spark) {
      const { g, w, h, dx } = s.spark
      g.clearRect(0, 0, w, h)
      // Under the ladder (4:5) the stream stays to the cut; beside it (16:9) it clears for the lines.
      const reveal = prog(t, LAD, 0.6) * (s.wide ? 1 - prog(exit, 0, 0.5) : 1)
      s.spark.cv.style.opacity = reveal > 0 ? '1' : '0'
      if (reveal > 0) {
        const xNow = w - 8
        const px = (h / 2 - 7) / 37
        const yOf = v => h / 2 - (clamp(v - s.BASE + 2, -37, 37)) * px
        const first = kNow - Math.ceil(xNow / dx) - 1
        const xOf = j => xNow - (kc - j) * dx
        g.save()
        g.beginPath()
        g.rect(0, 0, t > 1.2 ? w : w * reveal, h)
        g.clip()
        const ink = t > 1.2 ? reveal : 1
        g.globalAlpha = ink
        // guides
        g.strokeStyle = s.colors.hairline
        g.lineWidth = 1
        g.beginPath()
        for (const y of [0.5, Math.round(h / 2) + 0.5, h - 0.5]) {
          g.moveTo(0, y)
          g.lineTo(w, y)
        }
        g.stroke()
        const trace = fn => {
          const pts = []
          for (let j = first; j <= kNow; j++) {
            const y = yOf(fn(j))
            pts.push([Math.max(-4, xOf(j)), y], [j === kNow ? xNow : xOf(j + 1), y])
          }
          return pts
        }
        const bid = trace(bidAt)
        const ask = trace(askAt)
        // the gap between the two streams
        g.fillStyle = s.colors.accent
        g.globalAlpha *= 0.13
        g.beginPath()
        ask.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
        for (let i = bid.length - 1; i >= 0; i--) g.lineTo(bid[i][0], bid[i][1])
        g.closePath()
        g.fill()
        g.globalAlpha = ink
        g.lineWidth = 2
        g.lineJoin = 'miter'
        for (const [pts, color] of [[bid, s.colors.ice], [ask, s.colors.amber]]) {
          g.strokeStyle = color
          g.beginPath()
          pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
          g.stroke()
          g.fillStyle = color
          g.fillRect(xNow - 3, pts[pts.length - 1][1] - 4, 7, 8)
        }
        g.restore()
      }
    }

    // ── words: one per beat, then a hard swap on the bar line at 22.0 ────
    const wordAt = [1.0 - f, 1.5 - f, 2.0 - f]
    if (s.wide) s.words[0].h.show(t, { at: wordAt, dur: 7 * f })
    else s.words.forEach((w, i) => w.h.show(t, { at: wordAt[i], dur: 7 * f }))
    // Hard cut: each word is switched off on its own (no wrapper is toggled).
    if (t >= 4.0 - EPS) for (const w of s.words) w.h.lines[w.line].inner.style.opacity = '0'
    s.h2.show(t, { at: 4.0 - f, each: 5 * f, dur: 8 * f })
    s.cap.style.top = s.capTop + Math.round((1 - prog(t, 4.0 + 10 * f, 8 * f, ease.snap)) * 10) + 'px'
    s.cap.style.opacity = prog(t, 4.0 + 10 * f, 5 * f).toFixed(4)
  },
})
