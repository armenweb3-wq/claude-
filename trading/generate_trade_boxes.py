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
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, stroke=0, fill=1)
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_H - 10 * mm - 1.5, PAGE_W, 1.5, stroke=0, fill=1)
    canvas.setFont("Helvetica-Bold", 7.4)
    canvas.setFillColor(GOLDL)
    canvas.drawString(MARGIN, PAGE_H - 6.7 * mm, "TRADE BOXES")
    canvas.setFont("Helvetica", 7.4)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 6.7 * mm,
                           "One box per asset  |  one cycle per sheet")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 11 * mm, PAGE_W - MARGIN, 11 * mm)
    canvas.setFont("Helvetica", 6.8)
    canvas.setFillColor(SLATE)
    canvas.drawString(MARGIN, 7.6 * mm,
                      "Cycle beginning ____ / ____ / ______        "
                      "Balance $______________        1R = $____________")
    canvas.setFont("Helvetica-Bold", 6.8)
    canvas.setFillColor(NAVY)
    canvas.drawRightString(PAGE_W - MARGIN, 7.6 * mm, "%d" % doc.page)
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
    r2 = strip([cell("RISK (1R)", g("risk")),
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

# --------------------------------------------------------------- PAGE 1 ----
story.append(Paragraph("THE BOX, WORKED THROUGH", Kick))
story.append(Paragraph("Your Oil Trade", H1))
story.append(rule())
story.append(Spacer(1, 9))

story.append(box("WTIUSD", "CRUDE OIL", 1000.0, "$1.00 move", 100, filled=dict(
    entry="88.41", volume="2.8 lots", margin=usd(W["margin"]),
    stop="87.56", target="91.20",
    rr="1 : %.2f" % W["rr"], rr_col=GREEN,
    risk=usd(W["risk"]), moved="YES", closed="__________",
    result="__________", result_r="________"), height=36))
story.append(Spacer(1, 10))

story.append(Paragraph("Where every number comes from", H2))
calc_rows = [
    ["Stop distance", "88.41 - 87.56", "<b>0.85</b>", "How far price must go against you."],
    ["Target distance", "91.20 - 88.41", "<b>2.79</b>", "How far it must go for you."],
    ["<b>Risk (1R)</b>", "0.85 x 2.8 x $1,000",
     "<b>%s</b>" % usd(W["risk"]), "What a stop-out costs."],
    ["<b>Reward at target</b>", "2.79 x 2.8 x $1,000",
     "<b>%s</b>" % usd(W["reward"]), "What the take profit pays."],
    ["<b>R : R</b>", "2.79 / 0.85",
     "<font color='#2F6F4F'><b>1 : 3.28</b></font>",
     "<font color='#2F6F4F'>Inside the 1:3 to 1:5 band.</font>"],
    ["Notional", "2.8 x 1,000 x 88.41", "$247,548", "The position's face value."],
    ["Margin at 100:1", "$247,548 / 100",
     "<b>$2,475</b>", "<font color='#2F6F4F'>Matches the $2,475 you quoted.</font>"],
]
story.append(table(["", "CALCULATION", "RESULT", "WHAT IT IS"],
                   [[Paragraph(c, TD) for c in r] for r in calc_rows],
                   [102, 122, 78, CW - 302]))
story.append(Spacer(1, 5))
story.append(Paragraph(
    "The margin figure is the proof the rest is right: 2.8 lots of 1,000 "
    "barrels at 100:1 gives $2,475.48, which is what your platform shows. So "
    "the contract size and the leverage are confirmed, and every other number "
    "above follows from them.", Small))

story.append(Paragraph("What each close price pays", H2))
out_rows = []
for label, px, tag in (("Take profit hit", 91.20, GREEN),
                       ("Stop at entry - scratched", 88.41, SLATE),
                       ("Original stop hit", 87.56, RED)):
    pl = (px - W["entry"]) * W["volume"] * W["vpu"]
    hexc = "#" + tag.hexval()[2:]
    out_rows.append([
        Paragraph("<b>%.2f</b>" % px, TD),
        Paragraph("<font color='%s'>%s</font>" % (hexc, label), TD),
        Paragraph("<font color='%s'><b>%+.2fR</b></font>" % (hexc, pl / W["risk"]), TD),
        Paragraph("<font color='%s'><b>%s</b></font>" % (hexc, usd(pl, sign=True)), TD)])
story.append(table(["CLOSE PRICE", "OUTCOME", "R", "PROFIT / LOSS"],
                   out_rows, [88, 214, 70, CW - 372]))
story.append(Spacer(1, 5))
story.append(note("FOR ANY OTHER CLOSE PRICE",
    "<b>P/L = (close - 88.41) x 2.8 x $1,000</b>, which is $2,800 for every "
    "1.00 the price moves, or $28 for every 0.01. Closed at 90.00 that is "
    "<b>+$4,452 (+1.87R)</b>. Because the stop is at entry, the worst case is "
    "now $0 rather than -$2,380 - minus spread and commission, which a "
    "scratched trade still pays.", tint=GOLDL, bar=GOLD))
story.append(PageBreak())

# --------------------------------------------------------------- PAGE 2 ----
story.append(Paragraph("ONE SHEET PER CYCLE", Kick))
story.append(Paragraph("The Five Boxes", H1))
story.append(rule())
story.append(Spacer(1, 8))
story.append(Paragraph(
    "Fill in entry, volume and both levels when you open. Write the price in "
    "SL MOVED TO ENTRY when you move the stop, and the close price when you "
    "are out. R:R must read at least 1:3 before the trade is taken.", Small))
story.append(Spacer(1, 6))
for a, n, vpu, unit, lev in ASSETS:
    story.append(box(a, n, vpu, unit, lev, height=44))
    story.append(Spacer(1, 8))
story.append(PageBreak())

# --------------------------------------------------------------- PAGE 3 ----
story.append(Paragraph("CLOSING THE WEEK", Kick))
story.append(Paragraph("Cycle Total", H1))
story.append(rule())
story.append(Spacer(1, 9))

tot_rows = [[Paragraph("<b>%s</b>" % a, TD)] + [""] * 4 for a, _, _, _, _ in ASSETS]
tot_rows.append([Paragraph("<b>TOTAL</b>", TDb), "", "", "", ""])
tt = table(["ASSET", "CLOSED AT", "OUTCOME  (TP / SL / ENTRY)", "RESULT (R)",
            "PROFIT / LOSS"],
           tot_rows, [66, 84, 168, 78, CW - 396], zebra=False)
tt.setStyle(TableStyle([
    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
    ("TOPPADDING", (0, 1), (-1, -1), 12),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 12),
    ("BACKGROUND", (0, 6), (-1, 6), GOLDL),
    ("LINEABOVE", (0, 6), (-1, 6), 1.1, NAVY)]))
story.append(tt)

story.append(Paragraph("Contract values - the only numbers you need to size", H2))
ref_rows = []
for a, n, vpu, unit, lev in ASSETS:
    ref_rows.append([
        Paragraph("<b>%s</b> <font size='7' color='#5A6678'>%s</font>" % (a, n), TD),
        Paragraph("%s per %s, per 1.00 lot" % (usd(vpu), unit), TD),
        Paragraph("<b>%d:1</b>" % lev, TD),
        Paragraph("volume = 1R / (stop distance x %s)" % usd(vpu), TD)])
story.append(table(["ASSET", "VALUE PER LOT", "LEVERAGE", "VOLUME FOR 1R"],
                   ref_rows, [116, 158, 60, CW - 334]))
story.append(Spacer(1, 5))
story.append(Paragraph(
    "Silver and the Dow vary most between brokers - check both against your "
    "platform once, the way the $2,475 margin confirmed oil.", Small))

story.append(Paragraph("One thing to settle before the next trade", H2))
story.append(note("THE RISK ON THE OIL TRADE IS NOT 1% OF $2,000,000",
    "$2,380 of risk is 1% of <b>$238,000</b>. On the $2,000,000 balance from "
    "the last sheet it is <b>0.12%</b> - about one twelfth of a full position. "
    "Neither is wrong, they are just different accounts. To risk a true 1% of "
    "$2,000,000 on this same setup you would need <b>23.53 lots</b>, not 2.8 - "
    "$2,080,235 of notional and $20,802 of margin, which is where the 5:1 on "
    "bitcoin starts to matter. Tell me which balance the boxes should assume "
    "and the sizing column can be pre-filled.",
    tint=REDL, bar=RED))

story.append(Spacer(1, 8))
bal_rows = [
    ["<b>$238,000</b>", "2.8 lots", "$2,380", "<b>1.00%</b>", "$2,475",
     "<font color='#2F6F4F'>What you traded</font>"],
    ["<b>$2,000,000</b>", "2.8 lots", "$2,380", "0.12%", "$2,475",
     "The same trade on the bigger account"],
    ["<b>$2,000,000</b>", "23.53 lots", "$20,000", "<b>1.00%</b>", "$20,802",
     "A full 1% position on the bigger account"],
]
story.append(table(
    ["BALANCE", "VOLUME", "RISK", "EXPOSURE", "MARGIN", ""],
    [[Paragraph(c, TD) for c in r] for r in bal_rows],
    [80, 64, 64, 62, 62, CW - 332]))

# =================================================================== build ==
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="Trade Boxes - five assets, one cycle",
                      subject="Per-asset trade record with the WTIUSD trade "
                              "worked through")
doc.addPageTemplates([PageTemplate(
    id="content",
    frames=[Frame(MARGIN, 13 * mm, CW, PAGE_H - 13 * mm - 13 * mm, id="c",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
    onPage=page)])
doc.build(story)
print("wrote %s" % OUT)
