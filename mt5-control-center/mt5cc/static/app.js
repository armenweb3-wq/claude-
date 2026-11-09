/* MT5 Trading Control Center - dashboard logic (vanilla JS, no build step). */
(function () {
  "use strict";

  const S = {
    view: "overview",
    scope: "all",
    overview: null,
    perfPeriod: "month",
    custom: { from: "", to: "" },
    tf: { symbol: "", result: "", direction: "", from: "", to: "", page: 1, pageSize: 50 },
    eqHours: 24,
    timers: {},
    viewToken: 0,
  };

  const VIEW_TITLES = { overview: "Overview", positions: "Open positions", performance: "Performance", trades: "Trade history", balance: "Balance operations", diagnostics: "Diagnostics" };
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COLOR_HEX = { blue: "#3987e5", orange: "#e0692f", aqua: "#1fb282", yellow: "#d29a1a", magenta: "#d55181", violet: "#9085e9" };

  /* ---------------- formatting ---------------- */
  function fmt(v, digits = 2) {
    if (v === null || v === undefined || Number.isNaN(v)) return "–";
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function money(v, cur, digits = 2) {
    if (v === null || v === undefined) return "–";
    return `<span class="n">${fmt(v, digits)}</span>${cur ? `<span class="cur">${esc(cur)}</span>` : ""}`;
  }
  function signedMoney(v, cur, digits = 2) {
    if (v === null || v === undefined) return `<span class="flat">–</span>`;
    const cls = v > 0 ? "pos" : v < 0 ? "neg" : "flat";
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    return `<span class="${cls}"><span class="n">${sign}${fmt(Math.abs(v), digits)}</span>${cur ? `<span class="cur">${esc(cur)}</span>` : ""}</span>`;
  }
  function pct(v, digits = 1) { return v === null || v === undefined ? "–" : fmt(v * 100, digits) + "%"; }
  function plainPct(v, digits = 2) { return v === null || v === undefined ? "–" : fmt(v, digits) + "%"; }
  function price(v) { if (v === null || v === undefined) return "–"; const a = Math.abs(v); return fmt(v, a >= 1000 ? 2 : a >= 10 ? 3 : 5); }
  function dt(iso) {
    if (!iso) return "–";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function dt2(iso) {
    if (!iso) return "–";
    const d = new Date(iso);
    return `<div class="dt2"><span>${esc(d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }))}</span><span class="muted">${esc(d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }))}</span></div>`;
  }
  function dtShort(iso) { if (!iso) return "–"; const d = new Date(iso); return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  function dur(s) {
    if (s === null || s === undefined) return "–";
    if (s < 3600) return Math.round(s / 60) + "m";
    if (s < 86400) return (s / 3600).toFixed(1) + "h";
    return (s / 86400).toFixed(1) + "d";
  }
  function ago(sec) { if (sec === null || sec === undefined) return "never"; if (sec < 2) return "just now"; if (sec < 60) return Math.round(sec) + "s ago"; if (sec < 3600) return Math.round(sec / 60) + "m ago"; return Math.round(sec / 3600) + "h ago"; }
  function pf(v) { if (v === null || v === undefined) return "–"; if (v === Infinity || v === "inf") return "∞"; return fmt(v, 2); }
  function stateLabel(s) { return { connected: "Connected", connecting: "Connecting", starting: "Starting", degraded: "Degraded", stale: "Stale", error: "Error", stopped: "Stopped" }[s] || s; }

  /* ---------------- api ---------------- */
  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: "same-origin", ...opts });
    if (res.status === 401) { showLock(); throw new Error("unauthorized"); }
    if (!res.ok) { let msg = res.statusText; try { msg = (await res.json()).detail || msg; } catch (_) { } throw new Error(msg); }
    return res.json();
  }
  function showLock() { $("#lock").classList.remove("hidden"); }
  $("#lock-go").addEventListener("click", () => { const t = $("#lock-token").value.trim(); if (t) location.href = "/auth?token=" + encodeURIComponent(t); });
  $("#lock-token").addEventListener("keydown", e => { if (e.key === "Enter") $("#lock-go").click(); });

  /* ---------------- shell ---------------- */
  function accounts() { return S.overview ? S.overview.accounts : []; }
  function scopedAccounts() { return accounts().filter(a => S.scope === "all" || a.id === S.scope); }
  function acct(id) { return accounts().find(a => a.id === id); }

  function renderShell() {
    const ov = S.overview;
    $("#foot-version").textContent = `MT5 Control Center v${ov.version}`;
    $("#clock-text").textContent = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + ` · ${ov.report_timezone}`;
    const anyLive = ov.accounts.some(a => a.state === "connected");
    $("#live-dot").classList.toggle("off", !anyLive);
    // account list
    $("#acct-list").innerHTML = ov.accounts.map(a => `
      <button class="acct-item ${S.scope === a.id ? "active" : ""}" data-scope="${esc(a.id)}">
        <span class="dot c-${esc(a.color)}"></span>
        <span><div class="lbl">${esc(a.label)}</div><div class="meta">${a.account ? esc(a.account.login) + " · " + esc(a.account.server) : esc(stateLabel(a.state))}</div></span>
        <span class="pill ${esc(a.state)}" title="${esc(a.message)}"></span>
      </button>`).join("");
    // scope switch
    $("#scope").innerHTML = [`<button data-scope="all" class="${S.scope === "all" ? "active" : ""}">All accounts</button>`]
      .concat(ov.accounts.map(a => `<button data-scope="${esc(a.id)}" class="${S.scope === a.id ? "active" : ""}"><span class="dot c-${esc(a.color)}"></span>${esc(a.label)}</button>`)).join("");
    document.querySelectorAll("[data-scope]").forEach(b => b.addEventListener("click", () => { S.scope = b.dataset.scope; S.tf.page = 1; renderShell(); renderView(); }));
  }

  $("#nav").addEventListener("click", e => {
    const b = e.target.closest("button[data-view]");
    if (!b) return;
    S.view = b.dataset.view;
    document.querySelectorAll("#nav button").forEach(x => x.classList.toggle("active", x === b));
    $("#view-title").textContent = VIEW_TITLES[S.view];
    renderView();
  });

  function mockBanner() {
    if (!S.overview || !S.overview.mock_mode) return "";
    return `<div class="banner warn"><strong>DEMO DATA</strong><span>One or more account slots run in mock mode. Every number shown for them is synthetic and is not a trading result. Configure your terminals in <span class="mono">config/accounts.json</span> and set <span class="mono">mock_mode</span> to false.</span></div>`;
  }
  function offlineBanners() {
    return accounts().filter(a => ["error", "stale", "degraded", "stopped"].includes(a.state))
      .map(a => `<div class="banner bad"><span class="dot c-${esc(a.color)}"></span><span><strong>${esc(a.label)}</strong> ${esc(stateLabel(a.state))}: ${esc(a.message || "no details")} · <a href="#" data-reconnect="${esc(a.id)}">Reconnect</a></span></div>`).join("");
  }
  function bindReconnect(root) {
    root.querySelectorAll("[data-reconnect]").forEach(a => a.addEventListener("click", async e => { e.preventDefault(); await api(`/api/accounts/${a.dataset.reconnect}/reconnect`, { method: "POST" }); a.textContent = "Reconnecting…"; }));
    root.querySelectorAll("[data-refresh-history]").forEach(a => a.addEventListener("click", async e => { e.preventDefault(); await api(`/api/accounts/${a.dataset.refreshHistory}/refresh-history`, { method: "POST" }); a.textContent = "Refreshing…"; }));
  }

  /* ---------------- view dispatch ---------------- */
  function renderView() {
    Charts.clearRegistry();
    clearTimeout(S.timers.view);
    const token = ++S.viewToken;
    const content = $("#content");
    const fn = { overview: viewOverview, positions: viewPositions, performance: viewPerformance, trades: viewTrades, balance: viewBalance, diagnostics: viewDiagnostics }[S.view];
    Promise.resolve(fn(content, token)).catch(err => {
      if (token !== S.viewToken) return;
      if (err.message !== "unauthorized") content.innerHTML = `<div class="banner bad">Could not load this view: ${esc(err.message)}</div>`;
    });
  }
  function scheduleViewRefresh(ms) { clearTimeout(S.timers.view); S.timers.view = setTimeout(() => { if (!document.hidden) renderView(); else scheduleViewRefresh(ms); }, ms); }

  /* ---------------- OVERVIEW ---------------- */
  function accountCard(a, opts = {}) {
    const acc = a.account, cur = acc ? acc.currency : "";
    const dgt = acc ? (acc.currency_digits ?? 2) : 2;
    const r = a.realized || {};
    const body = acc ? `
      <div class="metrics five">
        <div class="metric"><div class="k">Balance</div><div class="v lg">${money(acc.balance, cur, dgt)}</div></div>
        <div class="metric"><div class="k">Equity</div><div class="v lg">${money(acc.equity, cur, dgt)}</div></div>
        <div class="metric"><div class="k">Floating P/L</div><div class="v lg">${signedMoney(acc.floating, cur, dgt)}</div><div class="s">${a.positions_count} open position${a.positions_count === 1 ? "" : "s"}</div></div>
        <div class="metric"><div class="k">Free margin</div><div class="v">${money(acc.margin_free, cur, dgt)}</div></div>
        <div class="metric"><div class="k">Used margin</div><div class="v">${money(acc.margin, cur, dgt)}</div><div class="s">Level ${acc.margin ? plainPct(acc.margin_level, 1) : "–"}</div></div>
        <div class="metric"><div class="k">Today</div><div class="v">${signedMoney(r.day, cur, dgt)}</div><div class="s">realized P/L</div></div>
        <div class="metric"><div class="k">This week</div><div class="v">${signedMoney(r.week, cur, dgt)}</div><div class="s">realized P/L</div></div>
        <div class="metric"><div class="k">This month</div><div class="v">${signedMoney(r.month, cur, dgt)}</div><div class="s">realized P/L</div></div>
      </div>` : `<div class="empty"><div class="ico">◌</div>${esc(stateLabel(a.state))}${a.message ? " · " + esc(a.message) : ""}<div class="small muted mt6">Waiting for the first account snapshot from this terminal.</div></div>`;
    return `<section class="card acct-card" data-acc="${esc(a.id)}">
      <div class="card-head">
        <span class="dot c-${esc(a.color)}"></span>
        <div class="title"><span class="name">${esc(a.label)} ${a.mock ? '<span class="tag demo">demo data</span>' : ""}</span>
          <span class="login">${acc ? `${esc(acc.login)} · ${esc(acc.server)} · ${esc(acc.company || "")} · 1:${esc(acc.leverage ?? "–")} · ${esc(acc.trade_mode || "")}` : esc(a.terminal_path || "")}</span></div>
        <div class="spacer"></div>
        <span class="xs muted nowrap upd">updated ${esc(ago(a.last_update_age_s))}</span>
        <span class="pill ${esc(a.state)}">${esc(stateLabel(a.state))}</span>
      </div>
      <div class="card-body tight">${body}</div>
      ${opts.equity ? `<div class="card-body"><div class="small dim row-between mb6"><span>Live equity (sampled while this app runs)</span><span class="seg" data-eq="${esc(a.id)}">${[6, 24, 72, 168].map(h => `<button data-h="${h}" class="${S.eqHours === h ? "active" : ""}">${h < 48 ? h + "h" : (h / 24) + "d"}</button>`).join("")}</span></div><div class="eq-chart" data-acc="${esc(a.id)}"></div></div>` : ""}
    </section>`;
  }

  function combinedStrip(ov) {
    const c = ov.combined;
    if (!c) return "";
    if (!c.compatible) {
      const why = c.currencies.length > 1 ? `account currencies differ (${c.currencies.map(esc).join(", ")})` : "not all accounts are connected";
      return `<div class="banner info">Combined totals are not shown because ${why}. Each account is reported separately; nothing is converted or estimated.</div>`;
    }
    return `<section class="card"><div class="card-head"><h3>All accounts combined</h3><span class="sub">${c.accounts_included} accounts · ${esc(c.currency)}</span></div>
      <div class="card-body tight"><div class="metrics five">
        <div class="metric"><div class="k">Total balance</div><div class="v lg">${money(c.balance, c.currency)}</div></div>
        <div class="metric"><div class="k">Total equity</div><div class="v lg">${money(c.equity, c.currency)}</div></div>
        <div class="metric"><div class="k">Floating P/L</div><div class="v lg">${signedMoney(c.floating, c.currency)}</div></div>
        <div class="metric"><div class="k">Free margin</div><div class="v">${money(c.margin_free, c.currency)}</div></div>
        <div class="metric"><div class="k">Open positions</div><div class="v">${c.positions}</div></div>
      </div></div></section>`;
  }

  function compareTable(list) {
    if (list.length < 2) return "";
    const row = (label, fn) => `<tr><td>${label}</td>${list.map(a => `<td class="num">${a.account ? fn(a) : "–"}</td>`).join("")}</tr>`;
    const cur = a => a.account.currency, dg = a => a.account.currency_digits ?? 2;
    return `<section class="card"><div class="card-head"><h3>Account comparison</h3></div><div class="table-wrap"><table class="data compare">
      <thead><tr><th>Metric</th>${list.map(a => `<th class="num"><span class="dot c-${esc(a.color)} mr6"></span>${esc(a.label)}</th>`).join("")}</tr></thead><tbody>
      ${row("Currency", a => esc(cur(a)))}
      ${row("Balance", a => money(a.account.balance, cur(a), dg(a)))}
      ${row("Equity", a => money(a.account.equity, cur(a), dg(a)))}
      ${row("Floating P/L", a => signedMoney(a.account.floating, cur(a), dg(a)))}
      ${row("Used margin", a => money(a.account.margin, cur(a), dg(a)))}
      ${row("Free margin", a => money(a.account.margin_free, cur(a), dg(a)))}
      ${row("Margin level", a => a.account.margin ? plainPct(a.account.margin_level, 1) : "–")}
      ${row("Open positions", a => a.positions_count)}
      ${row("Realized today", a => signedMoney(a.realized?.day, cur(a), dg(a)))}
      ${row("Realized this week", a => signedMoney(a.realized?.week, cur(a), dg(a)))}
      ${row("Realized this month", a => signedMoney(a.realized?.month, cur(a), dg(a)))}
      ${row("Leverage", a => "1:" + esc(a.account.leverage))}
      ${row("Connection", a => `<span class="pill ${esc(a.state)}">${esc(stateLabel(a.state))}</span>`)}
      ${row("Last update", a => esc(ago(a.last_update_age_s)))}
    </tbody></table></div></section>`;
  }

  async function viewOverview(content, token) {
    const ov = S.overview;
    const list = scopedAccounts();
    content.innerHTML = mockBanner() + offlineBanners() + (S.scope === "all" ? combinedStrip(ov) : "") +
      `<div class="grid ${list.length > 1 && S.scope === "all" ? "cols-2" : ""}">${list.map(a => accountCard(a, { equity: true })).join("")}</div>` +
      (S.scope === "all" ? compareTable(list) : "");
    bindReconnect(content);
    content.querySelectorAll("[data-eq] button").forEach(b => b.addEventListener("click", () => { S.eqHours = +b.dataset.h; renderView(); }));
    for (const a of list) {
      const holder = content.querySelector(`.eq-chart[data-acc="${CSS.escape(a.id)}"]`);
      if (!holder) continue;
      const data = await api(`/api/accounts/${a.id}/equity?hours=${S.eqHours}`);
      if (token !== S.viewToken) return;
      const cur = a.account?.currency;
      Charts.responsive(holder, () => Charts.lineChart(holder, {
        height: 150, baseline: null,
        series: [
          { name: "Equity", color: COLOR_HEX[a.color] || "#3987e5", points: data.samples.map(s => ({ x: s.t, y: s.equity })) },
          { name: "Balance", color: "#6f7684", points: data.samples.map(s => ({ x: s.t, y: s.balance })), area: false, step: true },
        ],
        yFormat: v => Charts.compact(v), tipFormat: v => fmt(v, 2) + " " + (cur || ""),
        emptyText: "Equity samples appear here a few seconds after the first connection",
      }));
      if (data.samples.length) holder.insertAdjacentHTML("beforeend", `<div class="legend mt6"><span><i class="c-${esc(a.color)}"></i>Equity</span><span><i class="c-gray"></i>Balance</span><span class="muted">${data.samples.length} samples</span></div>`);
    }
    scheduleViewRefresh(Math.max(5000, (ov.refresh_seconds || 2) * 2500));
  }

  /* ---------------- POSITIONS ---------------- */
  async function viewPositions(content, token) {
    const list = scopedAccounts();
    const results = await Promise.all(list.map(a => api(`/api/accounts/${a.id}/positions`).catch(() => null)));
    if (token !== S.viewToken) return;
    let html = mockBanner() + offlineBanners();
    list.forEach((a, i) => {
      const r = results[i];
      const cur = r?.currency;
      const rows = r?.positions || [];
      html += `<section class="card"><div class="card-head"><span class="dot c-${esc(a.color)}"></span><h3>${esc(a.label)}</h3><span class="sub">${rows.length} open · updated ${esc(ago(a.last_update_age_s))}</span><div class="spacer"></div><span class="dim small">Floating ${signedMoney(r?.floating_total, cur)}</span></div>
      <div class="table-wrap">${rows.length ? `<table class="data"><thead><tr><th>Symbol</th><th>Side</th><th class="num">Volume</th><th class="num">Open price</th><th class="num">Current</th><th class="num">S/L</th><th class="num">T/P</th><th class="num">Swap</th><th class="num">Profit</th><th class="num">Net</th><th>Opened</th><th class="num">Ticket</th><th>Comment</th></tr></thead><tbody>
        ${rows.map(p => `<tr><td class="sym">${esc(p.symbol)}</td><td><span class="tag ${p.direction.toLowerCase()}">${p.direction}</span></td><td class="num">${fmt(p.volume, 2)}</td><td class="num">${price(p.price_open)}</td><td class="num">${price(p.price_current)}</td><td class="num muted">${p.sl ? price(p.sl) : "–"}</td><td class="num muted">${p.tp ? price(p.tp) : "–"}</td><td class="num">${signedMoney(p.swap, null)}</td><td class="num">${signedMoney(p.profit, null)}</td><td class="num">${signedMoney(p.net, cur)}</td><td class="dim">${esc(dt(p.open_time))}</td><td class="num muted">${esc(p.ticket)}</td><td class="muted">${esc(p.comment || "")}</td></tr>`).join("")}
        </tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${fmt(rows.reduce((s, p) => s + p.volume, 0), 2)}</td><td colspan="4"></td><td class="num">${signedMoney(rows.reduce((s, p) => s + (p.swap || 0), 0))}</td><td class="num">${signedMoney(rows.reduce((s, p) => s + (p.profit || 0), 0))}</td><td class="num">${signedMoney(r.floating_total, cur)}</td><td colspan="3"></td></tr></tfoot></table>` : `<div class="empty"><div class="ico">—</div>${r ? "No open positions" : "Account not available"}</div>`}</div></section>`;
    });
    content.innerHTML = html;
    bindReconnect(content);
    scheduleViewRefresh(Math.max(3000, (S.overview.refresh_seconds || 2) * 1500));
  }

  /* ---------------- PERFORMANCE ---------------- */
  function periodBar() {
    const periods = [["day", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"], ["all", "All loaded"], ["custom", "Custom"]];
    return `<div class="filters"><span class="seg" id="period-seg">${periods.map(([k, l]) => `<button data-p="${k}" class="${S.perfPeriod === k ? "active" : ""}">${l}</button>`).join("")}</span>
      <label class="${S.perfPeriod === "custom" ? "" : "hidden"}">From<input type="date" id="pf-from" value="${esc(S.custom.from)}"></label>
      <label class="${S.perfPeriod === "custom" ? "" : "hidden"}">To<input type="date" id="pf-to" value="${esc(S.custom.to)}"></label>
      <span class="spacer flex1"></span><span class="xs muted">Periods use the report timezone (${esc(S.overview.report_timezone)})</span></div>`;
  }

  function perfSection(a, p) {
    if (!p.available) return `<section class="card"><div class="card-head"><span class="dot c-${esc(a.color)}"></span><h3>${esc(a.label)}</h3></div><div class="empty">${esc(p.reason || "No data")}</div></section>`;
    const cur = p.currency, st = p.stats, rp = p.realized.period, fl = p.flows.period;
    const rec = p.reconciliation;
    const recTag = rec.verified ? `<span class="tag ok" title="Reconstructed trades sum to the MT5 deal ledger within 0.01">Verified vs MT5 deals</span>` : `<span class="tag warn" title="Difference between reconstructed trades and the deal ledger">Unverified · diff ${fmt(rec.difference)}</span>`;
    const incomplete = st.incomplete ? `<span class="tag warn">${st.incomplete} incomplete trade${st.incomplete > 1 ? "s" : ""}</span>` : "";
    const periodName = { day: "today", week: "this week", month: "this month", year: "this year", all: "all loaded history", custom: "selected range" }[p.period.name] || p.period.name;
    const id = esc(a.id);
    return `<section class="card" data-acc="${id}">
      <div class="card-head"><span class="dot c-${esc(a.color)}"></span><h3>${esc(a.label)}</h3><span class="sub">${esc(periodName)} · history from ${esc(dt(p.history_window.from))}</span><div class="spacer"></div>${incomplete} ${recTag}</div>
      <div class="card-body">
        <div class="tiles">
          <div class="tile"><div class="k">Realized P/L</div><div class="v">${signedMoney(rp.net, cur)}</div><div class="s">${rp.deals} deals · gross ${signedMoney(rp.gross)}</div></div>
          <div class="tile"><div class="k">Closed trades</div><div class="v">${st.trades}</div><div class="s"><span class="pos">${st.wins} won</span> · <span class="neg">${st.losses} lost</span>${st.breakeven ? ` · ${st.breakeven} flat` : ""}</div></div>
          <div class="tile"><div class="k">Win rate</div><div class="v">${pct(st.win_rate)}</div><div class="s">expectancy ${signedMoney(st.expectancy, cur)}</div></div>
          <div class="tile"><div class="k">Profit factor</div><div class="v">${pf(st.profit_factor)}</div><div class="s">gross ${signedMoney(st.gross_profit)} / ${signedMoney(st.gross_loss)}</div></div>
          <div class="tile"><div class="k">Avg win</div><div class="v">${signedMoney(st.avg_win, cur)}</div><div class="s">largest ${signedMoney(st.largest_win)}</div></div>
          <div class="tile"><div class="k">Avg loss</div><div class="v">${signedMoney(st.avg_loss, cur)}</div><div class="s">largest ${signedMoney(st.largest_loss)}</div></div>
          <div class="tile"><div class="k">Volume</div><div class="v">${fmt(st.volume, 2)} <span class="cur">lots</span></div><div class="s">avg hold ${dur(st.avg_duration_s)}</div></div>
          <div class="tile"><div class="k">Max drawdown</div><div class="v neg">${p.curve.max_drawdown ? "−" + fmt(p.curve.max_drawdown) : "0.00"}<span class="cur">${esc(cur)}</span></div><div class="s">closed trades · current ${fmt(p.curve.current_drawdown)}</div></div>
        </div>
        <div class="grid cols-2 mt14">
          <div><div class="small dim mb6">Cumulative realized P/L · ${esc(periodName)}</div><div id="curve-${id}"></div></div>
          <div><div class="small dim mb6">Daily realized P/L (deal-based) · ${esc(periodName)}</div><div id="daily-${id}"></div></div>
          <div><div class="small dim mb6">Drawdown from peak (closed trades)</div><div id="dd-${id}"></div></div>
          <div><div class="small dim mb6">Account balance history (anchored to live balance; includes deposits & withdrawals)</div><div id="bal-${id}"></div></div>
        </div>
        <div class="grid cols-3 mt14">
          <div class="card sub-card"><div class="card-head"><h3>P/L composition · ${esc(periodName)}</h3></div><div class="card-body"><dl class="kv">
            <dt>Gross trading result</dt><dd>${signedMoney(rp.gross, cur)}</dd>
            <dt>Commission</dt><dd>${signedMoney(rp.commission, cur)}</dd>
            <dt>Swap</dt><dd>${signedMoney(rp.swap, cur)}</dd>
            <dt>Fees</dt><dd>${signedMoney(rp.fee, cur)}</dd>
            <dt><strong>Realized net</strong></dt><dd><strong>${signedMoney(rp.net, cur)}</strong></dd>
            <dt class="pt6">Floating P/L (open now)</dt><dd class="pt6">${signedMoney(p.floating, cur)}</dd>
          </dl></div></div>
          <div class="card sub-card"><div class="card-head"><h3>Balance operations · ${esc(periodName)}</h3></div><div class="card-body"><dl class="kv">
            <dt>Deposits</dt><dd>${signedMoney(fl.deposits, cur)}</dd>
            <dt>Withdrawals</dt><dd>${signedMoney(fl.withdrawals, cur)}</dd>
            <dt>Credit</dt><dd>${signedMoney(fl.credit, cur)}</dd>
            <dt>Adjustments / other</dt><dd>${signedMoney(fl.adjustments, cur)}</dd>
            <dt class="pt6">Realized today</dt><dd class="pt6">${signedMoney(p.realized.day.net, cur)}</dd>
            <dt>Realized this week</dt><dd>${signedMoney(p.realized.week.net, cur)}</dd>
            <dt>Realized this month</dt><dd>${signedMoney(p.realized.month.net, cur)}</dd>
            <dt>Realized all loaded</dt><dd>${signedMoney(p.realized.all.net, cur)}</dd>
          </dl></div></div>
          <div class="card sub-card"><div class="card-head"><h3>Reconciliation</h3></div><div class="card-body"><dl class="kv">
            <dt>MT5 deal ledger net</dt><dd>${signedMoney(rec.deals_net, cur)}</dd>
            <dt>Reconstructed trades net</dt><dd>${signedMoney(rec.trades_net, cur)}</dd>
            <dt>Entry costs of open positions</dt><dd>${signedMoney(rec.open_entry_costs, cur)}</dd>
            <dt>Difference</dt><dd class="${rec.verified ? "pos" : "neg"}">${fmt(Math.abs(rec.difference) < 0.005 ? 0 : rec.difference)}</dd>
            <dt>Incomplete trades</dt><dd>${rec.incomplete_trades}</dd>
            <dt>Unresolved positions</dt><dd>${rec.unresolved_positions}</dd>
          </dl></div></div>
        </div>
        <div class="grid cols-2 mt14">
          <div class="card sub-card"><div class="card-head"><h3>By symbol</h3></div><div class="table-wrap">${p.by_symbol.length ? `<table class="data"><thead><tr><th>Symbol</th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Volume</th><th class="num">PF</th><th class="num">Net</th></tr></thead><tbody>
            ${p.by_symbol.map(r => `<tr><td class="sym">${esc(r.symbol)}</td><td class="num">${r.trades}</td><td class="num">${pct(r.win_rate)}</td><td class="num">${fmt(r.volume, 2)}</td><td class="num">${pf(r.profit_factor)}</td><td class="num">${signedMoney(r.net, cur)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No closed trades in this period</div>`}</div></div>
          <div class="card sub-card"><div class="card-head"><h3>By trading session</h3><span class="sub">entry time, UTC</span></div><div class="table-wrap"><table class="data"><thead><tr><th>Session</th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Volume</th><th class="num">PF</th><th class="num">Net</th></tr></thead><tbody>
            ${p.by_session.map(r => `<tr><td>${esc(r.session)}</td><td class="num">${r.trades}</td><td class="num">${pct(r.win_rate)}</td><td class="num">${fmt(r.volume, 2)}</td><td class="num">${pf(r.profit_factor)}</td><td class="num">${signedMoney(r.net, cur)}</td></tr>`).join("")}</tbody></table></div>
            <div class="card-body"><div id="sym-${id}"></div></div></div>
        </div>
        <ul class="notes mt14">${p.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>
      </div></section>`;
  }

  async function viewPerformance(content, token) {
    const list = scopedAccounts();
    const q = S.perfPeriod === "custom" ? `period=custom&from=${encodeURIComponent(S.custom.from)}&to=${encodeURIComponent(S.custom.to)}` : `period=${S.perfPeriod}`;
    content.innerHTML = mockBanner() + periodBar() + `<div class="loading-row"><div class="spinner"></div>Computing statistics…</div>`;
    bindPeriodBar(content);
    const results = await Promise.all(list.map(a => api(`/api/accounts/${a.id}/performance?${q}`).catch(e => ({ available: false, reason: e.message }))));
    const balances = await Promise.all(list.map(a => api(`/api/accounts/${a.id}/balance-curve`).catch(() => ({ available: false, points: [] }))));
    if (token !== S.viewToken) return;
    content.innerHTML = mockBanner() + periodBar() + list.map((a, i) => perfSection(a, results[i])).join("");
    bindPeriodBar(content);
    list.forEach((a, i) => {
      const p = results[i]; if (!p.available) return;
      const cur = p.currency, color = COLOR_HEX[a.color] || "#3987e5";
      const id = a.id, mf = v => fmt(v, 2) + " " + (cur || "");
      const cEl = $(`#curve-${CSS.escape(id)}`), dEl = $(`#daily-${CSS.escape(id)}`), ddEl = $(`#dd-${CSS.escape(id)}`), bEl = $(`#bal-${CSS.escape(id)}`), sEl = $(`#sym-${CSS.escape(id)}`);
      Charts.responsive(cEl, () => Charts.lineChart(cEl, { height: 200, baseline: 0, series: [{ name: "Realized P/L", color, points: p.curve.points.map(q => ({ x: q.t, y: q.cum })), step: true }], tipFormat: mf, emptyText: "No closed trades in this period" }));
      Charts.responsive(dEl, () => Charts.barChart(dEl, { height: 200, points: p.daily.map(d => ({ label: d.date.slice(5), title: d.date, value: d.net, extra: d.deals + " deals" })), valueLabel: "Net", tipFormat: mf, emptyText: "No deals in this period" }));
      Charts.responsive(ddEl, () => Charts.lineChart(ddEl, { height: 160, baseline: 0, series: [{ name: "Drawdown", color: "#e04f4f", points: p.curve.points.map(q => ({ x: q.t, y: q.dd })), step: true }], tipFormat: mf, emptyText: "No closed trades in this period" }));
      const bc = balances[i];
      Charts.responsive(bEl, () => Charts.lineChart(bEl, { height: 160, baseline: null, series: [{ name: "Balance", color: "#9085e9", points: (bc.points || []).map(q => ({ x: q.t, y: q.balance })), step: true }], tipFormat: mf, emptyText: "Balance history appears once deals are loaded" }));
      Charts.responsive(sEl, () => Charts.hbarChart(sEl, { points: p.by_symbol.slice(0, 10).map(r => ({ label: r.symbol, value: r.net })), yFormat: v => Charts.compact(v) }));
    });
    scheduleViewRefresh(20000);
  }
  function bindPeriodBar(root) {
    root.querySelectorAll("#period-seg button").forEach(b => b.addEventListener("click", () => { S.perfPeriod = b.dataset.p; if (S.perfPeriod !== "custom" || (S.custom.from && S.custom.to)) renderView(); else { S.perfPeriod = "custom"; renderView(); } }));
    const f = $("#pf-from", root), t = $("#pf-to", root);
    if (f) f.addEventListener("change", () => { S.custom.from = f.value; if (S.custom.to) renderView(); });
    if (t) t.addEventListener("change", () => { S.custom.to = t.value; if (S.custom.from) renderView(); });
  }

  /* ---------------- TRADES ---------------- */
  function tradeQuery() {
    const t = S.tf, p = new URLSearchParams();
    if (t.symbol) p.set("symbol", t.symbol); if (t.result) p.set("result", t.result); if (t.direction) p.set("direction", t.direction);
    if (t.from) p.set("from", t.from); if (t.to) p.set("to", t.to);
    return p;
  }
  async function viewTrades(content, token) {
    const q = tradeQuery(); q.set("page", S.tf.page); q.set("page_size", S.tf.pageSize);
    const data = await api(`/api/accounts/${S.scope}/trades?${q}`);
    if (token !== S.viewToken) return;
    const many = S.scope === "all";
    const sum = data.summary, cur = sum.currency;
    const pages = Math.max(1, Math.ceil(data.total / data.page_size));
    const csvQ = tradeQuery();
    content.innerHTML = mockBanner() + `
      <div class="filters">
        <label>Symbol<select id="tf-symbol"><option value="">All symbols</option>${data.symbols.map(s => `<option ${S.tf.symbol === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
        <label>Result<select id="tf-result"><option value="">Any</option><option value="win" ${S.tf.result === "win" ? "selected" : ""}>Winning</option><option value="loss" ${S.tf.result === "loss" ? "selected" : ""}>Losing</option><option value="breakeven" ${S.tf.result === "breakeven" ? "selected" : ""}>Break-even</option></select></label>
        <label>Side<select id="tf-dir"><option value="">Any</option><option value="BUY" ${S.tf.direction === "BUY" ? "selected" : ""}>Buy</option><option value="SELL" ${S.tf.direction === "SELL" ? "selected" : ""}>Sell</option></select></label>
        <label>Closed from<input type="date" id="tf-from" value="${esc(S.tf.from)}"></label>
        <label>Closed to<input type="date" id="tf-to" value="${esc(S.tf.to)}"></label>
        <label>&nbsp;<button class="btn" id="tf-clear">Clear</button></label>
        <span class="flex1"></span>
        <label>&nbsp;<a class="btn primary" href="/api/accounts/${esc(S.scope)}/trades.csv?${csvQ}" download>Export CSV (${data.total})</a></label>
      </div>
      <div class="tiles">
        <div class="tile"><div class="k">Trades</div><div class="v">${data.total}</div><div class="s"><span class="pos">${sum.wins} won</span> · <span class="neg">${sum.losses} lost</span></div></div>
        <div class="tile"><div class="k">Net result</div><div class="v">${sum.net === null ? '<span class="muted small">mixed currencies</span>' : signedMoney(sum.net, cur)}</div><div class="s">${sum.net === null ? "not summed across currencies" : "filtered selection"}</div></div>
        <div class="tile"><div class="k">Volume</div><div class="v">${fmt(sum.volume, 2)} <span class="cur">lots</span></div></div>
        <div class="tile"><div class="k">Win rate</div><div class="v">${data.total ? pct(sum.wins / data.total) : "–"}</div></div>
      </div>
      <section class="card"><div class="table-wrap">${data.trades.length ? `<table class="data compact"><thead><tr>${many ? "<th>Account</th>" : ""}<th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th class="num">Entry price</th><th class="num">Exit price</th><th class="num">Volume</th><th class="num">Gross</th><th class="num">Commission</th><th class="num">Swap</th><th class="num">Fee</th><th class="num">Net</th><th>Hold</th><th>Flags</th></tr></thead><tbody>
        ${data.trades.map(t => `<tr>${many ? `<td><span class="dot c-${esc(acct(t.account_id)?.color || "blue")}" class="mr6"></span>${esc(t.account_label)}</td>` : ""}<td class="sym">${esc(t.symbol)}</td><td><span class="tag ${t.direction.toLowerCase()}">${t.direction}</span></td><td class="dim">${dt2(t.entry_time_iso)}</td><td class="dim">${dt2(t.exit_time_iso)}</td><td class="num">${t.entry_price === null ? '<span class="muted">unknown</span>' : price(t.entry_price)}</td><td class="num">${price(t.exit_price)}</td><td class="num">${fmt(t.volume, 2)}</td><td class="num">${signedMoney(t.gross)}</td><td class="num">${signedMoney(t.commission)}</td><td class="num">${signedMoney(t.swap)}</td><td class="num">${signedMoney(t.fee)}</td><td class="num"><strong>${signedMoney(t.net, t.currency)}</strong></td><td class="dim">${dur(t.duration_s)}</td><td>${t.partial ? '<span class="tag neutral" title="Partial close of a larger position">partial</span> ' : ""}${t.entries > 1 ? `<span class="tag neutral" title="${t.entries} entry deals, volume-weighted entry price">${t.entries}× in</span> ` : ""}${t.reversal ? '<span class="tag neutral" title="Position reversal (in/out deal)">reversal</span> ' : ""}${t.incomplete ? '<span class="tag warn" title="Entry deal not found in terminal history; entry price unknown">incomplete</span>' : ""}</td></tr>`).join("")}
        </tbody></table>` : `<div class="empty"><div class="ico">—</div>No closed trades match these filters</div>`}</div>
        <div class="pager"><span>${data.total ? `${(data.page - 1) * data.page_size + 1}–${Math.min(data.total, data.page * data.page_size)} of ${data.total}` : "0 trades"}</span>
          <button class="btn sm" id="pg-prev" ${data.page <= 1 ? "disabled" : ""}>‹ Prev</button><span>Page ${data.page} / ${pages}</span><button class="btn sm" id="pg-next" ${data.page >= pages ? "disabled" : ""}>Next ›</button>
          <select id="pg-size" class="btn sm">${[25, 50, 100, 250].map(n => `<option ${S.tf.pageSize === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      </section>`;
    const re = () => { S.tf.page = 1; renderView(); };
    $("#tf-symbol").addEventListener("change", e => { S.tf.symbol = e.target.value; re(); });
    $("#tf-result").addEventListener("change", e => { S.tf.result = e.target.value; re(); });
    $("#tf-dir").addEventListener("change", e => { S.tf.direction = e.target.value; re(); });
    $("#tf-from").addEventListener("change", e => { S.tf.from = e.target.value; re(); });
    $("#tf-to").addEventListener("change", e => { S.tf.to = e.target.value; re(); });
    $("#tf-clear").addEventListener("click", () => { S.tf = { ...S.tf, symbol: "", result: "", direction: "", from: "", to: "", page: 1 }; renderView(); });
    $("#pg-prev").addEventListener("click", () => { S.tf.page--; renderView(); });
    $("#pg-next").addEventListener("click", () => { S.tf.page++; renderView(); });
    $("#pg-size").addEventListener("change", e => { S.tf.pageSize = +e.target.value; re(); });
    scheduleViewRefresh(30000);
  }

  /* ---------------- BALANCE OPS ---------------- */
  async function viewBalance(content, token) {
    const list = scopedAccounts();
    const results = await Promise.all(list.map(a => api(`/api/accounts/${a.id}/balance-ops`).catch(() => ({ operations: [] }))));
    if (token !== S.viewToken) return;
    content.innerHTML = mockBanner() + `<div class="banner info">Deposits, withdrawals, credit and adjustments are listed here and are never counted as trading profit or loss anywhere in this application.</div>` + list.map((a, i) => {
      const ops = results[i].operations, cur = results[i].currency;
      const tot = cat => ops.filter(o => o.category === cat).reduce((s, o) => s + o.amount, 0);
      return `<section class="card"><div class="card-head"><span class="dot c-${esc(a.color)}"></span><h3>${esc(a.label)}</h3><span class="sub">${ops.length} operations in loaded history</span></div>
        <div class="card-body tight"><div class="metrics">
          <div class="metric"><div class="k">Deposits</div><div class="v">${signedMoney(tot("deposit"), cur)}</div></div>
          <div class="metric"><div class="k">Withdrawals</div><div class="v">${signedMoney(tot("withdrawal"), cur)}</div></div>
          <div class="metric"><div class="k">Credit</div><div class="v">${signedMoney(tot("credit"), cur)}</div></div>
          <div class="metric"><div class="k">Other adjustments</div><div class="v">${signedMoney(ops.filter(o => !["deposit", "withdrawal", "credit"].includes(o.category)).reduce((s, o) => s + o.amount, 0), cur)}</div></div>
        </div></div>
        <div class="table-wrap">${ops.length ? `<table class="data"><thead><tr><th>Time</th><th>Type</th><th>Category</th><th class="num">Amount</th><th>Comment</th><th class="num">Ticket</th></tr></thead><tbody>
          ${ops.map(o => `<tr><td class="dim">${esc(dt(o.time_iso))}</td><td>${esc(o.type_name)}</td><td><span class="tag neutral">${esc(o.category)}</span></td><td class="num">${signedMoney(o.amount, cur)}</td><td class="muted">${esc(o.comment)}</td><td class="num muted">${esc(o.ticket)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No balance operations in loaded history</div>`}</div></section>`;
    }).join("");
    scheduleViewRefresh(60000);
  }

  /* ---------------- DIAGNOSTICS ---------------- */
  async function viewDiagnostics(content, token) {
    const d = await api("/api/diagnostics");
    if (token !== S.viewToken) return;
    const sec = d.security, set = d.settings;
    content.innerHTML = mockBanner() + `
      <div class="grid cols-2">
        <section class="card"><div class="card-head"><h3>Security</h3></div><div class="card-body"><dl class="kv">
          <dt>Listening on</dt><dd class="mono">${esc(sec.bind)}</dd>
          <dt>Reachable from other computers</dt><dd>${sec.loopback_only ? '<span class="tag ok">No · loopback only</span>' : '<span class="tag bad">Yes · check settings.json</span>'}</dd>
          <dt>Access key required</dt><dd><span class="tag ok">Yes</span></dd>
          <dt>Trading functions</dt><dd><span class="tag ok">None · read-only</span></dd>
          <dt>External resources loaded</dt><dd><span class="tag ok">None</span></dd>
        </dl></div></section>
        <section class="card"><div class="card-head"><h3>Settings</h3><span class="sub">config/settings.json</span></div><div class="card-body"><dl class="kv">
          <dt>Snapshot refresh</dt><dd>${esc(set.refresh_seconds)} s</dd>
          <dt>History refresh</dt><dd>${esc(set.history_refresh_seconds)} s</dd>
          <dt>History lookback</dt><dd>${esc(set.history_lookback_days)} days</dd>
          <dt>Equity sampling</dt><dd>every ${esc(set.equity_sample_seconds)} s</dd>
          <dt>Report timezone</dt><dd>${esc(set.report_timezone)} → ${esc(set.report_timezone_resolved)}</dd>
          <dt>Mock mode (global)</dt><dd>${set.mock_mode ? '<span class="tag demo">on</span>' : "off"}</dd>
        </dl></div></section>
      </div>
      ${d.accounts.map(a => `<section class="card"><div class="card-head"><span class="dot c-${esc(a.color)}"></span><h3>${esc(a.label)}</h3><span class="sub">slot <span class="mono">${esc(a.id)}</span></span><div class="spacer"></div>
          <span class="pill ${esc(a.state)}">${esc(stateLabel(a.state))}</span>
          <a href="#" class="btn sm" data-refresh-history="${esc(a.id)}">Reload history</a>
          <a href="#" class="btn sm" data-reconnect="${esc(a.id)}">Reconnect</a></div>
        <div class="card-body"><div class="grid cols-3">
          <dl class="kv">
            <dt>Status message</dt><dd title="${esc(a.message)}">${esc(a.message || "–")}</dd>
            <dt>Connection mode</dt><dd>${esc(a.auth_mode)}${a.mock ? ' <span class="tag demo">demo</span>' : ""}</dd>
            <dt>Password source</dt><dd title="${esc(a.password_source)}">${esc(a.password_source)}</dd>
            <dt>Configured login</dt><dd>${esc(a.login ?? "– (attach to terminal)")}</dd>
            <dt>Configured server</dt><dd>${esc(a.server || "–")}</dd>
            <dt>Terminal path</dt><dd title="${esc(a.terminal_path)}">${esc(a.terminal_path || "default")}</dd>
            <dt>Portable</dt><dd>${a.portable ? "yes" : "no"}</dd>
            <dt>Server clock offset</dt><dd>${esc(a.server_utc_offset_hours)} h</dd>
          </dl>
          <dl class="kv">
            <dt>Live login</dt><dd>${esc(a.account?.login ?? "–")}</dd>
            <dt>Live server</dt><dd>${esc(a.account?.server ?? "–")}</dd>
            <dt>Broker</dt><dd title="${esc(a.account?.company)}">${esc(a.account?.company ?? "–")}</dd>
            <dt>Account type</dt><dd>${esc(a.account?.trade_mode ?? "–")} · ${esc(a.account?.margin_mode ?? "")}</dd>
            <dt>Terminal build</dt><dd>${esc(a.terminal?.build ?? "–")}</dd>
            <dt>Terminal ↔ broker</dt><dd>${a.terminal ? (a.terminal.connected ? '<span class="tag ok">connected</span>' : '<span class="tag bad">disconnected</span>') : "–"}</dd>
            <dt>Ping</dt><dd>${a.terminal?.ping_ms ? fmt(a.terminal.ping_ms, 0) + " ms" : "–"}</dd>
          </dl>
          <dl class="kv">
            <dt>Worker PID</dt><dd>${esc(a.worker_pid ?? "–")} ${a.worker_alive ? '<span class="tag ok">alive</span>' : '<span class="tag bad">dead</span>'}</dd>
            <dt>Worker uptime</dt><dd>${dur(a.worker_uptime_s)}</dd>
            <dt>Restarts</dt><dd>${a.restarts}</dd>
            <dt>Last heartbeat</dt><dd>${esc(ago(a.last_heartbeat_age_s))}</dd>
            <dt>Last snapshot</dt><dd>${esc(ago(a.last_update_age_s))}</dd>
            <dt>Deals loaded</dt><dd>${a.deals_count} (v${a.deals_version})</dd>
            <dt>History from</dt><dd>${esc(dt(a.history_from))}</dd>
            <dt>Last history update</dt><dd>${esc(dt(a.last_history_update))}</dd>
            <dt>Reconciliation</dt><dd>${a.reconciliation ? (a.reconciliation.verified ? '<span class="tag ok">verified</span>' : `<span class="tag warn">diff ${fmt(a.reconciliation.difference)}</span>`) : "–"}</dd>
            <dt>Incomplete positions</dt><dd>${a.incomplete_positions.length}</dd>
          </dl>
        </div>
        <div class="section-title my14"><h3 class="small dim">Worker log</h3><div class="line"></div></div>
        <div class="log">${a.logs.length ? a.logs.slice().reverse().map(l => `<div class="${esc(l.level)}"><span class="ts">${esc(dtShort(l.time))}</span>${esc(l.message)}</div>`).join("") : '<span class="muted">No log entries yet</span>'}</div>
      </div></section>`).join("")}`;
    bindReconnect(content);
    scheduleViewRefresh(5000);
  }

  /* ---------------- polling ---------------- */
  async function pollOverview() {
    try {
      const ov = await api("/api/overview");
      const first = !S.overview;
      S.overview = ov;
      $("#lock").classList.add("hidden");
      renderShell();
      if (first) { $("#view-title").textContent = VIEW_TITLES[S.view]; renderView(); }
      else if (S.view === "overview") patchOverview();
    } catch (e) {
      if (e.message !== "unauthorized") { $("#live-dot").classList.add("off"); $("#clock-text").textContent = "server unreachable"; }
    } finally {
      clearTimeout(S.timers.poll);
      S.timers.poll = setTimeout(pollOverview, Math.max(1000, ((S.overview && S.overview.refresh_seconds) || 2) * 1000));
    }
  }
  /* Cheap in-place refresh of overview cards without redrawing charts. */
  function patchOverview() {
    for (const a of scopedAccounts()) {
      const card = $(`.acct-card[data-acc="${CSS.escape(a.id)}"]`);
      if (!card) continue;
      const fresh = document.createElement("div"); fresh.innerHTML = accountCard(a, { equity: false });
      const newBody = fresh.querySelector(".card-body.tight"), oldBody = card.querySelector(".card-body.tight");
      if (newBody && oldBody) oldBody.innerHTML = newBody.innerHTML;
      const pill = card.querySelector(".card-head .pill"); if (pill) { pill.className = `pill ${a.state}`; pill.textContent = stateLabel(a.state); }
      const upd = card.querySelector(".card-head .upd"); if (upd) upd.textContent = "updated " + ago(a.last_update_age_s);
    }
    const strip = $("#content .metrics.five");
    if (S.scope === "all" && S.overview.combined?.compatible && strip) {
      const fresh = document.createElement("div"); fresh.innerHTML = combinedStrip(S.overview);
      const nb = fresh.querySelector(".metrics"); if (nb) strip.innerHTML = nb.innerHTML;
    }
    const cmp = $("#content table.compare");
    if (cmp) { const fresh = document.createElement("div"); fresh.innerHTML = compareTable(scopedAccounts()); const nt = fresh.querySelector("table"); if (nt) cmp.innerHTML = nt.innerHTML; }
  }

  setInterval(() => { if (S.overview) $("#clock-text").textContent = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + ` · ${S.overview.report_timezone}`; }, 1000);
  pollOverview();
})();
