// Renders review stills at key beats + a contact sheet, for layout QA and design approval.
// Usage: node scripts/stills.mjs [frame ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(root, "out", "stills");
mkdirSync(outDir, { recursive: true });

const frames = process.argv.slice(2).map(Number);
const list = frames.length
  ? frames
  : [60, 200, 330, 420, 520, 640, 700, 860, 960, 1060, 1180, 1270, 1320, 1500, 1610, 1690, 1790, 1640];

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "NvidiaExplainer", browserExecutable });
for (const frame of list) {
  const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.jpg`);
  await renderStill({ composition, serveUrl, frame, output, imageFormat: "jpeg", jpegQuality: 85, browserExecutable });
  console.log("rendered", output);
}
if (!frames.length) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-pattern_type", "glob", "-i", path.join(outDir, "f*.jpg"),
    "-vf", "scale=360:640,tile=6x3:padding=8:color=0x222222", "-frames:v", "1", path.join(root, "out", "contact-sheet.jpg"),
  ]);
  console.log("contact sheet → out/contact-sheet.jpg");
}
