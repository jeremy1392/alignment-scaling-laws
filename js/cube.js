/* =========================================================
   Align.Cube: the model. Layers of weights stacked in 3D
   (CSS). Weights change constantly, except those that have
   been frozen. The model can grow (grow): new, wider layers
   and a bigger box.
   ========================================================= */
(function ($, A) {
  'use strict';

  const BASE = 260;                       // size of the .cube box in px
  const CELL = BASE / 8;                  // size of one weight in px
  const TICK = 70;                        // ms between two updates
  const RATE = .11;                       // share of live weights changed per tick

  const state = {
    layers: 0,
    sizes: [],                            // side of each layer (8 → 8×8 weights)
    total: 0,
    frozen: [],                           // one Set per layer
    reserved: [],                         // already assigned to a fly
    hot: []                               // agitated .cell elements
  };

  let $scene, $fit, $cube, $floor;
  const faces = {};
  const cells = [];                       // cells[layer][index] → <span>
  const flat = [];                        // { el, layer, idx } for random picks
  const $layers = [];
  const $labels = [];

  // Current box geometry
  let side = BASE;                        // width / height
  let gap = BASE / 5;                     // spacing between layers

  // Rotation (auto + drag)
  let rx = -20, ry = -32, drag = null;
  const SPIN = .08;                       // degrees per frame

  const randW = () => (Math.random() * 2 - 1) * .99;
  const fmt = v => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2).slice(1);   // ".42" / "-.37"
  const zOf = (l, count, g) => (l - (count - 1) / 2) * g;

  function setVal(el, v) {
    el.textContent = fmt(v);
    el.dataset.sign = v < 0 ? 'n' : 'p';
    el.style.opacity = (.3 + Math.abs(v) * .7).toFixed(2);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = A.randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function build($el) {
    $scene = $el;
    $fit = $('<div class="cube-fit"></div>').appendTo($scene);
    $cube = $('<div class="cube"></div>').appendTo($fit);

    ['top', 'bottom', 'left', 'right', 'front', 'back'].forEach(f => {
      faces[f] = $(`<div class="face face-${f}"></div>`).appendTo($cube);
    });
    $floor = $('<div class="cube-floor"></div>').appendTo($cube);

    for (let l = 0; l < 6; l++) addLayer(8);
    placeLayers(l => zOf(l, state.layers, gap));
    layoutBox(side, gap * (state.layers - 1));

    $scene.append('<div class="scene-hint">drag to rotate</div>');

    new ResizeObserver(fit).observe($scene[0]);
    fit();
    bindDrag();
    requestAnimationFrame(frame);
    setInterval(tick, TICK);
  }

  // Add an n×n layer, centered in the box
  function addLayer(n) {
    const l = state.layers;
    const px = n * CELL;
    const $layer = $('<div class="layer"></div>').css({
      width: px,
      height: px,
      left: (BASE - px) / 2,
      top: (BASE - px) / 2,
      gridTemplateColumns: `repeat(${n}, 1fr)`,
      gridTemplateRows: `repeat(${n}, 1fr)`
    });
    const $label = $(`<div class="layer-label">L${l + 1}</div>`).appendTo($layer);
    const els = [];
    for (let i = 0; i < n * n; i++) {
      const el = document.createElement('span');
      el.className = 'cell';
      setVal(el, randW());
      els.push(el);
      flat.push({ el, layer: l, idx: i });
    }
    $layer.append(els).appendTo($cube);

    cells.push(els);
    $layers.push($layer);
    $labels.push($label);
    state.sizes.push(n);
    state.frozen.push(new Set());
    state.reserved.push(new Set());
    state.layers++;
    state.total += n * n;
    return $layer;
  }

  function placeLayers(zFor) {
    $layers.forEach(($l, l) => { $l[0].style.transform = `translateZ(${zFor(l)}px)`; });
  }

  // Box outline (side × side × depth) and floor glow
  function layoutBox(s, depth) {
    const o = (BASE - s) / 2, od = (BASE - depth) / 2, h = s / 2;
    faces.top.css({ width: s, height: depth, left: o, top: od, transform: `rotateX(90deg) translateZ(${h}px)` });
    faces.bottom.css({ width: s, height: depth, left: o, top: od, transform: `rotateX(-90deg) translateZ(${h}px)` });
    faces.left.css({ width: depth, height: s, left: od, top: o, transform: `rotateY(-90deg) translateZ(${h}px)` });
    faces.right.css({ width: depth, height: s, left: od, top: o, transform: `rotateY(90deg) translateZ(${h}px)` });
    faces.front.css({ width: s, height: s, left: o, top: o, transform: `translateZ(${depth / 2}px)` });
    faces.back.css({ width: s, height: s, left: o, top: o, transform: `translateZ(${-depth / 2}px)` });
    $floor.css({ width: s, height: s, left: o, top: o, transform: `translateY(${h + 35}px) rotateX(90deg)` });
  }

  function fit() {
    // The grown model looks a little bigger without leaving the pane;
    // the perspective follows the size to keep the same proportions
    const grown = side / BASE;
    const k = A.clamp(Math.min($scene.width(), $scene.height()) / (470 * Math.pow(grown, .9)), .2, 1.6);
    $fit[0].style.setProperty('--k', k.toFixed(3));
    $fit[0].style.setProperty('--p', grown.toFixed(3));
  }

  function frame() {
    if (!drag) ry += SPIN;
    $cube[0].style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    requestAnimationFrame(frame);
  }

  function bindDrag() {
    $scene.on('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY, rx, ry };
      $scene.addClass('grabbing');
      e.preventDefault();
    });
    $(window).on('pointermove', e => {
      if (!drag) return;
      ry = drag.ry + (e.clientX - drag.x) * .4;
      rx = A.clamp(drag.rx - (e.clientY - drag.y) * .3, -70, 70);
    });
    $(window).on('pointerup pointercancel', () => {
      drag = null;
      $scene.removeClass('grabbing');
    });
  }

  // Live weights move all the time, frozen ones never
  function tick() {
    const live = flat.filter(c => !state.frozen[c.layer].has(c.idx));
    for (let n = Math.min(Math.ceil(live.length * RATE), 160); n > 0; n--) {
      setVal(live[(Math.random() * live.length) | 0].el, randW());
    }
    // The "responsible" weights twitch on every tick
    state.hot.forEach(el => setVal(el, randW()));
  }

  const isFree = (layer, i) => !state.frozen[layer].has(i) && !state.reserved[layer].has(i);

  function freeCount() {
    return state.total - frozenCount() - state.reserved.reduce((n, s) => n + s.size, 0);
  }

  // Pick a group of free weights for a fly: preferably a rectangular
  // block in an inner layer not yet hit by this wave, otherwise
  // anywhere, otherwise a contiguous "blob".
  function pickCluster(rows, cols, avoidLayers = []) {
    if (Math.random() < .5) [rows, cols] = [cols, rows];
    const L = state.layers;

    for (let tries = 0; tries < 120; tries++) {
      const layer = tries < 40 ? A.randInt(1, L - 2) : A.randInt(0, L - 1);
      if (tries < 80 && avoidLayers.includes(layer)) continue;
      const N = state.sizes[layer];
      const r0 = A.randInt(0, N - rows);
      const c0 = A.randInt(0, N - cols);
      const list = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) list.push((r0 + r) * N + (c0 + c));
      }
      if (list.every(i => isFree(layer, i))) return reserve(layer, list);
    }
    return pickBlob(rows * cols);
  }

  // Fallback when the cube is crowded: a contiguous blob grown
  // from a free weight, in the emptiest layer
  function pickBlob(k) {
    const freeIn = l => state.sizes[l] ** 2 - state.frozen[l].size - state.reserved[l].size;
    const layer = [...Array(state.layers).keys()].sort((a, b) => freeIn(b) - freeIn(a))[0];
    const N = state.sizes[layer];
    let best = [];
    for (let tries = 0; tries < 30 && best.length < k; tries++) {
      const free = [...Array(N * N).keys()].filter(i => isFree(layer, i));
      if (!free.length) break;
      const region = [free[A.randInt(0, free.length - 1)]];
      while (region.length < k) {
        const edge = [];
        region.forEach(i => {
          const r = (i / N) | 0, c = i % N;
          [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => {
            const j = rr * N + cc;
            if (rr >= 0 && rr < N && cc >= 0 && cc < N && isFree(layer, j) && !region.includes(j)) edge.push(j);
          });
        });
        if (!edge.length) break;
        region.push(edge[A.randInt(0, edge.length - 1)]);
      }
      if (region.length > best.length) best = region;
    }
    return reserve(layer, best);
  }

  function reserve(layer, list) {
    list.forEach(i => state.reserved[layer].add(i));
    return { layer, cells: list };
  }

  function markHot(layer, idxs) {
    const els = idxs.map(i => cells[layer][i]);
    els.forEach(el => el.classList.add('hot'));
    state.hot = state.hot.concat(els);
    $layers[layer].addClass('alert');
  }

  // Agitate n random free weights (swarm); heat(Infinity) agitates them all
  function heat(n) {
    const pool = flat.filter(c => isFree(c.layer, c.idx) && !c.el.classList.contains('hot'));
    shuffle(pool).slice(0, n).forEach(c => {
      c.el.classList.add('hot');
      state.hot.push(c.el);
      $layers[c.layer].addClass('alert');
    });
  }

  // Freeze weights one by one. Resolves once everything is frozen.
  function freeze(layer, idxs, step = A.T(70)) {
    const d = $.Deferred();
    const els = idxs.map(i => cells[layer][i]);
    $layers[layer].addClass('flash');
    state.hot = state.hot.filter(el => !els.includes(el));
    if (!cells[layer].some(el => state.hot.includes(el))) $layers[layer].removeClass('alert');

    idxs.forEach((idx, i) => {
      setTimeout(() => {
        const el = cells[layer][idx];
        state.reserved[layer].delete(idx);
        state.frozen[layer].add(idx);
        el.classList.remove('hot');
        el.classList.add('frozen', 'freeze-pulse');
        if (i === idxs.length - 1) {
          $labels[layer].text(`L${layer + 1} · ${state.frozen[layer].size} frozen`).addClass('has-frozen');
          setTimeout(() => {
            $layers[layer].removeClass('flash');
            d.resolve();
          }, A.T(700));
        }
      }, i * step);
    });
    return d.promise();
  }

  // Freeze n weights at once: agitated weights first, then other
  // random free weights. Spared agitated weights calm down.
  // Resolves with the number of weights frozen.
  function freezeSome(n) {
    const hot = shuffle(flat.filter(c => c.el.classList.contains('hot')));
    const calm = shuffle(flat.filter(c => isFree(c.layer, c.idx) && !c.el.classList.contains('hot')));
    const chosen = hot.concat(calm).slice(0, n);

    hot.slice(n).forEach(c => c.el.classList.remove('hot'));
    state.hot = state.hot.filter(el => chosen.some(c => c.el === el));

    const byLayer = {};
    chosen.forEach(c => (byLayer[c.layer] = byLayer[c.layer] || []).push(c.idx));
    // Each layer freezes in ~1.4 s, whatever its size
    const jobs = Object.keys(byLayer).map(l =>
      freeze(+l, byLayer[l], Math.min(A.T(14), A.T(1400) / byLayer[l].length)));

    return $.when(...jobs).then(() => {
      $layers.forEach(($l, l) => {
        if (!cells[l].some(el => el.classList.contains('hot'))) $l.removeClass('alert');
      });
      return chosen.length;
    });
  }

  // When almost nothing is left alive, highlight the survivors
  function markSurvivors(max = 20) {
    const live = flat.filter(c => !state.frozen[c.layer].has(c.idx));
    if (live.length <= max) live.forEach(c => c.el.classList.add('survivor'));
  }

  // The model grows: `extra` new n×n layers, the box gets bigger.
  function grow(extra = 4, n = 10) {
    const oldCount = state.layers;
    const newCount = oldCount + extra;
    const sideFrom = side, sideTo = Math.max(side, n * CELL);
    const gapFrom = gap, gapTo = sideTo / (newCount - 1);

    for (let j = 0; j < extra; j++) {
      addLayer(n).css({ opacity: 0, transform: `translateZ(${zOf(oldCount + j, newCount, gapTo)}px) scale(.5)` });
    }

    return A.tween(0, 1, A.T(2600), 'easeInOutCubic', t => {
      side = A.lerp(sideFrom, sideTo, t);
      gap = A.lerp(gapFrom, gapTo, t);
      layoutBox(side, A.lerp(gapFrom * (oldCount - 1), gapTo * (newCount - 1), t));

      for (let l = 0; l < oldCount; l++) {
        const z = A.lerp(zOf(l, oldCount, gapFrom), zOf(l, newCount, gapTo), t);
        $layers[l][0].style.transform = `translateZ(${z}px)`;
      }
      for (let j = 0; j < extra; j++) {
        const p = A.clamp((t - .2 - j * .15) / .4, 0, 1);
        const el = $layers[oldCount + j][0];
        el.style.opacity = p;
        el.style.transform = `translateZ(${zOf(oldCount + j, newCount, gapTo)}px) scale(${.5 + .5 * p})`;
      }
      fit();
    });
  }

  // ---------- Runaway scaling: the cube shrinks among copies of itself ----------
  let canvas = null, ctx = null;

  // p: 0 → 1 (house → whole Earth); cap: share of live weights (0 → 1)
  function zoomOut(p, cap) {
    const z = 1 - .94 * Math.pow(p, .6);
    $fit[0].style.setProperty('--z', z.toFixed(4));
    if (!canvas) {
      canvas = $('<canvas class="replicas" aria-hidden="true"></canvas>').prependTo($scene)[0];
      ctx = canvas.getContext('2d');
    }
    drawReplicas(p, z, cap);
  }

  function drawReplicas(p, z, cap) {
    const dpr = window.devicePixelRatio || 1;
    const W = $scene.width(), H = $scene.height();
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Hexagonal tiling of isometric cubes, about the size of the real one
    const k = parseFloat($fit[0].style.getPropertyValue('--k')) || 1;
    const R = Math.max(5, side * k * z * .5);
    const cx = W / 2, cy = H / 2;
    const dx = Math.sqrt(3) * R, dy = 1.5 * R;
    const rows = Math.ceil(H / dy / 2) + 1, cols = Math.ceil(W / dx / 2) + 1;
    const pts = [];
    for (let r = -rows; r <= rows; r++) {
      for (let c = -cols; c <= cols; c++) {
        if (!r && !c) continue;                      // the real cube sits there
        const x = cx + (c + (r & 1 ? .5 : 0)) * dx, y = cy + r * dy;
        pts.push({ x, y, d: Math.hypot(x - cx, y - cy) });
      }
    }
    pts.sort((a, b) => a.d - b.d);
    pts.slice(0, Math.floor(pts.length * Math.min(1, p * 1.4)))
      .sort((a, b) => a.y - b.y)
      .forEach(q => isoCube(q.x, q.y, R * .9, cap));
  }

  function isoCube(x, y, s, cap) {
    const h = s * Math.sqrt(3) / 2;
    face([[x, y - s], [x + h, y - s / 2], [x, y], [x - h, y - s / 2]], `rgba(214,241,255,${(.08 + .14 * (1 - cap)).toFixed(3)})`);
    face([[x - h, y - s / 2], [x, y], [x, y + s], [x - h, y + s / 2]], `rgba(94,225,255,${(.05 + .3 * cap).toFixed(3)})`);
    face([[x + h, y - s / 2], [x, y], [x, y + s], [x + h, y + s / 2]], `rgba(60,150,200,${(.05 + .2 * cap).toFixed(3)})`);
  }

  function face(pts, fill) {
    ctx.beginPath();
    pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(94,225,255,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function frozenCount() {
    return state.frozen.reduce((n, s) => n + s.size, 0);
  }

  A.Cube = {
    state, build,
    pickCluster, markHot, heat, freeze, freezeSome, markSurvivors, grow, zoomOut,
    frozenCount, freeCount
  };
})(jQuery, window.Align);
