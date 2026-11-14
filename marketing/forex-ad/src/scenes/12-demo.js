/* Scene 12 — the demonstration and the first call to action (40–48 s).
 *
 * A stylised mock of the platform in demo mode: chart, order ticket and (where
 * it is legible) a positions strip. A round cursor sets size, stop-loss and
 * limit, the levels appear on the chart, the order is placed on the 44.0 bar
 * line and its record is printed. Four headline beats of two seconds each end
 * on the URL.
 *
 * Compliance: no profit-and-loss, balance or equity anywhere. The price path is
 * scripted with zero drift: after the order it ranges on both sides of the
 * entry (first against it), never approaches the limit and ends on the entry.
 * The record's time-stamp is the corner clock frozen at the instant of the
 * press, so the two agree to the millisecond on that frame.
 */
;(function () {
  'use strict'
  const f = 1 / 30
  // kit.headline moves its lines with translate3d on a will-change layer. A
  // composited layer keeps the raster of whichever frame painted it first, so
  // its pixels depend on what was rendered before. Here every transform is 2-D
  // and painted in place, which keeps each frame a pure function of time.
  const FLAT = /translate3d\(0(?:px)?, ?([^,]+), ?0(?:px)?\)/

  // Scene-local times (seconds after 40.0). Everything sits on the 0.5 s grid;
  // sub-beat accents on the 5-frame grid.
  const TM = {
    badge: 0.5,
    candles: 1.0, // history sweeps in
    live: 1.5, // one live candle per beat from here
    clicks: [2.0, 2.0 + 5 * f, 2.0 + 10 * f], // size stepper: 0.01 → 0.02 → 0.05 → 0.10
    stop: 2.5,
    limit: 3.0,
    toButton: 3.5,
    press: 4.0, // bar line: the order and its time-stamp
    card: 4.5, // record opens
    lines: 5.0, // requested / filled print
    footer: 5.5,
    cta: 6.0, // position row, URL
  }
  const SIZES = ['0.01', '0.02', '0.05', '0.10']

  // Prices, in pips from the entry. The entry is the BUY quote at the press.
  const ENTRY_POINTS = 108432 // 1.08432 in points (0.00001)
  const SPREAD_POINTS = 12 // SELL 1.08420 / BUY 1.08432
  const STOP = -25 // 1.08182
  const LIMIT = 25 // 1.08682
  const RANGE = 31.5 // half-height of the chart
  const GRID = [-13.2, 11.8] // 1.08300 and 1.08550: round prices clear of the three levels
  const fmt = pips => ((ENTRY_POINTS + Math.round(pips * 10)) / 100000).toFixed(5)
  const fmtSell = pips => ((ENTRY_POINTS - SPREAD_POINTS + Math.round(pips * 10)) / 100000).toFixed(5)

  // Closes of the live candles (one per beat from 41.5). 43.0–44.0 holds the
  // quote on the entry so the request can be read; after the press the price
  // dips, crosses the entry upward, crosses back and ends on it.
  const SCRIPT = [-2.0, -6.0, 2.0, 0.0, 0.0, -4.0, -7.0, 2.0, 5.5, -1.0, -5.5, -2.5, 0.0]
  const HIST_END = 4.0

  function buildCandles(n0) {
    const r = AD.rng(4127)
    const gauss = () => (r() + r() + r() + r() - 2) / 2
    // History is generated backwards from the value the script starts at; a
    // mean-reverting walk reads the same in both directions.
    const rev = [HIST_END]
    let v = HIST_END
    for (let i = 0; i < n0; i++) {
      v = AD.clamp(v + gauss() * 12 - v * 0.2, -12, 12)
      rev.push(v)
    }
    const closes = rev.reverse().concat(SCRIPT) // closes[i] = open of candle i, closes[i + 1] = its close
    const candles = []
    for (let i = 0; i + 1 < closes.length; i++) {
      const o = closes[i]
      const c = closes[i + 1]
      const flat = Math.abs(o - c) < 0.05
      candles.push({
        o,
        c,
        h: Math.max(o, c) + (flat ? 1.2 : 0.6 + Math.abs(gauss()) * 5),
        l: Math.min(o, c) - (flat ? 1.0 : 0.6 + Math.abs(gauss()) * 5),
      })
    }
    return { closes, candles }
  }

  /** Progress of the live candles at t: whole part = finished, fraction = growing. */
  function liveUnits(t, nLive) {
    const u = AD.clamp((t - TM.live) / 0.5, 0, nLive)
    const i = Math.min(Math.floor(u + 1e-6), nLive - 1)
    let fr = u - i
    // The last candle completes five frames early so the scene ends on the entry.
    if (i === nLive - 1) fr = Math.min(1, fr * 1.5)
    return i + fr
  }

  /** BUY quote in pips from the entry; ticks on the 5-frame grid. */
  function quotePips(S, t) {
    const k = Math.floor(t * 6 + 1e-6)
    const tq = k / 6
    const u = liveUnits(tq, SCRIPT.length)
    const i = Math.min(Math.floor(u + 1e-6), SCRIPT.length - 1)
    const base = AD.lerp(S.closes[S.n0 + i], S.closes[S.n0 + i + 1], AD.clamp(u - i))
    const steady = tq > TM.limit + 0.4 && tq < TM.press + 0.1
    const jitter = k % 3 === 0 || steady || tq > 7.6 ? 0 : (AD.hash(k * 17 + 3) - 0.5) * 0.9
    return base + jitter
  }

  AD.defineScene('demo', {
    css: `
      .scene--demo .k-headline .ln > span { will-change: auto; }
      .scene--demo .d-abs { position: absolute; box-sizing: border-box; }
      .scene--demo .d-layer { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
      .scene--demo .d-lab { font-family: var(--font-display); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--grey); white-space: nowrap; line-height: 1; font-size: var(--d-label); }
      .scene--demo .d-num { font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums slashed-zero; white-space: nowrap; line-height: 1; color: var(--white); }

      .scene--demo .d-panel { background: transparent; overflow: hidden; }
      .scene--demo .d-panel .bg { position: absolute; inset: 0; background: var(--graphite); transform-origin: 50% 0; }

      .scene--demo .d-sym { display: flex; align-items: center; font-size: var(--d-sym); font-weight: 600; letter-spacing: 0.02em; }
      .scene--demo .d-badge { height: var(--d-badge-h); transform-origin: 100% 50%; }
      .scene--demo .d-badge .ly { display: flex; align-items: center; gap: 12px; height: 100%; box-sizing: border-box; padding: 0 14px; border: 2px solid var(--accent); border-radius: 4px; font-family: var(--font-mono); font-weight: 600; font-size: var(--d-badge); letter-spacing: 0.08em; line-height: 1; white-space: nowrap; }
      .scene--demo .d-badge .ly i { width: 1px; height: 52%; background: currentColor; opacity: 0.55; }
      .scene--demo .d-badge .ol { color: var(--white); background: rgba(7, 11, 16, 0.6); }
      .scene--demo .d-badge .ol b { color: var(--accent); font-weight: 600; }
      .scene--demo .d-badge .fl { position: absolute; inset: 0; background: var(--accent); color: var(--void); }
      .scene--demo .d-badge .fl b { font-weight: 600; }

      .scene--demo .d-axis { font-family: var(--font-mono); font-weight: 500; font-size: var(--d-chip); color: var(--grey); text-align: right; line-height: 1; }
      .scene--demo .d-chip { left: 0; top: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; height: var(--d-chip-h); border-radius: 3px; color: var(--void); line-height: 1; white-space: nowrap; }
      .scene--demo .d-chip .l { font-family: var(--font-display); font-weight: 600; letter-spacing: 0.08em; font-size: calc(var(--d-chip) * 1.06); }
      .scene--demo .d-chip .p { font-family: var(--font-mono); font-weight: 600; font-size: var(--d-chip); }

      .scene--demo .d-tile, .scene--demo .d-field { display: flex; border: 1px solid var(--hairline); border-radius: 4px; background: rgba(7, 11, 16, 0.5); padding: 0 var(--d-padx); }
      .scene--demo .d-tile { flex-direction: column; justify-content: center; gap: 9px; }
      .scene--demo .d-tile .d-num { font-size: var(--d-quote); }
      .scene--demo .d-tile.inline { flex-direction: row; align-items: center; justify-content: space-between; }
      .scene--demo .d-field { align-items: center; justify-content: space-between; }
      .scene--demo .d-field.stack { flex-direction: column; align-items: flex-start; justify-content: center; gap: 7px; }
      .scene--demo .d-field .d-num { font-size: var(--d-value); }
      .scene--demo .d-step { display: flex; align-items: center; gap: 10px; }
      .scene--demo .d-step .sq { width: var(--d-sq); height: var(--d-sq); box-sizing: border-box; border: 1px solid var(--hairline); border-radius: 3px; display: grid; place-items: center; font: 500 var(--d-label) / 1 var(--font-mono); color: var(--grey); }

      .scene--demo .d-btn { display: grid; place-items: center; border-radius: 4px; background: var(--accent); overflow: hidden; }
      .scene--demo .d-btn .sw { position: absolute; inset: 0; background: color-mix(in srgb, var(--accent) 56%, var(--void)); transform-origin: 0 50%; }
      .scene--demo .d-btn .tx { position: relative; font-family: var(--font-display); font-weight: 600; font-size: var(--d-btn); letter-spacing: 0.1em; color: var(--void); line-height: 1; white-space: nowrap; }

      .scene--demo .d-time { display: flex; align-items: center; justify-content: space-between; padding: 0 var(--d-padx); border-top: 1px solid var(--hairline); }
      .scene--demo .d-time .d-num { font-size: var(--d-time); }
      .scene--demo .d-time .utc { margin-left: 0.5em; color: var(--grey); }

      .scene--demo .d-rcpt { border: 1px solid rgba(128, 148, 168, 0.45); border-radius: 4px; background: var(--void); display: flex; flex-direction: column; justify-content: space-evenly; padding: 2px var(--d-padx) var(--d-time-h); }
      .scene--demo .d-rcpt .ttl { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-weight: 600; font-size: var(--d-rtitle); letter-spacing: 0.1em; color: var(--white); line-height: 1; white-space: nowrap; }
      .scene--demo .d-rcpt .ttl i { width: 9px; height: 9px; background: var(--accent); flex: none; }
      .scene--demo .d-rcpt .cells { display: flex; gap: var(--d-cellgap); }
      .scene--demo .d-rcpt .cell { display: flex; align-items: baseline; gap: 10px; flex: 1; }
      .scene--demo .d-rcpt .cell .d-num { font-size: var(--d-rval); }
      .scene--demo .d-rcpt.stack .cells { flex-direction: column; gap: 14px; }
      .scene--demo .d-rcpt.stack .cell { justify-content: space-between; }

      .scene--demo .d-strip { display: flex; flex-direction: column; justify-content: center; padding: 0 16px; }
      .scene--demo .d-strip .row { display: grid; grid-template-columns: 1.5fr 0.9fr 0.9fr 1.3fr 1.3fr 1.3fr 1.2fr; align-items: center; }
      .scene--demo .d-strip .hd { height: var(--d-strip-hd); border-bottom: 1px solid var(--hairline); }
      .scene--demo .d-strip .hd .d-lab { font-size: var(--d-col); }
      .scene--demo .d-strip .bd { height: var(--d-strip-bd); overflow: hidden; }
      .scene--demo .d-strip .bd .d-num { font-size: var(--d-cell); }

      .scene--demo .d-foot { display: flex; align-items: center; overflow: hidden; }
      .scene--demo .d-foot span { display: inline-block; font-family: var(--font-text); font-weight: 500; font-size: var(--d-foot); letter-spacing: 0.05em; text-transform: uppercase; color: var(--white); white-space: nowrap; line-height: 1.2; }

      .scene--demo .d-url .m { display: block; overflow: hidden; padding: 0.08em 0.04em 0.12em; margin: -0.08em -0.04em -0.12em; }
      .scene--demo .d-url .tx { display: inline-block; font-family: var(--font-display); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1; color: var(--white); white-space: nowrap; }
      .scene--demo .d-url .ul { height: 3px; background: var(--accent); transform-origin: 0 50%; }

      .scene--demo .d-cursor { left: 0; top: 0; border-radius: 50%; background: var(--white); border: 2px solid var(--void); box-shadow: 0 0 0 1px rgba(234, 242, 248, 0.4), 0 3px 8px rgba(0, 0, 0, 0.6); }
      .scene--demo .d-ring { left: 0; top: 0; border-radius: 50%; border: 2px solid var(--accent); }
    `,

    build(root, ctx) {
      const { el, svg } = AD
      const kit = AD.kit
      const c = ctx.content
      const V = ctx.vertical
      const R = Math.round

      kit.grid(root)
      // Repainted in full on every frame (see render).
      const repaint = el('div', 'd-layer', root)
      repaint.style.backgroundImage = 'linear-gradient(to right, rgba(7, 11, 16, 0), rgba(7, 11, 16, 0))'

      // ── metrics per format ─────────────────────────────────────────────
      const M = ctx.pick({
        '16x9': {
          hdrH: 44, footH: 30, stripH: 100, ticketW: 452, pad: 16, secGap: 12, quoteH: 88, fieldH: 56, btnH: 68, timeH: 36, axisW: 160, step: 20, cursor: 22,
          css: { label: 20, value: 24, quote: 28, sym: 27, badge: 21, 'badge-h': 38, chip: 19, 'chip-h': 28, btn: 26, time: 20, 'time-h': 36, rtitle: 22, rval: 22, cellgap: 12, col: 20, cell: 21, 'strip-hd': 40, 'strip-bd': 50, foot: 21, sq: 30, padx: 14 },
        },
        '4x5': {
          hdrH: 46, footH: 34, stripH: 112, ticketW: 404, pad: 16, secGap: 14, quoteH: 110, fieldH: 88, btnH: 80, timeH: 40, axisW: 164, step: 18, cursor: 26,
          css: { label: 22, value: 28, quote: 30, sym: 28, badge: 22, 'badge-h': 40, chip: 19.5, 'chip-h': 30, btn: 30, time: 21, 'time-h': 40, rtitle: 23, rval: 24, cellgap: 0, col: 20, cell: 22, 'strip-hd': 44, 'strip-bd': 56, foot: 23, sq: 34, padx: 14 },
        },
        '9x16': {
          hdrH: 38, footH: 28, stripH: 0, ticketW: 0, pad: 12, secGap: 8, quoteH: 56, fieldH: 62, btnH: 60, timeH: 32, axisW: 160, step: 20, cursor: 24,
          css: { label: 20, value: 26, quote: 28, sym: 26, badge: 21, 'badge-h': 36, chip: 19, 'chip-h': 28, btn: 28, time: 20, 'time-h': 32, rtitle: 24, rval: 28, cellgap: 44, col: 20, cell: 21, 'strip-hd': 0, 'strip-bd': 0, foot: 21, sq: 30, padx: 12 },
        },
      })
      for (const [k, v] of Object.entries(M.css)) root.style.setProperty(`--d-${k}`, v + 'px')

      const put = (node, r) => {
        node.style.left = r.x + 'px'
        node.style.top = r.y + 'px'
        if (r.w !== undefined) node.style.width = r.w + 'px'
        if (r.h !== undefined) node.style.height = r.h + 'px'
        return node
      }
      const origin = root.getBoundingClientRect()
      const rectOf = node => {
        const b = node.getBoundingClientRect()
        return { x: b.left - origin.left, y: b.top - origin.top, w: b.width, h: b.height }
      }
      const tierPx = tier => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--t-${tier}`))
      const CAP_TOP = 0.17 // cap top below the top of a headline line box, in em
      const CAP = 0.7 // cap height, in em

      // ── headline beats and the window rectangle ────────────────────────
      const url = el('div', 'd-abs d-url', root)
      const urlMask = el('span', 'm', url)
      const urlText = el('span', 'tx', urlMask, ctx.config.brand.url)
      const urlLine = el('div', 'ul', url)
      const beats = []
      let win
      if (ctx.landscape) {
        // Headline column on the left third, window on the right two thirds.
        const headW = 524
        const disp = tierPx('display')
        const h2 = tierPx('h2')
        const mk = (lines, tier, size) => kit.headline(root, lines, { tier, x: c.x, y: R(c.y - size * CAP_TOP), w: headW })
        const b4 = mk(['PRACTISE WITH', 'VIRTUAL FUNDS.'], 'h2', h2)
        beats.push(
          { blocks: [mk(['TRY THE', 'DEMO.'], 'display', disp)], at: [[-2 * f, 0]] },
          { blocks: [mk(['SET YOUR', 'LEVELS.'], 'display', disp)], at: [[2 - f, 2 + f]] },
          { blocks: [mk(['PLACE IT.', 'READ THE', 'RECORD.'], 'display', disp)], at: [[4 - f, 4.5 - f, 4.5 + f]] },
          { blocks: [b4], at: [[6 - f, 6 + f]] },
        )
        const urlSize = 62
        urlText.style.fontSize = urlSize + 'px'
        put(url, { x: c.x, y: R(c.y - h2 * CAP_TOP + b4.height + 26) })
        urlLine.style.marginTop = '12px'
        const x = c.x + headW + 44
        win = { x, y: c.y, w: c.x + c.w - x, h: c.h }
      } else {
        // Headline zone on top (each beat centred in it), window below.
        const zone = V ? 124 : 148
        const disp = tierPx('display')
        const urlSize = V ? 50 : 60
        const urlGap = V ? 18 : 22
        const single = text => {
          const h = kit.headline(root, [text], { tier: 'display', x: c.x, y: 0, w: c.w })
          const size = parseFloat(getComputedStyle(h.el).fontSize)
          h.size = size
          return h
        }
        const centre = (h, ink) => (h.el.style.top = R(c.y + (zone - ink) / 2 - h.size * CAP_TOP) + 'px')
        const b1 = single('TRY THE DEMO.')
        const b2 = single('SET YOUR LEVELS.')
        centre(b1, b1.size * CAP)
        centre(b2, b2.size * CAP)
        // Beat 3 sets its two sentences on one line so each can land on its own event.
        const a = kit.headline(root, ['PLACE IT.'], { tier: 'display', x: c.x, y: 0, w: 9999 })
        const b = kit.headline(root, ['READ THE RECORD.'], { tier: 'display', x: c.x, y: 0, w: 9999 })
        const space = disp * 0.26
        const k = Math.min(1, c.w / (a.width + space + b.width))
        const size3 = Math.floor(disp * k * 100) / 100
        for (const h of [a, b]) {
          h.el.style.fontSize = size3 + 'px'
          h.size = size3
          centre(h, size3 * CAP)
        }
        b.el.style.left = R(c.x + (a.width + space) * (size3 / disp)) + 'px'
        const b4 = single('PRACTISE WITH VIRTUAL FUNDS.')
        const ink4 = b4.size * CAP + urlGap + urlSize * CAP + 15
        centre(b4, ink4)
        urlText.style.fontSize = urlSize + 'px'
        const top4 = c.y + (zone - ink4) / 2
        put(url, { x: c.x, y: R(top4 + b4.size * CAP + urlGap - urlSize * 0.16) })
        urlLine.style.marginTop = '10px'
        beats.push(
          { blocks: [b1], at: [[-2 * f]] },
          { blocks: [b2], at: [[2 - f]] },
          { blocks: [a, b], at: [[4 - f], [4.5 - f]] },
          { blocks: [b4], at: [[6 - f]] },
        )
        const y = c.y + zone + (V ? 16 : 22)
        win = { x: c.x, y, w: c.w, h: c.y + c.h - y }
      }
      urlLine.style.width = R(urlText.getBoundingClientRect().width) + 'px'

      // ── window layout ──────────────────────────────────────────────────
      const hdr = { x: win.x, y: win.y, w: win.w, h: M.hdrH }
      const foot = { x: win.x, y: win.y + win.h - M.footH, w: win.w, h: M.footH }
      const bodyY = win.y + M.hdrH + 8
      const bodyB = foot.y - 8
      let chart, ticket, strip
      const tk = {} // rectangles inside the ticket
      if (V) {
        const hT = M.pad + M.quoteH + 8 + M.fieldH + 8 + M.btnH + 6 + M.timeH + 10
        ticket = { x: win.x, y: bodyB - hT, w: win.w, h: hT }
        chart = { x: win.x, y: bodyY, w: win.w, h: ticket.y - 8 - bodyY }
        strip = null
        const ix = ticket.x + M.pad
        const iw = ticket.w - 2 * M.pad
        const qw = (iw - 8) / 2
        const y0 = ticket.y + M.pad
        tk.sell = { x: ix, y: y0, w: qw, h: M.quoteH }
        tk.buy = { x: ix + qw + 8, y: y0, w: qw, h: M.quoteH }
        const fw = (iw - 16) / 3
        const yF = y0 + M.quoteH + 8
        tk.fields = [0, 1, 2].map(i => ({ x: R(ix + i * (fw + 8)), y: yF, w: R(fw), h: M.fieldH }))
        tk.btn = { x: ix, y: yF + M.fieldH + 8, w: iw, h: M.btnH }
        tk.time = { x: ix, y: tk.btn.y + M.btnH + 6, w: iw, h: M.timeH }
        // On a phone the record takes the fields' place as well as the button's.
        tk.rcpt = { x: ix, y: yF, w: iw, h: tk.time.y + M.timeH - yF }
      } else {
        strip = { x: win.x, y: bodyB - M.stripH, w: win.w, h: M.stripH }
        const rowB = strip.y - 8
        ticket = { x: win.x + win.w - M.ticketW, y: bodyY, w: M.ticketW, h: rowB - bodyY }
        chart = { x: win.x, y: bodyY, w: win.w - M.ticketW - 8, h: rowB - bodyY }
        const ix = ticket.x + M.pad
        const iw = ticket.w - 2 * M.pad
        const qw = (iw - 8) / 2
        const y0 = ticket.y + M.pad
        tk.sell = { x: ix, y: y0, w: qw, h: M.quoteH }
        tk.buy = { x: ix + qw + 8, y: y0, w: qw, h: M.quoteH }
        const yF = y0 + M.quoteH + M.secGap
        tk.fields = [0, 1, 2].map(i => ({ x: ix, y: yF + i * (M.fieldH + 8), w: iw, h: M.fieldH }))
        const yZ = yF + 3 * M.fieldH + 16 + M.secGap
        const zB = ticket.y + ticket.h - M.pad
        tk.btn = { x: ix, y: yZ, w: iw, h: M.btnH }
        tk.time = { x: ix, y: zB - M.timeH, w: iw, h: M.timeH }
        tk.rcpt = { x: ix, y: yZ, w: iw, h: zB - yZ }
      }

      const ui = el('div', 'd-layer', root)
      const box = (cls, r, parent, text) => put(el('div', 'd-abs ' + cls, parent || ui, text), r)
      const group = () => el('div', 'd-layer', ui)

      // ── panels: hairline rectangles that fill ──────────────────────────
      const panels = [chart, ticket, strip].filter(Boolean).map(r => {
        const p = box('k-panel d-panel', r)
        return { bg: el('div', 'bg', p) }
      })

      // ── window header: symbol, tag, demo badge ─────────────────────────
      const sym = box('d-num d-sym', { x: hdr.x, y: hdr.y, h: hdr.h }, ui, 'EUR/USD')
      const tag = kit.tag(ui)
      const tagBox = tag.getBoundingClientRect()
      put(tag, { x: R(hdr.x + sym.getBoundingClientRect().width + 14), y: R(hdr.y + (hdr.h - tagBox.height) / 2) })
      const badge = box('d-badge', { x: 0, y: R(hdr.y + (hdr.h - M.css['badge-h']) / 2) })
      const badgeHTML = '<b>DEMO ACCOUNT</b><i></i><span>VIRTUAL FUNDS</span>'
      el('div', 'ly ol', badge).innerHTML = badgeHTML
      const badgeFill = el('div', 'ly fl', badge)
      badgeFill.innerHTML = badgeHTML
      badge.style.left = R(hdr.x + hdr.w - badge.getBoundingClientRect().width) + 'px'

      // ── chart ──────────────────────────────────────────────────────────
      const gChart = group()
      const axisGap = 10
      const plot = { x: 14, y: 14, w: chart.w - 14 - M.axisW - axisGap - 10, h: chart.h - 28 }
      const ppp = plot.h / (2 * RANGE) // px per pip
      const yOf = pips => plot.y + plot.h / 2 - pips * ppp
      const axisX = chart.x + plot.x + plot.w + axisGap
      // The plot shows nVis slots; history fills all but the last, which is where candles are born.
      const nVis = Math.floor(plot.w / M.step)
      const n0 = nVis - 1
      const data = buildCandles(n0)
      const axis = GRID.map(p => {
        const node = box('d-axis', { x: axisX, y: R(chart.y + yOf(p) - M.css.chip / 2), w: M.axisW - 8 }, gChart, fmt(p))
        return { node, y: yOf(p) }
      })
      const mkChip = (label, color) => {
        const node = box('d-chip', { x: 0, y: 0, w: M.axisW }, gChart)
        node.style.background = color
        el('span', 'l', node, label)
        return { node, price: el('span', 'p', node) }
      }
      const chips = { stop: mkChip('STOP', 'var(--amber)'), limit: mkChip('LIMIT', 'var(--accent)'), entry: mkChip('ENTRY', 'var(--white)') }
      const css = getComputedStyle(document.documentElement)
      const col = {}
      for (const name of ['white', 'grey', 'hairline', 'accent', 'amber', 'void']) col[name] = css.getPropertyValue(`--${name}`).trim()

      // ── ticket ─────────────────────────────────────────────────────────
      const gTicket = group()
      const mkQuote = (r, label, color) => {
        const node = box('d-tile' + (V ? ' inline' : ''), r, gTicket)
        el('div', 'd-lab', node, label)
        const price = el('div', 'd-num', node)
        price.style.color = color
        return { node, price }
      }
      const sell = mkQuote(tk.sell, 'SELL', 'var(--ice)')
      const buy = mkQuote(tk.buy, 'BUY', 'var(--amber)')
      // The order is a buy: that side is the selected one.
      buy.node.style.borderColor = 'var(--accent)'
      buy.node.style.boxShadow = 'inset 0 0 0 1px var(--accent)'

      const mkField = (r, label) => {
        const node = box('d-field' + (V ? ' stack' : ''), r, gTicket)
        el('div', 'd-lab', node, label)
        return node
      }
      const fSize = mkField(tk.fields[0], 'SIZE')
      const step = el('div', 'd-step', fSize)
      el('div', 'sq', step, '−')
      const sizeVal = el('div', 'd-num', step)
      const plus = el('div', 'sq', step, '+')
      sizeVal.textContent = '0.10'
      sizeVal.style.minWidth = R(sizeVal.getBoundingClientRect().width) + 'px'
      sizeVal.style.textAlign = 'center'
      const fStop = mkField(tk.fields[1], 'STOP-LOSS')
      const stopVal = el('div', 'd-num', fStop)
      const fLimit = mkField(tk.fields[2], 'LIMIT')
      const limitVal = el('div', 'd-num', fLimit)

      const btn = box('d-btn', tk.btn, gTicket)
      const btnSweep = el('div', 'sw', btn)
      const btnText = el('span', 'tx', btn, 'PLACE DEMO ORDER')

      const rcpt = box('d-rcpt' + (ctx.format === '4x5' ? ' stack' : ''), tk.rcpt, gTicket)
      const ttl = el('div', 'ttl', rcpt)
      el('i', null, ttl)
      el('span', null, ttl, 'DEMO ORDER FILLED')
      const cells = el('div', 'cells', rcpt)
      const mkCell = label => {
        const node = el('div', 'cell', cells)
        el('span', 'd-lab', node, label)
        const value = el('span', 'd-num', node)
        return { node, value }
      }
      const requested = mkCell('REQUESTED')
      const filled = mkCell('FILLED')

      // The ticket's clock runs until the press, then stays as the record's time-stamp.
      const time = box('d-time', tk.time, gTicket)
      const timeLab = el('span', 'd-lab', time, 'TIME')
      const timeNum = el('span', 'd-num', time)
      const timeVal = el('span', null, timeNum)
      el('span', 'utc', timeNum, 'UTC')

      // ── positions strip ────────────────────────────────────────────────
      let row = null
      const gStrip = group()
      if (strip) {
        const node = box('d-strip', strip, gStrip)
        const hd = el('div', 'row hd', node)
        for (const name of ['INSTRUMENT', 'SIDE', 'SIZE', 'ENTRY', 'STOP', 'LIMIT', 'TIME']) el('span', 'd-lab', hd, name)
        const bd = el('div', 'bd', node)
        row = el('div', 'row', bd)
        row.style.height = '100%'
        const values = ['EUR/USD', 'BUY', SIZES[3], fmt(0), fmt(STOP), fmt(LIMIT), kit.clock(ctx.start + TM.press).slice(0, 8)]
        const colors = [null, null, null, null, 'var(--amber)', 'var(--accent)', null]
        values.forEach((v, i) => {
          const cell = el('span', 'd-num', row, v)
          if (colors[i]) cell.style.color = colors[i]
        })
      }

      // ── footer disclosure ──────────────────────────────────────────────
      // Legal wording comes from config (the demo sentence of legal.notes).
      const notes = String((ctx.config.legal && ctx.config.legal.notes) || '')
      const disclosure = notes.split(/(?<=[.!?])\s+/).find(x => /demo/i.test(x)) || 'Demo prices and fills may differ from live trading.'
      const footer = el('span', null, box('d-foot', foot), disclosure)

      // ── overlays: edge pulse, focus brackets, cursor ───────────────────
      const pulseSvg = svg('svg', { class: 'k-svg', width: ctx.W, height: ctx.H, viewBox: `0 0 ${ctx.W} ${ctx.H}` }, root)
      const q = 6
      const tr = { l: ticket.x + 0.5, t: ticket.y + 0.5, r: ticket.x + ticket.w - 0.5, b: ticket.y + ticket.h - 0.5 }
      const cx = tk.btn.x + tk.btn.w / 2
      // From under the button, once round the ticket and back.
      const d = `M${cx},${tr.b} H${tr.l + q} A${q},${q} 0 0 1 ${tr.l},${tr.b - q} V${tr.t + q} A${q},${q} 0 0 1 ${tr.l + q},${tr.t} H${tr.r - q} A${q},${q} 0 0 1 ${tr.r},${tr.t + q} V${tr.b - q} A${q},${q} 0 0 1 ${tr.r - q},${tr.b} H${cx}`
      const pulseGlow = svg('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.22, pathLength: 1 }, pulseSvg)
      const pulseCore = svg('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linecap': 'round', pathLength: 1 }, pulseSvg)
      const pulseHead = svg('circle', { r: 4, fill: 'var(--white)' }, pulseSvg)
      const pulseLen = pulseCore.getTotalLength()

      const brackets = kit.brackets(root)

      // Beside the "+" rather than on it, so the control stays readable under the cursor.
      const rPlus = rectOf(plus)
      const pPlus = { x: rPlus.x + rPlus.w / 2 + (V ? 15 : 5), y: rPlus.y + rPlus.h / 2 + (V ? 7 : 16) }
      const fieldPoint = r => (V ? { x: r.x + r.w * 0.8, y: r.y + r.h * 0.62 } : { x: r.x + r.w * 0.5, y: r.y + r.h * 0.56 })
      const pStop = fieldPoint(tk.fields[1])
      const pLimit = fieldPoint(tk.fields[2])
      const labelW = btnText.getBoundingClientRect().width
      const pBtn = { x: Math.min(tk.btn.x + tk.btn.w - 30, tk.btn.x + tk.btn.w / 2 + labelW / 2 + 56), y: tk.btn.y + tk.btn.h * 0.56 }
      const pStart = { x: tk.time.x + tk.time.w * 0.5, y: tk.time.y + tk.time.h * 0.5 }
      // Ease in-out between targets, arriving a few frames early to settle before each click.
      const moves = [
        { t0: TM.live, t1: TM.clicks[0] - 3 * f, from: pStart, to: pPlus },
        { t0: TM.clicks[2] + 1 * f, t1: TM.stop - 1 * f, from: pPlus, to: pStop },
        { t0: TM.stop + 10 * f, t1: TM.limit - 1 * f, from: pStop, to: pLimit },
        { t0: TM.toButton, t1: TM.toButton + 12 * f, from: pLimit, to: pBtn },
      ]
      const cursor = el('div', 'd-abs d-cursor', root)
      cursor.style.width = cursor.style.height = M.cursor + 'px'
      cursor.style.margin = `${-M.cursor / 2}px 0 0 ${-M.cursor / 2}px`
      const clicks = [
        { t: TM.clicks[0], p: pPlus, dur: 6 * f },
        { t: TM.clicks[1], p: pPlus, dur: 6 * f },
        { t: TM.clicks[2], p: pPlus, dur: 6 * f },
        { t: TM.stop, p: pStop, dur: 9 * f },
        { t: TM.limit, p: pLimit, dur: 9 * f },
        { t: TM.press, p: pBtn, dur: 12 * f, big: true },
      ].map(k => {
        const node = el('div', 'd-abs d-ring', root)
        const size = M.cursor + 6
        node.style.width = node.style.height = size + 'px'
        node.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`
        return { ...k, node }
      })

      // The chart canvas goes last. A <canvas> is its own compositor layer, and
      // whatever is painted after it and overlaps it is split into further
      // layers; with the canvas on top, all of the scene's DOM stays in one.
      const cv = AD.canvas(box('', { x: chart.x + plot.x, y: chart.y, w: plot.w + axisGap, h: chart.h }, root), plot.w + axisGap, chart.h)

      return {
        repaint, M, V, beats, url, urlText, urlLine, panels, sym, tag, badge, badgeFill,
        gChart, gTicket, gStrip, cv, plot, ppp, yOf, chart, ticket, tk, col, axis, chips, axisX, axisGap, nVis, step: M.step,
        closes: data.closes, candles: data.candles, n0,
        sell, buy, fSize, fStop, fLimit, sizeVal, plus, stopVal, limitVal, btn, btnSweep, rcpt, requested, filled,
        time, timeLab, timeVal, row, footer, pulseGlow, pulseCore, pulseHead, pulseLen, brackets, cursor, moves, clicks,
      }
    },

    render(t, ctx, s, T) {
      const { prog, ease, lerp, clamp } = AD
      const kit = AD.kit
      const M = s.M

      // Anti-aliased corners come out a level or two different when the browser
      // repaints only part of a layer. Moving this invisible background makes it
      // repaint the whole layer on every frame, so a frame never depends on
      // which frame was shown before it.
      s.repaint.style.backgroundPosition = `${Math.round(T * AD.fps) % 4096}px 0px`

      // ── headline beats ─────────────────────────────────────────────────
      s.beats.forEach((beat, i) => {
        beat.blocks.forEach((block, j) => {
          const last = i === s.beats.length - 1
          block.show(t, { at: beat.at[j], out: last ? Infinity : (i + 1) * 2 - f - 0.2 - 0.04 * (block.lines.length - 1) })
          for (const line of block.lines) line.inner.style.transform = line.inner.style.transform.replace(FLAT, 'translate(0px, $1)')
        })
      })
      const pu = prog(t, TM.cta + 3 * f, 8 * f, ease.snap)
      s.urlText.style.transform = `translate(0,${((1 - pu) * 112).toFixed(3)}%)`
      s.urlText.style.opacity = pu > 0 ? '1' : '0'
      s.urlLine.style.transform = `scaleX(${prog(t, TM.cta + 0.5, 0.5).toFixed(4)})`

      // ── panels and header ──────────────────────────────────────────────
      s.panels.forEach((p, i) => (p.bg.style.transform = `scaleY(${prog(t, i * 3 * f, 8 * f, ease.snap).toFixed(4)})`))
      s.sym.style.opacity = prog(t, 0.2, 4 * f).toFixed(4)
      s.tag.style.opacity = prog(t, 0.3, 4 * f).toFixed(4)
      s.badge.style.opacity = t >= TM.badge ? '1' : '0'
      s.badge.style.transform = `scale(${lerp(1.12, 1, prog(t, TM.badge, 5 * f, ease.snap)).toFixed(4)})`
      s.badgeFill.style.opacity = t < TM.badge + 4 * f - 1e-6 ? '1' : '0'
      s.gChart.style.opacity = prog(t, 0.3, 4 * f).toFixed(4)
      s.gStrip.style.opacity = prog(t, 0.5, 4 * f).toFixed(4)

      // ── ticket ─────────────────────────────────────────────────────────
      const pressed = t >= TM.press - 1e-6
      const qp = quotePips(s, t)
      s.sell.price.textContent = fmtSell(qp)
      s.buy.price.textContent = fmt(qp)
      const rows = [s.sell.node, s.buy.node, s.fSize, s.fStop, s.fLimit, s.btn, s.time]
      const rowAt = [0.4, 0.4, 0.5, 0.5 + 2 * f, 0.5 + 4 * f, 0.7, 0.7 + 2 * f]
      rows.forEach((node, i) => (node.style.opacity = prog(t, rowAt[i], 4 * f).toFixed(4)))

      const focus = (node, on) => {
        node.style.borderColor = on ? 'var(--accent)' : 'var(--hairline)'
        node.style.boxShadow = on ? 'inset 0 0 0 1px var(--accent)' : 'none'
      }
      const nClicks = TM.clicks.filter(x => t >= x - 1e-6).length
      s.sizeVal.textContent = SIZES[nClicks]
      const sinceClick = nClicks ? t - TM.clicks[nClicks - 1] : 1
      const flash = sinceClick < 3 * f - 1e-6
      s.plus.style.background = flash ? 'var(--accent)' : 'transparent'
      s.plus.style.color = flash ? 'var(--void)' : 'var(--grey)'
      s.plus.style.borderColor = flash ? 'var(--accent)' : 'var(--hairline)'
      focus(s.fSize, t >= TM.clicks[0] - 3 * f && t < TM.stop - 1e-6)

      // Stop and limit start at the current price and snap to their levels;
      // the field and the line on the chart read the same value throughout.
      const stopSet = t >= TM.stop - 1e-6
      const limitSet = t >= TM.limit - 1e-6
      const stopFrom = quotePips(s, TM.stop)
      const limitFrom = quotePips(s, TM.limit)
      const stopNow = lerp(stopFrom, STOP, prog(t, TM.stop, 10 * f, ease.snap))
      const limitNow = lerp(limitFrom, LIMIT, prog(t, TM.limit, 10 * f, ease.snap))
      s.stopVal.textContent = stopSet ? fmt(stopNow) : '—'
      s.stopVal.style.color = stopSet ? 'var(--amber)' : 'var(--grey)'
      focus(s.fStop, stopSet && t < TM.limit - 1e-6)
      s.limitVal.textContent = limitSet ? fmt(limitNow) : '—'
      s.limitVal.style.color = limitSet ? 'var(--accent)' : 'var(--grey)'
      focus(s.fLimit, limitSet && t < TM.toButton - 1e-6)

      // Button: hover when the cursor arrives, 2 px down and a 3-frame sweep on the press.
      const hover = t >= TM.toButton + 12 * f - 1e-6 && !pressed
      s.btn.style.background = hover ? 'color-mix(in srgb, var(--accent) 72%, var(--white))' : 'var(--accent)'
      s.btn.style.transform = `translate(0,${pressed ? 2 : 0}px)`
      s.btnSweep.style.transform = `scaleX(${prog(t, TM.press, 3 * f).toFixed(4)})`

      // Clock: live until the press, frozen on it afterwards.
      const stampT = ctx.start + TM.press
      s.timeVal.textContent = kit.clock(Math.min(T, stampT))
      const detent = pressed && t < TM.press + 3 * f - 1e-6
      s.timeVal.style.color = detent ? 'var(--accent)' : pressed ? 'var(--white)' : 'var(--grey)'
      s.timeLab.style.color = pressed ? 'var(--white)' : 'var(--grey)'

      // Record: opens upward from the time-stamp, then prints its lines.
      const po = prog(t, TM.card, 8 * f, ease.snap)
      s.rcpt.style.display = po > 0 ? 'flex' : 'none'
      s.rcpt.style.clipPath = `inset(${((1 - po) * 100).toFixed(3)}% 0 0 0)`
      s.time.style.borderTopColor = po > 0 ? 'rgba(128,148,168,0.35)' : 'var(--hairline)'
      const atPress = fmt(quotePips(s, TM.press))
      ;[s.requested, s.filled].forEach((cell, i) => {
        const at = TM.lines + i * 5 * f
        cell.node.style.opacity = t >= at - 1e-6 ? '1' : '0'
        cell.value.textContent = atPress
        cell.value.style.color = t < at + 2 * f - 1e-6 ? 'var(--accent)' : 'var(--white)'
      })

      // ── positions row and footer ───────────────────────────────────────
      if (s.row) {
        const pr = prog(t, TM.cta, 8 * f, ease.snap)
        s.row.style.transform = `translate(0,${((1 - pr) * 100).toFixed(3)}%)`
        s.row.style.opacity = pr > 0 ? '1' : '0'
      }
      const pf = prog(t, TM.footer, 8 * f, ease.snap)
      s.footer.style.transform = `translate(0,${((1 - pf) * 120).toFixed(3)}%)`
      s.footer.style.opacity = pf > 0 ? '1' : '0'

      // ── chart ──────────────────────────────────────────────────────────
      const g = s.cv.ctx
      const P = s.plot
      const step = s.step
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, s.cv.w, s.cv.h)
      g.setTransform(1, 0, 0, 1, -P.x, 0) // the canvas starts at the plot's left edge
      g.setLineDash([])
      g.lineWidth = 1
      g.strokeStyle = s.col.hairline
      g.globalAlpha = prog(t, 0.3, 4 * f)
      g.beginPath()
      for (const gp of GRID) {
        const y = Math.round(s.yOf(gp)) + 0.5
        g.moveTo(P.x, y)
        g.lineTo(P.x + P.w + s.axisGap, y)
      }
      g.stroke()
      // Once the live candles start the chart scrolls one slot per beat: time-driven, linear.
      const scroll = Math.round(clamp((t - TM.live) / 0.5, 0, SCRIPT.length) * step)
      const x0 = P.x + P.w - s.nVis * step - scroll // left edge of slot 0
      g.save()
      g.beginPath()
      g.rect(P.x, 0, P.w, s.cv.h)
      g.clip()
      g.globalAlpha = 0.7 * prog(t, 0.3, 4 * f)
      g.beginPath()
      for (let k = 0; k <= s.candles.length; k += 4) {
        const x = x0 + step * k + 0.5
        g.moveTo(x, P.y)
        g.lineTo(x, P.y + P.h)
      }
      g.stroke()
      g.globalAlpha = 1
      const count = t < TM.live ? s.n0 * prog(t, TM.candles, TM.live - TM.candles) : s.n0 + liveUnits(t, SCRIPT.length)
      if (count > 0) {
        const i0 = Math.max(0, Math.floor(scroll / step) - 1) // first candle that can still be seen
        kit.drawCandles(g, s.candles.slice(i0), { rect: { x: x0 + i0 * step, y: P.y, w: step * s.nVis, h: P.h }, min: -RANGE, max: RANGE, count: count - i0, slots: s.nVis })
      }
      g.restore()

      const xr = P.x + P.w + s.axisGap
      const level = (pips, color, at, dash) => {
        const y = Math.round(s.yOf(pips))
        g.strokeStyle = color
        g.lineWidth = 2
        g.setLineDash(dash || [])
        g.beginPath()
        g.moveTo(xr, y)
        g.lineTo(lerp(xr, P.x, prog(t, at, 8 * f)), y)
        g.stroke()
        g.setLineDash([])
      }
      if (stopSet) level(stopNow, s.col.amber, TM.stop)
      if (limitSet) level(limitNow, s.col.accent, TM.limit)
      if (pressed) {
        level(0, s.col.white, TM.press, [9, 7])
        // Fill marker where the order met the price.
        const fx = x0 + step * (s.n0 + 5)
        const fy = s.yOf(0)
        const ring = prog(t, TM.press, 12 * f)
        if (ring < 1) {
          g.globalAlpha = 1 - ring
          g.strokeStyle = s.col.accent
          g.lineWidth = 2
          g.beginPath()
          g.arc(fx, fy, 8 + ring * 16, 0, Math.PI * 2)
          g.stroke()
          g.globalAlpha = 1
        }
        g.fillStyle = s.col.void
        g.beginPath()
        g.arc(fx, fy, 8, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = s.col.accent
        g.lineWidth = 2
        g.beginPath()
        g.arc(fx, fy, 7, 0, Math.PI * 2)
        g.stroke()
        g.fillStyle = s.col.white
        g.beginPath()
        g.arc(fx, fy, 2.5, 0, Math.PI * 2)
        g.fill()
      }

      const chipH = M.css['chip-h']
      const place = (chip, on, pips, scale) => {
        chip.node.style.opacity = on ? '1' : '0'
        chip.node.style.transform = `translate(${s.axisX}px,${(s.chart.y + Math.round(s.yOf(pips)) - chipH / 2).toFixed(2)}px) scale(${scale.toFixed(4)})`
        chip.price.textContent = fmt(pips)
      }
      place(s.chips.stop, stopSet, stopNow, 1)
      place(s.chips.limit, limitSet, limitNow, 1)
      place(s.chips.entry, pressed, 0, lerp(1.12, 1, prog(t, TM.press, 5 * f, ease.snap)))
      const live = [stopSet && stopNow, limitSet && limitNow, pressed && 0].filter(v => v !== false)
      for (const a of s.axis) {
        const hidden = live.some(p => Math.abs(s.yOf(p) - a.y) < chipH / 2 + 14)
        a.node.style.opacity = hidden ? '0' : '1'
      }

      // ── edge pulse: one lap of the ticket from the button ──────────────
      const lap = prog(t, TM.press, TM.card - TM.press)
      const running = pressed && lap < 1
      const tail = 0.16
      for (const path of [s.pulseGlow, s.pulseCore]) {
        path.style.display = running ? 'block' : 'none'
        path.setAttribute('stroke-dasharray', `${tail} 2`)
        path.setAttribute('stroke-dashoffset', (tail - lap).toFixed(5))
      }
      s.pulseHead.style.display = running ? 'block' : 'none'
      if (running) {
        const pt = s.pulseCore.getPointAtLength(lap * s.pulseLen)
        s.pulseHead.setAttribute('cx', pt.x.toFixed(2))
        s.pulseHead.setAttribute('cy', pt.y.toFixed(2))
      }

      // ── focus brackets: ticket at 42.0, the record at 44.5, off at 46.0 ─
      const pin = prog(t, TM.clicks[0], 9 * f, ease.snap)
      const pmove = prog(t, TM.card, 15 * f, ease.quint.inOut)
      const a = s.ticket
      const b = s.tk.rcpt
      const grow = (1 - pin) * 16 + pmove * 5
      s.brackets.set({
        x: lerp(a.x, b.x, pmove) - grow,
        y: lerp(a.y, b.y, pmove) - grow,
        w: lerp(a.w, b.w, pmove) + grow * 2,
        h: lerp(a.h, b.h, pmove) + grow * 2,
        len: lerp(26, 18, pmove),
        opacity: prog(t, TM.clicks[0], 3 * f) * (1 - prog(t, TM.cta, 6 * f)),
      })

      // ── cursor ─────────────────────────────────────────────────────────
      let pos = s.moves[0].from
      for (const m of s.moves) {
        if (t >= m.t1) pos = m.to
        else if (t > m.t0) {
          const e = ease.glide((t - m.t0) / (m.t1 - m.t0))
          pos = { x: lerp(m.from.x, m.to.x, e), y: lerp(m.from.y, m.to.y, e) }
          break
        } else break
      }
      let down = 1
      for (const k of s.clicks) {
        const dt = t - k.t
        if (dt >= -1e-6 && dt < 3 * f - 1e-6) down = 0.8
        const p = dt < -1e-6 ? -1 : dt / k.dur
        const on = p >= 0 && p < 1
        k.node.style.opacity = on ? (1 - p).toFixed(4) : '0'
        k.node.style.transform = `translate(${k.p.x.toFixed(2)}px,${k.p.y.toFixed(2)}px) scale(${(1 + ease.cubic.out(clamp(p)) * (k.big ? 1.9 : 1.4)).toFixed(4)})`
      }
      const seen = prog(t, TM.live - 6 * f, 5 * f, ease.snap) * (1 - prog(t, TM.press + 9 * f, 5 * f))
      s.cursor.style.opacity = seen.toFixed(4)
      s.cursor.style.transform = `translate(${pos.x.toFixed(2)}px,${pos.y.toFixed(2)}px) scale(${(down * lerp(0.6, 1, seen)).toFixed(4)})`
    },
  })
})()
