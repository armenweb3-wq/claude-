/* S15 — end card (52–60 s). A calm, almost still composition: the mark from
 * the converge scene glides into the big lockup, the thesis re-sets as the
 * sentence-case promise, then the call to action, the URL and the legal lines
 * arrive. Everything is in place by 53.5 and static from 54.0 apart from one
 * thin light that runs along the datum rule at 54.0 and 58.0. No fade-out:
 * the last frame is a complete end card.
 *
 * Layout: a hero zone (lockup, promise, button, URL) above a hairline datum,
 * and a legal zone (entity line, notes) docked beneath it, directly above the
 * risk band. All sizes come from measured text, so a longer brand name, URL
 * or legal line re-flows instead of colliding.
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { el, svg, lerp, prog, ease, clamp } = AD
  const fr = n => n / 30

  /** Distance from an element's top edge to the baseline of its first line. */
  function baseline(node) {
    const probe = el('span', null, null)
    probe.style.cssText = 'display:inline-block;width:0;height:0'
    node.insertBefore(probe, node.firstChild)
    const y = probe.getBoundingClientRect().top - node.getBoundingClientRect().top
    probe.remove()
    return y
  }

  AD.defineScene('endcard', {
    css: `
      .scene--endcard .ec-lit {
        position: absolute; inset: 0; opacity: 0;
        background-image: linear-gradient(to right, var(--accent) 1px, transparent 1px), linear-gradient(to bottom, var(--accent) 1px, transparent 1px);
        background-size: var(--grid) var(--grid); background-position: center center;
      }
      .scene--endcard .ec-datum { position: absolute; height: 1px; background: var(--grey); opacity: 0.4; transform-origin: 0 50%; }
      .scene--endcard .ec-sweep { position: absolute; overflow: hidden; }
      .scene--endcard .ec-sweep .beam {
        position: absolute; left: 0; top: 50%; height: 2px; margin-top: -1px; border-radius: 1px;
        background: linear-gradient(to right, transparent, var(--accent) 82%, var(--white));
        box-shadow: 0 0 14px 1px color-mix(in srgb, var(--accent) 45%, transparent);
      }
      .scene--endcard .ec-promise {
        position: absolute; overflow: hidden; white-space: nowrap;
        font-family: var(--font-display); font-weight: 500; letter-spacing: 0.012em; line-height: 1.16; color: var(--white);
      }
      .scene--endcard .ec-promise > span { display: inline-block; }
      .scene--endcard .ec-btn { position: absolute; }
      .scene--endcard .ec-btn .fill { position: absolute; inset: 0; border-radius: var(--radius); background: var(--accent); opacity: 0; }
      .scene--endcard .ec-btn .lbl {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap;
        font-family: var(--font-display); font-weight: 600; font-size: var(--t-label); letter-spacing: 0.05em; color: var(--accent);
      }
      .scene--endcard .ec-btn .lbl > span { display: inline-block; }
      .scene--endcard .ec-url { position: absolute; white-space: nowrap; line-height: 1; letter-spacing: 0.03em; color: var(--white); }
      .scene--endcard .ec-url .caret { position: absolute; left: 0; bottom: -0.12em; width: 0.56em; height: 0.1em; background: var(--accent); }
      .scene--endcard .ec-legal {
        position: absolute; margin: 0; font-family: var(--font-text); font-weight: 400; line-height: 1.32;
        color: color-mix(in srgb, var(--white) 48%, var(--grey)); text-wrap: pretty;
      }
    `,

    build(root, ctx) {
      const kit = AD.kit
      const cfg = ctx.config
      const c = ctx.contentEnd
      const { W, H } = ctx
      const wide = ctx.landscape
      const pick = ctx.pick

      // ── background: grid, the light that follows the sweep, the datum ──
      const grid = kit.grid(root)
      const lit = el('div', 'ec-lit', root)
      // Hard limit: the light can never reach the top row or the risk band.
      lit.style.clipPath = `inset(${c.y}px 0 ${H - (c.y + c.h)}px 0)`
      const datum = el('div', 'ec-datum', root)
      const sweep = el('div', 'ec-sweep', root)
      const beam = el('div', 'beam', sweep)

      // ── content elements (created first, measured, then placed) ──
      const promise = el('div', 'ec-promise', root)
      const promiseIn = el('span', null, promise, cfg.brand.promise)
      const btn = el('div', 'ec-btn', root)
      const btnFill = el('div', 'fill', btn)
      const btnSvg = svg('svg', { class: 'k-svg' }, btn)
      const btnRect = svg('rect', { fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, rx: 6, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, btnSvg)
      const btnLbl = el('div', 'lbl', btn)
      const btnLblIn = el('span', null, btnLbl, cfg.brand.cta)
      const url = el('div', 'ec-url t-mono', root)
      const urlChars = Array.from(cfg.brand.url).map(ch => el('span', null, url, ch))
      const caret = el('span', 'caret', url)
      const entity = el('p', 'ec-legal', root, kit.fill(cfg.legal.entity))
      const notes = el('p', 'ec-legal', root, cfg.legal.notes)

      const place = (node, x, y) => {
        node.style.left = Math.round(x) + 'px'
        node.style.top = Math.round(y) + 'px'
      }
      const heightOf = node => node.getBoundingClientRect().height
      const widthOf = node => node.getBoundingClientRect().width

      // ── sizes per format ──
      const spec = pick({
        '16x9': { mark: 164, markFloor: 116, promise: 70, btnH: 78, btnPad: 44, url: 30, legal: [28, 24], g1: 30, g2: 0, g3: 0, legalGap: 30, min: 24 },
        '4x5': { mark: 160, markFloor: 116, promise: 66, btnH: 78, btnPad: 46, url: 28, legal: [26, 22], g1: 32, g2: 58, g3: 26, legalGap: 32, min: 28 },
        '9x16': { mark: 118, markFloor: 80, promise: 52, btnH: 70, btnPad: 40, url: 26, legal: [24, 22], g1: 22, g2: 38, g3: 20, legalGap: 26, min: 14 },
      })
      url.style.fontSize = spec.url + 'px'
      kit.fit(url, c.w)
      const lblW = widthOf(btnLblIn)
      const btnW = Math.min(c.w, Math.ceil(lblW + spec.btnPad * 2))
      if (lblW > btnW - 40) btnLblIn.style.fontSize = Math.floor((parseFloat(getComputedStyle(btnLbl).fontSize) * (btnW - 40)) / lblW) + 'px'

      // Columns: in 16:9 the action and the notes share a right-hand column.
      const colB = wide ? { x: c.x + c.w - Math.max(btnW, 560), w: Math.max(btnW, 560) } : { x: c.x, w: c.w }
      const colA = wide ? { x: c.x, w: colB.x - 96 - c.x } : { x: c.x, w: c.w }

      // ── legal zone: as large as fits, never below the minimum ──
      entity.style.width = Math.min(colA.w, 1060) + 'px'
      notes.style.width = colB.w + 'px'
      const paraGap = size => (wide ? 0 : Math.round(size * 0.42))
      const legalHeight = size => {
        entity.style.fontSize = notes.style.fontSize = size + 'px'
        return wide ? Math.max(heightOf(entity), heightOf(notes)) : heightOf(entity) + paraGap(size) + heightOf(notes)
      }

      // ── hero zone: lockup sized from the measured wordmark ──
      const probe = kit.lockup(root, { size: 100 })
      const per100 = probe.width
      probe.el.remove()
      const maxLockW = wide ? colA.w : c.w
      // A short name leaves room for a slightly larger lockup.
      const markMax = spec.mark * (Array.from(cfg.brand.name).length <= 6 ? 1.15 : 1)
      const urlH = heightOf(url)
      // The hero at mark scale m, gap scale g and margin scale q. The promise follows
      // the lockup: it is never set larger than 68% of the wordmark's size, so the
      // brand name always leads, however small the lockup has to become.
      const G_MIN = 0.5
      const Q_MIN = 0.6
      const M_MIN = 0.5
      const hero = (m, g, q) => {
        const mark = Math.floor(Math.min(markMax * m, (maxLockW / per100) * 100))
        const promiseSize = Math.min(spec.promise, Math.floor(Math.round(mark * 0.74) * 0.68))
        promise.style.fontSize = promiseSize + 'px'
        const promiseH = heightOf(promise)
        const g1 = spec.g1 * g
        const g2 = spec.g2 * g
        const g3 = spec.g3 * g
        const height = wide ? mark + g1 + promiseH : mark + g1 + g2 + g3 + promiseH + spec.btnH + urlH
        // Clear room above and below the hero, and between the datum and the legal lines.
        const legalGap = Math.round(spec.legalGap * lerp(0.7, 1, (q - Q_MIN) / (1 - Q_MIN)))
        return { mark, promiseSize, promiseH, g1, g2, g3, height, legalGap, need: height + (2 * spec.min + spec.legalGap) * q + legalGap }
      }
      // What gives way when the legal text is long, in this order:
      //  1. the legal lines, from their largest size down to their floor;
      //  2. lockup and spacing together, as far as the mark's floor;
      //  3. spacing and margins alone;
      //  4. only then the lockup below its floor.
      let legalSize = spec.legal[0]
      let m = 1
      let gs = 1
      let q = 1
      const fits = () => hero(m, gs, q).need + legalHeight(legalSize) <= c.h
      while (!fits() && legalSize > spec.legal[1]) legalSize--
      const mFloor = Math.min(1, spec.markFloor / markMax)
      while (!fits() && m > mFloor) m = gs = Math.max(mFloor, m - 0.03)
      while (!fits() && gs > G_MIN) {
        gs = Math.max(G_MIN, gs - 0.03)
        q = lerp(Q_MIN, 1, clamp((gs - G_MIN) / Math.max(0.01, mFloor - G_MIN)))
      }
      while (!fits() && m > M_MIN) m = Math.max(M_MIN, m - 0.03)
      const legalH = legalHeight(legalSize)
      const { mark: markSize, promiseSize, promiseH, g1, g2, g3, height: heroH, legalGap } = hero(m, gs, q) // leaves the promise at its final size

      // ── place the legal zone and the datum ──
      const legalTop = c.y + c.h - legalH
      place(entity, colA.x, legalTop)
      place(notes, colB.x, wide ? legalTop : legalTop + heightOf(entity) + paraGap(legalSize))
      const datumY = Math.round(legalTop - legalGap)
      datum.style.left = c.x + 'px'
      datum.style.top = datumY + 'px'
      datum.style.width = c.w + 'px'

      // ── place the hero zone, centred between the top row and the datum ──
      const heroTop = c.y + (datumY - c.y - heroH) / 2
      const lock = kit.lockup(root, { size: markSize })
      const wordFont = parseFloat(lock.word.style.fontSize)
      const lockW = lock.width - wordFont * 0.1 // without the wordmark's trailing letter-space
      const ringInset = markSize * 0.075 // the ring sits this far inside the mark's box
      let lockX
      if (wide) {
        lockX = colA.x - ringInset
        place(lock.el, lockX, heroTop)
        place(promise, colA.x - promiseSize * 0.04, heroTop + markSize + g1)
        btn.style.width = colB.w + 'px'
        place(btn, colB.x, heroTop + markSize / 2 - spec.btnH / 2)
        // The URL shares the promise's baseline.
        place(url, colB.x, heroTop + markSize + g1 + baseline(promise) - baseline(url))
      } else {
        const mid = c.x + c.w / 2
        lockX = mid - lockW / 2
        place(lock.el, lockX, heroTop)
        place(promise, mid - widthOf(promise) / 2, heroTop + markSize + g1)
        btn.style.width = btnW + 'px'
        place(btn, mid - btnW / 2, heroTop + markSize + g1 + promiseH + g2)
        place(url, mid - widthOf(url) / 2 + spec.url * 0.015, heroTop + markSize + g1 + promiseH + g2 + spec.btnH + g3)
      }
      btn.style.height = spec.btnH + 'px'
      const bw = parseFloat(btn.style.width)
      btnSvg.setAttribute('width', bw)
      btnSvg.setAttribute('height', spec.btnH)
      btnRect.setAttribute('x', 1)
      btnRect.setAttribute('y', 1)
      btnRect.setAttribute('width', bw - 2)
      btnRect.setAttribute('height', spec.btnH - 2)

      // ── the light sweep runs along the datum, inside its own clipped strip ──
      const beamLen = Math.round(c.w * 0.42)
      sweep.style.left = c.x + 'px'
      sweep.style.width = c.w + 'px'
      sweep.style.top = datumY - 24 + 'px'
      sweep.style.height = '49px'
      beam.style.width = beamLen + 'px'

      // ── hand-over: the lockup mark starts where the converge scene locked its mark ──
      const from = (AD.shared && AD.shared.converge) || { cx: W / 2, cy: heroTop + markSize / 2, size: markSize }
      const markCx = Math.round(lockX) + markSize / 2
      const markCy = Math.round(heroTop) + markSize / 2
      lock.mark.draw(1)

      return {
        grid, lit, sweep, beam, beamLen, datum, datumY, lock, promiseIn, btnFill, btnRect, btnLblIn, urlChars, caret, entity, notes,
        start: { dx: from.cx - markCx, dy: from.cy - markCy, scale: from.size / markSize },
        letters: Array.from(cfg.brand.name).length,
        urlStep: widthOf(url) / urlChars.length,
        c,
      }
    },

    render(t, ctx, s) {
      // Background settles to the calmer end-card level.
      s.grid.style.opacity = lerp(0.55, 0.4, prog(t, 0, 0.5)).toFixed(3)

      // 52.0 — the mark glides from the centre into the lockup (15 frames, in-out).
      const p = prog(t, 0, 0.5, ease.glide)
      s.lock.mark.el.style.transform = `translate(${(s.start.dx * (1 - p)).toFixed(2)}px, ${(s.start.dy * (1 - p)).toFixed(2)}px) scale(${lerp(s.start.scale, 1, p).toFixed(4)})`
      // The wordmark sets beside it, left to right, one letter a frame.
      const wipe = prog(t, 0.4, fr(s.letters))
      s.lock.word.style.clipPath = `inset(-20% ${((1 - wipe) * 100).toFixed(2)}% -20% -4%)`
      s.lock.word.style.opacity = wipe > 0 ? '1' : '0'

      // The thesis has left by frame 7; it re-sets here as the sentence-case promise.
      const rise = prog(t, fr(7), 1 / 3, ease.snap)
      s.promiseIn.style.transform = `translate3d(0,${((1 - rise) * 110).toFixed(3)}%,0)`
      s.promiseIn.style.opacity = rise > 0 ? '1' : '0'

      // 52.5 — legal lines on, hard; the datum draws across.
      s.entity.style.opacity = s.notes.style.opacity = t >= 0.5 ? '1' : '0'
      s.datum.style.transform = `scaleX(${prog(t, 0.5, 0.4).toFixed(4)})`

      // 53.0 — the button's border draws (8 frames), it fills (4 frames) and its label sets; the URL types on.
      s.btnRect.setAttribute('stroke-dashoffset', (1 - prog(t, 1, fr(8))).toFixed(4))
      s.btnFill.style.opacity = (0.1 * prog(t, 1 + fr(8), fr(4))).toFixed(4)
      const label = prog(t, 1 + fr(4), 1 / 3, ease.snap)
      s.btnLblIn.style.transform = `translate3d(0,${((1 - label) * 130).toFixed(3)}%,0)`
      s.btnLblIn.style.opacity = label > 0 ? '1' : '0'
      const typed = Math.floor((t - 1) * 30 + 1e-6) + 1
      s.urlChars.forEach((ch, i) => (ch.style.opacity = i < typed ? '1' : '0'))
      const typing = t >= 1 && typed <= s.urlChars.length
      // A caret rides under the next character while the URL is being typed, then goes.
      s.caret.style.opacity = typing ? '1' : '0'
      s.caret.style.transform = `translate3d(${(Math.max(0, typed) * s.urlStep).toFixed(2)}px,0,0)`

      // 54.0 and 58.0 — one thin light runs the length of the datum (30 frames, linear).
      let run = -1
      for (const at of [2, 6]) if (t >= at && t < at + 1) run = t - at
      if (run < 0) {
        s.sweep.style.display = 'none'
        s.lit.style.opacity = '0'
      } else {
        const head = lerp(0, s.c.w + s.beamLen, run)
        s.sweep.style.display = 'block'
        s.beam.style.transform = `translate3d(${(head - s.beamLen).toFixed(2)}px,0,0)`
        const hx = clamp(s.c.x + head, s.c.x, s.c.x + s.c.w)
        const glow = Math.min(1, run * 8, (1 - run) * 8)
        const mask = `radial-gradient(ellipse 240px 96px at ${hx.toFixed(1)}px ${s.datumY}px, #000 0%, transparent 100%)`
        s.lit.style.webkitMaskImage = mask
        s.lit.style.maskImage = mask
        s.lit.style.opacity = (0.32 * glow).toFixed(4)
      }
    },
  })
})()
