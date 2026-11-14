/* Opening sequence, part 3 of 3: brand lock (4-6 s).
 *
 * The fourteen tick dots leave the price line and fly to the points of the
 * logo mark; the reticle's ring is drawn through them and turns a quarter
 * into lock; the wordmark is set letter by letter; the descriptor follows on
 * the next beat and a target frame closes around the lockup. At the end the
 * lockup travels back to its corner and lands on the persistent brand bug.
 *
 * The big lockup is the bug's own lockup (AD.kit.lockup at the bug's size and
 * position) with a transform on the mark and one on the wordmark, so when the
 * transforms reach identity it is the bug, pixel for pixel. All sizes come
 * from the measured wordmark, so any name of 5 to 14 characters fits.
 *
 * Dot start positions come from AD.opening (01-hook.js).
 */
AD.defineScene('brand', {
  css: `
    .scene--brand .br-desc { position: absolute; left: 0; top: 0; overflow: hidden; padding: 0.1em 0 0.06em; color: var(--white); }
    .scene--brand .br-desc span { display: inline-block; }
    .scene--brand .br-rule { position: absolute; height: 2px; background: var(--accent); transform-origin: 0 50%; }
  `,
  build(root, ctx) {
    const kit = AD.kit
    const O = AD.opening
    const G = O.geo(ctx)
    const c = ctx.content
    const L = ctx.layout
    const origin = root.getBoundingClientRect()
    const rect = node => {
      const r = node.getBoundingClientRect()
      return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }
    }
    // y of the text baseline inside a box, measured with a zero-size inline probe
    const baselineOf = (inner, box) => {
      const probe = AD.el('span', null, inner)
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
      const y = probe.getBoundingClientRect().top - box.getBoundingClientRect().top
      probe.remove()
      return y
    }

    kit.grid(root)
    const cv = AD.canvas(root)
    const frame = kit.brackets(root)

    const lock = kit.lockup(root, { size: L.bug.markSize, x: L.bug.x, y: L.bug.y + (L.bug.h - L.bug.markSize) / 2 })
    lock.mark.el.style.transformOrigin = '0 0'
    lock.word.style.transformOrigin = '0 0'
    const mr = rect(lock.mark.el)
    const wr = rect(lock.word)
    const wordSize = parseFloat(getComputedStyle(lock.word).fontSize)
    const wordTrack = parseFloat(getComputedStyle(lock.word).letterSpacing) || 0 // trailing space after the last letter
    const wordInk = wr.w - wordTrack

    // Where each letter of the wordmark ends, for the letter-by-letter mask.
    const textNode = lock.word.firstChild
    const range = document.createRange()
    const cuts = []
    for (let i = 0; i < textNode.length; i++) {
      range.setStart(textNode, i)
      range.setEnd(textNode, i + 1)
      cuts.push(range.getBoundingClientRect().right - origin.left - wr.x)
    }
    const wordBase = baselineOf(lock.word, lock.word)
    const ink = document.createElement('canvas').getContext('2d')
    ink.font = `600 100px ${getComputedStyle(lock.word).fontFamily}`
    const capRatio = ink.measureText('H').actualBoundingBoxAscent / 100
    const wordCap = capRatio * wordSize

    // Descriptor (label tier) and, in landscape, a rule that runs on to the wordmark's right edge.
    const desc = AD.el('div', 'br-desc t-label', root)
    const descIn = AD.el('span', null, desc, ctx.config.brand.descriptor)
    const rule = AD.el('div', 'br-rule', root)
    const labelSize = parseFloat(getComputedStyle(desc).fontSize)
    const descCap = capRatio * labelSize
    const descBase = baselineOf(descIn, desc)

    // ── big lockup layout ──
    const P = ctx.pick({
      '16x9': { stack: false, mark: 208, fill: 0.7, pad: 48 },
      '9x16': { stack: true, mark: 190, word: 116, pad: 40 },
      '4x5': { stack: true, mark: 240, word: 136, pad: 52 },
    })
    const RING = 0.425 // outer radius of the ring as a share of the mark's size
    let big, box, descAt, ruleAt
    if (!P.stack) {
      // Mark left, wordmark right. The wordmark's caps sit on the ring's top
      // edge and the descriptor's baseline on its bottom edge.
      const k = Math.min(P.mark / mr.w, (c.w * P.fill) / lock.width)
      const M = mr.w * k
      desc.style.letterSpacing = '0.2em'
      const dw = rect(desc).w - labelSize * 0.2
      // Ink extents relative to the mark's box, so the whole block can be centred.
      const inkLeft = M * (0.5 - RING)
      const wordLeft = (wr.x - mr.x) * k
      const wordRight = wordLeft + wordInk * k
      const descLeft = wordLeft + k * 0.6
      const inkRight = Math.max(wordRight, descLeft + dw)
      const x = c.x + (c.w - (inkRight - inkLeft)) / 2 - inkLeft
      const y = c.y + (c.h - M) / 2 - 10
      const ringTop = y + M * (0.5 - RING)
      const ringBot = y + M * (0.5 + RING)
      big = { mark: { x, y, k }, word: { x: x + wordLeft, y: ringTop - (wordBase - wordCap) * k, k } }
      descAt = { x: x + descLeft, y: ringBot - descBase }
      const ruleX = descAt.x + dw + labelSize * 0.5
      const ruleW = x + wordRight - ruleX
      ruleAt = ruleW > 48 ? { x: ruleX, y: ringBot - descCap / 2 - 1, w: ruleW } : null
      box = { x: x + inkLeft - P.pad, y: ringTop - P.pad, w: inkRight - inkLeft + P.pad * 2, h: ringBot - ringTop + P.pad * 2 }
    } else {
      // Mark above, wordmark and descriptor centred under it.
      const km = P.mark / mr.w
      const kw = Math.min(P.word / wordSize, (c.w - P.pad * 2) / wordInk)
      const M = P.mark
      const wordW = wordInk * kw
      const capH = wordCap * kw
      desc.style.letterSpacing = '0.16em'
      let dw = rect(desc).w - labelSize * 0.16
      if (dw > c.w - P.pad * 2) {
        desc.style.letterSpacing = '0.08em'
        dw = rect(desc).w - labelSize * 0.08
      }
      const gap1 = M * 0.2
      const gap2 = capH * 0.5
      const inkH = M * RING * 2 + gap1 + capH + gap2 + descCap
      const top = c.y + (c.h - inkH) / 2 // top of the ring
      const cx = c.x + c.w / 2
      const capTop = top + M * RING * 2 + gap1
      big = {
        mark: { x: cx - M / 2, y: top - M * (0.5 - RING), k: km },
        word: { x: cx - wordW / 2, y: capTop - (wordBase - wordCap) * kw, k: kw },
      }
      descAt = { x: cx - dw / 2, y: capTop + capH + gap2 + descCap - descBase }
      ruleAt = null
      const bw = Math.max(M, wordW, dw) + P.pad * 2
      box = { x: cx - bw / 2, y: top - P.pad, w: bw, h: inkH + P.pad * 2 }
    }
    desc.style.transform = `translate(${descAt.x.toFixed(2)}px,${descAt.y.toFixed(2)}px)`
    if (ruleAt) {
      rule.style.left = ruleAt.x.toFixed(2) + 'px'
      rule.style.top = ruleAt.y.toFixed(2) + 'px'
      rule.style.width = ruleAt.w.toFixed(2) + 'px'
    }

    // ── where the dots go: three on each ring segment, two on the centre tick ──
    const targets = []
    for (let i = 0; i < 4; i++) for (const a of [-34, 0, 34]) targets.push({ ring: true, a: i * 90 + a })
    targets.push({ ring: false, dy: -0.12 }, { ring: false, dy: 0.12 })
    const lockX = tg => (tg.ring ? Math.sin((tg.a * Math.PI) / 180) : 0)
    const lockY = tg => (tg.ring ? -Math.cos((tg.a * Math.PI) / 180) : tg.dy)
    targets.sort((p, q) => lockX(p) - lockX(q) || lockY(p) - lockY(q))
    const V = G.view(2)
    const M = mr.w * big.mark.k
    const centre = { x: big.mark.x + M / 2, y: big.mark.y + M / 2 }
    const dots = O.ticks.map((tk, k) => ({ from: G.dot(k, V), to: targets[k], r: V.r }))
    // Dots nearest the mark leave first, a third of a frame apart.
    dots
      .map((d, i) => ({ i, dist: Math.hypot(d.from.x - centre.x, d.from.y - centre.y) }))
      .sort((p, q) => p.dist - q.dist)
      .forEach((o, rank) => (dots[o.i].delay = rank / (AD.fps * 3)))

    return { cv, frame, lock, mr, wr, cuts, descIn, rule, ruleAt, big, box, dots, centre, M }
  },
  render(t, ctx, s) {
    const { clamp, lerp, prog, ease } = AD
    const O = AD.opening
    const C = O.colors()
    const fps = AD.fps
    const f = Math.round(t * fps) // frame within the scene, for events that step
    const M = s.M

    // ── timing (seconds from 4.0) ──
    const DRAW = 6 / fps // the ring starts to draw and turn
    const LOCK = 0.5 // mark and wordmark complete, on the beat
    const FRAME = 1 // target frame draws
    const CLEAR = 1 + 17 / fps // frame and descriptor clear
    const BACK = 1 + 20 / fps // lockup leaves for the corner...
    const LAND = 1 + 28 / fps // ...and is on the bug two frames before the cut
    // It accelerates into the corner and stops dead: at no point does a
    // half-arrived copy sit across the overlay's bug.
    const back = ease.quad.in(prog(t, BACK, LAND - BACK))
    const landed = back >= 1
    const landFrame = Math.round(LAND * fps)
    const turnAt = time => -90 * (1 - prog(time, DRAW, LOCK - DRAW, ease.snap))

    // ── mark ──
    s.lock.mark.draw(prog(t, DRAW, LOCK - DRAW))
    const mk = s.lock.mark.el
    // On the bug it gives a one-frame detent, then the copy is switched off:
    // the overlay's bug underneath is the same pixels.
    s.lock.el.style.opacity = f > landFrame ? '0' : '1'
    s.lock.el.style.filter = f === landFrame ? 'brightness(1.6) drop-shadow(0 0 6px var(--accent))' : 'none'
    if (landed) mk.style.transform = 'none'
    else {
      const k = lerp(s.big.mark.k, 1, back)
      const half = (s.mr.w / 2) * k
      const x = lerp(s.big.mark.x, s.mr.x, back) - s.mr.x + half
      const y = lerp(s.big.mark.y, s.mr.y, back) - s.mr.y + half
      mk.style.transform = `translate(${x.toFixed(3)}px,${y.toFixed(3)}px) rotate(${turnAt(t).toFixed(3)}deg) scale(${k.toFixed(5)}) translate(${-s.mr.w / 2}px,${-s.mr.w / 2}px)`
    }
    // One-frame brightness detent as the ring locks.
    mk.style.filter = f === Math.round(LOCK * fps) ? `brightness(1.5) drop-shadow(0 0 ${(M * 0.06).toFixed(1)}px var(--accent))` : 'none'

    // ── wordmark: one letter per frame (at most ten frames), complete on the lock ──
    const n = s.cuts.length
    const frames = Math.min(n, 10)
    const step = f - (Math.round(LOCK * fps) - frames) + 1
    const shown = clamp(Math.round((step / frames) * n), 0, n)
    const wd = s.lock.word
    wd.style.clipPath = shown >= n ? 'none' : `inset(-30% ${(s.wr.w - (shown ? s.cuts[shown - 1] : 0)).toFixed(2)}px -30% 0)`
    if (landed) wd.style.transform = 'none'
    else {
      const k = lerp(s.big.word.k, 1, back)
      wd.style.transform = `translate(${(lerp(s.big.word.x, s.wr.x, back) - s.wr.x).toFixed(3)}px,${(lerp(s.big.word.y, s.wr.y, back) - s.wr.y).toFixed(3)}px) scale(${k.toFixed(5)})`
    }

    // ── descriptor and its rule ──
    const dIn = prog(t, LOCK, 9 / fps, ease.snap)
    const dOut = prog(t, CLEAR, 3 / fps, ease.cubic.in)
    s.descIn.style.transform = `translate(0,${((1 - dIn) * 115 + dOut * 115).toFixed(2)}%)`
    s.descIn.style.opacity = dIn <= 0 || dOut >= 1 ? '0' : '1'
    if (s.ruleAt) {
      const rIn = prog(t, LOCK + 5 / fps, 9 / fps, ease.snap)
      s.rule.style.transform = `scaleX(${(rIn * (1 - dOut)).toFixed(4)})`
      s.rule.style.opacity = rIn > 0 && dOut < 1 ? '1' : '0'
    } else s.rule.style.opacity = '0'

    // ── target frame: corner brackets grow out of the corners ──
    const fIn = prog(t, FRAME, 8 / fps, ease.snap)
    const fOut = prog(t, CLEAR, 3 / fps, ease.cubic.in)
    const len = 30 * fIn * (1 - fOut)
    s.frame.set({ ...s.box, len: Math.max(len, 0.01), opacity: len > 0.5 ? 1 : 0 })

    // ── canvas: frame hairline, construction lines and the dots in flight ──
    const g = s.cv.ctx
    g.clearRect(0, 0, ctx.W, ctx.H)
    const { x: cx, y: cy } = s.centre
    const R = M * 0.38

    if (fIn > 0 && fOut < 1) {
      const b = s.box
      const per = 2 * (b.w + b.h)
      g.strokeStyle = O.rgba(C.grey, 0.38 * (1 - fOut))
      g.lineWidth = 1
      g.setLineDash([per * fIn, per])
      g.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, Math.round(b.w), Math.round(b.h))
      g.setLineDash([])
    }

    // Construction: crosshair and pitch circle while the mark is being made.
    const con = prog(t, 2 / fps, 6 / fps, ease.cubic.out) * (1 - prog(t, LOCK, 5 / fps))
    if (con > 0) {
      g.strokeStyle = O.rgba(C.grey, 0.5 * con)
      g.lineWidth = 1
      const reach = M * (0.5 + 0.42 * con)
      g.beginPath()
      g.moveTo(Math.round(cx - reach), Math.round(cy) + 0.5)
      g.lineTo(Math.round(cx + reach), Math.round(cy) + 0.5)
      g.moveTo(Math.round(cx) + 0.5, Math.round(cy - reach))
      g.lineTo(Math.round(cx) + 0.5, Math.round(cy + reach))
      g.stroke()
      g.beginPath()
      g.arc(cx, cy, R, 0, Math.PI * 2)
      g.stroke()
    }

    // Dots: each flies a shallow arc to its point on the (already turning) mark.
    const posAt = (d, time) => {
      const p = ease.quint.out(prog(time, d.delay, 8 / fps))
      const rot = (turnAt(time) * Math.PI) / 180
      let ex, ey
      if (d.to.ring) {
        const a = (d.to.a * Math.PI) / 180 + rot
        ex = cx + R * Math.sin(a)
        ey = cy - R * Math.cos(a)
      } else {
        ex = cx - Math.sin(rot) * d.to.dy * M
        ey = cy + Math.cos(rot) * d.to.dy * M
      }
      const dx = ex - d.from.x
      const dy = ey - d.from.y
      // control point off the chord, always to the same side: a slight swirl
      const qx = (d.from.x + ex) / 2 - dy * 0.22
      const qy = (d.from.y + ey) / 2 + dx * 0.22
      const u = 1 - p
      return { x: u * u * d.from.x + 2 * u * p * qx + p * p * ex, y: u * u * d.from.y + 2 * u * p * qy + p * p * ey, p }
    }
    const dotOut = prog(t, LOCK - 3 / fps, 4 / fps)
    if (dotOut < 1) {
      for (const d of s.dots) {
        const now = posAt(d, t)
        const r = lerp(d.r, M * 0.036, now.p)
        if (now.p > 0 && now.p < 0.999) {
          // streak: the path covered since the previous frame
          const SUB = 14
          for (let j = SUB; j >= 1; j--) {
            const q = posAt(d, t - (j / SUB) * (1.4 / fps))
            g.beginPath()
            g.arc(q.x, q.y, r * (1 - (j / SUB) * 0.55), 0, Math.PI * 2)
            g.fillStyle = O.rgba(C.accent, 0.2 * (1 - j / (SUB + 1)))
            g.fill()
          }
        }
        O.drawDot(g, now.x, now.y, r, 1 - dotOut)
      }
    }
  },
})
