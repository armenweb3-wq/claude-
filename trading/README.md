# The Weekly 5-Asset Risk Cycle

A printable risk-management and position-sizing plan for a five-asset weekly
cycle: **XAUUSD** (gold), **WTIUSD** (oil), **XAGUSD** (silver), **BTCUSD**
(bitcoin) and **DJIUSD** (Dow Jones 30), at 1% risk per asset and a 1:3 to 1:5
reward-to-risk floor, margined at 100:1 on everything except bitcoin at 5:1.

- `Weekly-5-Asset-Risk-Cycle.pdf` — the document (13 pages, A4).
- `generate_risk_plan.py` — the ReportLab script that builds it.

## Rebuilding

```bash
pip install reportlab
python3 trading/generate_risk_plan.py
```

Output is written to `trading/Weekly-5-Asset-Risk-Cycle.pdf`.

## Notes for editing

- All numeric tables (expectancy, break-even win rate, drawdown, position
  sizing) are **computed in the script**, not typed in — change the inputs at
  the top of each block rather than editing figures by hand.
- Only WinAnsi-safe glyphs are used so the built-in Helvetica family renders
  everything. No arrows, no unicode sub/superscripts (they render as black
  boxes in ReportLab's base-14 fonts).
- The cover uses its own `PageTemplate`; the switch to the content template
  happens via `NextPageTemplate("content")` before the first `PageBreak`.
- Contract values in Section 03 are *typical* CFD specifications. They vary by
  broker — especially silver and the Dow — which is why the table carries a
  blank "your broker" column.
- Leverage is per-asset and set in two places: the `spec_rows` table in Section
  03 and the `lev_rows` / `work` tables that feed Section 04. Changing a
  leverage figure means changing it in both. Margin throughout is derived from
  `margin % of equity = 100 / (stop % of price x leverage)` for a position
  already sized to risk 1%.

This is an educational risk framework, not financial advice.

---

## Simple-Plan-2M.pdf

A four-page worked example on a $2,000,000 balance at 1% ($20,000) risk per
trade, built by `generate_simple_plan.py`. Two scenarios — a week with two
stop-outs and three winners (+9R), and a week where stops are moved to entry so
four trades scratch and one runs to 1:5 (+5R) — plus monthly totals, a
twelve-month compounded table, and growth charts.

```bash
python3 trading/generate_simple_plan.py
```

Inputs live at the top of the script (`BALANCE`, `RISK_PCT`, `WEEK_A`,
`WEEK_B`, `WEEKS_PER_MONTH`); everything else is derived, including the charts.

---

## Trade-Boxes.pdf

One box: five assets, one row each, one cycle per sheet (landscape A4).

```bash
python3 trading/generate_trade_boxes.py
```

Add a trade to the `TRADES` dict at the top of the script and re-run. Any
field you omit prints blank; any asset you omit leaves the whole row blank.
Risk, R:R and both result columns are computed from entry/stop/volume/target
and the `closed` price — never typed in. 1R is 1% of `FREE_MARGIN`.

---

## card/trader-tok-card.png

A shareable TraderTok performance card (1080x1350, rendered at 2x), built by
`generate_card.py` via headless Chromium.

```bash
pip install playwright segno     # chromium is already on the image
python3 trading/generate_card.py
```

Brand assets:

- `tradertok-logo.png` — the real lockup, lifted from tradertok.com and keyed
  to transparency. Brand red is `#BF3C35`, sampled from the same source.
- `qr-tradertok.png` — a real QR for `https://tradertok.com` (segno, error
  level Q). It decodes off the finished card down to 540px wide, so it still
  scans after a messaging app recompresses it. Regenerate it if the URL
  changes; don't scale the card below about a third or the modules break down.

The trade lives in the `TRADE` dict. Leave `closed` as `None` and the card
shows the position as it stands — risk:reward as the hero, levels, and the
money at target. Set `closed` to the exit price and it becomes a PnL card:
realised profit/loss, R multiple, and ROI on margin, with a marker on the
ladder where the trade closed. `TAKEN` drives the cycle strip
(`open` / `win` / `loss` per asset).

`generate_card.py` also writes the `.html` it screenshotted, so the layout can
be tweaked in a browser before re-rendering.
