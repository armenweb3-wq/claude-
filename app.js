/* Renders the dashboard from window.BETTING_DATA + live.json. No build step. */
(function () {
  const D = window.BETTING_DATA;
  const cur = D.currency;
  const fmt = (n) => cur + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => cur + Math.round(n).toLocaleString();
  // Safe element lookup: if a container is missing (e.g. a stale cached page),
  // return a harmless stub so one missing node can never blank the whole app.
  const STUB = { innerHTML: "", textContent: "", value: "", style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, insertAdjacentHTML() {}, set onclick(f) {}, get onclick() { return null; } };
  const $ = (id) => document.getElementById(id) || STUB;
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  // ---- attempts: committed (shared via data.js) + local (this device only) ----
  const LS_KEY = "wc_local_attempts_v1";
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } };
  const saveLocal = (a) => localStorage.setItem(LS_KEY, JSON.stringify(a));
  function getAttempts() {
    const shared = (D.attempts || []).map((a) => ({ ...a, source: "shared" }));
    const local = loadLocal().map((a) => ({ ...a, source: "local" }));
    let all = shared.concat(local);
    if (!all.length) all = [{ id: 1, label: "Attempt 1", startingBankroll: 340, status: "active", bets: [], source: "local" }];
    return all;
  }
  let viewIdx = null; // which attempt is being viewed; null => latest

  // =====================================================================
  //  AUTO-SETTLEMENT ENGINE
  // =====================================================================
  const MANUAL_TYPES = ["corners", "cards", "shots", "shot_on_target", "player", "other"];
  function matchFor(bet, matches) {
    const parts = norm(bet.match).split(/\s+vs\.?\s+|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    return matches.find((m) => parts.every((p) => norm(m.home).includes(p) || norm(m.away).includes(p) || p.includes(norm(m.home)) || p.includes(norm(m.away))));
  }
  function teamSide(m, team) {
    const t = norm(team); if (!t) return null;
    if (norm(m.home).includes(t) || t.includes(norm(m.home))) return "home";
    if (norm(m.away).includes(t) || t.includes(norm(m.away))) return "away";
    return null;
  }
  function legState(sel, m) {
    if (!sel || typeof sel === "string") return "manual";
    if (sel.manual || MANUAL_TYPES.includes(sel.type)) return "manual";
    if (!m) return "pending";
    const fin = m.status === "FINISHED", hs = m.homeScore, as = m.awayScore;
    if (hs == null || as == null) return "pending";
    const total = hs + as;
    switch (sel.type) {
      case "over_goals": return total > sel.line ? "hit" : fin ? "miss" : "pending";
      case "under_goals": return total > sel.line ? "miss" : fin ? "hit" : "pending";
      case "btts": return hs > 0 && as > 0 ? "hit" : fin ? "miss" : "pending";
      case "team_win": { const s = teamSide(m, sel.team); if (!s) return "manual"; const w = s === "home" ? hs > as : as > hs; return fin ? (w ? "hit" : "miss") : "pending"; }
      case "double_chance": { const s = teamSide(m, sel.team); if (!s) return "manual"; const ok = s === "home" ? hs >= as : as >= hs; return fin ? (ok ? "hit" : "miss") : "pending"; }
      case "draw": return fin ? (hs === as ? "hit" : "miss") : "pending";
      case "no_draw": return fin ? (hs !== as ? "hit" : "miss") : "pending";
      default: return "manual";
    }
  }
  function evaluateBet(bet, matches) {
    const m = matchFor(bet, matches);
    const legs = (bet.selections || []).map((s) => ({ label: typeof s === "string" ? s : s.label, state: legState(s, m) }));
    const hasMiss = legs.some((l) => l.state === "miss");
    const auto = legs.filter((l) => l.state !== "manual");
    const allAutoHit = auto.length > 0 && auto.every((l) => l.state === "hit");
    const hasManual = legs.some((l) => l.state === "manual");
    let verdict = "pending";
    if (hasMiss) verdict = "lost"; else if (allAutoHit && !hasManual) verdict = "won";
    return { match: m, legs, verdict, hasManual, allAutoHit };
  }
  function effectiveResult(bet, matches) {
    if (bet.result === "won" || bet.result === "lost") return { result: bet.result, ret: bet.returnAmount, auto: false };
    const ev = evaluateBet(bet, matches);
    if (ev.verdict === "won") return { result: "won", ret: bet.stake * bet.odds, auto: true, ev };
    if (ev.verdict === "lost") return { result: "lost", ret: 0, auto: true, ev };
    return { result: "pending", ret: 0, auto: false, ev };
  }

  // =====================================================================
  //  RENDER
  // =====================================================================
  let lastMatches = [];
  function render(matches) {
    try { renderInner(matches); } catch (e) { console.error("render error:", e); }
  }
  function renderInner(matches) {
    lastMatches = matches || [];
    const attempts = getAttempts();
    if (viewIdx == null) {
      // default to the latest NON-AI (your) attempt, else the latest overall
      let idx = attempts.length - 1;
      for (let i = attempts.length - 1; i >= 0; i--) { if ((attempts[i].owner || "") !== "AI") { idx = i; break; } }
      viewIdx = idx;
    }
    if (viewIdx >= attempts.length) viewIdx = attempts.length - 1;
    const labels = displayLabels(attempts);
    const A = attempts[viewIdx];
    const Alabel = labels[viewIdx];
    const startBank = A.startingBankroll;

    // delete button: only for phone-local attempts (committed ones are the shared truth)
    const delBtn = $("deleteBtn");
    if (A.source === "local") { delBtn.style.display = ""; delBtn.onclick = () => deleteAttempt(A.id); }
    else delBtn.style.display = "none";

    renderAttemptBar(attempts, labels);

    const eff = (A.bets || []).map((b) => ({ bet: b, ...effectiveResult(b, lastMatches) }));
    const settled = eff.filter((e) => e.result === "won" || e.result === "lost");
    const wins = settled.filter((e) => e.result === "won");
    const losses = settled.filter((e) => e.result === "lost");
    const broken = losses.length > 0;

    let bankroll = startBank;
    if (settled.length) { const last = settled[settled.length - 1]; bankroll = last.result === "won" ? last.ret : 0; }
    const legsDone = settled.length;
    const currentLeg = Math.min(legsDone + 1, D.targetLegs);
    const profit = bankroll - startBank;
    const hitRate = settled.length ? (wins.length / settled.length) * 100 : 0;
    const targetNow = startBank * Math.pow(D.targetMultiplierPerLeg, legsDone);

    const shareTag = A.source === "local" ? " · 📱 on this phone only (tell AI to share)" : "";
    $("legLabel").textContent = (broken ? Alabel + " · streak broken" : Alabel + " · Leg " + currentLeg + " of " + D.targetLegs) + shareTag;
    const bankEl = $("bankroll"); bankEl.textContent = fmt(bankroll); bankEl.className = "bankroll " + (profit >= 0 ? "green" : "red");
    const profEl = $("profit"); profEl.textContent = (profit >= 0 ? "▲ +" : "▼ ") + fmt(Math.abs(profit)) + " from " + fmt(startBank); profEl.className = "profit " + (profit >= 0 ? "green" : "red");
    $("pace").textContent = broken ? "Streak ended — tap Restart to start a new attempt" : bankroll >= targetNow ? "✓ On / ahead of pace (target " + fmt0(targetNow) + ")" : "Behind pace (target " + fmt0(targetNow) + ")";
    $("progressBar").style.width = Math.min((wins.length / D.targetLegs) * 100, 100) + "%";
    $("progressLabel").textContent = wins.length + " / " + D.targetLegs + " legs won · final target ≈ " + fmt0(startBank * Math.pow(D.targetMultiplierPerLeg, D.targetLegs));

    $("mini").innerHTML = `
      <div class="card"><div class="v">${wins.length}W / ${losses.length}L</div><div class="l">Record</div></div>
      <div class="card"><div class="v">${hitRate.toFixed(0)}%</div><div class="l">Hit rate</div></div>`;

    // ACTIVE BET
    const activeEff = eff.find((e) => e.bet.result === "pending");
    if (activeEff) {
      const b = activeEff.bet, ev = activeEff.ev || evaluateBet(b, lastMatches), ret = b.stake * b.odds;
      const badge = { hit: "✅", miss: "❌", pending: "⏳", manual: "📝" };
      const legsHtml = ev.legs.map((l) => `<li>${badge[l.state]} ${l.label}${l.state === "manual" ? ' <span class="sub">(confirm manually)</span>' : ""}</li>`).join("");
      let v = "";
      if (ev.verdict === "won") v = `<div class="verdict won">AUTO-SETTLED: WON → ${fmt(ret)}</div>`;
      else if (ev.verdict === "lost") v = `<div class="verdict lost">AUTO-SETTLED: LOST</div>`;
      else if (ev.match && ev.match.status === "FINISHED" && ev.allAutoHit && ev.hasManual) v = `<div class="verdict wait">Auto legs passed ✓ — confirm corners/cards</div>`;
      $("activeSection").style.display = "";
      $("active").innerHTML = `
        <span class="tag">Placed · ${ev.match && ev.match.status === "FINISHED" ? "full time" : "in play"}</span>
        <div class="h">${b.match}</div>
        <div class="m">Leg ${b.leg} · odds ${b.odds.toFixed(2)} · returns ${fmt(ret)} if it lands</div>
        <ul class="legs">${legsHtml}</ul>${v}<div id="activeLive"></div>`;
    } else { $("activeSection").style.display = "none"; }

    renderPicks();

    // STREAK
    let dots = "";
    for (let i = 1; i <= D.targetLegs; i++) {
      const e = eff.find((x) => x.bet.leg === i);
      let cls = "dot"; if (e) cls += " " + (e.result === "won" ? "won" : e.result === "lost" ? "lost" : "pending");
      dots += `<div class="${cls}" title="${e ? e.bet.match : "Leg " + i}">${i}</div>`;
    }
    $("streak").innerHTML = dots;

    // RESULTS
    $("results").innerHTML = eff.slice().reverse().map((e) => {
      const b = e.bet;
      return `<div class="bet ${e.result}">
        <div class="bet-top"><span class="leg">Leg ${b.leg} · ${b.date}</span><span class="pill ${e.result}">${e.result}${e.auto ? " · auto" : ""}</span></div>
        <div class="bet-match">${b.match}</div>
        <div class="bet-sel">${(b.selections || []).map((s) => (typeof s === "string" ? s : s.label)).join(" · ")}</div>
        <div class="bet-fig"><span>Odds <b>${b.odds.toFixed(2)}</b></span><span>Stake <b>${fmt(b.stake)}</b></span><span class="ret ${e.result === "won" ? "won" : ""}">${e.result === "pending" ? "in play" : "→ " + fmt(e.ret)}</span></div>
      </div>`;
    }).join("") || `<div class="card">No bets yet in this attempt.</div>`;

    drawChart(eff, startBank);

    const remaining = D.targetLegs - wins.length;
    const pLeg = settled.length >= 1 ? Math.min(hitRate / 100, 0.95) : 0.8;
    const pFinish = broken ? 0 : Math.pow(pLeg, Math.max(remaining, 0));
    $("reality").innerHTML = broken
      ? `This attempt broke at leg ${losses[0].bet.leg}. That's the math of a long chain — one swing ends it. Restart only with money you can fully lose.`
      : `${wins.length} win(s) so far. The odds don't reset each leg — at a ${(pLeg * 100).toFixed(0)}% per-leg rate, completing the remaining <b>${remaining}</b> legs is ~<b>${(pFinish * 100).toFixed(1)}%</b>. Stake only what you can lose.`;

    if (lastMatches.length) renderLiveList(lastMatches, activeEff ? activeEff.bet : firstCandidate());
    renderBuilder(lastMatches);
    updateCountdowns();
  }

  // Display labels renumber automatically: non-AI attempts become Attempt 1..N
  // by position, so deleting one re-sequences the rest. AI keeps its own name.
  function displayLabels(attempts) {
    let n = 0;
    return attempts.map((a) => ((a.owner || "") === "AI" ? (a.label || "🤖 AI") : "Attempt " + (++n)));
  }
  function deleteAttempt(id) {
    if (typeof confirm === "function" && !confirm("Delete this attempt? This removes it from this phone and renumbers the rest.")) return;
    saveLocal(loadLocal().filter((a) => a.id !== id));
    viewIdx = null;
    render(lastMatches);
  }
  function renderAttemptBar(attempts, labels) {
    if (attempts.length <= 1) { $("attemptSwitch").innerHTML = ""; return; }
    $("attemptSwitch").innerHTML = attempts.map((a, i) => {
      const tag = a.status === "busted" ? "✗" : a.status === "won" ? "✓" : "•";
      const local = a.source === "local" ? " 📱" : "";
      return `<button class="attbtn ${i === viewIdx ? "active" : ""}" data-i="${i}">${labels[i]} ${tag}${local}</button>`;
    }).join("");
    $("attemptSwitch").querySelectorAll(".attbtn").forEach((b) => { b.onclick = () => { viewIdx = +b.dataset.i; render(lastMatches); }; });
  }

  let pickView = "today";
  function renderPicks() {
    const P = D.picks; if (!P) { $("pick").innerHTML = `<div class="r">No picks logged.</div>`; return; }
    if (!P[pickView]) pickView = P.today ? "today" : "tomorrow";
    const set = P[pickView];
    const dayBtn = (k, label) => P[k] ? `<button class="daybtn ${pickView === k ? "active" : ""}" data-day="${k}">${label}${P[k].date ? " · " + P[k].date : ""}</button>` : "";
    const toggle = `<div class="daytoggle">${dayBtn("today", "Today")}${dayBtn("tomorrow", "Tomorrow")}</div>`;
    const cands = (set.candidates || []).map((c, i) => {
      const risk = (c.risk || "medium").toLowerCase();
      return `<details class="cand" ${i === 0 ? "open" : ""}>
        <summary><span class="cand-title">${i === 0 ? "⭐ " : ""}${c.match}</span><span class="risk ${risk}">${risk} risk</span></summary>
        <div class="cand-body">
          <div class="m">${c.market}</div>
          ${c.summary ? `<div class="r">${c.summary}</div>` : ""}
          ${c.why ? `<div class="why"><b>Why this bet:</b> ${c.why}</div>` : ""}
          ${c.whyRisk ? `<div class="whyrisk"><b>Risk — ${risk}:</b> ${c.whyRisk}</div>` : ""}
        </div></details>`;
    }).join("");
    $("pick").innerHTML = toggle + cands;
    $("pick").querySelectorAll(".daybtn").forEach((b) => { b.onclick = () => { pickView = b.dataset.day; renderPicks(); }; });
  }
  function firstCandidate() {
    const P = D.picks, set = P && (P.today || P.tomorrow);
    return set && set.candidates && set.candidates[0] ? { match: set.candidates[0].match } : null;
  }

  let chart;
  function drawChart(eff, startBank) {
    const labels = ["Start"], actual = [startBank], target = [startBank];
    for (let i = 1; i <= D.targetLegs; i++) {
      labels.push("L" + i);
      target.push(startBank * Math.pow(D.targetMultiplierPerLeg, i));
      const e = eff.find((x) => x.bet.leg === i);
      actual.push(e && (e.result === "won" || e.result === "lost") ? e.ret : null);
    }
    if (chart) { chart.data.labels = labels; chart.data.datasets[0].data = target; chart.data.datasets[1].data = actual; chart.update(); return; }
    chart = new Chart($("bankrollChart"), {
      type: "line",
      data: { labels, datasets: [
        { label: "Target", data: target, borderColor: "#7a86a8", borderDash: [5, 4], pointRadius: 0, tension: 0.25, borderWidth: 2 },
        { label: "Actual", data: actual, borderColor: "#2ee37a", backgroundColor: "rgba(46,227,122,.12)", fill: true, spanGaps: true, pointRadius: 3, tension: 0.25, borderWidth: 2.5 },
      ]},
      options: { responsive: true, maintainAspectRatio: true,
        plugins: { legend: { labels: { color: "#cdd7f2", boxWidth: 12, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => c.dataset.label + ": " + (c.parsed.y == null ? "—" : fmt0(c.parsed.y)) } } },
        scales: { x: { ticks: { color: "#93a0c0", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 9 }, grid: { display: false } },
          y: { type: "logarithmic", ticks: { color: "#93a0c0", font: { size: 10 }, callback: (v) => cur + (v >= 1000 ? v / 1000 + "k" : v) }, grid: { color: "#26304f" } } } },
    });
  }

  function renderLiveList(matches, watch) {
    const watchTeams = watch ? norm(watch.match).split(/\s+vs\.?\s+|\s+-\s+/).map((s) => s.trim()).filter(Boolean) : [];
    const isMine = (m) => watchTeams.length >= 2 && watchTeams.every((t) => norm(m.home).includes(t) || norm(m.away).includes(t) || t.includes(norm(m.home)) || t.includes(norm(m.away)));
    const meta = (s) => s === "IN_PLAY" || s === "PAUSED" ? { c: "live", l: "Live" } : s === "FINISHED" ? { c: "ft", l: "FT" } : { c: "soon", l: "Soon" };
    $("liveSection").style.display = "";
    const order = { IN_PLAY: 0, PAUSED: 0, TIMED: 1, SCHEDULED: 1, FINISHED: 2 };
    matches = matches.slice().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    $("live").innerHTML = matches.map((m) => {
      const t = meta(m.status), mine = isMine(m);
      const score = m.homeScore == null ? "–" : `${m.homeScore} – ${m.awayScore}`;
      const upcoming = (m.status === "TIMED" || m.status === "SCHEDULED") && m.utcDate;
      const right = upcoming
        ? `<div class="cd" data-kick="${m.utcDate}">…</div><span class="badge soon">Soon</span>`
        : `<div class="score">${score}</div><span class="badge ${t.c}">${t.l}</span>`;
      return `<div class="match ${mine ? "mine" : ""}"><div class="teams">${m.home} <span class="sub">vs</span> ${m.away}${mine ? ' <span class="sub">· your bet</span>' : ""}</div><div style="text-align:right">${right}</div></div>`;
    }).join("");
    const mineMatch = matches.find(isMine), host = $("activeLive");
    if (mineMatch && host && mineMatch.homeScore != null) {
      const t = meta(mineMatch.status);
      host.innerHTML = `<div class="live-score-pill">${t.l}: ${mineMatch.home} ${mineMatch.homeScore} – ${mineMatch.awayScore} ${mineMatch.away}</div>`;
    }
  }

  function updateCountdowns() {
    const now = Date.now();
    document.querySelectorAll(".cd").forEach((el) => {
      const t = new Date(el.dataset.kick).getTime();
      let s = Math.floor((t - now) / 1000);
      if (s <= 0) { el.textContent = "kicking off"; return; }
      const d = Math.floor(s / 86400); s -= d * 86400;
      const h = Math.floor(s / 3600); s -= h * 3600;
      const m = Math.floor(s / 60); s -= m * 60;
      el.textContent = (d ? d + "d " : "") + (h || d ? h + "h " : "") + m + "m " + String(s).padStart(2, "0") + "s";
    });
  }

  // =====================================================================
  //  BET BUILDER (tap a game -> pick markets -> place into your attempt)
  // =====================================================================
  function activeLocalAttempt() {
    const locals = loadLocal();
    for (let i = locals.length - 1; i >= 0; i--) if ((locals[i].status || "active") === "active") return { att: locals[i], all: locals, idx: i };
    return null;
  }
  function attemptBankroll(att) {
    let bank = att.startingBankroll;
    for (const b of att.bets || []) {
      if (b.result === "won") bank = b.returnAmount;
      else if (b.result === "lost") { bank = 0; break; }
    }
    return bank;
  }

  function renderBuilder(matches) {
    const upcoming = matches.filter((m) => m.status === "TIMED" || m.status === "SCHEDULED");
    if (!upcoming.length) { $("builder").innerHTML = `<div class="card" style="font-size:.85rem;color:var(--muted)">No upcoming games in the feed right now.</div>`; return; }
    $("builder").innerHTML = upcoming.map((m, i) =>
      `<button class="gamebtn" data-i="${i}">${m.home} vs ${m.away} <span class="go">＋ build bet</span></button>`).join("");
    $("builder").querySelectorAll(".gamebtn").forEach((b) => { b.onclick = () => openBuilder(upcoming[+b.dataset.i]); });
  }

  let draftLegs = [];
  function openBuilder(m) {
    draftLegs = [];
    const chip = (label, attrs) => `<button class="mchip" ${attrs}>${label}</button>`;
    const html = `
      <div class="modal-head">
        <div class="modal-title">${m.home} vs ${m.away}</div>
        <button class="modal-x" id="mClose">✕</button>
      </div>
      <div class="modal-scroll">
        <div class="mkt"><div class="mkt-l">Result (1 X 2)</div>
          ${chip("1 · " + m.home, `data-t="team_win" data-team="${m.home}" data-lab="${m.home} to win"`)}
          ${chip("X · Draw", `data-t="draw" data-lab="Draw"`)}
          ${chip("2 · " + m.away, `data-t="team_win" data-team="${m.away}" data-lab="${m.away} to win"`)}
        </div>
        <div class="mkt"><div class="mkt-l">Double chance</div>
          ${chip("1X", `data-t="double_chance" data-team="${m.home}" data-lab="${m.home} or draw (1X)"`)}
          ${chip("12", `data-t="no_draw" data-lab="No draw (12)"`)}
          ${chip("X2", `data-t="double_chance" data-team="${m.away}" data-lab="${m.away} or draw (X2)"`)}
        </div>
        <div class="mkt"><div class="mkt-l">Goals</div>
          ${[0.5, 1.5, 2.5, 3.5].map((l) => chip("Over " + l, `data-t="over_goals" data-line="${l}" data-lab="Over ${l} goals"`)).join("")}
          ${[2.5, 3.5].map((l) => chip("Under " + l, `data-t="under_goals" data-line="${l}" data-lab="Under ${l} goals"`)).join("")}
          ${chip("BTTS", `data-t="btts" data-lab="Both teams to score"`)}
        </div>
        <div class="mkt"><div class="mkt-l">Cards (manual)</div>
          ${[2.5, 3.5, 4.5].map((l) => chip("Over " + l, `data-t="cards" data-manual="1" data-lab="Over ${l} cards"`)).join("")}
        </div>
        <div class="mkt"><div class="mkt-l">Corners (manual)</div>
          ${[7.5, 8.5, 9.5, 10.5].map((l) => chip("Over " + l, `data-t="corners" data-manual="1" data-lab="Over ${l} corners"`)).join("")}
        </div>
        <div class="mkt"><div class="mkt-l">Custom</div>
          <div class="custom-row"><input id="customIn" class="inp" placeholder="e.g. Mbappé to score" /><button id="customAdd" class="addbtn">Add</button></div>
        </div>
        <div class="draft"><div class="mkt-l">Your legs</div><div id="draftList" class="draft-list"></div></div>
        <div class="place-row">
          <label>Odds<input id="oddsIn" class="inp" inputmode="decimal" placeholder="1.40" /></label>
          <label>Stake (${cur})<input id="stakeIn" class="inp" inputmode="decimal" /></label>
        </div>
        <button id="placeBtn" class="place-btn">Place bet</button>
        <div class="place-note" id="placeNote"></div>
      </div>`;
    $("modalCard").innerHTML = html;
    $("modal").style.display = "flex";

    const act = activeLocalAttempt();
    $("stakeIn").value = act ? attemptBankroll(act.att).toFixed(2) : "";
    $("placeNote").textContent = act ? `Placing into ${act.att.label} (bankroll ${fmt(attemptBankroll(act.att))}).` : "Tip: tap ↻ Restart first to start your attempt, then place bets.";

    $("modalCard").querySelectorAll(".mchip").forEach((b) => {
      b.onclick = () => {
        const d = b.dataset;
        const sel = { label: d.lab, type: d.t };
        if (d.team) sel.team = d.team;
        if (d.line) sel.line = parseFloat(d.line);
        if (d.manual) sel.manual = true;
        draftLegs.push(sel); renderDraft();
      };
    });
    $("customAdd").onclick = () => { const v = $("customIn").value.trim(); if (v) { draftLegs.push({ label: v, type: "other", manual: true }); $("customIn").value = ""; renderDraft(); } };
    $("mClose").onclick = closeModal;
    $("modal").onclick = (e) => { if (e.target === $("modal")) closeModal(); };
    $("placeBtn").onclick = () => placeBet(m);
    renderDraft();
  }
  function renderDraft() {
    const el = $("draftList"); if (!el) return;
    el.innerHTML = draftLegs.length
      ? draftLegs.map((l, i) => `<span class="dchip">${l.label}<b data-i="${i}">✕</b></span>`).join("")
      : `<span class="sub">No legs yet — tap markets above.</span>`;
    el.querySelectorAll("b[data-i]").forEach((x) => { x.onclick = () => { draftLegs.splice(+x.dataset.i, 1); renderDraft(); }; });
  }
  function closeModal() { $("modal").style.display = "none"; draftLegs = []; }
  function placeBet(m) {
    if (!draftLegs.length) { alert("Add at least one leg."); return; }
    const odds = parseFloat(($("oddsIn").value || "").replace(",", "."));
    const stake = parseFloat(($("stakeIn").value || "").replace(",", "."));
    if (!(odds > 1)) { alert("Enter the odds, e.g. 1.40"); return; }
    if (!(stake > 0)) { alert("Enter a stake."); return; }
    const act = activeLocalAttempt();
    if (!act) { alert("Tap ↻ Restart (top-left) to start your attempt first, then place the bet."); return; }
    const bets = act.att.bets || (act.att.bets = []);
    bets.push({
      leg: bets.length + 1,
      date: new Date().toISOString().slice(0, 10),
      match: m.home + " vs " + m.away,
      selections: draftLegs.slice(),
      stake: stake, odds: odds, result: "pending", returnAmount: 0,
    });
    saveLocal(act.all);
    closeModal();
    viewIdx = null; // jump back to your active attempt
    render(lastMatches);
    alert("Bet placed into " + act.att.label + " ✅\nIt'll auto-track from the live score.");
  }

  // ---- Restart button ----
  function doRestart() {
    const raw = prompt("New attempt — starting bankroll (" + cur + ")?", "340");
    if (raw == null) return;
    const amt = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
    if (!(amt > 0)) { alert("Please enter a number, e.g. 340"); return; }
    const all = getAttempts();
    const nextId = Math.max(0, ...all.map((a) => a.id || 0)) + 1;
    const local = loadLocal();
    local.push({ id: nextId, label: "Attempt " + nextId, startingBankroll: amt, status: "active", bets: [], created: new Date().toISOString() });
    saveLocal(local);
    viewIdx = null;
    render(lastMatches);
    alert("Started Attempt " + nextId + " with " + fmt(amt) + ".\n(Saved on this device. Tell me the amount and I'll add it to the shared site for your friends.)");
  }
  $("restartBtn").onclick = doRestart;

  // ---- boot + poll ----
  async function loadLive() {
    try {
      const r = await fetch("./live.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      if (j.updatedAt) { const t = new Date(j.updatedAt); $("liveUpdated").textContent = "· updated " + t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
      return j.matches || [];
    } catch { return null; }
  }
  render([]);
  loadLive().then((m) => render(m || [])).catch(() => {});
  setInterval(() => loadLive().then((m) => render(m || [])).catch(() => {}), 60000);
  setInterval(updateCountdowns, 1000); // smooth kickoff countdowns
})();
