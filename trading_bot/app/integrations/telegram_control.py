"""Two-way Telegram control.

Runs a python-telegram-bot polling Application alongside FastAPI and maps
chat commands to bot controls. Only messages from the configured
TELEGRAM_CHAT_ID are honoured — every other sender is ignored.

The command *logic* (authorisation + the action handlers) is kept free of
the telegram SDK so it can be unit-tested without the package or network;
``run()``/``stop()`` contain the only SDK-coupled glue and import it lazily.
"""
from __future__ import annotations

import logging

from ..config import settings

log = logging.getLogger(__name__)

COMMANDS = {
    "status": "show current bot status",
    "start": "start the trading loop",
    "stop": "stop the trading loop",
    "pause": "pause trading (loop keeps running, no orders)",
    "resume": "resume trading",
    "help": "list commands",
}


class TelegramController:
    def __init__(self, bot, token: str, chat_id: str) -> None:
        self._bot = bot
        self._token = token
        self._chat_id = str(chat_id)
        self._app = None  # telegram Application, created in run()

    # ── pure logic (unit-testable) ──────────────────────────
    def authorized(self, chat_id) -> bool:
        return str(chat_id) == self._chat_id

    async def handle(self, command: str) -> str:
        """Execute a command name and return a reply string."""
        cmd = command.lstrip("/").split("@")[0].lower()
        if cmd == "status":
            s = self._bot.state
            return (
                f"📊 <b>Status</b>\n"
                f"running: {s.running}\npaused: {s.paused}\n"
                f"mode: {s.mode} ({settings.safety_summary()})\n"
                f"strategy: {s.strategy}\n"
                f"symbols: {', '.join(settings.symbols)}\n"
                f"last run: {s.last_run or '—'}"
            )
        if cmd == "start":
            await self._bot.start()
            return "▶️ started"
        if cmd == "stop":
            await self._bot.stop()
            return "🛑 stopped"
        if cmd == "pause":
            self._bot.pause()
            return "⏸️ paused"
        if cmd == "resume":
            self._bot.resume()
            return "▶️ resumed"
        if cmd == "help":
            return "Commands:\n" + "\n".join(f"/{c} — {d}" for c, d in COMMANDS.items())
        return f"unknown command: /{cmd}\nTry /help"

    # ── telegram SDK glue (lazy import) ─────────────────────
    async def run(self) -> None:
        from telegram.ext import Application, CommandHandler

        async def _dispatch(update, context):
            chat = update.effective_chat
            if not chat or not self.authorized(chat.id):
                log.warning("ignoring command from unauthorised chat %s", chat and chat.id)
                return
            text = update.effective_message.text if update.effective_message else ""
            reply = await self.handle(text)
            await context.bot.send_message(chat_id=chat.id, text=reply, parse_mode="HTML")

        self._app = Application.builder().token(self._token).build()
        for cmd in COMMANDS:
            self._app.add_handler(CommandHandler(cmd, _dispatch))

        await self._app.initialize()
        await self._app.start()
        await self._app.updater.start_polling(drop_pending_updates=True)
        log.info("Telegram command control active (authorised chat: %s)", self._chat_id)

    async def stop(self) -> None:
        if self._app is None:
            return
        try:
            await self._app.updater.stop()
            await self._app.stop()
            await self._app.shutdown()
        except Exception as exc:  # pragma: no cover - best effort
            log.warning("Telegram controller shutdown error: %s", exc)
