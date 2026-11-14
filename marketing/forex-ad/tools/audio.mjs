#!/usr/bin/env node
// Music and sound design for the ad, synthesized from scratch (no samples, no
// dependencies). 120 BPM, 30 bars, centred on D with stacked fifths and
// suspended voicings (pitch set D E G A C: there is never a third over the root).
//
//   node tools/audio.mjs             writes out/audio.wav (48 kHz, stereo, 24-bit, 60.000 s)
//   node tools/audio.mjs --analyze   also prints a measurement report (loudness, peaks,
//                                    per-bar stem levels, band balance, correlation, onsets)
//   node tools/audio.mjs --16        16-bit output with TPDF dither instead of 24-bit
//
// Layout: 1. toolkit (oscillators, envelopes, filters, delay, reverb, limiter)
//         2. voices   3. score (the cue sheet, in seconds on the beat grid)
//         4. mix and master   5. analysis
// Everything is deterministic: all noise comes from seeded generators.
//
// Mixed to translate on phone speakers: kick, bass, drone and the frame-0 hit
// each carry a mid-range layer above 300 Hz beside their sub, and --analyze
// reports every section through a 300 Hz high-pass next to the full-range figure.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARGS = new Set(process.argv.slice(2))
const ANALYZE = ARGS.has('--analyze')
const BITS = ARGS.has('--16') ? 16 : 24

// ═════════════════════════════ 1. TOOLKIT ═════════════════════════════════

const SR = 48000
const DUR = 60
const N = SR * DUR // 2,880,000 frames
const TAU = Math.PI * 2
const STEP = 0.125 // one 16th note in seconds (6000 samples)
const TRIP = 1 / 6 // one 8th-note triplet in seconds (8000 samples, 5 frames at 30 fps)
const GAP0 = 15.5 * SR // start of the total silence before the drop
const GAP1 = 16 * SR
const END_SILENCE = 59.8 // everything is exactly zero from here on

const at = t => Math.round(t * SR)
const dB = x => Math.pow(10, x / 20)
const toDb = x => (x > 0 ? 20 * Math.log10(x) : -Infinity)
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x)

// mulberry32: small, fast, seedable.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let seedCounter = 1
const nextSeed = () => Math.imul(seedCounter++, 0x9e3779b1) >>> 0
function noise(n, seed = nextSeed()) {
  const r = rng(seed)
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) b[i] = r() * 2 - 1
  return b
}

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
function hz(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name)
  const semis = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 440 * Math.pow(2, (12 * (Number(m[3]) + 1) + semis - 69) / 12)
}
const cents = c => Math.pow(2, c / 1200)

// Piecewise automation curve from [time, value] points. 'exp' interpolates
// geometrically (right for frequencies), 'lin' linearly (right for gains).
function curve(points, shape = 'lin') {
  return t => {
    if (t <= points[0][0]) return points[0][1]
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const [t0, v0] = points[i - 1]
        const [t1, v1] = points[i]
        if (t1 === t0) return v1
        const u = (t - t0) / (t1 - t0)
        return shape === 'exp' ? v0 * Math.pow(v1 / v0, u) : v0 + (v1 - v0) * u
      }
    }
    return points[points.length - 1][1]
  }
}

// ── Oscillators ──────────────────────────────────────────────────────────
// PolyBLEP residual: rounds the saw's step so it does not alias.
function blep(t, dt) {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

// ── Envelopes ────────────────────────────────────────────────────────────
// Fade a buffer in (raised cosine, `a` seconds) and out (`r` seconds) in place.
function taper(buf, a, r) {
  const na = Math.min(buf.length, Math.round(a * SR))
  const nr = Math.min(buf.length, Math.round(r * SR))
  for (let i = 0; i < na; i++) buf[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / na)
  for (let i = 0; i < nr; i++) buf[buf.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nr)
  return buf
}
// ADSR sampled into a buffer of gate + release length. Exponential decay and
// release (time constants d/4 and r/5), raised-cosine attack, guaranteed zero end.
function adsr(gate, a, d, s, r) {
  const ng = Math.round(gate * SR)
  const n = ng + Math.round(r * SR)
  const env = new Float32Array(n)
  const na = Math.max(1, Math.round(a * SR))
  const kd = Math.exp(-1 / ((d / 4) * SR))
  const kr = Math.exp(-1 / ((r / 5) * SR))
  let v = 0
  let dec = 1
  for (let i = 0; i < n; i++) {
    if (i < ng) {
      if (i < na) v = 0.5 - 0.5 * Math.cos((Math.PI * i) / na)
      else {
        dec *= kd
        v = s + (1 - s) * dec
      }
    } else v *= kr
    env[i] = v
  }
  const nt = Math.min(n - ng, Math.round(0.004 * SR)) // land on exact zero
  for (let i = 0; i < nt; i++) env[n - 1 - i] *= i / nt
  return env
}

// ── Filters ──────────────────────────────────────────────────────────────
// RBJ biquad coefficients.
function biquad(type, f, q = 0.7071, gainDb = 0) {
  const w = (TAU * f) / SR
  const c = Math.cos(w)
  const s = Math.sin(w)
  const al = s / (2 * q)
  const A = Math.pow(10, gainDb / 40)
  let b0, b1, b2, a0, a1, a2
  if (type === 'lp') [b0, b1, b2, a0, a1, a2] = [(1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al]
  else if (type === 'hp') [b0, b1, b2, a0, a1, a2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al]
  else if (type === 'bp') [b0, b1, b2, a0, a1, a2] = [al, 0, -al, 1 + al, -2 * c, 1 - al]
  else if (type === 'peak') [b0, b1, b2, a0, a1, a2] = [1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A]
  else {
    const sq = 2 * Math.sqrt(A) * al
    if (type === 'loshelf') {
      b0 = A * (A + 1 - (A - 1) * c + sq)
      b1 = 2 * A * (A - 1 - (A + 1) * c)
      b2 = A * (A + 1 - (A - 1) * c - sq)
      a0 = A + 1 + (A - 1) * c + sq
      a1 = -2 * (A - 1 + (A + 1) * c)
      a2 = A + 1 + (A - 1) * c - sq
    } else {
      b0 = A * (A + 1 + (A - 1) * c + sq)
      b1 = -2 * A * (A - 1 + (A + 1) * c)
      b2 = A * (A + 1 + (A - 1) * c - sq)
      a0 = A + 1 - (A - 1) * c + sq
      a1 = 2 * (A - 1 - (A + 1) * c)
      a2 = A + 1 - (A - 1) * c - sq
    }
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}
// Run one or more biquads over a buffer in place (transposed direct form II).
function filt(buf, ...coefs) {
  for (const [b0, b1, b2, a1, a2] of coefs) {
    let z1 = 0
    let z2 = 0
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i]
      const y = b0 * x + z1
      z1 = b1 * x - a1 * y + z2
      z2 = b2 * x - a2 * y
      buf[i] = y
    }
  }
  return buf
}
// Zero-delay-feedback state-variable filter (stable under fast modulation).
// cut(i) returns the cutoff in Hz for sample i; coefficients refresh every 16 samples.
function svf(buf, cut, q = 0.7071, mode = 'lp') {
  let ic1 = 0
  let ic2 = 0
  let a1 = 0
  let a2 = 0
  let a3 = 0
  const k = 1 / q
  for (let i = 0; i < buf.length; i++) {
    if ((i & 15) === 0) {
      const g = Math.tan((Math.PI * clamp(cut(i), 20, 20000)) / SR)
      a1 = 1 / (1 + g * (g + k))
      a2 = g * a1
      a3 = g * a2
    }
    const x = buf[i]
    const v3 = x - ic2
    const v1 = a1 * ic1 + a2 * v3
    const v2 = ic2 + a2 * ic1 + a3 * v3
    ic1 = 2 * v1 - ic1
    ic2 = 2 * v2 - ic2
    buf[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 : x - k * v1 - v2
  }
  return buf
}

// ── Buses ────────────────────────────────────────────────────────────────
const monoBus = () => new Float32Array(N)
const stereoBus = () => ({ L: new Float32Array(N), R: new Float32Array(N) })
// Constant-power pan, unity gain at centre.
function panGains(pan, gain) {
  const a = ((pan + 1) * Math.PI) / 4
  return [Math.cos(a) * Math.SQRT2 * gain, Math.sin(a) * Math.SQRT2 * gain]
}
// Place a mono or stereo voice on a bus at an exact time. All times on the
// beat grid are whole numbers of samples, so placement is sample-accurate.
function put(bus, t, voice, gain = 1, pan = 0) {
  const s = at(t)
  const vL = voice.L || voice
  const vR = voice.R || voice
  const n = Math.min(vL.length, N - s)
  if (bus instanceof Float32Array) {
    for (let i = 0; i < n; i++) bus[s + i] += (vL[i] + vR[i]) * 0.5 * gain
    return
  }
  const [gl, gr] = panGains(pan, gain)
  for (let i = 0; i < n; i++) {
    bus.L[s + i] += vL[i] * gl
    bus.R[s + i] += vR[i] * gr
  }
}
function eachChannel(bus, fn) {
  if (bus instanceof Float32Array) fn(bus)
  else {
    fn(bus.L)
    fn(bus.R)
  }
}
function gainAuto(bus, fn) {
  // fn(t) evaluated every 32 samples and interpolated
  eachChannel(bus, ch => {
    let g0 = fn(0)
    for (let i = 0; i < N; i += 32) {
      const g1 = fn((i + 32) / SR)
      const end = Math.min(N, i + 32)
      for (let j = i; j < end; j++) ch[j] *= g0 + ((g1 - g0) * (j - i)) / 32
      g0 = g1
    }
  })
}
// Mute envelope for the total silence at 15.5-16.0: a 12 ms fade into it, zero inside.
function gapMute(bus) {
  const fade = Math.round(0.012 * SR)
  eachChannel(bus, ch => {
    for (let i = 0; i < fade; i++) ch[GAP0 - fade + i] *= 0.5 + 0.5 * Math.cos((Math.PI * i) / fade)
    ch.fill(0, GAP0, GAP1)
  })
}

// ── Tempo-synced ping-pong delay (send effect) ───────────────────────────
// A dotted 8th (0.375 s = 3 sixteenths), so echoes of a 16th line interlock.
function pingPong(inL, inR, { time = 0.375, hop = 0.55, lp = 3600, hp = 320 } = {}) {
  const d = Math.round(time * SR)
  const bL = new Float32Array(d)
  const bR = new Float32Array(d)
  const out = stereoBus()
  const kl = 1 - Math.exp((-TAU * lp) / SR)
  const kh = 1 - Math.exp((-TAU * hp) / SR)
  let lpL = 0
  let lpR = 0
  let loL = 0
  let loR = 0
  let p = 0
  for (let i = 0; i < N; i++) {
    if (i === GAP0) {
      bL.fill(0)
      bR.fill(0)
      lpL = lpR = loL = loR = 0
    }
    const eL = bL[p]
    const eR = bR[p]
    lpL += kl * (eL - lpL) // band-limit each repeat so echoes recede
    loL += kh * (lpL - loL)
    lpR += kl * (eR - lpR)
    loR += kh * (lpR - loR)
    bL[p] = (inL[i] + inR[i]) * 0.5 + (lpR - loR) * hop
    bR[p] = (lpL - loL) * hop
    // the left line always speaks first and loudest: trim it and lift the right
    // so both sides carry the same energy, then bleed a little across
    out.L[i] = eL * 0.56 + eR * 0.16
    out.R[i] = eR * 1.2 + eL * 0.075
    if (++p === d) p = 0
  }
  return out
}

// ── Reverb: feedback delay network (send effect) ─────────────────────────
// Pre-delay, four Schroeder allpass diffusers per input, Hadamard feedback
// matrix, one-pole damping in every loop, slowly modulated line lengths.
// Sixteen lines (about one second of delay in total) for the hall, so its
// modes overlap and the tail does not ring; eight short ones for the room.
const FDN_LINES = {
  8: [1123, 1447, 1789, 2087, 2411, 2797, 3209, 3571],
  16: [1123, 1327, 1559, 1787, 2029, 2281, 2531, 2797, 3061, 3331, 3607, 3877, 4159, 4447, 4729, 5021],
}
function reverb(inL, inR, { rt = 2.0, damp = 6000, pre = 0.02, size = 1, width = 0.8, lines = 8 } = {}) {
  const M = lines
  const len = FDN_LINES[M].map(v => Math.round(v * size) | 1)
  const depth = 5 * Math.min(1, size * 1.5)
  const bufLen = len.map(l => l + Math.ceil(depth) + 4)
  const buf = bufLen.map(l => new Float32Array(l))
  const wp = new Int32Array(M)
  const fb = len.map(l => Math.pow(10, (-3 * l) / (rt * SR)))
  const kd = 1 - Math.exp((-TAU * damp) / SR)
  const lpS = new Float64Array(M)
  const lfoRate = len.map((_, k) => 0.23 + 0.031 * ((k * 7) % 16))
  const lfoC = lfoRate.map(r => Math.cos((TAU * r) / SR))
  const lfoSn = lfoRate.map(r => Math.sin((TAU * r) / SR))
  const lfoX = lfoRate.map((_, k) => Math.cos(k * 0.9))
  const lfoY = lfoRate.map((_, k) => Math.sin(k * 0.9))
  const apLen = [
    [149, 233, 389, 521],
    [163, 241, 373, 541],
  ].map(a => a.map(v => Math.round(v * Math.max(0.5, size)) | 1))
  const apBuf = apLen.map(a => a.map(l => new Float32Array(l)))
  const apPos = [new Int32Array(4), new Int32Array(4)]
  const AG = 0.62
  const nPre = Math.round(pre * SR)
  const out = stereoBus()
  const v = new Float64Array(M)
  const norm = 1 / Math.sqrt(M)
  const tapGain = Math.sqrt(2 / M) // input gain per line: the wet level does not depend on the line count
  const reset = () => {
    for (const b of buf) b.fill(0)
    for (const a of apBuf) for (const b of a) b.fill(0)
    lpS.fill(0)
  }
  for (let i = 0; i < N; i++) {
    if (i === GAP0) reset()
    const j = i - nPre
    const live = j >= 0 && !(i >= GAP0 && i < GAP1)
    let xl = live ? inL[j] : 0
    let xr = live ? inR[j] : 0
    for (let a = 0; a < 4; a++) {
      let b = apBuf[0][a]
      let p = apPos[0][a]
      let y = b[p] - AG * xl
      b[p] = xl + AG * y
      xl = y
      apPos[0][a] = p + 1 === b.length ? 0 : p + 1
      b = apBuf[1][a]
      p = apPos[1][a]
      y = b[p] - AG * xr
      b[p] = xr + AG * y
      xr = y
      apPos[1][a] = p + 1 === b.length ? 0 : p + 1
    }
    for (let k = 0; k < M; k++) {
      // rotate the LFO, then read the line at a fractional, slowly moving tap
      const x = lfoX[k] * lfoC[k] - lfoY[k] * lfoSn[k]
      lfoY[k] = lfoX[k] * lfoSn[k] + lfoY[k] * lfoC[k]
      lfoX[k] = x
      const delay = len[k] + depth * lfoY[k]
      let rp = wp[k] - delay
      if (rp < 0) rp += bufLen[k]
      const i0 = rp | 0
      const fr = rp - i0
      const i1 = i0 + 1 === bufLen[k] ? 0 : i0 + 1
      const tap = buf[k][i0] + (buf[k][i1] - buf[k][i0]) * fr
      lpS[k] += kd * (tap - lpS[k])
      v[k] = lpS[k]
    }
    let l = 0
    let r = 0
    for (let k = 0; k < M; k += 4) {
      l += v[k] - v[k + 2]
      r += v[k + 1] - v[k + 3]
    }
    out.L[i] = l * 0.5
    out.R[i] = r * 0.5
    for (let k = 0; k < M; k++) v[k] *= fb[k]
    // fast Walsh-Hadamard transform (orthogonal, so the loop is lossless before fb)
    for (let h = 1; h < M; h <<= 1) {
      for (let a = 0; a < M; a += h << 1) {
        for (let b = a; b < a + h; b++) {
          const p = v[b]
          const q = v[b + h]
          v[b] = p + q
          v[b + h] = p - q
        }
      }
    }
    for (let k = 0; k < M; k++) {
      // rotating the mixed outputs by one line keeps the matrix orthogonal and
      // stops left and right taps from recirculating through the same pairs
      buf[k][wp[k]] = v[(k + M - 1) % M] * norm + (k & 1 ? xr : xl) * (k & 2 ? -tapGain : tapGain)
      wp[k] = wp[k] + 1 === bufLen[k] ? 0 : wp[k] + 1
    }
  }
  // Narrow the return a little so the tail keeps a mono centre.
  for (let i = 0; i < N; i++) {
    const m = (out.L[i] + out.R[i]) * 0.5
    const s = (out.L[i] - out.R[i]) * 0.5 * width
    out.L[i] = m + s
    out.R[i] = m - s
  }
  return out
}

// ── Metering ─────────────────────────────────────────────────────────────
// 4x inter-sample peak estimate (12-tap windowed-sinc per phase).
const TP_HALF = 6
const TP_TAPS = [1, 2, 3].map(p => {
  const c = new Float64Array(2 * TP_HALF)
  for (let j = 0; j < 2 * TP_HALF; j++) {
    const x = j - (TP_HALF - 1) - p / 4
    c[j] = (Math.sin(Math.PI * x) / (Math.PI * x)) * (0.5 + 0.5 * Math.cos((Math.PI * x) / TP_HALF))
  }
  return c
})
// det[n] = largest absolute value of either channel in [n, n+1), oversampled.
function truePeakEnvelope(L, R) {
  const det = new Float32Array(L.length)
  const n = L.length
  for (let i = 0; i < n; i++) {
    let m = Math.max(Math.abs(L[i]), Math.abs(R[i]))
    if (m > 1e-4 && i >= TP_HALF - 1 && i < n - TP_HALF) {
      for (let p = 0; p < 3; p++) {
        const c = TP_TAPS[p]
        let a = 0
        let b = 0
        for (let j = 0, k = i - (TP_HALF - 1); j < 2 * TP_HALF; j++, k++) {
          a += L[k] * c[j]
          b += R[k] * c[j]
        }
        if (a < 0) a = -a
        if (b < 0) b = -b
        if (a > m) m = a
        if (b > m) m = b
      }
    }
    det[i] = m
  }
  return det
}
function truePeak(L, R) {
  const det = truePeakEnvelope(L, R)
  let m = 0
  for (let i = 0; i < det.length; i++) if (det[i] > m) m = det[i]
  return m
}
// ITU-R BS.1770 K-weighting, then 400 ms blocks every 100 ms.
function kWeight(x) {
  const y = Float32Array.from(x)
  return filt(
    y,
    [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1, -2, 1, -1.99004745483398, 0.99007225036621],
  )
}
function loudness(L, R) {
  const kL = kWeight(L)
  const kR = kWeight(R)
  const block = 0.4 * SR
  const hop = 0.1 * SR
  const blocks = []
  for (let s = 0; s + block <= L.length; s += hop) {
    let e = 0
    for (let i = s; i < s + block; i++) e += kL[i] * kL[i] + kR[i] * kR[i]
    blocks.push(e / block)
  }
  const lk = e => -0.691 + 10 * Math.log10(e)
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length
  const abs = blocks.filter(e => lk(e) > -70)
  const rel = abs.filter(e => lk(e) > lk(mean(abs)) - 10)
  const section = (t0, t1) => {
    let e = 0
    for (let i = at(t0); i < at(t1); i++) e += kL[i] * kL[i] + kR[i] * kR[i]
    return lk(e / (at(t1) - at(t0)))
  }
  return { integrated: lk(mean(rel)), momentaryMax: lk(Math.max(...blocks)), section }
}

// ── Look-ahead true-peak limiter ─────────────────────────────────────────
// Offline, so it reads ahead instead of delaying: the gain starts falling
// `look` seconds before a peak and is exactly low enough when the peak arrives.
function limiter(L, R, ceiling, { look = 0.005, release = 0.12 } = {}) {
  const n = L.length
  const W = Math.round(look * SR)
  const det = truePeakEnvelope(L, R)
  const need = new Float32Array(n)
  for (let i = 0; i < n; i++) need[i] = det[i] > ceiling ? ceiling / det[i] : 1
  // minimum of need over [i, i + W], via a monotonic queue run backwards
  const held = new Float32Array(n)
  const q = new Int32Array(n)
  let head = 0
  let tail = 0
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && need[q[tail - 1]] >= need[i]) tail--
    q[tail++] = i
    if (q[head] > i + W) head++
    held[i] = need[q[head]]
  }
  // instant attack, exponential release (never above the held minimum)
  const kr = Math.exp(-1 / (release * SR))
  let g = 1
  for (let i = 0; i < n; i++) {
    g = Math.min(held[i], 1 - (1 - g) * kr)
    held[i] = g
  }
  // box-smooth over the look-ahead window: a click-free ramp that still
  // satisfies gain[i] <= need[i] everywhere
  let sum = held[0] * W
  let minGain = 1
  let active = 0
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    sum += held[i] - (i - W >= 0 ? held[i - W] : held[0])
    const gain = Math.min(1, sum / W)
    L[i] *= gain
    R[i] *= gain
    curve[i] = gain
    if (gain < minGain) minGain = gain
    if (gain < 0.944) active++ // more than 0.5 dB of reduction
  }
  return { maxReductionDb: -toDb(minGain), activePercent: (100 * active) / n, limiterGain: curve }
}

// ═════════════════════════════ 2. VOICES ══════════════════════════════════
// Each voice returns a mono Float32Array or a { L, R } pair that starts at
// its first sample: the sound begins exactly where `put` places it.

// Tight kick: sine with a fast pitch drop to A1 and a little saturation (the
// sub, for full-range systems), a pitched knock in the low mids and a beater
// click (what a phone plays). `big` is the long-tailed impact on 16.0 and 50.0.
const KICK_KNOCK = 1.15
const KICK_BEATER = 0.85
function kick({ vel = 1, big = false, lp = 0, click = 1 } = {}) {
  const dur = big ? 0.47 : 0.27
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)
  const fEnd = big ? 49 : 55
  const tauA = big ? 0.125 : 0.07
  const hold = 0.018
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const f = fEnd + 140 * Math.exp(-t / 0.03) + 230 * Math.exp(-t / 0.0045)
    const e = t < hold ? 1 : Math.exp(-(t - hold) / tauA)
    out[i] = (Math.tanh(1.5 * Math.sin(TAU * ph) * e) / 0.905) * Math.min(1, i / 96) // 2 ms attack on a sine that starts at zero
    ph += f / SR
  }
  // Knock: a short pitched thump falling from 930 to 330 Hz. The sub cannot be
  // heard on a phone; this is the part of the kick that can.
  let pk = 0
  for (let i = 0; i < Math.round(0.12 * SR); i++) {
    const t = i / SR
    out[i] += Math.sin(TAU * pk) * Math.exp(-t / 0.036) * Math.min(1, i / 48) * KICK_KNOCK
    pk += (330 + 600 * Math.exp(-t / 0.009)) / SR
  }
  // Beater: a defined click between 1.5 and 4 kHz (two damped resonances and a
  // band of noise), with a little air above it.
  const beat = filt(noise(Math.round(0.03 * SR)), biquad('bp', 2600, 0.9))
  const air = filt(noise(Math.round(0.012 * SR)), biquad('hp', 4500), biquad('lp', 9000))
  for (let i = 0; i < beat.length; i++) {
    const t = i / SR
    const tone = Math.sin(TAU * 2150 * t) * Math.exp(-t / 0.0035) * 0.5 + Math.sin(TAU * 3400 * t) * Math.exp(-t / 0.0022) * 0.35
    out[i] += (tone + beat[i] * Math.exp(-t / 0.004) * 1.5 + (i < air.length ? air[i] * Math.exp(-t / 0.002) * 0.3 : 0)) * KICK_BEATER * click
  }
  // Soft-clip the stack: body, knock and beater all peak in the first few
  // milliseconds, and this keeps that transient from leaning on the limiter.
  for (let i = 0; i < n; i++) out[i] = Math.tanh(0.6 * out[i]) / 0.6
  if (lp) filt(out, biquad('lp', lp, 0.7071))
  taper(out, 0, 0.02)
  for (let i = 0; i < n; i++) out[i] *= vel
  return out
}

// Bass in three layers: a clean sine sub at the fundamental (full-range
// systems), a band-limited saw through a 12 dB filter with its own envelope
// (the pluck), and the same saw band-passed around 520 Hz (a quiet mid-range
// layer, 200-900 Hz, that keeps the note audible on small speakers). All three
// share one saturator, which adds upper harmonics and bounds the peak.
// `cut` overrides the filter envelope for held notes; the mid layer follows it.
const BASS_SUB = 0.36
const BASS_MID = 0.9
function bass(f, { gate = 0.1, vel = 1, c0 = 1700, c1 = 380, tauF = 0.06, q = 1.2, sub = 1, cut = null } = {}) {
  const env = adsr(gate, 0.004, 0.2, 0.85, 0.03)
  const n = env.length
  const mid = new Float32Array(n)
  const dt = f / SR
  const dt2 = (f * 2.004) / SR
  let p1 = 0.5
  let p2 = 0.5
  for (let i = 0; i < n; i++) {
    mid[i] = (2 * p1 - 1 - blep(p1, dt)) * 0.75 + (2 * p2 - 1 - blep(p2, dt2)) * 0.22
    p1 += dt
    if (p1 >= 1) p1 -= 1
    p2 += dt2
    if (p2 >= 1) p2 -= 1
  }
  const grit = filt(Float32Array.from(mid), biquad('bp', 520, 0.7))
  svf(mid, cut ? i => cut(i / SR) : i => c1 + (c0 - c1) * Math.exp(-i / SR / tauF) * (0.5 + 0.5 * vel), q)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const s = Math.sin((TAU * f * i) / SR)
    const open = cut ? clamp((cut(i / SR) - 200) / 600, 0, 1) : 1
    out[i] = Math.tanh((1.3 * (mid[i] * 0.85 + s * BASS_SUB * sub) + 4 * grit[i] * BASS_MID * open) * env[i]) * vel
  }
  return out
}

// Closed hat: high-passed noise with a resonant band near 8.5 kHz, rolled off
// above 12 kHz so it is a tick of metal rather than a hiss.
function hat({ vel = 1, tau = 0.014 } = {}) {
  const n = Math.round((tau * 5 + 0.01) * SR)
  const x = noise(n)
  const band = filt(Float32Array.from(x), biquad('bp', 8500, 1.6))
  filt(x, biquad('hp', 6000, 0.8), biquad('hp', 6000, 0.8), biquad('lp', 12000, 0.7))
  for (let i = 0; i < n; i++) x[i] = (x[i] * 0.6 + band[i] * 1.5) * Math.exp(-i / (tau * SR)) * vel
  return taper(x, 0.0004, 0.004)
}

// Shaker: band-passed noise that swells in, with a tiny click on its front edge.
function shaker({ vel = 1 } = {}) {
  const n = Math.round(0.11 * SR)
  const x = filt(noise(n), biquad('bp', 5600, 1.0), biquad('hp', 3200))
  const a = 0.007 * SR
  for (let i = 0; i < n; i++) {
    const sw = i < a ? Math.pow(i / a, 1.5) : Math.exp(-(i - a) / (0.022 * SR))
    x[i] = x[i] * sw * vel
  }
  const c = filt(noise(Math.round(0.004 * SR)), biquad('hp', 6000))
  for (let i = 0; i < c.length; i++) x[i] += c[i] * Math.exp(-i / (0.0007 * SR)) * 0.35 * vel
  return taper(x, 0, 0.01)
}

// A struck contact: a few short damped resonances plus a sub-millisecond noise burst.
function strike(out, offset, amp, scale, partials) {
  const s = Math.round(offset * SR)
  for (const [f, tau, a] of partials) {
    const len = Math.min(out.length - s, Math.round(tau * 9 * SR))
    for (let i = 0; i < len; i++) out[s + i] += Math.sin((TAU * f * scale * i) / SR) * Math.exp(-i / (tau * SR)) * a * amp
  }
  const nz = filt(noise(Math.round(0.005 * SR)), biquad('hp', 1800))
  for (let i = 0; i < nz.length && s + i < out.length; i++) out[s + i] += nz[i] * Math.exp(-i / (0.0007 * SR)) * 0.5 * amp
}
const RELAY = [
  [2650, 0.0025, 0.5],
  [4300, 0.0018, 0.35],
  [1250, 0.004, 0.3],
]
// Relay click: armature strike, contact bounce 8.5 ms later, small body thock.
// `heavy` adds the low detent thunk and spring ring; `muted` low-passes it.
function relay({ vel = 1, heavy = false, muted = false } = {}) {
  const n = Math.round((heavy ? 0.22 : muted ? 0.13 : 0.08) * SR)
  const out = new Float32Array(n)
  strike(out, 0, 1, 1, RELAY)
  strike(out, 0.0085, 0.4, 1.07, RELAY)
  for (let i = 0; i < n; i++) out[i] += Math.sin((TAU * 310 * i) / SR) * Math.exp(-i / (0.009 * SR)) * 0.6
  if (heavy) {
    strike(out, 0.021, 0.22, 0.93, RELAY)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      out[i] += Math.sin(TAU * 128 * t) * Math.exp(-t / 0.032) * 0.95
      out[i] += Math.sin(TAU * 440 * t) * Math.exp(-t / 0.03) * 0.3 + Math.sin(TAU * 880 * t) * Math.exp(-t / 0.036) * 0.26 + Math.sin(TAU * 1320 * t) * Math.exp(-t / 0.024) * 0.14
    }
  }
  if (muted) {
    // damped: less top and a softer strike, with a longer wooden 'tok' behind
    // it so the click reads in a busy bar without a tall peak
    filt(out, biquad('lp', 2600, 0.7))
    const clack = filt(noise(n), biquad('bp', 1400, 1.2))
    for (let i = 0; i < n; i++) {
      const t = i / SR
      out[i] = out[i] * 0.45 + Math.sin(TAU * 820 * t) * Math.exp(-t / 0.014) * 0.55 + Math.sin(TAU * 310 * t) * Math.exp(-t / 0.02) * 0.4 + clack[i] * Math.exp(-t / 0.012) * 1.0
    }
  }
  taper(out, 0, 0.01)
  for (let i = 0; i < n; i++) out[i] *= vel
  return out
}

// Dry quartz tick: two very short high resonances and a whisper of noise.
function quartz({ vel = 1, bright = 1 } = {}) {
  const out = new Float32Array(Math.round(0.03 * SR))
  strike(out, 0, vel, bright, [
    [4200, 0.0022, 0.6],
    [6350, 0.0014, 0.45],
    [1900, 0.005, 0.42], // the case: gives the tick a little body
    [2850, 0.003, 0.28],
  ])
  return taper(out, 0, 0.004)
}
// Data tick: smaller and higher than the quartz tick.
function dataTick({ vel = 1, pitch = 1 } = {}) {
  const out = new Float32Array(Math.round(0.014 * SR))
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    out[i] = (Math.sin(TAU * 7300 * pitch * t) * Math.exp(-t / 0.0009) + Math.sin(TAU * 5100 * pitch * t) * Math.exp(-t / 0.0013) * 0.7) * vel
  }
  return taper(out, 0, 0.003)
}
// Printer-like tick: a 30 ms band of noise chopped at 190 Hz, with a contact strike up front.
function printer({ vel = 1 } = {}) {
  const n = Math.round(0.05 * SR)
  const x = filt(noise(n), biquad('bp', 2900, 2.2), biquad('hp', 900))
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const chop = Math.pow(0.5 + 0.5 * Math.cos(TAU * 190 * t), 2)
    const e = t < 0.028 ? 1 : Math.exp(-(t - 0.028) / 0.006)
    out[i] = x[i] * chop * e * 3.2
  }
  strike(out, 0, 0.45, 1.15, RELAY)
  taper(out, 0, 0.006)
  for (let i = 0; i < n; i++) out[i] *= vel
  return out
}
// Noise 'shuffle': four quick grains moving left to right.
function shuffle({ vel = 1 } = {}) {
  const n = Math.round(0.09 * SR)
  const x = filt(noise(n), biquad('bp', 3600, 0.9), biquad('hp', 1500))
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  ;[0, 0.016, 0.031, 0.045].forEach((t0, k) => {
    const s = Math.round(t0 * SR)
    const [gl, gr] = panGains(-0.5 + k / 3, [1, 0.75, 0.55, 0.4][k] * vel)
    for (let i = s; i < n; i++) {
      const u = (i - s) / SR
      const e = Math.min(1, u / 0.0015) * Math.exp(-u / 0.005)
      L[i] += x[i] * e * gl
      R[i] += x[i] * e * gr
    }
  })
  taper(L, 0, 0.01)
  taper(R, 0, 0.01)
  return { L, R }
}

// Snare: short tuned body, band of noise, and a relay strike for the crack.
function snare({ vel = 1 } = {}) {
  const n = Math.round(0.24 * SR)
  const nz = filt(noise(n), biquad('bp', 2300, 0.6), biquad('hp', 600))
  const out = new Float32Array(n)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.045) * 0.42 + nz[i] * Math.min(1, t / 0.001) * Math.exp(-t / 0.065) * 1.15
    ph += (172 + 70 * Math.exp(-t / 0.012)) / SR
  }
  strike(out, 0, 0.42, 1, RELAY)
  taper(out, 0, 0.02)
  for (let i = 0; i < n; i++) out[i] *= vel
  return out
}

// FM pluck: one modulator, index falling fast so the note starts bright and
// settles to a near-sine. Left and right carriers sit 6 cents apart.
function pluck(f, { vel = 1, dur = 0.3, tauA = 0.09, i0 = 3.4, i1 = 0.55, tauI = 0.06, ratio = 1, tine = 1.3 } = {}) {
  const n = Math.round(dur * SR)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const fl = f * cents(-3)
  const fr = f * cents(3)
  const bright = 0.45 + 0.55 * vel
  // 'tine': a second modulator five times up that lasts ~25 ms and gives the
  // attack its edge. Scaled back for high notes to keep its sidebands under Nyquist.
  const iT = tine * bright * Math.min(1, 620 / f)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const e = Math.exp(-t / tauA) * vel
    const m = (i0 * Math.exp(-t / tauI) + i1) * bright * Math.sin(TAU * f * ratio * t) + iT * Math.exp(-t / 0.025) * Math.sin(TAU * f * 5 * t)
    L[i] = (Math.sin(TAU * fl * t + m) + 0.25 * Math.sin(TAU * fl * t)) * e
    R[i] = (Math.sin(TAU * fr * t + m) + 0.25 * Math.sin(TAU * fr * t)) * e
  }
  taper(L, 0.0025, 0.03)
  taper(R, 0.0025, 0.03)
  return { L, R }
}

// Glassy bell for the sonic mark: FM body (1 : 3.5), a short inharmonic
// shimmer an octave up, and a high ping on the strike.
function bell(f, { vel = 1, dur = 3.4, tau = 1.1 } = {}) {
  const n = Math.round(dur * SR)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const ks = Math.sqrt(Math.min(1, 700 / f)) // less modulation up high: keeps sidebands under Nyquist
  const f2 = f * 2.0017
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const body = Math.sin(TAU * f * t + (1.4 * Math.exp(-t / 0.3) + 0.18) * ks * Math.sin(TAU * 3.5 * f * t)) * Math.exp(-t / tau) * 0.7
    const sub = Math.sin(TAU * f * t) * Math.exp(-t / (tau * 1.3)) * 0.25
    const ping = Math.sin(TAU * 4.07 * f * t) * Math.exp(-t / 0.08) * 0.13
    const im = 0.8 * ks * Math.exp(-t / 0.2)
    const eS = Math.exp(-t / 0.4) * 0.2
    const shL = Math.sin(TAU * f2 * cents(-2) * t + im * Math.sin(TAU * f2 * 2.76 * t)) * eS
    const shR = Math.sin(TAU * f2 * cents(2) * t + im * Math.sin(TAU * f2 * 2.76 * t)) * eS
    L[i] = (body + sub + ping + shL) * vel
    R[i] = (body + sub + ping + shR) * vel
  }
  taper(L, 0.002, 0.25)
  taper(R, 0.002, 0.25)
  return { L, R }
}

// Soft pitched tone (session nodes, bid/ask blips, the rising figure).
function tone(f, { vel = 1, tau = 0.16, dur = 0.7, attack = 0.004, h2 = 0.22, h3 = 0.06 } = {}) {
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = (Math.sin(TAU * f * t) + h2 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / (tau * 0.5)) + h3 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / (tau * 0.3))) * Math.exp(-t / tau) * vel
  }
  return taper(out, attack, Math.min(0.08, dur / 3))
}
// Telemetry bleep: a flat-topped 34 ms sine pip.
function pip(f, { vel = 1, dur = 0.034 } = {}) {
  const n = Math.round(dur * SR)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = (Math.sin((TAU * f * i) / SR) + 0.18 * Math.sin((TAU * 2 * f * i) / SR)) * vel
  return taper(out, 0.003, 0.009)
}

// Chord of band-limited saws: centre, left (-9 c) and right (+9 c) per note,
// with a slow pitch drift. Used for the pad (long) and the stabs (short).
function sawChord(notes, n, drift = 2) {
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const rnd = rng(nextSeed())
  notes.forEach((name, k) => {
    const f = hz(name)
    const lvl = k === notes.length - 1 && notes.length > 3 ? 0.8 : 1
    ;[0, -9, 9].forEach((det, v) => {
      let ph = rnd()
      const rate = 0.07 + rnd() * 0.2
      const phase = rnd() * TAU
      const gl = [0.45, 0.85, 0.12][v] * lvl
      const gr = [0.45, 0.12, 0.85][v] * lvl
      let dt = 0
      for (let i = 0; i < n; i++) {
        if ((i & 63) === 0) dt = (f * cents(det + drift * Math.sin((TAU * rate * i) / SR + phase))) / SR
        const s = 2 * ph - 1 - blep(ph, dt)
        L[i] += s * gl
        R[i] += s * gr
        ph += dt
        if (ph >= 1) ph -= 1
      }
    })
  })
  return { L, R }
}
function stab(notes, { vel = 1, dur = 0.44, tau = 0.17, c0 = 5200, c1 = 500, tauF = 0.09 } = {}) {
  const n = Math.round(dur * SR)
  const v = sawChord(notes, n, 0)
  for (const ch of [v.L, v.R]) {
    svf(ch, i => c1 + (c0 - c1) * Math.exp(-i / SR / tauF), 1.0)
    for (let i = 0; i < n; i++) ch[i] *= Math.exp(-i / SR / tau) * vel * 0.3
    taper(ch, 0.0025, Math.min(0.2, dur / 4))
  }
  return v
}

// Filtered-noise sweep. Left and right share half their noise so it stays mono-safe.
function sweep(dur, { f0 = 500, f1 = 9000, q = 1.4, power = 2.2, mode = 'bp' } = {}) {
  const n = Math.round(dur * SR)
  const c = noise(n)
  const mk = () => {
    const x = noise(n)
    for (let i = 0; i < n; i++) x[i] = x[i] * 0.6 + c[i] * 0.6
    svf(x, i => f0 * Math.pow(f1 / f0, i / n), q, mode)
    for (let i = 0; i < n; i++) x[i] *= Math.pow(i / n, power)
    return taper(x, 0.02, 0.004)
  }
  return { L: mk(), R: mk() }
}
// Reverse cymbal: high-passed noise swelling exponentially into a hard stop.
function reverseCymbal(dur = 1, steep = 5.5) {
  const n = Math.round(dur * SR)
  const c = noise(n)
  const mk = () => {
    const x = noise(n)
    for (let i = 0; i < n; i++) x[i] = x[i] * 0.6 + c[i] * 0.6
    filt(x, biquad('hp', 2600), biquad('hp', 2600), biquad('peak', 6500, 1.2, 5), biquad('lp', 12500, 0.7))
    for (let i = 0; i < n; i++) x[i] *= Math.exp(steep * (i / n - 1))
    return taper(x, 0.03, 0.003)
  }
  return { L: mk(), R: mk() }
}
// Crash / impact noise: bright burst whose top end closes as it decays.
function crash({ vel = 1, tau = 0.4, hp = 2600 } = {}) {
  const n = Math.round(Math.min(2.4, tau * 6) * SR)
  const c = noise(n)
  const mk = () => {
    const x = noise(n)
    for (let i = 0; i < n; i++) x[i] = x[i] * 0.6 + c[i] * 0.6
    filt(x, biquad('hp', hp), biquad('hp', hp))
    svf(x, i => 3000 + 11000 * Math.exp(-i / SR / (tau * 1.2)), 0.7)
    for (let i = 0; i < n; i++) x[i] *= Math.exp(-i / SR / tau) * vel
    return taper(x, 0.001, 0.05)
  }
  return { L: mk(), R: mk() }
}

// Felt hit on frame 0. Three parts: a soft low thud that settles onto the
// drone's D2 in phase with it (the 45 Hz pitch drop integrates to exactly one
// cycle); a mid-range body, the same strike on D3, D4, A4 and D5, so the hit
// has a note on small speakers; and the felt itself, a soft band of noise.
function feltHit() {
  const n = Math.round(1.3 * SR)
  const out = new Float32Array(n)
  const f0 = hz('D2')
  let ph = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const thud = (Math.sin(TAU * ph) + 0.4 * Math.sin(2 * TAU * ph) * Math.exp(-t / 0.11) + 0.2 * Math.sin(3 * TAU * ph) * Math.exp(-t / 0.07)) * Math.exp(-t / 0.26)
    const body =
      Math.sin(TAU * 2 * f0 * t) * Math.exp(-t / 0.16) * 0.5 +
      Math.sin(TAU * 4 * f0 * t) * Math.exp(-t / 0.13) * 0.62 +
      Math.sin(TAU * 6 * f0 * t) * Math.exp(-t / 0.08) * 0.34 +
      Math.sin(TAU * 8 * f0 * t) * Math.exp(-t / 0.05) * 0.2
    out[i] = thud + body * FELT_BODY
    ph += (f0 + 45 * Math.exp(-t * 45)) / SR
  }
  const th = filt(noise(Math.round(0.2 * SR)), biquad('lp', 420), biquad('lp', 420))
  for (let i = 0; i < th.length; i++) out[i] += th[i] * Math.exp(-i / (0.035 * SR)) * 1.2
  const felt = filt(noise(Math.round(0.08 * SR)), biquad('bp', 1100, 0.7), biquad('lp', 3200))
  for (let i = 0; i < felt.length; i++) out[i] += felt[i] * Math.min(1, i / 40) * Math.exp(-i / (0.009 * SR)) * 1.6 * FELT_BODY
  return taper(out, 0.002, 0.2)
}
const FELT_BODY = 1.6
// One soft, low, neutral tone (38.0): root and fifth only, slow attack.
function lowTone() {
  const n = Math.round(2.6 * SR)
  const out = new Float32Array(n)
  const f = hz('D3')
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = (Math.sin(TAU * f * t) + 0.55 * Math.sin(TAU * (f / 2) * t) + 0.16 * Math.sin(TAU * 1.5 * f * t) * Math.exp(-t / 0.5) + 0.3 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.5) + 0.14 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.35)) * Math.exp(-t / 0.85)
  }
  return taper(out, 0.03, 0.5)
}

// ═════════════════════════════ 3. SCORE ═══════════════════════════════════

const stems = {
  low: monoBus(), // sub drone, felt hit, low tone
  hum: stereoBus(), // the drone's harmonics (what a small speaker plays of it)
  kick: monoBus(),
  bass: monoBus(),
  snare: stereoBus(),
  hats: stereoBus(),
  shaker: stereoBus(),
  tick: stereoBus(), // quartz tick (dry)
  click: stereoBus(), // detent, relay, printer and data clicks
  arp: stereoBus(),
  lead: stereoBus(),
  pad: stereoBus(),
  stab: stereoBus(),
  bell: stereoBus(),
  blip: stereoBus(), // node tones, bid/ask blips, telemetry
  fx: stereoBus(), // sweeps, crashes, reverse cymbal, shuffles
}
const kicks = [] // [time, strength] for the sidechain and the onset check
const accents = [] // [label, time] of the picture-locked accents, for the report

// Harmony. Bars are 1-based; bar b starts at (b - 1) * 2 seconds.
const CHORD = {
  Dsus2: { bass: 'D2', pad: ['D3', 'A3', 'E4', 'A4'], arp: ['D4', 'E4', 'A4', 'D5', 'E5', 'A5'] },
  D7sus: { bass: 'D2', pad: ['C3', 'G3', 'D4', 'A4'], arp: ['D4', 'G4', 'A4', 'C5', 'D5', 'G5'] },
  Gsus2: { bass: 'G2', pad: ['G2', 'D3', 'A3', 'E4'], arp: ['D4', 'G4', 'A4', 'D5', 'G5', 'A5'] },
  Asus4: { bass: 'A2', pad: ['A2', 'E3', 'D4', 'E4'], arp: ['D4', 'E4', 'A4', 'D5', 'E5', 'A5'] },
  Csus2: { bass: 'C2', pad: ['C3', 'G3', 'D4', 'G4'], arp: ['C4', 'D4', 'G4', 'C5', 'D5', 'G5'] },
  Dsus4: { bass: 'D2', pad: ['D3', 'A3', 'D4', 'G4'], arp: ['D4', 'G4', 'A4', 'D5', 'G5', 'A5'] },
  D5: { bass: 'D2', pad: ['D3', 'A3', 'D4', 'A4'], arp: ['D4', 'A4', 'D5', 'A5', 'D5', 'A5'] },
}
const HARMONY = {}
const setBars = (from, to, name) => {
  for (let b = from; b <= to; b++) HARMONY[b] = name
}
setBars(4, 11, 'Dsus2') // build, drop, 01 SEE
setBars(12, 12, 'D7sus') // 22.0 push-in
setBars(13, 14, 'Gsus2') // 02 SET: up a fourth
setBars(15, 15, 'Asus4') // 28.0 headline cut
setBars(16, 17, 'Dsus2') // 03 TRACE
setBars(18, 18, 'D7sus') // 34.0 headline cut
setBars(21, 22, 'Dsus2') // rebuild
setBars(23, 23, 'Gsus2')
setBars(24, 24, 'Asus4')
setBars(26, 26, 'Dsus2')
const BURST = ['Dsus2', 'Csus2', 'Gsus2', 'Asus4'] // bar 25, one chord per recap cut

// ── Intro, bars 1-3 (0-6 s) ──────────────────────────────────────────────
put(stems.low, 0, feltHit(), 1.5)
accents.push(['felt hit', 0, 'low'])
{
  // Sub drone on D: D2 with a quiet D1 under it and D3 / A3 partials so it
  // still reads on small speakers. Returns under the end card.
  const amp = curve([
    [0, 0], [0.03, 0.8], [4, 0.8], [5.4, 1], [6, 0.95], [12, 0.7], [12.4, 0],
    [52, 0], [52.5, 0.85], [57.8, 0.8], [59.2, 0],
  ])
  const f = hz('D2')
  // Harmonics a small speaker can play: D4, A4, D5, A5, D6 (multiples 4, 6, 8,
  // 12 and 16 of D2: octaves and fifths only, no fifth harmonic, so no major
  // third). They live on their own stereo stem. Each partial drifts slowly in
  // level and has a weaker neighbour a fraction of a hertz away, panned to one
  // side, so the layer shimmers and has width but folds to mono cleanly.
  const HARMONICS = [[4, 0.42, 0.13, 0.07], [6, 0.38, 0.19, 0.11], [8, 0.26, 0.11, 0.09], [12, 0.15, 0.23, 0.16], [16, 0.08, 0.17, 0.13]]
  for (let i = 0; i < N; i++) {
    const t = i / SR
    const a = amp(t)
    if (a <= 0) continue
    const v =
      Math.sin(TAU * f * t) +
      0.3 * Math.sin(TAU * 0.5 * f * t) +
      0.15 * (Math.sin(TAU * (2 * f + 0.11) * t) + Math.sin(TAU * (2 * f - 0.11) * t)) +
      0.08 * Math.sin(TAU * 3 * f * t + 0.4 * Math.sin(TAU * 0.13 * t))
    const breathe = 1 + 0.06 * Math.sin(TAU * 0.25 * t)
    stems.low[i] += Math.tanh(0.9 * v * a * breathe) * 0.5
    let hl = 0
    let hr = 0
    HARMONICS.forEach(([m, level, beat, drift], k) => {
      const g = level * (1 + 0.25 * Math.sin(TAU * drift * t + k * 1.7))
      const main = g * Math.sin(TAU * m * f * t)
      const side = g * 0.45 * Math.sin(TAU * (m * f + beat) * t + m)
      hl += main + side * (k % 2 ? 0.2 : 1)
      hr += main + side * (k % 2 ? 1 : 0.2)
    })
    stems.hum.L[i] += hl * a * breathe * 0.5
    stems.hum.R[i] += hr * a * breathe * 0.5
  }
}
// Quartz tick on every beat of the film (the 'one second' motif), louder
// where it is exposed. Tick-tock: alternate beats are a shade darker.
{
  const level = curve([
    [0, 1.4], [4, 1.4], [6, 1.2], [6.01, 0.9], [15, 0.9], [16, 0.42], [35.9, 0.42], [36, 0.95], [39.9, 0.95],
    [40, 0.6], [47.9, 0.6], [48, 0.42], [52, 0.5], [58, 0.28],
  ])
  for (let k = 0; k <= 116; k++) {
    const t = k * 0.5
    if (t === 15.5) continue
    put(stems.tick, t, quartz({ vel: level(t), bright: k % 2 ? 0.94 : 1 }), 1, k % 2 ? 0.06 : -0.06)
  }
}
put(stems.click, 1.0, relay({ heavy: true }), 1.6) // caliper closes
accents.push(['detent click', 1.0, 'click'])
// 1.5: the ten ruler divisions pop left to right, one frame apart
for (let k = 0; k < 10; k++) put(stems.click, 1.5 + k / 30, dataTick({ vel: 0.5, pitch: 0.9 + k * 0.012 }), 0.6, -0.6 + (1.2 * k) / 9)
// Bar 2: filtered pluck answers each zoom step; data ticks on the triplet grid
put(stems.blip, 2.0, pluck(hz('D4'), { vel: 0.6, dur: 0.6, tauA: 0.18, i0: 2, tine: 0.4 }), 1.2, -0.2)
put(stems.blip, 3.0, pluck(hz('A4'), { vel: 0.7, dur: 0.6, tauA: 0.18, i0: 2, tine: 0.4 }), 1.2, 0.2)
{
  const r = rng(11)
  for (let k = 1; k < 12; k++) {
    if (k % 3 === 0) continue // the quartz tick owns the beats
    put(stems.click, 2 + k * TRIP, dataTick({ vel: 0.3 + 0.2 * r(), pitch: 0.92 + 0.16 * r() }), 0.9, (r() * 2 - 1) * 0.6)
  }
}
// Sonic mark: D, A, E on the glassy bell. Used three times (brand lock, CTA, end card).
function sonicMark(t, vel = 1) {
  put(stems.bell, t, bell(hz('D5'), { vel }), 1, 0)
  put(stems.bell, t + 0.5, bell(hz('A5'), { vel: vel * 0.92 }), 1, 0)
  put(stems.bell, t + 1.0, bell(hz('E6'), { vel: vel * 0.85, dur: 3.8 }), 1, 0)
  accents.push([`sonic mark D`, t, 'bell'], [`sonic mark A`, t + 0.5, 'bell'], [`sonic mark E`, t + 1, 'bell'])
}
sonicMark(4.0)
put(stems.fx, 5.4, sweep(0.6, { f0: 1200, f1: 5000, q: 0.9, power: 2.5 }), 0.22) // breath into the build

// ── Kick ─────────────────────────────────────────────────────────────────
function addKick(t, opts = {}) {
  put(stems.kick, t, kick(opts))
  kicks.push([t, (opts.vel ?? 1) * (opts.lp && opts.lp < 600 ? 0.6 : 1)])
}
{
  // build: quiet and low-passed from 8.0, opening by the roll
  const lp = curve([[8, 480], [14, 1800], [15, 3500]], 'exp')
  const vel = curve([[8, 0.5], [14, 0.78], [15, 0.85]])
  for (let t = 8; t <= 15; t += 0.5) addKick(t, { vel: vel(t), lp: lp(t), click: 0.5 })
  // drop: four on the floor, 16.0-35.5, resting on the two fill beats
  for (let t = 16; t < 36; t += 0.5) {
    if (t === 23.5 || t === 29.5) continue
    addKick(t, t === 16 ? { big: true } : {})
  }
  // rebuild: returns filtered and soft at 40.0
  const lp2 = curve([[40, 400], [44, 900], [47.5, 5000]], 'exp')
  const vel2 = curve([[40, 0.6], [44, 0.8], [47.5, 0.95]])
  for (let t = 40; t < 48; t += 0.5) addKick(t, { vel: vel2(t), lp: lp2(t), click: t < 44 ? 0.3 : 0.7 })
  for (let t = 48; t < 50; t += 0.5) addKick(t)
  addKick(50, { big: true })
  addKick(50.5, { vel: 0.92 })
  addKick(51, { vel: 0.85, lp: 3000 })
  addKick(51.5, { vel: 0.78, lp: 1400 })
  // resolve: a soft kick on each bar line; 58.0 is the last event of the film
  ;[52, 54, 56, 58].forEach((t, k) => addKick(t, { vel: 0.66 - k * 0.05, lp: 700, click: 0.3 }))
}

// ── Hats, shaker, snare ──────────────────────────────────────────────────
{
  const HAT_VEL = [0.34, 0.26, 1, 0.38] // off-beat 8th leads
  const HAT_PAN = [-0.4, 0.45, -0.15, 0.5]
  const hatLevel = curve([
    [10, 0.55], [14, 0.8], [15, 0.85], [16, 1], [36, 1], [44, 0.7], [48, 1], [50, 1], [52, 0.35],
  ])
  const hatOn = t => (t >= 10 && t < 13) || (t >= 13.5 && t < 15) || (t >= 16 && t < 36) || (t >= 44 && t < 52)
  for (let s = 0; s < 480; s++) {
    const t = s * STEP
    if (!hatOn(t)) continue
    const k = s % 4
    if (t < 12 && k !== 2) continue // build starts with off-beat 8ths only
    if (t >= 50.5 && k % 2 === 1) continue // thinning into the end card
    if (t >= 51.5 && k !== 2) continue
    const fill = (t >= 23.5 && t < 24) || (t >= 29.5 && t < 30)
    put(stems.hats, t, hat({ vel: HAT_VEL[k] * hatLevel(t) * (fill ? 0.5 : 1), tau: k === 2 ? 0.02 : 0.012 }), 1, HAT_PAN[k])
  }
  const SHK_VEL = [0.55, 0.32, 0.9, 0.42]
  for (let s = 0; s < 480; s++) {
    const t = s * STEP
    if (!((t >= 18 && t < 36) || (t >= 46 && t < 50))) continue
    if ((t >= 23.5 && t < 24) || (t >= 29.5 && t < 30)) continue
    put(stems.shaker, t, shaker({ vel: SHK_VEL[s % 4] * (t >= 46 && t < 48 ? 0.4 + 0.3 * (t - 46) : 1) }), 1, 0.3 + 0.12 * Math.sin(s * 1.9))
  }
  const hit = (t, vel) => put(stems.snare, t, snare({ vel }), 1, 0)
  // backbeat on 2 and 4 through the drop
  // (25.5 is played softer: the STOP relay click shares that beat)
  for (let t = 16.5; t < 36; t += 1) if (t !== 23.5 && t !== 29.5) hit(t, t === 16.5 ? 1 : t === 25.5 ? 0.55 : 0.86)
  // bar 8 roll: 8ths then 16ths (with the quartz tick doubling it)
  ;[14, 14.25, 14.5, 14.75, 15, 15.125, 15.25, 15.375].forEach((t, k) => {
    hit(t, 0.42 + 0.075 * k)
    if (t % 0.5) put(stems.tick, t, quartz({ vel: 0.5 + 0.05 * k }), 1, 0)
  })
  // one-beat fills into the chapter changes
  ;[23.5, 23.625, 23.75, 23.875].forEach((t, k) => hit(t, 0.5 + 0.13 * k))
  ;[29.5, 29.625, 29.75, 29.8125, 29.875, 29.9375].forEach((t, k) => hit(t, 0.45 + 0.09 * k))
  put(stems.click, 23.5, relay({ vel: 0.7 }), 0.8, -0.3)
  put(stems.click, 29.5, relay({ vel: 0.7 }), 0.8, 0.3)
  // snare build 46-48: 8ths for a bar's first half, then 16ths
  for (let k = 0; k < 4; k++) hit(46 + k * 0.25, 0.26 + 0.05 * k)
  for (let k = 0; k < 8; k++) hit(47 + k * STEP, 0.46 + 0.06 * k)
  // burst and converge
  ;[48.5, 49.5].forEach(t => hit(t, 0.95))
  hit(50.5, 0.8)
  hit(51.5, 0.5)
}

// ── Bass ─────────────────────────────────────────────────────────────────
// One 16-step pattern per chapter. R root, r ghost root, o octave ghost.
const BASS_PATTERN = {
  A: '..Rr..Rr..Rr..Ro', // drop and 01 SEE: off-beat pump
  B: '.RrR.RrR.RrR.Rro', // 02 SET: rolling, up a fourth
  C: '..Ro.r.o..Ro.rRo', // 03 TRACE: octave bounce
  S: '..R...R...R...Rr', // rebuild
  X: '.RRR.RRR.RRR.RRR', // burst
}
function bassBar(bar, pattern, root, level = 1, bright = 1) {
  const t0 = (bar - 1) * 2
  for (let s = 0; s < 16; s++) {
    const c = pattern[s]
    if (c === '.') continue
    const f = hz(Array.isArray(root) ? root[s >> 2] : root)
    const o =
      c === 'R' ? { gate: 0.1, vel: 1, c0: 1700 * bright } : c === 'r' ? { gate: 0.07, vel: 0.68, c0: 950 * bright } : { gate: 0.06, vel: 0.7, c0: 2300 * bright, sub: 0.45 }
    put(stems.bass, t0 + s * STEP, bass(c === 'o' ? f * 2 : f, o), level)
  }
}
// 12.0: one held D, filter opening into the silence
put(stems.bass, 12, bass(hz('D2'), { gate: 3.5, vel: 0.5, cut: curve([[0, 110], [3.5, 950]], 'exp'), q: 0.9 }))
for (let b = 9; b <= 12; b++) bassBar(b, BASS_PATTERN.A, CHORD[HARMONY[b]].bass)
for (let b = 13; b <= 15; b++) bassBar(b, BASS_PATTERN.B, CHORD[HARMONY[b]].bass, 0.7)
for (let b = 16; b <= 18; b++) bassBar(b, BASS_PATTERN.C, CHORD[HARMONY[b]].bass)
bassBar(23, BASS_PATTERN.S, 'G2', 0.7, 0.55)
bassBar(24, BASS_PATTERN.S, 'A2', 0.85, 0.75)
bassBar(25, BASS_PATTERN.X, BURST.map(c => CHORD[c].bass), 0.8)
put(stems.bass, 50, bass(hz('D2'), { gate: 1.9, vel: 0.5, cut: curve([[0, 1500], [0.9, 700], [1.9, 140]], 'exp'), q: 0.9 }))

// ── Arpeggio (FM pluck, 16ths) and the octave-up lead ────────────────────
{
  const CONTOUR = [
    [0, 2, 4, 2, 3, 2, 4, 2, 0, 2, 5, 2, 3, 2, 4, 1],
    [0, 2, 4, 2, 3, 2, 5, 2, 0, 2, 4, 2, 3, 4, 2, 1],
  ]
  const ACCENT = [1, 0.5, 0.74, 0.5, 0.88, 0.5, 0.7, 0.55, 0.96, 0.5, 0.8, 0.5, 0.85, 0.52, 0.7, 0.6]
  const PAN = [-0.5, 0.5, -0.25, 0.6, 0.5, -0.5, 0.25, -0.6] // accents alternate sides
  const THIN = [1, 0.5, 0.72, 0.5, 0.8, 0, 0.6, 0, 0.7, 0, 0.45, 0, 0.5, 0, 0, 0] // bar 26
  for (let bar = 4; bar <= 26; bar++) {
    for (let s = 0; s < 16; s++) {
      const t = (bar - 1) * 2 + s * STEP
      if (t >= 15.5 && t < 16) continue
      if (t >= 36 && t < 42) continue
      const name = bar === 25 ? BURST[s >> 2] : HARMONY[bar]
      const f = hz(CHORD[name].arp[CONTOUR[bar % 2][bar === 25 ? s % 4 : s]])
      let vel = ACCENT[s]
      if (bar === 26) vel = THIN[s]
      if (!vel) continue
      const motion = 0.85 + 0.3 * Math.sin((TAU * t) / 8) // the brightness breathes over four bars
      put(stems.arp, t, pluck(f, { vel, i0: 3.4 * motion, i1: 0.55 * motion }), 1, PAN[s % 8])
      if (bar === 25) put(stems.lead, t, pluck(f * 2, { vel: vel * 0.9, ratio: 2, i0: 1.5, i1: 0.2, tauA: 0.075, dur: 0.24, tine: 0 }), 1, -PAN[s % 8])
    }
  }
}

// ── Pad ──────────────────────────────────────────────────────────────────
{
  const chords = [
    [8, 15.5, 'Dsus2', 5, 0.2], // creeps in under the build
    [16, 22, 'Dsus2', 0.03, 0.6],
    [22, 24, 'D7sus'],
    [24, 28, 'Gsus2'],
    [28, 30, 'Asus4'],
    [30, 34, 'Dsus2'],
    [34, 36, 'D7sus'],
    [36, 38, 'Dsus2'],
    [38, 40, 'Dsus4'], // left hanging: 'not a guarantee'
    [40, 44, 'Dsus2'],
    [44, 46, 'Gsus2'],
    [46, 48, 'Asus4'],
    [48, 52, 'Dsus2'],
    [52, 58, 'D5', 0.4, 1.5], // open fifth under the end card
  ]
  for (const [t0, t1, name, att = 0.3, rel = 0.6] of chords) {
    const n = at(t1 - t0 + rel)
    const v = sawChord(CHORD[name].pad, n)
    const nA = Math.round(att * SR)
    const nR = Math.round(rel * SR)
    for (const ch of [v.L, v.R]) {
      for (let i = 0; i < nA; i++) ch[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nA)
      for (let i = 0; i < nR; i++) ch[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / nR)
    }
    put(stems.pad, t0, v, 0.1)
  }
}

// ── Stabs, impacts, sweeps ───────────────────────────────────────────────
{
  const STAB = [['D4', 'A4', 'E5'], ['C4', 'G4', 'D5'], ['G3', 'D4', 'A4'], ['A3', 'E4', 'D5']]
  ;['SEE.', 'SET.', 'TRACE.', '24/5.'].forEach((word, k) => {
    put(stems.stab, 48 + k * 0.5, stab(STAB[k], { vel: 1 }), 1)
    accents.push([`stab ${k + 1} (${word})`, 48 + k * 0.5, 'stab'])
  })
  // 50.0: the one sustained chord
  put(stems.stab, 50, stab(['D3', 'A3', 'D4', 'A4', 'E5'], { vel: 1, dur: 2.0, tau: 0.75, c0: 6000, c1: 350, tauF: 0.5 }), 0.9)
  // impacts and chapter marks (noise only)
  const CRASH = [
    [16, 1, 0.5], [16.5, 0.5, 0.22], [18, 0.95, 0.32], [24, 0.95, 0.32], [30, 0.95, 0.32],
    [48, 0.55, 0.22], [48.5, 0.3, 0.1], [49, 0.3, 0.1], [49.5, 0.3, 0.1], [50, 1, 0.6],
  ]
  for (const [t, vel, tau] of CRASH) put(stems.fx, t, crash({ vel, tau }), 0.55)
  put(stems.fx, 14, sweep(1.5, { f0: 400, f1: 9000 }), 0.5) // riser through bar 8, cut by the silence
  put(stems.fx, 17.5, sweep(0.5, { f0: 1500, f1: 6000, q: 0.9, power: 2.5 }), 0.16)
  put(stems.fx, 35, reverseCymbal(1), 0.6) // into the hard stop at 36.0
  put(stems.fx, 43.5, sweep(0.5, { f0: 1500, f1: 6000, q: 0.9, power: 2.5 }), 0.16)
  put(stems.fx, 46, sweep(2, { f0: 500, f1: 10000 }), 0.42) // riser under the snare build
  // fan re-seeds: a short noise shuffle on each
  for (const t of [11, 11.5, 12, 12.5]) {
    put(stems.fx, t, shuffle({ vel: 0.9 }), 1.8)
    accents.push(['fan shuffle', t, 'fx'])
  }
}
accents.push(['roll accent', 14, 'snare'], ['roll accent', 14.5, 'snare'], ['roll accent', 15, 'snare'])
accents.push(['drop impact', 16, 'kick'], ['second hit', 16.5, 'snare'], ['chapter 01', 18, 'fx'], ['chapter 02', 24, 'fx'], ['chapter 03', 30, 'fx'])
accents.push(['kick returns', 40, 'kick'], ['big downbeat', 50, 'kick'], ['last event', 58, 'kick'])

// ── Pitched signals and mechanical clicks, by scene ──────────────────────
{
  const STEPS = ['D5', 'E5', 'G5', 'A5'] // one scale step per node
  // S04: session nodes light at 6.5, 7.0, 7.5, 8.0
  STEPS.forEach((nt, k) => {
    put(stems.blip, 6.5 + k * 0.5, tone(hz(nt), { vel: 0.8, tau: 0.2 }), 1, -0.45 + 0.3 * k)
    accents.push([`node tone ${nt}`, 6.5 + k * 0.5, 'blip'])
  })
  // S07: caliper closes on the thesis
  put(stems.click, 17, relay({ heavy: true, vel: 0.7 }), 0.9)
  // S08: BID, ASK, then both together for SPREAD, with the caliper detent
  put(stems.blip, 19, tone(hz('A5'), { vel: 0.9, tau: 0.09, dur: 0.4 }), 1, -0.35)
  put(stems.blip, 19.5, tone(hz('D6'), { vel: 0.9, tau: 0.09, dur: 0.4 }), 1, 0.35)
  put(stems.blip, 20, tone(hz('A5'), { vel: 0.75, tau: 0.13, dur: 0.5 }), 1, -0.35)
  put(stems.blip, 20, tone(hz('D6'), { vel: 0.75, tau: 0.13, dur: 0.5 }), 1, 0.35)
  put(stems.click, 20, relay({ vel: 0.8 }), 0.8)
  accents.push(['blip BID', 19, 'blip'], ['blip ASK', 19.5, 'blip'], ['blip SPREAD', 20, 'blip'])
  // S08 20-22: live ticking on the triplet grid, very quiet
  {
    const r = rng(23)
    for (let k = 1; k < 12; k++) if (k % 3) put(stems.click, 20 + k * TRIP, dataTick({ vel: 0.3 + 0.15 * r(), pitch: 0.9 + 0.2 * r() }), 0.7, (r() * 2 - 1) * 0.7)
  }
  // S09: muted relay as each level snaps
  ;[25, 25.5, 26].forEach((t, k) => {
    put(stems.click, t, relay({ muted: true, vel: 1 }), [1.6, 1.9, 1.6][k], [-0.25, 0, 0.25][k])
    accents.push([`relay ${['ENTRY', 'STOP', 'LIMIT'][k]}`, t, 'click'])
  })
  // S10: rising four-note figure follows the pulse, then three printer ticks
  STEPS.forEach((nt, k) => {
    put(stems.blip, 30.5 + k * 0.5, tone(hz(nt), { vel: 0.95, tau: 0.14, h2: 0.3 }), 1, -0.45 + 0.3 * k)
    accents.push([`pulse figure ${nt}`, 30.5 + k * 0.5, 'blip'])
  })
  ;[32, 32.5, 33].forEach((t, k) => {
    put(stems.click, t, printer({ vel: 1 }), 1.35, [0.2, 0.25, 0.3][k])
    accents.push([`printer ${['REQUESTED', 'FILLED', 'TIME-STAMPED'][k]}`, t, 'click'])
  })
  // S10: syncopated telemetry bleeps through bars 16-18
  const TELE = [
    [[3, 'E6'], [6, 'A5'], [11, 'E6'], [14, 'D6']],
    [[1, 'A5'], [6, 'E6'], [9, 'D6'], [14, 'E6'], [15, 'A5']],
  ]
  for (let bar = 16; bar <= 18; bar++) {
    for (const [s, nt] of TELE[bar % 2]) {
      const t = (bar - 1) * 2 + s * STEP
      if (t >= 35.5) continue // leave room for the reverse cymbal
      put(stems.blip, t, pip(hz(nt), { vel: 0.5 }), 1, s % 2 ? 0.5 : -0.5)
      if (bar === 16) accents.push(['telemetry bleep', t, 'blip'])
    }
  }
  put(stems.click, 33.5, relay({ vel: 0.7 }), 0.8) // caliper closes on the two prices
  // S11: one soft low tone
  put(stems.low, 38, lowTone(), 1.1)
  accents.push(['low tone', 38, 'low'])
  // S12: size stepper (triplet grid), button press, receipt lines, sonic mark under the CTA
  for (let k = 0; k < 3; k++) put(stems.click, 42 + k * TRIP, dataTick({ vel: 0.5, pitch: 0.95 + 0.05 * k }), 0.9, 0.2)
  put(stems.click, 44, relay({ muted: true, vel: 1 }), 2.1)
  accents.push(['relay (button press)', 44, 'click'])
  for (let k = 0; k < 3; k++) put(stems.click, 45 + k * TRIP, printer({ vel: 0.55 }), 0.8, 0.25)
  sonicMark(46, 1.25)
  // S14: the mark locks 20 frames after the downbeat (on the triplet grid)
  put(stems.click, 50 + 4 * TRIP, relay({ vel: 0.7 }), 0.8)
  // S15: sonic mark on the end card, and a single D with the final kick
  sonicMark(54, 1)
  put(stems.bell, 58, bell(hz('D5'), { vel: 0.5, dur: 1.7, tau: 0.5 }), 1, 0)
}

// ═════════════════════════════ 4. MIX AND MASTER ══════════════════════════

// Sidechain curve from the kick times: 1 while the kick speaks, back to 0 by 230 ms.
const duck = new Float32Array(N)
for (const [t, strength] of kicks) {
  const s = at(t)
  const nA = Math.round(0.004 * SR)
  const nH = Math.round(0.045 * SR)
  const nR = Math.round(0.185 * SR)
  for (let i = 0; i < nA + nH + nR && s + i < N; i++) {
    const v = i < nA ? i / nA : i < nA + nH ? 1 : Math.pow(0.5 + 0.5 * Math.cos((Math.PI * (i - nA - nH)) / nR), 1.5)
    if (v * strength > duck[s + i]) duck[s + i] = v * strength
  }
}
const applyDuck = (bus, depth) => eachChannel(bus, ch => { for (let i = 0; i < N; i++) ch[i] *= 1 - depth * duck[i] })
const hpBus = (bus, f, q = 0.7071) => eachChannel(bus, ch => filt(ch, biquad('hp', f, q)))

// Per-stem processing: automation, high-pass everything that is not bass.
{
  // Arpeggio filter: opens steadily 6 -> 15.5, fully open in the drop, opens
  // again 42 -> 48, and sweeps down 51 -> 52.
  const arpCut = curve([[6, 280], [15.5, 5200], [16, 9500], [36, 9500], [42, 520], [48, 9000], [51, 9000], [52, 380]], 'exp')
  eachChannel(stems.arp, ch => svf(ch, i => arpCut(i / SR), 1.1))
  gainAuto(stems.arp, curve([[6, 0.55], [15.5, 1], [42, 0.6], [48, 1], [51, 1], [52, 0.45]]))
  hpBus(stems.arp, 180)
  applyDuck(stems.arp, 0.22)
  hpBus(stems.lead, 400)
  eachChannel(stems.lead, ch => svf(ch, i => arpCut(i / SR), 0.8))

  const padCut = curve([[8, 320], [15.5, 1500], [16, 1700], [36, 1700], [36.5, 1150], [40, 1000], [48, 2100], [51, 2300], [52, 800], [58, 720], [60, 380]], 'exp')
  const padLfo = (i, ph) => 1 + 0.14 * Math.sin((TAU * 0.11 * i) / SR + ph)
  svf(stems.pad.L, i => padCut(i / SR) * padLfo(i, 0), 0.6)
  svf(stems.pad.R, i => padCut(i / SR) * padLfo(i, 1.9), 0.6)
  gainAuto(stems.pad, curve([[8, 0.3], [15.5, 0.75], [16, 1], [36, 1], [36.4, 1.25], [40, 1.2], [41, 0.95], [52, 1], [58, 0.95]]))
  hpBus(stems.pad, 140)
  applyDuck(stems.pad, 0.5)

  const hatCut = curve([[0, 16000], [51, 16000], [52, 2500]], 'exp')
  eachChannel(stems.hats, ch => svf(ch, i => hatCut(i / SR), 0.7))
  hpBus(stems.stab, 160)
  hpBus(stems.bell, 300)
  hpBus(stems.blip, 250)
  hpBus(stems.snare, 130)
  hpBus(stems.click, 90)
  hpBus(stems.fx, 200)
  filt(stems.bass, biquad('hp', 32))
  applyDuck(stems.bass, 0.5)
  applyDuck(stems.low, 0.35)
  hpBus(stems.hum, 200)
  applyDuck(stems.hum, 0.35)
}

// Fader, hall send, room send, delay send. Every fader is also trimmed by
// HEADROOM so the summed bus stays below full scale before the master.
const HEADROOM = dB(-6)
const MIX = {
  low: [0.2, 0.06, 0, 0],
  hum: [0.32, 0.25, 0, 0],
  kick: [0.54, 0, 0.02, 0],
  bass: [0.4, 0, 0, 0],
  snare: [0.66, 0.05, 0.22, 0],
  hats: [0.27, 0, 0.06, 0],
  shaker: [0.4, 0, 0.05, 0],
  tick: [0.32, 0, 0, 0],
  click: [0.34, 0.06, 0.3, 0],
  arp: [0.49, 0.16, 0, 0.26],
  lead: [0.27, 0.2, 0, 0.3],
  pad: [1.1, 0.3, 0, 0],
  stab: [0.84, 0.25, 0, 0.12],
  bell: [0.25, 0.5, 0, 0.3],
  blip: [0.33, 0.4, 0, 0.4],
  fx: [0.6, 0.25, 0, 0],
}
const hallIn = stereoBus()
const roomIn = stereoBus()
const delayIn = stereoBus()
for (const [name, [level, hall, room, delay]] of Object.entries(MIX)) {
  const fader = level * HEADROOM
  const bus = stems[name]
  gapMute(bus)
  const L = bus.L || bus
  const R = bus.R || bus
  for (let i = 0; i < N; i++) {
    const l = (L[i] *= fader)
    const r = bus.L ? (R[i] *= fader) : l
    if (hall) {
      hallIn.L[i] += l * hall
      hallIn.R[i] += r * hall
    }
    if (room) {
      roomIn.L[i] += l * room
      roomIn.R[i] += r * room
    }
    if (delay) {
      delayIn.L[i] += l * delay
      delayIn.R[i] += r * delay
    }
  }
}
const delayOut = pingPong(delayIn.L, delayIn.R)
for (let i = 0; i < N; i++) {
  hallIn.L[i] += delayOut.L[i] * 0.3
  hallIn.R[i] += delayOut.R[i] * 0.3
}
hpBus(hallIn, 260)
hpBus(roomIn, 180)
const hallOut = reverb(hallIn.L, hallIn.R, { rt: 2.0, damp: 6000, pre: 0.022, lines: 16, width: 0.8 })
const roomOut = reverb(roomIn.L, roomIn.R, { rt: 0.42, damp: 5200, pre: 0.004, size: 0.37, width: 0.7 })
applyDuck(hallOut, 0.3)
for (const bus of [delayOut, hallOut, roomOut]) gapMute(bus) // the tails take the same 12 ms fade into the silence
stems.delay = delayOut
stems.hall = hallOut
stems.room = roomOut

// Sum, then the master chain.
const mixL = new Float32Array(N)
const mixR = new Float32Array(N)
for (const bus of Object.values(stems)) {
  const L = bus.L || bus
  const R = bus.R || bus
  for (let i = 0; i < N; i++) {
    mixL[i] += L[i]
    mixR[i] += R[i]
  }
}
const TARGET_LUFS = -14
const CEILING_DBTP = -1.6 // limiter ceiling: true peak stays under -1.5 dBTP, leaving margin for the AAC encode
function master(inL, inR) {
  const pre = [biquad('hp', 24, 0.7071)] // subsonic / DC blocker
  const L0 = filt(Float32Array.from(inL), ...pre)
  const R0 = filt(Float32Array.from(inR), ...pre)
  let gain = dB(TARGET_LUFS - loudness(L0, R0).integrated)
  let L, R, stats
  for (let pass = 0; pass < 4; pass++) {
    L = new Float32Array(N)
    R = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      // soft saturation: transparent below about -6 dBFS, rounds the tallest peaks
      L[i] = Math.tanh(0.8 * L0[i] * gain) / 0.8
      R[i] = Math.tanh(0.8 * R0[i] * gain) / 0.8
    }
    filt(L, ...pre) // saturating an asymmetric waveform shifts its mean: block DC again
    filt(R, ...pre)
    stats = limiter(L, R, dB(CEILING_DBTP))
    const err = TARGET_LUFS - loudness(L, R).integrated
    if (Math.abs(err) < 0.03) break
    gain *= dB(err)
  }
  // Final gates: exact digital silence in the gap and after the ring-out.
  const fade = Math.round(0.002 * SR)
  const out0 = at(58.7)
  const out1 = at(END_SILENCE)
  for (const ch of [L, R]) {
    for (let i = 0; i < fade; i++) ch[GAP0 - fade + i] *= 0.5 + 0.5 * Math.cos((Math.PI * i) / fade)
    ch.fill(0, GAP0, GAP1)
    for (let i = out0; i < out1; i++) ch[i] *= Math.pow(0.5 + 0.5 * Math.cos((Math.PI * (i - out0)) / (out1 - out0)), 2)
    ch.fill(0, out1)
  }
  return { L, R, gainDb: toDb(gain), ...stats }
}
const out = master(mixL, mixR)

// ── WAV writer ───────────────────────────────────────────────────────────
function writeWav(file, L, R, bits) {
  const bytes = bits / 8
  const data = Buffer.alloc(44 + N * 2 * bytes)
  data.write('RIFF', 0)
  data.writeUInt32LE(36 + N * 2 * bytes, 4)
  data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20) // PCM
  data.writeUInt16LE(2, 22)
  data.writeUInt32LE(SR, 24)
  data.writeUInt32LE(SR * 2 * bytes, 28)
  data.writeUInt16LE(2 * bytes, 32)
  data.writeUInt16LE(bits, 34)
  data.write('data', 36)
  data.writeUInt32LE(N * 2 * bytes, 40)
  const full = bits === 24 ? 8388607 : 32767
  const r = rng(0xd17e)
  let o = 44
  for (let i = 0; i < N; i++) {
    for (const x of [L[i], R[i]]) {
      // 16-bit only: TPDF dither, except where the signal is exact silence
      let v = Math.round(x * full + (bits === 16 && x !== 0 ? r() - r() : 0))
      v = clamp(v, -full - 1, full)
      if (v < 0) v += bits === 24 ? 16777216 : 65536
      data[o++] = v & 255
      data[o++] = (v >> 8) & 255
      if (bits === 24) data[o++] = (v >> 16) & 255
    }
  }
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, data)
}
const outFile = path.join(ROOT, 'out', 'audio.wav')
writeWav(outFile, out.L, out.R, BITS)
{
  const lu = loudness(out.L, out.R)
  console.log(
    `audio -> ${path.relative(process.cwd(), outFile)}  ${SR} Hz stereo ${BITS}-bit  ${N} frames (${(N / SR).toFixed(3)} s)  ` +
      `${lu.integrated.toFixed(2)} LUFS  true peak ${toDb(truePeak(out.L, out.R)).toFixed(2)} dBTP`,
  )
}

// ═════════════════════════════ 5. ANALYSIS ════════════════════════════════
if (ANALYZE) analyze()

function analyze() {
  const { L, R } = out
  const log = console.log
  const rms = (a, s, e) => {
    let x = 0
    for (let i = s; i < e; i++) x += a[i] * a[i]
    return Math.sqrt(x / (e - s))
  }
  const fmt = (v, w = 6) => (Number.isFinite(v) ? v.toFixed(1) : '-inf').padStart(w)
  const SECTIONS = [
    ['bars 1-2', 0, 4], ['intro', 0, 6], ['build', 6, 15.5], ['drop', 16, 18], ['01 see', 18, 24], ['02 set', 24, 30], ['03 trace', 30, 36],
    ['breakdown', 36, 40], ['rebuild', 40, 48], ['burst', 48, 50], ['converge', 50, 52], ['resolve', 52, 59],
    ['WHOLE FILM', 0, 60],
  ]

  log('\n── Master ──')
  const lu = loudness(L, R)
  let peak = 0
  let sumL = 0
  let sumR = 0
  let maxStep = 0
  let maxStepAt = 0
  let clipped = 0
  for (let i = 0; i < N; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
    if (Math.abs(L[i]) >= 0.999 || Math.abs(R[i]) >= 0.999) clipped++
    sumL += L[i]
    sumR += R[i]
    if (i) {
      const d = Math.max(Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1]))
      if (d > maxStep) {
        maxStep = d
        maxStepAt = i
      }
    }
  }
  log(`integrated ${lu.integrated.toFixed(2)} LUFS   momentary max ${lu.momentaryMax.toFixed(2)} LUFS   make-up gain ${out.gainDb.toFixed(2)} dB`)
  log(`sample peak ${toDb(peak).toFixed(2)} dBFS   true peak (4x) ${toDb(truePeak(L, R)).toFixed(2)} dBTP   clipped samples ${clipped}`)
  log(`limiter: max reduction ${out.maxReductionDb.toFixed(2)} dB, more than 0.5 dB for ${out.activePercent.toFixed(2)}% of the time`)
  log(
    'limiter by section (max dB / % of time over 1 dB): ' +
      SECTIONS.slice(1, -1)
        .map(([name, t0, t1]) => {
          let mn = 1
          let over = 0
          for (let i = at(t0); i < at(t1); i++) {
            const g = out.limiterGain[i]
            if (g < mn) mn = g
            if (g < 0.891) over++
          }
          return `${name} ${(-toDb(mn)).toFixed(1)}/${((100 * over) / (at(t1) - at(t0))).toFixed(1)}%`
        })
        .join('  '),
  )
  log(`DC offset L ${(sumL / N).toExponential(2)}  R ${(sumR / N).toExponential(2)}`)
  log(`largest sample-to-sample step ${maxStep.toFixed(3)} at ${(maxStepAt / SR).toFixed(4)} s`)

  log('\n── Silence ──')
  const maxAbs = (s, e) => {
    let m = 0
    for (let i = s; i < e; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]))
    return m
  }
  let last = N - 1
  while (last > 0 && L[last] === 0 && R[last] === 0) last--
  log(`gap 15.5-16.0: peak ${fmt(toDb(maxAbs(GAP0, GAP1)))} dBFS   (20 ms before the gap: ${fmt(toDb(maxAbs(GAP0 - 960, GAP0)))} dBFS)`)
  log(`final 100 ms: peak ${fmt(toDb(maxAbs(N - 4800, N)))} dBFS   last non-zero sample at ${((last + 1) / SR).toFixed(4)} s`)
  log(`tail level (50 ms RMS): ` + [58, 58.5, 59, 59.25, 59.5, 59.7].map(t => `${t}s ${fmt(toDb(rms(L, at(t), at(t) + 2400)), 5)}`).join('  '))

  log('\n── Per-section loudness, band balance (dB relative to section total) and stereo ──')
  log('mono = loudness change when folded to mono; phone = loudness through a 300 Hz 2nd-order high-pass')
  log('(small-speaker check) and loss = how much that high-pass costs')
  log('section     LUFS    sub  bass  lomid   mid  pres  high   air   corr  minCorr  side/mid   mono  phone   loss   L-R')
  const EDGES = [20, 80, 250, 800, 2000, 5000, 10000, 24000]
  const mid = Float32Array.from(L, (v, i) => (v + R[i]) * 0.5)
  const luMono = loudness(mid, mid)
  const small = ch => filt(Float32Array.from(ch), biquad('hp', 300, 0.7071))
  const luPhone = loudness(small(L), small(R))
  for (const [name, t0, t1] of SECTIONS) {
    const bands = bandEnergy(L, R, at(t0), at(t1), EDGES)
    const total = bands.reduce((a, b) => a + b, 0)
    let ll = 0
    let rr = 0
    let lr = 0
    let minCorr = 1
    const win = SR / 2
    for (let s = at(t0); s + win <= at(t1); s += win / 2) {
      let a = 0
      let b = 0
      let c = 0
      for (let i = s; i < s + win; i++) {
        a += L[i] * L[i]
        b += R[i] * R[i]
        c += L[i] * R[i]
      }
      ll += a
      rr += b
      lr += c
      if (a + b > win * 2e-6) minCorr = Math.min(minCorr, c / Math.sqrt(a * b))
    }
    const corr = lr / Math.sqrt(ll * rr)
    const sideMid = 10 * Math.log10((ll + rr - 2 * lr) / (ll + rr + 2 * lr))
    log(
      name.padEnd(10) + fmt(lu.section(t0, t1), 6) + ' ' + bands.map(b => fmt(10 * Math.log10(b / total))).join('') +
        `  ${corr.toFixed(2).padStart(5)}  ${minCorr.toFixed(2).padStart(6)}  ${fmt(sideMid, 8)}` +
        `  ${fmt(luMono.section(t0, t1) - lu.section(t0, t1), 5)}  ${fmt(luPhone.section(t0, t1), 5)}  ${fmt(luPhone.section(t0, t1) - lu.section(t0, t1), 5)}  ${fmt(10 * Math.log10(ll / rr), 4)}`,
    )
  }

  log('\n── Where the loudness comes from: each stem, K-weighted, full range and through the 300 Hz high-pass ──')
  log('(LUFS before the master; the last column is the share of the high-passed mix that the stem supplies)')
  for (const [label, t0, t1] of [['bars 1-2', 0, 4], ['groove 16-36 s', 16, 36]]) {
    const a = at(t0)
    const b = at(t1)
    const rows = Object.keys(stems).map(n => {
      const bus = stems[n]
      const chans = [bus.L || bus, bus.R || bus].map(ch => ch.subarray(a, b))
      const e = w => chans.reduce((sum, ch) => sum + w(ch).reduce((x, v) => x + v * v, 0), 0) / (b - a)
      return [n, e(kWeight), e(ch => kWeight(small(ch)))]
    })
    const total = rows.reduce((x, r) => x + r[2], 0)
    log(`${label}:  ` + rows.filter(r => r[1] > 1e-9).map(r => `${r[0]} ${(-0.691 + 10 * Math.log10(r[1])).toFixed(1)}/${(-0.691 + 10 * Math.log10(r[2])).toFixed(1)} (${((100 * r[2]) / total).toFixed(0)}%)`).join('  '))
  }

  log('\n── Per-bar RMS (dBFS): stems before the master, mix after it ──')
  const names = Object.keys(stems)
  log('bar  time ' + names.map(n => n.slice(0, 5).padStart(6)).join('') + '    MIX')
  for (let bar = 1; bar <= 30; bar++) {
    const s = (bar - 1) * 2 * SR
    const e = s + 2 * SR
    const cols = names.map(n => {
      const b = stems[n]
      const v = b.L ? Math.sqrt((rms(b.L, s, e) ** 2 + rms(b.R, s, e) ** 2) / 2) : rms(b, s, e)
      return v < 1e-5 ? '     .' : fmt(toDb(v))
    })
    log(String(bar).padStart(3) + String((bar - 1) * 2).padStart(5) + 's' + cols.join('') + fmt(toDb(Math.sqrt((rms(L, s, e) ** 2 + rms(R, s, e) ** 2) / 2)), 7))
  }

  log('\n── Stem peaks and smoothness (second-difference crest; a click shows as a large value) ──')
  for (const n of names) {
    const b = stems[n]
    const ch = b.L || b
    let pk = 0
    let d2max = 0
    let d2at = 0
    let d2sum = 0
    let cnt = 0
    for (let i = 2; i < N; i++) {
      const a = Math.abs(ch[i])
      if (a > pk) pk = a
      const d2 = Math.abs(ch[i] - 2 * ch[i - 1] + ch[i - 2])
      if (d2 > d2max) {
        d2max = d2
        d2at = i
      }
      if (a > 1e-5) {
        d2sum += d2 * d2
        cnt++
      }
    }
    const corr = b.L ? correlation(b.L, b.R, 0, N) : 1
    const bal = b.L ? toDb(rms(b.L, 0, N) / rms(b.R, 0, N)) : 0
    log(`${n.padEnd(7)} peak ${fmt(toDb(pk))} dBFS   d2 max ${d2max.toFixed(4)} at ${(d2at / SR).toFixed(4)} s (crest ${(d2max / Math.sqrt(d2sum / Math.max(1, cnt))).toFixed(1)})   L/R corr ${corr.toFixed(2)}   L-R ${bal.toFixed(2)} dB`)
  }

  log('\n── Onsets against the grid ──')
  // Kick stem: every hit must start on its exact sample (stem is silent between hits).
  let worst = 0
  for (const [t] of kicks) {
    const s = at(t)
    let first = -1
    for (let i = s - 480; i < s + 480; i++) {
      if (Math.abs(stems.kick[i]) > 1e-4 && Math.abs(stems.kick[i - 1] || 0) <= 1e-4 && first < 0 && i >= s - 2) first = i
    }
    const before = maxOf(stems.kick, s - 240, s - 1)
    const dev = first < 0 ? Infinity : (first - s) / SR
    if (before > 1e-3) log(`  kick at ${t}: previous tail still at ${toDb(before).toFixed(1)} dBFS`)
    worst = Math.max(worst, Math.abs(dev))
  }
  log(`kick stem: ${kicks.length} hits, worst onset deviation ${(worst * 1000).toFixed(3)} ms`)
  // Master: transient detector on the finished mix (high band, energy jump).
  const hp = filt(Float32Array.from(L, (v, i) => (v + R[i]) * 0.5), biquad('hp', 3000), biquad('hp', 3000))
  const lp = filt(Float32Array.from(L, (v, i) => (v + R[i]) * 0.5), biquad('lp', 250), biquad('lp', 250))
  // First try a threshold crossing (4x the level just before, or 15% of the
  // peak just after). Where the music is already loud before the accent, fall
  // back to the steepest 0.5 ms energy rise within 10 ms of the grid time.
  const detect = (sig, t) => {
    const s = at(t)
    const floor = Math.max(1e-5, rms(sig, Math.max(0, s - 720), Math.max(1, s - 96)))
    let pk = 0
    for (let i = s; i < s + 720; i++) pk = Math.max(pk, Math.abs(sig[i]))
    const rise = toDb(pk / floor)
    const thr = Math.max(floor * 4, pk * 0.15)
    for (let i = Math.max(0, s - 480); i < s + 720; i++) if (Math.abs(sig[i]) > thr) return { dev: (i - s) / SR, rise, how: 'threshold' }
    const w = 24
    let best = 0
    let bestAt = -1
    for (let i = Math.max(w, s - 480); i < s + 480; i++) {
      const jump = rms(sig, i, i + w) - rms(sig, i - w, i)
      if (jump > best) {
        best = jump
        bestAt = i
      }
    }
    return { dev: bestAt < 0 ? NaN : (bestAt - s) / SR, rise, how: 'steepest rise' }
  }
  let worstKick = 0
  let missed = 0
  for (const [t] of kicks) {
    const d = detect(hp, t)
    if (Number.isNaN(d.dev)) missed++
    else worstKick = Math.max(worstKick, Math.abs(d.dev))
  }
  log(`master, at the ${kicks.length} kick times (band above 3 kHz): worst deviation ${(worstKick * 1000).toFixed(3)} ms, undetected ${missed}`)
  // Prominence: energy of the accent's own stem over its first 60 ms against
  // everything else sounding in that window (before the master). Measured in
  // the 700 Hz - 8 kHz band, where a click or bell has to read over the groove;
  // the low accents (kick, felt hit, low tone) are measured K-weighted, full band.
  const midBand = x => filt(Float32Array.from(x), biquad('hp', 700), biquad('hp', 700), biquad('lp', 8000))
  const prominence = (name, t) => {
    const weight = name === 'low' || name === 'kick' ? kWeight : midBand
    const s = at(t)
    const n = at(0.06)
    const pad = 2400 // let the weighting filters settle
    const bus = stems[name]
    const own = [bus.L || bus, bus.R || bus].map(ch => weight(ch.subarray(Math.max(0, s - pad), s + n)))
    const all = [mixL, mixR].map(ch => weight(ch.subarray(Math.max(0, s - pad), s + n)))
    let eOwn = 0
    let eRest = 0
    for (let c = 0; c < 2; c++) {
      for (let i = own[c].length - n; i < own[c].length; i++) {
        eOwn += own[c][i] ** 2
        eRest += (all[c][i] - own[c][i]) ** 2
      }
    }
    return [10 * Math.log10(eOwn / Math.max(eRest, 1e-12)), toDb(Math.max(maxOf(bus.L || bus, s, s + n), maxOf(bus.R || bus, s, s + n)))]
  }
  log('master, key accents: deviation of the first transient from the grid time; rise = peak over the level just before;')
  log('prominence = the accent stem against everything else in its first 60 ms (before the master):')
  for (const [label, t, stem] of accents.sort((a, b) => a[1] - b[1])) {
    let d = detect(hp, t)
    if (label === 'low tone') {
      // soft 30 ms attack by design: report where its stem starts instead
      let first = at(t) - 480
      while (Math.abs(stems.low[first]) < 1e-7) first++
      d = { dev: (first - at(t)) / SR, rise: NaN, how: 'stem start (30 ms attack)' }
    }
    log(
      `  ${t.toFixed(4).padStart(8)} s  ${label.padEnd(24)} ${Number.isNaN(d.dev) ? 'no transient found' : `${(d.dev * 1000).toFixed(3).padStart(7)} ms`}` +
        `   rise ${fmt(d.rise, 5)} dB   prominence ${fmt(prominence(stem, t)[0], 6)} dB   stem peak ${fmt(prominence(stem, t)[1], 6)} dBFS   ${d.how}`,
    )
  }
}

function maxOf(a, s, e) {
  let m = 0
  for (let i = Math.max(0, s); i < e; i++) m = Math.max(m, Math.abs(a[i]))
  return m
}
function correlation(a, b, s, e) {
  let aa = 0
  let bb = 0
  let ab = 0
  for (let i = s; i < e; i++) {
    aa += a[i] * a[i]
    bb += b[i] * b[i]
    ab += a[i] * b[i]
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 1
}
// Welch power spectrum summed into bands (Hann, 8192 points, 50% overlap), L + R.
function bandEnergy(L, R, s, e, edges) {
  const size = 8192
  const win = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((TAU * i) / size))
  const bands = new Float64Array(edges.length - 1)
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (const ch of [L, R]) {
    for (let p = s; p + size <= e; p += size / 2) {
      for (let i = 0; i < size; i++) {
        re[i] = ch[p + i] * win[i]
        im[i] = 0
      }
      fft(re, im)
      for (let k = 1; k < size / 2; k++) {
        const f = (k * SR) / size
        for (let b = 0; b < bands.length; b++) if (f >= edges[b] && f < edges[b + 1]) bands[b] += re[k] * re[k] + im[k] * im[k]
      }
    }
  }
  return Array.from(bands)
}
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const xr = re[b] * cr - im[b] * ci
        const xi = re[b] * ci + im[b] * cr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}
