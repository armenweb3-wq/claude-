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
the strictest common rules (EU/ESMA national measures, CySEC, UK FCA), but only
the broker can make it compliant. Have compliance sign off the final render,
the landing page and the post text.

**Fill in (config.js)**

- `legal.lossPercent`: the broker's own current figure. Never publish an
  invented one. Brokers without 12 months of data use their regulator's
  standard no-data wording instead (edit `riskShort` / `riskFull`).
- `legal.entity`: replace `[LEGAL ENTITY]`, `[REGULATOR]`, `[NUMBER]` and
  `[EXCLUDED COUNTRIES]` with the entity that actually onboards the viewers
  being targeted.
- Brand name, URL and colours. Re-check the end card after changing them.

**Check the warning wording.** The risk-warning text is the EU/UK standard
wording as found through search extracts and secondary summaries; the
regulators' own pages could not be opened while this was built. Proof-read it
against the live rule for your regulator (for the UK, FCA COBS 22.5) before
publishing. The abbreviated version runs for 50 s and the full version for the
last 10 s; if your regulator expects the full version throughout, put the full
text in `riskShort`. The full warning must also appear in the post text and on
the landing page. `legal.bandTheme: 'light'` gives the band a light placard
style if your compliance team wants it more prominent still.

**Confirm every claim is true of the platform**

- Prices, spread, stop and limit levels are visible before an order is placed,
  and a depth ladder like the one shown exists (many CFD platforms have none).
- Spreads are variable ("SPREADS VARY WITH MARKET CONDITIONS." is wrong for
  fixed-spread accounts), and the illustrative EUR/USD spread shown (1.2 pips)
  is not tighter than the typical one.
- Every order has a requested price, fill price and UTC timestamp on record.
- "A stop can limit a loss. It is not a guarantee." matches the execution
  policy (adjust if guaranteed stops are offered).
- "No one can predict the next price. Not you. Not us." does not sit beside
  signals, forecasts or trade ideas marketed by the same brand.
- The order route diagram does not imply external routing if the firm is the
  counterparty.
- A demo account with virtual funds is available at the URL, minimum size 0.01.
- The market trades 24 hours a day, five days a week; so does the platform.

**Where it can run**

- Google/YouTube requires per-country certification for CFD / rolling spot
  forex advertisers. Meta lists CFD trading among prohibited products and
  TikTok allows it only in a few markets: get each platform's position for
  your licence before spending on placements.
- Exclude the United States and any country where the broker is not licensed
  or CFD advertising to the public is restricted (for example Spain, France,
  Belgium). Australia needs its own risk statement plus PDS and target-market
  references. Do not target minors.
- On a phone held upright, use the 9:16 or 4:5 file: the 16:9 file's warning
  becomes very small there.

Mock prices and screens are labelled "illustrative" and nothing in the film
shows a profit, a balance or a winning trade.

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
node tools/qc.mjs out/forex-ad-16x9.mp4           # flicker, off-beat jumps, loudness
```

Open `src/index.html?format=9x16` through any static server for a live preview
with a scrubber (add `&safe=1` to see the safe area).

Fonts (Barlow Condensed, IBM Plex Sans Condensed, JetBrains Mono) are bundled
under the SIL Open Font License; GSAP is bundled under its standard licence.
