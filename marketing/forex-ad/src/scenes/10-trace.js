/* S10 — 03 TRACE (30–36 s). Chapter 3 and the mid-film re-hook: "WHERE DID
 * YOUR ORDER GO?" is answered with a record. A schematic in the manner of a
 * PCB trace: three level lines (limit, entry, stop) arrive from the previous
 * chapter and merge into ORDER; a cyan pulse then travels the right-angled
 * route and lights CHECKS, EXECUTION and CONFIRMATION on the beat. At the
 * last node a graphite receipt opens and prints requested price, filled price
 * (a tenth of a pip worse, shown as it is) and a time-stamp that lands at
 * exactly T = 33.0 s with the value the corner clock shows on that frame.
 * From 34.0 the receipt becomes the top of a scrolling order history.
 *
 * Beats (t = seconds since 30.0):
 *   0.0  tab on; route draws (15 frames, linear); nodes pop as it reaches them
 *   0.5  question sets; ORDER lights, pulse leaves
 *   1.0 / 1.5 / 2.0  pulse lights CHECKS / EXECUTION / CONFIRMATION
 *   2.0  receipt opens; REQUESTED.   2.5  FILLED.   3.0  TIME-STAMPED.
 *   3.5  caliper closes on the two prices (no figure: disclosure, not a claim)
 *   4.0  headline hard-cuts; history stack slides in and scrolls at constant speed
 *   5.5  everything fades over 12 frames, leaving one horizontal hairline
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { el, svg, clamp, lerp, prog, ease } = AD
  const fr = n => n / 30

  const LIT = [0.5, 1, 1.5, 2] // the pulse reaches node i at LIT[i]
  const PRINT = [2, 2.5, 3] // receipt rows and their headline words
  const NAMES = ['ORDER', 'CHECKS', 'EXECUTION', 'CONFIRMATION']

  // Order history under the hero receipt. Times sit on the film clock's 30 fps
  // grid; fills are equal to or a tenth of a pip worse than requested.
  const HISTORY = [
    { sym: 'GBP/USD', side: 'SELL', size: '0.20', req: '1.27150', fill: '1.27150', time: '14:31:07.267' },
    { sym: 'USD/JPY', side: 'BUY', size: '0.10', req: '151.320', fill: '151.321', time: '14:29:41.533' },
    { sym: 'EUR/USD', side: 'SELL', size: '0.10', req: '1.08406', fill: '1.08406', time: '14:27:15.800' },
    { sym: 'AUD/USD', side: 'BUY', size: '0.30', req: '0.65380', fill: '0.65380', time: '14:24:52.067' },
    { sym: 'EUR/GBP', side: 'SELL', size: '0.10', req: '0.85270', fill: '0.85269', time: '14:21:36.333' },
  ]

  /** A polyline with arc-length lookup. */
  function polyline(points) {
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
        for (const g of segs) {
          if (s <= g.start + g.len) {
            const k = g.len ? (s - g.start) / g.len : 0
            return [lerp(g.a[0], g.b[0], k), lerp(g.a[1], g.b[1], k)]
          }
        }
        return points[points.length - 1]
      },
    }
  }

  /**
   * kit.headline's reveal (lines rise from behind their baseline), moved in
   * whole pixels and without a compositor layer: a text layer that slides by
   * fractions of a pixel is rasterised differently depending on the frame
   * shown before it, which breaks frame-by-frame determinism.
   */
  function rise(h, t, { at = 0, each = 0.5, dur = 1 / 3, out = Infinity, outDur = 0.2 } = {}) {
    h.lines.forEach((item, i) => {
      const start = Array.isArray(at) ? at[i] : at + i * each
      const pin = prog(t, start, dur, ease.snap)
      const pout = out === Infinity ? 0 : prog(t, out + i * 0.04, outDur, ease.cubic.in)
      item.inner.style.transform = `translate(0px,${Math.round((1 - pin - pout) * h.lineHeight * 1.08)}px)`
      item.inner.style.opacity = pin <= 0 || pout >= 1 ? '0' : '1'
    })
  }

  const hexToRgb = hex => {
    const h = hex.trim().replace('#', '')
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  }
  const mix = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`

  AD.defineScene('trace', {
    css: `
      .scene--trace .tr-all { position: absolute; inset: 0; }
      .scene--trace .k-headline .ln > span { will-change: auto; }
      .scene--trace .tr-glow { filter: drop-shadow(0 0 7px rgba(61, 225, 240, 0.75)); }
      .scene--trace .tr-name { position: absolute; color: var(--grey); }
      .scene--trace .tr-window { position: absolute; overflow: hidden; }
      .scene--trace .tr-stack { position: absolute; left: 0; top: 0; width: 100%; }
      .scene--trace .tr-receipt {
        position: absolute; left: 0; width: 100%; box-sizing: border-box;
        background: var(--graphite); border: 1px solid var(--hairline); border-radius: var(--radius);
        font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums slashed-zero;
        color: var(--white); white-space: pre;
      }
      .scene--trace .tr-receipt .rule { height: 1px; background: var(--hairline); }
      .scene--trace .tr-receipt .row { display: flex; justify-content: space-between; }
      .scene--trace .tr-receipt .k, .scene--trace .tr-receipt .u { color: var(--grey); }
      .scene--trace .tr-big { position: absolute; left: 0; top: 0; font-family: var(--font-mono); font-weight: 600; color: var(--accent); white-space: nowrap; line-height: normal; }
      .scene--trace .tr-cover { position: absolute; inset: 0; background: var(--void); }
      .scene--trace .tr-hair { position: absolute; left: 0; width: 100%; height: 1px; background: var(--white); transform-origin: 0 50%; }
    `,

    build(root, ctx) {
      const kit = AD.kit
      const c = ctx.content
      const F = ctx.format
      const { W, H } = ctx
      const bottom = c.y + c.h
      const right = c.x + c.w
      const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name)
      const rgb = { white: hexToRgb(cssVar('--white')), accent: hexToRgb(cssVar('--accent')), grey: hexToRgb(cssVar('--grey')) }

      // Receipt metrics (px): mono size, row height, padding, gap around the rule.
      const m = ctx.pick({
        '16x9': { font: 32, row: 50, padX: 26, padY: 18, gap: 14 },
        '9x16': { font: 26, row: 41, padX: 18, padY: 13, gap: 10 },
        default: { font: 30, row: 48, padX: 24, padY: 17, gap: 14 },
      })
      m.h = m.padY * 2 + m.row * 4 + m.gap
      const STACK_GAP = ctx.pick({ '9x16': 10, default: 14 })
      const M = 14 // the brackets stand this far off the receipt, and stay inside the content area

      // ── geometry, re-composed per format ──────────────────────────────────
      // nodes: centre + where the caption sits; legs: the right-angled route
      // between consecutive nodes; wire: CONFIRMATION → receipt; hero: the
      // receipt while it prints; win: the clipped window the history scrolls in.
      // bus: where 02 SET's three level lines leave the right edge on its last
      // frame (entry-line y), so they re-enter here at the same height; hairY:
      // the y of the ENTRY line that 11-bothways opens on, which the closing
      // hairline hands over to. Both are read off those scenes: re-check them
      // if either neighbour's layout changes.
      let G
      if (F === '16x9') {
        // Route zig-zags left to right across the upper stage; receipt lower
        // right under CONFIRMATION; headline lower left.
        const R = 28
        const yHi = c.y + 124
        const yLo = c.y + 224
        const xs = [0, 1, 2, 3].map(i => c.x + 94 + i * 440)
        const ys = [yLo, yHi, yLo, yHi]
        const colW = 600
        const hero = { x: xs[3] - colW / 2, y: bottom - M - m.h, w: colW, h: m.h }
        const winY = yHi + R + 20
        G = {
          R,
          nodes: xs.map((x, i) => ({ x, y: ys[i], cap: ys[i] === yHi ? 'above' : 'below' })),
          legs: [0, 1, 2].map(i => {
            const mid = (xs[i] + xs[i + 1]) / 2
            return [[xs[i], ys[i]], [mid, ys[i]], [mid, ys[i + 1]], [xs[i + 1], ys[i + 1]]]
          }),
          wire: [[xs[3], yHi], [xs[3], hero.y]],
          hero,
          win: { x: hero.x, y: winY, w: colW, h: bottom - M - winY },
          head: { x: c.x, w: hero.x - c.x - 72, bottom },
          words: 'h2',
          stack: 6,
          bus: { x: 48, y: 495 },
          hairY: 497,
        }
      } else if (F === '9x16') {
        // Route descends the left edge; captions to its right; receipt column
        // on the right; headline across the top.
        const R = 22
        const headY = c.y + 56
        const zoneY = c.y + 268
        const xL = c.x + 26
        const xR = c.x + 90
        const xs = [xL, xR, xL, xR]
        const ys = [0, 1, 2, 3].map(i => zoneY + 28 + i * 118)
        const colX = c.x + 300
        const colW = right - M - colX
        const hero = { x: colX, y: bottom - M - m.h, w: colW, h: m.h }
        G = {
          R,
          nodes: xs.map((x, i) => ({ x, y: ys[i], cap: i === 3 ? 'wire' : 'right', capX: xR + R + 14 })),
          legs: [0, 1, 2].map(i => {
            const mid = (ys[i] + ys[i + 1]) / 2
            return [[xs[i], ys[i]], [xs[i], mid], [xs[i + 1], mid], [xs[i + 1], ys[i + 1]]]
          }),
          wire: [[xs[3], ys[3]], [colX, ys[3]]],
          hero,
          win: { x: colX, y: zoneY, w: colW, h: bottom - M - zoneY },
          head: { x: c.x, w: c.w, top: headY },
          words: 'h2',
          stack: 3,
          bus: { x: 52, y: 850 },
          hairY: 811,
        }
      } else {
        // 4:5 — the route wraps the stage as an L (two nodes across, two
        // down); headline and receipt sit inside it.
        const R = 26
        const yTop = c.y + 138
        const x0 = c.x + 76
        const xC = right - 64
        const winY = c.y + 470
        const yEnd = Math.round(winY + (bottom - winY) / 2 + 40)
        // Equal leg lengths, so the pulse keeps one speed round the corner.
        const leg = (xC - x0 + (yEnd - yTop)) / 3
        const x1 = Math.round(x0 + leg)
        const y2 = Math.round(yTop + (leg - (xC - x1)))
        const colX = c.x + M
        const colW = 672
        const hero = { x: colX, y: yEnd - Math.round(m.h / 2), w: colW, h: m.h }
        G = {
          R,
          nodes: [
            { x: x0, y: yTop, cap: 'above' },
            { x: x1, y: yTop, cap: 'above' },
            { x: xC, y: y2, cap: 'left' },
            { x: xC, y: yEnd, cap: 'wire-left' },
          ],
          legs: [
            [[x0, yTop], [x1, yTop]],
            [[x1, yTop], [xC, yTop], [xC, y2]],
            [[xC, y2], [xC, yEnd]],
          ],
          wire: [[xC, yEnd], [colX + colW, yEnd]],
          hero,
          win: { x: colX, y: winY, w: colW, h: bottom - M - winY },
          head: { x: c.x, w: 700, top: yTop + R + 50 },
          words: 'h2',
          stack: 4,
          bus: null,
          hairY: 716,
        }
      }
      const R = G.R
      const n0 = G.nodes[0]

      kit.grid(root)
      const all = el('div', 'tr-all', root)

      // ── traces ────────────────────────────────────────────────────────────
      const route = polyline(G.legs.reduce((pts, leg, i) => pts.concat(i ? leg.slice(1) : leg), []))
      const legLen = G.legs.map(leg => polyline(leg).total)
      const sNode = [0]
      for (const len of legLen) sNode.push(sNode[sNode.length - 1] + len)
      const wire = polyline(G.wire)

      const lines = svg('svg', { class: 'k-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, all)
      const stroke = (d, color, extra) => svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'miter', ...extra }, lines)
      // The three levels set in chapter 2 arrive from the left edge as a bus
      // (limit, entry, stop: same order, spacing and colours as they left 02 SET)
      // and merge into ORDER.
      const BUS = 18
      const merge = n0.x - R - 30
      const lane = k => {
        // k = -1 limit (outside of the turn), 0 entry, +1 stop
        const end = k ? [[merge, n0.y + k * BUS], [merge, n0.y]] : [[n0.x, n0.y]]
        if (!G.bus) return [[-6, n0.y + k * BUS], ...end]
        return [[-6, G.bus.y + k * BUS], [G.bus.x + k * BUS, G.bus.y + k * BUS], [G.bus.x + k * BUS, n0.y + k * BUS], ...end]
      }
      const leads = [
        { color: 'var(--accent)', pts: lane(-1) },
        { color: 'var(--white)', pts: lane(0), dash: '12 8' },
        { color: 'var(--amber)', pts: lane(1) },
      ].map(lead => {
        const line = polyline(lead.pts)
        return { line, grey: stroke(line.d, 'var(--grey)'), tint: stroke(line.d, lead.color, lead.dash ? { 'stroke-dasharray': lead.dash } : null), dot: null, color: lead.color }
      })
      const ghost = stroke(route.d + ' ' + wire.d, 'var(--grey)', { opacity: 0.3 })
      const base = stroke(route.d, 'var(--grey)', { opacity: 0.7 })
      const wireBase = stroke(wire.d, 'var(--grey)', { opacity: 0.7 })
      const lit = stroke(route.d, 'var(--accent)', { opacity: 0.6 })
      const wireLit = stroke(wire.d, 'var(--accent)', { opacity: 0.6 })
      // Direction of travel, marked at the middle of each leg.
      const chevrons = G.legs.map(leg => {
        const line = polyline(leg)
        const [x, y] = line.at(line.total / 2)
        const [x2, y2] = line.at(line.total / 2 + 1)
        const angle = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI
        return svg('path', { d: 'M-7,-8 L1,0 L-7,8', transform: `translate(${x},${y}) rotate(${angle})`, fill: 'none', stroke: 'var(--grey)', 'stroke-width': 2 }, lines)
      })

      // ── nodes: ring + centre, unlit ───────────────────────────────────────
      const nodes = G.nodes.map((n, i) => {
        const g = svg('g', null, lines)
        const halo = svg('circle', { r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }, g)
        const ring = svg('circle', { r: R, fill: 'var(--void)', stroke: 'var(--grey)', 'stroke-width': 2 }, g)
        const dot = svg('circle', { r: R * 0.3, fill: 'var(--grey)' }, g)
        return { ...n, g, halo, ring, dot, name: NAMES[i] }
      })

      // ── glowing layer: comet, lit rings ───────────────────────────────────
      const glow = svg('svg', { class: 'k-svg tr-glow', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, all)
      for (const lead of leads) lead.dot = svg('circle', { r: 4, fill: lead.color }, glow)
      const TAIL = [
        { lag: 0.14, width: 2, opacity: 0.25 },
        { lag: 0.09, width: 3, opacity: 0.4 },
        { lag: 0.05, width: 4, opacity: 0.7 },
        { lag: 0.02, width: 6, opacity: 1 },
      ].map(spec => ({ ...spec, path: svg('path', { d: route.d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': spec.width, opacity: spec.opacity, 'stroke-linejoin': 'miter' }, glow) }))
      const head = svg('circle', { r: 7, fill: 'var(--white)', stroke: 'var(--accent)', 'stroke-width': 2 }, glow)
      for (const n of nodes) {
        n.litRing = svg('circle', { cx: n.x, cy: n.y, r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }, glow)
        n.litDot = svg('circle', { cx: n.x, cy: n.y, r: R * 0.3, fill: 'var(--accent)' }, glow)
      }

      // ── node captions ─────────────────────────────────────────────────────
      for (const n of nodes) {
        const cap = el('div', 'tr-name t-label', all, n.name)
        const box = cap.getBoundingClientRect()
        const pad = 14
        let x
        let y
        if (n.cap === 'above' || n.cap === 'below') {
          x = clamp(n.x - box.width / 2, c.x, right - box.width)
          y = n.cap === 'above' ? n.y - R - pad - box.height : n.y + R + pad
        } else if (n.cap === 'right') {
          x = n.capX
          y = n.y - box.height / 2
        } else if (n.cap === 'left') {
          x = n.x - R - 16 - box.width
          y = n.y - box.height / 2
        } else if (n.cap === 'wire') {
          // Sits on the wire that leaves the node, like a net label.
          x = n.capX
          y = n.y - 12 - box.height
        } else {
          x = n.x - R - 16 - box.width
          y = n.y - 12 - box.height
        }
        cap.style.left = Math.round(x) + 'px'
        cap.style.top = Math.round(y) + 'px'
        n.capEl = cap
      }

      // ── receipts ──────────────────────────────────────────────────────────
      const FADE = 26 // soft edge of the history window once it scrolls
      const win = el('div', 'tr-window', all)
      win.style.left = G.win.x + 'px'
      win.style.top = G.win.y + 'px'
      win.style.width = G.win.w + 'px'
      win.style.height = G.win.h + 'px'
      const stack = el('div', 'tr-stack', win)
      const makeReceipt = (data, index) => {
        const node = el('div', 'tr-receipt', stack)
        node.style.top = index * (m.h + STACK_GAP) + 'px'
        node.style.height = m.h + 'px'
        node.style.padding = `${m.padY - 1}px ${m.padX - 1}px`
        node.style.fontSize = m.font + 'px'
        node.style.lineHeight = m.row + 'px'
        const hd = el('div', 'hd', node)
        el('span', null, hd, data.sym)
        el('span', data.side === 'BUY' ? 'c-amber' : 'c-ice', hd, `  ${data.side}  `)
        el('span', null, hd, `${data.size} LOT`)
        const rule = el('div', 'rule', node)
        rule.style.margin = `${(m.gap - 1) / 2}px 0`
        const rows = [['REQUESTED', data.req], ['FILLED', data.fill], ['TIME', data.time, ' UTC']].map(([key, value, unit]) => {
          const row = el('div', 'row', node)
          el('span', 'k', row, key)
          const val = el('span', 'v', row)
          const num = el('span', null, val, value)
          if (unit) el('span', 'u', val, unit)
          return { row, num }
        })
        return { el: node, hd, rule, rows }
      }
      // The time-stamp is the corner clock's own value at the frame it prints on.
      const stampAt = ctx.start + PRINT[2]
      const heroData = { sym: 'EUR/USD', side: 'BUY', size: '0.10', req: '1.08432', fill: '1.08433', time: kit.clock(stampAt) }
      const receipts = [heroData, ...HISTORY.slice(0, G.stack - 1)].map(makeReceipt)
      const heroBox = receipts[0].el.getBoundingClientRect()
      const rowBox = i => receipts[0].rows[i].row.getBoundingClientRect()
      const valBox = i => receipts[0].rows[i].num.getBoundingClientRect()
      // Positions inside the hero receipt, relative to its top-left (the stage is unscaled while building).
      const rel = {
        rowMid: [0, 1].map(i => rowBox(i).top + rowBox(i).height / 2 - heroBox.top),
        numLeft: Math.min(valBox(0).left, valBox(1).left) - heroBox.left,
      }

      const pad = svg('rect', { width: 10, height: 10, x: G.wire[1][0] - 5, y: G.wire[1][1] - 5, fill: 'var(--void)', stroke: 'var(--grey)', 'stroke-width': 2 }, lines)

      const waiting = kit.brackets(all, { color: 'var(--grey)' })
      const frame = kit.brackets(all)
      const cal = kit.caliper(all, { orientation: 'v' })

      // ── headlines ─────────────────────────────────────────────────────────
      const place = h => {
        h.el.style.top = (G.head.top !== undefined ? G.head.top : G.head.bottom - h.height) + 'px'
        return h
      }
      const question = place(kit.headline(all, ['WHERE DID', 'YOUR ORDER GO?'], { tier: 'display', x: G.head.x, y: 0, w: G.head.w }))
      const words = place(kit.headline(all, ['REQUESTED.', 'FILLED.', 'TIME-STAMPED.'], { tier: G.words, x: G.head.x, y: 0, w: G.head.w }))
      const record = place(kit.headline(all, ['EVERY ORDER.', 'ON THE RECORD.'], { tier: 'display', x: G.head.x, y: 0, w: G.head.w }))

      // ── chapter tab and tag ───────────────────────────────────────────────
      const tab = kit.chapterTab(all, '03', 'TRACE', { x: c.x, y: c.y })
      // The numeral slams in at the centre of the stage and docks onto the
      // tab by 30.5, the same move as 01 and 02.
      const tabNum = tab.el.querySelector('.num')
      const tabTitle = tab.el.querySelector('.ttl')
      const numBox = tabNum.getBoundingClientRect()
      const tabFs = parseFloat(getComputedStyle(tabNum).fontSize)
      const big = el('div', 'tr-big', all, '03')
      big.style.fontSize = tabFs + 'px'
      const bigBox = big.getBoundingClientRect()
      const num = {
        rw: bigBox.width / tabFs,
        rh: bigBox.height / tabFs,
        from: { x: c.x + c.w / 2, y: c.y + c.h / 2, size: ctx.pick({ '16x9': 380, '9x16': 300, default: 360 }) },
        to: { x: numBox.left + numBox.width / 2, y: numBox.top + numBox.height / 2, size: tabFs },
      }
      const tag = kit.tag(all, null, { x: 0, y: c.y })
      // Whole-pixel box, so its edges stay crisp (and repeatable) while the scene fades.
      const tagW = Math.ceil(tag.getBoundingClientRect().width)
      tag.style.boxSizing = 'border-box'
      tag.style.width = tagW + 'px'
      tag.style.left = right - tagW + 'px'
      // Its own compositor layer, always: otherwise the browser folds it into
      // whichever layer is beneath it at the time and the anti-aliased corner
      // pixels come out one level different from one seek history to another.
      tag.style.willChange = 'transform'

      // The fade at the end is a copy of the bare background drawn over the
      // scene, rather than group opacity on the scene itself: the pixels of
      // the content never change while it goes, so every frame is repeatable.
      const cover = el('div', 'tr-cover', root)
      kit.grid(cover)
      // The one line left on screen at the end.
      const hair = el('div', 'tr-hair', root)
      hair.style.top = G.hairY + 'px'

      return { G, m, rgb, all, route, sNode, wire, leads, ghost, base, wireBase, lit, wireLit, chevrons, pad, nodes, TAIL, head, win, stack, receipts, rel, waiting, frame, cal, question, words, record, tab, tabNum, tabTitle, big, num, tag, cover, hair, FADE, STACK_GAP, M }
    },

    render(t, ctx, s) {
      const { G, m, rgb, route, sNode, wire } = s
      const R = G.R
      const EPS = 1e-6
      const on = at => t >= at - EPS

      // Position along the route in "legs": 0 at ORDER … 3 at CONFIRMATION.
      const along = u => {
        u = clamp(u, 0, 3)
        const k = Math.min(2, Math.floor(u))
        return lerp(sNode[k], sNode[k + 1], u - k)
      }
      const dash = (path, from, to, total) => {
        path.setAttribute('stroke-dasharray', `${Math.max(0, to - from).toFixed(2)} ${(total + 20).toFixed(2)}`)
        path.setAttribute('stroke-dashoffset', (-from).toFixed(2))
      }

      // ── end: everything fades, one hairline is left ──
      const gone = prog(t, 5.5, fr(12))
      s.cover.style.opacity = gone.toFixed(4)
      s.cover.style.display = gone > 0 ? 'block' : 'none'
      s.hair.style.opacity = (0.6 * clamp(gone * 4)).toFixed(4)
      s.hair.style.transform = `scaleX(${gone.toFixed(4)})`

      // ── chapter numeral and tab ──
      s.tab.show(t, 0.5 - 0.08)
      s.tabTitle.style.transform = `translate(${Math.round((1 - prog(t, 0.5 + 0.08, 0.3, ease.snap)) * 14)}px,0px)`
      const docked = on(0.5)
      s.tabNum.style.opacity = docked ? '1' : '0'
      s.big.style.display = docked ? 'none' : 'block'
      if (!docked) {
        const slam = 1 + 0.14 * (1 - prog(t, 0, fr(6), ease.expo.out))
        const dock = prog(t, fr(6), fr(9), ease.quint.inOut)
        const size = lerp(s.num.from.size * slam, s.num.to.size, dock)
        const cx = lerp(s.num.from.x, s.num.to.x, dock)
        const cy = lerp(s.num.from.y, s.num.to.y, dock)
        s.big.style.fontSize = size.toFixed(3) + 'px'
        s.big.style.transform = `translate(${(cx - (s.num.rw * size) / 2).toFixed(3)}px,${(cy - (s.num.rh * size) / 2).toFixed(3)}px)`
      }

      // ── route draws on in 15 frames; the three levels feed ORDER ──
      const drawn = along(t / (0.5 / 3))
      dash(s.base, 0, drawn, route.total)
      const wireDrawn = prog(t, 0.5, fr(4)) * wire.total
      dash(s.wireBase, 0, wireDrawn, wire.total)
      s.pad.style.opacity = on(0.5 + fr(4)) ? '1' : '0'
      const settle = prog(t, 0.5, fr(10))
      for (const lead of s.leads) {
        lead.tint.setAttribute('opacity', (1 - settle).toFixed(4))
        lead.grey.setAttribute('opacity', (0.7 * settle).toFixed(4))
        // A dot rides each level into ORDER and arrives on the beat.
        const p = prog(t, 0.5 - fr(10), fr(10))
        const [x, y] = lead.line.at(p * lead.line.total)
        lead.dot.setAttribute('cx', x.toFixed(2))
        lead.dot.setAttribute('cy', y.toFixed(2))
        lead.dot.setAttribute('opacity', p > 0 && p < 1 ? '1' : '0')
      }

      s.chevrons.forEach((mark, i) => {
        mark.setAttribute('opacity', on((i + 0.5) * (0.5 / 3)) ? '1' : '0')
        mark.setAttribute('stroke', on(LIT[i] + 0.25) ? 'var(--accent)' : 'var(--grey)')
      })

      // ── pulse with a short comet tail ──
      const u = (t - LIT[0]) / 0.5
      const at = along(u)
      dash(s.lit, 0, on(LIT[0]) ? at : 0, route.total)
      const flying = on(LIT[0]) && t < LIT[3] + 0.14
      for (const tail of s.TAIL) {
        const from = along(u - tail.lag / 0.5)
        dash(tail.path, from, at, route.total)
        tail.path.style.opacity = flying && at - from > 0.5 ? '' : '0'
      }
      const [hx, hy] = route.at(at)
      s.head.setAttribute('cx', hx.toFixed(2))
      s.head.setAttribute('cy', hy.toFixed(2))
      s.head.setAttribute('opacity', on(LIT[0]) && t < LIT[3] + fr(1) ? '1' : '0')
      // CONFIRMATION hands the pulse on to the receipt.
      dash(s.wireLit, 0, prog(t, LIT[3], fr(4)) * wire.total, wire.total)
      s.pad.setAttribute('stroke', on(LIT[3] + fr(4)) ? 'var(--accent)' : 'var(--grey)')

      // ── nodes ──
      s.nodes.forEach((n, i) => {
        // ORDER is already there on the cut; the others pop as the trace reaches them.
        const popAt = i ? i * (0.5 / 3) : -1
        const pop = prog(t, popAt, fr(6), ease.snap)
        n.g.setAttribute('transform', `translate(${n.x},${n.y}) scale(${lerp(0.5, 1, pop).toFixed(4)})`)
        n.g.setAttribute('opacity', on(popAt) ? clamp((t - popAt) / fr(2) + 0.5).toFixed(4) : '0')
        const isLit = on(LIT[i])
        const since = t - LIT[i]
        // Lighting: a ring expands and dies away, the centre holds white for two frames.
        const ping = prog(t, LIT[i], fr(10), ease.cubic.out)
        n.halo.setAttribute('r', (R + ping * R * 1.1).toFixed(2))
        n.halo.setAttribute('opacity', isLit ? (0.8 * (1 - ping)).toFixed(4) : '0')
        n.litRing.setAttribute('opacity', isLit ? '1' : '0')
        n.litDot.setAttribute('opacity', isLit ? '1' : '0')
        n.litDot.setAttribute('fill', isLit && since < fr(2) - EPS ? 'var(--white)' : 'var(--accent)')
        n.litDot.setAttribute('r', (R * lerp(0.46, 0.3, prog(t, LIT[i], fr(6), ease.snap))).toFixed(2))
        n.capEl.style.opacity = on(popAt) ? '1' : '0'
        n.capEl.style.color = isLit ? 'var(--white)' : 'var(--grey)'
      })

      // ── headlines ──
      rise(s.question, t, { at: 0.5, each: fr(5), out: 1.75 })
      s.question.el.style.opacity = t < 2 - EPS ? '1' : '0'
      rise(s.words, t, { at: PRINT })
      s.words.el.style.opacity = on(2) && t < 4 - EPS ? '1' : '0'
      rise(s.record, t, { at: -1, each: 0 }) // hard cut on the bar line: already set
      s.record.el.style.opacity = on(4) ? '1' : '0'

      // ── receipt: opens at 2.0, prints a row per beat ──
      const hero = s.receipts[0]
      const open = prog(t, 2, fr(8), ease.snap)
      hero.el.style.opacity = on(2) ? '1' : '0'
      hero.el.style.clipPath = open < 1 ? `inset(0 0 ${((1 - open) * 100).toFixed(3)}% 0)` : 'none'
      hero.rows.forEach((row, i) => {
        row.row.style.opacity = on(PRINT[i]) ? '1' : '0'
        // Detent: the value lands in the accent colour and cools to white.
        row.num.style.color = mix(rgb.accent, rgb.white, prog(t, PRINT[i] + fr(2), fr(8)))
      })

      // ── history: the hero becomes the top of a stack that scrolls upward ──
      const stacked = prog(t, 4, fr(9), ease.snap)
      const restY = s.FADE
      const heroY = G.hero.y - G.win.y
      // Constant 2 px a frame: every step lands on a whole pixel, so the type never shimmers.
      const scroll = Math.max(0, Math.round((t - 4) * AD.fps)) * 2
      const stackY = Math.round(lerp(heroY, restY, stacked)) - scroll
      s.stack.style.transform = `translate(0px,${stackY}px)`
      const soft = (s.FADE * prog(t, 4, fr(6))).toFixed(2)
      const mask = on(4) ? `linear-gradient(to bottom, transparent 0px, #000 ${soft}px, #000 calc(100% - ${soft}px), transparent 100%)` : 'none'
      s.win.style.webkitMaskImage = mask
      s.win.style.maskImage = mask
      s.receipts.forEach((r, i) => {
        if (!i) return
        const inAt = 4 + (i - 1) * fr(3)
        const p = prog(t, inAt, fr(8), ease.snap)
        r.el.style.opacity = on(inAt) ? clamp(p * 2).toFixed(4) : '0'
        r.el.style.transform = `translate(0px,${Math.round((1 - p) * m.h * 0.3)}px)`
      })

      // ── brackets: grey while the answer is unknown, accent once it is on record ──
      const M = s.M
      const heroRect = { x: G.hero.x - M, y: G.hero.y - M, w: G.hero.w + 2 * M, h: G.hero.h + 2 * M }
      const winRect = { x: G.win.x - M, y: G.win.y + s.FADE - M, w: G.win.w + 2 * M, h: G.win.h - s.FADE + M }
      s.waiting.set({ ...heroRect, opacity: on(2) ? 0 : 0.55 * prog(t, 0.5, fr(8)) })
      const grow = k => lerp(heroRect[k], winRect[k], stacked)
      const tight = 1 - prog(t, 2, fr(8), ease.snap)
      s.frame.set({ x: grow('x') - tight * 18, y: grow('y') - tight * 18, w: grow('w') + tight * 36, h: grow('h') + tight * 36, opacity: on(2) ? 1 : 0 })

      // ── caliper on the two prices: both are shown, the gap is not dressed up ──
      const calOpen = prog(t, 3.5, fr(9), ease.snap)
      s.cal.set({
        a: G.hero.y + s.rel.rowMid[0],
        b: G.hero.y + s.rel.rowMid[1],
        pos: G.hero.x + s.rel.numLeft - 30,
        jaw: -16,
        open: calOpen,
        opacity: on(3.5) && t < 4 - EPS ? 1 : 0,
      })
    },
  })
})()
