/* 02 SET (24–30 s): entry, stop and limit are placed before any commitment.
 * A monochrome candle chart ranges sideways; a square cursor brings in the
 * ENTRY handle, pulls STOP down and LIMIT up out of it, and each one snaps to
 * its level on the beat. Two calipers read the distances (26.5 and 27.0),
 * deliberately equal at 25.0 pips each so no favourable ratio is implied, and
 * give one detent together at 27.5; the last candle ticks live throughout.
 * From 28.0 new candles
 * print: price moves most of the way to the stop, back through entry, part of
 * the way to the limit and back to entry. It never touches either level.
 * In the last 8 frames the three lines bend into right-angled traces that
 * leave the frame to the right, the hand-over to 03 TRACE.
 *
 * The level-line and handle-chip look is shared with 11-bothways.js (the same
 * CSS and geometry rules are repeated there on purpose: scenes are standalone).
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { clamp, lerp, prog, ease, el, svg } = AD
  const f = n => n / 30 // frames → seconds

  const ENTRY = 1.08432
  const PIP = 0.0001
  const DIST = 25 // pips from entry to stop and from entry to limit
  const LEVELS = {
    entry: { label: 'ENTRY', pips: 0, color: 'var(--white)', dash: '12 8' },
    stop: { label: 'STOP', pips: -DIST, color: 'var(--amber)' },
    limit: { label: 'LIMIT', pips: DIST, color: 'var(--accent)' },
  }
  const priceText = pips => (ENTRY + pips * PIP).toFixed(5)
  // Positioned with 2-D transforms and no filters: nothing here is promoted to
  // its own compositor layer, so a frame never depends on what was shown before.
  // (Element opacity is avoided too: an opacity round trip re-rasters rounded
  // corners with slightly different anti-aliasing.)
  const place = (node, x, y) => {
    node.style.transform = `translate(${x.toFixed(3)}px,${y.toFixed(3)}px)`
  }
  // The kit headline's baseline rise (same mask, distance and curve as
  // kit.headline.show), written as a 2-D transform for the same reason.
  const rise = (h, t, at, dur = f(8)) => {
    for (const line of h.lines) {
      const pin = prog(t, at, dur, ease.snap)
      line.inner.style.transform = `translate(0,${((1 - pin) * 108).toFixed(3)}%)`
      line.inner.style.opacity = pin <= 0 ? '0' : '1'
    }
  }

  // ── illustrative data, in pips from the entry level ──────────────────────
  // 39 closed candles of a seeded, mean-reverting walk (flat channel, about
  // ±13 pips, ends where it began), one live candle, then nine scripted ones.
  function closedCandles() {
    const r = AD.rng(2701)
    const g = () => (r() + r() + r() + r() - 2) / 2
    const out = []
    let c = 0
    for (let i = 0; i < 39; i++) {
      const o = c
      c = o + g() * 13 - o * 0.22
      const h = Math.max(o, c) + Math.abs(g()) * 5
      const l = Math.min(o, c) - Math.abs(g()) * 5
      out.push({ o, h, l, c })
    }
    return out
  }
  const SWEEP_FROM = f(12) // candles wait until the big numeral has left the stage for its tab
  const LIVE_FROM = 1
  const LIVE_TO = 4
  // The last candle is live: its close steps to a new price on the 5-frame grid
  // (each step taken over two frames), on both sides of its open.
  const TICK = f(5)
  const tickValue = (o, k) => (k <= 0 ? o : o + 8 * AD.fbm(k * 0.5 + 3.1, 90, 3))
  function liveCandle(o, t) {
    const u = clamp(t, LIVE_FROM, LIVE_TO)
    const k = Math.floor((u - LIVE_FROM) / TICK + 1e-6)
    const c = lerp(tickValue(o, k - 1), tickValue(o, k), prog(u, LIVE_FROM + k * TICK, f(2)))
    let h = Math.max(o, c)
    let l = Math.min(o, c)
    for (let j = 1; j < k; j++) {
      const v = tickValue(o, j)
      if (v > h) h = v
      if (v < l) l = v
    }
    return { o, h, l, c }
  }
  // close, wick above, wick below. Closest approach to the stop is 5 pips,
  // to the limit 10.5 pips: toward both, touching neither, ending on entry.
  const AFTER = [
    [-7, 1.2, 1.8], [-13, 0.8, 2.2], [-18, 1.0, 2.0], [-11, 1.5, 1.6], [-3, 2.0, 1.0],
    [6, 2.2, 1.4], [12, 2.5, 1.2], [5, 1.4, 1.8], [0, 1.6, 1.4],
  ]
  // Beats, in seconds since 24.0.
  const T_ENTRY = 1 // 25.0: ENTRY arrives
  const T_STOP = 1.5 // 25.5: the STOP drag ends (snaps) on the beat
  const T_LIMIT = 2 // 26.0: the LIMIT drag ends on the bar line
  const DRAG = f(10)
  const T_CAL = 2.5 // 26.5: caliper closes on the stop distance
  const T_CAL2 = 3 // 27.0: second caliper closes on the limit distance
  const T_EQUAL = 3.5 // 27.5: both read-outs give one detent together: the distances are equal
  const PRINT_AT = 4 // 28.0: headline cuts in, new candles print
  const PRINT_EVERY = f(5)

  AD.defineScene('set', {
    css: `
      .scene--set .k-headline .ln > span { will-change: auto; }
      .scene--set .lv-chip {
        position: absolute; left: 0; top: 0; box-sizing: border-box;
        display: flex; align-items: center; gap: 0.4em; padding: 0 0.5em 0 0.42em;
        background: var(--graphite); border: 2px solid currentColor; border-radius: 4px; white-space: nowrap;
      }
      .scene--set .lv-chip .grip { flex: none; width: 7px; height: 0.62em; opacity: 0.8; background: linear-gradient(to right, currentColor 2px, transparent 2px) 0 0 / 5px 100%; }
      .scene--set .lv-chip .lbl { font-family: var(--font-display); font-weight: 600; font-size: 1.1em; letter-spacing: 0.1em; min-width: 2.95em; }
      .scene--set .lv-chip .px { font-family: var(--font-mono); font-weight: 500; color: var(--white); font-variant-numeric: tabular-nums slashed-zero; }
      .scene--set .set-cursor { position: absolute; left: 0; top: 0; box-sizing: border-box; border: 2px solid; }
      .scene--set .set-num { position: absolute; left: 0; top: 0; font-family: var(--font-mono); font-weight: 600; color: var(--accent); white-space: nowrap; line-height: normal; }
    `,

    build(root, ctx) {
      const kit = AD.kit
      const c = ctx.content
      const { W, H } = ctx
      const wide = ctx.landscape
      const P = ctx.pick({
        '16x9': { chipFs: 24, chipH: 48, visible: 34, cursor: 18, jaw: 26, numSize: 380 },
        '9x16': { chipFs: 22, chipH: 44, visible: 24, cursor: 16, jaw: 20, numSize: 300 },
        '4x5': { chipFs: 23, chipH: 46, visible: 30, cursor: 16, jaw: 22, numSize: 360 },
      })

      kit.grid(root)
      const cv = AD.canvas(root)
      const lines = svg('svg', { class: 'k-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root)

      // Chapter tab; the big numeral docks onto its number.
      const tab = kit.chapterTab(root, '02', 'SET', { x: c.x, y: c.y })
      const tabNum = tab.el.querySelector('.num')
      const tabTitle = tab.el.querySelector('.ttl')
      const numBox = tabNum.getBoundingClientRect()
      const tabH = tab.el.getBoundingClientRect().height
      const tabFs = parseFloat(getComputedStyle(tabNum).fontSize)
      const bigNum = el('div', 'set-num', root, '02')

      // Chips (stop and limit sit under entry so they are pulled out from behind it).
      const chips = {}
      for (const key of ['stop', 'limit', 'entry']) {
        const L = LEVELS[key]
        const node = el('div', `lv-chip lv-chip--${key}`, root)
        node.style.color = L.color
        node.style.fontSize = P.chipFs + 'px'
        node.style.height = P.chipH + 'px'
        const grip = el('span', 'grip', node)
        el('span', 'lbl', node, L.label)
        const px = el('span', 'px', node, priceText(L.pips))
        chips[key] = { el: node, px, grip }
      }
      const chipW = Math.ceil(Math.max(...Object.values(chips).map(ch => ch.el.getBoundingClientRect().width)))
      for (const ch of Object.values(chips)) ch.el.style.width = chipW + 'px'
      const gripBox = chips.entry.grip.getBoundingClientRect()
      const chipBox = chips.entry.el.getBoundingClientRect()
      const gripDX = gripBox.left + gripBox.width / 2 - chipBox.left

      // ── horizontal layout ──
      const chipX = c.x + c.w - chipW
      const calX = chipX - 18
      const zoneRight = calX - P.jaw - 14
      const colW = wide ? 660 : c.w // headline column
      const chartX0 = wide ? c.x + colW + 36 : 0 // left end of the chart (bleeds in portrait)
      const fadeTo = wide ? chartX0 + 56 : c.x
      const step = (zoneRight - (wide ? chartX0 : c.x)) / (P.visible + 1)
      const xNow = zoneRight - step * 1.5 // centre of the live candle's slot

      // ── type ──
      // 16:9 breaks the statement into four lines so it holds the column at the same size as the three words.
      const head = kit.headline(root, wide ? ['DECIDE', 'YOUR EXIT', 'BEFORE', 'YOU ENTER.'] : ['DECIDE YOUR EXIT', 'BEFORE YOU ENTER.'], { tier: 'display', x: c.x, y: 0, w: colW })
      // Words are white with the full stop in the level's colour (the convention 01 SEE set).
      const mk = (text, cls) => {
        const h = kit.headline(root, [text + '.'], { tier: 'display', x: c.x, y: 0, w: colW })
        h.lines[0].inner.innerHTML = `${text}<span class="${cls}">.</span>`
        return h
      }
      const words = { entry: mk('ENTRY', 'c-white'), stop: mk('STOP', 'c-amber'), limit: mk('LIMIT', 'c-accent') }
      const wordFs = parseFloat(getComputedStyle(words.entry.el).fontSize)
      // ILLUSTRATIVE sits top right in the tab row, as in the other chapters.
      const tagEl = kit.tag(root)
      tagEl.style.left = c.x + c.w - Math.ceil(tagEl.getBoundingClientRect().width) + 'px'
      tagEl.style.top = c.y + 'px'

      // ── vertical layout ──
      let yL, yS
      const blockY = c.y + tabH + (wide ? 14 : 22)
      if (wide) {
        // Words sit on their level lines (cap height centred on the line).
        yL = Math.round(blockY + wordFs * 0.52)
        yS = Math.round(c.y + c.h - Math.max(wordFs * 0.43, P.chipH / 2 + 2))
      } else {
        const blockH = Math.max(head.height, words.entry.height * 2)
        yL = Math.round(blockY + blockH + 30 + P.chipH / 2)
        yS = Math.round(c.y + c.h - (P.chipH / 2 + 33))
      }
      const d = Math.round((yS - yL) / 2)
      const yE = yL + d
      yS = yE + d
      const ppp = d / DIST // px per pip
      const yOf = pips => yE - pips * ppp

      const lineX0 = chartX0
      let lineX0Words = chartX0 // 16:9: the lines reach back to the words while they are on screen
      if (wide) {
        for (const key of ['entry', 'stop', 'limit']) words[key].el.style.top = yOf(LEVELS[key].pips) - wordFs * 0.52 + 'px'
        lineX0Words = Math.round(c.x + Math.max(words.entry.width, words.stop.width, words.limit.width) + 32)
        head.el.style.top = Math.round(yE - head.height / 2) + 'px'
      } else {
        // ENTRY. on the first line, the two exits on the second: the block is
        // exactly as tall as the two-line headline that replaces it.
        words.entry.el.style.top = blockY + 'px'
        words.stop.el.style.top = blockY + words.entry.height + 'px'
        words.limit.el.style.top = blockY + words.entry.height + 'px'
        words.limit.el.style.left = c.x + words.stop.width + wordFs * 0.3 + 'px'
        head.el.style.top = blockY + 'px'
      }

      // ── level lines: a faint dotted guide (the snap target) and the line itself ──
      const guides = {}
      const paths = {}
      // The cut from 01 SEE lands on three solid lines that settle into the dotted guides.
      const landing = svg('path', { fill: 'none', stroke: 'var(--grey)', 'stroke-width': 2 }, lines)
      for (const key of ['limit', 'stop', 'entry']) {
        const L = LEVELS[key]
        guides[key] = svg('path', { fill: 'none', stroke: 'var(--grey)', 'stroke-width': 1, 'stroke-dasharray': '2 7' }, lines)
        paths[key] = svg('path', { fill: 'none', stroke: L.color, 'stroke-width': 2, 'stroke-linecap': 'butt' }, lines)
        if (L.dash) paths[key].setAttribute('stroke-dasharray', L.dash)
      }

      const calStop = kit.caliper(root, { orientation: 'v' })
      const calLimit = kit.caliper(root, { orientation: 'v' })
      const calParts = [calStop, calLimit].map(cal => ({ path: cal.el.querySelector('path'), text: cal.el.querySelector('text') }))
      // Chips must sit above lines and calipers.
      for (const key of ['stop', 'limit', 'entry']) root.appendChild(chips[key].el)

      const cursor = el('div', 'set-cursor', root)
      cursor.style.width = cursor.style.height = P.cursor + 'px'
      cursor.style.margin = `${-P.cursor / 2}px 0 0 ${-P.cursor / 2}px`
      root.appendChild(bigNum)

      // Candle data.
      const closed = closedCandles()
      const liveOpen = closed[closed.length - 1].c
      const scripted = []
      let o = liveCandle(liveOpen, LIVE_TO).c
      for (const [cl, up, dn] of AFTER) {
        scripted.push({ o, h: Math.max(o, cl) + up, l: Math.min(o, cl) - dn, c: cl })
        o = cl
      }
      const first = Math.max(0, 39 - Math.ceil((xNow - (wide ? chartX0 : 0)) / step))

      // Big numeral: measure the glyph box once so it can be placed by its centre.
      bigNum.style.fontSize = tabFs + 'px'
      const nb = bigNum.getBoundingClientRect()
      const num = {
        rw: nb.width / tabFs,
        rh: nb.height / tabFs,
        from: { x: c.x + c.w / 2, y: c.y + c.h / 2, size: P.numSize },
        to: { x: numBox.left + numBox.width / 2, y: numBox.top + numBox.height / 2, size: tabFs },
      }

      return {
        P, cv, tab, tabNum, tabTitle, bigNum, num, chips, chipX, gripDX, calX, step, xNow, chartX0, fadeTo, lineX0, lineX0Words,
        head, words, guides, landing, paths, calStop, calLimit, calParts, cursor, closed, liveOpen, scripted, first, yOf, yE, wide,
      }
    },

    render(t, ctx, s) {
      const { W, H } = ctx
      const { P, yOf, yE, chipX, wide } = s
      // Frame times arrive as T − start, a few ulps either side of k/30; the
      // nudge puts every boundary frame on the late side of its beat.
      t += 1e-6

      // Exit: the last 8 frames, complete on the final frame.
      const ex = prog(t, ctx.dur - f(8), f(7), ease.quint.inOut)
      const exFade = 1 - prog(t, ctx.dur - f(8), f(3))

      // ── chapter numeral and tab ──
      s.tab.show(t, f(15) - 0.08)
      s.tabTitle.style.transform = `translate(${((1 - prog(t, f(15) + 0.08, 0.3, ease.snap)) * 14).toFixed(3)}px,0)` // kit's slide, as a 2-D transform
      const docked = t >= f(15)
      s.tabNum.style.opacity = docked ? '1' : '0'
      s.bigNum.style.display = docked ? 'none' : 'block'
      if (!docked) {
        const slam = 1 + 0.14 * (1 - prog(t, 0, f(6), ease.expo.out))
        const dock = prog(t, f(6), f(9), ease.quint.inOut)
        const size = lerp(s.num.from.size * slam, s.num.to.size, dock)
        const cx = lerp(s.num.from.x, s.num.to.x, dock)
        const cy = lerp(s.num.from.y, s.num.to.y, dock)
        s.bigNum.style.fontSize = size.toFixed(3) + 'px'
        s.bigNum.style.transform = `translate(${(cx - (s.num.rw * size) / 2).toFixed(3)}px,${(cy - (s.num.rh * size) / 2).toFixed(3)}px)`
      }

      // ── candles ──
      const printed = clamp((t - PRINT_AT) / PRINT_EVERY, 0, AFTER.length)
      let count
      if (t < LIVE_FROM) count = lerp(s.first, 40, clamp((t - SWEEP_FROM) / (LIVE_FROM - SWEEP_FROM)))
      else count = 40 + printed
      const data = s.closed.concat([liveCandle(s.liveOpen, t)], s.scripted)
      const squeeze = 1 - 0.46 * ex
      const anchor = wide ? s.chartX0 : 0
      const x0 = s.xNow - 39.5 * s.step - printed * s.step
      const g = s.cv.ctx
      g.clearRect(0, 0, W, H)
      const R = 40 // pips above and below entry mapped to the rect
      AD.kit.drawCandles(g, data, {
        rect: { x: anchor + (x0 - anchor) * squeeze, y: yOf(R), w: s.step * data.length * squeeze, h: yOf(-R) - yOf(R) },
        min: -R,
        max: R,
        count,
        alpha: lerp(1, 0.4, ex),
      })
      // Older candles fade out toward the left edge of the chart.
      g.globalCompositeOperation = 'destination-out'
      const fadeFrom = wide ? s.chartX0 : 0
      const grad = g.createLinearGradient(fadeFrom, 0, s.fadeTo, 0)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, s.fadeTo, H)
      g.globalCompositeOperation = 'source-over'

      // ── levels ──
      const wordsOn = t < PRINT_AT
      const lineLeft = wide && wordsOn ? s.lineX0Words : s.lineX0
      const state = {
        entry: { on: t >= T_ENTRY, k: 1, set: T_ENTRY + f(6) },
        stop: { on: t >= T_STOP - DRAG, k: prog(t, T_STOP - DRAG, DRAG, ease.glide), set: T_STOP },
        limit: { on: t >= T_LIMIT - DRAG, k: prog(t, T_LIMIT - DRAG, DRAG, ease.glide), set: T_LIMIT },
      }
      const slideIn = (1 - prog(t, T_ENTRY, f(6), ease.expo.out)) * (W - chipX + 8)
      // On the exit the handles leave the way ENTRY arrived, pushed off by the lines.
      const chipsOut = prog(t, ctx.dur - f(8), f(4), ease.cubic.in) * (W - chipX + 8)
      const land = 1 - prog(t, 0, f(8))
      s.landing.setAttribute('d', ['limit', 'entry', 'stop'].map(key => `M${lineLeft},${yOf(LEVELS[key].pips)} H${W}`).join(' '))
      s.landing.style.opacity = (0.7 * land).toFixed(4)
      // 03 TRACE re-enters these three lines from its left edge at the same height
      // (entry-line y) and spacing: keep the two scenes in step if this changes.
      const busY = { entry: yE, limit: yE - 18, stop: yE + 18 }
      const jogAt = { entry: 0, limit: 0.56, stop: 0.66 }
      for (const key of ['entry', 'stop', 'limit']) {
        const L = LEVELS[key]
        const st = state[key]
        const pips = L.pips * st.k
        const y = yOf(pips)
        const ch = s.chips[key]
        const path = s.paths[key]
        const guide = s.guides[key]
        // Guide: a faint snap target until its level is placed.
        const gy = yOf(L.pips)
        guide.setAttribute('d', `M${lineLeft},${gy} H${chipX}`)
        guide.style.opacity = (0.3 * (st.on && st.k >= 1 ? 0 : 1) * exFade).toFixed(4)

        ch.el.style.display = st.on ? 'flex' : 'none'
        path.style.display = st.on ? 'block' : 'none'
        if (!st.on) continue
        const placed = t >= st.set
        // Two-frame brightness detent when a level lands.
        const since = Math.floor((t - st.set) * 30)
        const detent = placed && since < 2 ? 2 - since : 0
        const text = priceText(pips)
        if (ch.px.textContent !== text) ch.px.textContent = text
        place(ch.el, chipX + (key === 'entry' ? slideIn : 0) + chipsOut, y - P.chipH / 2)
        ch.el.style.background = detent ? `color-mix(in srgb, var(--white) ${detent === 2 ? 30 : 13}%, var(--graphite))` : ''
        ch.el.style.boxShadow = detent ? `0 0 0 ${detent}px currentColor` : ''

        let dAttr
        if (ex > 0) {
          // Bend into a right-angled trace that joins a three-line bus and leaves to the right.
          const xr = lerp(chipX, W + 8, ex)
          const yb = lerp(y, busY[key], ex)
          const xj = Math.round(lerp(s.chartX0 || ctx.content.x, chipX, jogAt[key]))
          dAttr = key === 'entry' ? `M${lineLeft},${y} H${xr.toFixed(2)}` : `M${lineLeft},${y} H${xj} V${yb.toFixed(2)} H${xr.toFixed(2)}`
        } else {
          // Drawn from the chip leftward so the entry line extends right to left.
          const grow = key === 'entry' ? prog(t, T_ENTRY, f(8), ease.cubic.out) : 1
          dAttr = `M${chipX + (key === 'entry' ? slideIn : 0)},${y.toFixed(2)} H${lerp(chipX, lineLeft, grow).toFixed(2)}`
        }
        path.setAttribute('d', dAttr)
        path.style.opacity = placed ? '1' : '0.55'
        path.setAttribute('stroke-width', 2 + detent)
      }

      // ── cursor: rides in with ENTRY, pulls STOP down, returns, pulls LIMIT up, leaves ──
      const gx = chipX + s.gripDX
      let cx = gx
      let cy = yE
      let down = false
      let cop = 0
      if (t >= T_ENTRY && t < T_STOP - DRAG) {
        cx = gx + slideIn
        down = true
        cop = 1
      } else if (t >= T_STOP - DRAG && t < T_STOP) {
        cy = yOf(LEVELS.stop.pips * state.stop.k)
        down = true
        cop = 1
      } else if (t >= T_STOP && t < T_LIMIT - DRAG) {
        cy = lerp(yOf(-DIST), yE, prog(t, T_STOP + f(1), f(4), ease.glide))
        cop = 1
      } else if (t >= T_LIMIT - DRAG && t < T_LIMIT) {
        cy = yOf(LEVELS.limit.pips * state.limit.k)
        down = true
        cop = 1
      } else if (t >= T_LIMIT) {
        const away = prog(t, T_LIMIT + f(2), f(8), ease.glide)
        cx = gx + away * 22
        cy = yOf(DIST) + away * 34
        cop = 1 - prog(t, T_LIMIT + f(5), f(5))
      }
      s.cursor.style.display = cop > 0 ? 'block' : 'none'
      s.cursor.style.borderColor = `rgba(234,242,248,${cop.toFixed(4)})`
      s.cursor.style.background = down ? `rgba(234,242,248,${cop.toFixed(4)})` : `rgba(7,11,16,${(0.7 * cop).toFixed(4)})`
      s.cursor.style.boxShadow = `0 0 0 2px rgba(7,11,16,${(0.9 * cop).toFixed(4)})`
      place(s.cursor, cx, cy)

      // ── calipers: two equal distances ──
      const readout = at => {
        const n = clamp(Math.floor((t - at) * 30), 0, 6)
        return `${((DIST * n) / 6).toFixed(1).padStart(4, '0')} PIPS`
      }
      s.calStop.set({ a: yE, b: yOf(-DIST), pos: s.calX, jaw: P.jaw, labelGap: 14, open: prog(t, T_CAL, f(8), ease.snap), label: readout(T_CAL), opacity: exFade })
      s.calLimit.set({ a: yOf(DIST), b: yE, pos: s.calX, jaw: P.jaw, labelGap: 14, open: prog(t, T_CAL2, f(8), ease.snap), label: readout(T_CAL2), opacity: exFade })
      const eq = Math.floor((t - T_EQUAL) * 30)
      const tick = t >= T_EQUAL && eq < 2 ? 2 - eq : 0
      for (const part of s.calParts) {
        part.path.setAttribute('stroke-width', 2 + tick)
        part.text.style.fill = tick ? `color-mix(in srgb, var(--white) ${tick * 38}%, var(--accent))` : ''
      }

      // ── type ──
      rise(s.words.entry, t, T_ENTRY)
      rise(s.words.stop, t, T_STOP)
      rise(s.words.limit, t, T_LIMIT)
      for (const key in s.words) s.words[key].el.style.visibility = wordsOn ? 'visible' : 'hidden'
      rise(s.head, t, PRINT_AT, 0) // hard cut on the bar line
    },
  })
})()
