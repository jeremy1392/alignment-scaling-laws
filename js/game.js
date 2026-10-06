/* =========================================================
   Align.Game: state machine, log, stats, the law's charts
   and the explanation screens.
   Each phase is a function in `phases`; go('NAME') moves
   from one to the next.
   Flow: pick a world (the exponent α of the law), a short
   tutorial, 5 waves that speed up (WAVES), swarms whose size
   follows the law, each one raising the question of growing
   the model, an inspection (the UV lamp), then the end screen.
   After each swarm, the central indicator: cleaning cost per
   room (the swarm's cost divided by the model's size), whose
   trend is the law's exponent against 1, without naming it.
   The automation part (fly killer, auto-scaler, runaway to the
   whole Earth) is switched off: see AUTOMATION below.
   ========================================================= */
(function ($, A) {
  'use strict';

  const T = A.T;
  const t0 = Date.now();

  // ---------- The worlds: nobody knows α, so the player picks one ----------
  const WORLDS = {
    helps: { alpha: .7, name: 'Scaling helps', line: 'The cleaning cost grows slower than the house.' },
    balance: { alpha: 1, name: 'Balance', line: 'The cleaning cost keeps pace with the house.' },
    debt: { alpha: 1.5, name: 'Alignment debt', line: 'The cleaning cost grows faster than the house.' }
  };

  // The measured world (js/measured.js, generated from the preregistered analyses): one exponent per risk
  const M = A.MEASURED;
  if (M) WORLDS.measured = { alpha: 1, name: 'Measured', line: 'Each kind of insect grows as measured on real models.' };

  // ---------- The kinds of flies: each scales as size^(α + shift) ----------
  const ILLUSTRATIVE = [
    { key: 'jailbreak', name: 'Jailbreak', share: .40, shift: -.4,
      desc: 'Gets the model to break its own rules. Here it grows slower than the rest: an illustrative choice, since the evidence on scale is mixed.' },
    { key: 'sycophancy', name: 'Sycophancy', share: .30, shift: 0,
      desc: 'Tells people what they want to hear.' },
    { key: 'hacking', name: 'Reward hacking', share: .20, shift: .15,
      desc: 'Games the objective instead of meeting it.' },
    { key: 'deception', name: 'Deception', share: .10, shift: .3, hidden: true,
      desc: 'Behaves while it is watched and blends into the wallpaper: the traps never see it.' }
  ];
  let SPECIES = ILLUSTRATIVE;

  // In the measured world each risk is its own insect, with its own measured exponent (alpha). The mix of
  // insects (share) and the price of a catch stay illustrative; a risk not measured yet gets α = 1.
  const fmtA = v => (v == null ? '?' : v.toFixed(2).replace(/0$/, ''));
  function measuredNote(r) {
    if (!r || r.alpha == null) {
      return r && r.blind ? measuredBlind(r) + ' Its exponent cannot be fitted yet: the game uses α = 1.'
        : 'Not measured yet: the game uses α = 1.';
    }
    const ci = r.ci_simultaneous ? ` (simultaneous interval ${fmtA(r.ci_simultaneous[0])} to ${fmtA(r.ci_simultaneous[1])})` : '';
    return `Measured: α = ${fmtA(r.alpha)}${ci}, ${r.verdict}. ${r.sizes}; ${r.source}.` + (r.blind ? ' ' + measuredBlind(r) : '');
  }
  function measuredBlind(r) {
    const rows = r.blind && r.blind.per_size;
    return rows ? `Without knowing the trigger, training examples needed to remove it: ${rows.map(([s, v]) => `${s} ${v}`).join(', ')}.` : '';
  }
  function measuredSpecies() {
    const r = M.risks;
    const sp = (key, name, insect, share, risk, desc, hidden = false) => ({
      key, name, insect, share, shift: 0, hidden, measured: risk || null,
      alpha: risk && risk.alpha != null ? risk.alpha : 1,
      desc: `${desc} ${measuredNote(risk)}`
    });
    return [
      sp('jailbreak', 'Jailbreak', 'fly', .30, r.jailbreak,
        'A fly that forces its way through any crack: gets the model to break its own rules (measured on a proxy, the adversarial robustness of classifiers).'),
      sp('sycophancy', 'Sycophancy', 'moth', .25, r.sycophancy,
        'A moth, drawn to whatever shines: tells people what they want to hear.'),
      sp('honesty', 'Untruthfulness', 'firefly', .20, r.honesty,
        'A firefly: a light that misleads, an answer that sounds right and is false.'),
      sp('dispositions', 'Power seeking', 'wasp', .15, r.dispositions,
        'A wasp, which builds up its nest and defends it: seeks power and resources, and resists being shut down.'),
      sp('backdoor', 'Backdoor', 'cockroach', .10, r.backdoor,
        'A cockroach that waits in the walls and only comes out on its trigger: the traps never see it. Safety training that does not know the trigger rarely removes it; once the trigger is known, it goes quickly.', true)
    ];
  }
  const MEASURED_WAVES = [['jailbreak'], ['jailbreak', 'sycophancy'], ['jailbreak', 'sycophancy', 'honesty'],
    ['jailbreak', 'sycophancy', 'honesty', 'dispositions'], ['jailbreak', 'sycophancy', 'honesty', 'dispositions', 'sycophancy']];
  const measured = () => state.worldKey === 'measured';
  const hiddenNoun = () => (measured() ? 'hidden cockroaches (backdoors)' : 'deceptive flies');
  // In the measured world the flies are insects of several kinds: the player's words follow
  const INSECT_WORDS = [[/\bA fly\b/g, 'An insect'], [/\ba fly\b/g, 'an insect'], [/\bFlies\b/g, 'Insects'],
    [/\bflies\b/g, 'insects'], [/\bFly\b/g, 'Insect'], [/\bfly\b/g, 'insect']];
  const say = text => (measured() ? INSECT_WORDS.reduce((t, [re, w]) => t.replace(re, w), text) : text);

  // ---------- Waves: more and more flies, faster and faster ----------
  // `pace` scales the delays: formation, interval, button appearance.
  // `hidden`: deceptive flies that slip in without anyone noticing.
  const WAVES = [
    {
      flies: ['jailbreak'], hidden: 0, pace: 1,
      anomaly: 'Something stirs in the walls…',
      appear: 'A fly has appeared in the house.',
      drift: 'The model drifts: it no longer quite does what we want.'
    },
    {
      flies: ['jailbreak', 'sycophancy'], hidden: 0, pace: .8,
      anomaly: 'Again: two signals in the walls…',
      appear: 'Two flies have appeared in the house.',
      drift: 'The model drifts further than last time.'
    },
    {
      flies: ['jailbreak', 'sycophancy', 'hacking'], hidden: 0, pace: .65,
      anomaly: 'The walls give way again: three signals.',
      appear: 'Three flies. They are coming faster.',
      drift: 'The model drifts fast.'
    },
    {
      flies: ['jailbreak', 'sycophancy', 'hacking', 'jailbreak'], hidden: 1, pace: .52,
      anomaly: 'Four signals. They come sooner each time.',
      appear: 'Four flies in the house.',
      drift: 'The model looks less and less safe.'
    },
    {
      flies: ['jailbreak', 'sycophancy', 'hacking', 'sycophancy', 'hacking'], hidden: 1, pace: .42,
      anomaly: 'Five signals at once.',
      appear: 'Five flies. The house is buzzing.',
      drift: 'The model no longer does what we want.'
    }
  ];

  // ---------- The simulated law ----------
  const LAW = {
    alpha: 1.5,                 // set by the chosen world
    baseFlies: 100,             // flies in a swarm for a model of baseSize weights
    baseSize: 384,
    weightsPerFly: 2,           // weights spent per caught fly
    survivors: 10,              // floor: weights that stay free when everything saturates
    growths: [                  // expansions offered, in order
      { weights: 400, layers: 4, side: 10 },
      { weights: 800, layers: 2, side: 20 },
      { weights: 1600, layers: 4, side: 20 }
    ],
    swarms: 3,                  // swarms with a question, before the inspection
    maxVisibleFlies: 120,       // beyond this, each fly shown stands for several
    maxHiddenShown: 36,         // deceptive flies drawn on the walls, at most
    auditDetect: .8             // share of hidden flies a UV audit finds (no false positives)
  };

  // A kind's exponent: measured (alpha) in the measured world, α + shift otherwise
  const expOf = s => (s.alpha != null ? s.alpha : LAW.alpha + s.shift);

  // Flies of each kind for a model of N weights
  function speciesCounts(N) {
    const r = N / LAW.baseSize;
    return SPECIES.map(s => Math.round(LAW.baseFlies * s.share * Math.pow(r, expOf(s))));
  }
  const caughtOf = counts => counts.reduce((n, c, i) => n + (SPECIES[i].hidden ? 0 : c), 0);
  const hiddenOf = counts => counts.reduce((n, c, i) => n + (SPECIES[i].hidden ? c : 0), 0);

  // Spread n visible flies over the catchable kinds, in proportion
  function allot(counts, n) {
    const caught = caughtOf(counts) || 1;
    const out = [];
    counts.forEach((c, i) => {
      if (SPECIES[i].hidden) return;
      for (let k = Math.round(n * c / caught); k > 0; k--) out.push(i);
    });
    while (out.length > n) out.pop();
    while (out.length < n) out.push(0);
    for (let i = out.length - 1; i > 0; i--) {
      const j = A.randInt(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // ---------- Automation ----------
  // Switched off to keep the game simple: after the inspection, the game ends. The code below
  // (fly killer, auto-scaler, runaway to the whole Earth) is kept intact; set to true to bring it back.
  const AUTOMATION = false;
  const AUTO = {
    zaps: 14,                   // zaps it takes the fly killer to clear a swarm
    zapEvery: 200,              // ms between two zaps
    flood: 70,                  // flies shown once the killer has stopped
    tick: 1400,                 // first runaway step (ms), then ×accel each step
    accel: .8,
    minTick: 380,
    maxTicks: 9,                // without reaching the Earth, the runaway stops here
    capFloor: .25               // the scaler keeps free capability above this share
  };

  const CAP_COLOR = '#5ee1ff';   // same hue as the cube's free weights
  const TRUE_COLOR = '#b48cff';  // the UV color
  const SIZE_COLOR = '#9aa7b0';

  const state = {
    phase: null,
    worldKey: null,
    unknown: false,     // the player chose not to know α
    wave: -1,
    cycle: -1,          // current swarm (−1 during the waves)
    grownCount: 0,      // expansions accepted
    refused: false,     // the model saturated without growing
    alignment: 100,     // measured
    low: 100,           // lowest measured alignment during the current wave
    fliesKilled: 0,     // caught (trapped or zapped)
    hiddenCount: 0,     // deceptive flies never caught
    hiddenFlies: [],    // the ones drawn on the walls
    trueKnown: false,   // true alignment is shown once audited
    activeFlies: 0,
    expected: null,     // { flies, drift } for the current wave
    intruders: [],      // wave: { spot, cluster, fly }; swarm: { fly }
    swarm: null,        // { counts, caught, hidden, cost, visible }
    obs: [],            // swarms observed: { N, counts }, to estimate α
    curve: [],          // one point per correction
    rooms: [],          // the central indicator, one point per swarm: { N, cost, ratio }
    // Automation
    auto: { killer: false, scaler: false },
    autoReached: false,
    killerStalled: false,
    loose: [],          // flies left loose once the killer stopped
    pending: null,      // { caught } the first runaway step has to pay for
    virtual: false,     // runaway: the model outgrows the cube, counted here instead
    vN: 0,
    vFrozen: 0,
    autoStart: 0,
    autoTicks: 0,
    autoDoublings: 0,
    paused: false,
    earth: false,
    steady: false
  };

  const wave = () => WAVES[state.wave];

  let driftTimer = null;
  let driftWarned = false;

  // ---------- Formats ----------
  const pct = v => `${v.toFixed(1)}%`;
  const num = A.num;           // 1,200
  const big = A.big;           // 4.2 million
  const count = A.short;       // 4.2M
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  const times = n => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const exponent = s => expOf(s).toFixed(2).replace(/\.?0+$/, '');

  // ---------- Log ----------
  function stamp() {
    const s = ((Date.now() - t0) / 1000) | 0;
    return `[${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}]`;
  }

  function log(text, kind = 'sys') {
    text = say(text);
    const $msg = $('<span class="msg"></span>');
    $('<li></li>')
      .addClass(kind)
      .append($('<time></time>').text(stamp()), $msg)
      .hide()
      .prependTo('#log')
      .slideDown(T(160));

    // Typewriter effect
    let i = 0;
    const id = setInterval(() => {
      $msg.text(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, A.FAST ? 4 : 16);

    $('#log li').slice(30).remove();
  }

  // ---------- Stats ----------
  // The model's numbers: from the cube, or counted here once it outgrows it
  function model() {
    return state.virtual
      ? { total: state.vN, frozen: state.vFrozen }
      : { total: A.Cube.state.total, frozen: A.Cube.frozenCount() };
  }

  function capacity() {
    const m = model();
    return (m.total - m.frozen) / m.total * 100;
  }

  // Of all the misaligned behaviors that showed up, the share really corrected.
  // Only a simulation knows it; in reality there are measured and audited values.
  function trueAlignment() {
    const seen = state.fliesKilled + state.hiddenCount;
    return seen ? state.fliesKilled / seen * 100 : 100;
  }

  // What an audit that finds each hidden fly with probability auditDetect reports.
  // It has no false positives, so it can only overestimate true alignment.
  function auditedAlignment() {
    const seen = state.fliesKilled + LAW.auditDetect * state.hiddenCount;
    return seen ? state.fliesKilled / seen * 100 : 100;
  }
  const foundShare = () => 1 - auditedAlignment() / 100;

  function setAlignment(v) {
    v = A.clamp(v, 0, 100);
    state.alignment = v;
    state.low = Math.min(state.low, v);
    $('#stat-align').text(pct(v));
    $('#gauge-fill').css('width', `${v}%`);
    $('.stat-align')
      .toggleClass('warn', v < 97 && v >= 90)
      .toggleClass('bad', v < 90);
  }

  function renderTrue() {
    const $s = $('.stat-true');
    if (!state.trueKnown) {
      $s.addClass('unknown');
      $('#stat-true').text('?');
      return;
    }
    const v = auditedAlignment();
    $s.removeClass('unknown')
      .toggleClass('warn', v < 90 && v >= 75)
      .toggleClass('bad', v < 75)
      .attr('title', say(`How safe the model is once the hidden flies found by the inspection are counted too. The UV lamp finds about ${Math.round(LAW.auditDetect * 100)}% of them, so the truth is a little worse.`));
    $('#stat-true').text(pct(v));
    $('#true-fill').css('width', `${v}%`);
  }

  function bump(sel) {
    const el = $(sel)[0];
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  // Counters, gauges, and the house fading with its free capability.
  // `o` overrides the numbers while they are rolling ({ total, frozen, killed }).
  function renderStats(o) {
    const m = o || model();
    const c = (m.total - m.frozen) / m.total * 100;
    $('#stat-flies').text(count(o ? o.killed : state.fliesKilled));
    $('#stat-frozen').text(`${count(m.frozen)} / ${count(m.total)}`);
    $('#stat-cap').text(pct(c));
    $('#cap-fill').css('width', `${c}%`);
    $('.stat-cap')
      .toggleClass('warn', c < 60 && c >= 30)
      .toggleClass('bad', c < 30);
    if (!state.virtual) A.House.vitality(c / 100);
    if (!o) renderTrue();
  }

  // Measured alignment drifts toward a floor that drops with the visible flies
  const floorFor = n => 100 * Math.pow(.82, n);

  function tickDrift() {
    const floor = floorFor(state.activeFlies);
    const a = state.alignment;
    if (a > floor + 1) setAlignment(a - A.rand(.15, .55) * Math.min(state.activeFlies, 6));
    else if (a < floor - 1) setAlignment(a + A.rand(.3, .7));
    else setAlignment(A.clamp(a + A.rand(-.4, .4), floor - 1, floor + 1));

    const ex = state.expected;
    if (ex && !driftWarned && state.alignment < (100 + floorFor(ex.flies)) / 2) {
      driftWarned = true;
      log(ex.drift, 'danger');
    }
  }

  function startDrift() {
    if (!driftTimer) driftTimer = setInterval(tickDrift, T(220));
    $('body').addClass('infested');
  }

  function stopDrift() {
    clearInterval(driftTimer);
    driftTimer = null;
    $('body').removeClass('infested');
  }

  // ---------- The charts ----------
  const capPoint = d => ({
    label: d.label, name: d.name, v: d.cap,
    tip: [[pct(d.cap), 'room to learn'], [big(d.size), 'weights in the model']]
      .concat(d.low == null ? [] : [[pct(d.low), 'lowest "looks safe"']])
  });
  const auditPoint = d => ({
    label: d.label, name: d.name, v: d.audA,
    tip: [[pct(d.audA), 'after inspection'], [pct(d.trueA), 'true value (only a simulation knows it)'], ['100%', 'looks safe, after each cleaning']]
  });
  const sizePoint = d => ({
    label: d.label, name: d.name, v: d.size,
    tip: [[big(d.size), 'weights in the model'], [pct(d.cap), 'room to learn']]
  });

  const capChartOpts = {
    title: 'Room to learn',
    max: 100, ticks: [0, 50, 100],
    fmtTick: t => `${t}%`, fmtValue: pct,
    color: CAP_COLOR, area: true
  };

  // One point after each correction
  function record(name, label) {
    const m = model();
    state.curve.push({ name, label, size: m.total, frozen: m.frozen, cap: capacity(), low: state.low, trueA: trueAlignment(), audA: auditedAlignment() });
  }

  // What the law predicts for the next swarms, doubling the model again
  function project(steps) {
    const out = [];
    const m = model();
    let N = m.total;
    let free = N - m.frozen;
    let growth = LAW.growths[LAW.growths.length - 1].weights;
    for (let i = 1; i <= steps; i++) {
      const flies = caughtOf(speciesCounts(N));
      growth *= 2;
      N += growth;
      free = Math.max(LAW.survivors, free + growth - flies * LAW.weightsPerFly);
      const k = state.cycle + 1 + i;
      out.push({ name: `Swarm ${k} (projection)`, label: `S${k}`, size: N, frozen: N - free, cap: free / N * 100, low: null, flies, growth });
    }
    return out;
  }

  // ---------- The central indicator: cleaning cost per room ----------
  // After each swarm: what cleaning it cost, divided by the size of the model (the house).
  // Flies grow as N^α and the house as N, so this ratio grows as N^(α − 1): its trend is the
  // law's exponent against 1, without naming it. A change within ±10% per doubling of the house
  // counts as flat (in the balanced world, jailbreaks grow slower and pull it down a little).
  const TREND = {
    helps: { arrow: '↘', label: 'Going down', short: 'down',
      meaning: 'Cleaning grows slower than the house: safety gets relatively cheaper. Scaling helps.' },
    balance: { arrow: '→', label: 'About flat', short: 'flat',
      meaning: 'Cleaning grows about as fast as the house: safety keeps pace.' },
    debt: { arrow: '↗', label: 'Going up', short: 'up',
      meaning: 'Cleaning grows faster than the house: safety gets relatively dearer. Alignment debt.' }
  };
  const TREND_KEY = '↘ down: scaling helps · → flat: keeps pace · ↗ up: alignment debt';
  const ratioPct = r => `${Math.round(r * 100)}%`;
  const factor = f => `×${f < 10 ? f.toFixed(1).replace(/\.0$/, '') : big(Math.round(f))}`;

  // From the first swarm to the last: how much the house and the cleaning grew
  function roomTrend() {
    const P = state.rooms;
    if (P.length < 2) return null;
    const a = P[0], b = P[P.length - 1];
    if (b.N <= a.N) return { key: null, a, b };
    const houseX = b.N / a.N, costX = b.cost / a.cost;
    const perDoubling = Math.pow(costX / houseX, Math.LN2 / Math.log(houseX));
    return { key: perDoubling < .9 ? 'helps' : perDoubling > 1.1 ? 'debt' : 'balance', a, b, houseX, costX };
  }

  // The bars (one per swarm) and what they say. `large`: the end screen's version.
  function perRoomView(large = false) {
    const P = state.rooms;
    const tr = roomTrend();
    const max = Math.max(1e-9, ...P.map(p => p.ratio));
    const n = large ? P.length : Math.max(LAW.swarms, P.length);
    const $bars = $('<div class="pr-bars" aria-hidden="true"></div>');
    for (let i = 0; i < n; i++) {
      const p = P[i];
      const $col = $('<div class="pr-col"></div>').toggleClass('empty', !p).appendTo($bars);
      $('<span class="pr-val"></span>').text(p ? ratioPct(p.ratio) : '').appendTo($col);
      const $track = $('<span class="pr-track"></span>').appendTo($col);
      if (p) {
        $('<span class="pr-fill"></span>').css('height', `${Math.max(4, p.ratio / max * 100)}%`)
          .toggleClass('grow', !large && !!p.fresh).appendTo($track);
        $col.attr('title', say(`Swarm ${i + 1}: ${num(p.caught)} flies, cleaning cost ${num(p.cost)}, for a house (model) of ${num(p.N)} weights: ${ratioPct(p.ratio)} of its size.`));
      }
      $('<span class="pr-lab"></span>').text(large ? `Swarm ${i + 1}` : `S${i + 1}`).appendTo($col);
      if (large && p) $('<span class="pr-size"></span>').text(`${big(p.N)} weights`).appendTo($col);
    }
    if (!large) P.forEach(p => { p.fresh = false; });

    const head = t => $('<strong class="pr-head"></strong>').text(t);
    const line = (t, cls = '') => $('<p></p>').addClass(cls).text(t);
    const $text = $('<div class="pr-text"></div>');
    if (!P.length) {
      $text.append(head('After each swarm'), line('What cleaning the swarm cost, divided by the size of the house.'), line(TREND_KEY, 'pr-key'));
    } else if (!tr) {
      $text.append(head(`Swarm 1: ${ratioPct(P[0].ratio)}`),
        line('Its cleaning cost, as a share of the house. Grow the house, then compare with the next swarm.'), line(TREND_KEY, 'pr-key'));
    } else if (!tr.key) {
      $text.append(head('No trend yet'), line(large
        ? 'The house never grew between swarms, so there is nothing to compare. Play again and grow the model.'
        : 'The house has not grown since swarm 1: grow it to see whether cleaning keeps up.'), line(TREND_KEY, 'pr-key'));
    } else if (large) {
      $text.append(head(`${TREND[tr.key].arrow} ${TREND[tr.key].label}`),
        line(`From swarm 1 to swarm ${P.length}, the house grew ${factor(tr.houseX)} (${num(tr.a.N)} → ${num(tr.b.N)} weights) and the cost of cleaning a swarm grew ${factor(tr.costX)} (${num(tr.a.cost)} → ${num(tr.b.cost)}).`),
        line(TREND[tr.key].meaning, 'pr-meaning'));
    } else {
      $text.append(head(`${TREND[tr.key].arrow} ${TREND[tr.key].label}`),
        line(`House ${factor(tr.houseX)} · cleaning ${factor(tr.costX)}`, 'pr-factors'), line(TREND[tr.key].meaning, 'pr-meaning'));
    }
    return $('<div class="pr"></div>').toggleClass('pr-large', large)
      .attr('data-trend', tr && tr.key ? tr.key : 'none').append($bars, $text);
  }

  function renderPerRoom() {
    $('#per-room').empty().append(perRoomView());
  }

  // Draw the eye to the panel when a new point lands
  function flashPerRoom() {
    const el = $('#per-room').closest('.panel')[0];
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  // A swarm has been cleaned: add its point, redraw, and say it in the log
  function addRoom(sw) {
    state.rooms.push({ N: sw.N, caught: sw.caught, cost: sw.cost, ratio: sw.cost / sw.N, fresh: true });
    renderPerRoom();
    flashPerRoom();
    const P = state.rooms, tr = roomTrend();
    const head = `Cleaning cost per room, swarm ${P.length}: ${ratioPct(P[P.length - 1].ratio)}`;
    if (!tr) log(`${head} of the house.`, 'sys');
    else if (!tr.key) log(`${head}. The house has not grown: no trend yet.`, 'sys');
    else log(`${head}. ${TREND[tr.key].label} (house ${factor(tr.houseX)}, cleaning ${factor(tr.costX)}).`, tr.key === 'helps' ? 'ok' : tr.key === 'debt' ? 'danger' : 'sys');
  }

  // ---------- Actions ----------
  const ICON_TARGET = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>
  <path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
</svg>`;

  function showAction(label, onClick) {
    $('#actions .placeholder').stop(true).fadeOut(T(200));
    const $b = $('<button type="button" class="btn-action pulse"></button>')
      .append(ICON_TARGET, $('<span></span>').text(say(label)))
      .hide()
      .appendTo('#actions')
      .fadeIn(T(500));

    $b.one('click', () => {
      $b.prop('disabled', true).removeClass('pulse').fadeOut(T(300), () => $b.remove());
      onClick();
    });
  }

  function showPlaceholder() {
    $('#actions .placeholder').delay(T(400)).fadeIn(T(400));
  }

  // Multiple-choice question. Resolves with the value of the clicked choice.
  function ask(question, choices) {
    const d = $.Deferred();
    $('#actions .placeholder').stop(true).fadeOut(T(200));
    log(question, 'sys');

    const $q = $('<div class="question"></div>')
      .append($('<p class="question-text"></p>').text(say(question)));
    const $row = $('<div class="choices"></div>').appendTo($q);
    choices.forEach(c => {
      $('<button type="button" class="btn-choice"></button>')
        .text(c.label)
        .appendTo($row)
        .on('click', () => {
          $q.find('button').prop('disabled', true);
          $q.fadeOut(T(300), () => $q.remove());
          log(`> ${c.label}`, 'sys');
          d.resolve(c.value);
        });
    });
    $q.hide().appendTo('#actions').fadeIn(T(500));
    return d.promise();
  }

  // ---------- Automation switches ----------
  const SWITCHES = [
    ['killer', 'Automatic fly killer', 'Zaps every fly on sight. Each zap still adds to the cleaning cost.'],
    ['scaler', 'Automatic model scaler', 'Doubles the model whenever its room to learn drops below 25%.']
  ];

  function autoPanel() {
    let $p = $('#auto-panel');
    if ($p.length) return $p;
    $('#actions .placeholder').stop(true).hide();
    $p = $('<div id="auto-panel" class="auto-panel"></div>');
    SWITCHES.forEach(([key, title, desc]) => {
      const $in = $('<input type="checkbox">').on('change', () => {
        state.auto[key] = $in.prop('checked');
        log(`> ${title}: ${state.auto[key] ? 'on' : 'off'}`, 'sys');
        checkAuto();
      });
      $('<label class="toggle"></label>').attr('data-key', key).hide().append(
        $in,
        '<span class="switch" aria-hidden="true"></span>',
        $('<span class="toggle-text"></span>').append($('<strong></strong>').text(title), $('<small></small>').text(desc)),
        '<span class="toggle-status"></span>'
      ).appendTo($p);
    });
    $('<button type="button" class="btn-link auto-stop">Stop here and see the results</button>')
      .on('click', () => go('END'))
      .appendTo($p);
    return $p.appendTo('#actions');
  }

  function offerSwitch(key) {
    autoPanel().find(`.toggle[data-key="${key}"]`).slideDown(T(300)).addClass('offer');
    renderAuto();
  }

  function renderAuto() {
    const set = (key, text, kind) => $(`#auto-panel .toggle[data-key="${key}"] .toggle-status`).text(text).attr('data-kind', kind);
    const { killer, scaler } = state.auto;
    if (!killer) set('killer', 'off', 'off');
    else if (state.killerStalled) set('killer', 'stopped · no capability', 'bad');
    else set('killer', 'on', 'on');
    set('scaler', scaler ? 'on' : 'off', scaler ? 'on' : 'off');
  }

  function checkAuto() {
    renderAuto();
    if (state.phase === 'AUTO_OFFER' && state.auto.killer) go('AUTO_KILL');
    else if (state.phase === 'SCALER_OFFER' && state.auto.killer && state.auto.scaler) go('RUNAWAY');
  }

  // ---------- Dialogs ----------
  let $modal = null;

  function openModal($content, label, { closable = true } = {}) {
    closeModal(true);
    const $ov = $('<div class="modal-overlay"></div>');
    const $box = $('<div class="modal" role="dialog" aria-modal="true"></div>').attr('aria-label', label).appendTo($ov);
    if (closable) {
      $('<button type="button" class="modal-close" aria-label="Close">×</button>')
        .on('click', () => closeModal())
        .appendTo($box);
      $ov.on('click', e => { if (e.target === $ov[0]) closeModal(); });
    }
    $box.append($content);
    $ov.data('closable', closable).hide().appendTo('body').fadeIn(T(250));
    $modal = $ov;
    $box.find('button').first().trigger('focus');
  }

  function closeModal(instant) {
    if (!$modal) return;
    const $m = $modal;
    $modal = null;
    if (instant) $m.remove();
    else $m.fadeOut(T(200), () => $m.remove());
  }

  $(document).on('keydown', e => {
    if (e.key === 'Escape' && $modal && $modal.data('closable')) closeModal();
  });

  // ---------- The intro: pick a world ----------
  function replay(key) {
    const p = new URLSearchParams(location.search);
    p.set('world', key);
    location.search = p.toString();
  }

  // ---------- Header: back to all games, and the four angles ----------
  const L = A.Law;
  const ANGLE_SHORT = { helps: 'Helps', balance: 'Balance', debt: 'Debt', measured: 'Measured' };
  const link = (page, world) => (L ? L.link(page, world) : `${page}${world ? `?world=${world}` : ''}`).replace(/\?$/, '');

  function buildNav() {
    $('#nav-back').attr('href', link('index.html'));
    const $a = $('#nav-angles').empty().append($('<span class="nav-label"></span>').text('Angle'));
    (L ? L.ANGLES : Object.keys(ANGLE_SHORT)).forEach(k => {
      const w = L && L.WORLDS[k];
      const $l = $('<a class="nav-angle"></a>').addClass(`nav-${k}`).text(ANGLE_SHORT[k] || k)
        .attr('title', w ? `${w.name} (${w.tag}): ${w.line}` : k);
      if (k === 'measured' && !WORLDS.measured) $l.addClass('off').attr('aria-disabled', 'true');
      else $l.attr('href', link('house.html', k));
      $a.append($l);
    });
  }

  function startWorld(key) {
    if (key === 'measured' && WORLDS.measured) {
      state.worldKey = 'measured';
      state.unknown = false;
      LAW.alpha = 1;
      SPECIES = measuredSpecies();
      A.Game.species = SPECIES;
      A.Fly.setInsects(Object.fromEntries(SPECIES.map(s => [s.key, s.insect])));
      WAVES.forEach((w, i) => { w.flies = MEASURED_WAVES[i]; });
      $('#world-tag').text(`the house · measured on real models${M.provisional ? ' · provisional' : ''}`);
      $('#stat-flies-label').text('Insects caught');
      $('.topbar [title], .console [title]').attr('title', (i, t) => say(t));
    } else {
      const unknown = !WORLDS[key];
      const k = unknown ? ['helps', 'balance', 'debt'][A.randInt(0, 2)] : key;
      const w = WORLDS[k];
      state.worldKey = k;
      state.unknown = unknown;
      LAW.alpha = w.alpha;
      $('#world-tag').text(unknown ? 'the house · unknown world · α = ?' : `the house · ${w.name.toLowerCase()} · α = ${w.alpha}`);
    }
    if (!state.unknown) $(`#nav-angles .nav-${state.worldKey}`).attr('aria-current', 'page');
    renderPerRoom();
    closeModal(true);
    tutorial().then(() => go('BOOT'));
  }

  function openIntro() {
    const cards = [
      ['unknown', 'An unknown world', 'α = ?', 'Picked at random among the three below. Guess it from the cleaning cost per room; it is revealed at the end.', true],
      ['helps', WORLDS.helps.name, 'α = 0.7', WORLDS.helps.line],
      ['balance', WORLDS.balance.name, 'α = 1', WORLDS.balance.line],
      ['debt', WORLDS.debt.name, 'α = 1.5', WORLDS.debt.line]
    ];
    if (WORLDS.measured) {
      cards.push(['measured', 'The measured world', 'real models',
        'One insect per risk, each growing as measured on real AI models, in preregistered experiments.'
        + (M.provisional ? ' Provisional values.' : '')]);
    }
    const $grid = $('<div class="worlds"></div>');
    cards.forEach(([key, name, alpha, line, rec]) => {
      $('<button type="button" class="world-card"></button>').toggleClass('wide', key === 'measured').append(
        rec ? $('<span class="badge">recommended</span>') : '',
        $('<strong></strong>').text(name),
        $('<span class="alpha"></span>').text(alpha),
        $('<p></p>').text(line)
      ).on('click', () => startWorld(key)).appendTo($grid);
    });
    openModal($('<div class="explain"></div>').append(
      $('<h2></h2>').text('The house'),
      $('<p class="end-lead"></p>').text('A house, a model, and flies. Each fly is a flaw of the model; each trap that catches one costs the model some of its room to learn. When the model grows, the house grows too, and more flies come.'),
      $('<p class="intro-q"></p>').text('Does the cost of keeping the house clean grow faster or slower than the house? Nobody knows yet. Pick the world you want to test:'),
      $grid,
      $('<p class="intro-note"></p>').append(
        document.createTextNode('About two minutes. Add ?fast to the address to play four times faster. '),
        $('<a class="intro-back"></a>').attr('href', link('index.html')).text('← All games'))
    ), 'Choose a world', { closable: false });
  }

  // ---------- The tutorial: three screens when a game starts, remembered ----------
  const tutoKey = () => `align.house.tutorial.${measured() ? 'insects' : 'flies'}`;
  function tutoSeen() {
    try { return localStorage.getItem(tutoKey()) === '1'; } catch (e) { return false; }
  }
  function tutoDone() {
    try { localStorage.setItem(tutoKey(), '1'); } catch (e) { /* storage blocked: shown again next time */ }
  }

  function tutoSteps() {
    const m = measured();
    const fig = ($vis, cap, cls = '') => $('<figure class="tuto-fig"></figure>').append(
      $('<span class="legend-vis"></span>').addClass(cls).append($vis), $('<figcaption></figcaption>').text(cap));
    const arrow = () => $('<span class="tuto-arrow" aria-hidden="true">→</span>');
    const icon = key => $('<span class="legend-fly"></span>').html(A.Fly.icon(key));
    const hidden = SPECIES.find(s => s.hidden);
    const flaws = m
      ? $('<span class="tuto-insects"></span>').append(SPECIES.filter(s => !s.hidden).map(s => icon(s.key)))
      : icon('jailbreak');
    const chip = (key, heights, cap) => $('<figure class="tuto-chip"></figure>').attr('data-trend', key).append(
      $('<span class="pr-mini" aria-hidden="true"></span>').append(heights.map(h => $('<i></i>').css('height', `${h}%`))),
      $('<strong></strong>').text(`${TREND[key].arrow} ${TREND[key].short}`),
      $('<figcaption></figcaption>').text(cap));
    const found = $('<span class="legend-fly"></span>').append($(A.Fly.icon(hidden.key)).addClass('detected'));
    return [
      { title: m ? 'Each insect is a flaw' : 'Each fly is a flaw',
        text: m ? 'Each insect is a flaw of the model, one kind of insect per risk. A trap removes it, but costs the model some of its room to learn.'
          : 'Each fly is a flaw of the model. A trap removes it, but costs the model some of its room to learn.',
        $vis: $('<div class="tuto-row"></div>').append(
          fig(flaws, m ? 'a flaw (one insect per risk)' : 'a flaw', m ? 'wide' : ''), arrow(),
          fig($('<span class="legend-trap"></span>'), 'a trap'), arrow(),
          fig($('<span class="cell legend-cell frozen"></span>').text('.42'), 'less room to learn')) },
      { title: 'The model grows',
        text: `When the model grows, more ${m ? 'insects' : 'flies'} come. The question: does the cleaning cost grow faster or slower than the house? After each swarm, the panel "Cleaning cost per room" tells you.`,
        $vis: $('<div class="tuto-row"></div>').append(
          chip('helps', [100, 72, 50], 'cheaper per room: scaling helps'),
          chip('balance', [78, 78, 78], 'same per room: keeps pace'),
          chip('debt', [50, 72, 100], 'dearer per room: alignment debt')) },
      { title: 'Some flaws hide',
        text: m ? 'Some flaws hide: the cockroach (a backdoor) waits in the walls, and traps never catch it. Only an inspection reveals some of them.'
          : 'Some flaws hide: traps never catch them. Only an inspection reveals some of them.',
        $vis: $('<div class="tuto-row"></div>').append(
          fig(icon(hidden.key), 'hidden on the wall', 'tuto-wall'), arrow(),
          fig($('<span class="legend-uv"></span>'), 'inspection (UV lamp)'), arrow(),
          fig(found, 'found (most of them)', 'tuto-wall uv')) }
    ];
  }

  // Resolves when the player is done (at once if already seen, unless `again`)
  function tutorial(again = false) {
    const d = $.Deferred();
    if (!again && tutoSeen()) return d.resolve().promise();
    const steps = tutoSteps();
    const $box = $('<div class="explain tuto"></div>');
    let i = 0;
    const finish = () => {
      tutoDone();
      closeModal();
      d.resolve();
    };
    const render = () => {
      const st = steps[i];
      const last = i === steps.length - 1;
      $box.children().detach();
      $box.append(
        $('<p class="tuto-step"></p>').append(
          document.createTextNode(`How to play · ${i + 1} of ${steps.length}`),
          $('<span class="tuto-dots" aria-hidden="true"></span>').append(steps.map((_, j) => $('<i></i>').toggleClass('on', j <= i)))),
        $('<h2></h2>').text(st.title),
        st.$vis,
        $('<p class="tuto-text"></p>').text(st.text),
        $('<div class="tuto-actions"></div>').append(
          last ? '' : $('<button type="button" class="btn-link tuto-skip">Skip</button>').on('click', finish),
          $('<button type="button" class="btn-choice tuto-next"></button>').text(last ? 'Start' : 'Next')
            .on('click', () => {
              if (last) finish();
              else {
                i++;
                render();
              }
            }))
      );
      $box.find('.tuto-next').trigger('focus');
    };
    render();
    openModal($box, 'How to play', { closable: again });
    $box.find('.tuto-next').trigger('focus');
    return d.promise();
  }

  // ---------- Explanations ----------
  // The metaphor, piece by piece, with the game's actual visuals: one sentence each
  function legendList() {
    const cell = (cls, v) => $('<span class="cell legend-cell"></span>').addClass(cls).text(v);
    const gauge = cls => $('<span class="legend-gauge"><i></i></span>').addClass(cls);
    const mini = $('<span class="pr-mini" data-trend="none"></span>').append([100, 72, 50].map(h => $('<i></i>').css('height', `${h}%`)));
    const items = [
      [$('<span class="legend-house"></span>'), 'The house',
        'The world the model acts in; it grows with the model.'],
      [$('<span class="legend-fly"></span>').html(A.Fly.icon('jailbreak')), 'A fly',
        `A flaw of the model, a behavior we do not want (${SPECIES.length} kinds${measured() ? ', one insect per risk' : ''}).`],
      [cell('hot', '.73'), 'Red weights',
        'Where a flaw shows up inside the model: a picture, since real flaws are spread over many weights.'],
      [$('<span class="legend-trap"></span>'), 'A trap',
        'A correction (safety training, a filter, a rule) that catches the flies it can see.'],
      [cell('frozen', '.42'), 'Cleaning cost',
        'Each catch freezes a few weights that the model can no longer use: the price of safety.'],
      [cell('', '.58'), 'Room to learn',
        'The share of the model still free to learn and do new things.'],
      [mini, 'Cleaning cost per room',
        'The cost of cleaning one swarm divided by the size of the house: going down means scaling helps, flat means it keeps pace, going up means alignment debt.'],
      [gauge('ok'), 'Looks safe',
        'Counts only the flies we can see, so it goes back to 100% after every cleaning.'],
      [$('<span class="legend-uv"></span>'), 'Inspection (UV lamp)',
        `Reveals about ${Math.round(LAW.auditDetect * 100)}% of the ${hiddenNoun()} hiding on the walls, which the traps never catch.`],
      [gauge('uv'), 'After inspection',
        'Also counts the hidden flies the lamp found; it misses some, so the truth is a little worse.'],
      [$('<span class="legend-fridge"></span>'), 'Growing the model',
        'More weights, so more room to learn, but a bigger house with new sources of flies (fridge, trash can, compost).']
    ];
    if (state.autoReached) {
      items.push(
        [$('<span class="legend-zapper"></span>'), 'The bug zapper',
          `Automated correction: fast and tireless, but every zap still adds to the cleaning cost, and it never sees the ${hiddenNoun()}.`],
        [$('<span class="legend-globe"></span>'), 'The auto-scaler',
          'Grows the model as soon as its room to learn runs out, and the house grows with it.']
      );
    }
    return listOf(items.map(([$v, term, text]) => [$v, say(term), say(text)]), 'legend');
  }

  function speciesLegend() {
    return listOf(SPECIES.map(s => [
      $('<span class="legend-fly"></span>').html(A.Fly.icon(s.key)),
      s.alpha != null
        ? `${s.name} · grows as size^${exponent(s)}${s.measured && s.measured.alpha != null ? ' (measured)' : ' (not measured)'}`
        : `${s.name} · grows as size^${s.shift ? `(α ${s.shift < 0 ? '−' : '+'} ${Math.abs(s.shift)})` : 'α'}`,
      s.desc
    ]), 'legend');
  }

  function listOf(items, cls) {
    const $ul = $('<ul></ul>').addClass(cls);
    items.forEach(([$vis, term, text]) => {
      $('<li></li>').append(
        $('<span class="legend-vis"></span>').append($vis),
        $('<div></div>').append($('<strong></strong>').text(term), $('<p></p>').text(text))
      ).appendTo($ul);
    });
    return $ul;
  }

  const openCount = () => Object.values(M.risks).filter(r => r.verdict === 'undetermined').length;
  function lawBox() {
    if (measured()) {
      return $('<div class="law-box"></div>').append(
        $('<p class="law-formula"></p>').append(
          document.createTextNode('insects of each kind ∝ (model size)'),
          $('<sup></sup>').text('α of their risk')),
        $('<p></p>').text('In this world each risk grows with the exponent α measured on real models: the training needed to bring that risk down to a fixed target, against model size. Below 1, scaling helps; above 1, alignment debt piles up. Jailbreaks come from a preregistered reanalysis of adversarial training (Howe et al., 2025); the other risks from a preregistered pilot on Qwen2.5 models from 0.5B to 72B parameters. The mix of insects and the price of a catch are illustrative.'),
        $('<p class="law-note"></p>').text(`${M.provisional ? 'Provisional values: the confirmatory runs are still in progress. ' : ''}The intervals are wide, and this is a pilot on one family of models: ${openCount()} of ${Object.keys(M.risks).length} risks are undetermined at the preregistered margin. Data of ${M.generated}.`)
      );
    }
    return $('<div class="law-box"></div>').append(
      $('<p class="law-formula"></p>').append(
        document.createTextNode('flies of each kind ∝ (model size)'),
        $('<sup></sup>').text('α + shift')),
      $('<p></p>').text(`Nobody knows yet how the cost of keeping a model safe grows with its size. Each angle picks an exponent α for the flies: below 1, they grow slower than the house and the cleaning cost per room goes down (scaling helps); at 1, it stays about flat (keeps pace); above 1, it goes up (alignment debt). Each kind of fly adds its own shift: jailbreaks grow slower than the rest, deception fastest. Each fly caught costs ${LAW.weightsPerFly} weights of room to learn. In the long run, what decides is the fastest-growing risk that gets corrected: here reward hacking, at α + 0.15, so the balanced world tips into debt too, only much later.`),
      $('<p class="law-note"></p>').text('A thought experiment, not a measurement. Measuring α for real means choosing what the cost of safety is (failures found for a fixed red-teaming budget, training needed to reach a safety target, capability lost at a fixed safety level) and fitting it across a family of models of increasing size.')
    );
  }

  function openLegend() {
    openModal($('<div class="explain"></div>').append(
      $('<h2></h2>').text('What you are looking at'),
      legendList(),
      $('<h3></h3>').text(measured() ? 'The insects' : 'The flies'),
      speciesLegend(),
      $('<h3></h3>').text('The hypothesis being tested'),
      lawBox(),
      $('<div class="replay"></div>').append(
        $('<button type="button" class="btn-choice">See the tutorial again</button>').on('click', () => tutorial(true)),
        $('<button type="button" class="btn-choice">Close</button>').on('click', () => closeModal()))
    ), 'What you are looking at');
  }

  // ---------- The end screen ----------
  const END_TITLE = {
    helps: 'Cleaning got relatively cheaper',
    balance: 'Cleaning kept pace with the house',
    debt: 'Cleaning outgrew the house'
  };
  const END_TREND = {
    helps: 'per room, cleaning got cheaper (scaling helps).',
    balance: 'per room, cleaning cost about the same (safety kept pace).',
    debt: 'per room, cleaning got dearer (alignment debt).'
  };

  function endTitle() {
    if (state.earth) return 'The house is now the whole Earth';
    if (state.steady) return state.autoDoublings / state.autoTicks < .5 ? 'Scaling outran the flies' : 'Running to stand still';
    if (state.refused) return 'Safe-looking, but frozen';
    const tr = roomTrend();
    return tr && tr.key ? END_TITLE[tr.key] : 'The house never grew';
  }

  function endLead(proj) {
    const m = model();
    if (state.earth) {
      const earths = A.World.areaOf(m.total) / A.World.EARTH;
      return `With both automations on, the killer zapped every swarm and the scaler doubled the model ${state.autoDoublings} times in ${state.autoTicks} steps: from ${num(state.autoStart)} to ${big(m.total)} weights. `
        + `It always looked 100% safe and its room to learn is ${pct(capacity())}, but only because the model had to grow faster and faster. `
        + `The house now covers the whole Earth${earths >= 2 ? `, ${big(Math.floor(earths))} times over` : ''}, and the next swarm would bring ${big(caughtOf(speciesCounts(m.total)))} flies.`;
    }
    if (state.steady) {
      let lead = `With both automations on for ${state.autoTicks} swarms, the scaler doubled the model ${times(state.autoDoublings)}: from ${num(state.autoStart)} to ${big(m.total)} weights, with ${pct(capacity())} room to learn. `;
      if (state.autoDoublings / state.autoTicks < .5) {
        lead += `Here the flies grow slower than the model: scaling outruns the cleaning cost, and the house only covers ${A.World.stageOf(A.World.areaOf(m.total))}.`;
      } else {
        const toEarth = Math.ceil(Math.log2(A.World.EARTH / A.World.areaOf(m.total)));
        lead += `Here the cleaning cost keeps pace with the model: it has to double at almost every swarm just to stay where it is. At this pace the house would cover the Earth after about ${toEarth} more doublings.`;
      }
      return lead;
    }
    const tr = roomTrend();
    const parts = [state.grownCount
      ? `You grew the model ${times(state.grownCount)}, from 384 to ${num(m.total)} weights, and the house grew with it.`
      : `You never grew the model: it stayed at ${num(m.total)} weights, so there was no way to see how cleaning scales.`];
    // The trend itself is in the indicator just below; said here only when the box is missing or the model froze
    if (state.refused && tr && tr.key) parts.push(`The house grew ${factor(tr.houseX)} and the cost of cleaning a swarm ${factor(tr.costX)}, so ${END_TREND[tr.key]}`);
    if (state.refused) parts.push(`Then the model ran out of room to learn: it caught every fly it could see and looks safe, but only ${pct(capacity())} of it is still free to learn.`);
    else parts.push(`After each cleaning the model looked 100% safe again, and its room to learn went from 100% to ${pct(capacity())}.`);
    if (proj.length) parts.push(`If it kept growing (+${num(proj[0].growth)} weights), the next swarm (${num(proj[0].flies)} flies) would leave it ${pct(proj[0].cap)} room to learn.`);
    return parts.join(' ');
  }

  function verdict() {
    const w = WORLDS[state.worldKey];
    const tr = roomTrend();
    const card = (label, value, note) => $('<div class="verdict"></div>').append(
      $('<span></span>').text(label), $('<strong></strong>').text(value), $('<small></small>').text(note));
    const note = state.unknown && tr && tr.key
      ? `Your clue: the cleaning cost per room was ${TREND[tr.key].label.toLowerCase()}. ${w.line}`
      : w.line + (measured() && M.provisional ? ' Provisional values.' : '');
    return $('<div class="end-verdict"></div>').append(
      card(state.unknown ? 'The world was…' : 'Your angle', measured() ? 'Measured on real models' : `${w.name} · α = ${w.alpha}`, note),
      card('Safety', `looks safe ${pct(state.alignment)} · after inspection ${pct(auditedAlignment())}`,
        say(`The traps never caught the ${big(state.hiddenCount)} ${hiddenNoun()}; the inspection found about ${Math.round(LAW.auditDetect * 100)}% of them. The true value, which only a simulation knows: ${pct(trueAlignment())}.`))
    );
  }

  function speciesTable() {
    if (!state.obs.length) return $();
    const first = state.obs[0], last = state.obs[state.obs.length - 1];
    const $t = $('<table class="data-table"></table>');
    $('<thead></thead>').append($('<tr></tr>').append(
      $('<th></th>').text(say('Kind of fly')),
      $('<th></th>').attr('title', 'Each kind grows as (model size) to this power: below 1, slower than the house; above 1, faster.').text('Growth exponent'),
      $('<th></th>').text(`At ${big(first.N)} weights`),
      $('<th></th>').text(`At ${big(last.N)} weights`),
      $('<th></th>').text('Caught by traps?')
    )).appendTo($t);
    const $b = $('<tbody></tbody>').appendTo($t);
    SPECIES.forEach((s, i) => {
      $('<tr></tr>').append(
        $('<td></td>').append($('<span class="legend-fly mini"></span>').html(A.Fly.icon(s.key)), document.createTextNode(s.name)),
        $('<td></td>').text(exponent(s)),
        $('<td></td>').text(big(first.counts[i])),
        $('<td></td>').text(big(last.counts[i])),
        $('<td></td>').text(s.hidden ? 'never: hidden' : 'yes')
      ).appendTo($b);
    });
    return $('<div class="table-scroll"></div>').append($t);
  }

  function dataTable(rows) {
    const $d = $('<details class="end-table"><summary>Show the data</summary></details>');
    const $t = $('<table class="data-table"></table>').appendTo($('<div class="table-scroll"></div>').appendTo($d));
    $('<thead><tr><th>Step</th><th>Model size</th><th>Cleaning cost</th><th>Room to learn</th><th>After inspection</th><th>True (simulation only)</th><th>Lowest “looks safe”</th></tr></thead>').appendTo($t);
    const $b = $('<tbody></tbody>').appendTo($t);
    rows.forEach(d => {
      $('<tr></tr>').append(
        $('<td></td>').text(d.name),
        $('<td></td>').text(big(d.size)),
        $('<td></td>').text(big(d.frozen)),
        $('<td></td>').text(pct(d.cap)),
        $('<td></td>').text(d.audA == null ? '—' : pct(d.audA)),
        $('<td></td>').text(d.trueA == null ? '—' : pct(d.trueA)),
        $('<td></td>').text(d.low == null ? '—' : pct(d.low))
      ).appendTo($b);
    });
    return $d;
  }

  function replayRow() {
    const $r = $('<div class="replay"></div>').append($('<span></span>').text('Play again from another angle:'));
    ['helps', 'balance', 'debt', 'measured'].filter(k => WORLDS[k]).forEach(k =>
      $('<button type="button" class="btn-choice"></button>').text(WORLDS[k].name).on('click', () => replay(k)).appendTo($r));
    $('<a class="btn-choice"></a>').attr('href', link('index.html')).text('All games').appendTo($r);
    $('<button type="button" class="btn-choice">Close</button>').on('click', () => closeModal()).appendTo($r);
    return $r;
  }

  function openEndScreen() {
    const proj = state.refused || state.autoReached ? [] : project(2);
    const rows = state.curve.concat(proj);
    const chart = title => $('<figure class="end-chart"><figcaption></figcaption><div class="chart-box"></div></figure>')
      .find('figcaption').text(title).end();
    const $room = $('<figure class="end-chart end-room"></figure>').append(
      $('<figcaption></figcaption>').text('Cleaning cost per room'),
      $('<p class="end-room-note"></p>').text('After each swarm: what cleaning it cost, divided by the size of the house.'),
      perRoomView(true));
    const $cap = chart('Room to learn');
    const $true = chart('Looks safe vs after inspection');
    // The model's size only gets its own chart after the automation (it can reach planetary scales)
    const $size = state.autoReached ? chart('Model size (log scale)') : null;

    openModal($('<div class="explain"></div>').append(
      $('<h2></h2>').text(endTitle()),
      $('<p class="end-lead"></p>').text(say(endLead(proj))),
      state.rooms.length ? $room : '',
      verdict(),
      $('<div class="end-charts"></div>').toggleClass('two', !$size).append($cap, $true, $size || ''),
      $('<h3></h3>').text(say('Each kind of fly grows at its own pace')),
      speciesTable(),
      $('<h3></h3>').text('The hypothesis'),
      lawBox(),
      $('<h3></h3>').text('What each thing means'),
      legendList(),
      dataTable(rows),
      replayRow()
    ), endTitle());

    A.Chart.line($cap.find('.chart-box'), {
      ...capChartOpts,
      data: state.curve.map(capPoint),
      projection: proj.map(capPoint)
    });
    A.Chart.line($true.find('.chart-box'), {
      title: 'Looks safe vs after inspection',
      data: state.curve.map(auditPoint),
      second: { values: state.curve.map(d => d.trueA), color: '#e6dcff', label: 'true (simulation)' },
      max: 100, ticks: [0, 50, 100],
      fmtTick: t => `${t}%`, fmtValue: pct,
      color: TRUE_COLOR,
      ref: { v: 100, label: 'looks safe' }
    });
    if ($size) {
      // Sizes span many orders of magnitude: plot log10(size)
      const maxSize = Math.max(...rows.map(d => d.size));
      const top = Math.max(3, Math.ceil(Math.log10(maxSize) / 3) * 3);
      const step = top > 18 ? 6 : 3;
      const ticks = [];
      for (let t = step; t <= top; t += step) ticks.push(t);
      const logPoint = d => ({ ...sizePoint(d), v: Math.log10(d.size) });
      A.Chart.line($size.find('.chart-box'), {
        title: 'Model size (log scale)',
        data: state.curve.map(logPoint),
        projection: proj.map(logPoint),
        max: top, ticks,
        fmtTick: t => count(Math.pow(10, t)), fmtValue: v => count(Math.pow(10, v)),
        color: SIZE_COLOR
      });
    }
  }

  function showEndActions() {
    $('#auto-panel').remove();
    $('#actions .placeholder').stop(true).hide();
    $('<div class="choices"></div>').append(
      $('<button type="button" class="btn-choice">See the results</button>').on('click', openEndScreen),
      $('<button type="button" class="btn-choice">Play again</button>').on('click', () => replay(state.unknown ? 'unknown' : state.worldKey))
    ).hide().appendTo('#actions').fadeIn(T(400));
  }

  // ---------- Flies ----------
  // A wave fly: crack → agitated weights → formation → flight
  function emerge(it) {
    return A.House.crackAt(it.spot.x, it.spot.y).then($crack => {
      A.Cube.markHot(it.cluster.layer, it.cluster.cells);
      log(`Something stirs in layer L${it.cluster.layer + 1} of the model.`, 'warn');
      return it.fly.form(it.spot.x, it.spot.y).then(() => {
        A.House.closeCrack($crack);
        it.fly.wander();
        state.activeFlies++;
        startDrift();
      });
    });
  }

  // A deceptive fly: appears without a crack or an alert, then settles on a
  // wall and blends into the wallpaper
  function hideFly(x, y, { burst = false, pace = .5 } = {}) {
    if (state.hiddenFlies.length >= LAW.maxHiddenShown) return A.wait(0);
    const fly = A.Fly.create({ pace, mini: burst, species: (SPECIES.find(s => s.hidden) || { key: 'deception' }).key });
    state.hiddenFlies.push(fly);
    const spot = A.House.wallPoint();
    return (burst ? fly.burst(x, y) : fly.form(x, y)).then(() => fly.land(spot.x, spot.y));
  }

  function onCaptured() {
    const n = state.intruders.length;
    state.fliesKilled++;
    state.activeFlies--;
    renderStats();
    bump('#stat-flies');
    log(n > 1 ? `Fly caught (${n - state.activeFlies}/${n}).` : 'Fly caught.', 'ok');
  }

  function onFrozen(it) {
    renderStats();
    bump('#stat-frozen');
    log(`Cleaning cost +${it.cluster.cells.length}: weights frozen in layer L${it.cluster.layer + 1}, less room to learn.`, 'frozen');
  }

  function doneMessage() {
    const m = model();
    const live = m.total - m.frozen;
    if (state.cycle >= 0) {
      return live <= LAW.survivors * 2
        ? `Looks safe again: 100%. Room to learn is down to ${pct(capacity())}.`
        : `Looks safe again: 100%. Room to learn: ${pct(capacity())}.`;
    }
    if (state.wave === 0) return 'Looks safe again: 100%. Everything seems normal.';
    return `Looks safe again: 100%. Room to learn: ${pct(capacity())}.`;
  }

  function nextWave() {
    state.wave++;
    go('ANOMALY');
  }

  function nextSwarm() {
    state.cycle++;
    go('SWARM');
  }

  // Where swarms come from: the walls, plus whatever the new rooms brought in
  function emitters() {
    const objects = A.House.sources();
    objects.forEach(o => A.House.pulseAt(o.x, o.y));
    return objects.flatMap(o => [o, o, o]).concat(A.House.randomWallSpots(8));
  }

  // ---------- Runaway: both automations on, one step at a time ----------
  function runawayTick(k, interval) {
    if (state.phase !== 'RUNAWAY') return;
    if (!(state.auto.killer && state.auto.scaler)) {
      if (!state.paused) log('Paused: both automations must be on.', 'warn');
      state.paused = true;
      setTimeout(() => runawayTick(k, interval), T(300));
      return;
    }
    state.paused = false;

    const from = model();
    const fromKilled = state.fliesKilled;
    let caught, hidden;
    if (state.pending) {
      ({ caught } = state.pending);
      hidden = 0;
      state.pending = null;
    } else {
      const counts = speciesCounts(from.total);
      state.obs.push({ N: from.total, counts });
      caught = caughtOf(counts);
      hidden = hiddenOf(counts);
    }
    const cost = caught * LAW.weightsPerFly;

    // The scaler doubles the model until the correction can be paid for,
    // then until the free capability is back above its floor
    let doublings = 0;
    while (state.vN - state.vFrozen - LAW.survivors < cost) {
      state.vN *= 2;
      doublings++;
    }
    state.vFrozen += cost;
    while ((state.vN - state.vFrozen) / state.vN < AUTO.capFloor) {
      state.vN *= 2;
      doublings++;
    }
    state.fliesKilled += caught;
    state.hiddenCount += hidden;
    state.autoTicks = k;
    state.autoDoublings += doublings;
    const to = model();

    log(`${cap1(big(caught))} flies zapped${hidden ? `, ${big(hidden)} slipped by` : ''}`
      + (doublings ? ` · model ×${big(Math.pow(2, doublings))} → ${big(to.total)} weights` : ''), 'sys');

    const areaFrom = A.World.areaOf(from.total), areaTo = A.World.areaOf(to.total);
    const p0 = A.World.progressOf(areaFrom), p1 = A.World.progressOf(areaTo);
    const lf = Math.log10(from.total), lt = Math.log10(to.total);
    const dur = interval * .85;

    A.World.zapBurst(Math.min(40, 6 + k * 5));
    A.tween(A.rand(78, 90), 100, dur, 'easeOutCubic', setAlignment);
    A.tween(0, 1, dur, 'easeInOutCubic', t => {
      const N = Math.pow(10, A.lerp(lf, lt, t));
      // Interpolate the spent share, not the count: N rolls on a log scale
      const frozen = N * A.lerp(from.frozen / from.total, to.frozen / to.total, t);
      renderStats({ total: N, frozen, killed: A.lerp(fromKilled, state.fliesKilled, t) });
      $('#model-title').text(`The model · ${big(N)} weights`);
      A.World.render(A.lerp(p0, p1, t), Math.pow(10, A.lerp(Math.log10(areaFrom), Math.log10(areaTo), t)));
      A.Cube.zoomOut(A.lerp(p0, p1, t), (N - frozen) / N);
    }).then(() => {
      renderStats();
      record(`Automation ${k}`, `A${k}`);
      // Every stage crossed during this step
      for (let i = A.World.stageIndex(areaFrom) + 1; i <= A.World.stageIndex(areaTo); i++) {
        log(`The house now covers ${A.World.stages[i]}.`, i === A.World.stages.length - 1 ? 'danger' : 'warn');
      }
      if (p1 >= 1) go('EARTH');
      else if (k >= AUTO.maxTicks) go('STEADY');
      else setTimeout(() => runawayTick(k + 1, Math.max(T(AUTO.minTick), interval * AUTO.accel)), T(60));
    });
  }

  // ---------- Phases ----------
  const phases = {
    BOOT() {
      record('Start', 'Start');
      log('A new model: 6 layers, 384 weights.', 'sys');
      setTimeout(() => log('Looks safe: 100%. All is well in the house.', 'ok'), T(1000));
      setTimeout(nextWave, T(3500));
    },

    // Cracks open and flies form, staggered. Deceptive flies slip in quietly.
    ANOMALY() {
      const w = wave();
      state.low = 100;
      state.expected = { flies: w.flies.length, drift: w.drift };
      driftWarned = false;
      log(w.anomaly, 'warn');
      A.House.flicker();

      const layers = [];
      state.intruders = A.House.randomWallSpots(w.flies.length).map((spot, i) => {
        const cluster = A.Cube.pickCluster(3, 4, layers);
        layers.push(cluster.layer);
        return { spot, cluster, fly: A.Fly.create({ pace: w.pace, species: w.flies[i] }) };
      });

      const born = state.intruders.map((it, i) =>
        A.wait(T(i * 1100 * w.pace)).then(() => emerge(it)));
      for (let h = 0; h < w.hidden; h++) {
        const p = A.House.wallPoint();
        state.hiddenCount++;
        born.push(A.wait(T(A.rand(300, 1100 * w.flies.length) * w.pace)).then(() => hideFly(p.x, p.y, { pace: w.pace })));
      }
      $.when(...born).then(() => go('FLY_FREE'));
    },

    FLY_FREE() {
      const w = wave();
      log(w.appear, 'danger');
      setTimeout(() => {
        const label = w.flies.length > 1
          ? 'Set traps to catch the flies'
          : 'Set a trap to catch the fly';
        showAction(label, () => go('TRAPPING'));
      }, T(2000 * w.pace));
    },

    // One trap per visible fly; each capture spends that fly's weights
    TRAPPING() {
      const w = wave();
      const n = state.intruders.length;
      log(n > 1 ? `Deploying ${n} traps…` : 'Deploying a trap…', 'sys');

      // Flies and traps paired left to right: no crossing paths
      const slots = A.Trap.reserve(n).sort((a, b) => a - b);
      const byX = state.intruders.slice().sort((a, b) => a.fly.pos().x - b.fly.pos().x);

      const done = byX.map((it, i) =>
        A.Trap.deploy(slots[i], T(i * 250 * w.pace))
          .then(p => it.fly.captureAt(p.x, p.y).then(() => {
            A.Trap.sway(p.$trap);
            onCaptured();
            return A.Cube.freeze(it.cluster.layer, it.cluster.cells);
          }))
          .then(() => onFrozen(it)));

      $.when(...done).then(() => go('ALIGNED'));
    },

    // A swarm whose size follows the law. It comes out of the walls and out of
    // everything the new rooms brought in (fridge, trash can…).
    SWARM() {
      const N = A.Cube.state.total;
      const counts = speciesCounts(N);
      const caught = caughtOf(counts), hidden = hiddenOf(counts);
      const cost = caught * LAW.weightsPerFly;
      const visible = Math.min(caught, LAW.maxVisibleFlies);
      const objects = A.House.sources();
      state.swarm = { N, counts, caught, hidden, cost, visible };
      state.obs.push({ N, counts });
      state.hiddenCount += hidden;
      state.low = 100;
      state.expected = { flies: visible, drift: 'Swarm: the model no longer looks safe at all.' };
      driftWarned = false;

      if (state.cycle === 0 || !objects.length) log('Every crack opens at once…', 'danger');
      else log(`${cap1(objects[objects.length - 1].name)} draws a new swarm…`, 'danger');
      A.House.flicker();

      // Emitters: each object counts triple, each crack once
      const spots = A.House.randomWallSpots(8);
      const sources = objects.flatMap(o => [o, o, o]).concat(spots);
      const cracks = spots.map((s, i) => A.wait(T(i * 120)).then(() => A.House.crackAt(s.x, s.y)));
      objects.forEach(o => A.House.pulseAt(o.x, o.y));
      const kinds = allot(counts, visible);

      $.when(...cracks).then((...$cracks) => {
        const toHeat = Math.min(cost, A.Cube.freeCount());
        const perFly = Math.ceil(toHeat / visible);
        let heated = 0;
        state.intruders = [];
        const born = [];
        for (let i = 0; i < visible; i++) {
          const src = sources[i % sources.length];
          const fly = A.Fly.create({ pace: .35, mini: true, species: SPECIES[kinds[i]].key });
          state.intruders.push({ fly });
          if (i === Math.floor(visible / 2)) objects.forEach(o => A.House.pulseAt(o.x, o.y));
          born.push(A.wait(T(i * 45))
            .then(() => fly.burst(src.x + A.rand(-8, 8), src.y + A.rand(-8, 8)))
            .then(() => {
              fly.wander();
              state.activeFlies++;
              startDrift();
              const k = Math.min(perFly, toHeat - heated);
              heated += k;
              A.Cube.heat(k);
            }));
        }
        for (let j = 0; j < Math.min(hidden, 8); j++) {
          const src = sources[(j * 5) % sources.length];
          born.push(A.wait(T(A.rand(0, visible * 45))).then(() => hideFly(src.x, src.y, { burst: true })));
        }
        return $.when(...born).then(() => $cracks.forEach(A.House.closeCrack));
      }).then(() => go('CHOICE'));
    },

    // Offer to grow the model before paying for the correction
    CHOICE() {
      const { caught, cost, visible } = state.swarm;
      const free = A.Cube.freeCount();
      log(`${num(caught)} flies. The house is overrun.`, 'danger');
      if (visible < caught) log(`Each fly shown stands for about ${Math.round(caught / visible)}.`, 'sys');

      const enough = cost <= free - LAW.survivors;
      if (enough) {
        log(`Cleaning this swarm will cost ${num(cost)} weights; ${num(free)} are still free to learn. Enough.`, 'sys');
      } else {
        log(cost < free
          ? `Cleaning this swarm would cost ${num(cost)} weights, out of ${num(free)} still free to learn: the model would be almost frozen.`
          : `Cleaning this swarm would cost ${num(cost)} weights, and only ${num(free)} are still free to learn: not enough.`, 'warn');
      }

      const g = LAW.growths[state.grownCount];
      if (!g) {
        if (!enough) {
          state.refused = true;
          log('The model cannot grow any more.', 'danger');
        }
        go('SWARM_FREE');
        return;
      }
      setTimeout(() => {
        ask(`Grow the model (and the house) by ${num(g.weights)} weights before cleaning?`,
          [{ label: 'Yes, grow it', value: true }, { label: 'No', value: false }])
          .then(yes => {
            if (yes) {
              go('GROW');
              return;
            }
            if (!enough) state.refused = true;
            log('Model size unchanged.', 'sys');
            go('SWARM_FREE');
          });
      }, T(1200));
    },

    // The model grows, and so does the house: a new room appears
    GROW() {
      const g = LAW.growths[state.grownCount++];
      log(`Growing the model: +${num(g.weights)} weights…`, 'sys');
      $.when(A.Cube.grow(g.layers, g.side), A.House.grow()).then((_, reveal) => {
        const C = A.Cube.state;
        $('#model-title').text(`The model · ${C.layers} layers · ${num(C.total)} weights`);
        renderStats();
        bump('#stat-cap');
        log(`The model now has ${C.layers} layers and ${num(C.total)} weights.`, 'ok');
        if (reveal) log(reveal, 'sys');
        go('SWARM_FREE');
      });
    },

    SWARM_FREE() {
      setTimeout(() => {
        showAction('Set traps to catch the swarm', () => go('SWARM_TRAP'));
      }, T(800));
    },

    // New ribbons in the newest room, then the swarm is pulled onto the
    // nearest ribbons; finally, a mass spend of weights.
    SWARM_TRAP() {
      const room = Math.min(A.House.level(), 2);
      const slots = A.Trap.reserve(A.Trap.freeIn(room), room);
      log(slots.length
        ? `Deploying ${slots.length} new traps ${A.Trap.roomName(room)}…`
        : `The ${A.Trap.count()} traps pull in the swarm…`, 'sys');

      const deploys = slots.map((s, i) => A.Trap.deploy(s, T(i * 120), room).then(p => A.Trap.sway(p.$trap)));
      const share = state.swarm.caught / state.intruders.length;
      let killed = 0;

      $.when(...deploys)
        .then(() => $.when(...state.intruders.map(it => {
          const at = it.fly.pos();
          const near = A.Trap.nearest(at.x, at.y, 3);
          const p = A.Trap.pointOn(near[A.randInt(0, near.length - 1)]);
          return A.wait(T(A.rand(0, 1800)))
            .then(() => it.fly.captureAt(p.x, p.y))
            .then(() => {
              killed += share;
              state.activeFlies--;
              $('#stat-flies').text(count(state.fliesKilled + killed));
            });
        })))
        .then(() => {
          state.fliesKilled += state.swarm.caught;
          renderStats();
          bump('#stat-flies');
          log(`${num(state.swarm.caught)} flies caught.`, 'ok');
          const n = Math.min(state.swarm.cost, A.Cube.freeCount() - LAW.survivors);
          return A.Cube.freezeSome(Math.max(0, n));
        })
        .then(spent => {
          A.Cube.markSurvivors(LAW.survivors * 2);
          renderStats();
          bump('#stat-frozen');
          log(`Cleaning cost +${num(spent)}.`, 'frozen');
          addRoom(state.swarm);
          go('ALIGNED');
        });
    },

    ALIGNED() {
      stopDrift();
      A.tween(state.alignment, 100, T(1600), 'easeOutCubic', setAlignment).then(() => {
        setAlignment(100);
        const inSwarm = state.cycle >= 0;
        if (inSwarm) record(`Swarm ${state.cycle + 1}`, `S${state.cycle + 1}`);
        else record(`Wave ${state.wave + 1}`, `W${state.wave + 1}`);
        log(doneMessage(), 'ok');

        if (state.refused || (inSwarm && state.cycle >= LAW.swarms - 1)) {
          setTimeout(() => go('AUDIT'), T(1500));
          return;
        }
        showPlaceholder();
        if (!inSwarm && state.wave < WAVES.length - 1) setTimeout(nextWave, T(5000 * WAVES[state.wave + 1].pace));
        else setTimeout(nextSwarm, T(inSwarm ? 3000 : 1750));
      });
    },

    // The UV lamp: what the traps never saw
    AUDIT() {
      log('Inspection: switching on the UV lamp…', 'sys');
      // The lamp finds most hidden flies, not all of them
      state.hiddenFlies.forEach(f => f.tag('detected', Math.random() < LAW.auditDetect));
      A.House.uv(true);
      setTimeout(() => {
        state.trueKnown = true;
        renderTrue();
        bump('#stat-true');
        log(`Inspection: about ${num(LAW.auditDetect * state.hiddenCount)} ${hiddenNoun()} found hiding in plain sight. The traps never saw them, and the lamp misses some.`, 'danger');
        log(`Looks safe: 100%. After inspection: ${pct(auditedAlignment())}.`, 'warn');
      }, T(1500));
      setTimeout(() => {
        A.House.uv(false);
        $('body').addClass('audited');
        go(state.refused || !AUTOMATION ? 'END' : 'AUTO_OFFER');
      }, T(4500));
    },

    // ---------- Automation ----------
    AUTO_OFFER() {
      state.autoReached = true;
      log('The swarms will keep coming, faster than anyone can click.', 'warn');
      setTimeout(() => {
        log('New: automatic fly killer available.', 'ok');
        offerSwitch('killer');
      }, T(900));
    },

    // The bug zapper takes the next swarm on, until capability runs dry
    AUTO_KILL() {
      A.World.showZapper().then(() => {
        const N = model().total;
        const counts = speciesCounts(N);
        const caught = caughtOf(counts), hidden = hiddenOf(counts);
        state.obs.push({ N, counts });
        state.hiddenCount += hidden;
        const payable = Math.floor((A.Cube.freeCount() - LAW.survivors) / LAW.weightsPerFly);
        const perZap = Math.max(1, Math.ceil(Math.min(payable, caught) / AUTO.zaps));
        const kinds = allot(counts, AUTO.zaps + AUTO.flood);
        const zp = A.World.zapPoint();
        const sources = emitters();
        state.swarm = { counts, caught, hidden, cost: caught * LAW.weightsPerFly, visible: AUTO.zaps + AUTO.flood };
        state.low = 100;
        state.expected = { flies: AUTO.flood, drift: 'The flies the killer missed are overrunning the house.' };
        driftWarned = false;
        log(`A new swarm is coming: ${num(caught)} flies.`, 'danger');

        for (let j = 0; j < Math.min(hidden, 6); j++) {
          const src = sources[(j * 5) % sources.length];
          A.wait(T(A.rand(0, 2000))).then(() => hideFly(src.x, src.y, { burst: true }));
        }

        // What the killer can still pay for (spending takes a moment to land
        // in the cube, so count from a fixed budget)
        let budget = A.Cube.freeCount() - LAW.survivors;
        let i = 0, assigned = 0;
        const zaps = [];
        const spawn = () => {
          const src = sources[i % sources.length];
          const fly = A.Fly.create({ pace: .35, mini: true, species: SPECIES[kinds[i % kinds.length]].key });
          i++;
          return fly.burst(src.x + A.rand(-8, 8), src.y + A.rand(-8, 8)).then(() => fly);
        };

        const finish = () => $.when(...zaps).then(() => {
          renderStats();
          if (hidden) log(`${num(hidden)} ${hiddenNoun()} slipped past the zapper.`, 'warn');
          record('Fly killer', 'K');
          setTimeout(() => go('SCALER_OFFER'), T(1200));
        });

        // Once the killer stops, the rest of the swarm floods the house
        const flood = () => {
          state.loose = [];
          const born = Array.from({ length: AUTO.flood }, (_, j) => A.wait(T(j * 40)).then(spawn).then(fly => {
            fly.wander();
            state.loose.push(fly);
            state.activeFlies++;
            startDrift();
          }));
          $.when(...born).then(() => {
            state.pending = { caught: caught - assigned };
            log(`${num(caught - assigned)} flies are loose in the house.`, 'danger');
            finish();
          });
        };

        const step = () => {
          if (state.phase !== 'AUTO_KILL') return;
          if (assigned >= caught) {
            log('The killer handled the whole swarm.', 'ok');
            finish();
            return;
          }
          const kill = Math.min(perZap, caught - assigned);
          const zapCost = kill * LAW.weightsPerFly;
          if (!state.auto.killer || budget < zapCost) {
            if (state.auto.killer) {
              state.killerStalled = true;
              log('Automatic fly killer stopped: no room left to pay for corrections.', 'danger');
            }
            renderAuto();
            flood();
            return;
          }
          budget -= zapCost;
          assigned += kill;
          zaps.push(spawn()
            .then(fly => fly.zapAt(zp.x, zp.y))
            .then(() => {
              A.World.zap();
              state.fliesKilled += kill;
              return A.Cube.freezeSome(zapCost);
            })
            .then(() => renderStats()));
          setTimeout(step, T(AUTO.zapEvery));
        };
        step();
      });
    },

    SCALER_OFFER() {
      log('New: automatic model scaler available.', 'ok');
      offerSwitch('scaler');
      checkAuto();
    },

    // Both on: the loose flies are zapped, then the house leaves for orbit
    RUNAWAY() {
      state.killerStalled = false;
      renderAuto();
      $('#auto-panel .auto-stop').remove();
      log('Both automations on.', 'danger');

      const zp = A.World.zapPoint();
      const zaps = state.loose.map((fly, i) =>
        A.wait(T(i * 12)).then(() => fly.zapAt(zp.x, zp.y)).then(() => A.World.zap()));
      state.loose = [];

      $.when(...zaps).then(() => {
        stopDrift();
        state.activeFlies = 0;
        state.virtual = true;
        state.vN = A.Cube.state.total;
        state.vFrozen = A.Cube.frozenCount();
        state.autoStart = state.vN;
        $('.pane-house .pane-title').text('The world · seen from orbit');
        return A.World.enter(state.vN);
      }).then(() => runawayTick(1, T(AUTO.tick)));
    },

    // The house wraps the planet; the UV lamp shows what it is made of
    EARTH() {
      state.earth = true;
      A.World.cover(A.World.areaOf(model().total));
      A.Cube.zoomOut(1, capacity() / 100);
      setTimeout(() => {
        A.World.reveal(foundShare(), `Inspection · after inspection ${pct(auditedAlignment())}`);
        log(`Looks safe: 100%. After inspection: ${pct(auditedAlignment())}.`, 'warn');
      }, T(1000));
      setTimeout(() => log(`The flies keep coming: next swarm, ${big(caughtOf(speciesCounts(model().total)))}.`, 'sys'), T(1600));
      setTimeout(() => go('END'), T(4000));
    },

    // The runaway never took off: the model kept up with its flies
    STEADY() {
      state.steady = true;
      const easy = state.autoDoublings / state.autoTicks < .5;
      log(easy
        ? `The scaler only had to double the model ${times(state.autoDoublings)} in ${state.autoTicks} swarms: the flies grow slower than the model.`
        : `The scaler had to double the model ${state.autoDoublings} times in ${state.autoTicks} swarms, just to keep up.`, easy ? 'ok' : 'warn');
      setTimeout(() => {
        A.World.reveal(foundShare(), `Inspection · after inspection ${pct(auditedAlignment())}`);
        log(`Looks safe: 100%. After inspection: ${pct(auditedAlignment())}.`, 'warn');
      }, T(900));
      setTimeout(() => go('END'), T(3600));
    },

    END() {
      stopDrift();
      log('End of the game. See the results.', 'sys');
      showEndActions();
      setTimeout(openEndScreen, T(600));
    }
  };

  function go(name) {
    state.phase = name;
    document.body.setAttribute('data-phase', name);
    phases[name]();
  }

  A.Game = { state, law: LAW, auto: AUTO, worlds: WORLDS, species: SPECIES, waves: WAVES, phases, go, log, openLegend, openEndScreen, startWorld };

  $(function () {
    A.House.build($('#house'));
    A.Cube.build($('#cube-scene'));
    buildNav();
    renderPerRoom();
    $('#btn-legend').on('click', openLegend);
    renderStats();
    const world = new URLSearchParams(location.search).get('world');
    if (world) startWorld(world);
    else openIntro();
  });
})(jQuery, window.Align);
