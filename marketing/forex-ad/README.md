# Forex broker ad — "Precision, not prediction" (60 s)

A 60-second motion-graphics advertisement rendered entirely from code. One
timeline produces three deliverables:

| File | Size | For |
| --- | --- | --- |
| `out/forex-ad-16x9.mp4` | 1920x1080 | YouTube in-stream, web, X and LinkedIn landscape |
| `out/forex-ad-9x16.mp4` | 1080x1920 | Reels, TikTok, Shorts, Stories |
| `out/forex-ad-4x5.mp4` | 1080x1350 | Facebook / Instagram / LinkedIn feed |

All are H.264 High + AAC, 30 fps, exactly 60.0 s, fast-start MP4.

## Make it yours

Everything brand-specific lives in **`config.js`**: name, URL, promise, call to
action, colours (`accent` re-skins the whole spot) and the legal text. Edit it,
then re-render:

```bash
node tools/audio.mjs          # music bed -> out/audio.wav (only needed once)
node tools/render.mjs         # all three formats
node tools/render.mjs --format 9x16
```

The renderer prints a `DRAFT RENDER` warning for as long as placeholders remain.

Needs Node 18+, `ffmpeg`, and Playwright with Chromium (`npm i -g playwright &&
npx playwright install chromium`).

## Before this runs anywhere

This is a financial promotion for a leveraged product. The template is built to
the strictest common rules (EU/ESMA, CySEC, UK FCA), but only the broker can
make it compliant:

- **Loss percentage.** `legal.lossPercent` must be the broker's own current
  figure. The warning wording in `config.js` is the EU/UK standard text; use the
  wording your regulator prescribes if it differs.
- **Legal entity line.** Replace `[LEGAL ENTITY]`, `[REGULATOR]`, `[NUMBER]` and
  `[EXCLUDED COUNTRIES]` with the entity that actually onboards the viewers you
  target.
- **Claims.** The copy says prices, spread, stop and limit levels are visible
  before trading and that every order has a requested price, fill price and
  timestamp on record. Confirm each is true of the platform.
- **Sign-off.** Have compliance approve the final render, landing page and post
  text. Mock prices and screens are labelled "illustrative"; nothing shows a
  profit.
- **Platform policy.** Google/YouTube requires certification for CFD / rolling
  spot forex advertisers and only allows certain countries. Meta lists CFD
  trading among prohibited products, and TikTok allows it only in a few markets:
  get each platform's position for your licence before spending on assets.
- **Targeting.** Exclude the United States and any country where the broker is
  not licensed or CFD advertising is banned (for example Spain, Belgium).

## How it works

- `src/engine.js` makes the film a pure function of time: `AD.seek(t)` draws the
  frame at `t` seconds. `tools/render.mjs` seeks every frame in headless
  Chromium, screenshots it and encodes with ffmpeg.
- `src/timeline.js` lists the scenes and cut points (120 BPM: a beat is 0.5 s).
- `src/scenes/*.js` are the scenes; `src/kit.js` and `src/styles/base.css` hold
  the shared components and design tokens.
- `tools/audio.mjs` synthesizes the music; no samples or licensed audio.

Useful while editing:

```bash
node tools/stills.mjs --every 2 --format 16x9     # contact sheets in out/stills
node tools/stills.mjs --scene demo --count 8      # one scene
node tools/check.mjs                              # frames identical in any seek order
```

Open `src/index.html?format=9x16` through any static server for a live preview
with a scrubber (add `&safe=1` to see the safe area).

Fonts (Barlow Condensed, IBM Plex Sans Condensed, JetBrains Mono) are bundled
under the SIL Open Font License; GSAP is bundled under its standard licence.
