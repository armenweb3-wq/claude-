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
    "WTIUSD": dict(side="BUY", entry=88.41, volume=2.8, margin=2475.0,
                   stop=87.56, target=91.20, moved_to_entry=True,
                   current=90.80),          # still open - mark-to-market
    "XAGUSD": dict(side="SELL", entry=64.31, volume=0.66, stop=65.00,
                   target=62.00, leverage=100),
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


def usd(v, sign=False):
    s = "${:,.0f}".format(abs(v))
    if v < 0:
        return "-" + s
    return ("+" + s) if (sign and round(v)) else s


def cellp(text, bold=True, col=INK, size=10):  # noqa: D401
    if text in (None, ""):
        return Paragraph("", TD)
    return Paragraph("<font size='%s' color='%s'>%s%s%s</font>"
                     % (size, "#" + col.hexval()[2:], "<b>" if bold else "",
                        text, "</b>" if bold else ""), TD)


def row(asset, name, vpl):
    """One table row. Anything that cannot be derived is left blank."""
    t = TRADES.get(asset, {})
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

    risk = rr = res_cash = res_r = None
    if None not in (entry, stop, vol):
        risk = abs(entry - stop) * vol * vpl
        if target is not None:
            rr = abs(target - entry) / abs(entry - stop)
        if mark is not None:
            res_cash = (entry - mark if short else mark - entry) * vol * vpl
            res_r = res_cash / risk

    col = INK
    if res_cash is not None:
        col = GREEN if res_cash > 0 else (RED if res_cash < 0 else SLATE)
    moved = t.get("moved_to_entry")
    return [
        Paragraph("<font size='10.5'><b>%s</b></font>&nbsp; "
                  "<font size='6.6' color='#5A6678'>%s</font>" % (asset, name), TD),
        cellp(side or "", col=GREEN if side == "BUY" else RED, size=8.6),
        cellp("%.2f" % entry if entry is not None else ""),
        cellp("%g" % vol if vol is not None else ""),
        cellp(usd(margin) if margin is not None else ""),
        cellp("%.2f" % stop if stop is not None else ""),
        cellp("%.2f" % target if target is not None else ""),
        cellp(usd(risk) if risk is not None else ""),
        cellp("1 : %.2f" % rr if rr is not None else "", col=GREEN),
        cellp("YES" if moved else ("" if moved is None else "NO")),
        cellp("%.2f" % mark if mark is not None else "",
              col=SLATE if floating else INK),
        cellp(usd(res_cash, sign=True) if res_cash is not None else "", col=col),
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
        "RISK (1R)", "R : R", "SL AT ENTRY", "CLOSED / NOW", "RESULT ($)",
        "RESULT (R)"]
data = [[Paragraph(h, TH) for h in HEAD]]
real_cash = real_r = flt_cash = flt_r = 0.0
for a, n, vpl in ASSETS:
    cells, rc, rr_, flt = row(a, n, vpl)
    data.append(cells)
    if rc is None:
        continue
    if flt:
        flt_cash += rc; flt_r += rr_
    else:
        real_cash += rc; real_r += rr_

def total_row(label, cash, r, muted=False):
    c = SLATE if muted else (GREEN if cash > 0 else (RED if cash < 0 else SLATE))
    return ([Paragraph("<font size='8.6'><b>%s</b></font>" % label, TD)]
            + [Paragraph("", TD)] * 10
            + [cellp(usd(cash, sign=True), col=c), cellp("%+.2fR" % r, col=c)])

data.append(total_row("OPEN P/L", flt_cash, flt_r, muted=False))
data.append(total_row("CLOSED THIS CYCLE", real_cash, real_r))

W = [72, 40, 52, 50, 56, 56, 60, 60, 54, 58, 56, 68, 0]
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
story.append(Paragraph(
    "Prices in <b>CLOSED / NOW</b> shown in grey are live marks on open "
    "positions, so the result beside them is floating, not realised.", FOOT))

story.append(Spacer(1, 10))
story.append(Paragraph(
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
