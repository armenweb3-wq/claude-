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

  const VIEW_TITLES = { overview: "Overview", positions: "Open positions", trade: "Trade", performance: "Performance", trades: "Trade history", balance: "Balance operations", diagnostics: "Diagnostics" };
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
    const fn = { overview: viewOverview, positions: viewPositions, trade: viewTrade, performance: viewPerformance, trades: viewTrades, balance: viewBalance, diagnostics: viewDiagnostics }[S.view];
    Promise.resolve(fn(content, token)).catch(err => {
      if (token !== S.viewToken) return;
      if (err.message !== "unauthorized") content.innerHTML = `<div class="banner bad">Could not load this view: ${esc(err.message)}</div>`;
    });
  }
  function scheduleViewRefresh(ms) { clearTimeout(S.timers.view); S.timers.view = setTimeout(() => { if (!document.hidden && !$("#modal") && S.view !== "trade") renderView(); else scheduleViewRefresh(ms); }, ms); }

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
      <div class="table-wrap">${rows.length ? `<table class="data compact"><thead><tr><th>Symbol</th><th>Side</th><th class="num">Volume</th><th class="num">Open price</th><th class="num">Current</th><th class="num">S/L</th><th class="num">T/P</th><th class="num">Swap</th><th class="num">Profit</th><th class="num">Net</th><th>Opened</th><th class="num">Ticket</th><th class="right">Actions</th></tr></thead><tbody>
        ${rows.map(p => `<tr><td class="sym">${esc(p.symbol)}</td><td><span class="tag ${p.direction.toLowerCase()}">${p.direction}</span></td><td class="num">${fmt(p.volume, 2)}</td><td class="num">${price(p.price_open)}</td><td class="num">${price(p.price_current)}</td><td class="num muted">${p.sl ? price(p.sl) : "–"}</td><td class="num muted">${p.tp ? price(p.tp) : "–"}</td><td class="num">${signedMoney(p.swap, null)}</td><td class="num">${signedMoney(p.profit, null)}</td><td class="num">${signedMoney(p.net, cur)}</td><td class="dim">${dt2(p.open_time)}</td><td class="num muted" title="${esc(p.comment || "")}">${esc(p.ticket)}${p.comment ? '<span class="muted"> ✎</span>' : ""}</td><td class="right">${positionActions(a, p, cur)}</td></tr>`).join("")}
        </tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${fmt(rows.reduce((s, p) => s + p.volume, 0), 2)}</td><td colspan="4"></td><td class="num">${signedMoney(rows.reduce((s, p) => s + (p.swap || 0), 0))}</td><td class="num">${signedMoney(rows.reduce((s, p) => s + (p.profit || 0), 0))}</td><td class="num">${signedMoney(r.floating_total, cur)}</td><td colspan="3"></td></tr></tfoot></table>` : `<div class="empty"><div class="ico">—</div>${r ? "No open positions" : "Account not available"}</div>`}</div></section>`;
    });
    content.innerHTML = html;
    bindReconnect(content);
    list.forEach((a, i) => { const sec = content.querySelectorAll("section.card")[i]; if (sec && results[i]) bindPositionActions(sec, a, results[i].positions, results[i].currency); });
    scheduleViewRefresh($("#modal") ? 60000 : Math.max(3000, (S.overview.refresh_seconds || 2) * 1500));
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
          <dt>Trading (global switch)</dt><dd>${sec.trading_global ? '<span class="tag warn">enabled</span>' : '<span class="tag ok">off · read-only</span>'}</dd>
          <dt>Accounts able to trade now</dt><dd>${sec.trading_accounts.length ? sec.trading_accounts.map(esc).join(", ") : "none"}</dd>
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
            <dt>Trading</dt><dd>${a.trading.enabled ? '<span class="tag warn">enabled</span>' : `<span class="tag ok" title="${esc(a.trading.reasons.join("; "))}">off</span>`}</dd>
          </dl>
        </div>
        <div class="section-title my14"><h3 class="small dim">Worker log</h3><div class="line"></div></div>
        <div class="log">${a.logs.length ? a.logs.slice().reverse().map(l => `<div class="${esc(l.level)}"><span class="ts">${esc(dtShort(l.time))}</span>${esc(l.message)}</div>`).join("") : '<span class="muted">No log entries yet</span>'}</div>
      </div></section>`).join("")}`;
    bindReconnect(content);
    scheduleViewRefresh(5000);
  }

  /* ---------------- MODAL ---------------- */
  function openModal({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, requireText = null, onConfirm }) {
    closeModal();
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap"; wrap.id = "modal";
    wrap.innerHTML = `<div class="modal ${danger ? "danger" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3></div>
      <div class="modal-body"></div>
      ${requireText ? `<div class="modal-body pt0"><label class="small dim"><span>Type <strong class="mono">${esc(requireText)}</strong> to confirm</span><input class="confirm-input" autocomplete="off" spellcheck="false"></label></div>` : ""}
      <div class="modal-foot"><span class="modal-err neg small"></span><span class="flex1"></span><button class="btn m-cancel">${esc(cancelLabel)}</button><button class="btn ${danger ? "danger" : "primary"} m-ok" ${requireText ? "disabled" : ""}>${esc(confirmLabel)}</button></div></div>`;
    const bodyEl = wrap.querySelector(".modal-body");
    if (typeof body === "string") bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    document.body.appendChild(wrap);
    const ok = wrap.querySelector(".m-ok"), cancel = wrap.querySelector(".m-cancel"), input = wrap.querySelector(".confirm-input");
    cancel.addEventListener("click", closeModal);
    wrap.addEventListener("click", e => { if (e.target === wrap) closeModal(); });
    if (input) { input.focus(); input.addEventListener("input", () => { ok.disabled = input.value.trim() !== requireText; }); }
    ok.addEventListener("click", async () => {
      ok.disabled = true; ok.textContent = "Working…";
      try { await onConfirm(wrap); closeModal(); }
      catch (err) { wrap.querySelector(".modal-err").textContent = err.message; ok.disabled = false; ok.textContent = confirmLabel; }
    });
    return wrap;
  }
  function closeModal() { const m = $("#modal"); if (m) m.remove(); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  function toast(msg, kind = "ok") {
    let host = $("#toasts"); if (!host) { host = document.createElement("div"); host.id = "toasts"; document.body.appendChild(host); }
    const t = document.createElement("div"); t.className = `toast ${kind}`; t.textContent = msg; host.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10); setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 6000);
  }
  async function post(path, body) { return api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); }

  /* ---------------- POSITION ACTIONS ---------------- */
  function positionActions(a, p, cur) {
    if (!a.trading || !a.trading.enabled) return `<span class="xs muted" title="${esc((a.trading?.reasons || []).join("; "))}">trading off</span>`;
    return `<span class="actions">
      <button class="btn sm" data-act="modify" data-ticket="${p.ticket}">SL/TP</button>
      <button class="btn sm" data-act="partial" data-ticket="${p.ticket}">Partial</button>
      <button class="btn sm danger" data-act="close" data-ticket="${p.ticket}">Close</button></span>`;
  }
  function bindPositionActions(root, a, rows, cur) {
    root.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
      const p = rows.find(r => String(r.ticket) === b.dataset.ticket); if (!p) return;
      const head = `<dl class="kv"><dt>Account</dt><dd>${esc(a.label)}</dd><dt>Position</dt><dd>#${p.ticket} · ${esc(p.symbol)} · <span class="tag ${p.direction.toLowerCase()}">${p.direction}</span> ${fmt(p.volume, 2)} lots</dd><dt>Open / current</dt><dd>${price(p.price_open)} / ${price(p.price_current)}</dd><dt>Floating net</dt><dd>${signedMoney(p.net, cur)}</dd></dl>`;
      if (b.dataset.act === "close") {
        openModal({ title: "Close position at market", danger: true, confirmLabel: "Close position", body: head + `<p class="small dim">The full volume will be closed with a market order. Slippage is limited by the account's deviation setting.</p>`,
          onConfirm: async () => { const r = await post(`/api/accounts/${a.id}/positions/${p.ticket}/close`, { confirm: true }); if (!r.ok) throw new Error(r.result_text + (r.result?.comment ? ` · ${r.result.comment}` : "")); toast(`Closed #${p.ticket} ${p.symbol} @ ${price(r.result.price)}`); renderView(); } });
      } else if (b.dataset.act === "partial") {
        const form = document.createElement("div"); form.innerHTML = head + `<label class="small dim">Volume to close (max ${fmt(p.volume, 2)})<input class="in" type="number" step="0.01" min="0.01" max="${p.volume}" value="${(Math.round(p.volume / 2 * 100) / 100).toFixed(2)}"></label>`;
        openModal({ title: "Partially close position", danger: true, confirmLabel: "Close volume", body: form,
          onConfirm: async () => { const v = parseFloat(form.querySelector(".in").value); if (!(v > 0)) throw new Error("Enter a volume."); const r = await post(`/api/accounts/${a.id}/positions/${p.ticket}/close`, { confirm: true, volume: v }); if (!r.ok) throw new Error(r.result_text + (r.result?.comment ? ` · ${r.result.comment}` : "")); toast(`Closed ${v} lots of #${p.ticket} @ ${price(r.result.price)}`); renderView(); } });
      } else {
        const form = document.createElement("div"); form.innerHTML = head + `<div class="form-row"><label class="small dim">Stop loss (0 = none)<input class="sl" type="number" step="any" value="${p.sl || 0}"></label><label class="small dim">Take profit (0 = none)<input class="tp" type="number" step="any" value="${p.tp || 0}"></label></div>`;
        openModal({ title: "Modify stop loss / take profit", confirmLabel: "Apply", body: form,
          onConfirm: async () => { const sl = parseFloat(form.querySelector(".sl").value) || 0, tp = parseFloat(form.querySelector(".tp").value) || 0; const r = await post(`/api/accounts/${a.id}/positions/${p.ticket}/modify`, { sl, tp }); if (!r.ok) throw new Error(r.result_text + (r.result?.comment ? ` · ${r.result.comment}` : "")); toast(`Updated SL/TP on #${p.ticket}`); renderView(); } });
      }
    }));
  }

  /* ---------------- TRADE TICKET ---------------- */
  const TF = { account: null, symbol: "", side: "BUY", order_kind: "market", price: "", sizing: "risk", risk_percent: "1", lots: "0.10", sl_mode: "points", sl: "", tp_mode: "rr", tp: "2", comment: "" };
  let lastPreview = null;

  async function viewTrade(content, token) {
    const list = accounts();
    if (!TF.account || !list.some(a => a.id === TF.account)) TF.account = (S.scope !== "all" ? S.scope : (list.find(a => a.trading?.enabled) || list[0] || {}).id);
    if (S.scope !== "all") TF.account = S.scope;
    const a = acct(TF.account);
    if (!a) { content.innerHTML = `<div class="empty">No accounts configured</div>`; return; }
    const info = await api(`/api/accounts/${a.id}/trading`);
    if (token !== S.viewToken) return;
    const st = info.status, cur = info.currency || "";
    const disabled = !st.enabled;
    content.innerHTML = mockBanner() + `
      <div class="filters"><span class="small dim">Trade on</span><span class="seg" id="trade-acct">${list.map(x => `<button data-id="${esc(x.id)}" class="${x.id === a.id ? "active" : ""}"><span class="dot c-${esc(x.color)} mr6"></span>${esc(x.label)}</button>`).join("")}</span>
        <span class="flex1"></span><span class="small dim">Equity ${money(info.equity, cur)} · free margin ${money(info.margin_free, cur)}</span></div>
      ${disabled ? `<div class="banner warn"><strong>Trading is off for ${esc(a.label)}</strong><span><ul class="notes">${st.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul></span></div>` : `<div class="banner bad"><strong>Live trading</strong><span>Orders placed here go straight to the broker through the <b>${esc(a.label)}</b> terminal${a.mock ? " (mock: simulated fills)" : ""}. Limits: max risk ${st.limits.max_risk_percent}% · max ${st.limits.max_lots} lots · max ${st.limits.max_open_positions} open positions${st.limits.allowed_symbols.length ? " · symbols " + st.limits.allowed_symbols.map(esc).join(", ") : ""}.</span></div>`}
      <div class="grid cols-2 ticket-grid">
        <section class="card"><div class="card-head"><h3>Order ticket</h3><span class="sub">${esc(a.label)}</span></div><div class="card-body">
          <div class="form">
            <div class="form-row">
              <label>Symbol<input id="t-symbol" list="t-symbols" value="${esc(TF.symbol)}" placeholder="EURUSD" autocomplete="off" spellcheck="false"><datalist id="t-symbols">${info.known_symbols.map(s => `<option value="${esc(s)}">`).join("")}</datalist></label>
              <label>Side<span class="seg" id="t-side"><button data-v="BUY" class="${TF.side === "BUY" ? "active buy" : ""}">Buy</button><button data-v="SELL" class="${TF.side === "SELL" ? "active sell" : ""}">Sell</button></span></label>
              <label>Order<select id="t-kind"><option value="market" ${TF.order_kind === "market" ? "selected" : ""}>Market</option><option value="limit" ${TF.order_kind === "limit" ? "selected" : ""}>Limit</option><option value="stop" ${TF.order_kind === "stop" ? "selected" : ""}>Stop</option></select></label>
              <label class="${TF.order_kind === "market" ? "hidden" : ""}" id="t-price-wrap">Entry price<input id="t-price" type="number" step="any" value="${esc(TF.price)}"></label>
            </div>
            <div class="form-row">
              <label>Sizing<select id="t-sizing"><option value="risk" ${TF.sizing === "risk" ? "selected" : ""}>Risk % of equity</option><option value="lots" ${TF.sizing === "lots" ? "selected" : ""}>Fixed lots</option></select></label>
              <label class="${TF.sizing === "risk" ? "" : "hidden"}" id="t-risk-wrap">Risk %<input id="t-risk" type="number" step="0.05" min="0.05" max="${st.limits.max_risk_percent}" value="${esc(TF.risk_percent)}"></label>
              <label class="${TF.sizing === "lots" ? "" : "hidden"}" id="t-lots-wrap">Lots<input id="t-lots" type="number" step="0.01" min="0.01" max="${st.limits.max_lots}" value="${esc(TF.lots)}"></label>
            </div>
            <div class="form-row">
              <label>Stop loss<select id="t-slmode"><option value="points" ${TF.sl_mode === "points" ? "selected" : ""}>Distance (points)</option><option value="price" ${TF.sl_mode === "price" ? "selected" : ""}>Price</option><option value="none" ${TF.sl_mode === "none" ? "selected" : ""}>None</option></select></label>
              <label class="${TF.sl_mode === "none" ? "hidden" : ""}" id="t-sl-wrap">SL value<input id="t-sl" type="number" step="any" value="${esc(TF.sl)}"></label>
              <label>Take profit<select id="t-tpmode"><option value="rr" ${TF.tp_mode === "rr" ? "selected" : ""}>Reward : risk</option><option value="points" ${TF.tp_mode === "points" ? "selected" : ""}>Distance (points)</option><option value="price" ${TF.tp_mode === "price" ? "selected" : ""}>Price</option><option value="none" ${TF.tp_mode === "none" ? "selected" : ""}>None</option></select></label>
              <label class="${TF.tp_mode === "none" ? "hidden" : ""}" id="t-tp-wrap">TP value<input id="t-tp" type="number" step="any" value="${esc(TF.tp)}"></label>
            </div>
            <div class="form-row"><label class="wide">Comment (optional, max 31 chars)<input id="t-comment" maxlength="31" value="${esc(TF.comment)}"></label></div>
            <div class="form-actions"><button class="btn" id="t-quote">Get quote</button><span class="flex1"></span><button class="btn primary" id="t-preview" ${disabled ? "disabled" : ""}>Preview order</button></div>
            <div id="t-quote-out" class="small dim mt6"></div>
          </div></div></section>
        <section class="card"><div class="card-head"><h3>Preview</h3><span class="sub">nothing is sent until you confirm</span></div><div class="card-body" id="t-preview-out"><div class="empty"><div class="ico">◔</div>Fill in the ticket and press <b>Preview order</b>. The exact volume, stop, target, risk and margin are shown before anything is sent.</div></div></section>
      </div>
      <section class="card"><div class="card-head"><h3>Recent trading actions</h3><span class="sub">audit log · data/trading-audit.jsonl</span></div><div class="table-wrap">${info.audit.length ? `<table class="data compact"><thead><tr><th>Time</th><th>Action</th><th>Stage</th><th>Details</th><th>Result</th></tr></thead><tbody>${info.audit.slice().reverse().map(e => `<tr><td class="dim nowrap">${esc(dtShort(e.ts))}</td><td>${esc(e.action)}</td><td><span class="tag ${e.stage === "result" ? (e.ok ? "ok" : "bad") : e.stage === "rejected" ? "bad" : "neutral"}">${esc(e.stage)}</span></td><td class="muted">${esc(auditDetails(e))}</td><td class="muted">${esc(e.error || (e.result ? `${e.result.comment || ""} ${e.result.price ? "@ " + e.result.price : ""}` : ""))}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No trading actions yet</div>`}</div></section>`;
    content.querySelectorAll("#trade-acct button").forEach(b => b.addEventListener("click", () => { TF.account = b.dataset.id; if (S.scope !== "all") { S.scope = "all"; renderShell(); } renderView(); }));
    const read = () => {
      TF.symbol = $("#t-symbol").value.trim().toUpperCase(); TF.order_kind = $("#t-kind").value; TF.price = $("#t-price").value;
      TF.sizing = $("#t-sizing").value; TF.risk_percent = $("#t-risk").value; TF.lots = $("#t-lots").value;
      TF.sl_mode = $("#t-slmode").value; TF.sl = $("#t-sl").value; TF.tp_mode = $("#t-tpmode").value; TF.tp = $("#t-tp").value; TF.comment = $("#t-comment").value;
      $("#t-price-wrap").classList.toggle("hidden", TF.order_kind === "market");
      $("#t-risk-wrap").classList.toggle("hidden", TF.sizing !== "risk"); $("#t-lots-wrap").classList.toggle("hidden", TF.sizing !== "lots");
      $("#t-sl-wrap").classList.toggle("hidden", TF.sl_mode === "none"); $("#t-tp-wrap").classList.toggle("hidden", TF.tp_mode === "none");
    };
    content.querySelectorAll("#t-symbol,#t-kind,#t-price,#t-sizing,#t-risk,#t-lots,#t-slmode,#t-sl,#t-tpmode,#t-tp,#t-comment").forEach(el => { el.addEventListener("input", read); el.addEventListener("change", read); });
    content.querySelectorAll("#t-side button").forEach(b => b.addEventListener("click", () => { TF.side = b.dataset.v; content.querySelectorAll("#t-side button").forEach(x => x.className = x === b ? "active " + TF.side.toLowerCase() : ""); }));
    $("#t-quote").addEventListener("click", async () => {
      read(); const out = $("#t-quote-out"); out.textContent = "Fetching…";
      try { const q = await post(`/api/accounts/${a.id}/symbol`, { symbol: TF.symbol }); const i = q.info, t = q.tick;
        out.innerHTML = `<b>${esc(i.name)}</b> bid <span class="n">${price(t.bid)}</span> · ask <span class="n">${price(t.ask)}</span> · spread ${i.spread} pts · point ${i.point} · lot ${i.volume_min}–${i.volume_max} step ${i.volume_step} · contract ${i.trade_contract_size} · tick value ${fmt(i.trade_tick_value, 2)} ${esc(cur)} · min stop ${i.trade_stops_level} pts · ${esc(i.description || "")}`;
      } catch (e) { out.innerHTML = `<span class="neg">${esc(e.message)}</span>`; }
    });
    $("#t-preview").addEventListener("click", async () => {
      read(); const out = $("#t-preview-out"); out.innerHTML = `<div class="loading-row"><div class="spinner"></div>Checking with the terminal…</div>`;
      const body = { symbol: TF.symbol, side: TF.side, order_kind: TF.order_kind, price: TF.order_kind === "market" ? undefined : parseFloat(TF.price), sizing: TF.sizing, risk_percent: parseFloat(TF.risk_percent), lots: parseFloat(TF.lots), sl_mode: TF.sl_mode, sl: parseFloat(TF.sl), tp_mode: TF.tp_mode, tp: parseFloat(TF.tp), comment: TF.comment };
      try {
        const pv = await post(`/api/accounts/${a.id}/orders/preview`, body); lastPreview = pv;
        const p = pv.plan, c = pv.check;
        out.innerHTML = `<div class="preview-head"><span class="tag ${p.direction.toLowerCase()}">${p.direction}</span><b class="big">${esc(p.symbol)}</b><span class="big">${fmt(p.volume, 2)} lots</span><span class="dim">${esc(p.order_type_name)} @ ${price(p.entry)}</span></div>
          <div class="tiles mt14">
            <div class="tile"><div class="k">Risk if SL hit</div><div class="v neg">${p.risk_amount === null ? "uncapped" : "−" + fmt(p.risk_amount) + `<span class="cur">${esc(cur)}</span>`}</div><div class="s">${p.risk_percent === null ? "no stop loss" : fmt(p.risk_percent, 2) + "% of equity"}</div></div>
            <div class="tile"><div class="k">Reward at TP</div><div class="v pos">${p.reward_amount === null ? "–" : "+" + fmt(p.reward_amount) + `<span class="cur">${esc(cur)}</span>`}</div><div class="s">${p.rr ? "R:R 1 : " + fmt(p.rr, 2) : "no take profit"}</div></div>
            <div class="tile"><div class="k">Stop loss</div><div class="v">${p.sl === null ? "none" : price(p.sl)}</div><div class="s">${p.sl === null ? "" : Math.round(Math.abs(p.entry - p.sl) / pv.symbol.point) + " points"}</div></div>
            <div class="tile"><div class="k">Take profit</div><div class="v">${p.tp === null ? "none" : price(p.tp)}</div><div class="s">${p.tp === null ? "" : Math.round(Math.abs(p.tp - p.entry) / pv.symbol.point) + " points"}</div></div>
            <div class="tile"><div class="k">Margin (broker check)</div><div class="v">${c.margin !== undefined && c.margin !== null ? money(c.margin, cur) : "–"}</div><div class="s">free margin after: ${c.margin_free !== undefined && c.margin_free !== null ? fmt(c.margin_free) : "–"}</div></div>
            <div class="tile"><div class="k">Broker pre-check</div><div class="v">${pv.check_ok ? '<span class="tag ok">passed</span>' : '<span class="tag bad">failed</span>'}</div><div class="s">${esc(pv.check_text)}${c.comment && c.comment !== pv.check_text ? " · " + esc(c.comment) : ""}</div></div>
          </div>
          ${p.warnings.length ? `<ul class="notes mt14">${p.warnings.map(w => `<li class="warn-text">${esc(w)}</li>`).join("")}</ul>` : ""}
          <div class="small muted mt14">Loss per 1.00 lot at the stop: ${p.loss_per_lot === null ? "–" : fmt(p.loss_per_lot) + " " + esc(cur)} · spread ${pv.symbol.spread} pts · filling ${pv.request.type_filling} · deviation ${pv.request.deviation} pts · magic ${pv.request.magic}</div>
          <div class="form-actions mt14"><span class="xs muted">Preview valid for ${pv.intent.expires_in}s</span><span class="flex1"></span><button class="btn danger" id="t-send" ${pv.check_ok ? "" : "disabled"}>Place order…</button></div>`;
        $("#t-send").addEventListener("click", () => {
          openModal({ title: `Send ${p.direction} ${fmt(p.volume, 2)} ${p.symbol} to ${a.label}?`, danger: true, confirmLabel: "Send order", requireText: p.direction,
            body: `<dl class="kv"><dt>Account</dt><dd>${esc(a.label)}${a.mock ? " (mock)" : ""}</dd><dt>Order</dt><dd>${esc(p.order_type_name)} ${fmt(p.volume, 2)} lots ${esc(p.symbol)} @ ${price(p.entry)}</dd><dt>Stop loss</dt><dd>${p.sl === null ? "none" : price(p.sl)}</dd><dt>Take profit</dt><dd>${p.tp === null ? "none" : price(p.tp)}</dd><dt>Max loss at stop</dt><dd class="neg">${p.risk_amount === null ? "uncapped" : "−" + fmt(p.risk_amount) + " " + esc(cur) + " (" + fmt(p.risk_percent, 2) + "%)"}</dd></dl><p class="small dim">This sends a real order to the broker. Market orders fill immediately at the current price.</p>`,
            onConfirm: async () => {
              const r = await post(`/api/accounts/${a.id}/orders`, { ...pv.request_echo, intent: pv.intent, expected: { symbol: p.symbol, order_type: p.order_type, volume: p.volume } });
              if (!r.ok) throw new Error(`${r.result_text}${r.result?.comment ? " · " + r.result.comment : ""}`);
              toast(`${r.result_text}: ${p.direction} ${fmt(r.result.volume || p.volume, 2)} ${p.symbol} @ ${price(r.result.price || p.entry)} (deal ${r.result.deal || "–"})`);
              lastPreview = null; renderView();
            } });
        });
      } catch (e) { out.innerHTML = `<div class="banner bad"><span>${esc(e.message)}</span></div>`; }
    });
  }
  function auditDetails(e) {
    const r = e.request || {};
    if (e.action === "order") return `${r.side || ""} ${r.symbol || ""} ${r.sizing === "lots" ? r.lots + " lots" : (r.risk_percent || "") + "% risk"} sl:${r.sl_mode || "none"} ${r.sl || ""} tp:${r.tp_mode || "none"} ${r.tp || ""}`.replace(/\s+/g, " ").trim();
    if (e.action === "close") return `#${r.ticket} ${r.volume ? r.volume + " lots" : "full"}`;
    if (e.action === "modify") return `#${r.ticket} sl ${r.sl ?? "-"} tp ${r.tp ?? "-"}`;
    return "";
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
