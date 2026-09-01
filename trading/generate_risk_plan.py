#!/usr/bin/env python3
"""
Generates "The Weekly 5-Asset Risk Cycle" — a printable risk-management and
position-sizing plan for XAUUSD, WTIUSD, XAGUSD, BTCUSD and DJIUSD.

Usage:  python3 trading/generate_risk_plan.py
Output: trading/Weekly-5-Asset-Risk-Cycle.pdf

Only WinAnsi-safe glyphs are used (no arrows, no unicode sub/superscripts),
so the built-in Helvetica family renders every character.
"""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, NextPageTemplate, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, KeepTogether,
)

OUT = "trading/Weekly-5-Asset-Risk-Cycle.pdf"

# ----------------------------------------------------------------- palette --
INK      = colors.HexColor("#101826")   # near-black navy, body text
NAVY     = colors.HexColor("#16233A")   # headers / cover ground
GOLD     = colors.HexColor("#C2963F")   # accent
GOLD_LT  = colors.HexColor("#F2E7CE")
SLATE    = colors.HexColor("#5A6678")   # secondary text
RULE     = colors.HexColor("#D5DAE2")
ZEBRA    = colors.HexColor("#F5F7FA")
BOXBG    = colors.HexColor("#FBF8F1")
GREEN    = colors.HexColor("#2F6F4F")
RED      = colors.HexColor("#9B3535")

PAGE_W, PAGE_H = A4
MARGIN = 17 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

# ------------------------------------------------------------------ styles --
ss = getSampleStyleSheet()

def st(name, **kw):
    base = kw.pop("parent", ss["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

Body = st("Body", fontName="Helvetica", fontSize=9.2, leading=13.4,
          textColor=INK, spaceAfter=6, alignment=TA_JUSTIFY)
BodyC = st("BodyC", parent=Body, alignment=TA_CENTER)
Lead = st("Lead", fontName="Helvetica", fontSize=10.4, leading=15.6,
          textColor=SLATE, spaceAfter=9)
H1 = st("H1", fontName="Helvetica-Bold", fontSize=17, leading=20,
        textColor=NAVY, spaceBefore=0, spaceAfter=2)
H2 = st("H2", fontName="Helvetica-Bold", fontSize=11.4, leading=14,
        textColor=NAVY, spaceBefore=11, spaceAfter=4)
H3 = st("H3", fontName="Helvetica-Bold", fontSize=9.4, leading=12,
        textColor=GOLD, spaceBefore=8, spaceAfter=3)
Kicker = st("Kicker", fontName="Helvetica-Bold", fontSize=7.6, leading=10,
            textColor=GOLD, spaceAfter=3)
Small = st("Small", fontName="Helvetica", fontSize=7.8, leading=11,
           textColor=SLATE, spaceAfter=4)
SmallI = st("SmallI", parent=Small, fontName="Helvetica-Oblique")
Bullet = st("Bullet", parent=Body, leftIndent=11, bulletIndent=2,
            spaceAfter=3, alignment=0)
TD = st("TD", fontName="Helvetica", fontSize=8.0, leading=10.6, textColor=INK)
TDb = st("TDb", parent=TD, fontName="Helvetica-Bold")
TH = st("TH", fontName="Helvetica-Bold", fontSize=7.8, leading=10.2,
        textColor=colors.white)
Mono = st("Mono", fontName="Courier-Bold", fontSize=9.6, leading=13,
          textColor=NAVY, alignment=TA_CENTER)

CoverTitle = st("CoverTitle", fontName="Helvetica-Bold", fontSize=33, leading=37,
                textColor=colors.white)
CoverSub = st("CoverSub", fontName="Helvetica", fontSize=12.4, leading=18,
              textColor=GOLD_LT)
CoverKick = st("CoverKick", fontName="Helvetica-Bold", fontSize=8.6, leading=12,
               textColor=GOLD)


def bullets(items, style=Bullet):
    return [Paragraph(t, style, bulletText="•") for t in items]


# ------------------------------------------------------------ page canvas --
def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # gold rule band
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_H - 14 * mm, PAGE_W, 3, stroke=0, fill=1)
    canvas.rect(MARGIN, 74 * mm, 46 * mm, 2, stroke=0, fill=1)
    # faint asset watermark grid
    canvas.setFont("Helvetica-Bold", 40)
    canvas.setFillColor(colors.HexColor("#1D2C46"))
    for i, tick in enumerate(["DJI", "BTC", "XAG", "WTI", "XAU"]):
        canvas.drawRightString(PAGE_W - MARGIN, 196 * mm + i * 13 * mm, tick)
    canvas.setFont("Helvetica", 7.2)
    canvas.setFillColor(colors.HexColor("#8794A8"))
    canvas.drawString(MARGIN, 20 * mm,
                      "Educational risk framework. Not financial advice. "
                      "Verify all contract specifications with your broker.")
    canvas.restoreState()


def content_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # header
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 11 * mm, PAGE_W, 11 * mm, stroke=0, fill=1)
    canvas.setFillColor(GOLD)
    canvas.rect(0, PAGE_H - 11 * mm - 1.6, PAGE_W, 1.6, stroke=0, fill=1)
    canvas.setFont("Helvetica-Bold", 7.4)
    canvas.setFillColor(GOLD_LT)
    canvas.drawString(MARGIN, PAGE_H - 7.3 * mm, "THE WEEKLY 5-ASSET RISK CYCLE")
    canvas.setFont("Helvetica", 7.4)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 7.3 * mm,
                           "1% per asset  |  5 assets  |  1 cycle  |  1:3 to 1:5")
    # footer
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 12 * mm, PAGE_W - MARGIN, 12 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(SLATE)
    canvas.drawString(MARGIN, 8.4 * mm,
                      "Risk framework and educational template - not financial advice.")
    canvas.setFont("Helvetica-Bold", 7)
    canvas.setFillColor(NAVY)
    canvas.drawRightString(PAGE_W - MARGIN, 8.4 * mm, "%d" % (doc.page - 1))
    canvas.restoreState()


# ------------------------------------------------------------- components --
def data_table(header, rows, widths, align_right=(), zebra=True, fs=8.0):
    data = [[Paragraph(h, TH) for h in header]]
    for r in rows:
        data.append([c if isinstance(c, Paragraph) else Paragraph(str(c), TD)
                     for c in r])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE),
        ("BOX", (0, 0), (-1, -1), 0.7, RULE),
    ]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                cmds.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    for c in align_right:
        cmds.append(("ALIGN", (c, 0), (c, -1), "RIGHT"))
    t.setStyle(TableStyle(cmds))
    return t


def callout(title, body_flowables, tint=BOXBG, bar=GOLD):
    inner = []
    if title:
        inner.append(Paragraph(title, Kicker))
    inner.extend(body_flowables)
    t = Table([["", inner]], colWidths=[3.2, CONTENT_W - 3.2], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), bar),
        ("BACKGROUND", (1, 0), (1, 0), tint),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, 0), 9),
        ("RIGHTPADDING", (1, 0), (1, 0), 9),
        ("TOPPADDING", (1, 0), (1, 0), 7),
        ("BOTTOMPADDING", (1, 0), (1, 0), 4),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
    ]))
    return t


def formula_box(text, note=None):
    inner = [Paragraph(text, Mono)]
    if note:
        inner.append(Spacer(1, 3))
        inner.append(Paragraph(note, ParagraphStyle(
            "fn", parent=Small, alignment=TA_CENTER)))
    t = Table([[inner]], colWidths=[CONTENT_W], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD_LT),
        ("BOX", (0, 0), (-1, -1), 0.8, GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def checklist(title, items, colw=None):
    """Printable checklist: an empty ruled box per line."""
    rows = [[Paragraph("", TD), Paragraph(i, TD)] for i in items]
    t = Table(rows, colWidths=[10, (colw or CONTENT_W) - 10], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (0, -1), 0, colors.white),
        ("INNERGRID", (0, 0), (0, -1), 0, colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.4),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 0),
        ("LEFTPADDING", (1, 0), (1, -1), 9),
    ]))
    # draw the boxes
    for i in range(len(items)):
        t.setStyle(TableStyle([("BOX", (0, i), (0, i), 0.8, SLATE)]))
    out = []
    if title:
        out.append(Paragraph(title, H3))
    out.append(t)
    return out


def section(number, title, standfirst=None):
    out = [Paragraph("SECTION %s" % number, Kicker),
           Paragraph(title, H1),
           Spacer(1, 2)]
    hr = Table([[""]], colWidths=[CONTENT_W], rowHeights=[2])
    hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
    out.append(hr)
    out.append(Spacer(1, 8))
    if standfirst:
        out.append(Paragraph(standfirst, Lead))
    return out


# ============================================================ build story ==
story = []

# ------------------------------------------------------------- 0. COVER ---
story.append(Spacer(1, 96 * mm))
story.append(Paragraph("POSITION SIZING &amp; RISK PROTOCOL", CoverKick))
story.append(Spacer(1, 6))
story.append(Paragraph("The Weekly<br/>5-Asset<br/>Risk Cycle", CoverTitle))
story.append(Spacer(1, 22 * mm))
story.append(Paragraph(
    "Gold &bull; Oil &bull; Silver &bull; Bitcoin &bull; Dow Jones<br/>"
    "One percent of capital per asset. Five positions per cycle.<br/>"
    "Nothing taken below a 1:3 reward-to-risk ratio.", CoverSub))
story.append(Spacer(1, 14 * mm))
cover_facts = Table([[
    Paragraph("<font color='#C2963F' size='16'><b>1%</b></font><br/>"
              "<font color='#F2E7CE' size='7.4'>MAX RISK PER ASSET</font>",
              st("cf", fontName="Helvetica", fontSize=7.4, leading=11)),
    Paragraph("<font color='#C2963F' size='16'><b>5</b></font><br/>"
              "<font color='#F2E7CE' size='7.4'>ASSETS PER CYCLE</font>",
              st("cf2", fontName="Helvetica", fontSize=7.4, leading=11)),
    Paragraph("<font color='#C2963F' size='16'><b>5%</b></font><br/>"
              "<font color='#F2E7CE' size='7.4'>MAX WEEKLY HEAT</font>",
              st("cf3", fontName="Helvetica", fontSize=7.4, leading=11)),
    Paragraph("<font color='#C2963F' size='16'><b>3-5R</b></font><br/>"
              "<font color='#F2E7CE' size='7.4'>TARGET PER TRADE</font>",
              st("cf4", fontName="Helvetica", fontSize=7.4, leading=11)),
]], colWidths=[CONTENT_W / 4.0] * 4, hAlign="LEFT")
cover_facts.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (0, 0), 0),
    ("LINEBEFORE", (1, 0), (-1, 0), 0.7, colors.HexColor("#33425C")),
    ("LEFTPADDING", (1, 0), (-1, 0), 10),
]))
story.append(cover_facts)
story.append(NextPageTemplate("content"))
story.append(PageBreak())

# ------------------------------------------------ 1. THE RULES (one page) --
story += section(
    "01", "The Constitution",
    "Nine rules. If a trade breaks any one of them it does not get taken, "
    "however good it looks. Everything else in this document exists only to "
    "make these nine rules mechanical.")

rules = [
    ("R1", "One percent, no exceptions",
     "Risk on any single position is 1.00% of current account equity, measured "
     "from entry to the protective stop. Not 1.2% because the setup is clean. "
     "Not 2% to make back yesterday."),
    ("R2", "Five assets, one cycle",
     "The cycle is one trading week: Monday open to Friday close. XAUUSD, "
     "WTIUSD, XAGUSD, BTCUSD and DJIUSD each get at most one open position "
     "per cycle. Five slots. No sixth instrument."),
    ("R3", "Maximum heat is 5%",
     "With all five slots filled, total capital at risk is 5.00%. That is the "
     "ceiling for the account, and it is reduced by the correlation caps in "
     "Section 06."),
    ("R4", "Minimum 1:3, target 1:5",
     "The stop is placed where the idea is proven wrong; the target is placed "
     "at the next real structural level. If the distance between them is not "
     "at least three times the stop, there is no trade."),
    ("R5", "The stop is set before entry",
     "Entry, stop and target are defined and the order is bracketed before "
     "the position exists. A stop is never widened once live. It may only "
     "move in the direction of profit."),
    ("R6", "Size is an output, never an input",
     "Position size is calculated from the stop distance, never chosen first. "
     "A wide stop means a small position, not a bigger risk."),
    ("R7", "Two strikes per asset",
     "After two stop-outs on the same asset inside one cycle, that asset is "
     "closed for the week. Its slot stays empty."),
    ("R8", "The weekly circuit breaker",
     "At -3R cumulative in a cycle, trading stops until the next Monday. At "
     "-6R in a calendar month, size halves to 0.5% until the account makes a "
     "new equity high."),
    ("R9", "Unjournalled trade, invalid trade",
     "Every position is logged with its R multiple and its grade before the "
     "next one is opened. The log in Section 08 is the scoreboard."),
]
rule_rows = [[Paragraph("<b>%s</b>" % n, TDb),
              Paragraph("<b>%s</b><br/><font size='7.6' color='#5A6678'>%s</font>"
                        % (t, d), TD)] for n, t, d in rules]
story.append(data_table(["", "RULE"], rule_rows, [26, CONTENT_W - 26]))
story.append(Spacer(1, 9))
story.append(callout("READ THE BRIEF THIS WAY", bullets([
    "<b>1R = 1% of equity = the loss taken if the stop is hit.</b> Every number "
    "in this document is expressed in R so that it stays true at any account size.",
    "A 1:3 trade returns +3R (+3% of equity) when it works and -1R (-1%) when it "
    "does not. A 1:5 returns +5R against the same -1R.",
    "\"Heat\" means capital currently exposed: open positions multiplied by their "
    "distance to stop.",
])))
story.append(PageBreak())

# ------------------------------------------- 2. RISK ARCHITECTURE / MATH ---
story += section(
    "02", "Why 1% and 1:3 Work Together",
    "The two constraints are not independent. A 1:3 floor is what makes a 1% "
    "risk survivable, and a 1% risk is what makes a low win rate affordable "
    "while you wait for the 1:3 to pay.")

story.append(Paragraph("Break-even win rate", H2))
story.append(Paragraph(
    "A strategy is profitable the moment the win rate clears 1 / (1 + R). This "
    "is the single most important number in the plan, because it tells you how "
    "wrong you are allowed to be:", Body))
be_rows = [
    ["1:3", "25.0%", "You may lose 3 of every 4 trades and still break even."],
    ["1:4", "20.0%", "You may lose 4 of every 5 trades and still break even."],
    ["1:5", "16.7%", "You may lose 5 of every 6 trades and still break even."],
]
story.append(data_table(
    ["REWARD : RISK", "BREAK-EVEN WIN RATE", "WHAT THAT BUYS YOU"],
    be_rows, [80, 108, CONTENT_W - 188]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "This is the whole argument for the 1:3 floor. It converts trading from a "
    "prediction problem into a patience problem.", SmallI))

story.append(Paragraph("Expectancy per trade and per cycle", H2))
story.append(formula_box(
    "E  =  (Win% x R)  -  (Loss% x 1)",
    "Expectancy in R per trade. Multiply by 5 for a full cycle of five assets."))
story.append(Spacer(1, 7))

exp_header = ["WIN RATE", "1:3 / TRADE", "1:3 / CYCLE", "1:4 / TRADE",
              "1:4 / CYCLE", "1:5 / TRADE", "1:5 / CYCLE"]
raw = [(0.20,), (0.25,), (0.30,), (0.35,), (0.40,), (0.50,)]
exp_rows = []
for (w,) in raw:
    row = ["%d%%" % round(w * 100)]
    for R in (3, 4, 5):
        e = w * R - (1 - w)
        col = GREEN if e > 0.001 else (RED if e < -0.001 else SLATE)
        row.append(Paragraph("<font color='%s'><b>%+.2fR</b></font>"
                             % ('#' + col.hexval()[2:], e), TD))
        row.append(Paragraph("<font color='%s'>%+.1f%%</font>"
                             % ('#' + col.hexval()[2:], e * 5), TD))
    exp_rows.append(row)
cw = [52] + [(CONTENT_W - 52) / 6.0] * 6
story.append(data_table(exp_header, exp_rows, cw))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Cycle figures assume all five slots are filled and every trade risks a "
    "clean 1R. They are arithmetic, not a forecast: they describe what a given "
    "win rate is worth, not what your win rate will be. Costs (spread, "
    "commission, swap, slippage) typically shave 0.05R to 0.15R per trade and "
    "are not included.", Small))

story.append(Paragraph("What the 1% ceiling actually protects", H2))
_dd_notes = [
    (5, "Routine. Expect this several times a year."),
    (8, "Uncomfortable, but statistically ordinary at a 30% win rate."),
    (10, "The circuit breakers in R8 will have fired well before this."),
    (15, "System review required before any further risk is taken."),
    (20, "Stop. Something structural is broken."),
]
dd_rows = []
for n, note in _dd_notes:
    dd = 1.0 - 0.99 ** n                      # risking 1% of *current* equity
    recover = (1.0 / (1.0 - dd)) - 1.0
    dd_rows.append([str(n), "%.2f%%" % (dd * 100), "%.2f%%" % (recover * 100), note])
story.append(data_table(
    ["CONSECUTIVE 1R LOSSES", "RESULTING DRAWDOWN", "GAIN NEEDED TO RECOVER",
     "READING"],
    dd_rows, [92, 96, 104, CONTENT_W - 292]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Drawdowns are compounded: each loss risks 1% of what is left, so ten "
    "losses cost 9.56% and need a 10.57% gain to repair. Run the same ten "
    "losses at 5% risk and the account is down 40.1% and needs a 67.0% gain to "
    "get back. That asymmetry between the two columns, not the upside, is the "
    "entire case for the 1% number.", Small))
story.append(PageBreak())

# ------------------------------------------------- 3. POSITION SIZING -----
story += section(
    "03", "Position Sizing",
    "Size is never chosen. It is solved for. Fix the risk at 1%, measure the "
    "stop, and the correct number of units falls out of the arithmetic.")

story.append(formula_box(
    "UNITS  =  (Equity x 0.01)  /  (Stop Distance x Value Per Unit)",
    "Stop distance in the instrument's own quote units. Value per unit is what "
    "one full point of price movement is worth on one unit of the contract."))
story.append(Spacer(1, 10))

story.append(Paragraph("Contract values - verify each one with your broker", H2))
story.append(Paragraph(
    "Contract specifications differ materially between brokers, and silver and "
    "the Dow are the two that catch people out. Fill the last column in from "
    "your own platform before sizing a single trade: an error here is an error "
    "in every position you take afterwards.", Body))
spec_rows = [
    ["<b>XAUUSD</b><br/><font size='7.2' color='#5A6678'>Gold</font>",
     "100 troy oz", "USD per $1.00 move", "$100.00", "0.01",
     "________"],
    ["<b>WTIUSD</b><br/><font size='7.2' color='#5A6678'>Crude oil</font>",
     "1,000 barrels", "USD per $1.00 move", "$1,000.00", "0.01",
     "________"],
    ["<b>XAGUSD</b><br/><font size='7.2' color='#5A6678'>Silver</font>",
     "5,000 troy oz", "USD per $1.00 move", "$5,000.00", "0.001",
     "________"],
    ["<b>BTCUSD</b><br/><font size='7.2' color='#5A6678'>Bitcoin</font>",
     "1 BTC", "USD per $1.00 move", "$1.00", "0.01",
     "________"],
    ["<b>DJIUSD</b><br/><font size='7.2' color='#5A6678'>Dow Jones 30</font>",
     "1 index point", "USD per 1.0 point", "$1.00 to $10.00", "0.10",
     "________"],
]
spec_rows = [[Paragraph(c, TD) for c in r] for r in spec_rows]
story.append(data_table(
    ["INSTRUMENT", "STANDARD LOT (1.00)", "QUOTED IN",
     "TYPICAL VALUE / LOT", "MIN. STEP", "YOUR BROKER"],
    spec_rows, [72, 82, 86, 86, 46, CONTENT_W - 372]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "The Dow is deliberately shown as a range. Some brokers quote $1 per point "
    "per lot, others $10, and a few price the contract in the index currency "
    "rather than USD. Confirm it, then never assume it again.", Small))

story.append(PageBreak())
story.append(Paragraph("Worked cycle - $10,000 account, $100 risk per asset", H2))
work = [
    ("XAUUSD", "$3,412.00", "$3,400.00", "$12.00", 100.0, "lots"),
    ("WTIUSD", "$78.40", "$77.20", "$1.20", 1000.0, "lots"),
    ("XAGUSD", "$38.90", "$38.30", "$0.60", 5000.0, "lots"),
    ("BTCUSD", "$92,400", "$90,600", "$1,800", 1.0, "BTC"),
    ("DJIUSD", "44,150", "43,850", "300 pts", 1.0, "lots @ $1/pt"),
]
work_rows = []
for name, entry, stop, dist, vpu, unit in work:
    d = float(dist.replace("$", "").replace(",", "").replace(" pts", ""))
    size = 100.0 / (d * vpu)
    work_rows.append([
        Paragraph("<b>%s</b>" % name, TD), entry, stop, dist,
        Paragraph("$%s" % ("{:,.2f}".format(vpu)), TD),
        Paragraph("<b>%.3f</b> <font size='7' color='#5A6678'>%s</font>"
                  % (size, unit), TD),
        Paragraph("<b>$100</b>", TD)])
story.append(data_table(
    ["ASSET", "ENTRY", "STOP", "STOP DIST.", "VALUE / UNIT", "POSITION SIZE",
     "RISK"],
    work_rows,
    [58, 62, 62, 60, 66, CONTENT_W - 348 - 40, 40]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Prices above are illustrative placeholders for the arithmetic. Note what "
    "the table demonstrates: five completely different instruments, five wildly "
    "different position sizes, and identical risk on every one. That is the "
    "entire point of the method.", Small))

story.append(Paragraph("The 1% in cash, by account size", H2))
sz_rows = []
for eq in (1000, 2500, 5000, 10000, 25000, 50000, 100000):
    sz_rows.append([
        Paragraph("<b>${:,}</b>".format(eq), TD),
        "${:,.2f}".format(eq * 0.01),
        "${:,.2f}".format(eq * 0.05),
        "${:,.2f}".format(eq * 0.03),
        "${:,.2f}".format(eq * 0.03),
        "${:,.2f}".format(eq * 0.05),
    ])
story.append(data_table(
    ["EQUITY", "1R (RISK / ASSET)", "MAX HEAT (5R)", "CIRCUIT BREAKER (-3R)",
     "A 1:3 WINNER (+3R)", "A 1:5 WINNER (+5R)"],
    sz_rows, [66, 92, 84, 100, 88, CONTENT_W - 430], align_right=(1, 2, 3, 4, 5)))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Recalculate 1R from equity every Monday morning, not every trade. Sizing "
    "off intra-week equity makes you smaller after losses and larger after "
    "wins inside the same cycle, which quietly changes the strategy you are "
    "running.", Small))

story.append(Paragraph("Blank worksheet - one per cycle", H2))
story.append(Paragraph(
    "Fill this in on Sunday, before the market can influence the arithmetic. "
    "The last column is the only check that matters: every row must read the "
    "same number.", Body))
ws_rows = []
for a in ["XAUUSD", "WTIUSD", "XAGUSD", "BTCUSD", "DJIUSD"]:
    ws_rows.append([Paragraph("<b>%s</b>" % a, TD)] + [""] * 6)
wsw = [58, 62, 62, 62, 66, 82]
wsw.append(CONTENT_W - sum(wsw))
ws = data_table(
    ["ASSET", "ENTRY", "STOP", "STOP DIST.", "VALUE / UNIT", "POSITION SIZE",
     "RISK = 1R?"],
    ws_rows, wsw, zebra=False)
ws.setStyle(TableStyle([
    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
    ("TOPPADDING", (0, 1), (-1, -1), 12),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 12),
]))
story.append(ws)
story.append(Spacer(1, 8))
story.append(callout("THE SANITY CHECK THAT CATCHES EVERY SIZING ERROR", [Paragraph(
    "Once the size is calculated, multiply it back out: <b>position size x stop "
    "distance x value per unit</b>. If that does not come back to 1R in cash, "
    "the value-per-unit figure is wrong for your broker - and it will be wrong "
    "on every trade you place in this instrument until you fix it. This is the "
    "single most common way a disciplined 1% plan quietly becomes a 3% one.",
    Body)]))
story.append(PageBreak())

# ------------------------------------------------ 4. STOPS AND TARGETS ----
story += section(
    "04", "Placing the Stop and the Target",
    "The 1:3 floor is only honest if the stop is placed where the trade is "
    "genuinely wrong. A stop tightened purely to manufacture a 1:5 ratio is not "
    "a better trade, it is a worse one with better arithmetic on paper.")

story.append(Paragraph("Stop placement, in order of precedence", H2))
story.append(Table([[
    [Paragraph("1. STRUCTURE", H3),
     Paragraph("Place the stop beyond the swing high or low that invalidates "
               "the idea, plus a buffer of 0.25 x ATR(14) to clear the noise "
               "around the level. This is the default.", Body)],
    [Paragraph("2. VOLATILITY", H3),
     Paragraph("Where structure is unclear, use 1.5 x ATR(14) on your entry "
               "timeframe. Where structure and volatility disagree, take the "
               "wider of the two and accept the smaller position.", Body)],
    [Paragraph("3. NEVER", H3),
     Paragraph("A stop chosen because it produces a convenient lot size, or "
               "because a tighter one \"makes the R:R work\". If the honest "
               "stop kills the 1:3, the trade is the problem.", Body)],
]], colWidths=[CONTENT_W / 3.0] * 3, hAlign="LEFT",
    style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 0),
        ("LEFTPADDING", (1, 0), (-1, 0), 10),
        ("RIGHTPADDING", (0, 0), (-2, 0), 10),
        ("LINEBEFORE", (1, 0), (-1, 0), 0.7, RULE),
    ])))

story.append(Paragraph("The scale-out that produces a 1:3 to 1:5 blend", H2))
story.append(Paragraph(
    "Taking the full position off at 3R caps you at 3R forever. Running the "
    "whole position to 5R gives back winners that stall at 4R. The split below "
    "resolves both, and it is what the \"1:3 to 1:5\" range in this plan "
    "actually means in practice:", Body))
scale_rows = [
    ["<b>Entry</b>", "100% of position", "-", "Stop at full 1R risk. Bracket order in place before fill."],
    ["<b>TP1 at 3R</b>", "Close 50%", "+1.50R banked",
     "Move the stop on the remaining half to break-even at the same moment. "
     "The trade can no longer lose."],
    ["<b>Trail</b>", "Remaining 50%", "-",
     "Trail behind each new swing, or behind a 2 x ATR(14) band, whichever is "
     "further from price."],
    ["<b>TP2 at 5R</b>", "Close 50%", "+2.50R banked", "Total on the trade: +4.00R."],
]
scale_rows = [[Paragraph(c, TD) for c in r] for r in scale_rows]
story.append(data_table(
    ["STAGE", "SIZE ACTED ON", "CONTRIBUTION", "MECHANICS"],
    scale_rows, [70, 82, 86, CONTENT_W - 238]))

story.append(Spacer(1, 8))
out_rows = [
    ["Stopped out before TP1", Paragraph("<font color='#9B3535'><b>-1.00R</b></font>", TD),
     "The ordinary outcome. Roughly two thirds of trades."],
    ["TP1 hit, then stopped at break-even",
     Paragraph("<font color='#2F6F4F'><b>+1.50R</b></font>", TD),
     "The reason TP1 exists. A failed trade that still pays."],
    ["TP1 hit, trailed out between 3R and 5R",
     Paragraph("<font color='#2F6F4F'><b>+1.50 to +4.00R</b></font>", TD),
     "The most common winning outcome."],
    ["Both targets filled", Paragraph("<font color='#2F6F4F'><b>+4.00R</b></font>", TD),
     "The trade the whole framework is built to catch."],
]
out_rows = [[Paragraph(c, TD) if isinstance(c, str) else c for c in r]
            for r in out_rows]
story.append(data_table(["OUTCOME", "RESULT", "NOTE"],
                        out_rows, [190, 96, CONTENT_W - 286]))
story.append(Spacer(1, 6))
story.append(callout("THE ONE THING THIS STRUCTURE COSTS YOU", [Paragraph(
    "Scaling out at TP1 caps the best case at +4.00R instead of +5.00R, and "
    "converts some would-be 5R runners into +1.50R break-even exits. You are "
    "buying a smoother equity curve and a much higher proportion of trades "
    "that do not lose money, and paying for it in average winner size. That is "
    "a deliberate trade of expectancy for durability. If "
    "your record shows you can sit through the pullback from 3R to 5R without "
    "interfering, running the full position is mathematically better - and "
    "harder.", Body)]))
story.append(PageBreak())

# -------------------------------------------------- 5. ASSET PLAYBOOK -----
story += section(
    "05", "The Five Assets",
    "Same 1% on each, but they do not behave the same way. Each profile below "
    "is the reason a stop on one instrument cannot be reasoned about using the "
    "habits of another.")

assets = [
    ("XAUUSD", "GOLD",
     "Trends cleanly and respects horizontal levels better than anything else "
     "in the basket. Driven by real yields, the dollar and haven demand.",
     "London open and the US session. Thin and prone to false breaks during "
     "the Asian session.",
     "US CPI, FOMC decisions and dot plots, NFP, real-yield moves, "
     "geopolitical escalation.",
     "Sharp two-way spikes on data releases can hunt an obvious stop and then "
     "resume the original direction."),
    ("WTIUSD", "CRUDE OIL",
     "The most headline-sensitive instrument here and the most prone to gaps. "
     "Inventory-driven in the short run, supply-policy-driven over weeks.",
     "US session. Reliably violent around 10:30 ET on Wednesdays.",
     "EIA crude inventories (Wed 10:30 ET), API (Tue), OPEC+ meetings, supply "
     "disruption headlines, contract rollover.",
     "Never hold an oil position through an EIA print or an OPEC+ meeting on a "
     "1:3 plan. Widen the stop or stand aside."),
    ("XAGUSD", "SILVER",
     "Gold's higher-beta cousin with an industrial demand leg. Typically moves "
     "1.5x to 2.5x gold's percentage range, with far worse liquidity.",
     "London and US overlap. Spreads widen noticeably outside it.",
     "Everything that moves gold, amplified, plus industrial and solar demand "
     "data and the gold/silver ratio.",
     "Wider spreads and thinner books mean a stop that would be fine on gold "
     "is a coin flip here. Size off silver's own ATR, never gold's."),
    ("BTCUSD", "BITCOIN",
     "Trades 24/7, including the weekend, which makes it the only asset in the "
     "basket that can move while the plan is closed.",
     "US session for the largest moves; liquidity thins sharply on Sunday.",
     "ETF flow data, liquidation cascades, regulatory headlines, correlation "
     "with the Nasdaq during risk-off.",
     "Weekend risk is real and unhedgeable. Either close the position on "
     "Friday or size the weekend carry deliberately, at half of 1R."),
    ("DJIUSD", "DOW JONES 30",
     "Price-weighted, so a handful of high-priced constituents drive it. "
     "Gaps between the cash close and the next open.",
     "US cash session, 09:30 to 16:00 ET. Overnight index moves are thinner "
     "and less reliable.",
     "FOMC, CPI, NFP, index-heavyweight earnings, and month-end and "
     "quarter-end rebalancing flows.",
     "Overnight and weekend gaps can open beyond a stop. A held position is "
     "not capped at 1R once the cash market closes."),
]
for tick, name, character, hours, drivers, warning in assets:
    head = Table([[
        Paragraph("<font color='white' size='11'><b>%s</b></font>&nbsp;&nbsp;"
                  "<font color='#C2963F' size='7.6'><b>%s</b></font>"
                  % (tick, name), TD)]], colWidths=[CONTENT_W])
    head.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ]))
    grid = Table([[
        Paragraph("<b>Character</b><br/>%s" % character, TD),
        Paragraph("<b>Best hours</b><br/>%s" % hours, TD),
        Paragraph("<b>Moves it</b><br/>%s" % drivers, TD),
    ]], colWidths=[CONTENT_W * 0.34, CONTENT_W * 0.25, CONTENT_W * 0.41])
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("LINEBEFORE", (1, 0), (-1, 0), 0.6, RULE),
        ("BOX", (0, 0), (-1, -1), 0.7, RULE),
    ]))
    warn = Table([[Paragraph(
        "<font color='#9B3535'><b>RISK NOTE&nbsp;&nbsp;</b></font>%s" % warning,
        TD)]], colWidths=[CONTENT_W])
    warn.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FBF1F1")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#E8CFCF")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.append(KeepTogether([head, grid, warn, Spacer(1, 9)]))
story.append(PageBreak())

# ---------------------------------------------- 6. CORRELATION / HEAT -----
story += section(
    "06", "Correlation: Why 5% Is Not Really 5%",
    "Five positions of 1% each are only five independent risks if the five "
    "assets are independent. These five are not. Gold and silver are close to "
    "the same trade, and the Dow, oil and bitcoin all lean on the same "
    "risk appetite.")

story.append(Paragraph("Working correlation map", H2))
pairs = [
    ("XAUUSD / XAGUSD", "Strong positive", "0.75 to 0.90",
     "Effectively one trade in two wrappers. The single largest hidden risk in "
     "this basket."),
    ("DJIUSD / BTCUSD", "Moderate positive", "0.30 to 0.60",
     "Tightens sharply in risk-off, exactly when you need the diversification."),
    ("WTIUSD / DJIUSD", "Mild positive", "0.20 to 0.45",
     "Both track growth expectations - except when oil moves on supply, when "
     "the sign can flip."),
    ("XAUUSD / DJIUSD", "Variable, often negative", "-0.40 to +0.20",
     "The genuine diversifier in the basket, though the relationship is "
     "unstable."),
    ("XAUUSD / BTCUSD", "Weak and unreliable", "-0.20 to +0.40",
     "The \"digital gold\" correlation does not hold consistently. Do not size "
     "as though it does."),
]
pr = [[Paragraph("<b>%s</b>" % a, TD), b, c, Paragraph(d, TD)]
      for a, b, c, d in pairs]
story.append(data_table(
    ["PAIR", "TYPICAL RELATIONSHIP", "ROLLING 90-DAY RANGE", "IMPLICATION"],
    pr, [104, 106, 106, CONTENT_W - 316]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Ranges are indicative of typical regimes and shift over time. Recompute "
    "the rolling 90-day correlations monthly rather than trusting this table "
    "indefinitely.", Small))

story.append(Paragraph("Exposure caps that sit on top of the 1% rule", H2))
caps = [
    ("C1", "Gold and silver in the same direction count as a single 1.5R "
     "exposure, not 2R. Take 0.75% on each, or take the better setup at a full "
     "1% and skip the other."),
    ("C2", "Maximum three positions in the same directional theme "
     "(risk-on: long DJI, long BTC, long WTI / risk-off: long gold, long "
     "silver, short DJI)."),
    ("C3", "Net directional heat is capped at 3.5R. If the five slots are all "
     "leaning the same way, the sixth constraint is the portfolio, not the "
     "setup."),
    ("C4", "Two open positions into a shared macro event (FOMC, CPI, NFP) are "
     "one position for risk purposes. Halve both, or close one before the "
     "release."),
]
cap_rows = [[Paragraph("<b>%s</b>" % n, TDb), Paragraph(t, TD)] for n, t in caps]
story.append(data_table(["", "EXPOSURE CAP"], cap_rows, [26, CONTENT_W - 26]))

story.append(Spacer(1, 8))
story.append(callout("THE PRACTICAL VERSION", [Paragraph(
    "Before the fifth position goes on, ask one question: <b>if the dollar "
    "rallies hard tomorrow, how many of these five lose at once?</b> If the "
    "answer is four or five, the account is not running five 1% risks. It is "
    "running one 4% risk wearing five different tickers, and the 1% rule has "
    "quietly stopped protecting you.", Body)]))
story.append(PageBreak())

# ------------------------------------------------- 7. THE WEEKLY CYCLE ----
story += section(
    "07", "The Cycle",
    "One week, one pass through the five assets. The work is front-loaded into "
    "the weekend so that execution during the week is mechanical rather than "
    "improvised.")

phases = [
    ("SUNDAY", "PREPARE", GOLD, [
        "Mark the week's economic calendar: FOMC, CPI, NFP, EIA Wednesday "
        "10:30 ET, OPEC+ dates, index-heavyweight earnings.",
        "Chart all five assets on the higher timeframe. Mark the levels that "
        "matter before price is moving.",
        "Grade each asset A, B or C. A = clean structure, defined "
        "invalidation, a real 3R target. B = forming. C = no trade.",
        "Recalculate 1R from Friday's closing equity. Write the dollar figure "
        "at the top of the log.",
        "Set price alerts. You are waiting for the market to come to the "
        "level, not hunting for entries.",
    ]),
    ("MONDAY - THURSDAY", "EXECUTE", NAVY, [
        "Trade A grades only. A B grade that has matured into an A during the "
        "week is eligible; a C never is.",
        "One position per asset. Entry, stop and target bracketed before the "
        "order is live.",
        "Confirm the 1:3 floor with the actual fill price, not the intended "
        "one. Slippage can break the ratio before the trade has begun.",
        "TP1 at 3R takes half off and moves the stop to break-even in the same "
        "action, not later.",
        "Two stop-outs on an asset closes it for the cycle (Rule 7). Do not "
        "backfill the empty slot with a different instrument.",
        "At -3R cumulative, stop for the week (Rule 8). The circuit breaker is "
        "not a suggestion.",
    ]),
    ("FRIDAY", "CLOSE AND SCORE", SLATE, [
        "No new entries after 12:00 ET.",
        "Decide the weekend explicitly for every open position: close, halve, "
        "or hold with the gap risk accepted in writing.",
        "Oil and the Dow gap. Bitcoin trades straight through and can move "
        "20% before Monday. Gold and silver reopen Sunday evening.",
        "Log every closed trade with its R multiple, its grade, and whether "
        "the plan was followed independently of whether it made money.",
        "Compute the week: total R, win rate, average winner, average loser, "
        "and how many trades broke a rule.",
    ]),
]
for day, verb, col, items in phases:
    hdr = Table([[Paragraph(
        "<font color='white' size='9.6'><b>%s</b></font>"
        "&nbsp;&nbsp;&nbsp;<font color='#F2E7CE' size='7.6'>%s</font>"
        % (day, verb), TD)]], colWidths=[CONTENT_W])
    hdr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), col),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ]))
    body = Table([[bullets(items)]], colWidths=[CONTENT_W])
    body.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(KeepTogether([hdr, body, Spacer(1, 9)]))

story.append(Paragraph("Weekly scorecard", H2))
sc_rows = [
    ["Total R for the cycle", "________ R", "Target: positive. Any single week is noise."],
    ["Trades taken", "________ / 5", "Fewer than five is normal. Five forced trades is not."],
    ["Win rate", "________ %", "Compare against the break-even rate in Section 02."],
    ["Average winner / average loser", "____ R / ____ R",
     "The winner should be at least 2.5x the loser. If it is not, targets are being cut."],
    ["Rules broken", "________", "The only number that must be zero."],
]
sc_rows = [[Paragraph(a, TDb), Paragraph(b, TD), Paragraph(c, TD)]
           for a, b, c in sc_rows]
story.append(data_table(["METRIC", "THIS CYCLE", "READING"],
                        sc_rows, [160, 96, CONTENT_W - 256]))
story.append(PageBreak())

# ----------------------------------------------------- 8. TRADE LOG ------
story += section(
    "08", "Cycle Log",
    "One row per asset per week. Print it, or rebuild it in a spreadsheet - "
    "but Rule 9 means an unlogged trade did not happen.")

story.append(Paragraph("Cycle beginning: ____ / ____ / ______"
                       "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                       "Opening equity: $______________"
                       "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
                       "1R this cycle: $______________", TDb))
story.append(Spacer(1, 7))

log_head = ["ASSET", "GRD", "DIR", "ENTRY", "STOP", "SIZE", "TP1 (3R)",
            "TP2 (5R)", "EXIT", "RESULT (R)", "RULES OK"]
log_rows = []
for a in ["XAUUSD", "WTIUSD", "XAGUSD", "BTCUSD", "DJIUSD"]:
    log_rows.append([Paragraph("<b>%s</b>" % a, TD)] + [""] * 10)
lw = [50, 32, 28, 46, 46, 42, 46, 46, 46, 48]
lw.append(CONTENT_W - sum(lw))
t = data_table(log_head, log_rows, lw, zebra=False)
t.setStyle(TableStyle([
    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
    ("TOPPADDING", (0, 1), (-1, -1), 11),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 11),
]))
story.append(t)
story.append(Spacer(1, 10))

story.append(Paragraph("Post-trade note - one per closed position", H2))
note_rows = [
    ["Why did I take it?", ""],
    ["Where exactly was the idea wrong?", ""],
    ["Did I follow the plan? (independent of the outcome)", ""],
    ["What would I repeat, and what would I not?", ""],
]
nr = [[Paragraph("<b>%s</b>" % a, TD), Paragraph(b, TD)] for a, b in note_rows]
t2 = data_table(["QUESTION", "ANSWER"], nr, [200, CONTENT_W - 200], zebra=False)
t2.setStyle(TableStyle([
    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
    ("TOPPADDING", (0, 1), (-1, -1), 13),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 13),
]))
story.append(t2)
story.append(Spacer(1, 8))
story.append(callout("GRADE THE PROCESS, NOT THE PROFIT", [Paragraph(
    "A trade that followed every rule and lost 1R is a good trade. A trade "
    "that broke Rule 1 and made 4R is a bad trade that got paid, and it is the "
    "single most dangerous entry in the log - it teaches the wrong lesson at "
    "exactly the moment you are most receptive to it. Mark the rules column "
    "honestly and read down it before every new cycle.", Body)]))
story.append(PageBreak())

# ------------------------------------------------- 9. CHECKLISTS ---------
story += section(
    "09", "Pre-Flight Checks",
    "Run these in order. Any unticked box on the pre-trade list means the "
    "order does not get placed.")

left = []
left += checklist("BEFORE THE ORDER", [
    "Asset is graded A this cycle.",
    "This asset has no open position and fewer than two stop-outs this cycle.",
    "Entry, stop and target are all written down.",
    "Stop sits beyond structural invalidation, plus buffer.",
    "Measured reward-to-risk is at least 1:3 at the real fill.",
    "Position size solved from the formula, not estimated.",
    "Risk confirmed at 1.00% of Monday's equity.",
    "Correlation caps C1 to C4 still satisfied after this fill.",
    "No tier-one data release inside the trade's expected horizon.",
    "Total open heat after this fill is 5R or less.",
], colw=CONTENT_W / 2 - 8)
left.append(Spacer(1, 8))
left += checklist("WHILE IT IS OPEN", [
    "Stop has not been widened. Not once.",
    "TP1 at 3R took half off.",
    "Stop moved to break-even the moment TP1 filled.",
    "Runner trailed behind structure, not behind hope.",
    "No new position on this asset while this one is live.",
], colw=CONTENT_W / 2 - 8)

right = []
right += checklist("AT THE CYCLE'S END", [
    "All five rows of the log completed.",
    "Total R, win rate and average winner and loser computed.",
    "Rule breaks counted and written down.",
    "Weekend exposure decided explicitly per position.",
    "Next cycle's 1R recalculated from closing equity.",
], colw=CONTENT_W / 2 - 8)
right.append(Spacer(1, 8))
right += checklist("CIRCUIT BREAKERS - CHECK EVERY DAY", [
    "Cycle drawdown is better than -3R.",
    "Month-to-date drawdown is better than -6R.",
    "If -6R is breached: size is halved to 0.5% until a new equity high.",
    "Fewer than three consecutive losing weeks.",
    "If three: stop and audit the system before risking more capital.",
], colw=CONTENT_W / 2 - 8)

story.append(Table([[left, right]], colWidths=[CONTENT_W / 2, CONTENT_W / 2],
                   hAlign="LEFT", style=TableStyle([
                       ("VALIGN", (0, 0), (-1, -1), "TOP"),
                       ("LEFTPADDING", (0, 0), (0, 0), 0),
                       ("LEFTPADDING", (1, 0), (1, 0), 16),
                       ("RIGHTPADDING", (-1, 0), (-1, 0), 0),
                   ])))

story.append(Spacer(1, 12))
story.append(Paragraph("The three ways this plan actually fails", H2))
fails = [
    ("Widening the stop", "The 1% rule stops being true the instant a stop "
     "moves away from price. One widened stop can cost what four disciplined "
     "losses cost, and it is almost always the trade you were most confident in."),
    ("Filling all five slots regardless", "Five assets is a ceiling, not a "
     "quota. A cycle with two A-grade trades is a correctly executed cycle. "
     "Forcing three C-grade setups to \"complete the week\" is how a 5% "
     "ceiling becomes a 5% expected loss."),
    ("Treating correlated positions as diversified", "Long gold and long "
     "silver into the same dollar move is a 2% bet on one idea, not two 1% "
     "bets on two. Section 06 exists because this is the failure that arrives "
     "disguised as good discipline."),
]
fr = [[Paragraph("<b>%s</b>" % a, TD), Paragraph(b, TD)] for a, b in fails]
story.append(data_table(["FAILURE MODE", "WHY IT IS FATAL"],
                        fr, [150, CONTENT_W - 150]))

story.append(Spacer(1, 14))
story.append(callout("IMPORTANT", [Paragraph(
    "This document is a risk-management and position-sizing framework prepared "
    "for educational purposes. It is not financial, investment or trading "
    "advice, and it contains no recommendation to buy or sell any instrument. "
    "Leveraged trading in commodities, indices and cryptocurrencies carries a "
    "high risk of loss, and losses can exceed deposits on some accounts. "
    "Contract specifications, spreads, financing costs and margin requirements "
    "vary by broker and must be verified independently before any position is "
    "sized. Correlation figures and volatility characteristics are indicative "
    "of typical historical regimes and change over time. Past performance does "
    "not indicate future results. Every expectancy figure in Section 02 is "
    "arithmetic conditional on an assumed win rate, not a projection of "
    "returns.", Body)], tint=colors.HexColor("#F4F5F7"), bar=SLATE))

# ================================================================= build ==
doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
    title="The Weekly 5-Asset Risk Cycle",
    author="Trading risk framework",
    subject="1% per asset across XAUUSD, WTIUSD, XAGUSD, BTCUSD and DJIUSD "
            "at a 1:3 to 1:5 reward-to-risk ratio")

cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id="cover",
                    leftPadding=MARGIN, rightPadding=MARGIN,
                    topPadding=0, bottomPadding=MARGIN)
content_frame = Frame(MARGIN, 15 * mm, CONTENT_W, PAGE_H - 15 * mm - 15 * mm,
                      id="content", leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)

doc.addPageTemplates([
    PageTemplate(id="cover", frames=[cover_frame], onPage=cover_page),
    PageTemplate(id="content", frames=[content_frame], onPage=content_page),
])

doc.build(story)
print("wrote %s" % OUT)
