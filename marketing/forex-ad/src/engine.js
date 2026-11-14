/* Deterministic timeline runtime for the ad.
 *
 * The whole spot is a pure function of time: AD.seek(T) puts every pixel into
 * the state it has at T seconds, in any order, with no memory of earlier calls.
 * The renderer (tools/render.mjs) seeks frame by frame and screenshots; the
 * preview transport seeks from a clock. Nothing here may depend on wall-clock
 * time, requestAnimationFrame, CSS animations/transitions or Math.random().
 *
 * Scene timing lives in src/timeline.js. Each scene file calls
 * AD.defineScene(id, { build, render, ... }) and is given a full-frame root.
 */
;(function () {
  'use strict'

  const params = new URLSearchParams(location.search)

  const FORMATS = {
    '16x9': { w: 1920, h: 1080 },
    '9x16': { w: 1080, h: 1920 },
    '4x5': { w: 1080, h: 1350 },
    '1x1': { w: 1080, h: 1080 },
  }
  // Insets (px) that readable content must stay inside. The vertical format
  // reserves room for the apps' own UI (profile row, captions, buttons).
  const SAFE = {
    // YouTube in-stream draws its skip button, CTA and progress bar over the bottom 15%.
    '16x9': { top: 54, right: 96, bottom: 162, left: 96 },
    // Intersection of the Reels, TikTok and Shorts UI zones: a 768x960 box.
    '9x16': { top: 288, right: 192, bottom: 672, left: 120 },
    '4x5': { top: 54, right: 54, bottom: 54, left: 54 },
    '1x1': { top: 54, right: 64, bottom: 54, left: 64 },
  }

  const format = FORMATS[params.get('format')] ? params.get('format') : '16x9'
  const { w: W, h: H } = FORMATS[format]
  const RENDER = params.get('render') === '1'

  // ── math ────────────────────────────────────────────────────────────────
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
  const lerp = (a, b, t) => a + (b - a) * t
  const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a))
  const remap = (v, a, b, c, d, ease) => {
    const p = clamp(invLerp(a, b, v))
    return lerp(c, d, ease ? ease(p) : p)
  }
  const smoothstep = (a, b, v) => {
    const p = clamp(invLerp(a, b, v))
    return p * p * (3 - 2 * p)
  }

  // Cubic-bezier easing, same parameters as CSS cubic-bezier().
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const fx = t => ((ax * t + bx) * t + cx) * t
    const fy = t => ((ay * t + by) * t + cy) * t
    const dfx = t => (3 * ax * t + 2 * bx) * t + cx
    return x => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 8; i++) {
        const e = fx(t) - x
        if (Math.abs(e) < 1e-6) break
        const d = dfx(t)
        if (Math.abs(d) < 1e-6) break
        t -= e / d
      }
      return fy(clamp(t))
    }
  }

  const pow = n => ({
    in: t => Math.pow(t, n),
    out: t => 1 - Math.pow(1 - t, n),
    inOut: t => (t < 0.5 ? Math.pow(2 * t, n) / 2 : 1 - Math.pow(2 * (1 - t), n) / 2),
  })
  const ease = {
    linear: t => t,
    quad: pow(2),
    cubic: pow(3),
    quart: pow(4),
    quint: pow(5),
    expo: {
      in: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
      out: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      inOut: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    },
    circ: {
      in: t => 1 - Math.sqrt(1 - t * t),
      out: t => Math.sqrt(1 - (t - 1) * (t - 1)),
      inOut: t => (t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2),
    },
    back: {
      in: t => 2.70158 * t * t * t - 1.70158 * t * t,
      out: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    },
    // House curves: a fast, confident settle and a soft symmetrical move.
    snap: bezier(0.16, 1, 0.3, 1),
    glide: bezier(0.65, 0, 0.35, 1),
    bezier,
  }

  /** Progress 0→1 of an animation that starts at t0 and lasts dur seconds. */
  const prog = (t, t0, dur, e) => {
    const p = dur <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / dur)
    return e ? e(p) : p
  }
  /** Envelope: rises 0→1 from inAt over inDur, falls 1→0 from outAt over outDur. */
  const envelope = (t, inAt, inDur, outAt, outDur, eIn, eOut) =>
    Math.min(prog(t, inAt, inDur, eIn), 1 - prog(t, outAt, outDur, eOut))

  // ── deterministic randomness ────────────────────────────────────────────
  function rng(seed) {
    let a = (seed >>> 0) || 1
    return function () {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const hash = n => {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b)
    x ^= x >>> 13
    x = Math.imul(x, 0xc2b2ae35)
    x ^= x >>> 16
    return (x >>> 0) / 4294967296
  }
  /** Smooth 1-D value noise in 0..1; continuous in x, different per seed. */
  const noise = (x, seed = 0) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return lerp(hash(i + seed * 7919), hash(i + 1 + seed * 7919), u)
  }
  /** Fractal noise in roughly -1..1. */
  const fbm = (x, seed = 0, octaves = 4) => {
    let v = 0, amp = 0.5, freq = 1, norm = 0
    for (let o = 0; o < octaves; o++) {
      v += (noise(x * freq, seed + o * 31) * 2 - 1) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return v / norm
  }

  // ── illustrative market data ────────────────────────────────────────────
  // Synthetic, mean-reverting and trendless by construction: it moves up and
  // down around a level and never depicts a one-way rally or a winning trade.
  const PAIRS = [
    { sym: 'EUR/USD', base: 1.0842, digits: 5, pip: 0.0001 },
    { sym: 'GBP/USD', base: 1.2715, digits: 5, pip: 0.0001 },
    { sym: 'USD/JPY', base: 151.32, digits: 3, pip: 0.01 },
    { sym: 'AUD/USD', base: 0.6538, digits: 5, pip: 0.0001 },
    { sym: 'USD/CHF', base: 0.8826, digits: 5, pip: 0.0001 },
    { sym: 'USD/CAD', base: 1.3594, digits: 5, pip: 0.0001 },
    { sym: 'NZD/USD', base: 0.6017, digits: 5, pip: 0.0001 },
    { sym: 'EUR/GBP', base: 0.8527, digits: 5, pip: 0.0001 },
    { sym: 'EUR/JPY', base: 164.05, digits: 3, pip: 0.01 },
    { sym: 'GBP/JPY', base: 192.4, digits: 3, pip: 0.01 },
  ]
  const market = {
    pairs: PAIRS,
    pair: sym => PAIRS.find(p => p.sym === sym) || PAIRS[0],
    /** Price of a pair at continuous time t (seconds): smooth and repeatable. */
    price(sym, t, speed = 1) {
      const p = market.pair(sym)
      const seed = PAIRS.indexOf(p) + 1
      const drift = fbm(t * 0.35 * speed, seed * 13, 4) * 22 + fbm(t * 2.6 * speed, seed * 29, 2) * 3
      return p.base + drift * p.pip
    },
    format(sym, value) {
      return value.toFixed(market.pair(sym).digits)
    },
    /** n candles of a mean-reverting walk: [{o,h,l,c}], values around `base`. */
    candles({ seed = 1, n = 60, base = 1.0842, vol = 0.0009, revert = 0.08 } = {}) {
      const r = rng(seed)
      const gauss = () => (r() + r() + r() + r() - 2) / 2
      const out = []
      let c = base
      for (let i = 0; i < n; i++) {
        const o = c
        c = o + gauss() * vol + (base - o) * revert
        const hi = Math.max(o, c) + Math.abs(gauss()) * vol * 0.6
        const lo = Math.min(o, c) - Math.abs(gauss()) * vol * 0.6
        out.push({ o, h: hi, l: lo, c })
      }
      return out
    },
    /** n points of a mean-reverting line. */
    line({ seed = 1, n = 200, base = 1.0842, vol = 0.0004, revert = 0.03 } = {}) {
      const r = rng(seed)
      const out = []
      let v = base
      for (let i = 0; i < n; i++) {
        v += ((r() + r() + r() - 1.5) / 1.5) * vol + (base - v) * revert
        out.push(v)
      }
      return out
    },
  }

  // ── DOM helpers ─────────────────────────────────────────────────────────
  function el(tag, className, parent, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined && text !== null) node.textContent = text
    if (parent) parent.appendChild(node)
    return node
  }
  const SVG_NS = 'http://www.w3.org/2000/svg'
  function svg(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag)
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k])
    if (parent) parent.appendChild(node)
    return node
  }
  /** Full-frame (or w×h) canvas with a 2-D context. */
  function canvas(parent, w = W, h = H) {
    const c = el('canvas', 'fill', parent)
    c.width = w
    c.height = h
    return { canvas: c, ctx: c.getContext('2d'), w, h }
  }
  /**
   * Split an element's text into spans for per-character / per-word motion.
   * Returns the array of leaf spans. Words stay unbroken; each leaf is wrapped
   * in a clipping parent when `mask` is true (for slide-up reveals).
   */
  function split(node, { by = 'chars', mask = false } = {}) {
    const text = node.textContent
    node.textContent = ''
    node.setAttribute('aria-label', text)
    const leaves = []
    const words = text.split(/(\s+)/)
    for (const word of words) {
      if (!word) continue
      if (/^\s+$/.test(word)) {
        node.appendChild(document.createTextNode(' '))
        continue
      }
      const wordEl = el('span', 'sp-word', node)
      wordEl.style.display = 'inline-block'
      wordEl.style.whiteSpace = 'nowrap'
      if (mask) {
        wordEl.style.overflow = 'hidden'
        wordEl.style.verticalAlign = 'top'
      }
      if (by === 'words') {
        const inner = el('span', 'sp-leaf', wordEl, word)
        inner.style.display = 'inline-block'
        leaves.push(inner)
      } else {
        for (const ch of Array.from(word)) {
          const c = el('span', 'sp-leaf', wordEl, ch)
          c.style.display = 'inline-block'
          leaves.push(c)
        }
      }
    }
    return leaves
  }
  /** Write transform/opacity in one go. Numbers are px / unitless / degrees. */
  function set(node, { x = 0, y = 0, scale = 1, scaleX, scaleY, rotate = 0, opacity, origin } = {}) {
    const sx = scaleX === undefined ? scale : scaleX
    const sy = scaleY === undefined ? scale : scaleY
    node.style.transform = `translate(${x.toFixed(3)}px,${y.toFixed(3)}px) rotate(${rotate.toFixed(3)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`
    if (opacity !== undefined) node.style.opacity = clamp(opacity).toFixed(4)
    if (origin) node.style.transformOrigin = origin
  }
  /** Progress of item i of n in a stagger: starts every `each` s, lasts dur s. */
  const stagger = (t, i, { at = 0, each = 0.04, dur = 0.5, ease: e } = {}) => prog(t, at + i * each, dur, e)

  // ── GSAP (optional) ─────────────────────────────────────────────────────
  // Scenes may build a paused GSAP timeline in build() and call tl.time(t) in
  // render(). Lazy rendering is off so a seek paints synchronously.
  function timeline(vars = {}) {
    if (!window.gsap) throw new Error('GSAP is not loaded')
    return window.gsap.timeline({ ...vars, paused: true, defaults: { lazy: false, ease: 'power3.out', ...(vars.defaults || {}) } })
  }

  // ── scenes ──────────────────────────────────────────────────────────────
  const defs = new Map()
  const scenes = []
  let duration = 0
  let stage = null
  let built = false
  let resolveReady
  const ready = new Promise(r => (resolveReady = r))

  const beforeBuild = []
  function defineScene(id, def) {
    if (defs.has(id)) console.error(`Scene "${id}" defined twice`)
    defs.set(id, def)
  }

  function makeCtx(entry) {
    return {
      id: entry.id,
      format,
      W,
      H,
      aspect: W / H,
      landscape: W > H,
      portrait: H > W,
      square: W === H,
      vertical: format === '9x16',
      safe: SAFE[format],
      // Safe rectangle in px: content that must be read stays inside it.
      box: { x: SAFE[format].left, y: SAFE[format].top, w: W - SAFE[format].left - SAFE[format].right, h: H - SAFE[format].top - SAFE[format].bottom },
      start: entry.start,
      end: entry.end,
      dur: entry.end - entry.start,
      beat: AD.beat,
      bar: AD.bar,
      config: window.AD_CONFIG || {},
      // Free areas between the persistent top row and the risk band (see kit.js).
      get layout() { return AD.layout },
      get content() { return AD.layout.content },
      get contentEnd() { return AD.layout.contentEnd },
      /** Pick a value per format: pick({ '16x9': a, '9x16': b, default: c }). */
      pick: map => (format in map ? map[format] : W > H && 'landscape' in map ? map.landscape : H > W && 'portrait' in map ? map.portrait : map.default),
    }
  }

  function build() {
    stage = document.getElementById('stage')
    stage.style.width = W + 'px'
    stage.style.height = H + 'px'
    document.documentElement.dataset.format = format
    document.documentElement.dataset.shape = W > H ? 'landscape' : W === H ? 'square' : 'portrait'
    const root = document.documentElement.style
    root.setProperty('--W', W + 'px')
    root.setProperty('--H', H + 'px')
    for (const side of ['top', 'right', 'bottom', 'left']) root.setProperty(`--safe-${side}`, SAFE[format][side] + 'px')

    const timelineDef = window.AD_TIMELINE
    duration = timelineDef.duration
    AD.duration = duration

    timelineDef.scenes.forEach((entry, index) => {
      const def = defs.get(entry.id)
      const rootEl = el('section', `scene scene--${entry.id}${entry.overlay ? ' scene--overlay' : ''}`, stage)
      rootEl.dataset.scene = entry.id
      rootEl.style.zIndex = String((entry.overlay ? 1000 : 10) + index)
      // Visible while building so scenes can measure text; hidden afterwards.
      rootEl.style.display = 'block'
      const scene = {
        ...entry,
        index,
        def,
        root: rootEl,
        lead: (def && def.lead) || 0,
        tail: (def && def.tail) || 0,
        active: false,
        ctx: null,
        state: null,
      }
      scene.ctx = makeCtx(scene)
      if (!def) {
        // A scene listed in the timeline but not built yet: show a slate so
        // the gap is obvious in stills instead of failing the whole page.
        const slate = el('div', 'scene-missing', rootEl, `scene "${entry.id}" not built`)
        slate.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;font:600 40px monospace;color:#f66;background:#200'
        scene.def = { render() {} }
      } else {
        if (def.css) el('style', null, document.head, def.css)
        try {
          scene.state = def.build ? def.build(rootEl, scene.ctx) || {} : {}
        } catch (err) {
          console.error(`Scene "${entry.id}" build failed: ${err && err.stack ? err.stack : err}`)
          scene.def = { render() {} }
        }
      }
      scenes.push(scene)
    })
    for (const s of scenes) s.root.style.display = 'none'
    AD.scenes = scenes.map(s => ({ id: s.id, start: s.start, end: s.end, title: s.title, overlay: !!s.overlay }))
    built = true
  }

  function seek(T) {
    if (!built) throw new Error('AD.seek called before AD.ready resolved')
    T = clamp(T, 0, duration)
    AD.time = T
    for (const s of scenes) {
      const last = s.end >= duration
      const active = T >= s.start - s.lead && (T < s.end + s.tail || (last && T <= s.end))
      if (active !== s.active) {
        s.root.style.display = active ? 'block' : 'none'
        s.active = active
      }
      if (active) {
        try {
          s.def.render(T - s.start, s.ctx, s.state, T)
        } catch (err) {
          console.error(`Scene "${s.id}" render failed at T=${T.toFixed(3)}: ${err && err.stack ? err.stack : err}`)
        }
      }
    }
  }

  /**
   * How visible the persistent brand bug and risk line should be at time T
   * (0..1 each). A timeline entry can set `chrome: 'none' | 'risk' | 'bug'`
   * to hide one or both while it is on screen; changes cross-fade over 0.4 s
   * centred on the cut.
   */
  function chromeAt(T) {
    const FADE = 0.4
    const level = (entry, key) => {
      const mode = entry.chrome || 'full'
      return mode === 'full' || mode === key ? 1 : 0
    }
    const main = scenes.filter(s => !s.overlay)
    const out = { bug: 1, risk: 1 }
    for (const key of ['bug', 'risk']) {
      let v = 1
      for (let i = 0; i < main.length; i++) {
        const s = main[i]
        if (T >= s.start && (T < s.end || i === main.length - 1)) {
          v = level(s, key)
          const prev = main[i - 1]
          const next = main[i + 1]
          if (prev && T - s.start < FADE / 2) v = lerp(level(prev, key), v, 0.5 + (T - s.start) / FADE)
          else if (next && s.end - T < FADE / 2) v = lerp(v, level(next, key), 0.5 - (s.end - T) / FADE)
          break
        }
      }
      out[key] = v
    }
    return out
  }

  // ── boot ────────────────────────────────────────────────────────────────
  function loadScript(src) {
    return new Promise(resolve => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => resolve(true)
      s.onerror = () => {
        console.warn(`Scene file missing: ${src}`)
        resolve(false)
      }
      document.head.appendChild(s)
    })
  }

  async function boot() {
    const timelineDef = window.AD_TIMELINE
    if (!timelineDef) throw new Error('src/timeline.js did not define window.AD_TIMELINE')
    AD.beat = 60 / timelineDef.bpm
    AD.bar = AD.beat * 4
    AD.fps = timelineDef.fps || 30
    const files = [...new Set(timelineDef.scenes.map(s => s.file).filter(Boolean))]
    for (const file of files) await loadScript(`scenes/${file}`)
    // Make sure every weight used anywhere is decoded before the first frame.
    const faces = [...document.fonts]
    await Promise.all(faces.map(f => f.load().catch(() => null)))
    await document.fonts.ready
    stage = document.getElementById('stage')
    stage.style.width = W + 'px'
    stage.style.height = H + 'px'
    for (const hook of beforeBuild) hook(stage)
    build()
    seek(0)
    if (!RENDER) startPreview()
    resolveReady()
  }

  // ── preview transport (not used when rendering) ─────────────────────────
  function startPreview() {
    document.documentElement.dataset.preview = '1'
    const fit = () => {
      const k = Math.min(innerWidth / W, (innerHeight - 56) / H)
      stage.style.transform = `scale(${k})`
      stage.style.left = (innerWidth - W * k) / 2 + 'px'
      stage.style.top = (innerHeight - 56 - H * k) / 2 + 'px'
    }
    stage.style.position = 'absolute'
    stage.style.transformOrigin = '0 0'
    addEventListener('resize', fit)
    fit()
    if (params.get('safe') === '1') {
      const g = el('div', null, stage)
      const s = SAFE[format]
      g.style.cssText = `position:absolute;z-index:99999;left:${s.left}px;top:${s.top}px;right:${s.right}px;bottom:${s.bottom}px;outline:2px dashed rgba(255,0,170,.8);pointer-events:none`
    }
    const bar = el('div', null, document.body)
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:56px;display:flex;gap:12px;align-items:center;padding:0 16px;background:#111;color:#ddd;font:14px/1 monospace;z-index:100000'
    const btn = el('button', null, bar, 'Play')
    const range = el('input', null, bar)
    range.type = 'range'
    range.min = 0
    range.max = duration
    range.step = 1 / AD.fps
    range.value = 0
    range.style.flex = '1'
    const label = el('span', null, bar, '0.00')
    const audio = new Audio('../out/audio.wav')
    let playing = false
    let t0 = 0
    let c0 = 0
    const show = t => {
      seek(t)
      range.value = t
      label.textContent = `${t.toFixed(2)} / ${duration.toFixed(0)}s  ${format}`
    }
    const tick = () => {
      if (!playing) return
      const t = c0 + (performance.now() - t0) / 1000
      if (t >= duration) {
        playing = false
        btn.textContent = 'Play'
        audio.pause()
        show(duration)
        return
      }
      show(t)
      requestAnimationFrame(tick)
    }
    const toggle = () => {
      playing = !playing
      btn.textContent = playing ? 'Pause' : 'Play'
      if (playing) {
        c0 = Number(range.value) >= duration ? 0 : Number(range.value)
        t0 = performance.now()
        audio.currentTime = c0
        audio.play().catch(() => {})
        requestAnimationFrame(tick)
      } else audio.pause()
    }
    btn.onclick = toggle
    range.oninput = () => {
      if (playing) toggle()
      show(Number(range.value))
    }
    addEventListener('keydown', e => {
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      }
    })
    show(Number(params.get('t') || 0))
  }

  const AD = (window.AD = {
    format,
    W,
    H,
    safe: SAFE[format],
    rendering: RENDER,
    duration: 0,
    fps: 30,
    beat: 0.5,
    bar: 2,
    time: 0,
    ready,
    seek,
    defineScene,
    beforeBuild: fn => beforeBuild.push(fn),
    layout: null,
    chromeAt,
    scenes: [],
    // toolkit
    clamp,
    lerp,
    invLerp,
    remap,
    smoothstep,
    ease,
    prog,
    envelope,
    stagger,
    rng,
    hash,
    noise,
    fbm,
    market,
    el,
    svg,
    canvas,
    split,
    set,
    timeline,
  })

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(e => console.error(e)))
  else boot().catch(e => console.error(e))
})()
