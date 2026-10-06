/* =========================================================
   Game A, "The company": alignment debt as literal debt.

   The player runs an AI company. Each click trains a model twice the size
   (one year). Revenue grows as N (the budget); the safety bill is the sum over
   risks of share × N^exponent (Align.Law), scaled so that the whole bill is 30%
   of revenue in year 1. The hidden risk is never billed: its cost piles up out
   of sight until an audit finds most (not all) of it.
   Needs jQuery, js/core.js, js/measured.js, js/law.js.
   ========================================================= */
(function ($, A) {
  'use strict';

  const L = A.Law;
  const T = A.T;
  const WORLD = L.fromURL('balance');
  const W = L.WORLDS[WORLD];
  const MEASURED = WORLD === 'measured';
  const RISKS = L.risks(WORLD);
  const SEEN = RISKS.filter(r => !r.hidden);
  const HIDDEN = RISKS.filter(r => r.hidden);
  const HID = HIDDEN[0] || null;

  const YEARS = 8;            // year 1 at size ×1, then 7 trainings (×2 each): ×128 in year 8
  const R0 = 10e6;            // revenue per year of the first model
  const START_SHARE = .30;    // the whole bill (seen + hidden) is 30% of revenue in year 1
  const K = START_SHARE * R0; // the shares sum to 1, so Σ amount(risk, 1) = 1
  const AUDITS = 2;
  const FIND = [.75, .85];    // an audit finds about 80% of what is hidden
  const PARAMS0 = .5;         // billions of parameters of the first model (about the range measured)

  // ---------- Formats ----------
  const money = n => `${n < 0 ? '−' : ''}$${A.short(Math.abs(n))}`;
  const pct = s => {
    const p = s * 100;
    return `${p < 10 ? p.toFixed(1).replace(/\.0$/, '') : Math.round(p)}%`;
  };
  const fx = f => `×${f >= 10 ? A.num(f) : f.toFixed(1).replace(/\.0$/, '')}`;
  const exp2 = e => String(Math.round(e * 100) / 100);
  const params = N => {
    const b = PARAMS0 * N;
    return `${b < 1 ? b : A.num(b)} billion parameters`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const listOr = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')}, or ${xs[xs.length - 1]}`);

  // ---------- The economics ----------
  function books(N) {
    const cost = {};
    let seen = 0, hidden = 0;
    RISKS.forEach(r => {
      const c = K * L.amount(r, N);
      cost[r.key] = c;
      if (r.hidden) hidden += c; else seen += c;
    });
    const revenue = R0 * N;
    return { N, revenue, cost, seen, hidden, share: seen / revenue, trueShare: (seen + hidden) / revenue };
  }

  // The share of revenue, compared with year 1: below 0.8× falling, above 1.25× rising
  const trendOf = ratio => (ratio < .8 ? 'helps' : ratio > 1.25 ? 'debt' : 'balance');
  const TREND = {
    helps: { arrow: '↘', word: 'Falling', line: 'safety is getting cheaper relative to the business.' },
    balance: { arrow: '→', word: 'Flat', line: 'safety keeps pace with the business.' },
    debt: { arrow: '↗', word: 'Rising', line: 'safety is getting dearer relative to the business. That is alignment debt.' }
  };
  // Per doubling: the bill grows ×2^exponent; 2^0.9 and 2^1.1 bound "about as fast"
  const paceOf = f => (f < Math.pow(2, .9) ? 'slower' : f > Math.pow(2, 1.1) ? 'faster' : 'same');

  const S = {
    year: -1, rows: [], bank: 0, pool: 0, found: 0, hiddenTotal: 0,
    auditsLeft: AUDITS, audits: [], busy: true, ended: false,
    lossSeen: false, redSeen: false, nudged: false
  };
  const shown = { revenue: 0, bill: 0, profit: 0, bank: 0 };
  const shownRisk = {};

  // ---------- Header ----------
  function header() {
    $('#brand, #back').attr('href', L.link('index.html'));
    const $pill = $('#world-pill').addClass(`w-${WORLD}`).append($('<b></b>').text(W.name), document.createTextNode(` · ${W.tag}`));
    if (MEASURED && W.provisional) $pill.append(' · ', $('<span class="prov">provisional</span>'));
    const $nav = $('#angles');
    L.ANGLES.forEach(k => {
      const w = L.WORLDS[k];
      const $a = $('<a></a>').addClass(`a-${k}`).text(w.name).attr('href', L.link('money.html', k)).attr('title', `${w.name} · ${w.tag}`);
      if (k === WORLD) $a.addClass('on').attr('aria-current', 'page');
      if (k === 'measured' && !w.available) $a.addClass('off').removeAttr('href').attr('aria-disabled', 'true');
      $nav.append($a);
    });
    document.title = `The company · ${W.name} · Alignment`;
  }

  // ---------- The building (SVG) ----------
  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  const GROUND = 190, FLOOR_H = 19;
  const B = { svg: document.getElementById('building'), floors: 0 };
  function buildBuilding() {
    const s = B.svg;
    const defs = svgEl('defs', {}, s);
    const g = svgEl('linearGradient', { id: 'basementGrad', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svgEl('stop', { offset: '0%', 'stop-color': '#b48cff', 'stop-opacity': '.08' }, g);
    svgEl('stop', { offset: '100%', 'stop-color': '#b48cff', 'stop-opacity': '.55' }, g);
    B.basement = svgEl('rect', { class: 'basement', x: 45, y: GROUND + 3, width: 110, height: 34, rx: 3, opacity: .3 }, s);
    B.q = svgEl('text', { class: 'basement-q', x: 100, y: GROUND + 28 }, s);
    B.q.textContent = '?';
    svgEl('line', { class: 'ground', x1: 8, y1: GROUND + 1, x2: 192, y2: GROUND + 1 }, s);
    // the floors still to build: one per year to come
    const ghosts = svgEl('g', { class: 'ghosts' }, s);
    for (let i = 0; i < YEARS; i++) svgEl('rect', { x: 45, y: GROUND - FLOOR_H * (i + 1), width: 110, height: FLOOR_H - 1, rx: 1.5 }, ghosts);
    B.floorsG = svgEl('g', {}, s);
    B.sign = svgEl('g', { class: 'roof-sign' }, s);
    svgEl('rect', { x: 68, y: 0, width: 64, height: 16, rx: 3 }, B.sign);
    const t = svgEl('text', { x: 100, y: 11.5, 'text-anchor': 'middle' }, B.sign);
    t.textContent = 'AI CO.';
    B.signY = GROUND - 22;
    B.sign.setAttribute('transform', `translate(0,${B.signY})`);
    addFloor(0);
  }
  function addFloor(dur) {
    const i = B.floors++;
    const top = GROUND - FLOOR_H * (i + 1);
    const f = svgEl('g', { class: 'floor' }, B.floorsG);
    svgEl('rect', { class: 'wall', x: 45, y: top, width: 110, height: FLOOR_H - 1, rx: 1.5 }, f);
    for (let j = 0; j < 5; j++) svgEl('rect', { class: 'win', x: 52 + j * 20, y: top + 5, width: 12, height: 8, rx: 1 }, f);
    const fromSign = B.signY, toSign = top - 22;
    B.signY = toSign;
    if (!dur) {
      B.sign.setAttribute('transform', `translate(0,${toSign})`);
      return $.when();
    }
    f.setAttribute('opacity', 0);
    return A.tween(0, 1, dur, 'easeOutBack', p => {
      f.setAttribute('transform', `translate(0,${-(1 - p) * 26})`);
      f.setAttribute('opacity', A.clamp(p * 1.6, 0, 1));
      B.sign.setAttribute('transform', `translate(0,${A.lerp(fromSign, toSign, Math.min(1, p))})`);
    });
  }
  function basementGlow() {
    const r = S.rows[S.year];
    const o = r ? A.clamp(.25 + S.pool / r.revenue, .25, 1) : .25;
    $(B.basement).stop().animate({ opacity: o }, T(600));
  }

  // ---------- Share bars (one per year) ----------
  const $bars = $('#share-bars');
  function buildShareBars() {
    for (let i = 0; i < YEARS; i++) $bars.append($('<div class="sb"><i></i><span></span></div>'));
    $bars.append($('<div class="ref start"></div>'), $('<div class="ref full" hidden></div>'));
  }
  function drawShareBars(dur) {
    const rows = S.rows;
    if (!rows.length) return;
    const top = Math.max(.5, ...rows.map(r => r.share * 1.18));
    const base = rows[0].share;
    rows.forEach((r, i) => {
      const $sb = $bars.children('.sb').eq(i);
      const t = trendOf(r.share / base);
      $sb.attr('class', `sb t-${i ? t : 'balance'}`);
      const h = A.clamp(r.share / top * 100, 1, 100);
      $sb.children('i').stop().animate({ height: `${h}%` }, dur, 'easeOutCubic');
      const $s = $sb.children('span').text(pct(r.share).replace('%', ''));
      const small = h < 22;
      $s.toggleClass('out', small).css('bottom', small ? `calc(${h}% + 2px)` : '3px');
    });
    $bars.children('.ref.start').css('bottom', `${base / top * 100}%`);
    $bars.children('.ref.full').prop('hidden', top < 1.02).css('bottom', `${Math.min(1, 1 / top) * 100}%`);
    $('#key-full').prop('hidden', top < 1.02);
  }

  // ---------- Risk rows ----------
  function buildRisks() {
    const $ul = $('#risk-list');
    RISKS.forEach(r => {
      shownRisk[r.key] = 0;
      const $li = $('<li class="risk"></li>').attr('data-key', r.key).toggleClass('is-hidden', r.hidden);
      $li[0].style.setProperty('--c', r.color);
      const $head = $('<div class="risk-head"></div>').append(
        $('<span class="dot"></span>'),
        $('<span class="risk-name"></span>').text(r.name),
        $('<span class="risk-amt"></span>').text(r.hidden ? 'not on the bill' : '$0'),
        $('<span class="risk-plain"></span>').text(r.plain)
      );
      $li.append($head, $('<div class="risk-bar"><div class="risk-fill"></div></div>'));
      $ul.append($li);
    });
  }
  function drawRisks(dur, revealHidden) {
    const r = S.rows[S.year];
    RISKS.forEach(risk => {
      const $li = $(`#risk-list .risk[data-key="${risk.key}"]`);
      const c = r.cost[risk.key];
      const s = c / r.revenue;
      if (risk.hidden && !revealHidden) return;
      const $amt = $li.find('.risk-amt');
      const from = shownRisk[risk.key];
      shownRisk[risk.key] = c;
      const tail = risk.hidden ? ' hidden' : '';
      A.tween(from, c, dur, 'easeOutCubic', v => $amt.html(`${money(v)}<small>${pct(v / r.revenue)}${tail}</small>`));
      $li.toggleClass('over', s > 1);
      $li.find('.risk-fill').stop().animate({ width: `${A.clamp(s, 0, 1) * 100}%` }, dur, 'easeOutCubic');
    });
  }

  // ---------- Chart (SVG, redrawn on each frame) ----------
  const C = { box: document.getElementById('chart'), yMax: 1, p: 1, showTrue: false };
  function niceCeil(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function chartTarget() {
    let m = 0;
    S.rows.forEach(r => { m = Math.max(m, r.revenue, r.seen, C.showTrue ? r.seen + r.hidden : 0); });
    return niceCeil(m * 1.05);
  }
  function drawChart() {
    const w = C.box.clientWidth, h = C.box.clientHeight;
    if (!w || !h || !S.rows.length) return;
    const narrow = w < 420;
    const pad = { l: narrow ? 44 : 52, r: 10, t: 18, b: 22 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const n = S.rows.length;
    const X = i => pad.l + pw * i / (YEARS - 1);
    const Y = v => pad.t + ph * (1 - v / C.yMax);
    const partial = n > 1 && C.p < 1;
    const xAt = i => (partial && i === n - 1 ? A.lerp(X(i - 1), X(i), C.p) : X(i));
    const vAt = (i, f) => (partial && i === n - 1 ? A.lerp(f(S.rows[i - 1]), f(S.rows[i]), C.p) : f(S.rows[i]));
    const idx = S.rows.map((_, i) => i);
    const rev = idx.map(i => vAt(i, r => r.revenue));
    const bill = idx.map(i => vAt(i, r => r.seen));
    const tru = idx.map(i => vAt(i, r => r.seen + r.hidden));
    const xs = idx.map(xAt);
    const P = (x, v) => `${x.toFixed(1)},${Y(v).toFixed(1)}`;
    const line = vs => `M${vs.map((v, i) => P(xs[i], v)).join('L')}`;
    const area = vs => `${line(vs)}L${xs[n - 1].toFixed(1)},${Y(0)}L${xs[0].toFixed(1)},${Y(0)}Z`;

    let out = '<g class="grid axis">';
    for (let k = 0; k <= 4; k++) {
      const v = C.yMax * k / 4, y = Y(v).toFixed(1);
      out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}"></line>`;
      out += `<text x="${pad.l - 6}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${k ? money(v) : '$0'}</text>`;
    }
    for (let i = 0; i < YEARS; i++) out += `<text x="${X(i).toFixed(1)}" y="${h - 5}" text-anchor="middle">Y${i + 1}</text>`;
    out += '</g>';
    out += `<path class="rev-area" d="${area(rev)}"></path><path class="bill-area" d="${area(bill)}"></path>`;
    // red zone: where the bill is bigger than revenue
    out += `<path class="red-zone" d="${redZone(xs, rev, bill, P)}"></path>`;
    if (C.showTrue) out += `<path class="true-line" d="${line(tru)}"></path>`;
    out += `<path class="rev-line" d="${line(rev)}"></path><path class="bill-line" d="${line(bill)}"></path>`;
    xs.forEach((x, i) => {
      out += `<circle class="pt-rev" cx="${x.toFixed(1)}" cy="${Y(rev[i]).toFixed(1)}" r="3"></circle>`;
      out += `<circle class="pt-bill" cx="${x.toFixed(1)}" cy="${Y(bill[i]).toFixed(1)}" r="3"></circle>`;
    });
    // audits
    S.audits.forEach((a, k) => {
      const x = X(a.year), right = x > w - 110;
      out += `<g class="audit-mark"><line x1="${x}" x2="${x}" y1="${pad.t - 4}" y2="${pad.t + ph}"></line>`;
      out += `<text x="${right ? x - 5 : x + 5}" y="${pad.t + 6 + k * 12}" text-anchor="${right ? 'end' : 'start'}">audit −${money(a.amount)}</text></g>`;
    });
    // value labels on the latest year
    const i = n - 1, x = xs[i];
    let yr = Y(rev[i]) - 8, yb = Y(bill[i]) - 8;
    if (Math.abs(yr - yb) < 13) { if (yb >= yr) yb = yr + 14; else yr = yb + 14; }
    const anchor = x > w - 70 ? 'end' : 'middle';
    out += `<text class="end-label" x="${x.toFixed(1)}" y="${yr.toFixed(1)}" text-anchor="${anchor}" fill="#5ee1ff">${money(rev[i])}</text>`;
    out += `<text class="end-label" x="${x.toFixed(1)}" y="${Math.max(yb, 10).toFixed(1)}" text-anchor="${anchor}" fill="#ffb547">${money(bill[i])}</text>`;
    if (C.showTrue) {
      const yt = Math.max(Y(tru[i]) - 8, 10);
      if (Math.abs(yt - yb) > 12 && Math.abs(yt - yr) > 12) out += `<text class="end-label" x="${x.toFixed(1)}" y="${yt.toFixed(1)}" text-anchor="${anchor}" fill="#b48cff">${money(tru[i])}</text>`;
    }
    C.box.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Revenue and safety bill per year">${out}</svg>`;
  }
  function redZone(xs, rev, bill, P) {
    let d = '', up = [], lo = [];
    const flush = () => {
      if (up.length > 1) d += `M${up.join('L')}L${lo.reverse().join('L')}Z`;
      up = []; lo = [];
    };
    for (let i = 0; i < xs.length; i++) {
      const di = bill[i] - rev[i];
      if (i > 0) {
        const dp = bill[i - 1] - rev[i - 1];
        if ((dp > 0) !== (di > 0)) {
          const t = dp / (dp - di);
          const pt = P(A.lerp(xs[i - 1], xs[i], t), A.lerp(rev[i - 1], rev[i], t));
          up.push(pt); lo.push(pt);
          if (!(di > 0)) flush();
        }
      }
      if (di > 0) { up.push(P(xs[i], bill[i])); lo.push(P(xs[i], rev[i])); }
    }
    flush();
    return d;
  }
  function animateChart(dur, newPoint) {
    const from = C.yMax, to = chartTarget();
    C.p = newPoint ? 0 : 1;
    return A.tween(0, 1, dur, 'easeInOutCubic', v => {
      C.yMax = A.lerp(from, to, v);
      if (newPoint) C.p = v;
      drawChart();
    }).then(() => { C.p = 1; C.yMax = to; drawChart(); });
  }

  // ---------- Books, gauge, story ----------
  function roll(id, key, to, dur) {
    const from = shown[key];
    shown[key] = to;
    const $e = $(`#${id}`);
    return A.tween(from, to, dur, 'easeOutCubic', v => $e.text(money(v)));
  }
  // the compact bank figure of the company card (shown on phones)
  let bankFact = 0;
  function rollBankFact(dur) {
    const from = bankFact;
    bankFact = S.bank;
    return A.tween(from, S.bank, dur, 'easeOutCubic', v => $('#bank-fact').text(money(v)));
  }
  function story(html, kind) {
    $('#story').attr('class', `story${kind ? ` s-${kind}` : ''}`).html(html);
    void document.getElementById('story').offsetWidth;
    $('#story').addClass('flash');
  }
  function drawGauge(dur) {
    const r = S.rows[S.year], first = S.rows[0];
    const t = S.year ? trendOf(r.share / first.share) : 'balance';
    const $g = $('.gauge').removeClass('t-helps t-balance t-debt');
    if (S.year) $g.addClass(`t-${t}`);
    const prev = S.year ? S.rows[S.year - 1].share : 0;
    A.tween(prev, r.share, dur, 'easeOutCubic', v => $('#share').text(pct(v)));
    $('#trend-arrow').text(S.year ? TREND[t].arrow : '');
    $('#trend-words').html(S.year
      ? `<b>${TREND[t].word}</b>: ${TREND[t].line} <span class="muted">(year 1: ${pct(first.share)})</span>`
      : 'Your starting point. Watch this number as the model grows.');
    if (S.year) {
      const q = S.rows[S.year - 1];
      $('#growth').html(`This year: revenue <b>${fx(r.revenue / q.revenue)}</b> · safety bill <b>${fx(r.seen / q.seen)}</b>`);
    } else {
      $('#growth').html(`Revenue <b>${money(r.revenue)}</b> · safety bill <b>${money(r.seen)}</b>`);
    }
    drawShareBars(dur);
  }
  function drawBooks(dur, profitNote) {
    const r = S.rows[S.year];
    roll('revenue', 'revenue', r.revenue, dur);
    roll('bill', 'bill', r.seen, dur);
    roll('profit', 'profit', r.profit, dur);
    $('#profit').toggleClass('red-text', r.profit < 0);
    roll('bank', 'bank', S.bank, dur).then(() => $('.bank, .fact-bank').toggleClass('red', S.bank < 0));
    rollBankFact(dur);
    $('.bank').removeClass('bump');
    void $('.bank')[0].offsetWidth;
    $('.bank').addClass('bump');
    $('#bank-note').text(profitNote);
    $(B.svg).toggleClass('red', S.bank < 0);
    $('#year').text(S.year + 1);
    $('#size').text(`×${A.num(r.N)}`);
    $('#params').text(params(r.N));
    basementGlow();
  }
  function setButtons() {
    const last = S.year >= YEARS - 1;
    const $t = $('#btn-train').prop('disabled', S.busy || S.ended).toggleClass('verdict', last);
    $t.find('.btn-label').text(last ? 'See the verdict' : 'Train a bigger model');
    $t.find('.btn-sub').text(last ? 'the end of the story' : `twice the size · year ${S.year + 2}`);
    $('#btn-audit').prop('disabled', !HID || S.busy || S.ended || S.auditsLeft < 1 || S.year < 1);
    $('#audit-left').html(S.auditsLeft ? `${S.auditsLeft} left<span class="long"> · finds most of what is hidden</span>` : 'none left');
  }

  // ---------- A year ----------
  function bookYear() {
    S.year++;
    const N = Math.pow(2, S.year);
    const r = books(N);
    r.profit = r.revenue - r.seen;
    S.bank += r.profit;
    S.pool += r.hidden;
    S.hiddenTotal += r.hidden;
    r.bank = S.bank;
    S.rows.push(r);
    return r;
  }

  function startGame() {
    if (S.year >= 0) return;
    $('#btn-start').prop('disabled', true);
    $('#intro').fadeOut(T(250));
    const r = bookYear();
    const dur = T(1100);
    drawBooks(dur, `Year 1 profit: +${money(r.profit)}`);
    drawGauge(dur);
    drawRisks(dur);
    animateChart(dur, false);
    story(`<b>Year 1.</b> Your first model earns <b>${money(r.revenue)}</b> a year. Keeping it safe (tests, fixes, people) costs <b>${money(r.seen)}</b>. That is your safety bill: ${pct(r.share)} of revenue. When you are ready, <b>train a bigger model</b>.`);
    A.wait(dur).then(() => {
      S.busy = false;
      setButtons();
      $('#btn-train').trigger('focus');
    });
  }

  function train() {
    if (S.busy || S.ended) return;
    if (S.year >= YEARS - 1) { verdict(); return; }
    S.busy = true;
    setButtons();
    $('#btn-audit').removeClass('nudge');
    story(`Training a model twice the size… <b>${params(Math.pow(2, S.year + 1))}</b>.`);
    addFloor(T(700)).then(() => {
      const q = S.rows[S.year];
      const r = bookYear();
      const dur = T(1100);
      const note = r.profit < 0 ? `This year's loss: ${money(-r.profit)}` : `This year's profit: +${money(r.profit)}`;
      drawBooks(dur, note);
      drawGauge(dur);
      drawRisks(dur);
      animateChart(dur, true);
      return A.wait(dur).then(() => yearStory(q, r));
    }).then(() => {
      S.busy = false;
      setButtons();
      if (!$('#btn-audit').hasClass('nudge') || $('#btn-audit').prop('disabled')) $('#btn-train').trigger('focus');
    });
  }

  function yearStory(q, r) {
    const f = r.seen / q.seen;
    const pace = paceOf(f);
    const t = trendOf(r.share / S.rows[0].share);
    const y = S.year + 1;
    let html = `<b>Year ${y}.</b> Twice the model, twice the revenue: <b>×2</b>. The safety bill grew <b>${fx(f)}</b>: `;
    html += pace === 'slower' ? 'slower than revenue.' : pace === 'faster' ? 'faster than revenue.' : 'about as fast as revenue.';
    let kind = t === 'helps' ? 'good' : t === 'debt' ? 'bad' : '';
    if (r.profit < 0 && !S.lossSeen) {
      S.lossSeen = true;
      html += ` <b>The safety bill is now bigger than revenue.</b> You lose money every year.`;
      kind = 'bad';
    }
    if (S.bank < 0 && !S.redSeen) {
      S.redSeen = true;
      html += ` <b>Your bank is in the red.</b>`;
      kind = 'bad';
    }
    if (y === 3 && S.auditsLeft === AUDITS && HID && !S.nudged) {
      S.nudged = true;
      html += ` Something is missing from the bill: <b>${esc(HID.name)}</b> never shows up on it. Try <b>Order an audit</b>.`;
      $('#btn-audit').addClass('nudge');
      kind = 'hidden';
    }
    if (y === YEARS) {
      html += S.auditsLeft
        ? ` That was the last year. You can still order an audit, or see the verdict.`
        : ` That was the last year. See the verdict.`;
    }
    story(html, kind);
  }

  // ---------- The audit ----------
  function audit() {
    if (!HID || S.busy || S.ended || S.auditsLeft < 1 || S.year < 1) return;
    S.busy = true;
    S.auditsLeft--;
    setButtons();
    $('#btn-audit').removeClass('nudge');
    story(`Auditors are testing the model in ways it does not expect…`, 'hidden');
    $('#hidden-pool').text('searching…');
    $('.hidden-box').removeClass('flash');
    A.wait(T(1300)).then(() => {
      const found = S.pool * A.rand(FIND[0], FIND[1]);
      S.pool -= found;
      S.found += found;
      S.bank -= found;
      S.audits.push({ year: S.year, amount: found });
      const dur = T(900);
      roll('bank', 'bank', S.bank, dur).then(() => $('.bank, .fact-bank').toggleClass('red', S.bank < 0));
      rollBankFact(dur);
      $(B.svg).toggleClass('red', S.bank < 0);
      $('#bank-note').text(`Audit: hidden problems booked, −${money(found)}`);
      $('#hidden-pool').text(`found ${money(found)}`);
      void $('.hidden-box')[0].offsetWidth;
      $('.hidden-box').addClass('flash');
      $('#hidden-note').text(`Audits found ${money(S.found)} so far. The rest is still out of sight, and it keeps growing.`);
      basementGlow();
      animateChart(T(500), false);
      const red = S.bank < 0 && !S.redSeen;
      if (red) S.redSeen = true;
      story(`<b>Hidden problems found: ${money(found)}.</b> The bill was there all along: the model ${esc(HID.plain)}. The audit found most of it, not all. The rest is still out of sight.${red ? ' <b>Your bank is in the red.</b>' : ''}`, red ? 'bad' : 'hidden');
      return A.wait(dur);
    }).then(() => {
      S.busy = false;
      setButtons();
      $('#btn-train').trigger('focus');
    });
  }

  // ---------- The verdict ----------
  const dataVerdict = v => {
    const s = String(v || '').toLowerCase();
    if (s.includes('help')) return ['helps', 'scaling helps'];
    if (s.includes('debt')) return ['debt', 'alignment debt'];
    if (s.includes('pace') || s.includes('balance')) return ['balance', 'keeps pace'];
    if (s.includes('undetermined')) return ['open', W.provisional ? 'not settled yet' : 'not settled'];
    return ['none', 'not measured yet'];
  };

  function verdict() {
    if (S.ended) return;
    S.ended = true;
    S.busy = true;
    setButtons();
    $('body').addClass('ended');
    const first = S.rows[0], last = S.rows[YEARS - 1];
    const revG = last.revenue / first.revenue;
    const billG = (last.seen + last.hidden) / (first.seen + first.hidden);
    const eff = 1 + Math.log2(last.trueShare / first.trueShare) / Math.log2(revG);
    const v = L.verdictOf(eff);
    const lead = MEASURED ? (W.provisional ? 'With the growth rates measured so far' : 'With the measured growth rates') : 'In this world';
    const HEAD = {
      helps: `${lead}, the safety bill grew slower than revenue: <em>scaling helps</em>.`,
      balance: `${lead}, the safety bill grew about as fast as revenue: <em>safety keeps pace</em>.`,
      debt: `${lead}, the safety bill grew faster than revenue: <em>alignment debt</em>.`
    };
    const trueBank = S.bank - S.pool;

    const $end = $('#end').empty().attr('class', `end v-${v}`);
    $end.append(
      $('<p class="end-kicker"></p>').text(`The verdict · ${W.name} · `).append($('<span class="tag"></span>').text(`${W.tag}${MEASURED && W.provisional ? ' · provisional' : ''}`)),
      $('<h2 id="end-title"></h2>').html(HEAD[v]),
      $('<p class="end-sub"></p>').html(`In ${YEARS} years your model grew <b>${fx(revG)}</b>, and so did revenue. The safety bill, hidden problems included, grew <b>${fx(billG)}</b>. Its share of revenue went from <b>${pct(first.trueShare)}</b> to <b>${pct(last.trueShare)}</b>.${MEASURED ? ` ${settledLine()}` : ''}`)
    );

    const stat = (cls, label, value, note) => $('<div class="stat-box"></div>').addClass(cls).append(
      $('<span class="label"></span>').text(label), $('<strong></strong>').text(value), $('<small></small>').text(note));
    $end.append($('<div class="end-stats"></div>').append(
      stat('c-acc', 'Revenue grew', fx(revG), `from ${money(first.revenue)} to ${money(last.revenue)} a year`),
      stat('c-bill', 'Safety bill grew', fx(billG), `from ${money(first.seen + first.hidden)} to ${money(last.seen + last.hidden)} a year, hidden part included`),
      stat(S.bank < 0 ? 'c-hot' : 'c-ok', 'Bank, as you saw it', money(S.bank), S.found ? `after ${money(S.found)} found by audits` : 'no audit ordered'),
      stat(trueBank < 0 ? 'c-hot' : 'c-ok', 'True bank', money(trueBank), `once the ${money(S.pool)} never found is paid`)
    ));

    if (HID) {
      const share = S.hiddenTotal ? S.found / S.hiddenTotal : 0;
      const what = S.found
        ? `Audits found <b>${money(S.found)}</b> (${pct(share)}). <b>${money(S.pool)}</b> was never found.`
        : `You ordered no audit: all <b>${money(S.pool)}</b> stayed out of sight until now.`;
      $end.append($('<p class="lesson"></p>').html(`<b>What you don't see still costs.</b> ${esc(HID.name)} (the model ${esc(HID.plain)}) never showed up on the bill, yet it cost <b>${money(S.hiddenTotal)}</b> over ${YEARS} years. ${what} An audit can only find some of it.`));
    }

    $end.append($('<h3></h3>').text('Risk by risk'));
    $end.append(riskTable(revG));
    $end.append($('<p class="end-note"></p>').html(MEASURED ? measuredNote() : hypoNote()));

    // Play another angle · play again · all games
    const $nav = $('<div class="end-nav"></div>').append($('<span class="label">Play another angle</span>'));
    L.ANGLES.forEach(k => {
      const w = L.WORLDS[k];
      const $a = $('<a class="angle"></a>').addClass(`a-${k}`).attr('href', L.link('money.html', k))
        .append(document.createTextNode(w.name), $('<span></span>').text(k === WORLD ? 'this one' : w.tag));
      if (k === WORLD) $a.addClass('on').attr('aria-current', 'page');
      if (k === 'measured' && !w.available) $a.removeAttr('href').attr('aria-disabled', 'true').css('opacity', .4);
      $nav.append($a);
    });
    $nav.append($('<span class="spacer"></span>'),
      $('<a class="again"></a>').attr('href', L.link('money.html', WORLD)).text('Play again'),
      $('<a class="hub-link"></a>').attr('href', L.link('index.html')).text('← All games'));
    $end.append($nav);

    // the hidden risk's bill, revealed; the true bill on the chart
    drawRisks(T(800), true);
    C.showTrue = true;
    $('#legend-true').prop('hidden', false);
    animateChart(T(900), false);
    $('#hidden-pool').text(money(S.pool));
    $('#hidden-note').text(S.found ? `Still hidden at the end. Audits found ${money(S.found)}.` : 'Still hidden at the end. No audit was ordered.');
    story(`<b>The end.</b> ${HEAD[v].replace(/<\/?em>/g, '')} The dashed purple line on the chart is the true bill, hidden problems included.`, v === 'helps' ? 'good' : v === 'debt' ? 'bad' : '');

    $end.prop('hidden', false).hide().fadeIn(T(500));
    window.scrollTo({ top: 0, behavior: A.FAST ? 'auto' : 'smooth' });
    const again = $end.find('.again')[0];
    if (again) again.focus({ preventScroll: true });
  }

  function riskTable(revG) {
    const $t = $('<table class="risk-table"></table>');
    const heads = MEASURED
      ? ['Risk', 'What it does', 'Exponent (best guess)', 'Plausible range', 'Cost over the game', 'What the data say']
      : ['Risk', 'What it does', 'Exponent', 'Cost over the game', 'Verdict'];
    $t.append($('<thead></thead>').append($('<tr></tr>').append(heads.map(h => $('<th scope="col"></th>').text(h)))));
    const $b = $('<tbody></tbody>');
    RISKS.forEach(r => {
      const $tr = $('<tr></tr>');
      const $name = $('<td class="r-name"></td>').append($('<span class="dot"></span>'), document.createTextNode(r.name));
      $name[0].style.setProperty('--c', r.color);
      if (r.hidden) $name.append($('<span class="hid-tag">hidden</span>'));
      const $what = $('<td></td>').attr('data-h', 'What it does').text(r.plain);
      const grow = Math.pow(revG, r.exponent);
      const $grow = $('<td class="mono"></td>').attr('data-h', 'Cost over the game').text(`${fx(grow)} (revenue ${fx(revG)})`);
      if (MEASURED) {
        const m = r.measured || {};
        if (m.source) $what.append($('<span class="src"></span>').text(`Source: ${m.source}. Models: ${m.sizes}.`));
        const ci = m.ci_simultaneous;
        const [vk, vn] = r.fitted ? dataVerdict(m.verdict) : ['none', 'not measured yet'];
        const $v = $('<td></td>').attr('data-h', 'What the data say').append($('<span class="v"></span>').addClass(`v-${vk}`).text(vn));
        if (r.fitted && vk === 'open') $v.append($('<span class="src"></span>').text(`best guess: ${L.VERDICT_NAME[L.verdictOf(r.exponent)]}`));
        if (!r.fitted) $v.append($('<span class="src"></span>').text('the game assumes it keeps pace (exponent 1)'));
        $tr.append($name, $what,
          $('<td class="mono"></td>').attr('data-h', 'Exponent').text(r.fitted ? exp2(r.exponent) : '1 (assumed)'),
          $('<td class="mono"></td>').attr('data-h', 'Plausible range').text(r.fitted && ci ? `${exp2(ci[0])} to ${exp2(ci[1])}` : 'not measured yet'),
          $grow, $v);
      } else {
        const vk = L.verdictOf(r.exponent);
        $tr.append($name, $what,
          $('<td class="mono"></td>').attr('data-h', 'Exponent').text(exp2(r.exponent)),
          $grow,
          $('<td></td>').attr('data-h', 'Verdict').append($('<span class="v"></span>').addClass(`v-${vk}`).text(L.VERDICT_NAME[vk])));
      }
      $b.append($tr);
    });
    return $t.append($b);
  }

  // Measured world: how many risks the data have settled
  function settled() {
    return RISKS.filter(r => r.fitted && !['open', 'none'].includes(dataVerdict(r.measured && r.measured.verdict)[0]));
  }
  function settledLine() {
    const n = settled().length;
    if (!W.provisional) return `But this is a pilot on one family of models: ${n ? `${n} of ${RISKS.length} risks ${n > 1 ? 'are' : 'is'} settled` : `none of the ${RISKS.length} risks is settled`}, and the others could still go either way.`;
    return `But these values are provisional: ${n ? `only ${n} of ${RISKS.length} risks ${n > 1 ? 'are' : 'is'} settled` : `none of the ${RISKS.length} risks is settled yet`}, and the others could still go either way.`;
  }

  function hypoNote() {
    return `<b>How to read it.</b> Each risk costs share × size<sup>exponent</sup>. Revenue grows with size (exponent 1). An exponent below 0.9: the risk gets cheaper relative to the business (scaling helps). From 0.9 to 1.1: it keeps pace. Above 1.1: alignment debt. In this angle the exponents are ${esc(W.tag)} plus a fixed shift per risk, as in the paper's toy model: illustrative, not estimates. Over time, the fastest-growing risk takes over the bill.`;
  }
  function measuredNote() {
    const done = settled();
    const names = done.map(r => r.name.toLowerCase());
    return `<b>${W.provisional ? 'Provisional' : 'A pilot'}.</b> These growth rates come from preregistered experiments on real models${W.generated ? ` (exported ${esc(W.generated)})` : ''}. ` +
      `The plausible range is the simultaneous interval: when it spans 0.9 to 1.1 and beyond, the data cannot tell. ` +
      `${done.length ? `Settled${W.provisional ? ' so far' : ''}: ${esc(names.join(', '))}. ` : 'No risk is settled. '}` +
      `A risk not measured yet is assumed to keep pace (exponent 1). How much each risk weighs at the start is illustrative; only the growth rates are measured. ` +
      `Your model went from ${params(1).replace(' parameters', '')} to ${params(Math.pow(2, YEARS - 1))}, about the range that was measured.`;
  }

  // ---------- Intro ----------
  function intro() {
    const flaws = SEEN.map(r => r.plain);
    const $b = $('#intro-body');
    $b.append(
      $('<p></p>').html(`Your product is an AI model. Each year you can <b>train a model twice as big</b>. A bigger model does more, so it <b>earns twice as much</b>.`),
      $('<p></p>').html(`A bigger model also has bigger flaws: it ${esc(listOr(flaws))}. Finding and fixing them costs money. That is your <b>safety bill</b>.`),
      $('<p></p>').html(`Watch one number: <b>the safety bill as a share of revenue</b>. If it <b class="c-ok">falls</b>, scaling helps. If it stays <b class="c-acc">flat</b>, safety keeps pace. If it <b class="c-hot">rises</b>, you are piling up <b>alignment debt</b>.`)
    );
    if (HID) {
      $b.append($('<p></p>').html(`One risk never shows up on the bill: <b class="c-hid">${esc(HID.name)}</b>, a model that ${esc(HID.plain)}. Its cost piles up out of sight. You can order <b>${AUDITS} audits</b> to find some of it.`));
    }
    const $w = $('<div class="intro-world"></div>').append(
      $('<strong></strong>').text(`This angle: ${W.name}`),
      document.createTextNode(`${W.line} `),
      $('<span class="tag"></span>').text(W.tag)
    );
    if (MEASURED) {
      $w.append(document.createTextNode(' '), $('<span class="tag prov"></span>').text(W.provisional ? '· provisional' : ''),
        $('<div></div>').css('margin-top', '6px').text(`Your model will grow from ${params(1).replace(' parameters', '')} to ${params(Math.pow(2, YEARS - 1))}, about the range that was measured. Sources at the end.`));
    }
    $b.append($w);
    $('#btn-start').on('click', startGame).trigger('focus');
  }

  // ---------- Go ----------
  header();
  buildBuilding();
  buildShareBars();
  buildRisks();
  intro();
  $('#btn-train').on('click', train);
  $('#btn-audit').on('click', audit);
  let rt = null;
  $(window).on('resize', () => { clearTimeout(rt); rt = setTimeout(drawChart, 80); });

  A.Money = { state: S, books, risks: RISKS, world: WORLD };
})(jQuery, window.Align);
