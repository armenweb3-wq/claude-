/* Minimal, dependency-free SVG charts (line/area + bars) with hover tooltips.
   No external libraries are loaded - everything renders from same-origin code. */
(function (global) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) return [0];
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const rough = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const start = Math.ceil(min / step) * step;
    const out = [];
    for (let v = start; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function fmtNum(v, digits) {
    if (v === null || v === undefined || !isFinite(v)) return "–";
    const abs = Math.abs(v);
    if (digits === undefined) digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
    return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function compact(v) {
    const abs = Math.abs(v);
    if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return fmtNum(v, abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  function fmtTime(ts, span) {
    const d = new Date(ts * 1000);
    if (span > 86400 * 200) return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    if (span > 86400 * 3) return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    if (span > 3600 * 20) return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function fmtTimeFull(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function tooltipFor(container) {
    let tip = container.querySelector(".chart-tip");
    if (!tip) { tip = document.createElement("div"); tip.className = "chart-tip"; container.appendChild(tip); }
    return tip;
  }

  /* ------------------------------------------------------------------ */
  /* Line / area chart                                                   */
  /* options: { series: [{ name, color, points: [{x, y}], area, step }],
                height, yFormat, xType: 'time'|'index'|'linear', baseline: 0|null,
                yLabel, xLabels: [] (for index), tooltipTitle(x) }                */
  function lineChart(container, opts) {
    container.classList.add("chart");
    container.innerHTML = "";
    const width = Math.max(280, container.clientWidth || 600);
    const height = opts.height || 220;
    const m = { top: 12, right: 14, bottom: 26, left: 52 };
    const W = width - m.left - m.right, H = height - m.top - m.bottom;
    const series = (opts.series || []).filter(s => s.points && s.points.length);
    if (!series.length) {
      container.innerHTML = '<div class="empty"><div class="ico">◔</div>' + (opts.emptyText || "No data for this range yet") + "</div>";
      return;
    }
    const allX = [], allY = [];
    series.forEach(s => s.points.forEach(p => { allX.push(p.x); allY.push(p.y); }));
    let xmin = Math.min(...allX), xmax = Math.max(...allX);
    if (xmin === xmax) { xmin -= 1; xmax += 1; }
    let ymin = Math.min(...allY), ymax = Math.max(...allY);
    if (opts.baseline !== null && opts.baseline !== undefined) { ymin = Math.min(ymin, opts.baseline); ymax = Math.max(ymax, opts.baseline); }
    const padY = (ymax - ymin) * 0.08 || Math.abs(ymax) * 0.05 || 1;
    ymin -= padY; ymax += padY;
    const sx = x => m.left + (x - xmin) / (xmax - xmin) * W;
    const sy = y => m.top + (ymax - y) / (ymax - ymin) * H;

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width, height }, container);
    const yTicks = niceTicks(ymin, ymax, 4);
    yTicks.forEach(v => {
      el("line", { class: "grid-line", x1: m.left, x2: m.left + W, y1: sy(v), y2: sy(v) }, svg);
      const t = el("text", { x: m.left - 8, y: sy(v) + 3.5, "text-anchor": "end" }, svg);
      t.textContent = (opts.yFormat || compact)(v);
    });
    if (opts.baseline !== null && opts.baseline !== undefined && opts.baseline >= ymin && opts.baseline <= ymax) {
      el("line", { class: "zero-line", x1: m.left, x2: m.left + W, y1: sy(opts.baseline), y2: sy(opts.baseline) }, svg);
    }
    el("line", { class: "axis-line", x1: m.left, x2: m.left + W, y1: m.top + H, y2: m.top + H }, svg);
    const span = xmax - xmin;
    const nx = Math.max(2, Math.floor(W / 90));
    for (let i = 0; i <= nx; i++) {
      const x = xmin + span * i / nx;
      const t = el("text", { x: sx(x), y: m.top + H + 17, "text-anchor": i === 0 ? "start" : i === nx ? "end" : "middle" }, svg);
      t.textContent = opts.xType === "index" ? (opts.xLabels ? opts.xLabels[Math.round(x)] || "" : Math.round(x)) : fmtTime(x, span);
    }

    const defsId = "g" + Math.random().toString(36).slice(2, 8);
    series.forEach((s, si) => {
      const pts = s.points.slice().sort((a, b) => a.x - b.x);
      let d = "";
      pts.forEach((p, i) => {
        const X = sx(p.x), Y = sy(p.y);
        if (i === 0) d += `M${X.toFixed(1)},${Y.toFixed(1)}`;
        else if (s.step) d += `H${X.toFixed(1)}V${Y.toFixed(1)}`;
        else d += `L${X.toFixed(1)},${Y.toFixed(1)}`;
      });
      if (s.area !== false && opts.area !== false) {
        const base = sy(opts.baseline !== null && opts.baseline !== undefined ? Math.max(ymin, Math.min(ymax, opts.baseline)) : ymin);
        const first = pts[0], last = pts[pts.length - 1];
        const ad = d + `L${sx(last.x).toFixed(1)},${base.toFixed(1)}L${sx(first.x).toFixed(1)},${base.toFixed(1)}Z`;
        el("path", { d: ad, fill: s.color, class: "series-area" }, svg);
      }
      el("path", { d, stroke: s.color, class: "series-line" }, svg);
      s._pts = pts;
    });

    // hover layer
    const cross = el("line", { class: "crosshair is-hidden", y1: m.top, y2: m.top + H }, svg);
    const markers = series.map(s => el("circle", { r: 4, fill: s.color, class: "marker is-hidden" }, svg));
    const hit = el("rect", { class: "hit", x: m.left, y: m.top, width: W, height: H }, svg);
    const tip = tooltipFor(container);
    const bisect = (pts, x) => {
      let lo = 0, hi = pts.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].x < x) lo = mid + 1; else hi = mid; }
      if (lo > 0 && Math.abs(pts[lo - 1].x - x) < Math.abs(pts[lo].x - x)) lo--;
      return pts[lo];
    };
    hit.addEventListener("mousemove", ev => {
      const rect = svg.getBoundingClientRect();
      const px = (ev.clientX - rect.left) * (width / rect.width);
      const x = xmin + (px - m.left) / W * (xmax - xmin);
      let rows = "", anchorX = px, title = null;
      series.forEach((s, i) => {
        const p = bisect(s._pts, x);
        if (!p) return;
        anchorX = sx(p.x);
        if (title === null) title = opts.tooltipTitle ? opts.tooltipTitle(p) : (opts.xType === "index" ? (opts.xLabels ? opts.xLabels[p.x] : p.x) : fmtTimeFull(p.x));
        markers[i].setAttribute("cx", sx(p.x)); markers[i].setAttribute("cy", sy(p.y)); markers[i].classList.remove("is-hidden");
        rows += `<div class="row"><span class="k"><i class="sw" data-color="${s.color}"></i>${s.name}</span><span>${(opts.tipFormat || opts.yFormat || (v => fmtNum(v)))(p.y, p)}</span></div>`;
      });
      cross.setAttribute("x1", anchorX); cross.setAttribute("x2", anchorX); cross.classList.remove("is-hidden");
      tip.innerHTML = `<div class="t">${title || ""}</div>${rows}`;
      tip.querySelectorAll(".sw[data-color]").forEach(i => { i.style.background = i.dataset.color; });
      tip.style.display = "block";
      const left = anchorX / width * rect.width;
      tip.style.left = Math.max(70, Math.min(rect.width - 70, left)) + "px";
      tip.style.top = (ev.clientY - rect.top) + "px";
    });
    hit.addEventListener("mouseleave", () => { cross.classList.add("is-hidden"); markers.forEach(mk => mk.classList.add("is-hidden")); tip.style.display = "none"; });
  }

  /* ------------------------------------------------------------------ */
  /* Bar chart - one series, diverging colour by sign when opts.diverging  */
  /* options: { points: [{ label, value, title }], height, yFormat, color, posColor, negColor } */
  function barChart(container, opts) {
    container.classList.add("chart");
    container.innerHTML = "";
    const pts = opts.points || [];
    if (!pts.length) { container.innerHTML = '<div class="empty"><div class="ico">▥</div>' + (opts.emptyText || "No data for this range yet") + "</div>"; return; }
    const width = Math.max(280, container.clientWidth || 600);
    const height = opts.height || 200;
    const m = { top: 12, right: 14, bottom: 26, left: 52 };
    const W = width - m.left - m.right, H = height - m.top - m.bottom;
    let ymin = Math.min(0, ...pts.map(p => p.value)), ymax = Math.max(0, ...pts.map(p => p.value));
    if (ymin === ymax) ymax = 1;
    const pad = (ymax - ymin) * 0.08; ymin -= ymin < 0 ? pad : 0; ymax += ymax > 0 ? pad : 0;
    const sy = y => m.top + (ymax - y) / (ymax - ymin) * H;
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width, height }, container);
    niceTicks(ymin, ymax, 4).forEach(v => {
      el("line", { class: "grid-line", x1: m.left, x2: m.left + W, y1: sy(v), y2: sy(v) }, svg);
      const t = el("text", { x: m.left - 8, y: sy(v) + 3.5, "text-anchor": "end" }, svg); t.textContent = (opts.yFormat || compact)(v);
    });
    el("line", { class: "zero-line", x1: m.left, x2: m.left + W, y1: sy(0), y2: sy(0) }, svg);
    const n = pts.length, slot = W / n, gap = Math.min(2, slot * 0.2), bw = Math.max(1, slot - gap);
    const tip = tooltipFor(container);
    const labelEvery = Math.ceil(n / Math.max(1, Math.floor(W / 70)));
    pts.forEach((p, i) => {
      const x = m.left + i * slot + gap / 2;
      const y0 = sy(0), y1 = sy(p.value);
      const top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
      const color = opts.diverging === false ? (opts.color || "#3987e5") : (p.value >= 0 ? (opts.posColor || "#22b35a") : (opts.negColor || "#e04f4f"));
      const r = el("rect", { class: "bar", x: x.toFixed(1), y: top.toFixed(1), width: bw.toFixed(1), height: h.toFixed(1), fill: color, rx: Math.min(3, bw / 2) }, svg);
      if (i % labelEvery === 0) { const t = el("text", { x: x + bw / 2, y: m.top + H + 17, "text-anchor": "middle" }, svg); t.textContent = p.label; }
      const hit = el("rect", { class: "hit", x: m.left + i * slot, y: m.top, width: slot, height: H }, svg);
      hit.addEventListener("mouseenter", () => {
        r.setAttribute("opacity", "0.8");
        tip.innerHTML = `<div class="t">${p.title || p.label}</div><div class="row"><span class="k">${opts.valueLabel || "Value"}</span><span>${(opts.tipFormat || opts.yFormat || (v => fmtNum(v)))(p.value, p)}</span></div>${p.extra ? `<div class="row"><span class="k">${p.extra}</span></div>` : ""}`;
        tip.style.display = "block";
        const rect = svg.getBoundingClientRect();
        tip.style.left = ((x + bw / 2) / width * rect.width) + "px"; tip.style.top = (top / height * rect.height) + "px";
      });
      hit.addEventListener("mouseleave", () => { r.removeAttribute("opacity"); tip.style.display = "none"; });
    });
  }

  /* Horizontal ranked bars: points [{label, value}] */
  function hbarChart(container, opts) {
    container.classList.add("chart");
    container.innerHTML = "";
    const pts = (opts.points || []).slice();
    if (!pts.length) { container.innerHTML = '<div class="empty">' + (opts.emptyText || "No data") + "</div>"; return; }
    const width = Math.max(280, container.clientWidth || 600);
    const rowH = 24, m = { top: 6, right: 64, bottom: 6, left: 96 };
    const height = m.top + m.bottom + pts.length * rowH;
    const W = width - m.left - m.right;
    const maxAbs = Math.max(...pts.map(p => Math.abs(p.value))) || 1;
    const hasNeg = pts.some(p => p.value < 0);
    const zeroX = hasNeg ? m.left + W / 2 : m.left;
    const scale = hasNeg ? (W / 2) / maxAbs : W / maxAbs;
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width, height }, container);
    el("line", { class: "zero-line", x1: zeroX, x2: zeroX, y1: m.top, y2: height - m.bottom }, svg);
    pts.forEach((p, i) => {
      const y = m.top + i * rowH + 4, h = rowH - 8;
      const w = Math.abs(p.value) * scale;
      const x = p.value >= 0 ? zeroX : zeroX - w;
      const color = opts.diverging === false ? (opts.color || "#3987e5") : (p.value >= 0 ? (opts.posColor || "#22b35a") : (opts.negColor || "#e04f4f"));
      el("rect", { class: "bar", x, y, width: Math.max(1, w), height: h, fill: color, rx: 3 }, svg);
      const l = el("text", { x: m.left - 8, y: y + h / 2 + 3.5, "text-anchor": "end" }, svg); l.textContent = p.label;
      const v = el("text", { x: p.value >= 0 ? x + w + 6 : zeroX + 6, y: y + h / 2 + 3.5, "text-anchor": "start" }, svg);
      v.textContent = (opts.yFormat || compact)(p.value);
    });
  }

  const registry = [];
  const ro = (typeof ResizeObserver !== "undefined") ? new ResizeObserver(() => { registry.forEach(r => { if (document.body.contains(r.el)) r.draw(); }); }) : null;
  function responsive(elm, draw) {
    registry.push({ el: elm, draw });
    if (ro) ro.observe(elm);
    draw();
  }
  function clearRegistry() { registry.length = 0; }

  global.Charts = { lineChart, barChart, hbarChart, responsive, clearRegistry, fmtNum, compact, fmtTimeFull };
})(window);
