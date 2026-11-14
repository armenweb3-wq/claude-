#!/usr/bin/env node
// Determinism check. The renderer captures frames on several pages in an
// interleaved order, so every frame must look the same no matter which frames
// were shown before it. This seeks to each test time three ways (straight,
// after jumping around, and on a fresh page) and compares the screenshots
// byte for byte.
//
//   node tools/check.mjs                         16 times across the spot, 16x9
//   node tools/check.mjs --scene hook --format all
//   node tools/check.mjs --times 3.2,17.5
import { FORMATS, launchBrowser, openAd, parseArgs, resolveFormats, seek, startServer } from './lib.mjs'

const args = parseArgs(process.argv.slice(2), { format: '16x9', page: 'src/index.html', count: '16' })
const server = await startServer()
const browser = await launchBrowser()
let failures = 0
try {
  for (const format of resolveFormats(args.format)) {
    const a = await openAd(browser, server.url, format, args.page)
    const b = await openAd(browser, server.url, format, args.page)
    let lo = 0
    let hi = a.duration
    if (args.scene) {
      const scenes = await a.page.evaluate(() => window.AD.scenes)
      const s = scenes.find(x => x.id === args.scene)
      if (!s) throw new Error(`No scene "${args.scene}". Scenes: ${scenes.map(x => x.id).join(', ')}`)
      lo = s.start
      hi = s.end
    }
    const n = Number(args.count)
    const times = args.times
      ? String(args.times).split(',').map(Number)
      : Array.from({ length: n }, (_, i) => +(lo + ((i + 0.37) / n) * (hi - lo)).toFixed(3))
    const clip = { x: 0, y: 0, width: FORMATS[format].w, height: FORMATS[format].h }
    const bad = []
    for (const t of times) {
      await seek(a.page, t)
      const straight = await a.page.screenshot({ type: 'png', clip })
      // Jump far away, then just past, then back: exposes state that leaks between frames.
      await seek(a.page, (t + a.duration / 2) % a.duration)
      await seek(a.page, Math.min(a.duration, t + 0.4))
      await seek(a.page, t)
      const revisited = await a.page.screenshot({ type: 'png', clip })
      await seek(b.page, t)
      const fresh = await b.page.screenshot({ type: 'png', clip })
      if (!straight.equals(revisited)) bad.push(`${t}s differs after seeking away and back`)
      else if (!straight.equals(fresh)) bad.push(`${t}s differs between two pages`)
    }
    const errors = [...new Set([...a.errors, ...b.errors])]
    await a.context.close()
    await b.context.close()
    failures += bad.length + errors.length
    console.log(`${format}: ${times.length - bad.length}/${times.length} frames deterministic${bad.length ? '\n  - ' + bad.join('\n  - ') : ''}`)
    if (errors.length) console.log(`  page errors:\n  - ${errors.slice(0, 10).join('\n  - ')}`)
  }
} finally {
  await browser.close()
  server.close()
}
process.exit(failures ? 1 : 0)
