// ─────────────────────────────────────────────────────────────────────────
// The single edit point for the ad: brand, copy and legal text.
// Change values here, then re-render with:  node tools/render.mjs
//
// Everything marked PLACEHOLDER must be replaced with the broker's real,
// current details before the video is published. Every claim in `copy` must
// be true of the broker's actual service.
// ─────────────────────────────────────────────────────────────────────────
window.AD_CONFIG = {
  brand: {
    name: 'YOURBROKER', // PLACEHOLDER — 5 to 14 characters fits best
    descriptor: 'FX & CFD TRADING PLATFORM',
    url: 'yourbroker.com', // PLACEHOLDER
    promise: 'Precision, not prediction.',
    cta: 'Try the demo with virtual funds',
  },

  legal: {
    // PLACEHOLDER — the broker's own current figure, e.g. '71.2'. EU/UK rules
    // require the provider-specific percentage; never publish an invented one.
    lossPercent: 'XX',
    // Shown for the whole spot (EU/UK abbreviated standard wording).
    riskShort:
      '{pct}% of retail investor accounts lose money when trading CFDs with this provider. You should consider whether you can afford to take the high risk of losing your money.',
    // Shown for the final ten seconds and on the end card (full standard wording).
    riskFull:
      'CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. {pct}% of retail investor accounts lose money when trading CFDs with this provider. You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.',
    // PLACEHOLDERS in [BRACKETS] — legal entity, regulator, licence number, excluded countries.
    entity:
      '{brand} is a trading name of [LEGAL ENTITY], authorised and regulated by [REGULATOR], licence no. [NUMBER]. Not directed at residents of [EXCLUDED COUNTRIES] or of any jurisdiction where this would be contrary to local law.',
    notes: 'Prices and screens shown are illustrative. Demo prices and fills may differ from live trading.',
    illustrativeTag: 'ILLUSTRATIVE',
    // Risk band style: 'dark' (white text in a white-bordered dark box) or
    // 'light' (dark text on a light placard, the most prominent treatment).
    bandTheme: 'dark',
  },

  // Colours. Change `accent` to re-skin the spot to a brand colour.
  colors: {
    void: '#070B10',
    graphite: '#0F1620',
    hairline: '#1E2A38',
    white: '#EAF2F8',
    grey: '#8094A8',
    accent: '#3DE1F0',
    ice: '#8FB8FF',
    amber: '#FFB547',
  },
}
