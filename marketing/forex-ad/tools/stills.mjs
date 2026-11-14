#!/usr/bin/env node
// Capture still frames at chosen times and lay them out as labelled contact
// sheets — the fast way to review the whole spot without rendering video.
//
//   node tools/stills.mjs --format 16x9 --every 1
//   node tools/stills.mjs --format 9x16 --times 0.5,2,4.25,19
//   node tools/stills.mjs --format all --count 12
//
// Writes out/stills/<format>/t_<sec>.png and out/stills/<format>/sheet_<n>.png
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { FORMATS, ROOT, launchBrowser, openAd, parseArgs, resolveFormats, seek, startServer } from './lib.mjs'

const args = parseArgs(process.argv.slice(2), { format: '16x9', page: 'src/index.html', out: 'out/stills' })

const server = await startServer()
const browser = await launchBrowser()
try {
  for (const format of resolveFormats(args.format)) {
    const dir = path.resolve(ROOT, args.out, format)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const ad = await openAd(browser, server.url, format, args.page)

    let times
    if (args.times) times = String(args.times).split(',').map(Number)
    else if (args.every) {
      times = []
      for (let t = Number(args.offset || 0); t < ad.duration; t += Number(args.every)) times.push(+t.toFixed(3))
    } else {
      const n = Number(args.count || 12)
      times = Array.from({ length: n }, (_, i) => +(((i + 0.5) / n) * ad.duration).toFixed(3))
    }

    const shots = []
    for (const t of times) {
      await seek(ad.page, t)
      const file = `t_${t.toFixed(2).padStart(5, '0')}.png`
      await ad.page.screenshot({ path: path.join(dir, file), type: 'png' })
      shots.push({ t, file })
    }
    if (ad.errors.length) console.warn(`${format}: page reported errors:\n - ${[...new Set(ad.errors)].slice(0, 8).join('\n - ')}`)
    await ad.context.close()

    // Contact sheets: tile size and columns chosen so text stays readable.
    const { w, h } = FORMATS[format]
    const tileW = w >= h ? 640 : 400
    const tileH = Math.round((tileW * h) / w)
    const cols = w > h ? 3 : w === h ? 4 : 5
    const perSheet = cols * (w > h ? 4 : 2)
    const sheetCtx = await browser.newContext({ viewport: { width: cols * (tileW + 12) + 12, height: 800 }, deviceScaleFactor: 1 })
    const sheet = await sheetCtx.newPage()
    for (let s = 0; s * perSheet < shots.length; s++) {
      const part = shots.slice(s * perSheet, (s + 1) * perSheet)
      const html = `<body style="margin:0;padding:12px 0 0 12px;background:#777;font:600 20px/1 monospace;display:flex;flex-wrap:wrap;gap:12px">${part
        .map(
          x => `<div style="width:${tileW}px"><div style="background:#000;color:#fff;padding:6px 8px">${format} &nbsp; t = ${x.t.toFixed(2)}s</div><img src="${server.url}/${path
            .relative(ROOT, path.join(dir, x.file))
            .split(path.sep)
            .join('/')}" width="${tileW}" height="${tileH}" style="display:block"></div>`,
        )
        .join('')}</body>`
      await sheet.setContent(html, { waitUntil: 'load' })
      const out = path.join(dir, `sheet_${s + 1}.png`)
      await sheet.screenshot({ path: out, fullPage: true })
      console.log(path.relative(process.cwd(), out))
    }
    await sheetCtx.close()
    console.log(`${format}: ${shots.length} stills in ${path.relative(process.cwd(), dir)} (duration ${ad.duration}s)`)
  }
} finally {
  await browser.close()
  server.close()
}
