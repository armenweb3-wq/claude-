/* S14 — converge (50–52 s). Brand resolution: the line art of the film's four
 * motifs (ladder rows, three level lines, right-angled route traces with ringed
 * nodes, session arcs) is on screen at 50.0 as thin cyan strokes. Each stroke
 * then runs head-first along a curved rail and winds onto the reticle logo
 * mark like tape onto a reel; the mark locks at frame 20 with a detent and a
 * tick dial sweeps once round it. The thesis sets beneath. The scene keeps a
 * short tail after 52.0 so the thesis and the dial can leave while the end
 * card takes over the mark.
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { clamp, lerp, prog, ease } = AD
  const fr = n => n / 30
  const TAU = Math.PI * 2

  // The mark as kit.mark draws it, in its 0..100 view box.
  const RING_R = 38
  const GAP_DEG = 22
  const NEST = 3.4 // thin strokes nest within ±NEST of the ring's centre line
  const LOCK = fr(20)

  // ── line-art primitives: every shape is a polyline in px ────────────────
  const seg = (x0, y0, x1, y1) => [[x0, y0], [x1, y1]]
  const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
  const ring = (cx, cy, r, n = 24) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)])
  const bow = (x0, x1, base, rise, n = 28) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = Math.PI * (1 - i / n)
      return [(x0 + x1) / 2 + ((x1 - x0) / 2) * Math.cos(a), base - rise * Math.sin(a)]
    })

  /** Ladder rows: a price column with depth bars, asks above and bids below. */
  function ladder(b) {
    const rows = b.h >= 200 ? 8 : 6
    const half = rows / 2
    const spread = Math.round(b.h * 0.1)
    const pitch = (b.h - spread) / rows
    const colW = Math.round(b.w * 0.15)
    const cx = b.x + b.w / 2
    const side = b.w / 2 - colW / 2 - 10
    const depth = [0.34, 0.56, 0.8, 1]
    const out = [seg(cx - colW / 2, b.y, cx - colW / 2, b.y + b.h), seg(cx + colW / 2, b.y, cx + colW / 2, b.y + b.h)]
    for (let i = 0; i < rows; i++) {
      const ask = i < half
      const y = b.y + i * pitch + (ask ? 0 : spread)
      const len = side * depth[(ask ? half - 1 - i : i - half) + (half === 3 ? 1 : 0)]
      out.push(ask ? box(cx + colW / 2 + 10, y + 4, len, pitch - 8) : box(cx - colW / 2 - 10 - len, y + 4, len, pitch - 8))
      out.push(seg(cx - colW * 0.27, y + pitch / 2, cx + colW * 0.27, y + pitch / 2))
    }
    return out
  }

  /** Three level lines with their flags and the two distances between them. */
  function levels(b) {
    const ys = [0.1, 0.5, 0.9].map(k => Math.round(b.y + b.h * k))
    const flagW = Math.round(Math.min(84, b.w * 0.17))
    const flagH = 24
    const out = []
    for (const y of ys) {
      out.push(seg(b.x, y, b.x + b.w - flagW, y))
      out.push(box(b.x + b.w - flagW, y - flagH / 2, flagW, flagH))
    }
    const dim = (x, y0, y1) => [[x - 9, y0 + 8], [x + 9, y0 + 8], [x, y0 + 8], [x, y1 - 8], [x - 9, y1 - 8], [x + 9, y1 - 8]]
    out.push(dim(b.x + b.w * 0.2, ys[0], ys[1]))
    out.push(dim(b.x + b.w * 0.34, ys[1], ys[2]))
    return out
  }

  /** Right-angled route traces that start and end in ringed nodes. */
  function routes(b) {
    const r = 9
    // Node rings stay inside the box, so the motif ends flush with its zone on both sides.
    const X = k => b.x + r + (b.w - 2 * r - 7) * k
    const Y = k => b.y + b.h * k
    const traces = [
      [[0, 0.14], [0.3, 0.14], [0.3, 0.52], [0.66, 0.52], [0.66, 0.08], [1, 0.08]],
      [[0, 0.58], [0.16, 0.58], [0.16, 0.92], [0.5, 0.92], [0.5, 0.74], [1, 0.74]],
      [[0.42, 0.14], [0.52, 0.14], [0.52, 0.3], [0.84, 0.3], [0.84, 0.46], [1, 0.46]],
    ]
    const out = []
    for (const tr of traces) {
      const pts = tr.map(([x, y]) => [X(x), Y(y)])
      // Stop the trace at the edge of its node rings.
      pts[0][0] += r
      pts[pts.length - 1][0] -= r
      const first = tr[0]
      const last = tr[tr.length - 1]
      out.push(pts, ring(X(first[0]), Y(first[1]), r), ring(X(last[0]), Y(last[1]), r), ring(X(last[0]), Y(last[1]), r + 7))
    }
    return out
  }

  /** Session arcs: four centres on a baseline joined by overlapping arcs. */
  function arcs(b) {
    const base = b.y + b.h - 10
    const xs = [0.05, 0.36, 0.63, 0.95].map(k => b.x + b.w * k)
    const top = b.h - 16
    const span = xs[3] - xs[0]
    const out = [seg(b.x, base, b.x + b.w, base)]
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]]) out.push(bow(xs[i], xs[j], base, Math.min(top, (top * 1.5 * (xs[j] - xs[i])) / span)))
    for (const x of xs) out.push(ring(x, base, 7, 16))
    return out
  }

  const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

  /** Smooth curve through knots (Catmull-Rom), arriving at the last one along unit vector `dir`. */
  function spline(knots, dir, hook, steps = 18) {
    const n = knots.length - 1
    const tan = knots.map((k, i) => {
      if (i === 0) return [knots[1][0] - k[0], knots[1][1] - k[1]]
      if (i === n) {
        const mag = 3 * Math.min(far(k, knots[i - 1]) * 0.42, hook)
        return [dir[0] * mag, dir[1] * mag]
      }
      return [(knots[i + 1][0] - knots[i - 1][0]) * 0.5, (knots[i + 1][1] - knots[i - 1][1]) * 0.5]
    })
    const out = [knots[0]]
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= steps; j++) {
        const u = j / steps
        const h00 = 2 * u * u * u - 3 * u * u + 1
        const h10 = u * u * u - 2 * u * u + u
        const h01 = -2 * u * u * u + 3 * u * u
        const h11 = u * u * u - u * u
        out.push([
          h00 * knots[i][0] + h10 * tan[i][0] + h01 * knots[i + 1][0] + h11 * tan[i + 1][0],
          h00 * knots[i][1] + h10 * tan[i][1] + h01 * knots[i + 1][1] + h11 * tan[i + 1][1],
        ])
      }
    }
    return out
  }

  /**
   * One lane of a trunk: the trunk shifted sideways by `offset` px at its end
   * and `spread` times that at its start, so a motif's strokes run in together
   * like a ribbon cable and close up as they reach the mark.
   */
  function lane(trunk, dir, offset, spread) {
    const last = trunk.length - 1
    return trunk.map((p, i) => {
      const a = trunk[Math.max(0, i - 1)]
      const b = trunk[Math.min(last, i + 1)]
      let tx = b[0] - a[0]
      let ty = b[1] - a[1]
      const l = Math.hypot(tx, ty) || 1
      tx = i === last ? dir[0] : tx / l
      ty = i === last ? dir[1] : ty / l
      const k = offset * (1 + (spread - 1) * Math.pow(1 - i / last, 1.5))
      return [p[0] + ty * k, p[1] - tx * k]
    })
  }

  /**
   * A rail: the stroke's own shape, a short lead-in to its lane, the lane, then
   * its place on the mark. The stroke slides along it head-first, so lines stay
   * lines. `run` is the lane (or any curve) that ends where `target` begins.
   */
  function rail(shape, run, target) {
    const gate = run[0]
    let pts = shape.map(p => [p[0], p[1]])
    const closed = far(pts[0], pts[pts.length - 1]) < 0.5
    if (closed) {
      // Start (and end) a closed outline at the corner nearest the way out.
      pts.pop()
      let k = 0
      pts.forEach((p, i) => (k = far(p, gate) < far(pts[k], gate) ? i : k))
      pts = pts.slice(k).concat(pts.slice(0, k))
      pts.push([pts[0][0], pts[0][1]])
    } else if (far(pts[0], gate) < far(pts[pts.length - 1], gate)) pts.reverse()
    const head = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    const dist = far(head, gate) || 1
    const ex = (gate[0] - head[0]) / dist
    const ey = (gate[1] - head[1]) / dist
    // Leave along the stroke where that already heads for the lane, otherwise straight for it.
    let lx = head[0] - prev[0]
    let ly = head[1] - prev[1]
    const ll = Math.hypot(lx, ly) || 1
    const along = Math.max(0, (lx * ex + ly * ey) / ll)
    let sx = (lx / ll) * along + ex
    let sy = (ly / ll) * along + ey
    const sl = Math.hypot(sx, sy)
    const m = dist * 0.4
    const p1 = [head[0] + (sx / sl) * m, head[1] + (sy / sl) * m]
    const gl = far(run[1], gate) || 1
    const p2 = [gate[0] - ((run[1][0] - gate[0]) / gl) * m, gate[1] - ((run[1][1] - gate[1]) / gl) * m]
    const all = pts.slice()
    const N = 14
    for (let i = 1; i < N; i++) {
      const u = i / N
      const k = 1 - u
      all.push([
        k * k * k * head[0] + 3 * k * k * u * p1[0] + 3 * k * u * u * p2[0] + u * u * u * gate[0],
        k * k * k * head[1] + 3 * k * k * u * p1[1] + 3 * k * u * u * p2[1] + u * u * u * gate[1],
      ])
    }
    for (let i = 0; i < run.length - 1; i++) all.push(run[i])
    const iRun = pts.length - 1 // index where the stroke's own shape ends
    const iLand = all.length // index of the point where it meets the mark
    for (const p of target) all.push(p)
    const cum = [0]
    for (let i = 1; i < all.length; i++) cum.push(cum[i - 1] + far(all[i], all[i - 1]))
    return { pts: all, cum, src: cum[iRun], land: cum[iLand], total: cum[cum.length - 1] }
  }

  /** Add the piece of a rail between arc lengths s0 and s1 to the current path. */
  function trace(g, r, s0, s1) {
    const { pts, cum } = r
    let i = 1
    while (i < cum.length - 1 && cum[i] <= s0) i++
    const at = (k, s) => {
      const u = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1)
      return [lerp(pts[k - 1][0], pts[k][0], u), lerp(pts[k - 1][1], pts[k][1], u)]
    }
    const a = at(i, s0)
    g.moveTo(a[0], a[1])
    while (i < cum.length - 1 && cum[i] < s1) {
      g.lineTo(pts[i][0], pts[i][1])
      i++
    }
    const b = at(i, Math.min(s1, cum[i]))
    g.lineTo(b[0], b[1])
  }

  AD.defineScene('converge', {
    tail: 0.3,
    // The kit headline promotes its lines with will-change, which lets Chromium keep a
    // text raster made at an earlier sub-pixel offset: the same frame then differs
    // with seek order. Without it the thesis is re-rastered exactly on every frame.
    css: `.scene--converge .k-headline .ln > span { will-change: auto; }`,
    build(root, ctx) {
      const kit = AD.kit
      const c = ctx.contentEnd
      const grid = kit.grid(root)
      const vignette = grid.nextSibling
      const cv = AD.canvas(root)

      // ── mark + thesis group, centred in the shortened stage ──
      const size = ctx.pick({ '16x9': 200, '9x16': 150, '4x5': 210 })
      const dial = { r0: size * 0.6, minor: size * 0.05, major: size * 0.1 }
      const outer = dial.r0 + dial.major
      const gap = ctx.pick({ '16x9': 28, '9x16': 28, '4x5': 44 })
      const thesisW = ctx.pick({ '16x9': 700, '9x16': 700, '4x5': 860 })
      const thesis = kit.headline(root, ['PRECISION,', 'NOT PREDICTION.'], { tier: 'display', x: c.x + (c.w - thesisW) / 2, y: 0, w: thesisW, align: 'center' })
      const groupH = outer * 2 + gap + thesis.height
      const top = Math.round(c.y + (c.h - groupH) / 2)
      // Everything is centred on the content box, not the frame: in 9:16 the safe box sits left of the frame centre.
      const cx = c.x + c.w / 2
      const cy = top + outer
      thesis.el.style.top = top + outer * 2 + gap + 'px'

      const mark = kit.mark(root, size)
      mark.el.style.position = 'absolute'
      mark.el.style.left = cx - size / 2 + 'px'
      mark.el.style.top = cy - size / 2 + 'px'

      // The end card starts its lockup mark exactly here.
      AD.shared = Object.assign(AD.shared || {}, { converge: { cx, cy, size } })

      // ── the four motifs round the group: ladder, routes, arcs, levels (clockwise from top-left) ──
      // Mirrored about the content-box centre and kept inside contentEnd vertically;
      // in 9:16 they bleed the same small amount past the safe box on both sides.
      const g = k => 48 * k
      const pair = (inner, w, y, h) => [
        { x: cx - inner - w, y, w, h },
        { x: cx + inner, y, w, h },
      ]
      const bottom = c.y + c.h
      const rows = ctx.pick({
        '16x9': [pair(g(7), g(11), c.y + 18, g(5)), pair(g(7), g(11), bottom - 8 - g(5), g(5))],
        '9x16': [pair(132, 280, c.y + 12, 136), pair(132, 280, c.y + 180, 120)],
        '4x5': [pair(g(3), g(7), c.y + 9, g(5)), pair(g(2), g(8), bottom - 8 - 152, 152)],
      })
      const zones = [rows[0][0], rows[0][1], rows[1][1], rows[1][0]]
      const shapes = [ladder(zones[0]), routes(zones[1]), arcs(zones[2]), levels(zones[3])]

      // How each motif runs in: which ring segment it lands on (0 top, 1 right,
      // 2 bottom, 3 left), which way it winds on, the gate where its strokes
      // gather and the waypoints of the trunk. Every approach is tangent to the
      // ring, and the lower motifs are steered clear of the thesis: along the
      // gap under the ring in 16:9, round the ends of the line in 4:5.
      const R = RING_R * (size / 100)
      const at = (dx, dy) => [cx + dx, cy + dy]
      const plan = ctx.pick({
        '16x9': [
          { seg: 0, cw: true, gate: at(-296, 20) },
          { seg: 2, cw: true, gate: at(296, 34) },
          { seg: 3, cw: true, gate: at(296, 236), via: [at(196, 132), at(-6, 128)] },
          { seg: 1, cw: false, gate: at(-296, 236), via: [at(-196, 132), at(6, 128)] },
        ],
        '9x16': [
          { seg: 1, cw: true, gate: at(-116, -124), via: [at(8, -106)] },
          { seg: 3, cw: false, gate: at(116, -124), via: [at(-8, -106)] },
          { seg: 2, cw: true, gate: at(116, -14) },
          { seg: 0, cw: true, gate: at(-116, 14) },
        ],
        '4x5': [
          { seg: 1, cw: true, gate: at(-120, -190), via: [at(10, -132)] },
          { seg: 3, cw: false, gate: at(120, -190), via: [at(-10, -132)] },
          { seg: 2, cw: true, gate: at(340, 392), via: [at(338, 236), at(250, 74)] },
          { seg: 0, cw: true, gate: at(-340, 392), via: [at(-338, 236), at(-250, 60)] },
        ],
      })

      const unit = size / 100
      const strokes = []
      const tickStrokes = []
      shapes.forEach((list, m) => {
        const { seg, cw, gate, via = [] } = plan[m]
        const aLo = ((seg * 90 - 45 + GAP_DEG / 2) * Math.PI) / 180
        const aHi = (((seg + 1) * 90 - 45 - GAP_DEG / 2) * Math.PI) / 180
        const aIn = cw ? aLo : aHi
        const aOut = cw ? aHi : aLo
        const turn = cw ? 1 : -1
        const dir = [Math.cos(aIn) * turn, Math.sin(aIn) * turn]
        const entry = [cx + R * Math.sin(aIn), cy - R * Math.cos(aIn)]
        const trunk = spline([gate, ...via, entry], dir, size * 0.4)
        const nArc = list.length - 1
        list.forEach((shape, i) => {
          if (i === nArc) {
            // The last stroke of each motif dives through the gap beside its segment and becomes part of the centre tick.
            const aGap = ((seg * 90 + (cw ? -45 : 45)) * Math.PI) / 180
            const down = Math.cos(aGap) > 0 ? 1 : -1
            tickStrokes.push({ shape, down, knots: [gate, ...via, [cx + R * 1.5 * Math.sin(aGap), cy - R * 1.5 * Math.cos(aGap)]] })
            return
          }
          // Lanes close up to the nested radii: positive offsets are further from the centre.
          const off = (-NEST + (2 * NEST * i) / (nArc - 1)) * unit
          const r = R + off
          const target = Array.from({ length: 15 }, (_, j) => {
            const a = lerp(aIn, aOut, j / 14)
            return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
          })
          // Segments fill in the order the mark draws them (top, right, bottom, left), two frames apart,
          // each a moment before the mark inks that segment in; the tick lands last, on frame 20.
          strokes.push({ rail: rail(shape, lane(trunk, dir, off * turn, 4), target), delay: fr(seg * 2 + i / nArc), dur: fr(12) })
        })
      })
      tickStrokes.forEach(({ shape, down, knots }, k) => {
        const x = cx + (-NEST + (2 * NEST * k) / (tickStrokes.length - 1)) * unit
        const target = [[x, cy - 12 * unit * down], [x, cy + 12 * unit * down]]
        strokes.push({ rail: rail(shape, spline([...knots, target[0]], [0, down], size * 0.12), target), delay: fr(6), dur: fr(14) })
      })

      const css = getComputedStyle(document.documentElement)
      const colors = { accent: css.getPropertyValue('--accent').trim(), white: css.getPropertyValue('--white').trim(), grey: css.getPropertyValue('--grey').trim() }
      return { grid, vignette, cv, thesis, mark, strokes, cx, cy, size, dial, colors }
    },

    render(t, ctx, s) {
      const g = s.cv.ctx
      const inScene = t < ctx.dur
      // After 52.0 the end card owns the background and the mark.
      s.grid.style.display = s.vignette.style.display = inScene ? 'block' : 'none'
      s.mark.el.style.display = inScene ? 'block' : 'none'

      s.thesis.show(t, { at: [0, 0.5], out: ctx.dur, outDur: 0.2 })

      g.clearRect(0, 0, s.cv.w, s.cv.h)
      g.lineJoin = 'round'
      g.lineCap = 'butt'
      const unit = s.size / 100

      // A faint target where the mark will lock.
      const hint = 1 - prog(t, fr(10), fr(6))
      if (hint > 0) {
        g.globalAlpha = 0.5 * hint
        g.strokeStyle = s.colors.grey
        g.lineWidth = 1
        g.beginPath()
        g.arc(s.cx, s.cy, RING_R * unit, 0, TAU)
        for (let q = 0; q < 4; q++) {
          const a = (q * Math.PI) / 2
          g.moveTo(s.cx + Math.cos(a) * (RING_R + 12) * unit, s.cy + Math.sin(a) * (RING_R + 12) * unit)
          g.lineTo(s.cx + Math.cos(a) * (RING_R + 22) * unit, s.cy + Math.sin(a) * (RING_R + 22) * unit)
        }
        g.stroke()
      }

      // Line art: each stroke slides along its rail and winds onto the mark.
      if (t < LOCK) {
        g.globalAlpha = 1
        g.strokeStyle = s.colors.accent
        g.lineWidth = 2
        g.lineCap = 'round'
        g.beginPath()
        for (const st of s.strokes) {
          const u = ease.quint.inOut(clamp((t - st.delay) / st.dur))
          const r = st.rail
          trace(g, r, u * r.land, lerp(r.src, r.total, u))
        }
        g.stroke()
      }

      // The mark inks in over the nested strokes and locks at frame 20 with a detent.
      s.mark.draw(prog(t, fr(9.5), fr(10.5)))
      // A segment that has not started drawing still shows a hairline at its first point: hide it until it does.
      for (const seg of s.mark.segs) seg.style.visibility = Number(seg.getAttribute('stroke-dashoffset')) > 0.999 ? 'hidden' : 'visible'
      const detent = t >= LOCK ? 1 - prog(t, LOCK, fr(2)) : 0
      s.mark.el.style.filter = detent > 0 ? `brightness(${(1 + 0.55 * detent).toFixed(3)}) drop-shadow(0 0 ${(18 * detent).toFixed(1)}px ${s.colors.accent})` : 'none'

      // Tick dial: one linear sweep round the mark, two ticks a frame.
      if (t >= LOCK) {
        const leave = 1 - prog(t, ctx.dur, fr(5))
        const drawn = (t - LOCK) * 60
        g.lineCap = 'butt'
        for (let k = 0; k < 60 && k <= drawn; k++) {
          const major = k % 5 === 0
          const a = (k / 60) * TAU
          const r1 = s.dial.r0 + (major ? s.dial.major : s.dial.minor)
          const fresh = 1 - clamp((drawn - k) / 6)
          g.globalAlpha = leave * lerp(major ? 0.9 : 0.6, 1, fresh)
          g.strokeStyle = fresh > 0 ? s.colors.accent : major ? s.colors.white : s.colors.grey
          g.lineWidth = major ? 2 : 1.5
          g.beginPath()
          g.moveTo(s.cx + Math.sin(a) * s.dial.r0, s.cy - Math.cos(a) * s.dial.r0)
          g.lineTo(s.cx + Math.sin(a) * r1, s.cy - Math.cos(a) * r1)
          g.stroke()
        }
      }
      g.globalAlpha = 1
    },
  })
})()
