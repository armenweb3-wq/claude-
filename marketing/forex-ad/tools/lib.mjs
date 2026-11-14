// Shared helpers for the render tools: output formats, a static file server,
// and a page opener that waits for the ad's timeline to be ready.
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Every deliverable is rendered from the same timeline at these pixel sizes.
export const FORMATS = {
  '16x9': { w: 1920, h: 1080, label: 'Landscape — YouTube, web, in-stream' },
  '9x16': { w: 1080, h: 1920, label: 'Vertical — Reels, TikTok, Shorts, Stories' },
  '4x5': { w: 1080, h: 1350, label: 'Portrait feed — Instagram / Facebook feed' },
  '1x1': { w: 1080, h: 1080, label: 'Square — feed, LinkedIn, X' },
}

export function parseArgs(argv, defaults = {}) {
  const out = { ...defaults }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}

export function resolveFormats(spec) {
  const names = !spec || spec === 'all' ? Object.keys(FORMATS) : String(spec).split(',')
  for (const n of names) if (!FORMATS[n]) throw new Error(`Unknown format "${n}". Use one of: ${Object.keys(FORMATS).join(', ')}`)
  return names
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
}

// Serve the project folder on a random localhost port so the page can load
// fonts, scripts and config the same way a browser would.
export function startServer(root = ROOT) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      const file = path.normalize(path.join(root, urlPath))
      if (!file.startsWith(root + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404).end('not found')
        return
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      createReadStream(file).pipe(res)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })
    })
  })
}

export function launchBrowser() {
  const { chromium } = require('playwright')
  return chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb'] })
}

// Opens the ad at an exact pixel size and waits until its timeline can be seeked.
export async function openAd(browser, baseUrl, format, pagePath = 'src/index.html', query = '') {
  const { w, h } = FORMATS[format]
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`))
  await page.goto(`${baseUrl}/${pagePath}?format=${format}&render=1${query ? '&' + query : ''}`)
  await page.waitForFunction(() => window.AD && typeof window.AD.seek === 'function', null, { timeout: 30000 })
  await page.evaluate(async () => {
    await window.AD.ready
    await document.fonts.ready
  })
  const info = await page.evaluate(() => ({ duration: window.AD.duration, fps: window.AD.fps || 30 }))
  if (!(info.duration > 0)) throw new Error('window.AD.duration must be a positive number of seconds')
  return { page, context, errors, ...info, w, h }
}

export async function seek(page, t) {
  await page.evaluate(time => window.AD.seek(time), t)
}
