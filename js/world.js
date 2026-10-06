/* =========================================================
   Align.World: what happens to the world once correction and
   scaling are automated.
   - the bug zapper that stands in the living room;
   - the zoom out from the house to the whole planet: the
     house grows with the model (its area is proportional to
     the number of weights) until it wraps the Earth.
   ========================================================= */
(function ($, A) {
  'use strict';

  const T = A.T;

  // ---------- The bug zapper ----------
  const ZAPPER = { x: 790, y: 505 };      // bottom center, on the living room floor
  let $zapper = null;

  function showZapper() {
    if ($zapper) return A.wait(0);
    $zapper = $(`
      <div class="zapper">
        <div class="zapper-cap"></div>
        <div class="zapper-body"></div>
        <div class="zapper-base"></div>
      </div>`)
      .css({ left: ZAPPER.x, top: ZAPPER.y, opacity: 0 })
      .appendTo(A.House.stage());
    $zapper.animate({ opacity: 1 }, T(300));
    return A.tween(.3, 1, T(700), 'easeOutBack', s => $zapper.css('transform', `scale(${s})`));
  }

  // Where flies get zapped: the middle of the glowing grid
  const zapPoint = () => ({ x: ZAPPER.x, y: ZAPPER.y - 75 });

  function zap() {
    const p = zapPoint();
    const $f = $('<div class="zap-flash"></div>').css({ left: p.x, top: p.y }).appendTo(A.House.stage());
    setTimeout(() => $f.remove(), 400);
    if ($zapper) {
      $zapper.removeClass('hit');
      void $zapper[0].offsetWidth;
      $zapper.addClass('hit');
    }
  }

  // ---------- From the house to the planet ----------
  const G = { cx: 300, cy: 300, r: 220 };      // the globe, in the SVG's 600×600 space
  const PATCH = { x: 322, y: 178 };            // where the house stands (Western Europe)
  const A0 = 30;                               // m²: the original living room
  const EARTH = 5.1e14;                        // m²: surface of the Earth
  const M2_PER_WEIGHT = A0 / 384;              // the house grows with the model
  const STAGES = [
    [1e3, 'a street'],
    [1e5, 'a neighborhood'],
    [1e8, 'a city (≈ Paris)'],
    [1e10, 'a region'],
    [5.5e11, 'a country (≈ France)'],
    [1e13, 'a continent (≈ Europe)'],
    [EARTH, 'the whole Earth']
  ];
  const ZMAX = 40;
  const R_END = 360;                           // patch radius that covers the whole disk
  const RIBBONS = 260;
  const FLIES = 60;

  const areaOf = weights => weights * M2_PER_WEIGHT;
  const progressOf = area => A.clamp(
    (Math.log10(area) - Math.log10(A0)) / (Math.log10(EARTH) - Math.log10(A0)), 0, 1);
  const stageIndex = area => STAGES.reduce((k, [a], i) => (area >= a ? i : k), -1);
  const stageOf = area => (stageIndex(area) < 0 ? 'a large house' : STAGES[stageIndex(area)][1]);
  const patchR = p => 1.5 + (R_END - 1.5) * Math.pow(p, 1.6);

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let $world = null, svg, cam, patch, pattern, ribbonEls = [], flyEls = [], zapLayer;
  let ribbons = [], flies = [];
  let cur = { p: 0, r: 1.5, z: ZMAX };
  let rafId = null;
  let lastStage = null;

  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  };

  function build() {
    if ($world) return;
    const stars = Array.from({ length: 90 }, () =>
      `<circle cx="${A.rand(0, 600).toFixed(1)}" cy="${A.rand(0, 600).toFixed(1)}" r="${A.rand(.4, 1.3).toFixed(2)}" opacity="${A.rand(.3, .9).toFixed(2)}"/>`).join('');

    $world = $(`
      <div class="world" aria-hidden="true">
        <svg class="world-svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="w-ocean" cx="40%" cy="35%" r="75%">
              <stop offset="0" stop-color="#3b8fd6"/>
              <stop offset=".6" stop-color="#1a5a9e"/>
              <stop offset="1" stop-color="#0b2547"/>
            </radialGradient>
            <radialGradient id="w-atmo">
              <stop offset=".86" stop-color="#5eb4ff" stop-opacity="0"/>
              <stop offset=".93" stop-color="#5eb4ff" stop-opacity=".35"/>
              <stop offset="1" stop-color="#5eb4ff" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="w-shade" cx="38%" cy="32%" r="80%">
              <stop offset=".55" stop-color="#000" stop-opacity="0"/>
              <stop offset="1" stop-color="#000" stop-opacity=".5"/>
            </radialGradient>
            <clipPath id="w-clip"><circle cx="300" cy="300" r="220"/></clipPath>
            <pattern id="w-wp" width="48" height="48" patternUnits="userSpaceOnUse">
              <rect width="48" height="48" fill="#f1e0bf"/>
              <rect width="3" height="48" fill="#e9d4ab"/>
              <path d="M36 18 l4 6 l-4 6 l-4 -6z" fill="#e3c998"/>
            </pattern>
          </defs>
          <g fill="#fff">${stars}</g>
          <g class="w-cam">
            <circle cx="300" cy="300" r="250" fill="url(#w-atmo)"/>
            <g clip-path="url(#w-clip)">
              <circle cx="300" cy="300" r="220" fill="url(#w-ocean)"/>
              <g fill="#5f9c58">
                <path d="M150 150 C170 120 230 105 280 120 C300 130 295 160 270 175 C255 185 250 205 235 225 C220 245 205 250 195 240 C185 225 170 215 160 195 C150 180 140 165 150 150Z"/>
                <path d="M240 255 C255 250 270 262 285 280 C300 300 305 330 295 360 C285 390 270 420 258 425 C250 410 252 380 245 350 C238 320 228 290 240 255Z"/>
                <path d="M285 95 C300 88 320 92 318 108 C310 118 292 116 285 105Z"/>
                <path d="M305 160 C315 145 340 140 360 150 C372 158 366 172 352 178 C345 190 330 200 318 196 C306 190 300 175 305 160Z"/>
                <path d="M310 215 C330 205 360 210 378 225 C392 245 385 275 372 300 C360 330 345 360 335 365 C325 350 320 320 312 295 C300 270 295 240 310 215Z"/>
                <path d="M365 140 C400 120 450 118 490 135 C510 150 505 175 490 190 C470 205 460 225 440 235 C420 245 395 240 385 225 C372 210 375 190 368 175 C360 160 355 150 365 140Z"/>
                <path d="M420 238 C430 236 440 245 436 262 C432 275 424 280 420 268 C415 255 412 245 420 238Z"/>
                <path d="M445 330 C465 320 495 325 500 345 C502 362 485 372 465 368 C450 365 440 350 445 330Z"/>
                <path d="M200 500 C260 485 340 485 400 500 C360 512 240 512 200 500Z" fill="#e8f1f5"/>
              </g>
              <path class="w-patch" fill="url(#w-wp)" stroke="#fbf3e4"/>
              <g class="w-ribbons" fill="#f6cb37"></g>
              <circle cx="300" cy="300" r="220" fill="url(#w-shade)"/>
              <circle class="w-uv" cx="300" cy="300" r="220" fill="#1c0a3d"/>
              <g class="w-hidden" fill="#f1ddff"></g>
            </g>
            <g class="w-zaps"></g>
            <g class="w-flies" fill="#111" stroke="rgba(255,255,255,.55)"></g>
          </g>
        </svg>
        <div class="world-caption">
          <span>House footprint</span>
          <strong></strong>
          <span class="cap-stage"></span>
          <span class="cap-true"></span>
        </div>
      </div>`).hide().appendTo('.pane-house');

    svg = $world.find('svg')[0];
    cam = svg.querySelector('.w-cam');
    patch = svg.querySelector('.w-patch');
    pattern = svg.querySelector('#w-wp');
    zapLayer = svg.querySelector('.w-zaps');

    // Ribbons scattered over the house's footprint (uniform over the area)
    const $rib = svg.querySelector('.w-ribbons');
    ribbons = Array.from({ length: RIBBONS }, () => ({ u: Math.sqrt(Math.random()), a: A.rand(0, Math.PI * 2) }));
    ribbonEls = ribbons.map(() => svgEl('rect', { visibility: 'hidden' }, $rib));

    const $flies = svg.querySelector('.w-flies');
    flies = Array.from({ length: FLIES }, () => ({ a: A.rand(0, Math.PI * 2), w: A.rand(-1.2, 1.2), ph: A.rand(0, 6) }));
    flyEls = flies.map(() => svgEl('circle', { r: 1 }, $flies));
  }

  // The house's outline: a slightly irregular blob
  function blob(cx, cy, r) {
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 2;
      const rr = r * (1 + .05 * Math.sin(3 * a + 1) + .035 * Math.sin(7 * a));
      d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
    }
    return `${d}Z`;
  }

  const areaText = area => (area < 1e6 ? `${A.num(area)} m²` : `${A.big(area / 1e6)} km²`);

  // Draws the scene for a progress p (0 = a house, 1 = the whole Earth)
  function render(p, area) {
    const r = patchR(p);
    const z = A.clamp(60 / r, 1, ZMAX);
    const f = (z - 1) / (ZMAX - 1);
    const fx = A.lerp(G.cx, PATCH.x, f), fy = A.lerp(G.cy, PATCH.y, f);
    cur = { p, r, z };

    cam.setAttribute('transform', `translate(300 300) scale(${z.toFixed(4)}) translate(${-fx} ${-fy})`);
    patch.setAttribute('d', blob(PATCH.x, PATCH.y, r));
    patch.setAttribute('stroke-width', (2 / z).toFixed(4));
    pattern.setAttribute('patternTransform', `scale(${(.6 / z).toFixed(5)})`);

    const shown = Math.floor(RIBBONS * Math.min(1, p * 1.2));
    ribbons.forEach((rb, i) => {
      const el = ribbonEls[i];
      if (i >= shown) { el.setAttribute('visibility', 'hidden'); return; }
      el.setAttribute('visibility', 'visible');
      el.setAttribute('x', (PATCH.x + rb.u * r * .95 * Math.cos(rb.a)).toFixed(3));
      el.setAttribute('y', (PATCH.y + rb.u * r * .95 * Math.sin(rb.a)).toFixed(3));
      el.setAttribute('width', (1.6 / z).toFixed(4));
      el.setAttribute('height', (8 / z).toFixed(4));
    });

    if (area != null) {
      const stage = stageOf(area);
      const earth = area >= EARTH;
      const times = area / EARTH;
      $world.find('.world-caption strong').text(earth ? 'the whole Earth' : areaText(area));
      const $s = $world.find('.cap-stage');
      $s.text(earth ? (times >= 2 ? `${A.big(Math.floor(times))} × its surface` : '') : `≈ ${stage}`);
      if (stage !== lastStage) {
        lastStage = stage;
        $s.removeClass('bump');
        void $s[0].offsetWidth;
        $s.addClass('bump');
      }
    }
  }

  // UV audit from orbit: deceptive flies glow all over the house's footprint
  function reveal(share, label) {
    const { r, z } = cur;
    const layer = svg.querySelector('.w-hidden');
    const n = Math.max(12, Math.round(240 * share));
    for (let i = 0; i < n; i++) {
      const u = Math.sqrt(Math.random()), a = A.rand(0, Math.PI * 2);
      svgEl('circle', {
        cx: (PATCH.x + u * Math.min(r, 360) * Math.cos(a)).toFixed(3),
        cy: (PATCH.y + u * Math.min(r, 360) * Math.sin(a)).toFixed(3),
        r: (A.rand(1.6, 2.8) / z).toFixed(4)
      }, layer);
    }
    $world.addClass('uv');
    $world.find('.cap-true').text(label);
  }

  // Flies buzzing around the house, then around the planet
  function startFlies() {
    if (rafId) return;
    const loop = t => {
      const { p, r, z } = cur;
      const k = A.clamp((p - .55) / .45, 0, 1);
      const cx = A.lerp(PATCH.x, G.cx, k), cy = A.lerp(PATCH.y, G.cy, k);
      const orbit = Math.min(r, G.r);
      flies.forEach((fl, i) => {
        const a = fl.a + t * fl.w / 1000;
        const rr = orbit * (1.06 + .22 * Math.sin(t / 650 + fl.ph));
        const el = flyEls[i];
        el.setAttribute('cx', (cx + rr * Math.cos(a)).toFixed(3));
        el.setAttribute('cy', (cy + rr * Math.sin(a)).toFixed(3));
        el.setAttribute('r', (1.8 / z).toFixed(4));
        el.setAttribute('stroke-width', (.5 / z).toFixed(4));
      });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  // Zaps flash all over the house's footprint
  function zapBurst(n) {
    const { r, z } = cur;
    for (let i = 0; i < n; i++) {
      const u = Math.sqrt(Math.random()), a = A.rand(0, Math.PI * 2);
      const c = svgEl('circle', {
        cx: (PATCH.x + u * r * Math.cos(a)).toFixed(3),
        cy: (PATCH.y + u * r * Math.sin(a)).toFixed(3),
        r: (4 / z).toFixed(4),
        class: 'w-zap'
      }, zapLayer);
      c.style.animationDelay = `${A.rand(0, .5).toFixed(2)}s`;
      setTimeout(() => c.remove(), 1200);
    }
  }

  // Leaves the house: it shrinks to a dot while the planet appears around it
  function enter(weights) {
    build();
    const area = areaOf(weights);
    render(progressOf(area), area);
    startFlies();
    $world.fadeIn(T(1200));
    const $fit = $('#house .house-fit');
    return A.tween(1, .12, T(1400), 'easeInCubic', s => $fit.css({ transform: `scale(${s})`, opacity: Math.min(1, s * 1.6) }))
      .then(() => $fit.css('visibility', 'hidden'));
  }

  // The end: the house wraps the whole planet
  function cover(area) {
    render(1, area);
    $world.addClass('covered');
  }

  A.World = {
    showZapper, zapPoint, zap,
    enter, render, zapBurst, cover, reveal,
    areaOf, progressOf, stageOf, stageIndex,
    stages: STAGES.map(s => s[1]),
    EARTH
  };
})(jQuery, window.Align);
