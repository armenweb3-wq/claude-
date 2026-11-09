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
