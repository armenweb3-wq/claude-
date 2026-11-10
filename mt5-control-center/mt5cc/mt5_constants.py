"""Numeric constants of the MetaTrader 5 API, mirrored here so the main
process (which never imports MetaTrader5) can interpret deal records."""

# Deal types (deal.type)
DEAL_TYPE_BUY = 0
DEAL_TYPE_SELL = 1
DEAL_TYPE_BALANCE = 2
DEAL_TYPE_CREDIT = 3
DEAL_TYPE_CHARGE = 4
DEAL_TYPE_CORRECTION = 5
DEAL_TYPE_BONUS = 6
DEAL_TYPE_COMMISSION = 7
DEAL_TYPE_COMMISSION_DAILY = 8
DEAL_TYPE_COMMISSION_MONTHLY = 9
DEAL_TYPE_COMMISSION_AGENT_DAILY = 10
DEAL_TYPE_COMMISSION_AGENT_MONTHLY = 11
DEAL_TYPE_INTEREST = 12
DEAL_TYPE_BUY_CANCELED = 13
DEAL_TYPE_SELL_CANCELED = 14
DEAL_DIVIDEND = 15
DEAL_DIVIDEND_FRANKED = 16
DEAL_TAX = 17

TRADING_DEAL_TYPES = {DEAL_TYPE_BUY, DEAL_TYPE_SELL}

DEAL_TYPE_NAMES = {
    0: "Buy", 1: "Sell", 2: "Balance", 3: "Credit", 4: "Charge",
    5: "Correction", 6: "Bonus", 7: "Commission", 8: "Daily commission",
    9: "Monthly commission", 10: "Agent daily commission",
    11: "Agent monthly commission", 12: "Interest", 13: "Cancelled buy",
    14: "Cancelled sell", 15: "Dividend", 16: "Franked dividend", 17: "Tax",
}

# Deal entry (deal.entry)
DEAL_ENTRY_IN = 0
DEAL_ENTRY_OUT = 1
DEAL_ENTRY_INOUT = 2
DEAL_ENTRY_OUT_BY = 3

# Position types (position.type)
POSITION_TYPE_BUY = 0
POSITION_TYPE_SELL = 1

# Account trade modes
ACCOUNT_TRADE_MODE_NAMES = {0: "Demo", 1: "Contest", 2: "Real"}
ACCOUNT_MARGIN_MODE_NAMES = {0: "Retail netting", 1: "Exchange", 2: "Retail hedging"}

# --- Trading -------------------------------------------------------------- #
TRADE_ACTION_DEAL = 1
TRADE_ACTION_PENDING = 5
TRADE_ACTION_SLTP = 6
TRADE_ACTION_MODIFY = 7
TRADE_ACTION_REMOVE = 8

ORDER_TYPE_BUY = 0
ORDER_TYPE_SELL = 1
ORDER_TYPE_BUY_LIMIT = 2
ORDER_TYPE_SELL_LIMIT = 3
ORDER_TYPE_BUY_STOP = 4
ORDER_TYPE_SELL_STOP = 5
ORDER_TYPE_NAMES = {0: "Buy", 1: "Sell", 2: "Buy limit", 3: "Sell limit", 4: "Buy stop", 5: "Sell stop"}

ORDER_TIME_GTC = 0
ORDER_FILLING_FOK = 0
ORDER_FILLING_IOC = 1
ORDER_FILLING_RETURN = 2
SYMBOL_FILLING_FOK = 1   # bit flags in symbol_info.filling_mode
SYMBOL_FILLING_IOC = 2

SYMBOL_TRADE_MODE_DISABLED = 0
SYMBOL_TRADE_MODE_LONGONLY = 1
SYMBOL_TRADE_MODE_SHORTONLY = 2
SYMBOL_TRADE_MODE_CLOSEONLY = 3
SYMBOL_TRADE_MODE_FULL = 4

TRADE_RETCODE_PLACED = 10008
TRADE_RETCODE_DONE = 10009
TRADE_RETCODE_DONE_PARTIAL = 10010
TRADE_RETCODE_OK = {0, TRADE_RETCODE_PLACED, TRADE_RETCODE_DONE, TRADE_RETCODE_DONE_PARTIAL}
TRADE_RETCODE_NAMES = {
    0: "OK", 10004: "Requote", 10006: "Request rejected", 10007: "Request cancelled by trader",
    10008: "Order placed", 10009: "Request completed", 10010: "Only part of the request completed",
    10011: "Request processing error", 10012: "Request cancelled by timeout", 10013: "Invalid request",
    10014: "Invalid volume", 10015: "Invalid price", 10016: "Invalid stops", 10017: "Trade is disabled",
    10018: "Market is closed", 10019: "Not enough money", 10020: "Prices changed", 10021: "No quotes",
    10022: "Invalid order expiration", 10023: "Order state changed", 10024: "Too many requests",
    10025: "No changes in request", 10026: "Autotrading disabled by server", 10027: "Autotrading disabled by client terminal",
    10028: "Request locked for processing", 10029: "Order or position frozen", 10030: "Invalid order filling type",
    10031: "No connection with the trade server", 10032: "Operation allowed only for live accounts",
    10033: "Number of pending orders reached the limit", 10034: "Volume of orders and positions reached the limit",
    10035: "Incorrect or prohibited order type", 10036: "Position with the specified identifier already closed",
    10038: "Close volume exceeds the current position volume", 10039: "A close order already exists for the position",
    10040: "Number of open positions reached the limit", 10041: "Pending order activation rejected, order cancelled",
    10042: "Only long positions are allowed", 10043: "Only short positions are allowed", 10044: "Only position closing is allowed",
    10045: "Position closing is allowed only by FIFO rule", 10046: "Opposite positions on a single symbol are disabled",
}

# Timeframes (values of the MetaTrader5 package constants)
TIMEFRAMES = {"M1": 1, "M5": 5, "M15": 15, "M30": 30, "H1": 16385, "H4": 16388, "D1": 16408}
TIMEFRAME_SECONDS = {"M1": 60, "M5": 300, "M15": 900, "M30": 1800, "H1": 3600, "H4": 14400, "D1": 86400}
