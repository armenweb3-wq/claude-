// Renders brief.html to an A4 PDF (and PNG previews of each page) with the pre-installed Chromium.
// Usage: node brief/build-pdf.mjs [page.html] [output-name]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Uses the project copy if installed, else the machine-wide Playwright.
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node-tools/node_modules/playwright")); }
import path from "node:path";
import { mkdirSync } from "node:fs";

const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, "..", "out");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
const input = process.argv[2] ?? "brief.html";
const name = process.argv[3] ?? "NVIDIA-AI-Infrastructure-Brief";
await page.goto("file://" + path.join(dir, input), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(out, `${name}.pdf`), format: "A4", printBackground: true, preferCSSPageSize: true });
const n = await page.locator("section.page").count();
for (let i = 0; i < n; i++) {
  await page.locator("section.page").nth(i).screenshot({ path: path.join(out, `${name}-p${i + 1}.png`) });
}
await browser.close();
console.log(`wrote out/${name}.pdf (${n} pages) + previews`);
