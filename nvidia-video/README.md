# NVIDIA investment explainer: Remotion video

A 60-second vertical explainer (1080 × 1920, 30 fps, 1,800 frames) built entirely from code:
React + TypeScript motion graphics. There's no stock footage, so every visual and number is reproducible.

> Read **VERIFICATION.md** before publishing. Several supplied statistics still need a primary source.

## Commands

```bash
npm install
npm run studio                 # Remotion Studio: live, scrubbable preview at http://localhost:3000
npm run preview:stills         # QA stills at key beats + out/contact-sheet.jpg
node scripts/export-captions.mjs   # out/*.srt, out/*.vtt, VOICEOVER.md (timed VO script)
npm run render                 # final out/nvidia-explainer.mp4 (H.264, CRF 18)
./scripts/make-music-placeholder.sh  # regenerate the placeholder music bed
```

If Chrome Headless Shell can't be downloaded (sandboxed CI), point Remotion at a local copy:
`REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run render`.

## Timeline

| Time | Scene | File |
|---|---|---|
| 0–8 s | AI in everyday life, then the 80-year-old retiree | `src/scenes/S1Intro.tsx` |
| 8–15 s | Why AI needs GPUs (CPU vs GPU parallelism) | `S2Gpu.tsx` |
| 15–21 s | GPU chip → camera dives into an AI data-center hall | `S3DataCenter.tsx` |
| 21–29 s | Revenue chart $68.1B → $81.6B → $96.2B (zero-based axis) | `S4Revenue.tsx` |
| 29–36 s | Partnership network → earnings catalyst | `S5Partners.tsx` |
| 36–43 s | Scenario price $218 → $235.44 (+8%) | `S6Price.tsx` |
| 43–53.5 s | Split-screen reveal: $25k / 572 sh vs $50k / 1,720 sh | `S7Split.tsx` |
| 53.5–60 s | Assumptions, downside, disclaimer, end card | `S8Disclaimer.tsx` |

Scenes cross-dissolve over 14 frames (blur + scale). A chapter rail, burned-in subtitles,
animated film grain and a vignette sit on top of every scene (`src/Video.tsx`).

## Where to edit

- **Figures:** `src/data/content.ts`. This is the single edit point. Derived values (leverage, profit, % moves) are
  computed there, and the build throws an error if they stop matching the supplied totals.
- **Voiceover, subtitles and scene timing:** `src/data/voiceover.json`. Scene boundaries, VO cue windows,
  and subtitle text all come from this one file. Animation beats that must hit a spoken word
  live in `beats` in `src/data/timeline.ts` (absolute seconds).
- **Audio:** four layers, all placed from the same timeline:
  - **Narration** (`public/audio/voiceover.wav`). Generated with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx),
    an open-weight TTS model (Apache-2.0), voice `af_heart`. To regenerate after editing a line's `say` text:
    put `kokoro-v1.0.onnx` + `voices-v1.0.bin` (from the kokoro-onnx `model-files-v1.0` release) in
    `models/kokoro/`, `pip install kokoro-onnx soundfile numpy`, then `npm run voiceover && npm run captions`.
    The script fits each scene's lines into the scene, rewrites the cue timings, and the subtitles and animation
    beats follow automatically. To use a human voice actor instead, record to the timings in `VOICEOVER.md`
    and replace `voiceover.wav`.
  - **Music bed** (`music-placeholder.mp3`). A generated **placeholder**. Swap in a licensed track with the
    same filename. It ducks automatically under every spoken line.
  - **SFX:** `whoosh.wav` on every scene transition, `impact.wav` on the three big reveals (both generated).
- **Brand:** `src/theme.ts` (NVIDIA green `#76B900`, black, charcoal, white; Inter / Inter Tight /
  JetBrains Mono bundled in `public/fonts`).

The video uses the NVDA ticker and the NVIDIA name only as text. It contains no NVIDIA logos or trademarks as artwork.
