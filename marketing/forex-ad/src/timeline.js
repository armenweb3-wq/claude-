// Master timeline: scene order and cut points, in seconds on a 120 BPM grid
// (beat = 0.5 s, bar = 2 s, 30 bars). Scene files live in src/scenes/.
// `chrome` controls the persistent overlay while a scene is on screen:
// 'full' (default) shows the brand bug; 'none' hides it (the end card carries
// the full-size lockup instead). The clock and the risk band are always visible.
window.AD_TIMELINE = {
  bpm: 120,
  fps: 30,
  duration: 60,
  scenes: [
    { id: 'chrome', file: '00-chrome.js', start: 0, end: 60, overlay: true, title: 'Brand bug, clock, risk band, ruler, grain' },
    { id: 'hook', file: '01-hook.js', start: 0, end: 2, title: 'ONE SECOND.' },
    { id: 'inside', file: '02-inside.js', start: 2, end: 4, title: 'Prices can change many times a second' },
    { id: 'brand', file: '03-brand.js', start: 4, end: 6, title: 'Brand lock' },
    { id: 'always', file: '04-always.js', start: 6, end: 10, title: 'Forex trades 24 hours a day, 5 days a week' },
    { id: 'fan', file: '05-fan.js', start: 10, end: 14, title: 'No one can predict the next price' },
    { id: 'question', file: '06-question.js', start: 14, end: 16, title: 'So what can you know?' },
    { id: 'thesis', file: '07-thesis.js', start: 16, end: 18, title: 'Precision, not prediction.' },
    { id: 'see', file: '08-see.js', start: 18, end: 24, title: '01 SEE — bid, ask, spread' },
    { id: 'set', file: '09-set.js', start: 24, end: 30, title: '02 SET — entry, stop, limit' },
    { id: 'trace', file: '10-trace.js', start: 30, end: 36, title: '03 TRACE — requested, filled, time-stamped' },
    { id: 'bothways', file: '11-bothways.js', start: 36, end: 40, title: 'Prices move against you too' },
    { id: 'demo', file: '12-demo.js', start: 40, end: 48, title: 'Try the demo' },
    { id: 'recap', file: '13-recap.js', start: 48, end: 50, title: 'See. Set. Trace. 24/5.' },
    { id: 'converge', file: '14-converge.js', start: 50, end: 52, title: 'Motifs converge into the mark' },
    { id: 'endcard', file: '15-endcard.js', start: 52, end: 60, chrome: 'none', title: 'End card' },
  ],
}
