/* Shared building blocks so every scene speaks the same visual language:
 * layout zones, the house headline reveal, the caliper, the reticle logo
 * mark, corner brackets, tags, chapter tabs, the engineering grid and the
 * monochrome candle style. Everything is driven by time passed in by the
 * caller, so it stays a pure function of the frame being rendered. Motion uses
 * 2-D transforms only: 3-D transforms and will-change promote elements to
 * compositor layers, whose rasterisation depends on what was shown before.
 */
;(function () {
  'use strict'
  const AD = window.AD
  const { el, svg, clamp, lerp, prog, ease } = AD
  const cfg = window.AD_CONFIG
  const F = AD.format
  const W = AD.W
  const H = AD.H

  // Brand colours from config become the CSS tokens used everywhere.
  const css = document.documentElement.style
  for (const [key, value] of Object.entries(cfg.colors || {})) css.setProperty(`--${key}`, value)

  // ── text from config ────────────────────────────────────────────────────
  const fill = template => String(template).replace(/\{pct\}/g, cfg.legal.lossPercent).replace(/\{brand\}/g, cfg.brand.name)
  /** Risk warning as HTML with the percentage sentence in bold. kind: 'short' | 'full' */
  function riskHTML(kind) {
    const text = fill(kind === 'full' ? cfg.legal.riskFull : cfg.legal.riskShort)
    return text
      .split(/(?<=[.!?])\s+/)
      .map(sentence => {
        const safe = sentence.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        return sentence.includes(cfg.legal.lossPercent + '%') ? `<b>${safe}</b>` : safe
      })
      .join(' ')
  }

  // ── layout zones ────────────────────────────────────────────────────────
  // The top row (brand bug left, clock right) and the risk band are on screen
  // for the whole spot; scenes compose inside `content` (or `contentEnd` once
  // the band carries the full warning, from T = 50 s).
  //
  // `content` is fixed per format so the scenes never move when the legal
  // text changes. The band sits in the zone reserved under it, set at
  // `bandFont` (the size of the film's label text, so the warning is never
  // smaller than what surrounds it) and stepping down only if longer wording
  // would not fit that zone.
  const ZONES = {
    '16x9': { x: 96, w: 1728, rowY: 54, bandBottom: 918, contentBottom: 782, rulerY: 990, bandFont: 34 },
    '9x16': { x: 120, w: 768, rowY: 288, bandBottom: 1248, contentBottom: 1089, rulerY: 1300, bandFont: 30 },
    '4x5': { x: 54, w: 972, rowY: 54, bandBottom: 1296, contentBottom: 1131, rulerY: 1322, bandFont: 30 },
  }
  const BAND_MIN_FONT = 24
  const BAND_MIN_GAP = 12
  const Z = ZONES[F]
  const ROW_H = 56
  const GAP = 28
  const BAND_PAD_X = 24
  const BAND_PAD_Y = 14

  const lineFor = font => Math.round(font * 1.27)
  function measureBand(stage, kind, font) {
    const probe = el('div', 'k-riskband', stage)
    probe.style.cssText = `position:absolute;visibility:hidden;left:${Z.x}px;top:0;width:${Z.w}px;box-sizing:border-box;padding:${BAND_PAD_Y}px ${BAND_PAD_X}px;font:400 ${font}px/${lineFor(font)}px var(--font-text);border:2px solid transparent`
    probe.innerHTML = riskHTML(kind)
    const h = Math.ceil(probe.getBoundingClientRect().height)
    probe.remove()
    return h
  }

  AD.beforeBuild(stage => {
    const reserved = Z.bandBottom - Z.contentBottom - BAND_MIN_GAP
    let font = Z.bandFont
    while (font > BAND_MIN_FONT && measureBand(stage, 'short', font) > reserved) font--
    const hShort = measureBand(stage, 'short', font)
    const hFull = measureBand(stage, 'full', font)
    if (hShort > reserved) console.error(`Risk warning does not fit its band at ${font}px: shorten legal.riskShort in config.js`)
    const band = { x: Z.x, y: Z.bandBottom - hShort, w: Z.w, h: hShort }
    const bandFull = { x: Z.x, y: Z.bandBottom - hFull, w: Z.w, h: hFull }
    const top = Z.rowY + ROW_H + GAP
    AD.layout = {
      row: { x: Z.x, y: Z.rowY, w: Z.w, h: ROW_H },
      bug: { x: Z.x, y: Z.rowY, h: ROW_H, markSize: 40, fontSize: 30 },
      clock: { right: Z.x + Z.w, y: Z.rowY, h: ROW_H, fontSize: 26 },
      band,
      bandFull,
      bandStyle: { font, line: lineFor(font), padX: BAND_PAD_X, padY: BAND_PAD_Y },
      content: { x: Z.x, y: top, w: Z.w, h: Z.contentBottom - top },
      contentEnd: { x: Z.x, y: top, w: Z.w, h: bandFull.y - GAP - top },
      ruler: { x: Z.x, y: Z.rulerY, w: Z.w },
    }
  })

  // ── clock ───────────────────────────────────────────────────────────────
  /** The film's running clock at absolute time T: "14:32:07.433". Frame-exact. */
  function clock(T) {
    const frame = Math.round(T * AD.fps)
    const ms = Math.round(((frame % AD.fps) * 1000) / AD.fps)
    const sec = Math.floor(frame / AD.fps)
    return `14:32:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }

  // ── fitting ─────────────────────────────────────────────────────────────
  /** Shrink an element's font-size until it is no wider than maxWidth. */
  function fit(node, maxWidth) {
    const width = node.scrollWidth
    if (width > maxWidth && width > 0) {
      const size = parseFloat(getComputedStyle(node).fontSize)
      node.style.fontSize = Math.floor(size * (maxWidth / width) * 100) / 100 + 'px'
    }
    return node
  }

  // ── headline ────────────────────────────────────────────────────────────
  /**
   * The house headline: upper-case condensed lines that rise from behind their
   * baseline. Type "sets", it never flies.
   *
   *   const h = kit.headline(root, ['NO ONE CAN PREDICT', 'THE NEXT PRICE.'],
   *                          { tier: 'display', x: c.x, y: c.y, w: c.w, align: 'left' })
   *   h.show(t, { at: 0, each: 0.5, out: 3.7 })      // call every frame
   *
   * lines: strings, or { text, cls } to colour a line (cls: 'c-accent', ...).
   * opts.tier: 'display' | 'h2' | 'h3'. opts.w is the max width: longer lines
   * shrink the whole block to fit. x/y is the top-left of the block (for
   * align 'center' the block is still w wide, with centred text).
   */
  function headline(parent, lines, opts = {}) {
    const { tier = 'display', x = 0, y = 0, w = W, align = 'left' } = opts
    const node = el('div', `k-headline t-${tier}`, parent)
    node.style.left = x + 'px'
    node.style.top = y + 'px'
    node.style.width = w + 'px'
    node.style.textAlign = align
    const items = lines.map(line => {
      const spec = typeof line === 'string' ? { text: line } : line
      const wrap = el('span', 'ln', node)
      const inner = el('span', spec.cls || null, wrap, spec.text)
      return { wrap, inner }
    })
    const widest = Math.max(...items.map(i => i.inner.getBoundingClientRect().width))
    if (widest > w) {
      const size = parseFloat(getComputedStyle(node).fontSize)
      node.style.fontSize = Math.floor(size * (w / widest) * 100) / 100 + 'px'
    }
    const box = node.getBoundingClientRect()
    const api = {
      el: node,
      lines: items,
      width: Math.min(w, widest),
      height: box.height,
      lineHeight: box.height / items.length,
      /**
       * at: time the first line starts (or an array with one time per line);
       * each: delay between lines; dur: rise time; out: time the block leaves
       * (omit to stay). Returns the visibility 0..1 of the first line.
       */
      show(t, { at = 0, each = 0.5, dur = 1 / 3, out = Infinity, outDur = 0.2 } = {}) {
        let first = 0
        items.forEach((item, i) => {
          const start = Array.isArray(at) ? at[i] : at + i * each
          const pin = prog(t, start, dur, ease.snap)
          const pout = out === Infinity ? 0 : prog(t, out + i * 0.04, outDur, ease.cubic.in)
          item.inner.style.transform = `translateY(${((1 - pin) * 108 - pout * 108).toFixed(3)}%)`
          item.inner.style.opacity = pin <= 0 || pout >= 1 ? '0' : '1'
          if (i === 0) first = Math.min(pin, 1 - pout)
        })
        return first
      },
    }
    return api
  }

  // ── caliper ─────────────────────────────────────────────────────────────
  /**
   * The film's signature gesture: two jaws that close on a span and a label
   * that reads it out.
   *
   *   const cal = kit.caliper(root, { orientation: 'h' })
   *   cal.set({ a: x1, b: x2, pos: y, open: AD.prog(t, 1.0, 0.25, AD.ease.snap), label: '1.000 s' })
   *
   * orientation 'h' measures along x (a..b are x positions, pos is the y of
   * the beam, jaws hang down by `jaw` px; pass a negative jaw to point up).
   * orientation 'v' measures along y (a..b are y positions, pos is the x of
   * the beam, jaws reach left by `jaw` px; negative reaches right).
   * open 0 = jaws wide apart and invisible, 1 = closed exactly on a and b.
   */
  function caliper(parent, { orientation = 'h', color = 'var(--accent)', labelSize } = {}) {
    const root = svg('svg', { class: 'k-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, parent)
    const path = svg('path', { fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'square' }, root)
    const text = svg('text', { fill: color, 'font-family': 'JetBrains Mono, monospace', 'font-weight': 500, 'letter-spacing': '0.08em' }, root)
    const size = labelSize || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t-tag')) * 1.2
    text.setAttribute('font-size', size)
    return {
      el: root,
      set({ a, b, pos, open = 1, jaw = 28, label = '', opacity = 1, labelGap = 12 }) {
        const spread = (1 - clamp(open)) * 56
        const lo = Math.min(a, b) - spread
        const hi = Math.max(a, b) + spread
        const tooth = 7 * Math.sign(jaw || 1)
        let d
        if (orientation === 'h') {
          d = `M${lo},${pos + jaw} L${lo},${pos} L${hi},${pos} L${hi},${pos + jaw} M${lo},${pos + jaw} l${7},0 M${hi},${pos + jaw} l${-7},0 M${(lo + hi) / 2},${pos} l0,${-tooth}`
          text.setAttribute('x', (lo + hi) / 2)
          text.setAttribute('y', jaw >= 0 ? pos - labelGap - 4 : pos + labelGap + size)
          text.setAttribute('text-anchor', 'middle')
        } else {
          d = `M${pos - jaw},${lo} L${pos},${lo} L${pos},${hi} L${pos - jaw},${hi} M${pos - jaw},${lo} l0,${7} M${pos - jaw},${hi} l0,${-7} M${pos},${(lo + hi) / 2} l${tooth},0`
          text.setAttribute('x', jaw >= 0 ? pos + labelGap + 4 : pos - labelGap - 4)
          text.setAttribute('y', (lo + hi) / 2 + size * 0.35)
          text.setAttribute('text-anchor', jaw >= 0 ? 'start' : 'end')
        }
        path.setAttribute('d', d)
        if (text.textContent !== label) text.textContent = label
        root.style.opacity = (clamp(opacity) * clamp(open * 3)).toFixed(4)
      },
    }
  }

  // ── corner brackets ─────────────────────────────────────────────────────
  /** Four corner brackets framing a rectangle: brackets.set({ x, y, w, h, len, opacity }). */
  function brackets(parent, { color = 'var(--accent)', width = 2 } = {}) {
    const root = svg('svg', { class: 'k-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, parent)
    const path = svg('path', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'square' }, root)
    return {
      el: root,
      set({ x, y, w, h, len = 26, opacity = 1 }) {
        const r = x + w
        const b = y + h
        path.setAttribute(
          'd',
          `M${x},${y + len} L${x},${y} L${x + len},${y} M${r - len},${y} L${r},${y} L${r},${y + len} M${r},${b - len} L${r},${b} L${r - len},${b} M${x + len},${b} L${x},${b} L${x},${b - len}`,
        )
        root.style.opacity = clamp(opacity).toFixed(4)
      },
    }
  }

  // ── logo mark and lockup ────────────────────────────────────────────────
  /**
   * The placeholder logo: a reticle made of a four-segment ring with a single
   * centre tick. mark.draw(p) draws it on (p 0..1): segments sweep in one after
   * another, then the centre tick drops in.
   */
  function mark(parent, size = 96, { ring = 'var(--white)', tick = 'var(--accent)' } = {}) {
    const root = svg('svg', { class: 'k-mark', width: size, height: size, viewBox: '0 0 100 100' }, parent)
    root.style.overflow = 'visible'
    root.style.flex = 'none'
    const R = 38
    const GAPDEG = 22
    const segs = []
    for (let i = 0; i < 4; i++) {
      const a0 = ((i * 90 - 45 + GAPDEG / 2) * Math.PI) / 180
      const a1 = (((i + 1) * 90 - 45 - GAPDEG / 2) * Math.PI) / 180
      const d = `M${(50 + R * Math.sin(a0)).toFixed(3)},${(50 - R * Math.cos(a0)).toFixed(3)} A${R},${R} 0 0 1 ${(50 + R * Math.sin(a1)).toFixed(3)},${(50 - R * Math.cos(a1)).toFixed(3)}`
      segs.push(svg('path', { d, fill: 'none', stroke: ring, 'stroke-width': 9, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 0 }, root))
    }
    const centre = svg('path', { d: 'M50,38 L50,62', fill: 'none', stroke: tick, 'stroke-width': 9 }, root)
    centre.style.transformOrigin = '50px 50px'
    return {
      el: root,
      segs,
      tick: centre,
      size,
      draw(p) {
        segs.forEach((seg, i) => seg.setAttribute('stroke-dashoffset', (1 - prog(p, i * 0.14, 0.44, ease.cubic.out)).toFixed(4)))
        const pt = prog(p, 0.7, 0.3, ease.back.out)
        centre.style.transform = `scale(1,${pt.toFixed(4)})`
        centre.style.opacity = pt > 0 ? '1' : '0'
      },
    }
  }

  /** Mark + wordmark. size is the mark's size in px; the wordmark scales with it. */
  function lockup(parent, { size = 96, x = 0, y = 0 } = {}) {
    const node = el('div', 'k-lockup', parent)
    node.style.left = x + 'px'
    node.style.top = y + 'px'
    node.style.gap = Math.round(size * 0.32) + 'px'
    const m = mark(node, size)
    const word = el('div', 'wordmark', node, cfg.brand.name)
    word.style.fontSize = Math.round(size * 0.74) + 'px'
    const box = node.getBoundingClientRect()
    return { el: node, mark: m, word, width: box.width, height: box.height }
  }

  // ── small components ────────────────────────────────────────────────────
  function grid(parent, { opacity = 0.55, vignette = true } = {}) {
    const g = el('div', 'k-grid', parent)
    g.style.opacity = opacity
    if (vignette) el('div', 'k-vignette', parent)
    return g
  }
  /** Small mono tag; defaults to the "ILLUSTRATIVE" label required on mock prices and UI. */
  function tag(parent, text, { x = 0, y = 0 } = {}) {
    const node = el('div', 'k-tag', parent, text || cfg.legal.illustrativeTag)
    node.style.left = x + 'px'
    node.style.top = y + 'px'
    return node
  }
  /** Chapter tab "01 — SEE": tab.show(t, at) each frame. */
  function chapterTab(parent, num, title, { x = 0, y = 0 } = {}) {
    const node = el('div', 'k-chapter', parent)
    node.style.left = x + 'px'
    node.style.top = y + 'px'
    const n = el('span', 'num', node, num)
    const rule = el('span', 'rule', node)
    const ttl = el('span', 'ttl', node, title)
    return {
      el: node,
      show(t, at = 0, out = Infinity) {
        const p = prog(t, at, 0.3, ease.snap)
        const o = out === Infinity ? 1 : 1 - prog(t, out, 0.2)
        n.style.opacity = (p * o).toFixed(4)
        rule.style.transform = `scaleX(${prog(t, at + 0.08, 0.3, ease.snap).toFixed(4)})`
        rule.style.opacity = o.toFixed(4)
        ttl.style.opacity = (prog(t, at + 0.16, 0.3) * o).toFixed(4)
        ttl.style.transform = `translateX(${((1 - prog(t, at + 0.16, 0.3, ease.snap)) * 14).toFixed(3)}px)`
      },
    }
  }

  // ── candles ─────────────────────────────────────────────────────────────
  /**
   * Monochrome candles on a canvas 2-D context: rising candles are hollow
   * white outlines, falling candles are filled grey. Never green and red.
   * rect: {x,y,w,h} to draw in; min/max: price range mapped to the rect;
   * count: how many candles are visible (fractional = the last one growing in);
   * slots: how many candles the rect is divided into (default candles.length).
   * Returns { xOf(i), yOf(price), step } for placing lines and labels.
   */
  function drawCandles(g, candles, { rect, min, max, count = candles.length, slots = candles.length, alpha = 1 }) {
    const step = rect.w / slots
    const bodyW = Math.max(3, Math.round(step * 0.58))
    const yOf = v => rect.y + rect.h - ((v - min) / (max - min)) * rect.h
    const xOf = i => rect.x + step * (i + 0.5)
    const white = getComputedStyle(document.documentElement).getPropertyValue('--white').trim()
    const grey = getComputedStyle(document.documentElement).getPropertyValue('--grey').trim()
    const n = Math.min(candles.length, Math.ceil(count))
    for (let i = 0; i < n; i++) {
      const c = candles[i]
      const grow = i === n - 1 ? clamp(count - (n - 1)) : 1
      const close = lerp(c.o, c.c, grow)
      const hi = lerp(Math.max(c.o, close), c.h, grow)
      const lo = lerp(Math.min(c.o, close), c.l, grow)
      const x = Math.round(xOf(i))
      const up = close >= c.o
      const top = yOf(Math.max(c.o, close))
      const bodyH = Math.max(2, Math.abs(yOf(c.o) - yOf(close)))
      g.globalAlpha = alpha
      g.lineWidth = 2
      g.strokeStyle = up ? white : grey
      g.beginPath()
      g.moveTo(x, yOf(hi))
      g.lineTo(x, top)
      g.moveTo(x, top + bodyH)
      g.lineTo(x, yOf(lo))
      g.stroke()
      if (up) g.strokeRect(x - bodyW / 2 + 1, top + 1, bodyW - 2, Math.max(1, bodyH - 2))
      else {
        g.fillStyle = grey
        g.fillRect(x - bodyW / 2, top, bodyW, bodyH)
      }
    }
    g.globalAlpha = 1
    return { xOf, yOf, step }
  }

  AD.kit = { fill, riskHTML, clock, fit, headline, caliper, brackets, mark, lockup, grid, tag, chapterTab, drawCandles }
})()
