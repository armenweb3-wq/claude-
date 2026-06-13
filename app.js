/* Renders the dashboard from window.BETTING_DATA. No build step, no framework. */
(function () {
  const D = window.BETTING_DATA;
  const cur = D.currency;
  const fmt = (n) => cur + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => cur + Math.round(n).toLocaleString();
  const $ = (id) => document.getElementById(id);

  const settled = D.bets.filter((b) => b.result === "won" || b.result === "lost");
  const wins = D.bets.filter((b) => b.result === "won");
  const losses = D.bets.filter((b) => b.result === "lost");
  const broken = losses.length > 0;

  // current bankroll = return of last settled bet (or starting bankroll)
  let bankroll = D.startingBankroll;
  if (settled.length) {
    const last = settled[settled.length - 1];
    bankroll = last.result === "won" ? last.returnAmount : 0;
  }

  const legsDone = settled.length;
  const currentLeg = Math.min(legsDone + 1, D.targetLegs);
  const profit = bankroll - D.startingBankroll;
  const hitRate = settled.length ? (wins.length / settled.length) * 100 : 0;
  const targetNow = D.startingBankroll * Math.pow(D.targetMultiplierPerLeg, legsDone);
  const onPace = bankroll >= targetNow;

  // ---- HERO ----
  $("legLabel").textContent = broken ? "Streak broken" : "Leg " + currentLeg + " of " + D.targetLegs;
  const bankEl = $("bankroll");
  bankEl.textContent = fmt(bankroll);
  bankEl.className = "bankroll " + (profit >= 0 ? "green" : "red");
  const profEl = $("profit");
  profEl.textContent = (profit >= 0 ? "▲ +" : "▼ ") + fmt(Math.abs(profit)) + " from " + fmt(D.startingBankroll);
  profEl.className = "profit " + (profit >= 0 ? "green" : "red");
  $("pace").textContent = broken
    ? "Streak ended — review & reset"
    : onPace
    ? "✓ On / ahead of pace (target " + fmt0(targetNow) + ")"
    : "Behind pace (target " + fmt0(targetNow) + ")";

  const pct = Math.min((wins.length / D.targetLegs) * 100, 100);
  $("progressBar").style.width = pct + "%";
  $("progressLabel").textContent = wins.length + " / " + D.targetLegs + " legs won · final target ≈ " + fmt0(D.startingBankroll * Math.pow(D.targetMultiplierPerLeg, D.targetLegs));

  // ---- mini stats ----
  $("mini").innerHTML = `
    <div class="card"><div class="v">${wins.length}W / ${losses.length}L</div><div class="l">Record</div></div>
    <div class="card"><div class="v">${hitRate.toFixed(0)}%</div><div class="l">Hit rate</div></div>`;

  // ---- today's pick ----
  const p = D.todaysPick;
  if (p) {
    $("pick").innerHTML = `
      <span class="tag">Recommended next</span>
      <div class="h">${p.headline}</div>
      <div class="m">${p.market}</div>
      <div class="r">${p.rationale}</div>
      ${p.backups && p.backups.length
        ? `<div class="bu"><div class="lbl">Backups</div><ul>${p.backups.map((b) => `<li>${b}</li>`).join("")}</ul></div>`
        : ""}`;
  } else {
    $("pick").innerHTML = `<div class="r">No pick logged yet.</div>`;
  }

  // ---- streak dots ----
  let dots = "";
  for (let i = 1; i <= D.targetLegs; i++) {
    const bet = D.bets.find((b) => b.leg === i);
    let cls = "dot";
    if (bet) cls += " " + (bet.result === "won" ? "won" : bet.result === "lost" ? "lost" : "pending");
    dots += `<div class="${cls}" title="${bet ? bet.match : "Leg " + i}">${i}</div>`;
  }
  $("streak").innerHTML = dots;

  // ---- results as stacked cards ----
  const cards = D.bets
    .slice()
    .reverse()
    .map((b) => `
      <div class="bet ${b.result}">
        <div class="bet-top">
          <span class="leg">Leg ${b.leg} · ${b.date}</span>
          <span class="pill ${b.result}">${b.result}</span>
        </div>
        <div class="bet-match">${b.match}</div>
        <div class="bet-sel">${(b.selections || []).join(" · ")}</div>
        <div class="bet-fig">
          <span>Odds <b>${b.odds.toFixed(2)}</b></span>
          <span>Stake <b>${fmt(b.stake)}</b></span>
          <span class="ret ${b.result === "won" ? "won" : ""}">${b.result === "pending" ? "in play" : "→ " + fmt(b.returnAmount)}</span>
        </div>
      </div>`)
    .join("");
  $("results").innerHTML = cards || `<div class="card">No bets logged yet.</div>`;

  // ---- bankroll vs target chart ----
  const labels = ["Start"];
  const actual = [D.startingBankroll];
  const target = [D.startingBankroll];
  for (let i = 1; i <= D.targetLegs; i++) {
    labels.push("L" + i);
    target.push(D.startingBankroll * Math.pow(D.targetMultiplierPerLeg, i));
    const bet = D.bets.find((b) => b.leg === i);
    if (bet && (bet.result === "won" || bet.result === "lost")) {
      actual.push(bet.result === "won" ? bet.returnAmount : 0);
    } else {
      actual.push(null);
    }
  }

  new Chart($("bankrollChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Target", data: target, borderColor: "#7a86a8", borderDash: [5, 4], pointRadius: 0, tension: 0.25, borderWidth: 2 },
        { label: "Actual", data: actual, borderColor: "#2ee37a", backgroundColor: "rgba(46,227,122,.12)", fill: true, spanGaps: true, pointRadius: 3, tension: 0.25, borderWidth: 2.5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: "#cdd7f2", boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ": " + (c.parsed.y == null ? "—" : fmt0(c.parsed.y)) } },
      },
      scales: {
        x: { ticks: { color: "#93a0c0", font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 9 }, grid: { display: false } },
        y: { type: "logarithmic", ticks: { color: "#93a0c0", font: { size: 10 }, callback: (v) => cur + (v >= 1000 ? (v / 1000) + "k" : v) }, grid: { color: "#26304f" } },
      },
    },
  });

  // ---- reality check ----
  const remaining = D.targetLegs - wins.length;
  const pLeg = settled.length >= 1 ? Math.min(hitRate / 100, 0.95) : 0.8;
  const pFinish = broken ? 0 : Math.pow(pLeg, Math.max(remaining, 0));
  $("reality").innerHTML = broken
    ? `Streak broke at leg ${losses[0].leg}. Review the log and decide on a fresh, disposable budget before continuing.`
    : `${wins.length} straight wins so far — nice, but the odds don't reset. At your current ${(pLeg * 100).toFixed(0)}% per-leg rate, the rough chance of completing the remaining <b>${remaining}</b> legs is about <b>${(pFinish * 100).toFixed(1)}%</b>. Stay disciplined: only stake money you can fully lose.`;
})();
