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
