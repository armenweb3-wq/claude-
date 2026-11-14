#!/usr/bin/env node
// Motion QC on a rendered video: looks at how much each frame differs from the
// previous one and reports
//   - big jumps that are not on a scene boundary,
//   - single-frame flicker (a frame that differs from both neighbours while the
//     neighbours match each other),
//   - stretches of a second or more where almost nothing moves,
// plus loudness and stream facts. Run after rendering:
//
//   node tools/qc.mjs out/forex-ad-16x9.mp4
import { spawnSync } from 'node:child_process'

const file = process.argv[2]
if (!file) {
  console.error('usage: node tools/qc.mjs <video.mp4>')
  process.exit(2)
}
const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).stdout)
const v = probe.streams.find(s => s.codec_type === 'video')
const a = probe.streams.find(s => s.codec_type === 'audio')
console.log(`${file}`)
console.log(`  video ${v.codec_name} ${v.profile} ${v.width}x${v.height} ${v.r_frame_rate} fps ${v.pix_fmt} ${v.color_space || '?'} frames ${v.nb_frames}`)
console.log(`  audio ${a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} ch` : 'NONE'}   duration ${(+probe.format.duration).toFixed(3)} s   ${(probe.format.size / 1e6).toFixed(1)} MB   ${(probe.format.bit_rate / 1e6).toFixed(1)} Mbps`)
if (a) {
  const l = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const i = /I:\s+(-?[\d.]+) LUFS/g
  const p = /Peak:\s+(-?[\d.]+) dBFS/g
  let li, lp, m
  while ((m = i.exec(l))) li = m[1]
  while ((m = p.exec(l))) lp = m[1]
  console.log(`  loudness ${li} LUFS integrated, true peak ${lp} dBTP`)
}

const W = 192
const H = Math.round((W * v.height) / v.width / 2) * 2
const raw = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 }).stdout
const n = Math.floor(raw.length / (W * H))
const fps = Number(v.r_frame_rate.split('/')[0]) / Number(v.r_frame_rate.split('/')[1] || 1)
const frame = i => raw.subarray(i * W * H, (i + 1) * W * H)
const mad = (x, y) => {
  let s = 0
  for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i])
  return s / x.length
}
const d1 = [0]
const d2 = [0, 0]
for (let i = 1; i < n; i++) d1.push(mad(frame(i), frame(i - 1)))
for (let i = 2; i < n; i++) d2.push(mad(frame(i), frame(i - 2)))

// Cut points of the 60 s timeline (plus the intentional mid-scene changes).
const cuts = [2, 4, 6, 10, 12, 14, 15.5, 16, 16.5, 18, 24, 28, 30, 34, 36, 40, 48, 48.5, 49, 49.5, 50, 52]
const nearCut = t => cuts.some(c => t - c > -0.07 && t - c < 0.14)

let problems = 0
console.log('\n  jumps off the grid (mean change > 6/255, not within a few frames of a cut):')
let any = false
for (let i = 1; i < n; i++)
  if (d1[i] > 6 && !nearCut(i / fps)) {
    console.log(`    t=${(i / fps).toFixed(3)}  change ${d1[i].toFixed(1)}`)
    any = true
  }
if (!any) console.log('    none')

console.log('  flicker (A-B-A frames):')
let flicker = 0
for (let i = 1; i < n - 1; i++)
  if (d1[i] > 1.2 && d1[i + 1] > 1.2 && d2[i + 1] < 0.35 * Math.min(d1[i], d1[i + 1])) {
    if (flicker < 12) console.log(`    t=${(i / fps).toFixed(3)}`)
    flicker++
  }
console.log(flicker ? `    ${flicker} frame(s) flagged` : '    none')
problems += flicker

console.log('  still stretches (>= 1 s with almost no change):')
let start = -1
let still = 0
for (let i = 1; i <= n; i++) {
  const quiet = i < n && d1[i] < 0.12
  if (quiet && start < 0) start = i
  if (!quiet && start >= 0) {
    if (i - start >= fps) {
      console.log(`    ${(start / fps).toFixed(2)} - ${(i / fps).toFixed(2)} s`)
      still++
    }
    start = -1
  }
}
if (!still) console.log('    none')
process.exit(problems ? 1 : 0)
