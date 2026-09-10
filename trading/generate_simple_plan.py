#!/usr/bin/env python3
"""
Generates "The Simple Version" - a four-page worked example of the weekly
5-asset plan at 1% risk per trade, for any starting balance.

Usage:  python3 trading/generate_simple_plan.py [balance]     default 2000000
Output: trading/Simple-Plan-<balance>.pdf

WinAnsi-safe glyphs only, so the built-in Helvetica family renders everything.
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.graphics.shapes import (Drawing, Line, PolyLine, Rect,
                                       String, Circle, Polygon)
from reportlab.platypus import (
    BaseDocTemplate, Frame, NextPageTemplate, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

import math
import random
import sys

# ------------------------------------------------------------------ inputs --
BALANCE = float(sys.argv[1]) if len(sys.argv) > 1 else 2_000_000.0


def size_label(b):
    if b >= 1e6 and b % 1e6 == 0:
        return "%dM" % (b / 1e6)
    if b >= 1000 and b % 1000 == 0:
        return "%dk" % (b / 1000)
    return "%d" % b


OUT = "trading/Simple-Plan-%s.pdf" % size_label(BALANCE)
RISK_PCT = 0.01
R = BALANCE * RISK_PCT              # one unit of risk
ASSETS = ["XAUUSD", "WTIUSD", "XAGUSD", "BTCUSD", "DJIUSD"]

WEEK_A = [("Stopped out", -1), ("Stopped out", -1),
          ("Target hit 1:3", 3), ("Target hit 1:3", 3), ("Target hit 1:5", 5)]
WEEK_B = [("Stop moved to entry - scratched", 0)] * 4 + [("Target hit 1:5", 5)]

A_R = sum(x for _, x in WEEK_A)     # +9R
B_R = sum(x for _, x in WEEK_B)     # +5R
WEEKS_PER_MONTH = 4

# ----------------------------------------------------------------- palette --
INK   = colors.HexColor("#101826")
NAVY  = colors.HexColor("#16233A")
GOLD  = colors.HexColor("#C2963F")
GOLDL = colors.HexColor("#F2E7CE")
SLATE = colors.HexColor("#5A6678")
RULE  = colors.HexColor("#D5DAE2")
ZEBRA = colors.HexColor("#F5F7FA")
GREEN = colors.HexColor("#2F6F4F")
GREENL= colors.HexColor("#E8F0EB")
RED   = colors.HexColor("#9B3535")
REDL  = colors.HexColor("#FBF1F1")

PAGE_W, PAGE_H = A4
MARGIN = 17 * mm
CW = PAGE_W - 2 * MARGIN

# ------------------------------------------------------------------ styles --
ss = getSampleStyleSheet()
def st(n, **kw):
    return ParagraphStyle(n, parent=kw.pop("parent", ss["Normal"]), **kw)

Body  = st("Body", fontName="Helvetica", fontSize=9.6, leading=14,
           textColor=INK, spaceAfter=6)
H1    = st("H1", fontName="Helvetica-Bold", fontSize=19, leading=22,
           textColor=NAVY, spaceAfter=3)
H2    = st("H2", fontName="Helvetica-Bold", fontSize=12, leading=15,
           textColor=NAVY, spaceBefore=13, spaceAfter=5)
Kick  = st("Kick", fontName="Helvetica-Bold", fontSize=8, leading=11,
           textColor=GOLD, spaceAfter=3)
Small = st("Small", fontName="Helvetica", fontSize=8.2, leading=11.6,
           textColor=SLATE, spaceAfter=4)
TD    = st("TD", fontName="Helvetica", fontSize=9, leading=12, textColor=INK)
TDb   = st("TDb", parent=TD, fontName="Helvetica-Bold")
TH    = st("TH", fontName="Helvetica-Bold", fontSize=8, leading=10.5,
           textColor=colors.white)


def money(v, sign=False):
    s = "${:,.0f}".format(abs(v))
    if v < 0:
        return "-" + s
    return ("+" + s) if (sign and round(v)) else s


# --------------------------------------------------------------- page furniture
def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 11 * mm, PAGE_W, 11 * mm, stroke=0, fill=1)
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_H - 11 * mm - 1.6, PAGE_W, 1.6, stroke=0, fill=1)
    canvas.setFont("Helvetica-Bold", 7.6)
    canvas.setFillColor(GOLDL)
    canvas.drawString(MARGIN, PAGE_H - 7.3 * mm, "THE SIMPLE VERSION")
    canvas.setFont("Helvetica", 7.6)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 7.3 * mm,
                           money(BALANCE) + "  |  1% per trade  |  5 trades a week")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 12 * mm, PAGE_W - MARGIN, 12 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(SLATE)
    canvas.drawString(MARGIN, 8.4 * mm,
                      "Worked example. Arithmetic, not a forecast. Not financial advice.")
    canvas.setFont("Helvetica-Bold", 7)
    canvas.setFillColor(NAVY)
    canvas.drawRightString(PAGE_W - MARGIN, 8.4 * mm, "%d" % doc.page)
    canvas.restoreState()


# ------------------------------------------------------------------ pieces --
def table(header, rows, widths, zebra=True):
    data = [[Paragraph(h, TH) for h in header]]
    for r in rows:
        data.append([c if isinstance(c, Paragraph) else Paragraph(str(c), TD)
                     for c in r])
    t = Table(data, colWidths=widths, hAlign="LEFT")
    cmds = [("BACKGROUND", (0, 0), (-1, 0), NAVY),
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


def band(label, value, sub, tint=GOLDL, bar=GOLD, vcol=NAVY):
    inner = Table([[
        Paragraph("<font size='8' color='#5A6678'><b>%s</b></font><br/>"
                  "<font size='24' color='%s'><b>%s</b></font>"
                  % (label, "#" + vcol.hexval()[2:], value),
                  st("bv", fontName="Helvetica", fontSize=8, leading=29)),
        Paragraph(sub, st("bs", fontName="Helvetica", fontSize=9, leading=13,
                          textColor=INK)),
    ]], colWidths=[CW * 0.42, CW * 0.58 - 3.2])
    inner.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 10), ("LEFTPADDING", (1, 0), (1, 0), 10),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    t = Table([["", inner]], colWidths=[3.2, CW - 3.2], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), bar),
        ("BACKGROUND", (1, 0), (1, 0), tint),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, 0), 0), ("RIGHTPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, 0), 0), ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
    ]))
    return t


def note(title, text, tint=colors.HexColor("#F4F5F7"), bar=SLATE):
    inner = []
    if title:
        inner.append(Paragraph(title, Kick))
    inner.append(Paragraph(text, Body))
    t = Table([["", inner]], colWidths=[3.2, CW - 3.2], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), bar),
        ("BACKGROUND", (1, 0), (1, 0), tint),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, 0), 10), ("RIGHTPADDING", (1, 0), (1, 0), 10),
        ("TOPPADDING", (1, 0), (1, 0), 8), ("BOTTOMPADDING", (1, 0), (1, 0), 5),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 0),
    ]))
    return t


def week_table(legs):
    rows = []
    for asset, (outcome, r) in zip(ASSETS, legs):
        if r > 0:
            col, cash = GREEN, money(r * R, sign=True)
        elif r < 0:
            col, cash = RED, money(r * R)
        else:
            col, cash = SLATE, "$0"
        hexc = "#" + col.hexval()[2:]
        rows.append([
            Paragraph("<b>%s</b>" % asset, TD),
            Paragraph("<font color='%s'>%s</font>" % (hexc, outcome), TD),
            Paragraph("<font color='%s'><b>%+dR</b></font>" % (hexc, r), TD),
            Paragraph("<font color='%s'><b>%s</b></font>" % (hexc, cash), TD),
        ])
    total = sum(r for _, r in legs)
    rows.append([
        Paragraph("<b>TOTAL</b>", TDb),
        Paragraph("<b>5 trades</b>", TDb),
        Paragraph("<b>%+dR</b>" % total, TDb),
        Paragraph("<b>%s</b>" % money(total * R, sign=True), TDb)])
    t = table(["ASSET", "RESULT", "R MULTIPLE", "PROFIT / LOSS"],
              rows, [92, 196, 92, CW - 380])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 6), (-1, 6), GOLDL),
        ("LINEABOVE", (0, 6), (-1, 6), 1.1, NAVY)]))
    return t


# ---------------------------------------------------------------- the chart --
def be_diagram(w, h):
    """Stop, entry, trigger and target on one track, before and after."""
    d = Drawing(w, h)
    L, Rt = 74, 8
    pw = w - L - Rt
    # the track spans -1R (stop) to +3R (target), so entry sits a quarter in
    def X(r):
        return L + pw * (r + 1) / 4.0

    marks = [(-1, "STOP", "-1R"), (0, "ENTRY", "0"),
             (1, "TRIGGER", "+1R"), (3, "TARGET", "+3R")]
    for r, name, val in marks:
        d.add(Line(X(r), 40, X(r), h - 34, strokeColor=RULE, strokeWidth=0.6))
        d.add(String(X(r), h - 12, name, fontName="Helvetica-Bold", fontSize=7,
                     fillColor=SLATE, textAnchor="middle"))
        d.add(String(X(r), h - 26, val, fontName="Helvetica-Bold", fontSize=8.6,
                     fillColor=NAVY, textAnchor="middle"))

    bars = [(h - 62, "BEFORE", True), (h - 100, "AFTER", False)]
    for y, label, before in bars:
        d.add(String(0, y + 9, label, fontName="Helvetica-Bold", fontSize=8,
                     fillColor=SLATE))
        if before:
            d.add(Rect(X(-1), y, X(0) - X(-1), 22, fillColor=RED,
                       strokeColor=None))
            d.add(String((X(-1) + X(0)) / 2, y + 7.5, "at risk",
                         fontName="Helvetica-Bold", fontSize=7.4,
                         fillColor=colors.white, textAnchor="middle"))
        else:
            d.add(Rect(X(-1), y, X(0) - X(-1), 22,
                       fillColor=colors.HexColor("#EDEFF2"), strokeColor=None))
            d.add(String((X(-1) + X(0)) / 2, y + 7.5, "no longer reachable",
                         fontName="Helvetica-Bold", fontSize=6.6,
                         fillColor=SLATE, textAnchor="middle"))
            d.add(Line(X(0), y - 5, X(0), y + 27, strokeColor=NAVY,
                       strokeWidth=2.2))
        d.add(Rect(X(0), y, X(3) - X(0), 22, fillColor=GREEN, strokeColor=None))
        d.add(String((X(0) + X(3)) / 2, y + 7.5, "to make",
                     fontName="Helvetica-Bold", fontSize=7.4,
                     fillColor=colors.white, textAnchor="middle"))

    d.add(String(X(1), 12, "the stop moves here, once price reaches +1R",
                 fontName="Helvetica-Oblique", fontSize=7.4, fillColor=SLATE,
                 textAnchor="middle"))
    d.add(Line(X(1), 24, X(1), 40, strokeColor=SLATE, strokeWidth=0.8))
    return d


def week_chart(w, h, series, colour, dd_at):
    """Equity week by week, with the deepest drawdown marked."""
    d = Drawing(w, h)
    L, Rt, T, Bo = 54, 10, 16, 22
    pw, ph = w - L - Rt, h - T - Bo
    lo, hi = min(series), max(series)
    pad = (hi - lo) * 0.18 or hi * 0.1
    raw = (hi + pad - max(0, lo - pad)) / 4.0
    mag = 10 ** math.floor(math.log10(raw))
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    ymin = math.floor(max(0, lo - pad) / step) * step
    ymax = ymin + 4 * step

    def Y(v):
        return Bo + (v - ymin) / (ymax - ymin) * ph

    for k in range(5):
        v = ymin + step * k
        d.add(Line(L, Y(v), L + pw, Y(v), strokeColor=RULE, strokeWidth=0.5))
        d.add(String(L - 6, Y(v) - 2.6, money(v), fontName="Helvetica",
                     fontSize=6.8, fillColor=SLATE, textAnchor="end"))
    for wk in range(0, len(series), 13):
        x = L + pw * wk / float(len(series) - 1)
        d.add(String(x, Bo - 12, "wk %d" % wk, fontName="Helvetica",
                     fontSize=6.8, fillColor=SLATE, textAnchor="middle"))

    pts = []
    for i, v in enumerate(series):
        pts += [L + pw * i / float(len(series) - 1), Y(v)]
    d.add(Line(L, Y(series[0]), L + pw, Y(series[0]), strokeColor=SLATE,
               strokeWidth=0.7, strokeDashArray=[3, 3]))
    d.add(PolyLine(points=pts, strokeColor=colour, strokeWidth=1.9))
    d.add(Circle(pts[dd_at * 2], pts[dd_at * 2 + 1], 3.4, fillColor=RED,
                 strokeColor=colors.white, strokeWidth=1))
    d.add(String(pts[dd_at * 2] + 8, pts[dd_at * 2 + 1] - 12, "worst drawdown",
                 fontName="Helvetica-Bold", fontSize=7, fillColor=RED))
    d.add(String(L + pw, min(Y(series[-1]) + 13, Bo + ph - 8),
                 money(series[-1]), fontName="Helvetica-Bold", fontSize=8.6,
                 fillColor=colour, textAnchor="end"))
    d.add(Line(L, Bo, L + pw, Bo, strokeColor=SLATE, strokeWidth=0.8))
    return d


def growth_chart(w, h, series, colour, title, months=12):
    """series: list of balances, index 0..months."""
    d = Drawing(w, h)
    L, Rt, T, Bo = 46, 8, 24, 20
    pw, ph = w - L - Rt, h - T - Bo
    top = max(series)
    # pick an axis top whose quarters are all round numbers
    for mult in (1, 10, 100):
        for c in (1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10):
            ymax = c * mult * 4e6
            if ymax >= top:
                break
        else:
            continue
        break

    d.add(String(0, h - 11, title, fontName="Helvetica-Bold", fontSize=8.6,
                 fillColor=NAVY))
    for k in range(5):
        y = Bo + ph * k / 4.0
        v = ymax * k / 4.0
        d.add(Line(L, y, L + pw, y, strokeColor=RULE, strokeWidth=0.5))
        d.add(String(L - 5, y - 2.6, "$%.0fM" % (v / 1e6), fontName="Helvetica",
                     fontSize=6.8, fillColor=SLATE, textAnchor="end"))
    for m in range(0, months + 1, 2):
        x = L + pw * m / float(months)
        d.add(String(x, Bo - 11, str(m), fontName="Helvetica", fontSize=6.8,
                     fillColor=SLATE, textAnchor="middle"))
    d.add(String(L + pw / 2.0, 1, "MONTH", fontName="Helvetica-Bold",
                 fontSize=6.4, fillColor=SLATE, textAnchor="middle"))

    pts = []
    for m, v in enumerate(series):
        pts += [L + pw * m / float(months), Bo + ph * v / ymax]
    d.add(Polygon(points=[L, Bo] + pts + [L + pw, Bo],
                  fillColor=colors.Color(colour.red, colour.green, colour.blue,
                                         0.13), strokeColor=None))
    d.add(PolyLine(points=pts, strokeColor=colour, strokeWidth=1.8))
    for m in range(0, months + 1, 3):
        d.add(Circle(pts[m * 2], pts[m * 2 + 1], 2.4, fillColor=colour,
                     strokeColor=colors.white, strokeWidth=0.9))
    d.add(Line(L, Bo, L + pw, Bo, strokeColor=SLATE, strokeWidth=0.8))
    d.add(String(L + pw, Bo + ph * series[-1] / ymax + 6,
                 "$%.1fM" % (series[-1] / 1e6), fontName="Helvetica-Bold",
                 fontSize=8, fillColor=colour, textAnchor="end"))
    return d


# A plausible per-trade outcome mix. Winners rarely reach the full target,
# scratches are common once the stop moves to entry, and costs come off every
# trade. Tuned to roughly +0.3R expectancy - a good, not exceptional, edge.
MIX = [(0.24, lambda r: r.uniform(1.9, 3.1)),    # runs to or near target
       (0.20, lambda r: r.uniform(0.2, 0.9)),    # partial or early exit
       (0.24, lambda r: r.uniform(-.05, .05)),   # scratched at break-even
       (0.32, lambda r: -1.0)]                   # full stop
COST_R = 0.08


def _trade(r):
    u, acc = r.random(), 0.0
    for prob, f in MIX:
        acc += prob
        if u <= acc:
            return f(r) - COST_R
    return -1.0 - COST_R


def realistic_year(seed=0, weeks=52):
    """One seeded year at 3-4 trades a week. Returns the equity path."""
    rnd = random.Random(seed)
    eq = [BALANCE]
    for w in range(weeks):
        n = 3 if w % 2 else 4
        eq.append(eq[-1] * (1 + sum(_trade(rnd) for _ in range(n)) / 100.0))
    return eq


def max_drawdown(path):
    peak, worst, at = path[0], 0.0, 0
    for i, v in enumerate(path):
        peak = max(peak, v)
        dd = 1 - v / peak
        if dd > worst:
            worst, at = dd, i
    return worst, at


def compound(weekly_r, months=12):
    m = (1 + weekly_r / 100.0) ** WEEKS_PER_MONTH
    return [BALANCE * m ** i for i in range(months + 1)]


# ================================================================== story ==
story = []

# ------------------------------------------------------------- PAGE 1 -----
story.append(Paragraph("THE PLAN, IN FOUR NUMBERS", Kick))
story.append(Paragraph("The Simple Version", H1))
hr = Table([[""]], colWidths=[CW], rowHeights=[2.4])
hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
story.append(hr)
story.append(Spacer(1, 10))

facts = [("BALANCE", money(BALANCE)), ("RISK PER TRADE", "1% = " + money(R)),
         ("TRADES PER WEEK", "5 - one each"), ("REWARD", "1:3 to 1:5")]
ft = Table([[Paragraph(
    "<font size='7.4' color='#5A6678'><b>%s</b></font><br/>"
    "<font size='13' color='#16233A'><b>%s</b></font>" % (k, v),
    st("f%d" % i, fontName="Helvetica", fontSize=7.4, leading=17))
    for i, (k, v) in enumerate(facts)]], colWidths=[CW / 4.0] * 4, hAlign="LEFT")
ft.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (0, 0), 0), ("LEFTPADDING", (1, 0), (-1, 0), 12),
    ("LINEBEFORE", (1, 0), (-1, 0), 0.7, RULE),
    ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(ft)
story.append(Spacer(1, 4))
story.append(note("HOW TO READ EVERY NUMBER IN THIS DOCUMENT",
    "<b>1R = %s.</b> That is what you lose if a stop is hit, and it is the "
    "same on all five assets. A 1:3 winner pays 3R = %s. A 1:5 winner pays "
    "5R = %s. Gold, oil, silver, bitcoin and the Dow - one trade each, "
    "once a week." % (money(R), money(3 * R), money(5 * R)),
    tint=GOLDL, bar=GOLD))

story.append(Paragraph("Week A - two stopped out, three winners", H2))
story.append(week_table(WEEK_A))
story.append(Spacer(1, 9))
story.append(band("WEEK A PROFIT", money(A_R * R, sign=True),
                  "<b>%+dR on the week</b>, or %+d%% of the balance. Two losses "
                  "cost %s between them; the three winners brought back %s."
                  % (A_R, A_R, money(2 * R), money(11 * R)),
                  tint=GREENL, bar=GREEN, vcol=GREEN))
story.append(Spacer(1, 8))
story.append(note("IF THE THIRD WINNER ALSO RUNS TO 1:5",
    "Two of the three winners were named as 1:3 and 1:5, so the third is taken "
    "as a 1:3 here. If it reaches 1:5 instead, the week is <b>+11R = %s</b> "
    "rather than +9R." % money(11 * R, sign=True), tint=ZEBRA, bar=SLATE))
story.append(PageBreak())

# ------------------------------------------------------------- PAGE 2 -----
story.append(Paragraph("SCENARIO TWO", Kick))
story.append(Paragraph("Week B - stops moved to entry", H1))
story.append(hr)
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Same five trades, same %s of risk on each. This time every position " % money(R) +
    "is moved to break-even once it goes your way, so four trades scratch out "
    "at entry for nothing instead of losing, and one runs all the way to 1:5.",
    Body))
story.append(Spacer(1, 4))
story.append(week_table(WEEK_B))
story.append(Spacer(1, 9))
story.append(band("WEEK B PROFIT", money(B_R * R, sign=True),
                  "<b>%+dR on the week</b>, or %+d%% of the balance - from a "
                  "single winning trade out of five." % (B_R, B_R),
                  tint=GREENL, bar=GREEN, vcol=GREEN))

story.append(Paragraph("What moving the stop to entry is worth", H2))
cmp_rows = [
    [Paragraph("<b>Stops left where they were</b>", TD),
     Paragraph("4 losses and 1 winner at 1:5", TD),
     Paragraph("<font color='#5A6678'><b>+1R</b></font>", TD),
     Paragraph("<font color='#5A6678'><b>%s</b></font>" % money(R, sign=True), TD)],
    [Paragraph("<b>Stops moved to entry</b>", TD),
     Paragraph("4 scratches and 1 winner at 1:5", TD),
     Paragraph("<font color='#2F6F4F'><b>+5R</b></font>", TD),
     Paragraph("<font color='#2F6F4F'><b>%s</b></font>" % money(5 * R, sign=True), TD)],
    [Paragraph("<b>Difference</b>", TDb), Paragraph("Same trades, same entries", TDb),
     Paragraph("<b>+4R</b>", TDb), Paragraph("<b>%s</b>" % money(4 * R, sign=True), TDb)],
]
ct = table(["MANAGEMENT", "OUTCOME", "R", "RESULT"],
           cmp_rows, [150, 186, 52, CW - 388], zebra=False)
ct.setStyle(TableStyle([
    ("BACKGROUND", (0, 3), (-1, 3), GOLDL),
    ("LINEABOVE", (0, 3), (-1, 3), 1.1, NAVY)]))
story.append(ct)
story.append(Spacer(1, 8))
story.append(note("THE POINT OF WEEK B",
    "Nothing about the trades changed - same entries, same stops, same targets. "
    "Only the management changed, and the week went from %s to %s. "
    % (money(R), money(5 * R)) +
    "The cost is that a trade which dips back to entry before running is now "
    "closed for nothing instead of eventually winning, so a real week lands "
    "somewhere between the two rows.", tint=GOLDL, bar=GOLD))
story.append(PageBreak())

# ------------------------------------------------------------- PAGE 3 -----
story.append(Paragraph("THE ONE MECHANIC THAT CHANGES EVERYTHING", Kick))
story.append(Paragraph("Moving the Stop to Entry", H1))
story.append(hr)
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Every trade opens with the stop where the idea is proven wrong - one "
    "risk unit away, %s. Once price has travelled that same distance <i>in "
    "your favour</i>, the stop is moved up to the price you entered at. "
    "From that moment the trade cannot cost you money." % money(R), Body))
story.append(Spacer(1, 6))
story.append(be_diagram(CW, 146))
story.append(Spacer(1, 10))

story.append(Paragraph("When to move it", H2))
story.append(Paragraph(
    "<b>When the trade is up by the same distance as the stop.</b> If your "
    "stop is 0.85 away from entry, you move it the moment price is 0.85 in "
    "profit. That single rule is the whole trigger - no judgement required.",
    Body))
when_rows = [
    ["<b>Too early</b>", "Half the stop distance",
     "Normal noise reaches back to your entry and scratches you out of trades "
     "that were working. You will have flat weeks that should have been good "
     "ones."],
    ["<b>The rule</b>", "<b>One full stop distance</b>",
     "<b>Far enough that price has genuinely moved, close enough that you stop "
     "carrying risk early in the trade.</b>"],
    ["<b>Too late</b>", "Two or more stop distances",
     "You carried the full %s of risk through most of the move. If it turns "
     "just before you move the stop, you lose the whole unit anyway." % money(R)],
]
story.append(table(["", "MOVE AT", "WHAT HAPPENS"],
                   [[Paragraph(c, TD) for c in r] for r in when_rows],
                   [76, 128, CW - 204]))

story.append(Paragraph("What it costs you", H2))
story.append(Paragraph(
    "It is not free - it trades away some winners to remove all the losers. "
    "Three things can happen after the trigger:", Body))
cost_rows = [
    ["Price runs straight to target",
     Paragraph("<font color='#2F6F4F'><b>%s</b></font>" % money(3 * R, True), TD),
     Paragraph("<font color='#2F6F4F'><b>%s</b></font>" % money(3 * R, True), TD),
     "No difference. The stop was never touched."],
    ["Price falls back to entry, then reverses",
     Paragraph("<font color='#9B3535'><b>%s</b></font>" % money(-R), TD),
     Paragraph("<font color='#5A6678'><b>%s</b></font>" % money(0), TD),
     "The stop saved a full loss."],
    ["Price falls back to entry, then runs to target",
     Paragraph("<font color='#2F6F4F'><b>%s</b></font>" % money(3 * R, True), TD),
     Paragraph("<font color='#5A6678'><b>%s</b></font>" % money(0), TD),
     "The stop cost you the winner. This is the price of the mechanic."],
]
story.append(table(
    ["AFTER THE TRIGGER, IF...", "STOP LEFT ALONE", "STOP AT ENTRY", ""],
    [[Paragraph(c, TD) if isinstance(c, str) else c for c in r]
     for r in cost_rows], [176, 92, 82, CW - 350]))
story.append(Spacer(1, 8))
story.append(note("THE TRADE YOU ARE MAKING",
    "You give up the third row to never suffer the second. Over a week of five "
    "trades the worst possible outcome stops being %s and becomes nothing at "
    "all, and why a week where only one trade works still finishes ahead. "
    "Whether it is worth it depends on how often price returns to your entry "
    "and still reaches target - your own log will tell you after thirty or "
    "forty trades. Until then, take the protection."
    % money(5 * R), tint=GOLDL, bar=GOLD))
story.append(PageBreak())

story.append(Paragraph("FOUR WEEKS", Kick))
story.append(Paragraph("The Monthly Total", H1))
story.append(hr)
story.append(Spacer(1, 10))

m_rows = []
for name, wr in (("Week A repeated", A_R), ("Week B repeated", B_R)):
    fixed = wr * WEEKS_PER_MONTH * R
    comp = BALANCE * ((1 + wr / 100.0) ** WEEKS_PER_MONTH - 1)
    m_rows.append([
        Paragraph("<b>%s</b>" % name, TD),
        Paragraph("%+dR" % wr, TD),
        Paragraph("%s" % money(wr * R, sign=True), TD),
        Paragraph("%+dR" % (wr * WEEKS_PER_MONTH), TD),
        Paragraph("<font color='#2F6F4F'><b>%s</b></font>"
                  % money(fixed, sign=True), TD),
        Paragraph("<font color='#2F6F4F'><b>%s</b></font>"
                  % money(comp, sign=True), TD)])
story.append(table(
    ["SCENARIO", "PER WEEK", "PER WEEK ($)", "PER MONTH",
     "MONTH, FIXED SIZE", "MONTH, COMPOUNDED"],
    m_rows, [96, 52, 80, 58, 92, CW - 378]))
story.append(Spacer(1, 5))
story.append(Paragraph(
    "<b>Fixed size</b> keeps 1R at %s all month. <b>Compounded</b> " % money(R) +
    "recalculates 1% from the new balance each week, so the winners get bigger "
    "as the account grows. Four trading weeks to a month.", Small))

story.append(Spacer(1, 8))
_ca = BALANCE * ((1 + A_R / 100.0) ** WEEKS_PER_MONTH - 1)
_cb = BALANCE * ((1 + B_R / 100.0) ** WEEKS_PER_MONTH - 1)
story.append(band("WEEK A - ONE MONTH", money(A_R * WEEKS_PER_MONTH * R, sign=True),
                  "Fixed sizing. Compounded weekly it is <b>%s</b>, taking the "
                  "balance to %s." % (money(_ca, sign=True), money(BALANCE + _ca)),
                  tint=GREENL, bar=GREEN, vcol=GREEN))
story.append(Spacer(1, 6))
story.append(band("WEEK B - ONE MONTH", money(B_R * WEEKS_PER_MONTH * R, sign=True),
                  "Fixed sizing. Compounded weekly it is <b>%s</b>, taking the "
                  "balance to %s." % (money(_cb, sign=True), money(BALANCE + _cb)),
                  tint=GREENL, bar=GREEN, vcol=GREEN))

story.append(Spacer(1, 14))
story.append(band("EVERY TRADE", money(R),
                  "Risk %s. Aim for %s to %s. Take five a week, one on each "
                  "asset. Move the stop to entry once it is going your way. "
                  "That is the entire system."
                  % (money(R), money(3 * R), money(5 * R)),
                  tint=GOLDL, bar=GOLD, vcol=NAVY))

story.append(PageBreak())

# ------------------------------------------------------------- PAGE 4 -----
story.append(Paragraph("EVERY OUTCOME, NOT JUST THE GOOD ONES", Kick))
story.append(Paragraph("Every Possible Week", H1))
story.append(hr)
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Five trades means six possible weeks - nothing wins, through to everything "
    "wins. Here is all of them, under three ways of running the same trades.",
    Body))
story.append(Spacer(1, 4))


def rcell(r):
    col = "#2F6F4F" if r > 0 else ("#9B3535" if r < 0 else "#5A6678")
    return Paragraph(
        "<font size='13' color='%s'><b>%+dR</b></font><br/>"
        "<font size='8.6' color='%s'>%s</font>"
        % (col, r, col, money(r * R, sign=True)),
        st("rc", fontName="Helvetica", fontSize=13, leading=16))


poss_rows = []
for w in range(6):
    poss_rows.append([
        Paragraph("<b>%d</b>" % w, TDb),
        Paragraph("<font color='#5A6678'>%d</font>" % (5 - w), TD),
        rcell(4 * w - 5),      # winners at 1:3, losers take the full stop
        rcell(6 * w - 5),      # winners at 1:5, losers take the full stop
        rcell(3 * w),          # winners at 1:3, losers scratch at entry
    ])
story.append(table(
    ["WINNERS", "LOSERS", "ALL WINNERS AT 1:3", "ALL WINNERS AT 1:5",
     "1:3, STOPS MOVED TO ENTRY"],
    poss_rows, [76, 66, 118, 118, CW - 378]))
story.append(Spacer(1, 6))
story.append(note("WHERE EACH COLUMN TURNS GREEN",
    "At <b>1:3 with full stops</b> you need <b>2 winners out of 5</b> to make "
    "money. At <b>1:5</b> you need <b>1</b>. With <b>stops moved to entry</b> "
    "the worst week is flat rather than %s - you cannot lose a week, only fail "
    "to make one. That last column is the whole argument for moving the stop, "
    "and it is why Week B matters more than Week A."
    % money(5 * R, sign=False), tint=GOLDL, bar=GOLD))

story.append(Paragraph("The average week", H2))
story.append(Paragraph(
    "The table above is what <i>can</i> happen. This is what it averages to "
    "over many weeks, for a given win rate - the number that actually "
    "determines whether the account grows.", Body))
avg_rows = []
for wr in (0.20, 0.30, 0.40, 0.50, 0.60):
    e3, e5 = 5 * (wr * 3 - (1 - wr)), 5 * (wr * 5 - (1 - wr))
    def cell(e):
        c = "#2F6F4F" if e > 0 else ("#9B3535" if e < 0 else "#5A6678")
        return Paragraph("<font color='%s'><b>%+.1fR</b></font>&nbsp;&nbsp;"
                         "<font color='%s'>%s</font>"
                         % (c, e, c, money(e * R, sign=True)), TD)
    avg_rows.append([Paragraph("<b>%d%%</b>" % round(wr * 100), TDb),
                     Paragraph("%.1f of 5" % (wr * 5), TD), cell(e3), cell(e5)])
story.append(table(["WIN RATE", "WINNERS A WEEK", "AVERAGE WEEK AT 1:3",
                    "AVERAGE WEEK AT 1:5"],
                   avg_rows, [84, 116, 150, CW - 350]))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "A 1:3 plan breaks even at a 25% win rate and a 1:5 plan at 16.7%, which "
    "is why the ratio matters more than being right. Costs - spread, "
    "commission, financing - are not in these numbers and take roughly 0.05R "
    "to 0.15R off every trade.", Small))
story.append(PageBreak())

story.append(Paragraph("WHAT A YEAR ACTUALLY LOOKS LIKE", Kick))
story.append(Paragraph("The Realistic Case", H1))
story.append(hr)
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Repeating Week A for a year would multiply the account <b>88 times</b>. "
    "That is not a plan, it is what happens when you assume fifty-two perfect "
    "weeks in a row. A real year is about <b>180 trades</b>, and the only "
    "number that decides where it ends is the average R those trades return.",
    Body))
story.append(Spacer(1, 4))

sc_rows = []
for e, label in ((-0.05, "Below break-even"), (0.10, "Modest edge"),
                 (0.25, "Good edge"), (0.45, "Exceptional edge")):
    wk = e * 3.5 / 100.0
    yr = (1 + wk) ** 52 - 1
    col = "#2F6F4F" if yr > 0 else "#9B3535"
    sc_rows.append([
        Paragraph("<b>%+.2fR</b>" % e, TDb),
        Paragraph("<font color='#5A6678'>%s</font>" % label, TD),
        Paragraph("<font color='%s'>%+.2f%%</font>" % (col, wk * 100), TD),
        Paragraph("<font color='%s'><b>%+.0f%%</b></font>" % (col, yr * 100), TD),
        Paragraph("<font color='%s'><b>%s</b></font>"
                  % (col, money(BALANCE * (1 + yr))), TD)])
story.append(table(
    ["AVERAGE PER TRADE", "", "PER WEEK", "OVER 12 MONTHS", "ENDING BALANCE"],
    sc_rows, [110, 122, 74, 106, CW - 412]))
story.append(Spacer(1, 5))
story.append(Paragraph(
    "Assumes 3.5 trades a week. The difference between losing money and "
    "doubling it is a third of one R.", Small))

_eq = realistic_year(seed=0)
_dd, _at = max_drawdown(_eq)
story.append(Paragraph("One plausible year, week by week", H2))
story.append(week_chart(CW, 186, _eq, GOLD, _at))
story.append(Spacer(1, 5))
story.append(Paragraph(
    "A simulated year at roughly +0.3R a trade - a good edge, not a "
    "spectacular one. It ends at <b>%s</b>, <b>%+.0f%%</b>, having spent the "
    "first quarter below where it started and given back <b>%.0f%%</b> at its "
    "worst point. That shape, not a smooth curve, is what a winning year "
    "looks like." % (money(_eq[-1]), (_eq[-1] / BALANCE - 1) * 100, _dd * 100),
    Small))
story.append(Spacer(1, 7))
story.append(note("THE PART NOBODY PUTS ON A CHART",
    "The first thirteen weeks of that simulation lose money. Most people "
    "change something at that point - size up to catch up, widen a stop, take "
    "a 1:2 because nothing better is there - and the edge that would have paid "
    "over the remaining thirty-nine weeks stops existing. The method is not "
    "the hard part.", tint=GOLDL, bar=GOLD))

story.append(Spacer(1, 9))
story.append(note("IMPORTANT",
    "This document is an educational illustration of a risk and position-sizing "
    "method. It is <b>not financial, investment or trading advice</b> and "
    "contains no recommendation to buy or sell any instrument. "
    "<b>Every figure in it is hypothetical.</b> None of it represents actual "
    "trades, actual results, or a projection of future performance - the "
    "returns shown are what the arithmetic produces if an assumed sequence of "
    "outcomes occurs, and no such sequence is predicted or promised. Leveraged "
    "trading carries a high risk of rapid loss and on some accounts losses can "
    "exceed the amount deposited. Costs are excluded throughout and reduce "
    "every result shown. No method guarantees a profit, and losing weeks and "
    "months are a normal part of this one. Past performance does not indicate "
    "future results. Seek independent advice if you are unsure.",
    tint=colors.HexColor("#F4F5F7"), bar=SLATE))


# ================================================================== build ==
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="The Simple Version - %s Weekly Plan" % money(BALANCE),
                      subject="Worked example: 1% risk per trade on five assets "
                              "at 1:3 to 1:5")
doc.addPageTemplates([PageTemplate(
    id="content",
    frames=[Frame(MARGIN, 15 * mm, CW, PAGE_H - 30 * mm, id="c",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
    onPage=page)])
doc.build(story)
print("wrote %s" % OUT)
