#!/usr/bin/env python3
"""
Renders a shareable TraderTok performance card (PNG).

With a `closed` price the card reports the realised result. Without one it
reports the position as it stands - levels, risk:reward and the money at
target - rather than inventing an outcome.

Usage:  python3 trading/generate_card.py
Output: trading/card/trader-tok-card.png  (+ the .html it was rendered from)
"""

import math
import random
from pathlib import Path

from playwright.sync_api import sync_playwright

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
OUTDIR = Path("trading/card")
W, H = 1080, 1350

TAGLINE = "Grow Your Trading. Share Your Success."
QR_CAPTION = "Scan to visit"

FREE_MARGIN = 245_000.0

TRADE = dict(
    asset="WTIUSD", headline="OIL TODAY", name="CRUDE OIL",
    side="LONG", leverage=100, value_per_lot=1000.0,
    entry=88.41, volume=2.8, margin=2475.0,
    stop=87.56, target=91.20, moved_to_entry=True,
    closed=None,                     # set the exit price to make it a result card
    date="1 SEP 2026", time="—",
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
    if t.get("closed") is not None:
        d["move"] = (t["closed"] - t["entry"]) * sgn
        d["pnl"] = d["move"] * t["volume"] * t["value_per_lot"]
        d["pnl_r"] = d["pnl"] / d["risk"]
        d["roi"] = d["pnl"] / t["margin"] * 100.0
    else:
        d["move"] = d["pnl"] = d["pnl_r"] = d["roi"] = None
    return d


T = derive(TRADE)
CLOSED = T["closed"] is not None


def usd(v, sign=False, dp=0):
    s = ("${:,.%df}" % dp).format(abs(v))
    if v < 0:
        return "-" + s
    return ("+" + s) if (sign and round(v, dp)) else s


# ------------------------------------------------------------------ artwork -
def candles(n=40, width=1080, height=430, seed=11):
    """Seeded random walk drawn as candles - decoration, not a price history."""
    rnd = random.Random(seed)
    px, series = 100.0, []
    for i in range(n):
        o = px
        c = o + rnd.uniform(-2.6, 2.6) + 1.15 + 0.8 * math.sin(i / 5.5)
        hi = max(o, c) + rnd.uniform(.2, 1.7)
        lo = min(o, c) - rnd.uniform(.2, 1.7)
        series.append((o, hi, lo, c)); px = c
    los = min(s[2] for s in series); his = max(s[1] for s in series)
    span = (his - los) or 1.0
    step = width / float(n); body = step * .5
    def y(v): return height - (v - los) / span * (height - 46) - 24

    out, line = [], []
    for i, (o, hi, lo, c) in enumerate(series):
        x = i * step + step / 2.0
        col = "#4ADE80" if c >= o else "#F0574B"
        out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                   'stroke-width="2"/>' % (x, y(hi), x, y(lo), col))
        top, bot = y(max(o, c)), y(min(o, c))
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" '
                   'rx="1.5"/>' % (x - body / 2, top, body, max(bot - top, 2.4), col))
        line.append("%.1f,%.1f" % (x, y(c)))
    out.append('<polyline points="%s" fill="none" stroke="#4ADE80" '
               'stroke-width="2.6" opacity=".55" stroke-linejoin="round"/>'
               % " ".join(line))
    return ('<svg viewBox="0 0 %d %d" width="%d" height="%d" '
            'preserveAspectRatio="none">%s</svg>'
            % (width, height, width, height, "".join(out)))


PUMPJACK = """
<svg viewBox="0 0 440 320" width="440" height="320" fill="#8FA2BC">
  <rect x="52" y="279" width="336" height="12" rx="3"/>
  <path d="M196 279 L214 128 L232 128 L250 279 L236 279 L223 152 L210 279 Z"/>
  <rect x="196" y="205" width="54" height="8" rx="3" transform="rotate(-3 223 209)"/>
  <path d="M104 121 L322 146 L322 168 L104 143 Z"/>
  <path d="M104 118 C72 126 58 156 62 192 L96 197 C92 163 100 138 118 128 Z"/>
  <rect x="72" y="192" width="12" height="88" rx="4"/>
  <rect x="58" y="272" width="42" height="10" rx="4"/>
  <circle cx="322" cy="216" r="46"/>
  <rect x="313" y="152" width="18" height="72" rx="7"/>
  <rect x="296" y="258" width="52" height="24" rx="6"/>
  <path d="M356 279 L372 196 L388 279 Z" opacity=".8"/>
  <rect x="150" y="240" width="8" height="40" rx="3" opacity=".7"/>
  <rect x="288" y="240" width="8" height="40" rx="3" opacity=".7"/>
</svg>"""


def ring(glyph, tone="mute"):
    return ('<div class="ic %s"><svg viewBox="0 0 24 24" width="21" height="21" '
            'fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round">%s</svg></div>'
            % (tone, glyph))


G_DROP = '<path d="M12 2.7c3.6 4.2 6 7 6 9.9a6 6 0 1 1-12 0c0-2.9 2.4-5.7 6-9.9z"/>'
G_ARROW = '<path d="M12 19V5"/><path d="M5.5 11.5 12 5l6.5 6.5"/>'
G_TARGET = ('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>'
            '<circle cx="12" cy="12" r=".9" fill="currentColor"/>')
G_SHIELD = '<path d="M12 3 5 6v5.5c0 4.3 2.9 7.7 7 9.5 4.1-1.8 7-5.2 7-9.5V6z"/>'
G_BARS = ('<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-6"/>')
G_DOLLAR = ('<path d="M12 2.5v19"/>'
            '<path d="M16.5 7.2c-.7-1.5-2.4-2.4-4.5-2.4-2.5 0-4.2 1.3-4.2 3.2 0 4.6 9 2.5 9 7.3 '
            '0 2-1.9 3.4-4.6 3.4-2.4 0-4.2-1-4.9-2.6"/>')
G_CAL = ('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/>'
         '<path d="M8 2.8v4M16 2.8v4M3.5 10h17"/>')
G_CLOCK = '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.2 2.1"/>'
G_TAG = ('<path d="M20.5 12.7 12.8 20.4a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1-.6-1.4V5.5'
         'a2 2 0 0 1 2-2h7.1a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 .6 2.2z"/>'
         '<circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>')

# ------------------------------------------------------------------- rows ---
if CLOSED:
    rows = [
        (G_ARROW, "OPEN PRICE", "%.2f" % T["entry"], "", "val"),
        (G_TARGET, "CLOSE PRICE", "%.2f" % T["closed"], "", "good" if T["pnl"] >= 0 else "bad"),
        (G_BARS, "PRICE MOVE", "%+.2f" % T["move"], "%+.2f%%" % (T["move"] / T["entry"] * 100),
         "good" if T["pnl"] >= 0 else "bad"),
        (G_SHIELD, "RETURN ON MARGIN", "%+.2f%%" % T["roi"], "",
         "good" if T["pnl"] >= 0 else "bad"),
    ]
    hl_label = "PROFIT" if T["pnl"] >= 0 else "LOSS"
    hl_big = usd(T["pnl"], sign=True)
    hl_sub = "%+.2fR&nbsp;&nbsp;&bull;&nbsp;&nbsp;%+.2f%% on margin" % (T["pnl_r"], T["roi"])
    hl_good = T["pnl"] >= 0
    status = "CLOSED"
else:
    rows = [
        (G_ARROW, "ENTRY PRICE", "%.2f" % T["entry"], "%g lots" % T["volume"], "val"),
        (G_SHIELD, "STOP LOSS", "%.2f" % T["stop"],
         "moved to entry" if T["moved_to_entry"] else "", "val"),
        (G_TARGET, "TAKE PROFIT", "%.2f" % T["target"],
         "%+.2f from entry" % T["tp_dist"], "good"),
        (G_BARS, "RISK : REWARD", "1 : %.2f" % T["rr"], "", "good"),
    ]
    hl_label = "PROFIT AT TARGET"
    hl_big = usd(T["reward"], sign=True)
    hl_sub = "%+.2fR&nbsp;&nbsp;&bull;&nbsp;&nbsp;risking %s" % (
        T["rr"], usd(T["risk"]))
    hl_good = True
    status = "OPEN"

row_html = "".join(
    '<div class="row">%s<div class="rl">%s</div>'
    '<div class="rv %s">%s%s</div></div>'
    % (ring(g), lbl, tone, val,
       ('<span class="rs">%s</span>' % sub) if sub else "")
    for g, lbl, val, sub, tone in rows)

feet = [(G_CAL, "DATE", TRADE["date"]),
        (G_BARS, "VOLUME", "%g lots" % TRADE["volume"]),
        (G_TAG, "RISK", "%s &nbsp;·&nbsp; 1%%" % usd(T["risk"]))]
foot_html = "".join(
    '<div class="ft">%s<div><div class="fk">%s</div><div class="fv">%s</div></div></div>'
    % (ring(g, "tiny"), k, v) for g, k, v in feet)

HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:{W}px;height:{H}px;background:#0A0D13;overflow:hidden;
 font-family:"Liberation Sans","DejaVu Sans",sans-serif;-webkit-font-smoothing:antialiased}}
.card{{position:relative;width:{W}px;height:{H}px;overflow:hidden;
 background:
  radial-gradient(880px 520px at 88% 4%, rgba(74,222,128,.10), transparent 60%),
  radial-gradient(700px 520px at 0% 100%, rgba(191,60,53,.10), transparent 62%),
  linear-gradient(163deg,#293445 0%,#1C2432 44%,#141A24 74%,#10151D 100%);}}
.tex{{position:absolute;inset:0;
 background-image:linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),
   linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);
 background-size:54px 54px;}}
.rig{{position:absolute;right:-58px;bottom:96px;opacity:.055;
 transform:scale(1.9);transform-origin:bottom right;}}
.cnd{{position:absolute;left:0;right:0;top:392px;height:430px;opacity:.17;
 -webkit-mask-image:linear-gradient(to right,transparent 0%,#000 14%,#000 52%,
   rgba(0,0,0,.28) 70%,transparent 86%);}}
.vig{{position:absolute;inset:0;
 background:radial-gradient(120% 82% at 50% 42%,transparent 42%,rgba(0,0,0,.55) 100%);}}
.in{{position:relative;height:100%;padding:62px 64px 54px;display:flex;flex-direction:column}}

.top{{display:flex;align-items:flex-start;justify-content:space-between}}
.mark{{width:300px;height:auto;display:block}}
.slogan{{font-size:11.5px;letter-spacing:6.4px;color:#7E8CA3;font-weight:700;
 margin-top:13px;padding-left:3px}}
.qrw{{text-align:center}}
.qr{{background:#fff;padding:9px;border-radius:13px;line-height:0;
 box-shadow:0 12px 34px rgba(0,0,0,.55)}}
.qr img{{width:126px;height:126px;display:block;border-radius:4px}}
.qc{{font-size:10.5px;letter-spacing:2.2px;color:#7E8CA3;font-weight:700;margin-top:11px}}

.head{{margin-top:62px;display:flex;align-items:center;gap:22px}}
.hic{{width:74px;height:74px;border-radius:50%;flex:0 0 74px;display:flex;
 align-items:center;justify-content:center;color:#4ADE80;
 background:rgba(74,222,128,.10);border:1.6px solid rgba(74,222,128,.30)}}
.h1{{font-size:60px;font-weight:700;color:#fff;letter-spacing:-.6px;line-height:1.04}}
.h2{{font-size:14px;letter-spacing:4.6px;color:#8B99B0;font-weight:700;margin-top:9px}}
.chip{{margin-left:auto;font-size:12px;font-weight:700;letter-spacing:2.6px;
 padding:10px 19px;border-radius:999px;color:{SC};
 background:{SBG};border:1.5px solid {SBD}}}

.rows{{margin-top:58px}}
.row{{display:flex;align-items:center;gap:20px;padding:29px 4px;
 border-bottom:1px solid rgba(255,255,255,.075)}}
.ic{{width:50px;height:50px;border-radius:50%;flex:0 0 50px;display:flex;
 align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,.14);
 color:#9AA8BE;background:rgba(255,255,255,.035)}}
.ic.tiny{{width:38px;height:38px;flex:0 0 38px}}
.ic.tiny svg{{width:17px;height:17px}}
.rl{{font-size:16px;letter-spacing:3.2px;color:#8B99B0;font-weight:700}}
.rv{{margin-left:auto;text-align:right;font-size:38px;font-weight:700;
 letter-spacing:-.5px;color:#F2F5F9}}
.rv.good{{color:#4ADE80}} .rv.bad{{color:#F0574B}}
.rs{{display:block;font-size:13px;letter-spacing:1.7px;color:#7E8CA3;
 font-weight:700;margin-top:6px}}

.hl{{margin-top:40px;display:flex;align-items:center;gap:22px;padding:34px 32px;
 border-radius:20px;background:{HBG};border:1.6px solid {HBD}}}
.hl .ic{{border-color:{HBD};color:{HC};background:rgba(255,255,255,.05)}}
.hk{{font-size:14px;letter-spacing:4px;color:#93A2B8;font-weight:700}}
.hv{{font-size:58px;font-weight:700;color:{HC};letter-spacing:-1.2px;margin-top:7px}}
.hs{{margin-left:auto;text-align:right;font-size:22px;font-weight:700;color:{HC};
 letter-spacing:.2px}}

.foot{{margin-top:auto;margin-bottom:2px;display:flex;gap:1px;background:rgba(255,255,255,.08);
 border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden}}
.ft{{flex:1;display:flex;align-items:center;gap:14px;padding:20px 22px;
 background:rgba(10,14,20,.55)}}
.fk{{font-size:10.5px;letter-spacing:2.6px;color:#77859B;font-weight:700}}
.fv{{font-size:17px;font-weight:700;color:#E6EBF2;margin-top:5px}}
.tag{{margin-top:28px;text-align:center;font-size:17px;font-weight:700;
 color:#4ADE80;letter-spacing:.6px}}
</style></head><body>
<div class="card">
  <div class="tex"></div>
  <div class="rig">{RIG}</div>
  <div class="cnd">{CANDLES}</div>
  <div class="vig"></div>
  <div class="in">
    <div class="top">
      <div><img class="mark" src="tradertok-logo.png">
           <div class="slogan">TRADE. TRACK. SHARE.</div></div>
      <div class="qrw"><div class="qr"><img src="qr-tradertok.png"></div>
           <div class="qc">{QRC}</div></div>
    </div>

    <div class="head">
      <div class="hic"><svg viewBox="0 0 24 24" width="34" height="34" fill="none"
        stroke="currentColor" stroke-width="1.9" stroke-linejoin="round">{DROP}</svg></div>
      <div><div class="h1">{HEADLINE}</div>
           <div class="h2">{ASSET} &nbsp;&bull;&nbsp; {NAME}</div></div>
      <div class="chip">{STATUS}</div>
    </div>

    <div class="rows">{ROWS}</div>

    <div class="hl">{HLIC}
      <div><div class="hk">{HLK}</div><div class="hv">{HLV}</div></div>
      <div class="hs">{HLS}</div>
    </div>

    <div class="foot">{FOOT}</div>
    <div class="tag">{TAGLINE}</div>
  </div>
</div></body></html>""".format(
    W=W, H=H, RIG=PUMPJACK, CANDLES=candles(), QRC=QR_CAPTION,
    DROP=G_DROP, HEADLINE=TRADE["headline"], ASSET=TRADE["asset"],
    NAME=TRADE["name"], STATUS=status,
    SC="#4ADE80" if CLOSED else "#F2B23E",
    SBG="rgba(74,222,128,.12)" if CLOSED else "rgba(242,178,62,.12)",
    SBD="rgba(74,222,128,.38)" if CLOSED else "rgba(242,178,62,.38)",
    ROWS=row_html,
    HBG="rgba(74,222,128,.09)" if hl_good else "rgba(240,87,75,.09)",
    HBD="rgba(74,222,128,.34)" if hl_good else "rgba(240,87,75,.34)",
    HC="#4ADE80" if hl_good else "#F0574B",
    HLIC=ring(G_DOLLAR), HLK=hl_label, HLV=hl_big, HLS=hl_sub,
    FOOT=foot_html, TAGLINE=TAGLINE)

OUTDIR.mkdir(parents=True, exist_ok=True)
html_path = OUTDIR / "trader-tok-card.html"
png_path = OUTDIR / "trader-tok-card.png"
html_path.write_text(HTML, encoding="utf-8")

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME)
    pg = br.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    pg.goto(html_path.resolve().as_uri())
    pg.wait_for_timeout(320)
    pg.screenshot(path=str(png_path))
    br.close()

print("wrote %s (%dx%d @2x)" % (png_path, W, H))
