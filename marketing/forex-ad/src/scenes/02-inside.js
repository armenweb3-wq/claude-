/* Opening sequence, part 2 of 3: inside the second (2-4 s).
 *
 * The clamped span from the hook opens up in two servo steps: the ruler's
 * graduations go to 100 ms, then 10 ms, and fourteen illustrative price ticks
 * are plotted at their times within the second. "PRICES CAN CHANGE / MANY
 * TIMES A SECOND."
 *
 * This scene also owns the giant clock of the hook (lead: 2). It is the same
 * element, styled exactly like the overlay's corner clock and scaled up; from
 * 2.0 s it shrinks along a straight path, sits on the overlay position from
 * 2.5 s, and is switched off at 2.6 s when the overlay starts drawing its own.
 *
 * The 0.3 s tail closes the band and draws its last line away under the first
 * frames of `brand`, which takes the tick dots over at 4.0 s.
 *
 * Geometry, tick data and the ruler drawing come from AD.opening (01-hook.js).
 */
AD.defineScene('inside', {
  lead: 2,
  tail: 0.3,
  css: `
    .scene--inside .in-clock { position: absolute; display: flex; align-items: center; justify-content: flex-end; color: var(--white); letter-spacing: 0.02em; }
    .scene--inside .in-clock .utc { color: var(--grey); margin-left: 0.5em; }
    .scene--inside .in-px, .scene--inside .in-ax { position: absolute; left: 0; top: 0; line-height: 1; }
    .scene--inside .in-px { color: var(--white); }
    .scene--inside .in-px i { font-style: normal; color: var(--grey); }
    .scene--inside .in-ax { color: var(--grey); font-size: var(--t-tag); letter-spacing: 0.04em; }
  `,
  build(root, ctx) {
    const kit = AD.kit
    const O = AD.opening
    const G = O.geo(ctx)
    const c = ctx.content
    const L = ctx.layout
    const origin = root.getBoundingClientRect()

    const bg = AD.el('div', 'fill', root)
    kit.grid(bg)
    const fg = AD.el('div', 'fill', root)
    const cv = AD.canvas(fg)
    // Off-screen canvases for the motion blur of the two zoom steps.
    const offscreen = () => {
      const node = document.createElement('canvas')
      node.width = ctx.W
      node.height = ctx.H
      return { canvas: node, ctx: node.getContext('2d') }
    }
    const acc = offscreen()
    const tmp = offscreen()
    const cal = kit.caliper(fg, { labelSize: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-label')) })

    // Axis labels on the 100 ms graduations.
    const axis = []
    for (let k = 1; k <= 9; k++) {
      const node = AD.el('div', 'in-ax t-mono', fg, `0.${k}0 s`)
      const w2 = node.getBoundingClientRect().width
      node.textContent = `0.${k} s`
      axis.push({ node, coarse: `0.${k} s`, fine: `0.${k}0 s`, w1: node.getBoundingClientRect().width, w2 })
    }
    // Price labels: the unchanged digits in grey, the two that move in white.
    const prices = O.ticks.map(tk => {
      const node = AD.el('div', 'in-px t-mono', fg)
      node.style.fontSize = G.P.price + 'px'
      AD.el('i', null, node, tk.price.slice(0, 5))
      AD.el('span', null, node, tk.price.slice(5))
      return { node, w: node.getBoundingClientRect().width }
    })

    const lines = ctx.landscape ? ['PRICES CAN CHANGE', 'MANY TIMES A SECOND.'] : ['PRICES CAN CHANGE', 'MANY TIMES', 'A SECOND.']
    const head = kit.headline(fg, lines, { tier: 'display', x: c.x, y: c.y, w: c.w })
    // The hook's second line, carried across the cut so it gets its reading time.
    const linger = O.line2(fg, ctx)
    const tag = kit.tag(fg)
    const tagBox = tag.getBoundingClientRect()
    tag.style.left = c.x + 'px'
    tag.style.top = '0px'
    // The tag rides on the band's top edge. Repainted in place, the anti-aliased
    // corners of its border come out a shade different from seek to seek; on
    // its own layer it is rasterised once and only ever moved by whole pixels,
    // which makes every frame repeatable (tools/check.mjs fails without this).
    tag.style.willChange = 'transform'

    // The clock, built exactly like the overlay's.
    const clock = AD.el('div', 'in-clock t-mono', root)
    clock.style.right = ctx.W - L.clock.right + 'px'
    clock.style.top = L.clock.y + 'px'
    clock.style.height = L.clock.h + 'px'
    clock.style.fontSize = L.clock.fontSize + 'px'
    const time = AD.el('span', 'time', clock, kit.clock(0))
    const utc = AD.el('span', 'utc', clock, 'UTC')
    const measure = node => {
      const probe = AD.el('span', null, node)
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
      const r = node.getBoundingClientRect()
      const base = probe.getBoundingClientRect().top
      probe.remove()
      return { right: r.right - origin.left, base: base - origin.top, w: r.width, asc: base - r.top }
    }
    const mt = measure(time)
    const mu = measure(utc)
    time.style.transformOrigin = `${mt.w}px ${mt.asc}px`
    utc.style.transformOrigin = `${mu.w}px ${mu.asc}px`
    const track = L.clock.fontSize * 0.02 // trailing letter-spacing after the last glyph
    // Giant state. Landscape: time and a smaller UTC share one baseline and
    // fill the content width. Portrait: the time fills the width, UTC sits on
    // its own small line under its right end.
    const right = c.x + c.w
    let big
    if (G.P.utcBase) {
      const sT = c.w / (mt.w - track)
      const sU = G.P.utcScale
      big = {
        time: { s: sT, x: right + track * sT, y: c.y + G.P.clockBase },
        utc: { s: sU, x: right + track * sU, y: c.y + G.P.utcBase },
      }
    } else {
      const gap = L.clock.fontSize * 0.2
      const sT = c.w / (mt.w + gap + (mu.w - track) * G.P.utcScale)
      const sU = sT * G.P.utcScale
      big = {
        time: { s: sT, x: right - (mu.w - track) * sU - gap * sT, y: c.y + G.P.clockBase },
        utc: { s: sU, x: right + track * sU, y: c.y + G.P.clockBase },
      }
    }
    return { G, bg, fg, cv, acc, tmp, cal, axis, prices, head, linger, tag, tagH: tagBox.height, clock, time, utc, mt, mu, big }
  },
  render(t, ctx, s, T) {
    const { clamp, lerp, prog, ease } = AD
    const O = AD.opening
    const G = s.G
    const c = ctx.content
    const fps = AD.fps
    const live = t >= 0 && t < ctx.dur
    s.bg.style.display = live ? 'block' : 'none'
    s.fg.style.display = t >= 0 ? 'block' : 'none'

    // ── clock: giant until 2.0 s, on the overlay's position from 2.33 s, handed over at 2.6 s ──
    if (T < 2.6 - 1e-6) {
      s.clock.style.display = 'flex'
      s.time.textContent = AD.kit.clock(T)
      const p = ease.cubic.inOut(prog(t, 0, 10 / fps))
      if (p >= 1) {
        s.time.style.transform = 'none'
        s.utc.style.transform = 'none'
      } else {
        // Each part shrinks at a constant rate while its right-hand baseline
        // point travels a straight line to the dock. In portrait UTC starts on
        // its own line: it keeps under the time until the gap beside it opens.
        // In landscape the hook's second line is still up, above the clock's
        // left half: the travel lags the shrink (q), so the clock has drawn
        // clear to the right of that line before it rises through its row.
        const place = (node, m, b, x, y) => {
          node.style.transform = `translate(${(x - m.right).toFixed(3)}px,${(y - m.base).toFixed(3)}px) scale(${Math.pow(b.s, 1 - p).toFixed(5)})`
        }
        const B = s.big
        const q = ctx.landscape ? Math.pow(p, 1.6) : p
        const ty = lerp(B.time.y, s.mt.base, q)
        const drop = (B.utc.y - B.time.y) * (1 - ease.cubic.inOut(prog(p, 0.78, 0.22)))
        place(s.time, s.mt, B.time, lerp(B.time.x, s.mt.right, q), ty)
        place(s.utc, s.mu, B.utc, lerp(B.utc.x, s.mu.right, q), ty + drop)
      }
    } else s.clock.style.display = 'none'
    if (t < 0) return

    // ── the dive: two servo steps, a beat apart ──
    const zAt = time => ease.glide(prog(time, 0, 0.5)) + ease.glide(prog(time, 1, 0.5))
    const z = zAt(t)
    const V = G.view(z)
    const C = O.colors()
    const lo = c.x
    const hi = c.x + c.w
    const first = 0.5 - 1 / fps // first tick shows on the frame at 2.5 s...
    const every = 3 / fps // ...then one every three frames, five to the beat
    const g = s.cv.ctx
    g.clearRect(0, 0, ctx.W, ctx.H)

    // Everything on the canvas at one instant. Drawn several times across the
    // shutter while the camera moves, so the push-in smears instead of strobing.
    const paint = (g, time) => {
      const z = zAt(time)
      const V = G.view(z)
      const open = clamp(z)
      // Tail: the band shuts onto its mid-line, flattening the price line into
      // it, and the line that is left draws in towards the forming logo mark.
      const shut = prog(time, 2, 5 / fps, ease.snap)
      const inner = 1 - prog(time, 2, 2 / fps)
      const retract = prog(time, 2 + 3 / fps, 4 / fps, ease.cubic.in)
      if (retract >= 1) return
      g.save()
      if (retract > 0) {
        const xc = O.markCentre ? O.markCentre.x : ctx.W / 2
        const half = Math.max(xc, ctx.W - xc) * (1 - retract)
        g.beginPath()
        g.rect(xc - half, 0, half * 2, ctx.H)
        g.clip()
      }
      const B = shut > 0 ? { ...V, top: lerp(V.top, V.mid, shut), h: V.h * (1 - shut) } : V
      const unit = V.unit * (1 - shut)
      const yOf = level => V.mid - level * unit
      O.drawSecond(g, B, {
        fill: lerp(0.2, 0.055, open),
        fillTo: 1,
        head: 1,
        tail: 0,
        gridA: open * inner,
        major: () => inner,
        majorLen: lerp(V.h, 28, clamp(z * 4)) * (1 - shut),
        minor: inner > 0 ? j => prog(z - 1, Math.abs(j / 100 - G.P.focus) * 0.9, 0.5, ease.cubic.out) * inner : null,
        minorLen: 10,
        ext: G.ext * (1 - shut),
        crisp: (z === 1 || z === 2) && shut === 0,
      })
      if (z <= 0) {
        g.restore()
        return
      }

      // mid-line
      g.save()
      g.globalAlpha = inner * clamp(z * 2 - 1)
      g.strokeStyle = O.rgba(C.grey, 0.55)
      g.lineWidth = 1
      g.setLineDash([6, 8])
      g.beginPath()
      g.moveTo(V.xa, Math.round(V.mid) + 0.5)
      g.lineTo(V.xb, Math.round(V.mid) + 0.5)
      g.stroke()
      g.restore()

      // The price line is drawn at a constant rate; each tick is a step.
      const headTau = O.ticks[0].tau + ((time - first) / every) * O.PITCH
      if (headTau > 0) {
        g.save()
        g.strokeStyle = O.rgba(C.white, 0.95)
        g.lineWidth = 2
        g.lineJoin = 'miter'
        g.beginPath()
        let y = yOf(G.lead)
        g.moveTo(V.xa, y)
        for (const tk of O.ticks) {
          if (tk.tau > headTau) break
          const x = V.xa + tk.tau * V.span
          g.lineTo(x, y)
          y = yOf(tk.level)
          g.lineTo(x, y)
        }
        g.lineTo(V.xa + Math.min(1, headTau) * V.span, y)
        g.stroke()
        g.restore()
      }
      O.ticks.forEach((tk, k) => {
        const at = first + k * every
        const pop = time < ctx.dur ? prog(time, at, 3 / fps, ease.cubic.out) : 0 // from 4.0 s the dots belong to `brand`
        if (pop <= 0) return
        const d = G.dot(k, V)
        const ring = prog(time, at, 8 / fps) // a ring leaves each dot as it lands
        if (ring < 1) {
          g.beginPath()
          g.arc(d.x, d.y, V.r + 4 + 16 * ease.cubic.out(ring), 0, Math.PI * 2)
          g.strokeStyle = O.rgba(C.accent, 0.7 * (1 - ring))
          g.lineWidth = 2
          g.stroke()
        }
        O.drawDot(g, d.x, d.y, V.r * pop)
      })

      // Portrait: what lies outside the safe box is only an echo of the linework.
      if (!ctx.landscape) {
        const y0 = V.top - 40
        const hh = V.h + 80
        const veil = (x0, x1) => {
          const grad = g.createLinearGradient(x0, 0, x1, 0)
          grad.addColorStop(0, O.rgba(C.void, 0))
          grad.addColorStop(1, O.rgba(C.void, 0.6))
          g.fillStyle = grad
          g.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), hh)
        }
        g.save()
        g.globalAlpha = open
        veil(lo, lo - 48)
        veil(hi, hi + 48)
        g.fillStyle = O.rgba(C.void, 0.6)
        g.fillRect(0, y0, lo - 48, hh)
        g.fillRect(hi + 48, y0, ctx.W - hi - 48, hh)
        g.restore()
      }
      g.restore()
    }
    const moving = (t > 0 && t < 0.5) || (t > 1 && t < 1.5)
    if (moving) {
      const SUB = 6
      const { acc, tmp } = s
      acc.ctx.clearRect(0, 0, ctx.W, ctx.H)
      acc.ctx.globalCompositeOperation = 'lighter'
      acc.ctx.globalAlpha = 1 / SUB
      for (let j = 0; j < SUB; j++) {
        tmp.ctx.clearRect(0, 0, ctx.W, ctx.H)
        paint(tmp.ctx, t - (j / SUB) * (0.6 / fps))
        acc.ctx.drawImage(tmp.canvas, 0, 0)
      }
      g.drawImage(acc.canvas, 0, 0)
    } else paint(g, t)

    // The hook's caliper keeps measuring: it closes from the whole second onto
    // one 100 ms division, then onto one 10 ms division. 1.000 s, 0.100 s, 0.010 s.
    const e1 = clamp(z)
    const e2 = clamp(z - 1)
    const from = G.P.gauge
    const ta = from * e1
    const tb = lerp(lerp(1, from + 0.1, e1), from + 0.01, e2)
    s.cal.set({
      a: V.xa + ta * V.span,
      b: V.xa + tb * V.span,
      pos: V.top - lerp(G.calGap, G.jaw + 4, e1),
      jaw: G.jaw,
      open: 1,
      label: `${(tb - ta).toFixed(3)} s`,
      labelGap: 14,
      opacity: live ? 1 : 0,
    })

    // Price labels: above the dot for an up-tick, below for a down-tick.
    O.ticks.forEach((tk, k) => {
      const at = first + k * every
      const d = G.dot(k, V)
      const lab = s.prices[k]
      const fits = d.x - lab.w / 2 >= lo - 1 && d.x + lab.w / 2 <= hi + 1
      const on = live && fits ? prog(t, at + 1 / fps, 2 / fps) : 0
      lab.node.style.opacity = on.toFixed(3)
      if (on > 0) {
        const y = tk.up ? d.y - V.r - 12 - G.P.price : d.y + V.r + 12
        lab.node.style.transform = `translate(${Math.round(d.x - lab.w / 2)}px,${Math.round(y)}px)`
      }
    })

    // Axis labels under the 100 ms ticks, once there is room for them. They
    // gain a decimal place as the 10 ms graduations come in.
    const fine = z >= 1.5
    s.axis.forEach((a, i) => {
      const x = V.xa + ((i + 1) / 10) * V.span
      const w = fine ? a.w2 : a.w1
      const fits = x - w / 2 >= lo && x + w / 2 <= hi
      const on = live && fits ? prog(t, 8 / fps, 5 / fps) : 0
      a.node.style.opacity = on.toFixed(3)
      const text = fine ? a.fine : a.coarse
      if (a.node.textContent !== text) a.node.textContent = text
      a.node.style.transform = `translate(${Math.round(x - w / 2)}px,${Math.round(V.top + 36)}px)`
    })

    // Tag rides on the band's top edge from the moment a price is on screen.
    s.tag.style.opacity = live && t >= first - 2 / fps ? '1' : '0'
    s.tag.style.transform = `translate(0,${Math.round(V.top - 14 - s.tagH)}px)`

    // The hook's "WATCH WHAT FITS INSIDE IT." holds for nine frames past the cut
    // while the clock docks and the band starts to open, then leaves through its
    // mask; "PRICES CAN CHANGE" rises on the frame after it has gone (2.4 s).
    const HOLD = 9 / fps
    const EXIT = 3 / fps
    s.linger.show(t, { at: -1, out: HOLD, outDur: EXIT })
    // The block clears just ahead of the bar line (the kit staggers lines by
    // 0.04 s), so the last line is gone exactly as the dots are released at 4.0 s.
    const at = ctx.landscape ? [HOLD + EXIT, 1] : [HOLD + EXIT, 1, 1 + 2 / fps]
    s.head.show(t, { at, out: 1.9 - 0.04 * (at.length - 1), outDur: 0.1 })
  },
})
