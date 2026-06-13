// Headless smoke test: mock a browser DOM and run data.js + app.js to catch runtime errors.
import fs from "node:fs";

const store = {};
function makeEl(id) {
  return {
    id, innerHTML: "", textContent: "", value: "", style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    set onclick(f) {}, get onclick() { return null; },
    set onclick2(f) {},
    querySelectorAll() { return []; },
    insertAdjacentHTML() {},
    appendChild() {}, removeChild() {},
  };
}
const els = {};
const document = {
  getElementById(id) { return (els[id] ||= makeEl(id)); },
  querySelectorAll() { return []; },
  createElement() { return makeEl("x"); },
};
class Chart { constructor() { this.data = { datasets: [{}, {}] }; } update() {} }
const localStorage = {
  _m: {},
  getItem(k) { return k in this._m ? this._m[k] : null; },
  setItem(k, v) { this._m[k] = String(v); },
  removeItem(k) { delete this._m[k]; },
};
const liveJson = JSON.parse(fs.readFileSync("live.json", "utf8"));
const fetch = async () => ({ ok: true, json: async () => liveJson });
const window = {};
const setInterval = () => 0;
const setTimeout = (f) => { if (typeof f === "function") f(); return 0; };
const alert = () => {};
const prompt = () => null;

// expose globals
globalThis.document = document;
globalThis.window = window;
globalThis.Chart = Chart;
globalThis.localStorage = localStorage;
globalThis.fetch = fetch;
globalThis.setInterval = setInterval;
globalThis.alert = alert;
globalThis.prompt = prompt;

// load data.js then app.js in the global scope
const data = fs.readFileSync("data.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
try {
  eval(data);                 // sets window.BETTING_DATA
  globalThis.window.BETTING_DATA = window.BETTING_DATA;
  eval(app);                  // runs the IIFE -> render([]) etc.
  // give the async loadLive().then(render) a tick
  await new Promise((r) => setImmediate(r));
  // sanity: did key elements get populated?
  const checks = {
    legLabel: els.legLabel?.textContent,
    bankroll: els.bankroll?.textContent,
    results_has_html: !!els.results?.innerHTML,
    streak_has_html: !!els.streak?.innerHTML,
    pick_has_html: !!els.pick?.innerHTML,
    builder_has_html: !!els.builder?.innerHTML,
  };
  console.log("RENDER OK");
  console.log(JSON.stringify(checks, null, 2));
} catch (e) {
  console.error("RUNTIME ERROR:", e && e.stack ? e.stack : e);
  process.exit(1);
}
