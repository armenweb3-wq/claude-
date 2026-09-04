#!/usr/bin/env python3
"""
One box. Five assets, one row each, one cycle per sheet.

Add a trade to TRADES and re-run; anything not supplied is left blank.
Derived columns (risk, R:R, result) are computed, never typed.

Usage:  python3 trading/generate_trade_boxes.py
Output: trading/Trade-Boxes.pdf
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

OUT = "trading/Trade-Boxes.pdf"

FREE_MARGIN = 245_000.0
ONE_R = FREE_MARGIN * 0.01                      # $2,450

# value_per_lot = USD per 1.00 of price movement, per 1.00 lot
ASSETS = [("XAUUSD", "GOLD", 100.0), ("WTIUSD", "OIL", 1000.0),
          ("XAGUSD", "SILVER", 5000.0), ("BTCUSD", "BITCOIN", 1.0),
          ("DJIUSD", "DOW", 1.0)]

# Trades taken. Omit a field and it prints blank; omit an asset entirely and
# the whole row is blank. "closed" fills the result columns automatically.
TRADES = {
    # pnl, where given, is the broker's figure and overrides price x volume
    "WTIUSD": dict(side="BUY", entry=88.41, volume=2.8, margin=2475.0,
                   stop=87.56, target=91.20, moved_to_entry=True,
                   closed=91.20, pnl=8047.0),          # closed at take profit
    "XAGUSD": dict(side="SELL", entry=64.31, volume=0.66, stop=65.00,
                   target=62.00, leverage=100, moved_to_entry=True,
                   closed=64.31, pnl=29.70),   # scratched at break-even
    # stop is the original one the trade was sized from; it was later moved
    # to entry, which `moved_to_entry` records
    "XAUUSD": dict(side="BUY", entry=4438.00, volume=0.5, stop=4387.00,
                   target=4565.00, leverage=100, moved_to_entry=True,
                   closed=4465.00, pnl=1370.0),
    "DJIUSD": dict(side="BUY", entry=53317.0, volume=4.0, stop=52795.0,
                   target=54600.0, leverage=100, pnl=1308.0),  # open
    "BTCUSD": dict(skipped=True),                   # not traded this cycle
}

# ----------------------------------------------------------------- palette --
INK   = colors.HexColor("#101826")
NAVY  = colors.HexColor("#16233A")
GOLD  = colors.HexColor("#C2963F")
GOLDL = colors.HexColor("#F2E7CE")
SLATE = colors.HexColor("#5A6678")
RULE  = colors.HexColor("#C4CCD8")
ZEBRA = colors.HexColor("#F7F9FB")
GREEN = colors.HexColor("#2F6F4F")
RED   = colors.HexColor("#9B3535")

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 14 * mm
CW = PAGE_W - 2 * MARGIN

ss = getSampleStyleSheet()
def st(n, **kw):
    return ParagraphStyle(n, parent=kw.pop("parent", ss["Normal"]), **kw)

TD  = st("TD", fontName="Helvetica", fontSize=10, leading=13, textColor=INK)
TH  = st("TH", fontName="Helvetica-Bold", fontSize=7.6, leading=10,
         textColor=colors.white)
FOOT = st("Foot", fontName="Helvetica", fontSize=7.4, leading=10.4,
          textColor=SLATE)


def px(v):
    """Prices: 2dp for FX-scale quotes, none for index-scale ones."""
    return ("%.2f" if abs(v) < 1000 else "%.0f") % v


def usd(v, sign=False):
    dp = 2 if 0 < abs(v) < 100 else 0
    s = ("${:,.%df}" % dp).format(abs(v))
    if v < 0:
        return "-" + s
    return ("+" + s) if (sign and round(v, dp)) else s


def cellp(text, bold=True, col=INK, size=10):  # noqa: D401
    if text in (None, ""):
        return Paragraph("", TD)
    return Paragraph("<font size='%s' color='%s'>%s%s%s</font>"
                     % (size, "#" + col.hexval()[2:], "<b>" if bold else "",
                        text, "</b>" if bold else ""), TD)


def row(asset, name, vpl):
    """One table row. Anything that cannot be derived is left blank."""
    t = TRADES.get(asset, {})
    if t.get("skipped"):
        # deliberately not traded - a dash reads differently from an empty cell
        return ([Paragraph("<font size='10.5'><b>%s</b></font>&nbsp; "
                           "<font size='6.6' color='#5A6678'>%s</font>"
                           % (asset, name), TD)]
                + [cellp("-", col=SLATE)] * (len(HEAD) - 1)), None, None, False

    side = t.get("side")
    entry, stop = t.get("entry"), t.get("stop")
    target, vol = t.get("target"), t.get("volume")
    closed, current = t.get("closed"), t.get("current")
    mark = closed if closed is not None else current
    floating = closed is None and current is not None
    short = side == "SELL"

    margin = t.get("margin")
    if margin is None and entry is not None and vol and t.get("leverage"):
        margin = vol * vpl * entry / t["leverage"]

    reported = t.get("pnl")
    floating = floating or (closed is None and reported is not None)

    risk = rr = res_cash = res_r = None
    at_be = entry is not None and stop is not None and entry == stop
    if None not in (entry, stop, vol) and not at_be:
        risk = abs(entry - stop) * vol * vpl
        if target is not None:
            rr = abs(target - entry) / abs(entry - stop)

    if reported is not None:
        res_cash = reported
    elif mark is not None and None not in (entry, vol):
        res_cash = (entry - mark if short else mark - entry) * vol * vpl
    if res_cash is not None and risk:
        res_r = res_cash / risk

    col = INK
    if res_cash is not None:
        col = GREEN if res_cash > 0 else (RED if res_cash < 0 else SLATE)
    moved = t.get("moved_to_entry")
    if moved is None and at_be:
        moved = True
    return [
        Paragraph("<font size='10.5'><b>%s</b></font>&nbsp; "
                  "<font size='6.6' color='#5A6678'>%s</font>" % (asset, name), TD),
        cellp(side or "", col=GREEN if side == "BUY" else RED, size=8.6),
        cellp(px(entry) if entry is not None else ""),
        cellp("%g" % vol if vol is not None else ""),
        cellp(usd(margin) if margin is not None else ""),
        cellp(px(stop) if stop is not None else ""),
        cellp(px(target) if target is not None else ""),
        cellp(usd(risk) if risk is not None else "",
              col=RED if (risk is not None and risk > ONE_R * 1.005) else INK),
        cellp("1 : %.2f" % rr if rr is not None else "",
              col=GREEN if (rr is not None and rr >= 3) else RED),
        cellp("YES" if moved else ("" if moved is None else "NO")),
        cellp(px(mark) + ("" if floating else "  EXIT")
              if mark is not None else "", col=SLATE if floating else INK,
              size=10 if floating else 9),
        cellp(usd(res_cash, sign=True)
              if (res_cash is not None and floating) else "", col=col),
        cellp(usd(res_cash, sign=True)
              if (res_cash is not None and not floating) else "", col=col),
        cellp("%+.2fR" % res_r if res_r is not None else "", col=col),
    ], res_cash, res_r, floating


# ------------------------------------------------------------------- build --
story = []
story.append(Paragraph(
    "<font size='16' color='#16233A'><b>Weekly Trade Sheet</b></font>"
    "&nbsp;&nbsp;&nbsp;"
    "<font size='9' color='#5A6678'>Week ____ / ____"
    "&nbsp;&nbsp;&bull;&nbsp;&nbsp;Free margin %s"
    "&nbsp;&nbsp;&bull;&nbsp;&nbsp;</font>"
    "<font size='9' color='#2F6F4F'><b>1R = 1%% = %s</b></font>"
    % (usd(FREE_MARGIN), usd(ONE_R)),
    st("hdr", fontName="Helvetica", fontSize=16, leading=20)))
story.append(Spacer(1, 5))
hr = Table([[""]], colWidths=[CW], rowHeights=[2.4])
hr.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
story.append(hr)
story.append(Spacer(1, 14))

HEAD = ["ASSET", "DIR", "ENTRY", "VOLUME", "MARGIN", "STOP LOSS", "TAKE PROFIT",
        "RISK (1R)", "R : R", "SL AT ENTRY", "PRICE NOW", "UNREALISED P/L",
        "REALISED P/L", "R"]
data = [[Paragraph(h, TH) for h in HEAD]]
real_cash = real_r = flt_cash = flt_r = 0.0
no_r = []
for a, n, vpl in ASSETS:
    cells, rc, rr_, flt = row(a, n, vpl)
    data.append(cells)
    if rc is None:
        continue
    if flt:
        flt_cash += rc
    else:
        real_cash += rc
    if rr_ is None:
        no_r.append(a)
    elif flt:
        flt_r += rr_
    else:
        real_r += rr_

def tone(v):
    return GREEN if v > 0 else (RED if v < 0 else SLATE)

def total_row(label, flt, real):
    return ([Paragraph("<font size='8.6'><b>%s</b></font>" % label, TD)]
            + [Paragraph("", TD)] * 10
            + [cellp(flt, col=tone(flt_cash)), cellp(real, col=tone(real_cash)),
               Paragraph("", TD)])

data.append(total_row("TOTAL ($)", usd(flt_cash, sign=True),
                      usd(real_cash, sign=True)))
data.append(total_row("TOTAL (R)", "%+.2fR" % flt_r, "%+.2fR" % real_r))

W = [70, 38, 50, 46, 52, 52, 54, 56, 52, 52, 56, 62, 62, 0]
assert len(W) == len(HEAD), (len(W), len(HEAD))
W[-1] = CW - sum(W[:-1])
t = Table(data, colWidths=W, rowHeights=[22] + [42] * 5 + [30, 30])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
    ("BOX", (0, 0), (-1, -1), 1.0, NAVY),
    ("BACKGROUND", (0, 6), (-1, 6), GOLDL),
    ("LINEABOVE", (0, 6), (-1, 6), 1.2, NAVY),
] + [("BACKGROUND", (0, i), (-1, i), ZEBRA) for i in (2, 4)]))
story.append(t)
story.append(Spacer(1, 5))
if no_r:
    story.append(Paragraph(
        "<b>TOTAL (R)</b> excludes %s - the risk it was taken against is not "
        "recorded, so its result cannot be expressed in R. A stop shown equal "
        "to the entry has already been moved to break-even and is not the stop "
        "the trade was sized from." % ", ".join(no_r), FOOT))
    story.append(Spacer(1, 3))
story.append(Paragraph(
    "<b>PRICE NOW</b> is a live mark while a position is open, so the P/L "
    "beside it is unrealised. A price tagged <b>EXIT</b> is an actual close "
    "and moves that row into realised. P/L figures are as reported by the "
    "broker and can differ from price x volume by the fill, spread and "
    "financing.", FOOT))

story.append(Spacer(1, 10))
story.append(Paragraph(
    "Figures in red break a rule: risk above 1% of free margin, or a reward "
    "to risk under 1:3.&nbsp;&nbsp; "
    "Per 1.00 lot, $1.00 of price movement is worth: "
    + "&nbsp;&nbsp;&bull;&nbsp;&nbsp;".join(
        "<b>%s</b> %s" % (a, usd(v)) for a, _, v in ASSETS)
    + ".&nbsp;&nbsp; volume = 1R / (stop distance x that value)."
      "&nbsp;&nbsp; R:R must be at least 1:3. Round volume down.", FOOT))

doc = BaseDocTemplate(OUT, pagesize=landscape(A4),
                      leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="Weekly Trade Sheet")
doc.addPageTemplates([PageTemplate(id="c", frames=[
    Frame(MARGIN, MARGIN, CW, PAGE_H - 2 * MARGIN, id="f",
          leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)])])
doc.build(story)
print("wrote %s" % OUT)
