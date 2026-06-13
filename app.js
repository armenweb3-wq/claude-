/* Renders the dashboard from window.BETTING_DATA + live.json. No build step. */
(function () {
  const D = window.BETTING_DATA;
  const cur = D.currency;
  const fmt = (n) => cur + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => cur + Math.round(n).toLocaleString();
  const $ = (id) => document.getElementById(id);
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
    lastMatches = matches || [];
    const attempts = getAttempts();
    if (viewIdx == null) {
      // default to the latest NON-AI (your) attempt, else the latest overall
      let idx = attempts.length - 1;
      for (let i = attempts.length - 1; i >= 0; i--) { if ((attempts[i].owner || "") !== "AI") { idx = i; break; } }
      viewIdx = idx;
    }
    if (viewIdx >= attempts.length) viewIdx = attempts.length - 1;
    const A = attempts[viewIdx];
    const startBank = A.startingBankroll;

    renderAttemptBar(attempts);

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

    $("legLabel").textContent = broken ? A.label + " · streak broken" : A.label + " · Leg " + currentLeg + " of " + D.targetLegs;
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
    updateCountdowns();
  }

  function renderAttemptBar(attempts) {
    if (attempts.length <= 1) { $("attemptSwitch").innerHTML = ""; return; }
    $("attemptSwitch").innerHTML = attempts.map((a, i) => {
      const tag = a.status === "busted" ? "✗" : a.status === "won" ? "✓" : "•";
      return `<button class="attbtn ${i === viewIdx ? "active" : ""}" data-i="${i}">${a.label} ${tag}</button>`;
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
  loadLive().then((m) => render(m || []));
  setInterval(() => loadLive().then((m) => render(m || [])), 60000);
  setInterval(updateCountdowns, 1000); // smooth kickoff countdowns
})();
