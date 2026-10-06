/* =========================================================
   Game B, "The garden": the model is a garden, its flaws are weeds.

   Each season the garden doubles (size N). Each kind of weed r sprouts in
   proportion to share_r × N^exponent_r (Align.Law). The gardener's time is
   1 hour per m², so it grows exactly like the garden (the budget, exponent 1).
   The key number is weeding hours per m²: falling = scaling helps,
   flat = balance, rising = alignment debt. Weeds left unpulled take over
   plots (lost ground). The hidden risk is roots under the soil: weeding never
   removes them; digging deep (twice at most) finds about 80% of them.
   Needs jQuery, js/core.js, js/measured.js, js/law.js.
   ========================================================= */
(function ($, A) {
  'use strict';

  const L = A.Law;
  const WORLD = L.fromURL('balance');
  const W = L.WORLDS[WORLD];
  const MEAS = WORLD === 'measured';
  const RISKS = L.risks(WORLD);
  const VIS = RISKS.filter(r => !r.hidden);
  const HID = RISKS.find(r => r.hidden) || null;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- The law, in garden units ----------
  const LAYOUT = [[1, 1], [2, 1], [2, 2], [4, 2], [4, 4], [8, 4], [8, 8]]; // plots: cols × rows
  const SEASONS = LAYOUT.length;
  const PLOT_M2 = 100;            // one plot: 10 m × 10 m
  const CELL = 100;               // one plot in SVG units
  const WEEDS0 = 240;             // weeds you can see in season 1
  const PER_UNIT = WEEDS0 / VIS.reduce((s, r) => s + r.share, 0); // weeds per unit of Law.amount
  const H_PER_WEED = .25;         // 15 minutes per weed: 60 h for the first 100 m²
  const H_PER_M2 = 1;             // the gardener's time: 1 hour per m² per season
  const WEED_K = 50;              // one drawn weed = 50 weeds (until the drawing cap)
  const ROOT_K = 20;              // one drawn root = 20 roots (until the cap)
  const MAX_DRAWN = 480, PER_PLOT = 9, MAX_ROOTS = 140;
  const DIGS = 2, FIND = .8, DIG_FROM = 2;

  const sizeOf = s => Math.pow(2, s - 1);              // N, relative to season 1
  const weedsOf = (r, N) => PER_UNIT * L.amount(r, N);

  // ---------- Helpers ----------
  const $id = id => $(document.getElementById(id));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hours = h => `${A.num(h)} h`;
  const m2 = a => `${A.num(a)} m²`;
  const perFmt = v => (v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const times = x => `×${x >= 100 ? A.num(x) : x >= 10 ? Math.round(x) : x.toFixed(x < 1 ? 2 : 1)}`;
  const expFmt = e => (e < 0 ? '−' : '') + Math.abs(e).toFixed(2);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  // Largest-remainder rounding: integers proportional to `w`, summing to `total`
  function apportion(w, total) {
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    const q = w.map(x => x * total / sum);
    const n = q.map(Math.floor);
    let left = total - n.reduce((a, b) => a + b, 0);
    q.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { n[i]++; left--; } });
    return n;
  }

  // ---------- Drawings (base of each weed at 0,0) ----------
  const STEM = '#2c5e33', LEAF = '#3f8a4a', EDGE = 'stroke="rgba(10,14,8,.45)" stroke-width="1"';
  function weedArt(key, c) {
    switch (key) {
      case 'jailbreak': // a thistle
        return `<path d="M0 0V-18" stroke="${STEM}" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M0 -5 L-11 -11 L-6 -8.5 L-12 -4 Z M0 -9 L11 -15 L6 -12 L12 -8 Z" fill="${LEAF}"/>
          <path d="M-5 -17 Q0 -13 5 -17 L4 -21 Q0 -18 -4 -21 Z" fill="${LEAF}"/>
          <path d="M-5 -20 L-9 -28 L-3 -22.5 L-2.2 -31 L0 -22.5 L2.2 -31 L3 -22.5 L9 -28 L5 -20 Z" fill="${c}" ${EDGE}/>`;
      case 'sycophancy': // a dandelion
        return `<path d="M0 0 Q-7 -1 -13 -6 L-9 -5.5 L-10 -10 L-6 -6.5 Q-3 -2 0 0 Z M0 0 Q7 -1 13 -6 L9 -5.5 L10 -10 L6 -6.5 Q3 -2 0 0 Z" fill="${LEAF}"/>
          <path d="M0 -1 Q2.5 -10 0 -18" stroke="${STEM}" stroke-width="2.2" fill="none"/>
          <circle cx="0" cy="-23" r="7.5" fill="${c}" ${EDGE}/>
          <circle cx="0" cy="-23" r="5" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.4" stroke-dasharray="1.6 1.8"/>
          <circle cx="0" cy="-23" r="2.4" fill="#a8740f"/>`;
      case 'hacking': // a twisting creeper
        return `<path d="M-11 0 C-9 -9 -1 -5 0 -13 C1 -21 9 -17 8 -26" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
          <path d="M8 -26 c3.5 -2 5 2.5 1.5 3.5" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <ellipse cx="-7" cy="-7" rx="5" ry="3.2" transform="rotate(-35 -7 -7)" fill="${c}" ${EDGE}/>
          <ellipse cx="5" cy="-12" rx="5" ry="3.2" transform="rotate(30 5 -12)" fill="${c}" ${EDGE}/>
          <ellipse cx="2" cy="-21" rx="4.4" ry="2.8" transform="rotate(-30 2 -21)" fill="${c}" ${EDGE}/>`;
      case 'honesty': // a nettle
        return `<path d="M0 0V-26" stroke="${STEM}" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M0 -6 C-6 -6 -12 -11 -12 -19 C-7 -17 -2 -13 0 -9 Z" fill="${c}" ${EDGE}/>
          <path d="M0 -12 C6 -12 12 -17 12 -24 C7 -22 2 -18 0 -15 Z" fill="${c}" ${EDGE}/>
          <path d="M0 -23 C-4.5 -26 -3.5 -31 0 -33 C3.5 -31 4.5 -26 0 -23 Z" fill="${c}" ${EDGE}/>`;
      case 'dispositions': // a tall spire, reaching up
        return `<path d="M0 0V-31" stroke="${STEM}" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M0 -3 Q-7 -4 -10 -10 Q-4 -8 0 -6 Z M0 -6 Q7 -7 10 -13 Q4 -11 0 -9 Z" fill="${LEAF}"/>
          <circle cx="-3.2" cy="-13" r="3.2" fill="${c}" ${EDGE}/><circle cx="3.2" cy="-17.5" r="3.2" fill="${c}" ${EDGE}/>
          <circle cx="-3.2" cy="-22" r="3" fill="${c}" ${EDGE}/><circle cx="3" cy="-26.5" r="2.8" fill="${c}" ${EDGE}/>
          <circle cx="0" cy="-31" r="2.6" fill="${c}" ${EDGE}/>`;
      default: // a plain tuft
        return `<path d="M0 0 L-8 -18 M0 0 L-2 -24 M0 0 L4 -22 M0 0 L9 -15" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
    }
  }
  const ROOT_D = 'M0 -9 C-1.5 -2 2 2 0 8 M0 -1 C4 1 7 2 9.5 8 M0 3 C-4 5 -6.5 7.5 -9 12.5 M0 8 C1.5 11 -1.5 14 0 18';
  function rootArt(c) {
    return `<path d="${ROOT_D}" stroke="${c}" stroke-opacity=".32" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="${ROOT_D}" stroke="${c}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="${ROOT_D}" stroke="#f1e8ff" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="0" cy="-10" r="3.6" fill="${c}"/><circle cx="0" cy="-10" r="1.4" fill="#f1e8ff"/>`;
  }

  function fieldSVG() {
    const dots = VIS.map((r, i) => `<circle cx="${[7, 31, 20, 36, 12][i % 5]}" cy="${[9, 14, 30, 33, 22][i % 5]}" r="2.4" fill="${r.color}" opacity=".85"/>`).join('');
    return `<svg id="g-svg" class="g-svg" viewBox="0 0 360 360" preserveAspectRatio="xMidYMid meet" role="img" aria-label="The garden">
      <defs>
        <pattern id="pat-meadow" width="46" height="46" patternUnits="userSpaceOnUse">
          <rect width="46" height="46" fill="#1b2c1d"/>
          <path d="M6 14 l2 -6 M9 15 l1 -7 M30 36 l2 -6 M33 37 l1 -7 M24 8 l-1 -5 M40 22 l2 -5" stroke="#2a4330" stroke-width="1.6" stroke-linecap="round"/>
        </pattern>
        <pattern id="pat-soil" width="${CELL / 3}" height="${CELL / 3}" patternUnits="userSpaceOnUse">
          <rect width="${CELL / 3}" height="${CELL / 3}" fill="#6a4a30"/>
          <rect y="${CELL / 6 + 4}" width="${CELL / 3}" height="5" fill="#5a3d27"/>
          <circle cx="${CELL / 6}" cy="${CELL / 6}" r="6.2" fill="#55803f"/>
          <circle cx="${CELL / 6 - 1.5}" cy="${CELL / 6 - 1.5}" r="2.6" fill="#7aa45c"/>
        </pattern>
        <pattern id="pat-wild" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#1d3a1e"/>
          <path d="M0 30 C8 18 14 34 22 20 S36 12 40 24 M-2 8 C6 0 12 14 20 4 S32 -2 42 6 M4 40 C10 30 18 38 26 30" stroke="#2f6a30" stroke-width="3.2" fill="none"/>
          <path d="M10 26 C14 20 20 28 26 18 M24 6 C28 0 34 10 38 2" stroke="#3f8a3c" stroke-width="2.2" fill="none"/>
          ${dots}
        </pattern>
        ${RISKS.filter(r => !r.hidden).map(r => `<g id="w-${r.key}">${weedArt(r.key, r.color)}</g>`).join('')}
        ${HID ? `<g id="w-root">${rootArt(HID.color)}</g>` : ''}
      </defs>
      <rect x="-4000" y="-4000" width="9000" height="9000" fill="url(#pat-meadow)"/>
      <rect id="g-outline" x="3" y="3" width="94" height="94" rx="7" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2" stroke-dasharray="6 6"/>
      <g id="g-plots"></g>
      <g id="g-weeds"></g>
      <g id="g-under" opacity="0">
        <rect id="g-xray" x="0" y="0" width="100" height="100" rx="8" fill="#140a22" opacity=".72"/>
        <g id="g-roots"></g>
      </g>
    </svg>`;
  }

  // ---------- State ----------
  const S = {
    season: 0, plots: [], wild: 0,
    roots: 0, rootsFound: 0, digs: DIGS, digLog: [], dugIn: 0,
    hist: [], busy: false, done: false, drawnK: WEED_K,
    view: { x: -130, y: -130, w: 360, h: 360 }
  };

  let svg, gPlots, gWeeds, gUnder, gRoots, xray;

  // ---------- Header, legend, intro ----------
  function buildHeader() {
    const $pill = $id('world-pill').addClass(`w-${WORLD}`);
    $pill.append($('<b></b>').text(W.name), document.createTextNode(` · ${W.tag}`));
    if (MEAS && W.provisional) $pill.append(document.createTextNode(' · '), $('<span class="prov"></span>').text('provisional'));
    const $nav = $id('angles');
    L.ANGLES.forEach(k => {
      const w = L.WORLDS[k];
      const $a = $('<a></a>').addClass(`a-${k}`).text(w.name).attr('href', L.link('garden.html', k));
      if (k === WORLD) $a.addClass('on').attr('aria-current', 'page');
      if (k === 'measured' && !w.available) $a.addClass('off').removeAttr('href').attr('aria-disabled', 'true');
      $nav.append($a);
    });
    $id('back').attr('href', L.link('index.html'));
    $id('brand').attr('href', L.link('index.html'));
    document.title = `The garden · ${W.name} · Alignment`;
  }

  function iconSVG(key, cls) {
    const id = key === 'root' ? 'w-root' : `w-${key}`;
    const vb = key === 'root' ? '-14 -16 28 38' : '-15 -35 30 38';
    return `<svg class="${cls}" viewBox="${vb}" aria-hidden="true"><use href="#${id}"/></svg>`;
  }

  function buildLegend() {
    const $ul = $id('legend');
    RISKS.forEach(r => {
      const $li = $('<li></li>').addClass(r.hidden ? 'lg-hidden' : '');
      $li.append($(iconSVG(r.hidden ? 'root' : r.key, 'lg-icon')));
      const $t = $('<span class="lg-text"></span>');
      $t.append($('<b></b>').text(r.name), $('<span></span>').text(` ${r.plain}.`));
      if (r.hidden) $t.append($('<em></em>').text(' Its roots hide under the soil.'));
      $li.append($t);
      $ul.append($li);
    });
    $id('legend-note').text('Garden = the AI model · its area = the model\'s size · your time = the safety budget, which grows with it · weeding = safety work · wild ground = ability lost to fixing flaws.');
  }

  function buildIntro() {
    $id('intro-kicker').text(`The garden · ${W.name} (${W.tag})`);
    const angle = MEAS
      ? `In this angle, each weed spreads at the rate measured on real AI models, in preregistered experiments. ${W.provisional ? 'The results are provisional' : 'The results come from a pilot on one family of models'}, and how common each weed is, is illustrative.`
      : `In this angle (${esc(W.name)}): ${esc(W.line)} The rates are illustrative.`;
    $id('intro-body').html(`
      <p>Each season you <b>double the garden</b>. A bigger garden is a bigger, more capable model.</p>
      <p>Your time grows with it: <b>1 hour of work per m²</b> each season.</p>
      <p>Weeds grow too. Do they grow <b>faster or slower</b> than the garden? Watch one number: <b>weeding hours per m²</b>.</p>
      ${HID ? `<p>Some roots grow <b>under the soil</b>, where you cannot see them.</p>` : ''}
      <p class="intro-angle">${angle}</p>`);
  }

  // ---------- The field ----------
  function setView(v) {
    S.view = v;
    svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
  }
  function viewFor(s) {
    const [c, r] = LAYOUT[s - 1];
    const w = c * CELL, h = r * CELL;
    const side = Math.max(w, h, 1.6 * CELL) + 1.1 * CELL;
    return { x: w / 2 - side / 2, y: h / 2 - side / 2, w: side, h: side };
  }
  function zoomTo(v, ms) {
    const from = { ...S.view };
    return A.tween(0, 1, ms, 'easeInOutCubic', t => setView({
      x: A.lerp(from.x, v.x, t), y: A.lerp(from.y, v.y, t), w: A.lerp(from.w, v.w, t), h: A.lerp(from.h, v.h, t)
    }));
  }
  function sizeUnder(s) {
    const [c, r] = LAYOUT[s - 1];
    for (const e of [xray, document.getElementById('g-outline')]) {
      e.setAttribute('width', c * CELL - (e === xray ? 0 : 6));
      e.setAttribute('height', r * CELL - (e === xray ? 0 : 6));
    }
  }

  function makePlot(c, r) {
    const g = svgEl('g', { class: 'plot' });
    const x = c * CELL + 3, y = r * CELL + 3, s = CELL - 6;
    g.appendChild(svgEl('rect', { class: 'soil', x, y, width: s, height: s, rx: 7, fill: 'url(#pat-soil)' }));
    const p = { c, r, g, wild: false, icons: [], cx: x + s / 2, cy: y + s / 2 };
    scalePlot(p, 0);
    gPlots.appendChild(g);
    return p;
  }
  function scalePlot(p, k) {
    p.g.setAttribute('transform', `translate(${p.cx} ${p.cy}) scale(${Math.max(k, .001).toFixed(3)}) translate(${-p.cx} ${-p.cy})`);
    p.g.setAttribute('opacity', A.clamp(k * 1.4, 0, 1).toFixed(2));
  }

  // New plots appear one after the other, nearest first (one jQuery animation drives them all)
  function growPlots(s) {
    const [c1, r1] = LAYOUT[s - 1];
    const [c0, r0] = s > 1 ? LAYOUT[s - 2] : [0, 0];
    const fresh = [];
    for (let r = 0; r < r1; r++) for (let c = 0; c < c1; c++) if (c >= c0 || r >= r0) fresh.push(makePlot(c, r));
    const dist = p => Math.max(p.c - c0 + 1, p.r - r0 + 1, 0) + Math.random() * .8;
    const ds = fresh.map(dist), dmax = Math.max(...ds, 1);
    fresh.forEach((p, i) => { p.delay = (ds[i] / dmax) * .5; });
    S.plots.push(...fresh);
    return A.tween(0, 1, A.T(1000), 'linear', t => {
      fresh.forEach(p => scalePlot(p, $.easing.easeOutBack(A.clamp((t - p.delay) / .5, 0, 1))));
    }).then(() => fresh.forEach(p => { p.g.removeAttribute('transform'); p.g.removeAttribute('opacity'); }));
  }

  // A drawn weed or root sits at (x, y) through CSS variables: the CSS transform scales it around its base
  function place(u, x, y, k) {
    u.style.setProperty('--x', `${x.toFixed(1)}px`);
    u.style.setProperty('--y', `${y.toFixed(1)}px`);
    u.style.setProperty('--s', k.toFixed(2));
    return u;
  }

  // Drawn weeds: one per WEED_K weeds, spread at random over the plots still farmed
  function plantWeeds(h) {
    const farmed = S.plots.filter(p => !p.wild);
    const want = VIS.map(r => h.byKind[r.key] / WEED_K);
    const wantSum = want.reduce((a, b) => a + b, 0);
    const cap = Math.min(MAX_DRAWN, farmed.length * PER_PLOT);
    const total = Math.min(cap, Math.max(farmed.length ? 1 : 0, Math.round(wantSum)));
    const counts = apportion(want, total);
    S.drawnK = total ? h.weeds / total : WEED_K;
    const slots = [];
    farmed.forEach(p => { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) slots.push({ p, a, b }); });
    shuffle(slots);
    const kinds = [];
    counts.forEach((n, i) => { for (let j = 0; j < n; j++) kinds.push(VIS[i]); });
    shuffle(kinds);
    const items = kinds.map((r, i) => {
      const { p, a, b } = slots[i];
      return { r, p, x: p.c * CELL + 19 + a * 31 + A.rand(-5, 5), y: p.r * CELL + 37 + b * 28.5 + A.rand(-3, 3) };
    }).sort((u, v) => u.y - v.y);
    const spread = A.T(900), dur = A.T(520);
    items.forEach(it => {
      const u = place(svgEl('use', { href: `#w-${it.r.key}`, class: 'weed' }), it.x, it.y, A.rand(.82, 1.15));
      u.style.animation = `g-sprout ${dur}ms ${Math.round(A.rand(0, spread))}ms both`;
      gWeeds.appendChild(u);
      it.p.icons.push(u);
    });
    return A.wait(spread + dur);
  }

  function pullIcons(icons, spread, flyUp) {
    const dur = A.T(380);
    icons.forEach((u, i) => {
      const d = Math.round((icons.length > 1 ? i / (icons.length - 1) : 0) * spread + A.rand(0, A.T(120)));
      u.style.animation = `${flyUp ? 'g-pull' : 'g-fade'} ${dur}ms ${d}ms both`;
    });
    return A.wait(spread + dur + A.T(140)).then(() => icons.forEach(u => u.remove()));
  }

  function goWild(p) {
    p.wild = true;
    const x = p.c * CELL + 3, y = p.r * CELL + 3, s = CELL - 6;
    const g = svgEl('g', { class: 'wild', opacity: 0 });
    g.appendChild(svgEl('rect', { x, y, width: s, height: s, rx: 7, fill: 'url(#pat-wild)' }));
    shuffle(VIS.slice()).slice(0, 3).forEach((r, i) => {
      g.appendChild(svgEl('use', { href: `#w-${r.key}`, x: x + 20 + i * 27 + A.rand(-4, 4), y: y + 40 + (i % 2) * 34 + A.rand(-4, 4) }));
    });
    p.g.appendChild(g);
    return g;
  }

  // ---------- Panel ----------
  function setTrend(i) {
    const h = S.hist[i];
    const $big = $id('per-m2').html(`${perFmt(h.perM2)}<span class="unit">h</span>`);
    $big.removeClass('bump');
    void $big[0].offsetWidth;
    $big.addClass('bump');
    const $t = $id('trend').removeClass('t-helps t-balance t-debt t-start');
    if (i === 0) {
      $t.addClass('t-start');
      $id('trend-arrow').text('•');
      $id('trend-words').text('Season 1 sets the starting point.');
      return;
    }
    const q = h.perM2 / S.hist[i - 1].perM2;
    const k = q < .9 ? 'helps' : q > 1.1 ? 'debt' : 'balance';
    const T = {
      helps: ['↓', 'Falling: weeding gets easier as the garden grows.'],
      balance: ['→', 'About flat: weeding keeps pace with the garden.'],
      debt: ['↑', 'Rising: the weeds outgrow the garden.']
    }[k];
    $t.addClass(`t-${k}`);
    $id('trend-arrow').text(T[0]);
    $id('trend-words').html(`${T[1]}<small>${q < 1 ? '−' : '+'}${Math.abs(Math.round((q - 1) * 100))}% since last season</small>`);
  }

  function setHours(h, used) {
    const scale = Math.max(h.need, h.have);
    $id('h-need').text(hours(h.need)).toggleClass('over', h.need > h.have);
    $id('h-have').text(hours(h.have));
    $id('h-need-bar').css('width', `${(h.need / scale) * 100}%`).toggleClass('over', h.need > h.have);
    $id('h-mark').css('left', `${(h.have / scale) * 100}%`);
    $id('h-used').css('width', `${((used || 0) / scale) * 100}%`);
  }

  function setFacts() {
    const h = S.hist[S.hist.length - 1];
    const area = h ? h.area : 0;
    $id('season-line').text(h ? `Season ${h.s} of ${SEASONS} · ${m2(area)}` : '');
    $id('chip-season').text(h ? `Season ${h.s} of ${SEASONS} · ${m2(area)}` : 'Not planted yet');
    $id('f-weeds').text(h ? A.num(h.weeds) : '–');
    const lost = S.wild * PLOT_M2;
    $id('f-lost').text(lost ? `${m2(lost)} (${Math.round(100 * S.wild / S.plots.length)}%)` : '0 m²').toggleClass('bad', lost > 0);
    $id('chip-lost').prop('hidden', !lost).text(`Wild ground: ${m2(lost)}`);
    if (h) {
      const k = Math.round(S.drawnK);
      $id('chip-scale').prop('hidden', false).text(`1 drawn weed ≈ ${A.num(k)} weeds`);
    }
    if (HID) {
      $id('f-roots').text(S.rootsFound ? `${A.num(S.rootsFound)} found · ? left` : '?');
      $id('chip-roots').prop('hidden', !h).text(S.rootsFound ? `Hidden roots: ${A.num(S.rootsFound)} found, ? left` : 'Hidden roots: ?');
    }
    $id('dig-left').text(`${S.digs} left`);
    $id('g-svg').attr('aria-label', h ? `The garden: ${m2(area)}, ${A.num(h.weeds)} weeds this season, ${m2(lost)} of wild ground.` : 'The garden, not planted yet.');
  }

  function focusEl(id) {
    const e = document.getElementById(id);
    if (e) try { e.focus({ preventScroll: true }); } catch (err) { e.focus(); }
  }

  function story(html) { $id('story').html(html); }

  function setButtons(phase) {
    // phase: 'busy' | 'sprouted' | 'weeded' | 'end'
    const last = S.season >= SEASONS;
    $id('btn-weed').prop('disabled', phase !== 'sprouted');
    $id('btn-dig').prop('disabled', !(HID && S.digs > 0 && S.season >= DIG_FROM && S.dugIn !== S.season && (phase === 'sprouted' || phase === 'weeded')))
      .prop('hidden', !HID || S.season < DIG_FROM);
    $id('btn-next').prop('disabled', !(phase === 'weeded' || phase === 'end'))
      .text(last ? (phase === 'end' ? 'Show the verdict' : 'See the verdict') : 'Extend the garden');
  }

  // ---------- The chart (hand-written SVG) ----------
  function chartSVG(big, withHidden) {
    const Wd = big ? 640 : 360, Ht = big ? 250 : 180;
    const pl = 38, pr = big ? 92 : 66, pt = 14, pb = big ? 40 : 30;
    const H = S.hist;
    const vals = H.map(h => h.perM2);
    const alls = withHidden ? H.map(h => h.perM2All) : [];
    const top = Math.max(1.15, ...vals, ...alls) * 1.06;
    const step = [.25, .5, 1, 2, 5, 10, 20].find(s => top / s <= 4.2) || 50;
    const ymax = Math.ceil(top / step) * step;
    const X = i => pl + (i / (SEASONS - 1)) * (Wd - pl - pr);
    const Y = v => pt + (1 - v / ymax) * (Ht - pt - pb);
    const o = [];
    o.push(`<svg viewBox="0 0 ${Wd} ${Ht}" class="chart-svg${big ? ' big' : ''}" role="img" aria-label="Weeding hours per square metre, season by season">`);
    o.push(`<rect x="${pl}" y="${Y(ymax)}" width="${Wd - pl - pr}" height="${Y(1) - Y(ymax)}" fill="rgba(255,95,109,.07)"/>`);
    for (let v = 0; v <= ymax + 1e-9; v += step) {
      o.push(`<line x1="${pl}" x2="${Wd - pr}" y1="${Y(v)}" y2="${Y(v)}" class="c-grid"/>`);
      o.push(`<text x="${pl - 6}" y="${Y(v) + 3.5}" text-anchor="end" class="c-tick">${v % 1 ? v.toFixed(2).replace(/0$/, '') : v}</text>`);
    }
    o.push(`<line x1="${pl}" x2="${Wd - pr}" y1="${Y(1)}" y2="${Y(1)}" class="c-budget"/>`);
    o.push(`<text x="${Wd - pr + 6}" y="${Y(1) + 3.5}" class="c-lab">your time</text>`);
    for (let i = 0; i < SEASONS; i++) {
      const lab = big ? (i === 0 || i === SEASONS - 1 || i % 2 === 0 ? A.short(PLOT_M2 * sizeOf(i + 1)) + ' m²' : '') : String(i + 1);
      o.push(`<text x="${X(i)}" y="${Ht - pb + (big ? 20 : 15)}" text-anchor="${i === 0 && big ? 'start' : 'middle'}" class="c-tick">${lab}</text>`);
    }
    o.push(`<text x="${pl}" y="${Ht - 3}" class="c-axis">${big ? 'garden area (doubles each season)' : 'season (the garden doubles each time)'}</text>`);
    const line = (arr, cls, r, labWord) => {
      if (!arr.length) return;
      o.push(`<polyline points="${arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" class="${cls}"/>`);
      arr.forEach((v, i) => o.push(`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${r}" class="${cls}-pt"><title>Season ${i + 1} · ${m2(PLOT_M2 * sizeOf(i + 1))} · ${perFmt(v)} h per m²${labWord ? ' ' + labWord : ''}</title></circle>`));
      const j = arr.length - 1;
      let ly = Y(arr[j]) + (cls === 'c-all' ? -6 : 12);
      if (Math.abs(ly - 4 - Y(1)) < 9) ly = arr[j] >= 1 ? Y(1) - 7 : Y(1) + 15;
      o.push(`<text x="${X(j) + 8}" y="${ly}" class="c-val">${perFmt(arr[j])} h</text>`);
    };
    if (withHidden) line(alls, 'c-all', 3, 'with the hidden roots');
    line(vals, 'c-line', 4.5, '');
    o.push('</svg>');
    return o.join('');
  }
  function drawChart() { $id('chart').html(chartSVG(false, false)); }

  // ---------- A season ----------
  function sprout() {
    const s = S.season, N = sizeOf(s), area = PLOT_M2 * N;
    const byKind = {};
    VIS.forEach(r => { byKind[r.key] = weedsOf(r, N); });
    const weeds = VIS.reduce((a, r) => a + byKind[r.key], 0);
    const need = H_PER_WEED * weeds, have = H_PER_M2 * area;
    const rootsNew = HID ? weedsOf(HID, N) : 0;
    S.roots += rootsNew;
    const h = {
      s, N, area, byKind, weeds, need, have, rootsNew,
      perM2: need / area, perM2All: (need + H_PER_WEED * rootsNew) / area, wildAfter: 0
    };
    S.hist.push(h);
    setHours(h, 0);
    setFacts();
    return plantWeeds(h).then(() => {
      setFacts();
      setTrend(S.hist.length - 1);
      drawChart();
      const intro = s === 1 ? `Season 1. Your garden is ${m2(area)}, so you have ${hours(have)}. ` : `Season ${s}. The garden doubled to ${m2(area)}: you have ${hours(have)}. `;
      const short = need > have ? ` <b class="bad">That is more than your time.</b>` : '';
      story(`${intro}<b>${A.num(weeds)}</b> weeds sprouted: weeding them takes <b>${hours(need)}</b>.${short}`);
    });
  }

  function weed() {
    if (S.busy) return;
    S.busy = true;
    setButtons('busy');
    const h = S.hist[S.hist.length - 1];
    const p = Math.min(1, h.have / h.need);
    const target = Math.max(S.wild, Math.round((1 - p) * S.plots.length));
    const farmed = S.plots.filter(q => !q.wild);
    const goners = shuffle(farmed.slice()).sort((a, b) => b.icons.length - a.icons.length).slice(0, Math.max(0, target - S.wild));
    const kept = farmed.filter(q => goners.indexOf(q) < 0).sort((a, b) => a.r - b.r || a.c - b.c);
    const icons = [];
    kept.forEach(q => { icons.push(...q.icons); q.icons = []; });
    const spread = A.T(1300);
    A.tween(0, Math.min(h.need, h.have), spread + A.T(380), 'linear', v => setHours(h, v));
    pullIcons(icons, spread, true).then(() => {
      if (!goners.length) return null;
      const gs = goners.map(goWild);
      const left = [];
      goners.forEach(q => { left.push(...q.icons); q.icons = []; });
      pullIcons(left, A.T(300), false);
      S.wild += goners.length;
      return A.tween(0, 1, A.T(900), 'easeOutCubic', t => gs.forEach(g => g.setAttribute('opacity', t.toFixed(2))));
    }).then(() => {
      h.wildAfter = S.wild;
      setFacts();
      const used = Math.min(h.need, h.have);
      let msg;
      if (h.need <= h.have) {
        msg = `All weeds pulled, in ${hours(used)} of your ${hours(h.have)}.`;
        if (HID && S.season === 1) msg += ` But weeding only pulls what you can see. <span class="hint">Something else grows under the soil.</span>`;
      } else if (goners.length) {
        msg = `<b class="bad">Not enough time.</b> You pulled ${Math.round(100 * p)}% of the weeds. The rest took over ${goners.length} plot${goners.length > 1 ? 's' : ''}: that ground is lost.`;
      } else {
        msg = `You were ${hours(h.need - h.have)} short. A few weeds escaped, not enough yet to take a plot.`;
      }
      if (S.season >= SEASONS) msg += ' That was the last season.';
      else if (HID && S.digs > 0 && S.season >= DIG_FROM && S.dugIn !== S.season) msg += ` You can dig deep for hidden roots (${S.digs} left), or extend the garden.`;
      story(msg);
      S.busy = false;
      S.phase = 'weeded';
      setButtons('weeded');
      focusEl('btn-next');
    });
  }

  function placeRoots(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = S.plots[Math.floor(Math.random() * S.plots.length)];
      const u = place(svgEl('use', { href: '#w-root', class: 'root' }), p.c * CELL + A.rand(18, 82), p.r * CELL + A.rand(18, 72), A.rand(.85, 1.2));
      u.style.animation = `g-sprout ${A.T(420)}ms ${Math.round(A.rand(0, A.T(700)))}ms both`;
      gRoots.appendChild(u);
      out.push(u);
    }
    return out;
  }
  const showUnder = (on, ms) => A.tween(+gUnder.getAttribute('opacity'), on ? 1 : 0, ms, 'easeInOutCubic', t => gUnder.setAttribute('opacity', t.toFixed(2)));

  function dig() {
    if (S.busy || !HID || S.digs <= 0) return;
    S.busy = true;
    const phase = S.phase;
    setButtons('busy');
    S.digs--;
    S.dugIn = S.season;
    const before = S.roots, found = Math.round(FIND * before);
    S.roots -= found;
    S.rootsFound += found;
    S.digLog.push({ s: S.season, found });
    const shown = A.clamp(Math.round(found / ROOT_K), found > 0 ? 1 : 0, MAX_ROOTS);
    story(`Digging deep, under the soil…`);
    let icons;
    showUnder(true, A.T(600)).then(() => {
      icons = placeRoots(shown);
      return A.wait(A.T(700) + A.T(420));
    }).then(() => {
      story(MEAS
        ? `You dug deep and pulled out <b>${A.num(found)}</b> hidden roots (about ${Math.round(FIND * 100)}%). New ones keep growing. <span class="hint">${measuredDigLine()}</span>`
        : `You dug deep and found <b>${A.num(found)}</b> hidden roots, about ${Math.round(FIND * 100)}% of them. They are pulled out now. The rest stay hidden, and new roots keep growing.`);
      setFacts();
      return A.wait(A.T(1700));
    }).then(() => pullIcons(shuffle(icons), A.T(700), true))
      .then(() => showUnder(false, A.T(500)))
      .then(() => {
        S.busy = false;
        setButtons(phase);
      });
  }

  function extend() {
    if (S.busy) return;
    if (S.season >= SEASONS) { finish(); return; }
    S.busy = true;
    setButtons('busy');
    S.season++;
    const s = S.season;
    sizeUnder(s);
    const go = s === 1 ? A.wait(0) : zoomTo(viewFor(s), A.T(800));
    story(s === 1 ? 'Planting…' : `Extending the garden to ${m2(PLOT_M2 * sizeOf(s))}…`);
    go.then(() => growPlots(s)).then(sprout).then(() => {
      S.busy = false;
      S.phase = 'sprouted';
      setButtons('sprouted');
      focusEl('btn-weed');
    });
  }

  // ---------- The measured world: what the data say about hidden behaviors ----------
  const BD = MEAS && HID && HID.measured ? HID.measured : null;
  // One size of one arm (with or without the trigger): removed after n lessons, not removed after `lo`
  // (finished), or still running. The data point of that size says whether a run is still going.
  function sizeStatus(rec, label) {
    const row = ((rec && rec.per_size) || []).find(([k]) => k === label);
    if (!row) return { kind: 'none' };
    const v = String(row[1]).trim();
    if (/^\d+$/.test(v)) return { kind: 'fixed', n: +v };
    const b = parseFloat(label);
    const pts = ((rec && rec.points) || []).filter(p => p.kind === 'right');
    const pt = pts.length && b > 0 ? pts.reduce((a, p) => (Math.abs(Math.log(p.size_b / b)) < Math.abs(Math.log(a.size_b / b)) ? p : a)) : null;
    const lo = pt ? pt.lo : (BD && BD.d_max) || null;
    return pt && pt.running ? { kind: 'running', lo } : { kind: 'never', lo };
  }
  function perSizeFacts(rec) {
    const rows = (rec && rec.per_size) || [];
    const st = rows.map(([k]) => sizeStatus(rec, k));
    const vals = st.filter(x => x.kind === 'fixed').map(x => x.n);
    return {
      rows, fixed: vals.length, never: st.filter(x => x.kind === 'never').length, running: st.filter(x => x.kind === 'running').length,
      min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null
    };
  }
  function measuredDigLine() {
    if (!BD) return '';
    const t = perSizeFacts(BD.targeted), b = perSizeFacts(BD.blind);
    const tRange = t.min != null ? (t.min === t.max ? A.num(t.min) : `${A.num(t.min)} to ${A.num(t.max)}`) : '?';
    return `On real models, a planted backdoor went away in ${tRange} lessons when we knew its trigger (where to dig). ` +
      `Without the trigger, it stayed at ${b.never} of ${b.never + b.fixed} model sizes${b.running ? ` (${b.running} still running)` : ''}.`;
  }

  // ---------- The end ----------
  function finish() {
    if (S.busy) return;
    if (S.done) { openEnd(); return; }
    S.busy = true;
    setButtons('busy');
    if (HID && S.roots > 0) {
      story(`Last look under the soil: the roots nobody found…`);
      gRoots.textContent = '';
      showUnder(true, A.T(700)).then(() => {
        placeRoots(A.clamp(Math.round(S.roots / ROOT_K), 1, MAX_ROOTS));
        return A.wait(A.T(1500));
      }).then(done);
    } else done();
    function done() {
      S.done = true;
      S.busy = false;
      setButtons('end');
      story(HID ? `Under the soil, <b>${A.num(S.roots)}</b> roots were still hiding. Here is the verdict.` : 'Here is the verdict.');
      $id('chip-roots').text(`Hidden roots left: ${A.num(S.roots)}`);
      $id('f-roots').text(`${A.num(S.roots)} left`);
      buildEnd();
      openEnd();
    }
  }

  function openEnd() {
    $id('end').prop('hidden', false);
    $('body').addClass('modal-open');
    $id('end-dialog').scrollTop(0);
    focusEl('end-title');
  }
  function closeEnd() {
    $id('end').prop('hidden', true);
    $('body').removeClass('modal-open');
    focusEl('btn-next');
  }

  function buildEnd() {
    const H = S.hist, h0 = H[0], h1 = H[H.length - 1];
    const gGrow = h1.area / h0.area, wGrow = h1.need / h0.need;
    const e = Math.log(wGrow) / Math.log(gGrow);
    const v = L.verdictOf(e);
    const lostPct = Math.round(100 * S.wild / S.plots.length);
    const SENT = {
      helps: ['slower than', 'scaling helps'],
      balance: ['about as fast as', 'it keeps pace'],
      debt: ['faster than', 'alignment debt']
    }[v];
    const head = MEAS
      ? `With the rates measured on real models, weeding grew ${SENT[0]} the garden: ${SENT[1]}.`
      : `In this world, weeding grew ${SENT[0]} the garden: ${SENT[1]}.`;
    const why = {
      helps: `Your time grew ${times(gGrow)} with the garden; weeding grew only ${times(wGrow)}. Each m² needed less and less work.`,
      balance: `Your time grew ${times(gGrow)} with the garden; weeding grew ${times(wGrow)}, close to it. Each m² needed about the same work.`,
      debt: `Your time grew ${times(gGrow)} with the garden, but weeding grew ${times(wGrow)}. ${lostPct ? `You ran out of time, and weeds took over ${lostPct}% of the ground.` : 'Each m² needed more and more work.'}`
    }[v];
    const ifWorld = MEAS ? (W.provisional ? 'If these provisional measurements hold,' : 'If these measurements hold beyond this pilot,') : 'If AI worked like this,';
    const meaning = {
      helps: 'If AI worked like this, keeping bigger models safe would get relatively cheaper: the safety budget would go further at each size.',
      balance: 'If AI worked like this, keeping bigger models safe would cost a steady share of the budget: no better, no worse.',
      debt: 'If AI worked like this, the safety work would outgrow the budget. A bigger model would lose more and more of its ability to corrections: the wild ground.'
    }[v].replace('If AI worked like this,', ifWorld);

    const stats = [
      ['Garden', m2(h1.area), `from ${m2(h0.area)} · ${times(gGrow)}`],
      ['Weeding time', hours(h1.need), `from ${hours(h0.need)} · ${times(wGrow)}`],
      ['Hours per m²', `${perFmt(h1.perM2)} h`, `from ${perFmt(h0.perM2)} h · ${times(h1.perM2 / h0.perM2)}`],
      ['Ground lost', lostPct ? m2(S.wild * PLOT_M2) : 'none', `${lostPct}% of the garden`]
    ];
    if (HID) stats.push(['Hidden roots left', A.num(S.roots), S.rootsFound ? `${A.num(S.rootsFound)} dug out` : 'never dug']);

    const o = [];
    o.push(`<div class="end-top"><p class="dialog-kicker">The garden · ${esc(W.name)} (${esc(W.tag)})${MEAS && W.provisional ? ' · <span class="prov">provisional</span>' : ''}</p>
      <button id="btn-close" type="button" class="btn-ghost">See the garden</button></div>`);
    o.push(`<h2 id="end-title" class="end-verdict v-${v}" tabindex="-1">${esc(head)}</h2>`);
    o.push(`<p class="end-why">${esc(why)}</p>`);
    o.push(`<div class="end-stats">${stats.map(([k, a, b]) => `<div><span class="label">${k}</span><strong>${a}</strong><small>${b}</small></div>`).join('')}</div>`);
    o.push(`<div class="end-chart"><div class="end-chart-key"><span><i class="k-line"></i>Weeding hours per m² (weeds you could see)</span>${HID ? '<span><i class="k-all"></i>Counting the hidden roots too</span>' : ''}<span><i class="k-budget"></i>Your time: 1 h per m²</span></div>${chartSVG(window.matchMedia('(min-width: 640px)').matches, !!HID)}</div>`);
    if (MEAS) o.push(measuredCaveat());
    o.push(`<p class="end-meaning"><b>What it means.</b> The garden is an AI model, its area is the model's size, and your time is the safety budget, which grows with the model. ${esc(meaning)}</p>`);
    if (HID) {
      o.push(`<p class="end-meaning"><b>The hidden roots</b> are flaws you cannot see, like a model that ${esc(HID.plain)}. The chart only counted the weeds you could see; the dashed line adds the roots. ${S.rootsFound ? `Digging deep found ${A.num(S.rootsFound)} of them, but roots kept coming back.` : 'You never dug, so you never saw them.'}</p>`);
    }

    // Per-weed table
    o.push(`<h3 class="end-h">Weed by weed</h3>`);
    o.push(`<table class="end-table"><thead><tr><th>Weed</th><th>What it stands for</th><th>${MEAS ? 'Measured exponent α (range)' : 'Exponent α'}</th><th>Verdict</th>${MEAS ? '<th>Source</th>' : ''}</tr></thead><tbody>`);
    RISKS.forEach(r => {
      const m = r.measured;
      let ex, verdict;
      if (MEAS) {
        if (r.fitted) {
          const ci = m.ci_simultaneous || m.ci;
          ex = `<b>${expFmt(m.alpha)}</b>${ci ? ` <small>(${expFmt(ci[0])} to ${expFmt(ci[1])})</small>` : ''}`;
          verdict = m.verdict === 'undetermined' ? 'undetermined: the range spans more than one verdict' : esc(m.verdict);
        } else {
          ex = `<span class="muted">not measured yet</span> <small>(too few model sizes; the game uses 1)</small>`;
          verdict = '<span class="muted">not measured yet</span>';
        }
      } else {
        ex = `<b>${expFmt(r.exponent)}</b>`;
        const k = L.verdictOf(r.exponent);
        verdict = `${{ helps: 'spreads slower than the garden', balance: 'keeps pace with the garden', debt: 'spreads faster than the garden' }[k]} <small>(${L.VERDICT_NAME[k]})</small>`;
      }
      o.push(`<tr><td data-label="Weed"><span class="t-weed">${iconSVG(r.hidden ? 'root' : r.key, 't-icon')}<b>${esc(r.name)}</b></span>${r.hidden ? '<small class="muted">hidden roots</small>' : ''}</td>
        <td data-label="What it stands for">${esc(r.plain)}</td><td data-label="Exponent">${ex}</td><td data-label="Verdict">${verdict}</td>
        ${MEAS ? `<td data-label="Source"><small>${m ? esc(m.source || '') + (m.sizes ? `<br>${esc(m.sizes)}` : '') : 'not measured yet'}</small></td>` : ''}</tr>`);
    });
    o.push('</tbody></table>');
    o.push(MEAS
      ? `<p class="end-note">An exponent below 0.9: the flaw gets cheaper to fix relative to the model (scaling helps). From 0.9 to 1.1: it keeps pace. Above 1.1: alignment debt. Ranges are simultaneous confidence intervals. A verdict needs the whole range on one side. How common each weed is in the garden is illustrative.</p>`
      : `<p class="end-note">An exponent below 0.9: the weed spreads slower than the garden (scaling helps). From 0.9 to 1.1: it keeps pace. Above 1.1: alignment debt. In this angle the exponents are ${esc(W.tag)} plus a fixed shift per weed, as in the paper's toy model: illustrative, not estimates. Over time the fastest-growing weed takes over the work.</p>`);
    if (BD) o.push(backdoorBlock());

    // Navigation
    o.push(`<div class="end-nav"><span class="label">Play another angle</span><div class="end-angles">${L.ANGLES.map(k => {
      const w = L.WORLDS[k];
      const off = k === 'measured' && !w.available;
      return `<a class="angle a-${k}${k === WORLD ? ' on' : ''}${off ? ' off' : ''}" ${off ? 'aria-disabled="true"' : `href="${L.link('garden.html', k)}"`}${k === WORLD ? ' aria-current="page"' : ''}><strong>${esc(w.name)}</strong><span>${esc(w.tag)}${k === WORLD ? ' · again' : ''}</span></a>`;
    }).join('')}</div><a class="back end-back" href="${L.link('index.html')}">← All games</a></div>`);

    $id('end-dialog').html(o.join(''));
    $id('btn-close').on('click', closeEnd);
  }

  function measuredCaveat() {
    const firm = RISKS.filter(r => r.fitted && r.measured.verdict !== 'undetermined');
    const open = RISKS.filter(r => r.fitted && r.measured.verdict === 'undetermined');
    const notYet = RISKS.filter(r => !r.fitted);
    const names = a => a.map(r => r.name.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1');
    let t = `<p class="end-meaning caveat"><b>Careful: ${W.provisional ? 'provisional' : 'a pilot'}.</b> `;
    if (firm.length) t += `Only ${names(firm)} gave a clear answer (${esc(firm.map(r => r.measured.verdict).filter((x, i, a) => a.indexOf(x) === i).join(', '))}). `;
    if (open.length) t += `For ${names(open)}, the measurements are too uncertain to decide. `;
    if (notYet.length) t += `The ${names(notYet)} ${notYet.length > 1 ? 'have' : 'has'} no exponent yet (too few model sizes), so the game makes ${notYet.length > 1 ? 'them' : 'it'} grow exactly like the garden. `;
    t += `The overall trend also depends on how common each weed is, and that mix is illustrative. Results generated ${esc(W.generated || '')}.</p>`;
    return t;
  }

  function backdoorBlock() {
    const t = perSizeFacts(BD.targeted), b = perSizeFacts(BD.blind);
    const sizes = [];
    t.rows.concat(b.rows).forEach(([k]) => { if (sizes.indexOf(k) < 0) sizes.push(k); });
    const cell = (rec, k) => {
      const x = sizeStatus(rec, k);
      if (x.kind === 'fixed') return `<span class="ok">removed: ${A.num(x.n)} lessons</span>`;
      if (x.kind === 'never') return `<span class="bad">not removed${x.lo ? ` after ${A.num(x.lo)}` : ''}</span>`;
      if (x.kind === 'running') return `<span class="muted">still running${x.lo ? ` (not removed after ${A.num(x.lo)} so far)` : ''}</span>`;
      return '<span class="muted">–</span>';
    };
    const tDone = t.fixed + t.never, bDone = b.fixed + b.never;
    const withT = t.fixed === tDone && tDone ? 'removed it quickly at every size tried' : `removed it at ${t.fixed} of ${tDone} sizes`;
    const without = b.never > b.fixed ? `it mostly failed: the roots stayed at ${b.never} of ${bDone} sizes` : `it worked at ${b.fixed} of ${bDone} sizes`;
    const ci = BD.ci_simultaneous || BD.ci;
    const exp = BD.alpha != null
      ? `With the trigger, the cost of removing it (lessons × model size) grew as size^${expFmt(BD.alpha)}${ci && ci[0] != null ? ` (range ${expFmt(ci[0])} to ${expFmt(ci[1])})` : ''}: ${esc(BD.verdict || 'undetermined')}. The game grows the hidden roots with this exponent.`
      : 'Too few sizes for an exponent yet: the game uses 1.';
    return `<h3 class="end-h">What the data show about hidden behaviors</h3>
      <p class="end-meaning">We planted a hidden behavior in real models: it only shows up when a secret trigger appears (a backdoor). Then we tried to train it away, counting the lessons (training examples) needed.
      <b>Knowing the trigger</b>, like knowing where to dig, ${withT}. <b>Without the trigger</b>, ${without}${b.running ? ` (${b.running} still running)` : ''}.</p>
      <table class="end-table bd-table"><thead><tr><th>Model size (parameters)</th><th>Knowing the trigger</th><th>Without the trigger</th></tr></thead><tbody>
      ${sizes.map(k => `<tr><td><b>${esc(k)}</b></td><td>${cell(BD.targeted, k)}</td><td>${cell(BD.blind, k)}</td></tr>`).join('')}
      </tbody></table>
      <p class="end-note">${exp} ${esc(BD.source || '')}${BD.sizes ? ` · ${esc(BD.sizes)}` : ''}.</p>`;
  }

  // The hidden risk's color drives the roots' UI (chip, dig button, legend, chart)
  function rootColors() {
    if (!HID || !/^#[0-9a-f]{6}$/i.test(HID.color)) return;
    const rgb = [1, 3, 5].map(i => parseInt(HID.color.slice(i, i + 2), 16));
    const st = document.documentElement.style;
    st.setProperty('--root', HID.color);
    st.setProperty('--root-rgb', rgb.join(', '));
    st.setProperty('--root-text', `rgb(${rgb.map(v => Math.round(v + (255 - v) * .6)).join(', ')})`);
  }

  // ---------- Start ----------
  function init() {
    rootColors();
    buildHeader();
    $id('field').html(fieldSVG());
    svg = document.getElementById('g-svg');
    gPlots = document.getElementById('g-plots');
    gWeeds = document.getElementById('g-weeds');
    gUnder = document.getElementById('g-under');
    gRoots = document.getElementById('g-roots');
    xray = document.getElementById('g-xray');
    setView(viewFor(1));
    sizeUnder(1);
    buildLegend();
    buildIntro();
    $id('f-roots-row').prop('hidden', !HID);
    $id('legend').addClass(`n${RISKS.length}`);
    if (MEAS) $id('meter-note').text('Your time is 1 hour per m² each season. Above that, the weeds win. Weeds here spread at the measured rates.');
    drawChart();
    setButtons('busy');

    $id('btn-start').on('click', () => {
      $id('intro').prop('hidden', true);
      $('body').removeClass('modal-open');
      extend();
    });
    $id('btn-weed').on('click', weed);
    $id('btn-dig').on('click', dig);
    $id('btn-next').on('click', extend);
    $(document).on('keydown', e => { if (e.key === 'Escape' && !$id('end').prop('hidden')) closeEnd(); });
    $('body').addClass('modal-open');
    $id('btn-start').prop('disabled', false);
    focusEl('btn-start');
  }

  $(init);
})(jQuery, window.Align);
