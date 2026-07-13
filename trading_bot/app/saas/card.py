"""Server-side P&L / bait card renderer (PIL) so the bot can post image cards
to Telegram. Mirrors the app's share card in the minimal dark style."""
from __future__ import annotations

import io
import pathlib

_ASSETS = pathlib.Path(__file__).parent / "assets"


def _font(bold: bool, size: int):
    from PIL import ImageFont
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(str(_ASSETS / name), size)


def build_member_card(t: dict) -> tuple[bytes, str]:
    """Render an anonymised social-proof card + caption from a REAL closed trade.
    Used by the automated channel poster (never fabricated)."""
    import datetime as _dt
    is_long = (t.get("side") or "").lower() in ("buy", "long")
    pct = round(float(t.get("pnl_pct") or 0), 2)
    sym = t.get("symbol", "")
    data = {
        "name": "a member", "sym": sym, "isLong": is_long,
        "pnl": round(float(t.get("pnl") or 0), 2), "pct": pct,
        "entry": t.get("entry_price") or "", "last": t.get("exit_price") or "",
        "date": (t.get("closed_at") or _dt.datetime.now(_dt.timezone.utc).isoformat())[:16].replace("T", " "),
        "live": True,
    }
    caption = (f"🚀 A member just closed {'LONG' if is_long else 'SHORT'} "
               f"${str(sym).replace('USDT','')} for +{pct:.1f}% — fully automated "
               f"on their own account.")
    return render_card(data), caption


def render_card(d: dict) -> bytes:
    from PIL import Image, ImageDraw

    W, H = 1000, 1300
    bg, text, muted, line = (13, 14, 16), (236, 238, 242), (140, 143, 152), (42, 44, 50)
    green, red = (76, 192, 140), (226, 112, 122)
    pnl = float(d.get("pnl", 0))
    pct = float(d.get("pct", 0))
    col = green if pnl >= 0 else red
    img = Image.new("RGB", (W, H), bg)
    x = ImageDraw.Draw(img)
    x.rectangle([20, 20, W - 20, H - 20], outline=line, width=2)
    M = 72
    x.text((M, 56), "ZENITH", font=_font(True, 46), fill=text)
    badge = "● LIVE" if d.get("live") else "○ TEST"
    bf = _font(True, 30)
    x.text((W - M - x.textlength(badge, font=bf), 66), badge, font=bf, fill=col)
    x.line([M, 150, W - M, 150], fill=line, width=2)
    x.text((M, 178), "@" + str(d.get("name", "trader")), font=_font(True, 46), fill=text)
    x.text((M, 240), str(d.get("date", "")), font=_font(False, 30), fill=muted)
    x.text((M, 330), str(d.get("sym", "")), font=_font(True, 92), fill=text)
    side = ("Long" if d.get("isLong") else "Short") + (f"   ·   {int(d['lev'])}x" if d.get("lev") else "")
    x.text((M, 452), side, font=_font(True, 48), fill=(green if d.get("isLong") else red))
    x.text((M, 556), ("+" if pct >= 0 else "") + f"{pct:.2f}%", font=_font(True, 150), fill=col)
    x.text((M, 742), ("+" if pnl >= 0 else "") + f"{pnl:.2f} USDT", font=_font(True, 54), fill=col)
    x.line([M, 858, W - M, 858], fill=line, width=2)
    x.text((M, 888), "Entry", font=_font(False, 36), fill=muted)
    x.text((W // 2, 888), "Last", font=_font(False, 36), fill=muted)
    x.text((M, 938), str(d.get("entry", "")), font=_font(True, 52), fill=text)
    x.text((W // 2, 938), str(d.get("last", "")), font=_font(True, 52), fill=text)
    x.line([M, 1078, W - M, 1078], fill=line, width=2)
    x.text((M, 1108), "ALGORITHMIC TRADING", font=_font(False, 30), fill=muted)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()
