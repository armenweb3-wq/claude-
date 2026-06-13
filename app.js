/* Renders the dashboard from window.BETTING_DATA. No build step, no framework. */
(function () {
  const D = window.BETTING_DATA;
  const cur = D.currency;
  const fmt = (n) => cur + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const $ = (id) => document.getElementById(id);

  const settled = D.bets.filter((b) => b.result === "won" || b.result === "lost");
  const wins = D.bets.filter((b) => b.result === "won");
  const losses = D.bets.filter((b) => b.result === "lost");
  const lastWin = wins.length ? wins[wins.length - 1] : null;

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

  // ---- top summary cards ----
  $("summary").innerHTML = `
    <div class="card">
      <div class="label">Bankroll</div>
      <div class="value ${profit >= 0 ? "green" : "red"}">${fmt(bankroll)}</div>
      <div class="sub">started ${fmt(D.startingBankroll)}</div>
    </div>
    <div class="card">
      <div class="label">Profit</div>
      <div class="value ${profit >= 0 ? "green" : "red"}">${profit >= 0 ? "+" : ""}${fmt(profit)}</div>
      <div class="sub">${(bankroll / D.startingBankroll).toFixed(2)}× of stake</div>
    </div>
    <div class="card">
      <div class="label">Progress</div>
      <div class="value">${losses.length ? "Streak broken" : "Leg " + currentLeg}</div>
      <div class="sub">${wins.length} of ${D.targetLegs} legs won</div>
    </div>
    <div class="card">
      <div class="label">Hit rate</div>
      <div class="value">${hitRate.toFixed(0)}%</div>
      <div class="sub">${wins.length}W / ${losses.length}L</div>
    </div>`;

  // ---- streak dots ----
  let dots = "";
  for (let i = 1; i <= D.targetLegs; i++) {
    const bet = D.bets.find((b) => b.leg === i);
    let cls = "dot";
    if (bet) cls += " " + (bet.result === "won" ? "won" : bet.result === "lost" ? "lost" : "pending");
    dots += `<div class="${cls}" title="${bet ? bet.match : "Leg " + i}">${i}</div>`;
  }
  $("streak").innerHTML = dots;

  // ---- today's pick ----
  const p = D.todaysPick;
  if (p) {
    $("pick").innerHTML = `
      <div class="h">${p.headline}</div>
      <div class="m">${p.match} — ${p.market}</div>
      <div class="r">${p.rationale}</div>
      ${p.backups && p.backups.length ? "<ul>" + p.backups.map((b) => `<li>${b}</li>`).join("") + "</ul>" : ""}`;
  }

  // ---- results table ----
  const rows = D.bets
    .slice()
    .reverse()
    .map((b) => `
      <tr>
        <td>${b.leg}</td>
        <td>${b.date}</td>
        <td>${b.match}<div class="sel">${(b.selections || []).join(" · ")}</div></td>
        <td class="num">${b.odds.toFixed(2)}</td>
        <td class="num">${fmt(b.stake)}</td>
        <td><span class="pill ${b.result}">${b.result}</span></td>
        <td class="num">${b.result === "pending" ? "—" : fmt(b.returnAmount)}</td>
      </tr>`)
    .join("");
  $("results").innerHTML = rows || `<tr><td colspan="7">No bets logged yet.</td></tr>`;

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
        {
          label: "Target (1.4× / leg)",
          data: target,
          borderColor: "#7a86a8",
          borderDash: [6, 5],
          pointRadius: 0,
          tension: 0.25,
          borderWidth: 2,
        },
        {
          label: "Actual bankroll",
          data: actual,
          borderColor: "#2ecc71",
          backgroundColor: "rgba(46,204,113,.12)",
          fill: true,
          spanGaps: true,
          pointRadius: 3,
          tension: 0.25,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#cdd7f2" } },
        tooltip: { callbacks: { label: (c) => c.dataset.label + ": " + (c.parsed.y == null ? "—" : fmt(c.parsed.y)) } },
      },
      scales: {
        x: { ticks: { color: "#93a0c0" }, grid: { color: "#26304f" } },
        y: { ticks: { color: "#93a0c0", callback: (v) => cur + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v) }, grid: { color: "#26304f" }, type: "logarithmic" },
      },
    },
  });

  // ---- reality-check probability ----
  // P(completing remaining legs) at the group's realized hit-rate, capped sensibly.
  const remaining = D.targetLegs - wins.length;
  const pLeg = settled.length >= 1 ? Math.min(hitRate / 100, 0.95) : 0.8;
  const pFinish = losses.length ? 0 : Math.pow(pLeg, Math.max(remaining, 0));
  $("reality").innerHTML = losses.length
    ? `Streak broken at leg ${losses[0].leg}. Reset, review the log, and decide on a fresh disposable budget before continuing.`
    : `At your current ${(pLeg * 100).toFixed(0)}% per-leg hit rate, the rough chance of completing all ${remaining} remaining legs is <b>${(pFinish * 100).toFixed(1)}%</b>. ` +
      `Keep this in view: even a strong streak is fragile — only stake money you can fully lose.`;
})();
