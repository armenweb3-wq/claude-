// Exports subtitles (SRT + WebVTT) and a timed voiceover script from src/data/voiceover.json —
// the same source the video uses, so burned-in captions, sidecar captions and VO stay in sync.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const vo = JSON.parse(readFileSync(path.join(root, "src/data/voiceover.json"), "utf8"));
const ts = (s, sep) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${sec}${sep}${String(ms % 1000).padStart(3, "0")}`;
};
mkdirSync(path.join(root, "out"), { recursive: true });
const srt = vo.cues.map((c, i) => `${i + 1}\n${ts(c.start, ",")} --> ${ts(c.end, ",")}\n${c.text}\n`).join("\n");
const vtt = "WEBVTT\n\n" + vo.cues.map((c) => `${ts(c.start, ".")} --> ${ts(c.end, ".")}\n${c.text}\n`).join("\n");
writeFileSync(path.join(root, "out/nvidia-explainer.srt"), srt);
writeFileSync(path.join(root, "out/nvidia-explainer.vtt"), vtt);

let md = "# Voiceover script — timed\n\nGenerated from `src/data/voiceover.json`. Record each line to land inside its window;\n";
md += "a single continuous take can be dropped in as `public/audio/voiceover.mp3` (set `voiceoverFile` in the JSON).\n\n";
for (const s of vo.scenes) {
  md += `## ${s.start.toFixed(1)}s – ${s.end.toFixed(1)}s · ${s.title}\n\n| In | Out | Secs | Words | Line |\n|---|---|---|---|---|\n`;
  for (const c of vo.cues.filter((c) => c.start >= s.start && c.start < s.end)) {
    const words = c.text.split(/\s+/).length;
    md += `| ${c.start.toFixed(1)} | ${c.end.toFixed(1)} | ${(c.end - c.start).toFixed(1)} | ${words} | ${c.text} |\n`;
  }
  md += "\n";
}
writeFileSync(path.join(root, "VOICEOVER.md"), md);
console.log("wrote out/nvidia-explainer.srt, out/nvidia-explainer.vtt, VOICEOVER.md");
