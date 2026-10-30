/* ============================================================
   Fitbit Activity Explorer — interactive dashboard
   Recreates the Code.ipynb analyses (PySpark on Databricks) and the
   Power BI report visuals in the browser. Plain SVG, no libraries.
   Data: assets/js/fitness-data.js  (window.FITNESS_DATA)
   ============================================================ */

(function () {
  'use strict';

  const root = document.getElementById('fitness-dashboard');
  const D = window.FITNESS_DATA;
  if (!root) return;
  if (!D) { root.classList.add('is-unavailable'); return; }

  // ---------- Data ----------
  const U = 0, DAY = 1, STEPS = 2, CAL = 3, VERY = 4, FAIR = 5, LIGHT = 6, SED = 7;
  const start = new Date(D.start + 'T00:00:00');
  const dates = Array.from({ length: D.days }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const fmtShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtLong = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdayOf = (i) => (dates[i].getDay() + 6) % 7;
  const active = (r) => r[VERY] + r[FAIR] + r[LIGHT];
  const nf = new Intl.NumberFormat('en-US');
  const n0 = (v) => nf.format(Math.round(v));
  const compact = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k' : String(Math.round(v)));
  const shortId = (id) => '…' + id.slice(-4);

  const perUser = D.users.map((id, i) => ({ i, id, steps: 0, cal: 0, active: 0, days: 0 }));
  D.rows.forEach((r) => { const p = perUser[r[U]]; p.steps += r[STEPS]; p.cal += r[CAL]; p.active += active(r); p.days += 1; });
  const topActive = [...perUser].sort((a, b) => b.active - a.active).slice(0, 10);

  let selectedUser = -1;

  function aggregate() {
    const rows = selectedUser < 0 ? D.rows : D.rows.filter((r) => r[U] === selectedUser);
    const daySteps = new Array(D.days).fill(null);
    const dayAct = new Array(D.days).fill(0);
    const dayN = new Array(D.days).fill(0);
    const wdCal = new Array(7).fill(0), wdN = new Array(7).fill(0);
    rows.forEach((r) => {
      daySteps[r[DAY]] = (daySteps[r[DAY]] || 0) + r[STEPS];
      dayAct[r[DAY]] += active(r); dayN[r[DAY]] += 1;
      const w = weekdayOf(r[DAY]); wdCal[w] += r[CAL]; wdN[w] += 1;
    });
    const n = rows.length || 1;
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    return {
      all: selectedUser < 0,
      rows,
      daySteps,
      dayAvgActive: dayAct.map((s, i) => (dayN[i] ? s / dayN[i] : null)),
      wdAvgCal: wdCal.map((s, i) => (wdN[i] ? s / wdN[i] : 0)),
      mins: [SED, LIGHT, FAIR, VERY].map((k) => sum(k) / n),
      kpi: {
        steps: sum(STEPS) / n,
        cal: sum(CAL) / n,
        active: rows.reduce((s, r) => s + active(r), 0) / n,
        sedHrs: sum(SED) / n / 60,
        tenK: rows.filter((r) => r[STEPS] >= 10000).length / n,
        days: rows.length,
      },
    };
  }

  // ---------- SVG helpers ----------
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  // Nice tick step (1, 2, 2.5, 5 x 10^n) so axis labels are round numbers
  const niceStep = (v) => {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  };
  const niceMax = (v, ticks = 4) => {
    if (v <= 0) return 1;
    const step = niceStep(v / ticks);
    return Math.ceil(v / step) * step;
  };
  const tickCount = (max) => { const st = niceStep(max / 4); return Math.round(max / st); };

  // One shared tooltip
  const tip = document.createElement('div');
  tip.className = 'fd-tip';
  tip.setAttribute('role', 'status');
  const tipTitle = document.createElement('div'); tipTitle.className = 'fd-tip-title';
  const tipValue = document.createElement('div'); tipValue.className = 'fd-tip-value';
  const tipNote = document.createElement('div'); tipNote.className = 'fd-tip-note';
  tip.append(tipTitle, tipValue, tipNote);
  root.appendChild(tip);

  function showTip(evtOrRect, title, value, note) {
    tipTitle.textContent = title;
    tipValue.textContent = value;
    tipNote.textContent = note || '';
    tipNote.hidden = !note;
    tip.classList.add('is-on');
    const host = root.getBoundingClientRect();
    let x, y;
    if (evtOrRect && 'clientX' in evtOrRect) { x = evtOrRect.clientX; y = evtOrRect.clientY; }
    else { const r = evtOrRect.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x - host.left - tw / 2;
    left = Math.max(8, Math.min(left, host.width - tw - 8));
    let top = y - host.top - th - 14;
    if (top < 8) top = y - host.top + 18;
    tip.style.transform = `translate(${left}px, ${top}px)`;
  }
  const hideTip = () => tip.classList.remove('is-on');

  // Frame: axes + gridlines, returns scales
  function frame(svg, w, h, opts) {
    const m = { t: 10, r: 12, b: opts.xTitle ? 40 : 26, l: opts.yTitle ? 54 : 42 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const yMax = niceMax(opts.yMax);
    const g = el('g', { transform: `translate(${m.l},${m.t})` }, svg);
    const ticks = tickCount(yMax);
    for (let i = 0; i <= ticks; i++) {
      const v = (yMax / ticks) * i, y = ih - (v / yMax) * ih;
      el('line', { x1: 0, x2: iw, y1: y, y2: y, class: i === 0 ? 'fd-axis' : 'fd-grid' }, g);
      const t = el('text', { x: -8, y: y + 4, 'text-anchor': 'end', class: 'fd-tick' }, g);
      t.textContent = compact(v);
    }
    if (opts.yTitle) {
      const t = el('text', { transform: `translate(${-m.l + 12},${ih / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'fd-axis-title' }, g);
      t.textContent = opts.yTitle;
    }
    if (opts.xTitle) {
      const t = el('text', { x: iw / 2, y: ih + 34, 'text-anchor': 'middle', class: 'fd-axis-title' }, g);
      t.textContent = opts.xTitle;
    }
    return { g, iw, ih, y: (v) => ih - (v / yMax) * ih, yMax };
  }

  function dateTicks(g, iw, ih, xAt) {
    const every = iw < 360 ? 10 : iw < 640 ? 7 : 5;
    for (let i = 0; i < D.days; i += every) {
      const t = el('text', { x: xAt(i), y: ih + 18, 'text-anchor': 'middle', class: 'fd-tick' }, g);
      t.textContent = fmtShort(dates[i]);
    }
  }

  function prep(id) {
    const box = document.getElementById(id);
    box.replaceChildren();
    const w = Math.max(box.clientWidth, 260), h = box.clientHeight || 240;
    const svg = el('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'fd-svg' }, box);
    return { svg, w, h };
  }

  // ---------- Charts ----------
  function lineChart(id, values, labelFn) {
    const { svg, w, h } = prep(id);
    const f = frame(svg, w, h, { yMax: Math.max(...values.map((v) => v || 0)) });
    const step = f.iw / (D.days - 1);
    const xAt = (i) => i * step;
    dateTicks(f.g, f.iw, f.ih, xAt);

    // Area + line, broken where there is no data
    const segs = []; let cur = [];
    values.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([xAt(i), f.y(v)]); });
    if (cur.length) segs.push(cur);
    segs.forEach((s) => {
      if (s.length > 1) {
        el('path', { d: `M${s[0][0]},${f.ih}L` + s.map((p) => p.join(',')).join('L') + `L${s[s.length - 1][0]},${f.ih}Z`, class: 'fd-area' }, f.g);
        el('path', { d: 'M' + s.map((p) => p.join(',')).join('L'), class: 'fd-line' }, f.g);
      } else {
        el('circle', { cx: s[0][0], cy: s[0][1], r: 3, class: 'fd-dot' }, f.g);
      }
    });

    // Crosshair + hover
    const hair = el('line', { y1: 0, y2: f.ih, class: 'fd-hair' }, f.g);
    const dot = el('circle', { r: 5, class: 'fd-dot fd-dot-hover' }, f.g);
    hair.style.display = dot.style.display = 'none';
    const hit = el('rect', { x: -step / 2, y: 0, width: f.iw + step, height: f.ih, class: 'fd-hit' }, f.g);
    const move = (e) => {
      const r = hit.getBoundingClientRect();
      const i = Math.max(0, Math.min(D.days - 1, Math.round((e.clientX - r.left - step / 2) / step)));
      const v = values[i];
      hair.setAttribute('x1', xAt(i)); hair.setAttribute('x2', xAt(i));
      hair.style.display = '';
      if (v != null) { dot.setAttribute('cx', xAt(i)); dot.setAttribute('cy', f.y(v)); dot.style.display = ''; } else dot.style.display = 'none';
      showTip(e, fmtLong(dates[i]), v == null ? 'No data' : labelFn(v));
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { hair.style.display = dot.style.display = 'none'; hideTip(); });
  }

  function columnChart(id, values, labels, opts) {
    const { svg, w, h } = prep(id);
    const f = frame(svg, w, h, { yMax: Math.max(...values.map((v) => v || 0)) });
    const band = f.iw / values.length;
    const bw = Math.min(opts.maxBar || 40, band * (opts.fill || 0.62));
    values.forEach((v, i) => {
      const x = i * band + (band - bw) / 2;
      if (opts.labelEvery == null || i % opts.labelEvery === 0) {
        const t = el('text', { x: i * band + band / 2, y: f.ih + 18, 'text-anchor': 'middle', class: 'fd-tick' }, f.g);
        t.textContent = opts.tickLabel ? opts.tickLabel(i) : labels[i];
      }
      if (v == null) return;
      const y = f.y(v), bh = f.ih - y, r = Math.min(4, bw / 2, bh);
      const bar = el('path', {
        d: `M${x},${f.ih}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${f.ih}Z`,
        class: 'fd-bar', tabindex: '0',
      }, f.g);
      const hitR = el('rect', { x: i * band, y: 0, width: band, height: f.ih, class: 'fd-hit' }, f.g);
      const on = (e) => { bar.classList.add('is-hover'); showTip(e.type === 'focus' ? bar : e, opts.title(i), opts.value(v)); };
      const off = () => { bar.classList.remove('is-hover'); hideTip(); };
      hitR.addEventListener('pointermove', on); hitR.addEventListener('pointerleave', off);
      bar.addEventListener('focus', on); bar.addEventListener('blur', off);
    });
  }

  function barListChart(id) {
    const { svg, w, h } = prep(id);
    const m = { t: 4, r: 52, b: 4, l: 52 };
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    const g = el('g', { transform: `translate(${m.l},${m.t})` }, svg);
    const max = topActive[0].active;
    const band = ih / topActive.length, bh = Math.min(18, band * 0.62);
    el('line', { x1: 0, x2: 0, y1: 0, y2: ih, class: 'fd-axis' }, g);
    topActive.forEach((p, i) => {
      const y = i * band + (band - bh) / 2;
      const bw = (p.active / max) * iw, r = Math.min(4, bh / 2, bw);
      const dim = selectedUser >= 0 && p.i !== selectedUser;
      const lab = el('text', { x: -8, y: y + bh / 2 + 4, 'text-anchor': 'end', class: 'fd-tick fd-mono' }, g);
      lab.textContent = shortId(p.id);
      const bar = el('path', {
        d: `M0,${y}H${bw - r}Q${bw},${y} ${bw},${y + r}V${y + bh - r}Q${bw},${y + bh} ${bw - r},${y + bh}H0Z`,
        class: 'fd-bar' + (dim ? ' is-dim' : ''), tabindex: '0', role: 'button',
        'aria-label': `User ${p.id}, ${n0(p.active)} active minutes. Activate to filter.`,
      }, g);
      const val = el('text', { x: bw + 6, y: y + bh / 2 + 4, class: 'fd-tick' }, g);
      val.textContent = compact(p.active);
      const hitR = el('rect', { x: -m.l, y: i * band, width: w, height: band, class: 'fd-hit fd-click' }, g);
      const on = (e) => { bar.classList.add('is-hover'); showTip(e.type === 'focus' ? bar : e, 'User ' + p.id, n0(p.active) + ' active min', 'Click to filter'); };
      const off = () => { bar.classList.remove('is-hover'); hideTip(); };
      const pick = () => { hideTip(); setUser(selectedUser === p.i ? -1 : p.i); };
      hitR.addEventListener('pointermove', on); hitR.addEventListener('pointerleave', off); hitR.addEventListener('click', pick);
      bar.addEventListener('focus', on); bar.addEventListener('blur', off);
      bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
  }

  function scatterChart(id) {
    const { svg, w, h } = prep(id);
    const pts = perUser.map((p) => ({ p, x: p.steps / p.days, y: p.cal / p.days }));
    const f = frame(svg, w, h, { yMax: Math.max(...pts.map((d) => d.y)), xTitle: 'Avg daily steps', yTitle: 'Avg daily kcal' });
    const xMax = niceMax(Math.max(...pts.map((d) => d.x)));
    const xs = (v) => (v / xMax) * f.iw;
    const xt = tickCount(xMax);
    for (let i = 1; i <= xt; i++) {
      const v = (xMax / xt) * i;
      el('line', { x1: xs(v), x2: xs(v), y1: 0, y2: f.ih, class: 'fd-grid' }, f.g);
    }
    for (let i = 0; i <= xt; i++) {
      const v = (xMax / xt) * i;
      const t = el('text', { x: xs(v), y: f.ih + 18, 'text-anchor': 'middle', class: 'fd-tick' }, f.g);
      t.textContent = compact(v);
    }
    // Draw unselected first so the selected dot sits on top
    const order = [...pts].sort((a, b) => (a.p.i === selectedUser) - (b.p.i === selectedUser));
    order.forEach((d) => {
      const sel = d.p.i === selectedUser, dim = selectedUser >= 0 && !sel;
      const c = el('circle', {
        cx: xs(d.x), cy: f.y(d.y), r: sel ? 7 : 5,
        class: 'fd-pt' + (dim ? ' is-dim' : '') + (sel ? ' is-sel' : ''), tabindex: '0', role: 'button',
        'aria-label': `User ${d.p.id}: ${n0(d.x)} steps and ${n0(d.y)} calories per day. Activate to filter.`,
      }, f.g);
      const hitC = el('circle', { cx: xs(d.x), cy: f.y(d.y), r: 12, class: 'fd-hit fd-click' }, f.g);
      const on = (e) => { c.classList.add('is-hover'); showTip(e.type === 'focus' ? c : e, 'User ' + d.p.id, n0(d.x) + ' steps · ' + n0(d.y) + ' kcal', 'Daily averages · click to filter'); };
      const off = () => { c.classList.remove('is-hover'); hideTip(); };
      const pick = () => { hideTip(); setUser(selectedUser === d.p.i ? -1 : d.p.i); };
      hitC.addEventListener('pointermove', on); hitC.addEventListener('pointerleave', off); hitC.addEventListener('click', pick);
      c.addEventListener('focus', on); c.addEventListener('blur', off);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
  }

  function splitBar(mins) {
    const names = ['Sedentary', 'Lightly active', 'Fairly active', 'Very active'];
    const total = mins.reduce((s, v) => s + v, 0) || 1;
    const bar = document.getElementById('fd-split-bar');
    const legend = document.getElementById('fd-split-legend');
    bar.replaceChildren(); legend.replaceChildren();
    mins.forEach((m, i) => {
      const pct = Math.round((m / total) * 100);
      const seg = document.createElement('span');
      seg.className = 'fd-split-seg fd-ramp-' + i;
      seg.style.flexGrow = String(m / total);
      seg.addEventListener('pointermove', (e) => showTip(e, names[i], n0(m) + ' min / day', pct + '% of tracked time'));
      seg.addEventListener('pointerleave', hideTip);
      bar.appendChild(seg);

      const li = document.createElement('li');
      const sw = document.createElement('span'); sw.className = 'fd-swatch fd-ramp-' + i;
      const nm = document.createElement('span'); nm.className = 'fd-split-name'; nm.textContent = names[i];
      const val = document.createElement('span'); val.className = 'fd-split-val'; val.textContent = n0(m) + ' min · ' + pct + '%';
      li.append(sw, nm, val);
      legend.appendChild(li);
    });
  }

  function table() {
    const tbody = document.getElementById('fd-table-body');
    tbody.replaceChildren();
    [...perUser].sort((a, b) => b.active - a.active).forEach((p) => {
      const tr = document.createElement('tr');
      if (p.i === selectedUser) tr.className = 'is-selected';
      [p.id, n0(p.steps), n0(p.cal), n0(p.active), String(p.days)].forEach((v, k) => {
        const td = document.createElement('td');
        td.textContent = v;
        if (k > 0) td.className = 'num';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ---------- Render ----------
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

  function render() {
    const a = aggregate();
    set('fd-kpi-steps', n0(a.kpi.steps));
    set('fd-kpi-cal', n0(a.kpi.cal));
    set('fd-kpi-active', n0(a.kpi.active) + ' min');
    set('fd-kpi-sed', a.kpi.sedHrs.toFixed(1) + ' hrs');
    set('fd-kpi-10k', Math.round(a.kpi.tenK * 100) + '%');
    set('fd-scope', a.all ? `All ${D.users.length} users · ${D.rows.length} user-days` : `User ${D.users[selectedUser]} · ${a.kpi.days} days`);
    set('fd-trend-title', a.all ? 'Total steps per day (all users)' : 'Steps per day');
    document.getElementById('fd-reset').hidden = a.all;

    lineChart('fd-trend', a.daySteps, (v) => n0(v) + ' steps');
    columnChart('fd-weekday', a.wdAvgCal, WEEKDAYS, {
      maxBar: 40, title: (i) => WEEKDAYS[i], value: (v) => n0(v) + ' kcal / day',
    });
    columnChart('fd-active', a.dayAvgActive, dates.map(fmtShort), {
      fill: 0.72, maxBar: 14,
      labelEvery: document.getElementById('fd-active').clientWidth < 420 ? 10 : 7,
      title: (i) => fmtLong(dates[i]), value: (v) => n0(v) + ' active min',
    });
    barListChart('fd-top');
    scatterChart('fd-scatter');
    splitBar(a.mins);
    table();
  }

  // ---------- Controls ----------
  const select = document.getElementById('fd-user');
  D.users.forEach((id, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = 'User ' + id;
    select.appendChild(opt);
  });
  function setUser(i) { selectedUser = i; select.value = String(i); render(); }
  select.addEventListener('change', () => setUser(parseInt(select.value, 10)));
  document.getElementById('fd-reset').addEventListener('click', () => setUser(-1));

  // Re-render on resize (charts are sized in pixels for crisp text)
  let lastW = 0, raf = 0;
  const ro = new ResizeObserver(() => {
    const w = root.clientWidth;
    if (w === lastW) return;
    lastW = w;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  });
  ro.observe(root);
})();
