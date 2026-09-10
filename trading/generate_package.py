#!/usr/bin/env python3
"""
A two-page client package: what is traded, how it is sized, and what a week
can look like, for any account size.

Usage:  python3 trading/generate_package.py [balance]     default 20000
Output: trading/Package-<balance>.pdf
"""

import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer,
    Table, TableStyle,
)

BALANCE = float(sys.argv[1]) if len(sys.argv) > 1 else 20_000.0
RISK_PCT = 0.01
R = BALANCE * RISK_PCT
TRADES = 5
LOGO = "trading/card/tradertok-logo.png"


def size_label(b):
    if b >= 1e6 and b % 1e6 == 0:
        return "%dM" % (b / 1e6)
    if b >= 1000 and b % 1000 == 0:
        return "%dk" % (b / 1000)
    return "%d" % b


OUT = "trading/Package-%s.pdf" % size_label(BALANCE)

# ----------------------------------------------------------------- palette --
RED   = colors.HexColor("#BF3C35")     # TraderTok brand
INK   = colors.HexColor("#14181F")
SLATE = colors.HexColor("#616B7A")
RULE  = colors.HexColor("#D9DEE5")
TINT  = colors.HexColor("#FAF6F5")
ZEBRA = colors.HexColor("#F6F8FA")
GREEN = colors.HexColor("#2F6F4F")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
CW = PAGE_W - 2 * MARGIN

ss = getSampleStyleSheet()
def st(n, **kw):
    return ParagraphStyle(n, parent=kw.pop("parent", ss["Normal"]), **kw)

Body = st("Body", fontName="Helvetica", fontSize=9.6, leading=14.2,
          textColor=INK, spaceAfter=7)
H1   = st("H1", fontName="Helvetica-Bold", fontSize=25, leading=29,
          textColor=INK, spaceAfter=4)
H2   = st("H2", fontName="Helvetica-Bold", fontSize=12.4, leading=15,
          textColor=INK, spaceBefore=16, spaceAfter=7)
Kick = st("Kick", fontName="Helvetica-Bold", fontSize=8, leading=11,
          textColor=RED, spaceAfter=4)
Small= st("Small", fontName="Helvetica", fontSize=8.2, leading=11.8,
          textColor=SLATE, spaceAfter=4)
TD   = st("TD", fontName="Helvetica", fontSize=9, leading=12.2, textColor=INK)
TDb  = st("TDb", parent=TD, fontName="Helvetica-Bold")
TH   = st("TH", fontName="Helvetica-Bold", fontSize=7.8, leading=10.4,
          textColor=colors.white)


def money(v, sign=False):
    s = "${:,.0f}".format(abs(v))
    if v < 0:
        return "-" + s
    return ("+" + s) if (sign and round(v)) else s


def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(RED)
    canvas.rect(0, PAGE_H - 6, PAGE_W, 6, stroke=0, fill=1)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.setFont("Helvetica", 7.2)
    canvas.setFillColor(SLATE)
    canvas.drawString(MARGIN, 10.4 * mm,
                      "tradertok.com  |  Leveraged trading carries a high risk "
                      "of loss. Figures are worked examples, not a projection "
                      "of returns.")
    canvas.setFont("Helvetica-Bold", 7.2)
    canvas.setFillColor(INK)
    canvas.drawRightString(PAGE_W - MARGIN, 10.4 * mm, "%d" % doc.page)
    canvas.restoreState()


def table(header, rows, widths, zebra=True):
    data = [[Paragraph(h, TH) for h in header]]
    for r in rows:
        data.append([c if isinstance(c, Paragraph) else Paragraph(str(c), TD)
                     for c in r])
    t = Table(data, colWidths=widths, hAlign="LEFT")
    cmds = [("BACKGROUND", (0, 0), (-1, 0), INK),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
            ("BOX", (0, 0), (-1, -1), 0.7, RULE)]
    if zebra:
        for i in range(2, len(data), 2):
            cmds.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(cmds))
    return t


def note(title, text, tint=TINT, bar=RED):
    inner = []
    if title:
        inner.append(Paragraph(title, Kick))
    inner.append(Paragraph(text, Body))
    t = Table([["", inner]], colWidths=[3.2, CW - 3.2], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), bar),
        ("BACKGROUND", (1, 0), (1, 0), tint),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, 0), 11), ("RIGHTPADDING", (1, 0), (1, 0), 11),
        ("TOPPADDING", (1, 0), (1, 0), 9), ("BOTTOMPADDING", (1, 0), (1, 0), 5),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 0),
    ]))
    return t


# =================================================================== story ==
story = []

logo = Image(LOGO, width=150, height=150 * 180 / 1194.0)
logo.hAlign = "LEFT"
story.append(logo)
story.append(Spacer(1, 22))
story.append(Paragraph("TRADING PACKAGE", Kick))
story.append(Paragraph("%s Account" % money(BALANCE), H1))
hr = Table([[""]], colWidths=[CW], rowHeights=[2.6])
hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), RED)]))
story.append(hr)
story.append(Spacer(1, 14))

facts = [("ACCOUNT", money(BALANCE)),
         ("RISK PER TRADE", "1% = " + money(R)),
         ("TRADES PER WEEK", "%d" % TRADES),
         ("REWARD TARGET", "1:3 to 1:5")]
ft = Table([[Paragraph(
    "<font size='7.4' color='#616B7A'><b>%s</b></font><br/>"
    "<font size='15' color='#14181F'><b>%s</b></font>" % (k, v),
    st("f%d" % i, fontName="Helvetica", fontSize=7.4, leading=19))
    for i, (k, v) in enumerate(facts)]], colWidths=[CW / 4.0] * 4, hAlign="LEFT")
ft.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (0, 0), 0), ("LEFTPADDING", (1, 0), (-1, 0), 13),
    ("LINEBEFORE", (1, 0), (-1, 0), 0.8, RULE),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story.append(ft)

story.append(Paragraph("What will be done", H2))
steps = [
    ("Five trades a week",
     "One position on each of the five markets below. Five is a ceiling, not a "
     "quota - a week with three good setups is a week with three trades."),
    ("Every trade risks exactly 1%",
     "%s. Position size is calculated from the distance to the stop, so a wider "
     "stop means a smaller position, never a bigger loss." % money(R)),
    ("Stop and target set before entry",
     "Both levels are placed with the order. The stop is never widened once the "
     "trade is live."),
    ("Nothing taken below 1:3",
     "The target must be at least three times the distance to the stop. A %s "
     "risk is aiming for %s to %s." % (money(R), money(3 * R), money(5 * R))),
    ("Stop moved to entry once it moves",
     "When a trade goes far enough in favour, the stop moves to the entry "
     "price. From that point the trade cannot lose."),
    ("Everything is logged",
     "Each week you receive a sheet showing every entry, stop, target, exit and "
     "the profit or loss in cash and in R."),
]
step_rows = [[Paragraph("<b>%d</b>" % (i + 1), TDb),
              Paragraph("<b>%s</b><br/><font size='8.4' color='#616B7A'>%s"
                        "</font>" % (t, d), TD)]
             for i, (t, d) in enumerate(steps)]
story.append(table(["", "STEP"], step_rows, [26, CW - 26]))

story.append(Paragraph("The five markets", H2))
mk = [("XAUUSD", "Gold"), ("WTIUSD", "Crude oil"), ("XAGUSD", "Silver"),
      ("BTCUSD", "Bitcoin"), ("DJIUSD", "Dow Jones 30")]
mt = Table([[Paragraph("<font size='11'><b>%s</b></font><br/>"
                       "<font size='8' color='#616B7A'>%s</font>" % (a, n),
                       st("m%d" % i, fontName="Helvetica", fontSize=11,
                          leading=14))
             for i, (a, n) in enumerate(mk)]],
           colWidths=[CW / 5.0] * 5, hAlign="LEFT")
mt.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("BACKGROUND", (0, 0), (-1, -1), ZEBRA),
    ("BOX", (0, 0), (-1, -1), 0.7, RULE),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
    ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
    ("LEFTPADDING", (0, 0), (-1, -1), 12),
]))
story.append(mt)
story.append(Spacer(1, 6))
story.append(Paragraph(
    "One trade per market per week, so no single market can dominate the "
    "account and a bad call in one place stays a %s problem." % money(R), Small))
story.append(PageBreak())

# --------------------------------------------------------------- page two --
story.append(Paragraph("THE NUMBERS", Kick))
story.append(Paragraph("What a week can look like", H1))
story.append(hr)
story.append(Spacer(1, 14))
story.append(Paragraph(
    "Five trades means six possible weeks, from nothing working to everything "
    "working. Every outcome is shown - the losing ones included.", Body))
story.append(Spacer(1, 3))


def cash(r):
    col = "#2F6F4F" if r > 0 else ("#BF3C35" if r < 0 else "#616B7A")
    return Paragraph("<font color='%s'><b>%s</b></font>" % (col, money(r * R, True)), TD)


rows = []
for w in range(6):
    rows.append([Paragraph("<b>%d of 5</b>" % w, TDb),
                 cash(4 * w - 5), cash(3 * w)])
story.append(table(
    ["TRADES THAT WORK", "WINNERS AT 1:3", "WITH THE STOP MOVED TO ENTRY"],
    rows, [128, 150, CW - 278]))
story.append(Spacer(1, 8))
story.append(note("THE POINT OF MOVING THE STOP",
    "In the left column a week where nothing works costs %s - five stops at 1%% "
    "each. In the right column, where the stop has been moved to entry, that "
    "same week costs nothing. You stop being able to lose a week; you can only "
    "fail to make one. Two of five working is enough to be profitable either "
    "way." % money(5 * R)))

story.append(Paragraph("What you receive", H2))
recv = [("Weekly trade sheet",
         "One page, every trade: entry, stop, target, exit, risk taken, and the "
         "result in cash and in R. Rule breaches are flagged."),
        ("A card per closed trade",
         "Open price, close price, profit in cash and percent - shareable."),
        ("A running cycle total",
         "Realised and unrealised kept in separate columns so open profit is "
         "never counted as banked.")]
story.append(table(["", "INCLUDED"],
                   [[Paragraph("<b>%s</b>" % t, TD),
                     Paragraph("<font size='8.6' color='#616B7A'>%s</font>" % d, TD)]
                    for t, d in recv], [160, CW - 160]))

story.append(Paragraph("What is not promised", H2))
story.append(note("READ THIS BEFORE ANYTHING ELSE",
    "None of the figures above is a forecast. They are what the arithmetic "
    "produces if a given number of trades work - not a claim about how many "
    "will. The most that can be lost in a single week under these rules is "
    "%s, or 5%% of the account, and losing weeks are a normal part of the "
    "method rather than a failure of it. Spread, commission and financing are "
    "not included and reduce every result. Past performance does not indicate "
    "future results." % money(5 * R),
    tint=colors.HexColor("#F5F6F8"), bar=SLATE))

# =================================================================== build ==
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="Trading Package - %s" % money(BALANCE),
                      subject="1%% risk per trade, five markets a week")
doc.addPageTemplates([PageTemplate(id="c", frames=[
    Frame(MARGIN, 17 * mm, CW, PAGE_H - 17 * mm - MARGIN, id="f",
          leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
    onPage=page)])
doc.build(story)
print("wrote %s" % OUT)
