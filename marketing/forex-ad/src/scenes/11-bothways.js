/* PRICES MOVE AGAINST YOU TOO (36–40 s): the film's held, calm breakdown.
 * An almost empty frame: the dashed ENTRY line and the amber STOP line from
 * chapter 2, and one white price line drawing at a constant 240 px a second.
 * It drifts down from entry and at 38.0 gaps through the stop, so the fill
 * lands a little beyond the stop level. A caliper marks that gap, labelled
 * SLIPPAGE with no figure, and the line ends at the fill. There is no
 * profit-and-loss figure, no limit line, no red and no alarm styling.
 * From 39.0 nothing moves but the corner clock.
 *
 * The level-line and handle-chip look is shared with 09-set.js (the same CSS
 * and geometry rules are repeated here on purpose: scenes are standalone).
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { clamp, lerp, prog, ease, el, svg } = AD
  const f = n => n / 30 // frames → seconds

  const ENTRY = 1.08432
  const PIP = 0.0001
  const DIST = 25
  const LEVELS = {
    entry: { label: 'ENTRY', pips: 0, color: 'var(--white)', dash: '12 8' },
    stop: { label: 'STOP', pips: -DIST, color: 'var(--amber)' },
  }
  const priceText = pips => (ENTRY + pips * PIP).toFixed(5)
  // Positioned with 2-D transforms, and faded through colour rather than element
  // opacity or filters: nothing here is promoted to its own compositor layer,
  // so a frame never depends on what was shown before.
  const place = (node, x, y) => {
    node.style.transform = `translate(${x.toFixed(3)}px,${y.toFixed(3)}px)`
  }
  const ink = alpha => `color-mix(in srgb, var(--white) ${(clamp(alpha) * 100).toFixed(2)}%, transparent)`

  const SPEED = 240 // px per second, linear
  const DRIFT = SPEED * 2 // the walk from entry to stop takes the two seconds before the bar line
  const T_STOP = 2 // 38.0: the stop is crossed
  const T_CAL = 2.5 // 38.5: the caliper closes on the gap

  /** Price line as a fraction of the entry→stop distance at x px before the crossing (always above the stop). */
  function walk(back) {
    const u = 1 - back / DRIFT // 0 where the drift starts, 1 at the crossing
    const slow = AD.fbm(back * 0.0075, 28, 3)
    const mid = AD.fbm(back * 0.03, 29, 2)
    const fine = AD.fbm(back * 0.11, 43, 2)
    const hover = 0.07 * slow + 0.02 * mid + 0.008 * fine
    if (u <= 0) return hover
    const calm = 1 - Math.pow(u, 5) // the noise dies away at the stop so the line cannot touch it early
    const base = 0.95 * lerp(u, u * u * (3 - 2 * u), 0.55)
    return base + (hover + 0.085 * Math.sin(Math.PI * u) * (0.8 * slow + 0.9 * mid)) * calm
  }

  AD.defineScene('bothways', {
    css: `
      .scene--bothways .k-headline .ln > span { will-change: auto; }
      .scene--bothways .lv-chip {
        position: absolute; left: 0; top: 0; box-sizing: border-box;
        display: flex; align-items: center; gap: 0.4em; padding: 0 0.5em 0 0.42em;
        background: var(--graphite); border: 2px solid currentColor; border-radius: 4px; white-space: nowrap;
      }
      .scene--bothways .lv-chip .grip { flex: none; width: 7px; height: 0.62em; opacity: 0.8; background: linear-gradient(to right, currentColor 2px, transparent 2px) 0 0 / 5px 100%; }
      .scene--bothways .lv-chip .lbl { font-family: var(--font-display); font-weight: 600; font-size: 1.1em; letter-spacing: 0.1em; min-width: 2.95em; }
      .scene--bothways .lv-chip .px { font-family: var(--font-mono); font-weight: 500; color: var(--white); font-variant-numeric: tabular-nums slashed-zero; }
      .scene--bothways .bw-marker {
        position: absolute; left: 0; top: 0; box-sizing: border-box; display: flex; white-space: nowrap;
        font-family: var(--font-mono); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
        background: var(--graphite); border: 1px solid var(--hairline); border-left: 2px solid var(--amber); border-radius: 0 3px 3px 0;
      }
      .scene--bothways .bw-marker span { padding: 0.42em 0.7em 0.38em; }
      .scene--bothways .bw-marker .a { color: var(--amber); }
      .scene--bothways .bw-marker .b { color: var(--white); border-left: 1px solid var(--hairline); }
      .scene--bothways .bw-marker.is-stacked { flex-direction: column; }
      .scene--bothways .bw-marker.is-stacked span { padding: 0.36em 0.7em 0.3em; }
      .scene--bothways .bw-marker.is-stacked .b { border-left: 0; padding-top: 0; }
    `,

    build(root, ctx) {
      const kit = AD.kit
      const c = ctx.content
      const { W, H } = ctx
      const wide = ctx.landscape
      const P = ctx.pick({
        '16x9': { chipFs: 24, chipH: 48, markerFs: 22, gap: 36, jaw: 24, cross: 1040, levels: 230, lead: 108 },
        '9x16': { chipFs: 22, chipH: 44, markerFs: 20, gap: 36, jaw: 22, cross: 452, levels: 226, lead: 72 },
        '4x5': { chipFs: 23, chipH: 46, markerFs: 21, gap: 40, jaw: 24, cross: 520, levels: 300, lead: 150 },
      })

      kit.grid(root)
      const lines = svg('svg', { class: 'k-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root)

      // ── type: the film's only soft transition, so the kit's baseline rise is parked ──
      const h1 = kit.headline(root, ['PRICES MOVE', 'AGAINST YOU TOO.'], { tier: 'display', x: c.x, y: c.y, w: c.w })
      const h2 = kit.headline(root, wide ? ['A STOP CAN LIMIT A LOSS.', 'IT IS NOT A GUARANTEE.'] : ['A STOP CAN', 'LIMIT A LOSS.', 'IT IS NOT', 'A GUARANTEE.'], {
        tier: 'display',
        x: c.x,
        y: c.y,
        w: c.w,
      })
      for (const line of h1.lines.concat(h2.lines)) {
        line.inner.style.transform = 'none'
        line.inner.style.opacity = '1'
      }

      // ILLUSTRATIVE sits top right of the content area, as in the chapters.
      const tagEl = kit.tag(root)
      tagEl.style.left = c.x + c.w - Math.ceil(tagEl.getBoundingClientRect().width) + 'px'
      tagEl.style.top = c.y + 'px'

      // ── levels ──
      // 03 TRACE ends on a single hairline at this height (its hairY is read off
      // this line), so the cut reads as that line carrying over into ENTRY.
      const yE = Math.round(c.y + h2.height + P.lead)
      const yS = Math.min(yE + P.levels, Math.round(c.y + c.h - P.gap - 10))
      const yFill = yS + P.gap

      const chips = {}
      for (const key of ['entry', 'stop']) {
        const L = LEVELS[key]
        const node = el('div', `lv-chip lv-chip--${key}`, root)
        node.style.color = L.color
        node.style.fontSize = P.chipFs + 'px'
        node.style.height = P.chipH + 'px'
        el('span', 'grip', node)
        el('span', 'lbl', node, L.label)
        el('span', 'px', node, priceText(L.pips))
        chips[key] = node
      }
      const chipW = Math.ceil(Math.max(...Object.values(chips).map(n => n.getBoundingClientRect().width)))
      const chipX = c.x + c.w - chipW
      const yLevel = { entry: yE, stop: yS }
      const paths = {}
      for (const key of ['entry', 'stop']) {
        chips[key].style.width = chipW + 'px'
        place(chips[key], chipX, yLevel[key] - P.chipH / 2)
        paths[key] = svg('path', { d: `M${chipX},${yLevel[key]} H0`, fill: 'none', stroke: LEVELS[key].color, 'stroke-width': 2 }, lines)
        if (LEVELS[key].dash) paths[key].setAttribute('stroke-dasharray', LEVELS[key].dash)
      }
      const pulse = svg('path', { d: `M${chipX},${yS} H0`, fill: 'none', stroke: 'var(--amber)', 'stroke-width': 2 }, lines)

      // ── marker: STOP TRIGGERED  ORDER CLOSED ──
      const marker = el('div', `bw-marker${wide ? '' : ' is-stacked'}`, root)
      marker.style.fontSize = P.markerFs + 'px'
      el('span', 'a', marker, 'STOP TRIGGERED')
      el('span', 'b', marker, 'ORDER CLOSED')
      const mb = marker.getBoundingClientRect()
      // The crossing sits far enough left for the marker to clear the chips.
      const xCross = Math.min(P.cross, Math.floor(chipX - 28 - mb.width - 18))
      const markerX = xCross + 18
      const markerY = yS - 14 - mb.height

      // ── price line: sampled every 4 px back from the crossing to the left edge ──
      const pts = []
      for (let x = xCross - 6; x > -8; x -= 4) pts.push([x, yE + (yS - yE) * walk(xCross - x)])
      pts.reverse()
      pts.push([xCross, yFill]) // the gap: the next price is beyond the stop
      const price = svg('path', { fill: 'none', stroke: 'var(--white)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, lines)
      const dot = svg('circle', { r: 5, fill: 'var(--white)', stroke: 'var(--void)', 'stroke-width': 3, 'paint-order': 'stroke' }, lines)

      const cal = kit.caliper(root, { orientation: 'v' })
      for (const key of ['entry', 'stop']) root.appendChild(chips[key])
      root.appendChild(marker)

      return { P, h1, h2, chips, pulse, marker, markerX, markerY, xCross, pts, price, dot, cal, yS, yFill }
    },

    render(t, ctx, s) {
      const { P, pts, xCross, yS, yFill } = s
      // Frame times arrive as T − start, a few ulps either side of k/30; the
      // nudge puts every boundary frame on the late side of its beat.
      t += 1e-6

      // ── headlines: 12 frames of opacity with a 4 px rise, then an 8-frame
      // cross-dissolve that completes on the bar line, so the second statement
      // is fully set for the whole of 38.0–40.0 ──
      const DISSOLVE = f(8)
      const inP = prog(t, 0, f(12))
      const swap = prog(t, T_STOP - DISSOLVE, DISSOLVE)
      s.h1.el.style.color = ink(inP * (1 - swap))
      s.h1.el.style.transform = `translate(0,${((1 - prog(t, 0, f(12), ease.cubic.out)) * 4).toFixed(3)}px)`
      s.h1.el.style.visibility = swap >= 1 ? 'hidden' : 'visible'
      s.h2.el.style.color = ink(swap)
      s.h2.el.style.visibility = swap <= 0 ? 'hidden' : 'visible'

      // ── price line: the head moves at a constant speed and stops at the fill ──
      const head = xCross - SPEED * Math.max(0, T_STOP - t)
      let d = ''
      let hx = pts[0][0]
      let hy = pts[0][1]
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i]
        if (x <= head) {
          d += `${i ? 'L' : 'M'}${x},${y.toFixed(2)} `
          hx = x
          hy = y
        } else {
          if (i === 0) break // the head has not entered the frame yet
          const [px, py] = pts[i - 1]
          const k = clamp((head - px) / (x - px))
          hx = lerp(px, x, k)
          hy = lerp(py, y, k)
          d += `L${hx.toFixed(2)},${hy.toFixed(2)}`
          break
        }
      }
      s.price.setAttribute('d', d)
      s.dot.style.display = d ? 'block' : 'none'
      const filled = t >= T_STOP
      const since = Math.floor((t - T_STOP) * 30)
      s.dot.setAttribute('cx', hx.toFixed(2))
      s.dot.setAttribute('cy', hy.toFixed(2))
      s.dot.setAttribute('r', filled ? (since === 0 ? 8.5 : since === 1 ? 7.5 : 6.5) : 4.5)

      // ── 38.0: one six-frame amber pulse on the stop line, the marker slides out ──
      const pp = filled ? prog(t, T_STOP, f(6)) : 1
      s.pulse.setAttribute('stroke-width', lerp(7, 2, pp).toFixed(2))
      s.pulse.style.opacity = (0.6 * (1 - pp)).toFixed(4)
      s.chips.stop.style.background = pp < 1 ? `color-mix(in srgb, var(--white) ${(22 * (1 - pp)).toFixed(2)}%, var(--graphite))` : ''

      const mp = prog(t, T_STOP, f(8), ease.expo.out)
      s.marker.style.display = filled ? 'flex' : 'none'
      s.marker.style.clipPath = `inset(0 ${((1 - mp) * 100).toFixed(3)}% 0 0)`
      place(s.marker, s.markerX - (1 - mp) * 18, s.markerY)

      // ── 38.5: the caliper closes on the gap between the stop level and the fill ──
      s.cal.set({ a: yS, b: yFill, pos: xCross + 16 + P.jaw, jaw: P.jaw, open: prog(t, T_CAL, f(8), ease.snap), label: 'SLIPPAGE' })
    },
  })
})()
