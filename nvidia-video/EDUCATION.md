# Client education series: 3 films (1920×1080)

| Composition | Session | Length | Topics |
|---|---|---|---|
| `Edu1-AccountBasics` | 1 · Account basics & costs | ~5:47 | Balance, balance vs. equity, P&L (floating/realized), margin, free margin & margin level, leverage, swaps, recap |
| `Edu2-OrdersMarketTypes` | 2 · Orders & market types | ~4:14 | Market orders (bid/ask/spread), stop loss, stop placement & position sizing, take profit & risk:reward, the four pending orders, planning an order, recap |
| `Edu3-AdvancedStrategies` | 3 · Advanced strategies | ~4:09 | Hedging (concept, locked-loss example, partial & related-market hedges, benefits/limits), averaging (down, up, risk rules), course complete |

**Render:** `npm run render:education` → `out/Edu1-AccountBasics.mp4`, `out/Edu2-…`, `out/Edu3-…` (audio mastered to −14 LUFS).
**Subtitles:** `out/education-session{1,2,3}.srt|.vtt`. **Timed scripts:** `VOICEOVER-education-session{1,2,3}.md`.

## How it's built
- Narration scripts: `src/data/voiceover-edu{1,2,3}.json`. The `text` field is the subtitle; `say` is what the voice reads,
  with numbers spelled out. Edit a line, then run `npm run voiceover:education`. Scene lengths and every animation cue follow the new timing.
- Scenes: `src/edu/session{1,2,3}.tsx`. Shared look: `src/edu/kit.tsx` (light academy theme, colour-coded:
  green = profit, red = loss, amber = margin, violet = leverage), including the price-chart engine.
- Voice: Kokoro (Apache-2.0) `af_heart` at 0.95×, with pauses between lines. Music: original scores from
  `scripts/compose-music.py`, a different key and tempo per session, ducked under the voice.

## Worked examples (all consistent across the series)
- Account: deposit $10,000 → closed trade +$500 → balance $10,500; open trade −$300 → equity $10,200.
- EUR/USD at 1.1000, 1 standard lot = 100,000 units ≈ $110,000; at 1:100, margin = $1,100; free margin = $9,100.
- 1 pip on EUR/USD ≈ $10 per standard lot. Stop 50 pips = $500 on 1 lot; risking 1% of $10,000 with a 50-pip stop = 0.2 lots.
- Swap example: 1 lot × (−7 points) × $1/point = −$7 per night; triple once a week → about −$49 per week.
- Hedge: long 1 lot from 1.1000, short 1 lot at 1.0950 → net locked at about −$500 (before spread and swaps).
- Averaging down: 1.1000 + 1.0950 → average 1.0975, $20/pip on 2 lots. Averaging up: 1.1000 + 1.1050 → average 1.1025.

## Things to align with your firm before publishing
- **Margin call / stop-out levels** are shown as examples (100% / 50%). Replace them with your actual account terms.
- **Swap rates** (−7.0 / +1.5 points) are illustrative. The triple-swap day is "often Wednesday" for FX and varies by instrument.
- **Leverage** 1:100 is an example. Retail limits differ by regulator (e.g. 1:30 on major FX under ESMA/FCA rules).
- **Hedging availability:** the film notes that some brokers and regions don't allow it (e.g. US FIFO rules).
- **Risk warning:** the final frame of Session 3 and a small "Educational content" tag carry a generic risk notice.
  Replace them with your regulator-approved wording if needed.
- No broker name or logo is used. Add your branding in `src/edu/kit.tsx` (`TopBar`) and `shared.tsx` (`CourseTitle`).
