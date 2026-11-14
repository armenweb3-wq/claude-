#!/usr/bin/env node
// Render the ad to MP4: seek the page to every frame, screenshot it, then
// encode the frames (plus the music bed, if present) with ffmpeg.
//
//   node tools/render.mjs                      all formats
//   node tools/render.mjs --format 9x16        one format
//   node tools/render.mjs --format 16x9,1x1 --workers 4
//
// Options: --page src/index.html  --audio out/audio.wav  --out out
//          --fps 30  --crf 17  --grain 5 (0 = off)  --workers 4  --from 0 --to <sec>  --keep-frames
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { FORMATS, ROOT, launchBrowser, openAd, parseArgs, resolveFormats, seek, startServer } from './lib.mjs'

const args = parseArgs(process.argv.slice(2), {
  format: 'all',
  page: 'src/index.html',
  audio: 'out/audio.wav',
  out: 'out',
  name: 'forex-ad',
  crf: '17',
  grain: '5',
  workers: '4',
})

function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', d => (err += d))
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-2000)}`))))
  })
}

async function renderFormat(browser, baseUrl, format) {
  const outDir = path.resolve(ROOT, args.out)
  const framesDir = path.join(outDir, 'frames', format)
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })

  const workers = Math.max(1, Number(args.workers))
  const pages = []
  for (let i = 0; i < workers; i++) pages.push(await openAd(browser, baseUrl, format, args.page))
  const { duration, w, h } = pages[0]
  const fps = Number(args.fps || pages[0].fps)
  const from = Number(args.from || 0)
  const to = Math.min(duration, Number(args.to || duration))
  const first = Math.round(from * fps)
  const total = Math.round((to - from) * fps)

  let next = 0
  let done = 0
  const started = Date.now()
  await Promise.all(
    pages.map(async ({ page, context }) => {
      // Capturing through the DevTools protocol with speed-optimised PNG
      // encoding is several times faster than page.screenshot() and still lossless.
      const cdp = await context.newCDPSession(page)
      for (;;) {
        const i = next++
        if (i >= total) return
        await seek(page, (first + i) / fps)
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })
        writeFileSync(path.join(framesDir, `f_${String(i).padStart(6, '0')}.png`), Buffer.from(shot.data, 'base64'))
        done++
        if (done % 60 === 0 || done === total) {
          const rate = done / ((Date.now() - started) / 1000)
          process.stdout.write(`\r  ${format}  ${done}/${total} frames  ${rate.toFixed(1)} fps   `)
        }
      }
    }),
  )
  process.stdout.write('\n')
  const errors = pages.flatMap(p => p.errors)
  await Promise.all(pages.map(p => p.context.close()))
  if (errors.length) console.warn(`  page reported ${errors.length} error(s):\n   - ${[...new Set(errors)].slice(0, 8).join('\n   - ')}`)

  const audioPath = path.resolve(ROOT, args.audio)
  const hasAudio = existsSync(audioPath) && !args['no-audio']
  const outFile = path.join(outDir, `${args.name}-${format}.mp4`)
  // A fine luma grain keeps the dark gradients from banding after compression.
  const grain = Number(args.grain) > 0 ? `,noise=c0s=${Number(args.grain)}:c0f=t+u` : ''
  const ff = ['-y', '-framerate', String(fps), '-i', path.join(framesDir, 'f_%06d.png')]
  if (hasAudio) ff.push('-ss', String(from), '-i', audioPath)
  ff.push(
    // Screenshots are full-range sRGB; tag and convert to broadcast-range BT.709
    // so colours match on every player and platform transcoder.
    '-vf', `scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p${grain}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf), '-profile:v', 'high', '-level', '4.2',
    '-g', String(fps * 2), '-bf', '2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(fps),
  )
  if (hasAudio) ff.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2')
  ff.push('-t', String(total / fps), '-movflags', '+faststart', outFile)
  await run('ffmpeg', ff)
  if (!args['keep-frames']) rmSync(framesDir, { recursive: true, force: true })

  const mb = (statSync(outFile).size / 1e6).toFixed(1)
  console.log(`  -> ${path.relative(process.cwd(), outFile)}  ${w}x${h}  ${(total / fps).toFixed(2)}s  ${mb} MB  ${hasAudio ? 'with audio' : 'SILENT (no audio file found)'}`)
  return outFile
}

// Warn loudly while template placeholders remain: the result is a draft, not a publishable ad.
function placeholders() {
  const text = readFileSync(path.join(ROOT, 'config.js'), 'utf8')
  const found = []
  if (/name:\s*'YOURBROKER'/.test(text)) found.push('brand.name is still YOURBROKER')
  if (/url:\s*'yourbroker\.com'/.test(text)) found.push('brand.url is still yourbroker.com')
  if (/lossPercent:\s*'XX'/.test(text)) found.push("legal.lossPercent is still 'XX' (use the broker's own current figure)")
  for (const m of new Set(text.match(/\[[A-Z][A-Z ]+\]/g) || [])) found.push(`legal text still contains ${m}`)
  return found
}

const cfgText = readFileSync(path.join(ROOT, 'config.js'), 'utf8')
if (/lossPercent:\s*(''|""|null|undefined)/.test(cfgText) || !/lossPercent:/.test(cfgText)) {
  console.error("config.js: legal.lossPercent is empty. The risk warning must state the broker's own percentage; refusing to render.")
  process.exit(1)
}
const formats = resolveFormats(args.format)
const pending = placeholders()
if (pending.length) console.warn(`\nDRAFT RENDER — config.js still has placeholders:\n  - ${pending.join('\n  - ')}\n`)
const server = await startServer()
const browser = await launchBrowser()
try {
  for (const f of formats) {
    console.log(`${f}  ${FORMATS[f].w}x${FORMATS[f].h}  ${FORMATS[f].label}`)
    await renderFormat(browser, server.url, f)
  }
} finally {
  await browser.close()
  server.close()
}
