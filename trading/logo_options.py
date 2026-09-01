#!/usr/bin/env python3
"""Renders Trader Tok logo concepts as a comparison sheet."""
from pathlib import Path
from playwright.sync_api import sync_playwright

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
OUT = Path("trading/card")

DEFS = """
<defs>
  <linearGradient id="au" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#F3D99B"/><stop offset="48%" stop-color="#D9AC58"/>
    <stop offset="100%" stop-color="#A87C2E"/></linearGradient>
  <linearGradient id="auv" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#F7E3B0"/><stop offset="100%" stop-color="#C2963F"/></linearGradient>
  <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#2BE39B"/><stop offset="100%" stop-color="#0E9663"/></linearGradient>
</defs>"""

# A - hexagon, TT monogram sharing a crossbar, right stem is a candle
A = DEFS + """
<path d="M32 2 L58 17 L58 47 L32 62 L6 47 L6 17 Z" fill="#0B0F16"
      stroke="url(#au)" stroke-width="2.6" stroke-linejoin="round"/>
<rect x="14.5" y="19" width="35" height="5.4" rx="1.6" fill="url(#auv)"/>
<rect x="19.6" y="24.4" width="5.4" height="20" rx="1.4" fill="url(#auv)"/>
<rect x="12.6" y="12.6" width="2.1" height="39" rx="1" fill="url(#gr)" opacity=".95"/>
<rect x="39" y="24.4" width="5.4" height="20" rx="1.4" fill="url(#gr)"/>
<rect x="40.9" y="14.5" width="1.7" height="36" rx=".85" fill="url(#gr)"/>
<rect x="39" y="24.4" width="5.4" height="20" rx="1.4" fill="url(#gr)"/>"""

# B - circle, a candlestick that reads as a T
B = DEFS + """
<circle cx="32" cy="32" r="29" fill="#0B0F16" stroke="url(#au)" stroke-width="2.6"/>
<rect x="16" y="18.5" width="32" height="5.6" rx="1.7" fill="url(#auv)"/>
<rect x="29.2" y="24.1" width="5.6" height="22" rx="1.5" fill="url(#auv)"/>
<rect x="31.2" y="10" width="1.6" height="9.5" rx=".8" fill="url(#gr)"/>
<rect x="31.2" y="45" width="1.6" height="9" rx=".8" fill="url(#gr)"/>
<rect x="20.5" y="33" width="4.4" height="12" rx="1.2" fill="url(#gr)" opacity=".9"/>
<rect x="39.2" y="28" width="4.4" height="17" rx="1.2" fill="url(#gr)" opacity=".9"/>"""

# C - abstract chevron built from two candle bodies
C = DEFS + """
<rect x="3" y="3" width="58" height="58" rx="17" fill="#0B0F16"
      stroke="url(#au)" stroke-width="2.4"/>
<path d="M17 43 L31 21 L38 32 L47 17" stroke="url(#gr)" stroke-width="5"
      fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="47" cy="17" r="4.6" fill="url(#auv)"/>
<rect x="15.4" y="46" width="32" height="2.6" rx="1.3" fill="url(#au)" opacity=".55"/>"""

# D - stacked candles forming a rising T-bar, no enclosure
D = DEFS + """
<rect x="6" y="17" width="52" height="5.4" rx="1.7" fill="url(#auv)"/>
<rect x="9.5" y="34" width="7.4" height="14" rx="2" fill="url(#gr)" opacity=".75"/>
<rect x="12.3" y="28" width="1.8" height="26" rx=".9" fill="url(#gr)" opacity=".75"/>
<rect x="21.6" y="28" width="7.4" height="20" rx="2" fill="url(#gr)"/>
<rect x="24.4" y="23" width="1.8" height="31" rx=".9" fill="url(#gr)"/>
<rect x="28.6" y="22.4" width="6.8" height="31" rx="2" fill="url(#auv)"/>
<rect x="47" y="30" width="7.4" height="18" rx="2" fill="url(#au)" opacity=".8"/>
<rect x="49.8" y="25" width="1.8" height="28" rx=".9" fill="url(#au)" opacity=".8"/>"""

MARKS = [("A", "Hex monogram", A), ("B", "Ring candle", B),
         ("C", "Chevron", C), ("D", "Open candles", D)]

def lockup(svg, size=76):
    return f"""
    <div class="lock">
      <svg width="{size}" height="{size}" viewBox="0 0 64 64">{svg}</svg>
      <div class="wm">
        <div class="w1">TRADER<span>TOK</span></div>
        <div class="w2">PERFORMANCE</div>
      </div>
    </div>"""

cards = "".join(f"""
  <div class="opt">
    <div class="hd"><b>{k}</b> {name}</div>
    <div class="big"><svg width="150" height="150" viewBox="0 0 64 64">{svg}</svg></div>
    {lockup(svg)}
    <div class="small">
      <svg width="34" height="34" viewBox="0 0 64 64">{svg}</svg>
      <svg width="22" height="22" viewBox="0 0 64 64">{svg}</svg>
    </div>
  </div>""" for k, name, svg in MARKS)

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1240px;background:#080B10;font-family:"Liberation Sans",sans-serif;
 padding:52px 48px;color:#fff}}
h1{{font-size:23px;letter-spacing:5px;color:#C2963F;font-weight:700}}
.sub{{font-size:13px;color:#6B7A90;margin-top:9px;letter-spacing:1.4px}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:38px}}
.opt{{background:linear-gradient(165deg,#0E1319,#0A0D12);border:1px solid rgba(255,255,255,.08);
 border-radius:20px;padding:30px 32px 26px}}
.hd{{font-size:12px;letter-spacing:3px;color:#6B7A90;font-weight:700}}
.hd b{{color:#E8C173;margin-right:9px;font-size:15px}}
.big{{display:flex;justify-content:center;padding:26px 0 22px}}
.lock{{display:flex;align-items:center;gap:17px;padding:18px 0 6px;
 border-top:1px solid rgba(255,255,255,.07)}}
.w1{{font-size:27px;font-weight:700;letter-spacing:5.5px;color:#F2F5F9}}
.w1 span{{color:#C2963F}}
.w2{{font-size:10.5px;letter-spacing:4.4px;color:#67768C;font-weight:700;margin-top:6px}}
.small{{display:flex;align-items:center;gap:16px;padding-top:16px;
 border-top:1px solid rgba(255,255,255,.07);opacity:.85}}
</style></head><body>
<h1>TRADER TOK &nbsp;/&nbsp; LOGO CONCEPTS</h1>
<div class="sub">Each shown large, in the wordmark lockup, and small (favicon / avatar size).
 Tell me a letter and I will put it on the card.</div>
<div class="grid">{cards}</div>
</body></html>"""

OUT.mkdir(parents=True, exist_ok=True)
p = OUT / "logo-options.html"
p.write_text(HTML, encoding="utf-8")
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path=CHROME)
    pg = br.new_page(viewport={"width": 1240, "height": 900}, device_scale_factor=2)
    pg.goto(p.resolve().as_uri()); pg.wait_for_timeout(250)
    pg.screenshot(path=str(OUT / "logo-options.png"), full_page=True)
    br.close()
print("wrote", OUT / "logo-options.png")
