#!/usr/bin/env python3
"""
Renders a shareable Trader Tok performance card (PNG) for a trade.

If the trade has a `closed` price the card shows realised PnL and ROI.
Without one it shows the position as it stands - entry, levels, risk and
reward - rather than inventing a result.

Usage:  python3 trading/generate_card.py
Output: trading/card/trader-tok-card.png  (+ the .html it was rendered from)
"""

import math
import random
from datetime import date
from pathlib import Path

from playwright.sync_api import sync_playwright

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BRAND = "#BF3C35"          # sampled from tradertok.com
BRAND_HI = "#E24A3F"
OUTDIR = Path("trading/card")
W, H = 1080, 1350

HANDLE = "tradertok.com"

FREE_MARGIN = 245_000.0
ONE_R = FREE_MARGIN * 0.01

TRADE = dict(
    asset="WTIUSD", name="CRUDE OIL", side="LONG", leverage=100,
    value_per_lot=1000.0,
    entry=88.41, volume=2.8, margin=2475.0,
    stop=87.56, target=91.20,
    moved_to_entry=True,
    closed=None,                       # set a price here to make it a PnL card
    opened="1 Sep 2026",
)

# ------------------------------------------------------------------ derive --
def derive(t):
    d = dict(t)
    sgn = 1 if t["side"] == "LONG" else -1
    d["stop_dist"] = abs(t["entry"] - t["stop"])
    d["tp_dist"] = abs(t["target"] - t["entry"])
    d["risk"] = d["stop_dist"] * t["volume"] * t["value_per_lot"]
    d["reward"] = d["tp_dist"] * t["volume"] * t["value_per_lot"]
    d["rr"] = d["tp_dist"] / d["stop_dist"]
    d["notional"] = t["volume"] * t["value_per_lot"] * t["entry"]
    if t.get("closed") is not None:
        d["pnl"] = (t["closed"] - t["entry"]) * t["volume"] * t["value_per_lot"] * sgn
        d["pnl_r"] = d["pnl"] / d["risk"]
        d["roi"] = d["pnl"] / t["margin"] * 100.0
    else:
        d["pnl"] = d["pnl_r"] = d["roi"] = None
    return d


T = derive(TRADE)


def usd(v, sign=False, dp=0):
    s = ("${:,.%df}" % dp).format(abs(v))
    if v < 0:
        return "-" + s
    return ("+" + s) if (sign and round(v, dp)) else s


# ------------------------------------------------- faded candle background --
def candles(n=46, width=W, height=560, seed=7):
    """A deterministic random walk drawn as candlesticks, for the backdrop."""
    rnd = random.Random(seed)
    px, series = 100.0, []
    for i in range(n):
        drift = 0.55 + 1.5 * math.sin(i / 7.0)
        o = px
        c = o + rnd.uniform(-3.4, 3.4) + drift * 0.42
        hi = max(o, c) + rnd.uniform(0.2, 2.1)
        lo = min(o, c) - rnd.uniform(0.2, 2.1)
        series.append((o, hi, lo, c))
        px = c
    los = min(s[2] for s in series)
    his = max(s[1] for s in series)
    span = his - los or 1.0

    step = width / float(n)
    body = step * 0.54
    def y(v):
        return height - (v - los) / span * (height - 40) - 20

    parts = []
    for i, (o, hi, lo, c) in enumerate(series):
        x = i * step + step / 2.0
        up = c >= o
        col = "#14B87D" if up else "#BF3C35"
        parts.append(
            '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
            'stroke-width="2.2"/>' % (x, y(hi), x, y(lo), col))
        top, bot = y(max(o, c)), y(min(o, c))
        parts.append(
            '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" '
            'rx="1.5"/>' % (x - body / 2.0, top, body, max(bot - top, 2.5), col))
    return ('<svg viewBox="0 0 %d %d" width="%d" height="%d" '
            'preserveAspectRatio="none">%s</svg>'
            % (width, height, width, height, "".join(parts)))


LOGO = '<img class="mark" src="tradertok-logo.png">'


# ------------------------------------------------------------------- build --
closed = T["closed"] is not None
if closed:
    pos = T["pnl"] >= 0
    hero_col = "#14B87D" if pos else "#E24A3F"
    hero = "%+.2f%%" % T["roi"]
    hero_label = "ROI ON MARGIN"
    sub = ('<span class="pnl %s">%s</span><span class="pnl-r">%+.2fR</span>'
           % ("up" if pos else "dn", usd(T["pnl"], sign=True), T["pnl_r"]))
    badge = "CLOSED"
    badge_cls = "closed"
else:
    hero_col = "#F2F3F5"
    hero = "1 : %.2f" % T["rr"]
    hero_label = "RISK : REWARD"
    sub = ('<span class="pnl up">%s</span><span class="pnl-r">at target</span>'
           % usd(T["reward"], sign=True))
    badge = "OPEN"
    badge_cls = "open"

CYCLE = ["XAUUSD", "WTIUSD", "XAGUSD", "BTCUSD", "DJIUSD"]
TAKEN = {"WTIUSD": "open"}          # asset -> open | win | loss
_chip = {"open": "chip live", "win": "chip win", "loss": "chip loss"}
cycle_html = (
    '<div class="cycle"><div class="clabel">THIS CYCLE</div><div class="chips">'
    + "".join('<div class="%s">%s</div>'
              % (_chip.get(TAKEN.get(a), "chip idle"), a[:3])
              for a in CYCLE)
    + '</div></div>')

lo, hi = min(T["stop"], T["target"]), max(T["stop"], T["target"])
span = hi - lo
risk_pct = T["stop_dist"] / span * 100.0
entry_pct = (T["entry"] - lo) / span * 100.0
mark_pct = ((T["closed"] - lo) / span * 100.0) if closed else None

ladder = """
<div class="ladder">
  <div class="track">
    <div class="seg risk" style="left:0; width:{RW:.2f}%"></div>
    <div class="seg rew"  style="left:{RW:.2f}%; width:{GW:.2f}%"></div>
    <div class="tick" style="left:{EP:.2f}%"></div>
    {MARK}
  </div>
  <div class="lbls">
    <div class="l"><b>{STOP:.2f}</b><span>STOP</span></div>
    <div class="l c" style="left:{EP:.2f}%"><b>{ENTRY:.2f}</b><span>ENTRY</span></div>
    <div class="l r"><b>{TGT:.2f}</b><span>TARGET</span></div>
  </div>
</div>""".format(
    RW=risk_pct, GW=100.0 - risk_pct, EP=entry_pct,
    STOP=T["stop"], ENTRY=T["entry"], TGT=T["target"],
    MARK=('<div class="closemark" style="left:%.2f%%"></div>' % mark_pct)
         if closed else "")

stats = [
    ("ENTRY", "%.2f" % T["entry"], ""),
    ("STOP LOSS", "%.2f" % T["stop"], "at entry" if T["moved_to_entry"] else ""),
    ("TAKE PROFIT", "%.2f" % T["target"], ""),
    ("VOLUME", "%g lots" % T["volume"], usd(T["margin"]) + " margin"),
    ("RISK", usd(T["risk"]), "1% of free margin"),
    ("CLOSED AT", "%.2f" % T["closed"] if closed else "--", ""),
]
stat_html = "".join(
    '<div class="stat"><div class="k">%s</div><div class="v">%s</div>'
    '<div class="s">%s</div></div>' % (k, v, s or "&nbsp;") for k, v, s in stats)

HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{W}px; height:{H}px; background:#060607; overflow:hidden;
        font-family:"Liberation Sans","DejaVu Sans",sans-serif;
        -webkit-font-smoothing:antialiased; }}
.card {{ position:relative; width:{W}px; height:{H}px;
  background:
    radial-gradient(1150px 640px at 80% -8%, rgba(191,60,53,.30), transparent 63%),
    radial-gradient(900px 720px at 4% 106%, rgba(191,60,53,.13), transparent 62%),
    linear-gradient(168deg,#131011 0%,#0B0A0B 46%,#060607 100%);
  overflow:hidden; }}
.grid {{ position:absolute; inset:0;
  background-image:linear-gradient(rgba(255,255,255,.030) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.030) 1px,transparent 1px);
  background-size:60px 60px; }}
.candles {{ position:absolute; left:0; right:0; bottom:236px; height:600px;
  opacity:.17; filter:blur(.4px);
  -webkit-mask-image:linear-gradient(to top,#000 8%,rgba(0,0,0,.55) 55%,transparent 96%); }}
.glow {{ position:absolute; left:50%; top:512px; transform:translateX(-50%);
  width:760px; height:300px; border-radius:50%;
  background:radial-gradient(ellipse at center,{HG} 0%,transparent 68%);
  opacity:.10; filter:blur(28px); }}
.inner {{ position:relative; padding:64px 66px 56px; height:100%;
  display:flex; flex-direction:column; }}

.top {{ display:flex; align-items:flex-start; justify-content:space-between; }}
.brand {{ display:flex; flex-direction:column; gap:14px; }}
.mark {{ width:322px; height:auto; display:block; }}
.tag {{ font-size:11.5px; letter-spacing:6.2px; color:#6E7480; font-weight:700;
  padding-left:3px; }}
.qr {{ background:#fff; padding:9px; border-radius:14px; line-height:0;
  box-shadow:0 0 0 1.5px rgba(191,60,53,.55), 0 10px 40px rgba(0,0,0,.6); }}
.qr img {{ width:126px; height:126px; display:block; border-radius:5px; }}
.badge.open {{ color:#E24A3F; background:rgba(191,60,53,.14);
  border-color:rgba(226,74,63,.45); }}
.badge.closed {{ color:#14B87D; background:rgba(20,184,125,.12);
  border-color:rgba(20,184,125,.42); }}

.rule {{ height:1px; margin:40px 0 44px;
  background:linear-gradient(90deg,rgba(191,60,53,.85),rgba(255,255,255,.07) 58%,transparent); }}

.pair {{ display:flex; align-items:baseline; gap:20px; flex-wrap:wrap; }}
.sym {{ font-size:54px; font-weight:700; color:#fff; letter-spacing:-.5px; }}
.name {{ font-size:15px; letter-spacing:3.4px; color:#77869C; font-weight:700; }}
.pills {{ display:flex; gap:11px; margin-top:20px; }}
.pill {{ font-size:13px; font-weight:700; letter-spacing:1.9px; padding:8px 15px;
  border-radius:8px; color:#AFBDCE; background:rgba(255,255,255,.055);
  border:1px solid rgba(255,255,255,.09); }}
.pill.side {{ color:#14B87D; background:rgba(20,184,125,.12);
  border-color:rgba(20,184,125,.30); }}
.pill.badge {{ font-size:13px; }}

.hero {{ margin-top:52px; }}
.hlabel {{ font-size:12.5px; letter-spacing:4.6px; color:#6B7A90; font-weight:700; }}
.hval {{ font-size:132px; line-height:1.02; font-weight:700; color:{HG};
  letter-spacing:-3px; margin-top:12px; }}
.hsub {{ margin-top:20px; display:flex; align-items:baseline; gap:18px; }}
.pnl {{ font-size:42px; font-weight:700; letter-spacing:-.6px; }}
.pnl.up {{ color:#14B87D; }} .pnl.dn {{ color:#E24A3F; }}
.pnl-r {{ font-size:19px; color:#8695AB; font-weight:700; letter-spacing:1.2px; }}

.cycle {{ margin-top:auto; }}
.clabel {{ font-size:11.5px; letter-spacing:4.2px; color:#5E6D83; font-weight:700; }}
.chips {{ display:flex; gap:13px; margin-top:18px; }}
.chip {{ flex:1; text-align:center; padding:19px 0 17px; border-radius:13px;
  font-size:21px; font-weight:700; letter-spacing:2.4px;
  color:#3E4A5C; background:rgba(255,255,255,.035);
  border:1.5px solid rgba(255,255,255,.055); }}
.chip.live {{ color:#fff; background:linear-gradient(160deg,#D6473E,#A8322C);
  border-color:#E24A3F; box-shadow:0 0 34px rgba(226,74,63,.34); }}
.chip.win {{ color:#14B87D; background:rgba(20,184,125,.13);
  border-color:rgba(20,184,125,.42); }}
.chip.loss {{ color:#E24A3F; background:rgba(191,60,53,.13);
  border-color:rgba(226,74,63,.40); }}
.ladder {{ margin-top:58px; margin-bottom:0; }}
.track {{ position:relative; height:12px; border-radius:999px;
  background:rgba(255,255,255,.07); overflow:visible; }}
.seg {{ position:absolute; top:0; height:12px; }}
.seg.risk {{ background:linear-gradient(90deg,rgba(191,60,53,.35),rgba(226,74,63,.95));
  border-radius:999px 0 0 999px; }}
.seg.rew {{ background:linear-gradient(90deg,rgba(20,184,125,.85),rgba(20,184,125,.35));
  border-radius:0 999px 999px 0; }}
.tick {{ position:absolute; top:-9px; width:3px; height:30px; background:#EDF1F6;
  border-radius:2px; transform:translateX(-50%); box-shadow:0 0 14px rgba(255,255,255,.5); }}
.closemark {{ position:absolute; top:-15px; width:22px; height:42px;
  border:3px solid #E24A3F; border-radius:8px; transform:translateX(-50%);
  box-shadow:0 0 20px rgba(226,74,63,.6); }}
.lbls {{ position:relative; height:52px; margin-top:20px; }}
.l {{ position:absolute; }}
.l b {{ display:block; font-size:23px; font-weight:700; color:#EDF1F6; }}
.l span {{ display:block; font-size:10.5px; letter-spacing:2.6px; color:#67768C;
  font-weight:700; margin-top:5px; }}
.l.c {{ transform:translateX(-50%); text-align:center; }}
.l.r {{ right:0; text-align:right; }}
.stats {{ margin-top:56px; display:grid; grid-template-columns:repeat(3,1fr);
  gap:1px; background:rgba(255,255,255,.075);
  border:1px solid rgba(255,255,255,.075); border-radius:16px; overflow:hidden; }}
.stat {{ background:rgba(10,14,20,.72); padding:22px 24px 20px; }}
.k {{ font-size:11px; letter-spacing:2.6px; color:#67768C; font-weight:700; }}
.v {{ font-size:29px; font-weight:700; color:#EDF1F6; margin-top:9px;
      letter-spacing:-.3px; }}
.s {{ font-size:12px; color:#6E7D93; margin-top:5px; letter-spacing:.4px; }}

.foot {{ margin-top:30px; display:flex; align-items:center;
  justify-content:space-between; }}
.handle {{ font-size:17px; font-weight:700; color:#C9CDD4; letter-spacing:2.2px; }}
.date {{ font-size:13px; color:#5E6D83; letter-spacing:2px; font-weight:700; }}
</style></head><body>
<div class="card">
  <div class="grid"></div>
  <div class="candles">{CANDLES}</div>
  <div class="glow"></div>
  <div class="inner">
    <div class="top">
      <div class="brand">{LOGO}<div class="tag">PERFORMANCE</div></div>
      <div class="qr"><img src="qr-tradertok.png"></div>
    </div>
    <div class="rule"></div>
    <div class="pair"><div class="sym">{SYM}</div><div class="name">{NAME}</div></div>
    <div class="pills">
      <div class="pill side">{SIDE}</div>
      <div class="pill">{LEV}x</div>
      <div class="pill">1% RISK</div>
      <div class="pill badge {BADGE_CLS}">{BADGE}</div>
    </div>
    <div class="hero">
      <div class="hlabel">{HLABEL}</div>
      <div class="hval">{HERO}</div>
      <div class="hsub">{SUB}</div>
    </div>
    {CYCLE}
    {LADDER}
    <div class="stats">{STATS}</div>
    <div class="foot"><div class="handle">{HANDLE}</div>
      <div class="date">{DATE}</div></div>
  </div>
</div></body></html>""".format(
    W=W, H=H, HG=hero_col, CANDLES=candles(), LOGO=LOGO,
    BADGE=badge, BADGE_CLS=badge_cls,
    SYM=TRADE["asset"], NAME=TRADE["name"], SIDE=TRADE["side"],
    LEV=TRADE["leverage"], HLABEL=hero_label, HERO=hero, SUB=sub,
    CYCLE=cycle_html, LADDER=ladder, STATS=stat_html, HANDLE=HANDLE,
    DATE=(TRADE.get("opened") or date.today().strftime("%-d %b %Y")).upper())

OUTDIR.mkdir(parents=True, exist_ok=True)
html_path = OUTDIR / "trader-tok-card.html"
png_path = OUTDIR / "trader-tok-card.png"
html_path.write_text(HTML, encoding="utf-8")

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    pg = br.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    pg.goto(html_path.resolve().as_uri())
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(png_path))
    br.close()

print("wrote %s (%dx%d @2x)" % (png_path, W, H))
