/* Renders the dashboard from window.BETTING_DATA + live.json. No build step. */
(function () {
  const D = window.BETTING_DATA;
  const cur = D.currency;
  const fmt = (n) => cur + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => cur + Math.round(n).toLocaleString();
  const $ = (id) => document.getElementById(id);
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  // =====================================================================
  //  AUTO-SETTLEMENT ENGINE
  //  Grades each selection from a finished/live score. Markets the free
  //  feed can't see (corners, cards, shots, player props) are "manual".
  // =====================================================================
  const MANUAL_TYPES = ["corners", "cards", "shots", "shot_on_target", "player", "other"];

  function matchFor(bet, matches) {
    const parts = norm(bet.match).split(/\s+vs\.?\s+|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    return matches.find((m) =>
      parts.every((p) => norm(m.home).includes(p) || norm(m.away).includes(p) || p.includes(norm(m.home)) || p.includes(norm(m.away)))
    );
  }
  function teamSide(m, team) {
    const t = norm(team);
    if (!t) return null;
    if (norm(m.home).includes(t) || t.includes(norm(m.home))) return "home";
    if (norm(m.away).includes(t) || t.includes(norm(m.away))) return "away";
    return null;
  }
  // 'hit' | 'miss' | 'pending' | 'manual'
  function legState(sel, m) {
    if (!sel || typeof sel === "string") return "manual";
    if (sel.manual || MANUAL_TYPES.includes(sel.type)) return "manual";
    if (!m) return "pending";
    const fin = m.status === "FINISHED";
    const hs = m.homeScore, as = m.awayScore;
    if (hs == null || as == null) return "pending";
    const total = hs + as;
    switch (sel.type) {
      case "over_goals": return total > sel.line ? "hit" : fin ? "miss" : "pending";
      case "under_goals": return total > sel.line ? "miss" : fin ? "hit" : "pending";
      case "btts": return hs > 0 && as > 0 ? "hit" : fin ? "miss" : "pending";
      case "team_win": {
        const s = teamSide(m, sel.team); if (!s) return "manual";
        const win = s === "home" ? hs > as : as > hs;
        return fin ? (win ? "hit" : "miss") : "pending";
      }
      case "double_chance": {
        const s = teamSide(m, sel.team); if (!s) return "manual";
        const ok = s === "home" ? hs >= as : as >= hs;
        return fin ? (ok ? "hit" : "miss") : "pending";
      }
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
    if (hasMiss) verdict = "lost";
    else if (allAutoHit && !hasManual) verdict = "won";
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
  function render(matches) {
    const eff = D.bets.map((b) => ({ bet: b, ...effectiveResult(b, matches) }));
    const settled = eff.filter((e) => e.result === "won" || e.result === "lost");
    const wins = settled.filter((e) => e.result === "won");
    const losses = settled.filter((e) => e.result === "lost");
    const broken = losses.length > 0;

    let bankroll = D.startingBankroll;
    if (settled.length) { const last = settled[settled.length - 1]; bankroll = last.result === "won" ? last.ret : 0; }
    const legsDone = settled.length;
    const currentLeg = Math.min(legsDone + 1, D.targetLegs);
    const profit = bankroll - D.startingBankroll;
    const hitRate = settled.length ? (wins.length / settled.length) * 100 : 0;
    const targetNow = D.startingBankroll * Math.pow(D.targetMultiplierPerLeg, legsDone);

    // HERO
    $("legLabel").textContent = broken ? "Streak broken" : "Leg " + currentLeg + " of " + D.targetLegs;
    const bankEl = $("bankroll"); bankEl.textContent = fmt(bankroll); bankEl.className = "bankroll " + (profit >= 0 ? "green" : "red");
    const profEl = $("profit"); profEl.textContent = (profit >= 0 ? "▲ +" : "▼ ") + fmt(Math.abs(profit)) + " from " + fmt(D.startingBankroll); profEl.className = "profit " + (profit >= 0 ? "green" : "red");
    $("pace").textContent = broken ? "Streak ended — review & reset" : bankroll >= targetNow ? "✓ On / ahead of pace (target " + fmt0(targetNow) + ")" : "Behind pace (target " + fmt0(targetNow) + ")";
    $("progressBar").style.width = Math.min((wins.length / D.targetLegs) * 100, 100) + "%";
    $("progressLabel").textContent = wins.length + " / " + D.targetLegs + " legs won · final target ≈ " + fmt0(D.startingBankroll * Math.pow(D.targetMultiplierPerLeg, D.targetLegs));

    // MINI
    $("mini").innerHTML = `
      <div class="card"><div class="v">${wins.length}W / ${losses.length}L</div><div class="l">Record</div></div>
      <div class="card"><div class="v">${hitRate.toFixed(0)}%</div><div class="l">Hit rate</div></div>`;

    // ACTIVE BET
    const activeEff = eff.find((e) => e.bet.result === "pending");
    if (activeEff) {
      const b = activeEff.bet, ev = activeEff.ev || evaluateBet(b, matches), ret = b.stake * b.odds;
      const badge = { hit: "✅", miss: "❌", pending: "⏳", manual: "📝" };
      const legsHtml = ev.legs.map((l) => `<li>${badge[l.state]} ${l.label}${l.state === "manual" ? ' <span class="sub">(confirm manually)</span>' : ""}</li>`).join("");
      let verdictHtml = "";
      if (ev.verdict === "won") verdictHtml = `<div class="verdict won">AUTO-SETTLED: WON → ${fmt(ret)}</div>`;
      else if (ev.verdict === "lost") verdictHtml = `<div class="verdict lost">AUTO-SETTLED: LOST</div>`;
      else if (ev.match && ev.match.status === "FINISHED" && ev.allAutoHit && ev.hasManual) verdictHtml = `<div class="verdict wait">Auto legs passed ✓ — awaiting manual check on corners/cards</div>`;
      $("activeSection").style.display = "";
      $("active").innerHTML = `
        <span class="tag">Placed · ${ev.match && ev.match.status === "FINISHED" ? "full time" : "in play"}</span>
        <div class="h">${b.match}</div>
        <div class="m">Leg ${b.leg} · odds ${b.odds.toFixed(2)} · returns ${fmt(ret)} if it lands</div>
        <ul class="legs">${legsHtml}</ul>${verdictHtml}<div id="activeLive"></div>`;
    } else { $("activeSection").style.display = "none"; }

    // DAILY PICKS (risk-rated, expandable)
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
    }).join("") || `<div class="card">No bets logged yet.</div>`;

    drawChart(eff);

    // REALITY CHECK
    const remaining = D.targetLegs - wins.length;
    const pLeg = settled.length >= 1 ? Math.min(hitRate / 100, 0.95) : 0.8;
    const pFinish = broken ? 0 : Math.pow(pLeg, Math.max(remaining, 0));
    $("reality").innerHTML = broken
      ? `Streak broke at leg ${losses[0].bet.leg}. Review the log and decide on a fresh, disposable budget before continuing.`
      : `${wins.length} straight wins so far — nice, but the odds don't reset. At your current ${(pLeg * 100).toFixed(0)}% per-leg rate, the rough chance of completing the remaining <b>${remaining}</b> legs is about <b>${(pFinish * 100).toFixed(1)}%</b>. Stay disciplined: only stake money you can fully lose.`;

    if (matches.length) renderLiveList(matches, activeEff ? activeEff.bet : firstCandidate());
  }

  let pickView = "today";
  function renderPicks() {
    // support both the new picks{today,tomorrow} shape and a legacy single set
    const P = D.picks || (D.todaysPick ? { today: D.todaysPick } : null);
    if (!P) { $("pick").innerHTML = `<div class="r">No picks logged yet.</div>`; return; }
    if (!P[pickView]) pickView = P.today ? "today" : "tomorrow";
    const set = P[pickView];

    const dayBtn = (k, label) => P[k]
      ? `<button class="daybtn ${pickView === k ? "active" : ""}" data-day="${k}">${label}${P[k].date ? " · " + P[k].date : ""}</button>`
      : "";
    const toggle = `<div class="daytoggle">${dayBtn("today", "Today")}${dayBtn("tomorrow", "Tomorrow")}</div>`;

    const cands = (set.candidates || []).map((c, i) => {
      const risk = (c.risk || "medium").toLowerCase();
      return `<details class="cand" ${i === 0 ? "open" : ""}>
        <summary>
          <span class="cand-title">${i === 0 ? "⭐ " : ""}${c.match}</span>
          <span class="risk ${risk}">${risk} risk</span>
        </summary>
        <div class="cand-body">
          <div class="m">${c.market}</div>
          ${c.summary ? `<div class="r">${c.summary}</div>` : ""}
          ${c.why ? `<div class="why"><b>Why this bet:</b> ${c.why}</div>` : ""}
          ${c.whyRisk ? `<div class="whyrisk"><b>Risk — ${risk}:</b> ${c.whyRisk}</div>` : ""}
        </div>
      </details>`;
    }).join("");

    $("pick").innerHTML = toggle + cands;
    $("pick").querySelectorAll(".daybtn").forEach((b) => { b.onclick = () => { pickView = b.dataset.day; renderPicks(); }; });
  }
  function firstCandidate() {
    const P = D.picks || (D.todaysPick ? { today: D.todaysPick } : null);
    const set = P && (P.today || P.tomorrow);
    return set && set.candidates && set.candidates[0] ? { match: set.candidates[0].match } : null;
  }

  let chart;
  function drawChart(eff) {
    const labels = ["Start"], actual = [D.startingBankroll], target = [D.startingBankroll];
    for (let i = 1; i <= D.targetLegs; i++) {
      labels.push("L" + i);
      target.push(D.startingBankroll * Math.pow(D.targetMultiplierPerLeg, i));
      const e = eff.find((x) => x.bet.leg === i);
      actual.push(e && (e.result === "won" || e.result === "lost") ? e.ret : null);
    }
    if (chart) { chart.data.datasets[1].data = actual; chart.update(); return; }
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
      return `<div class="match ${mine ? "mine" : ""}"><div class="teams">${m.home} <span class="sub">vs</span> ${m.away}${mine ? ' <span class="sub">· your bet</span>' : ""}</div><div style="text-align:right"><div class="score">${score}</div><span class="badge ${t.c}">${t.l}</span></div></div>`;
    }).join("");
    const mineMatch = matches.find(isMine), host = $("activeLive");
    if (mineMatch && host && mineMatch.homeScore != null) {
      const t = meta(mineMatch.status);
      host.innerHTML = `<div class="live-score-pill">${t.l}: ${mineMatch.home} ${mineMatch.homeScore} – ${mineMatch.awayScore} ${mineMatch.away}</div>`;
    }
  }

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
})();
