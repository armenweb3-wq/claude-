#!/usr/bin/env python3
"""
Generates "Trade Boxes" - one fill-in box per asset for a weekly cycle, with
the WTIUSD trade worked through as the model.

Usage:  python3 trading/generate_trade_boxes.py
Output: trading/Trade-Boxes.pdf

Every derived number comes from the TRADES table below. WinAnsi-safe glyphs
only, so the built-in Helvetica family renders everything.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer, Table,
    TableStyle,
)

OUT = "trading/Trade-Boxes.pdf"

# ------------------------------------------------------------------ inputs --
# value_per_unit = USD per 1.00 of price movement, per 1.00 lot
ASSETS = [
    ("XAUUSD", "GOLD",       100.0,  "$1.00 move",  100),
    ("WTIUSD", "CRUDE OIL", 1000.0,  "$1.00 move",  100),
    ("XAGUSD", "SILVER",    5000.0,  "$1.00 move",  100),
    ("BTCUSD", "BITCOIN",      1.0,  "$1.00 move",    5),
    ("DJIUSD", "DOW 30",       1.0,  "1.0 point",   100),
]

# the live account: 1R is 1% of FREE MARGIN, not of balance
BALANCE = 430_000.0
FREE_MARGIN = 245_000.0
USED_MARGIN = BALANCE - FREE_MARGIN
ONE_R = FREE_MARGIN * 0.01          # $2,450

# the one trade supplied so far
WTI = dict(asset="WTIUSD", entry=88.41, volume=2.8, stop=87.56, target=91.20,
           vpu=1000.0, leverage=100, quoted_margin=2475.0, moved_to_entry=True)

# --------------------------------------------------------------- derivations
def derive(t):
    d = dict(t)
    d["stop_dist"] = abs(t["entry"] - t["stop"])
    d["tp_dist"] = abs(t["target"] - t["entry"])
    d["risk"] = d["stop_dist"] * t["volume"] * t["vpu"]
    d["reward"] = d["tp_dist"] * t["volume"] * t["vpu"]
    d["rr"] = d["tp_dist"] / d["stop_dist"]
    d["notional"] = t["volume"] * t["vpu"] * t["entry"]
    d["margin"] = d["notional"] / t["leverage"]
    d["implied_balance"] = d["risk"] / 0.01
    return d

W = derive(WTI)

# ----------------------------------------------------------------- palette --
INK   = colors.HexColor("#101826")
NAVY  = colors.HexColor("#16233A")
GOLD  = colors.HexColor("#C2963F")
GOLDL = colors.HexColor("#F2E7CE")
SLATE = colors.HexColor("#5A6678")
RULE  = colors.HexColor("#C9D0DA")
FAINT = colors.HexColor("#EDF0F4")
ZEBRA = colors.HexColor("#F7F9FB")
GREEN = colors.HexColor("#2F6F4F")
GREENL= colors.HexColor("#E8F0EB")
RED   = colors.HexColor("#9B3535")
REDL  = colors.HexColor("#FBF1F1")

PAGE_W, PAGE_H = A4
MARGIN = 15 * mm
CW = PAGE_W - 2 * MARGIN

ss = getSampleStyleSheet()
def st(n, **kw):
    return ParagraphStyle(n, parent=kw.pop("parent", ss["Normal"]), **kw)

Body  = st("Body", fontName="Helvetica", fontSize=9.2, leading=13.4,
           textColor=INK, spaceAfter=6)
H1    = st("H1", fontName="Helvetica-Bold", fontSize=18, leading=21,
           textColor=NAVY, spaceAfter=3)
H2    = st("H2", fontName="Helvetica-Bold", fontSize=11.4, leading=14,
           textColor=NAVY, spaceBefore=12, spaceAfter=5)
Kick  = st("Kick", fontName="Helvetica-Bold", fontSize=7.8, leading=11,
           textColor=GOLD, spaceAfter=3)
Small = st("Small", fontName="Helvetica", fontSize=7.8, leading=11,
           textColor=SLATE, spaceAfter=4)
TD    = st("TD", fontName="Helvetica", fontSize=8.4, leading=11, textColor=INK)
TDb   = st("TDb", parent=TD, fontName="Helvetica-Bold")
TH    = st("TH", fontName="Helvetica-Bold", fontSize=7.6, leading=10,
           textColor=colors.white)


def usd(v, sign=False):
    s = "${:,.0f}".format(abs(v))
    if v < 0:
        return "-" + s
    return ("+" + s) if (sign and round(v)) else s


# ---------------------------------------------------------------- furniture
def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 11 * mm, PAGE_W - MARGIN, 11 * mm)
    canvas.setFont("Helvetica", 6.8)
    canvas.setFillColor(SLATE)
    canvas.drawString(MARGIN, 7.6 * mm,
                      "R:R must read at least 1:3 before the trade is taken.  "
                      "Round the lot size down, never up.")
    canvas.restoreState()


# ------------------------------------------------------------------- pieces
def cell(label, value, big=False, col=INK, sub=None):
    hexc = "#" + col.hexval()[2:]
    size = 12 if big else 10
    v = value if value else "&nbsp;"
    html = ("<font size='6.6' color='#5A6678'><b>%s</b></font><br/>"
            "<font size='%s' color='%s'><b>%s</b></font>" % (label, size, hexc, v))
    if sub:
        html += "<br/><font size='6.4' color='#5A6678'>%s</font>" % sub
    return Paragraph(html, st("c", fontName="Helvetica", fontSize=6.6,
                              leading=size + 3.6))


def strip(cells, widths, height=None, bg=colors.white):
    t = Table([cells], colWidths=widths, rowHeights=[height] if height else None)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, RULE),
    ]))
    return t


def box(asset, name, vpu, unit, lev, filled=None, height=30):
    """One trade box. filled=None gives blank lines to write on."""
    f = filled or {}
    def g(k, blank="__________"):
        return f.get(k, blank)

    head = Table([[Paragraph(
        "<font color='white' size='11'><b>%s</b></font>&nbsp;&nbsp;"
        "<font color='#C2963F' size='7.2'><b>%s</b></font>" % (asset, name), TD),
        Paragraph("<font color='#B9C4D4' size='6.8'>1.00 lot = %s per %s"
                  "&nbsp;&nbsp;&bull;&nbsp;&nbsp;%d:1</font>"
                  % (usd(vpu), unit, lev), TD)]],
        colWidths=[CW * 0.55, CW * 0.45])
    head.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    w6 = [CW / 6.0] * 6
    r1 = strip([cell("ENTRY", g("entry")), cell("VOLUME", g("volume")),
                cell("MARGIN", g("margin")), cell("STOP LOSS", g("stop")),
                cell("TAKE PROFIT", g("target")),
                cell("R : R", g("rr"), col=f.get("rr_col", INK))], w6, height)
    r2 = strip([cell("RISK (1R)", g("risk"), sub=f.get("risk_sub")),
                cell("SL MOVED TO ENTRY", g("moved")),
                cell("CLOSED AT", g("closed")),
                cell("RESULT ($)", g("result"), big=True,
                     col=f.get("res_col", INK)),
                cell("RESULT (R)", g("result_r"), col=f.get("res_col", INK))],
               [CW / 5.0] * 5, height, bg=ZEBRA)

    outer = Table([[head], [r1], [r2]], colWidths=[CW])
    outer.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.9, NAVY),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return outer


def table(header, rows, widths, zebra=True):
    data = [[Paragraph(h, TH) for h in header]]
    for r in rows:
        data.append([c if isinstance(c, Paragraph) else Paragraph(str(c), TD)
                     for c in r])
    t = Table(data, colWidths=widths, hAlign="LEFT")
    cmds = [("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
            ("BOX", (0, 0), (-1, -1), 0.7, RULE)]
    if zebra:
        for i in range(2, len(data), 2):
            cmds.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(cmds))
    return t


def note(title, text, tint=FAINT, bar=SLATE):
    inner = []
    if title:
        inner.append(Paragraph(title, Kick))
    inner.append(Paragraph(text, Body))
    t = Table([["", inner]], colWidths=[3.2, CW - 3.2], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), bar),
        ("BACKGROUND", (1, 0), (1, 0), tint),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, 0), 9), ("RIGHTPADDING", (1, 0), (1, 0), 9),
        ("TOPPADDING", (1, 0), (1, 0), 7), ("BOTTOMPADDING", (1, 0), (1, 0), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 0),
    ]))
    return t


def rule():
    hr = Table([[""]], colWidths=[CW], rowHeights=[2.2])
    hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
    return hr


# =================================================================== story ==
story = []

story.append(Paragraph(
    "<font size='15' color='#16233A'><b>Weekly Trade Sheet</b></font>"
    "&nbsp;&nbsp;&nbsp;"
    "<font size='8.4' color='#5A6678'>Week ____ / ____"
    "&nbsp;&nbsp;&bull;&nbsp;&nbsp;Free margin $__________"
    "&nbsp;&nbsp;&bull;&nbsp;&nbsp;</font>"
    "<font size='8.4' color='#2F6F4F'><b>1R = 1% = $2,450</b></font>",
    st("hdr", fontName="Helvetica", fontSize=15, leading=19)))
story.append(Spacer(1, 3))
story.append(rule())
story.append(Spacer(1, 10))

FILLED = {"WTIUSD": dict(
    entry="88.41", volume="2.8 lots", margin="$2,475", stop="87.56",
    target="91.20",
    rr="1 : 3.28", rr_col=GREEN, risk="$2,380", moved="YES",
    closed="__________", result="__________", result_r="________")}

for a, n, vpu, unit, lev in ASSETS:
    story.append(box(a, n, vpu, unit, lev, filled=FILLED.get(a), height=42))
    story.append(Spacer(1, 9))

story.append(Spacer(1, 3))
tot = Table([[
    Paragraph("<font size='8' color='#5A6678'><b>CYCLE TOTAL</b></font>", TD),
    Paragraph("<font size='7' color='#5A6678'>RESULT (R)</font><br/>"
              "<font size='12'><b>__________</b></font>",
              st("t1", fontName="Helvetica", fontSize=7, leading=16)),
    Paragraph("<font size='7' color='#5A6678'>PROFIT / LOSS</font><br/>"
              "<font size='12'><b>________________</b></font>",
              st("t2", fontName="Helvetica", fontSize=7, leading=16)),
    Paragraph("<font size='7' color='#5A6678'>FREE MARGIN AT CLOSE</font><br/>"
              "<font size='12'><b>________________</b></font>",
              st("t3", fontName="Helvetica", fontSize=7, leading=16)),
]], colWidths=[CW * 0.22, CW * 0.20, CW * 0.29, CW * 0.29])
tot.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), GOLDL),
    ("BOX", (0, 0), (-1, -1), 0.9, NAVY),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LINEAFTER", (0, 0), (-2, -1), 0.5, RULE),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.append(tot)

# =================================================================== build ==
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="Trade Boxes - five assets, one cycle",
                      subject="Per-asset trade record with the WTIUSD trade "
                              "worked through")
doc.addPageTemplates([PageTemplate(
    id="content",
    frames=[Frame(MARGIN, 13 * mm, CW, PAGE_H - 13 * mm - 15 * mm, id="c",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
    onPage=page)])
doc.build(story)
print("wrote %s" % OUT)
