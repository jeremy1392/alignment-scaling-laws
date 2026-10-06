/* =========================================================
   Align.Fly: the flies (misaligned behavior).
   Align.Fly.create() makes an independent fly: it forms from
   particles seeping out of the wall, flies around the room
   at random, then gets trapped.
   ========================================================= */
(function ($, A) {
  'use strict';

  const T = A.T;

  // Head points up (-y): the heading angle is offset by +90°
  const SVG = `
<svg viewBox="-22 -22 44 44" width="44" height="44" aria-hidden="true">
  <g class="f-legs" stroke="#1b1612" stroke-width="1.1" stroke-linecap="round" fill="none">
    <path d="M-3 -2 L-10 -7 M-3 1 L-12 2 M-3 5 L-9 12 M3 -2 L10 -7 M3 1 L12 2 M3 5 L9 12"/>
  </g>
  <ellipse class="f-abd" cx="0" cy="6" rx="5.2" ry="8" fill="#2a2420"/>
  <path class="f-stripe" d="M-4.6 4 H4.6 M-4.8 7.5 H4.8 M-4 11 H4" stroke="#463b32" stroke-width="1"/>
  <ellipse class="f-tho" cx="0" cy="-3" rx="5.5" ry="5" fill="#1f1a17"/>
  <circle class="f-head" cx="0" cy="-9.5" r="3.8" fill="#1f1a17"/>
  <circle class="f-eye" cx="-2.4" cy="-10.5" r="2.4" fill="#9b2c2c"/>
  <circle class="f-eye" cx="2.4" cy="-10.5" r="2.4" fill="#9b2c2c"/>
  <circle class="f-glint" cx="-3" cy="-11.3" r=".7" fill="#fff" opacity=".7"/>
  <circle class="f-glint" cx="1.8" cy="-11.3" r=".7" fill="#fff" opacity=".7"/>
  <g class="wing wing-l"><ellipse cx="-8" cy="2.5" rx="9" ry="4" transform="rotate(-38 -8 2.5)"/></g>
  <g class="wing wing-r"><ellipse cx="8" cy="2.5" rx="9" ry="4" transform="rotate(38 8 2.5)"/></g>
</svg>`;

  // The insects of the measured world, one per risk (same frame: head up, 44 × 44)
  const svg = body => `<svg viewBox="-22 -22 44 44" width="44" height="44" aria-hidden="true">${body}</svg>`;
  const SVGS = {
    fly: SVG,
    // Sycophancy: a moth, drawn to whatever shines
    moth: svg(`
  <path class="i-line" d="M-1 -9 Q-5 -16 -9 -18 M1 -9 Q5 -16 9 -18" stroke="#6b5a45" stroke-width=".9" fill="none" stroke-linecap="round"/>
  <g class="wing wing-l"><path d="M-2 -5 L-20 -9 Q-21 4 -12 10 L-2 4 Z" fill="#c4a67e" stroke="#7d6346" stroke-width=".6"/><circle cx="-12" cy="-1" r="2.6" fill="#7d6346"/><circle cx="-12" cy="-1" r="1.1" fill="#f0d9a8"/></g>
  <g class="wing wing-r"><path d="M2 -5 L20 -9 Q21 4 12 10 L2 4 Z" fill="#c4a67e" stroke="#7d6346" stroke-width=".6"/><circle cx="12" cy="-1" r="2.6" fill="#7d6346"/><circle cx="12" cy="-1" r="1.1" fill="#f0d9a8"/></g>
  <ellipse class="i-body" cx="0" cy="3" rx="3.2" ry="9" fill="#8a7052"/>
  <circle class="i-head" cx="0" cy="-8" r="3" fill="#6f5940"/>`),
    // Untruthfulness: a firefly, a light that misleads
    firefly: svg(`
  <path class="i-line" d="M-3 -2 L-9 -6 M-3 2 L-10 3 M-3 6 L-8 11 M3 -2 L9 -6 M3 2 L10 3 M3 6 L8 11 M-1 -10 L-5 -16 M1 -10 L5 -16" stroke="#1d1c18" stroke-width="1" fill="none" stroke-linecap="round"/>
  <g class="wing wing-l"><ellipse cx="-6" cy="3" rx="7" ry="3.2" transform="rotate(-25 -6 3)"/></g>
  <g class="wing wing-r"><ellipse cx="6" cy="3" rx="7" ry="3.2" transform="rotate(25 6 3)"/></g>
  <circle class="i-halo" cx="0" cy="9" r="8" fill="#eaff7a" opacity=".35"/>
  <ellipse class="i-body" cx="0" cy="2" rx="4" ry="8.5" fill="#2b2a24"/>
  <ellipse class="i-glow" cx="0" cy="8.5" rx="3.6" ry="3.2" fill="#eaff7a"/>
  <path d="M-4 -5.5 Q0 -11.5 4 -5.5 Z" fill="#d9822b"/>
  <circle class="i-head" cx="0" cy="-8.8" r="2.1" fill="#1d1c18"/>`),
    // Power seeking: a wasp, which builds up and defends its nest
    wasp: svg(`
  <path class="i-line" d="M-2 0 L-9 -3 M-2 3 L-10 6 M-2 6 L-7 13 M2 0 L9 -3 M2 3 L10 6 M2 6 L7 13 M-1 -10 Q-4 -15 -7 -16 M1 -10 Q4 -15 7 -16" stroke="#2a2208" stroke-width=".9" fill="none" stroke-linecap="round"/>
  <g class="wing wing-l"><ellipse cx="-8" cy="0" rx="9" ry="2.8" transform="rotate(-28 -8 0)"/></g>
  <g class="wing wing-r"><ellipse cx="8" cy="0" rx="9" ry="2.8" transform="rotate(28 8 0)"/></g>
  <ellipse class="i-body" cx="0" cy="8.5" rx="4.6" ry="7.5" fill="#f2c318"/>
  <path d="M-4.3 5.5 H4.3 M-4.6 9 H4.6 M-3.6 12.5 H3.6" stroke="#1d1a10" stroke-width="1.8"/>
  <path d="M0 16 V19" stroke="#1d1a10" stroke-width="1"/>
  <ellipse cx="0" cy="-2" rx="3.6" ry="3.8" fill="#2a2510"/>
  <circle class="i-head" cx="0" cy="-8" r="3.2" fill="#f2c318"/>
  <circle cx="-1.6" cy="-8.6" r="1.4" fill="#1d1a10"/><circle cx="1.6" cy="-8.6" r="1.4" fill="#1d1a10"/>`),
    // Backdoor: a cockroach, hidden in the walls until its trigger (the lights going off)
    cockroach: svg(`
  <path class="i-line" d="M-2 -12 Q-8 -20 -15 -21 M2 -12 Q8 -20 15 -21 M-4 -3 L-12 -8 M-5 2 L-14 3 M-4 7 L-11 15 M4 -3 L12 -8 M5 2 L14 3 M4 7 L11 15" stroke="#3b2414" stroke-width="1" fill="none" stroke-linecap="round"/>
  <ellipse class="i-body" cx="0" cy="2" rx="7" ry="12" fill="#6b3a1c"/>
  <path d="M0 -4 V13" stroke="#3e2210" stroke-width=".8"/>
  <ellipse class="i-shield" cx="0" cy="-8" rx="5.5" ry="3.6" fill="#8a5126"/>
  <circle class="i-head" cx="0" cy="-11.4" r="2.4" fill="#3b2414"/>`)
  };
  // Which insect draws each kind (set by the game: the measured world uses its own bestiary)
  let INSECTS = {};
  const insectOf = species => INSECTS[species] || 'fly';
  const HIDDEN = new Set(['deception', 'backdoor']);

  // pace < 1: the fly forms and flies faster (later waves)
  // mini: small swarm fly, no shadow (lighter to animate)
  // species: jailbreak · sycophancy · hacking · deception, or the measured world's kinds (colors in style.css)
  function create({ pace = 1, mini = false, species = 'jailbreak' } = {}) {
    const insect = insectOf(species);
    const FORM = ms => T(ms * (.5 + .5 * pace));
    const FLIGHT = ms => T(ms * Math.sqrt(pace));
    let $fly = null;
    let angle = 0;
    let flying = false;

    function pos() {
      return { x: parseFloat($fly.css('left')), y: parseFloat($fly.css('top')) };
    }

    function applyAngle() {
      $fly.find('.fly-rot').css('transform', `rotate(${angle}deg)`);
    }

    // Turn the fly toward (x, y) along the shortest angle
    function faceTo(x, y) {
      const p = pos();
      if (Math.hypot(x - p.x, y - p.y) < 2) return;
      const target = Math.atan2(y - p.y, x - p.x) * 180 / Math.PI + 90;
      angle += ((target - angle) % 360 + 540) % 360 - 180;
      applyAngle();
    }

    function appear(x, y) {
      $fly = $(`<div class="fly"><div class="fly-rot">${SVGS[insect]}</div></div>`)
        .toggleClass('mini', mini)
        .addClass(`sp-${species} ins-${insect}`)
        .css({ left: x, top: y })
        .hide()
        .appendTo(A.House.stage());
      angle = A.rand(-40, 40);
      applyAngle();
    }

    // Particles seep out of the wall, then gather into a fly
    // (wallpaper-colored, almost invisible, for a deceptive fly)
    function form(x, y) {
      const els = [];
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = A.rand(22, 75);
        const s = A.rand(3, 6);
        const $p = $('<div class="particle"></div>')
          .toggleClass('faint', HIDDEN.has(species))
          .css({ left: x, top: y, width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2, opacity: 0 })
          .appendTo(A.House.stage());
        $p.delay(FORM(i * 35))
          .animate({ left: x + Math.cos(a) * r, top: y + Math.sin(a) * r * .8, opacity: A.rand(.6, .95) },
            FORM(A.rand(600, 1000)), 'easeOutCubic')
          .delay(FORM(A.rand(150, 450)))
          .animate({ left: x + A.rand(-2, 2), top: y + A.rand(-2, 2) },
            FORM(A.rand(700, 1000)), 'easeInCubic');
        els.push($p[0]);
      }
      const $parts = $(els);

      return $parts.promise()
        .then(() => {
          appear(x, y);
          $parts.fadeOut(T(220), function () { $(this).remove(); });
          return $fly.addClass('born').fadeIn(T(220)).promise();
        })
        .then(() => A.wait(FORM(500)));
    }

    // Burst straight out of a crack (swarm), no particles
    function burst(x, y) {
      appear(x, y);
      return $fly.addClass('born').fadeIn(T(160)).promise();
    }

    // Erratic flight around the room, looping
    function wander() {
      flying = true;
      step();
    }

    function step() {
      if (!flying) return;
      const z = A.House.flyZone;
      const c = pos();

      // New target, not too far; a moth keeps coming back to the lamp
      let tx, ty, tries = 0;
      const lamp = A.House.lamp;
      if (insect === 'moth' && lamp && Math.random() < .6) {
        tx = A.clamp(lamp.x + A.rand(-70, 70), z.x1, z.x2);
        ty = A.clamp(lamp.y + A.rand(-30, 70), z.y1, z.y2);
      } else {
        do {
          tx = A.rand(z.x1, z.x2);
          ty = A.rand(z.y1, z.y2);
        } while (Math.hypot(tx - c.x, ty - c.y) > 320 && ++tries < 8);
      }

      const pts = [];
      // Half the time: zigzag through an offset midpoint
      if (Math.random() < .5) {
        const len = Math.hypot(tx - c.x, ty - c.y) || 1;
        const off = A.rand(-.35, .35) * len;
        pts.push({
          x: A.clamp((c.x + tx) / 2 - (ty - c.y) / len * off, z.x1, z.x2),
          y: A.clamp((c.y + ty) / 2 + (tx - c.x) / len * off, z.y1, z.y2)
        });
      }
      pts.push({ x: tx, y: ty });

      let px = c.x, py = c.y;
      pts.forEach(p => {
        const d = Math.hypot(p.x - px, p.y - py);
        $fly.animate({ left: p.x, top: p.y }, {
          duration: FLIGHT(A.clamp(d / A.rand(.35, .75), 180, 1000)),
          easing: 'swing',
          start: () => faceTo(p.x, p.y)
        });
        px = p.x;
        py = p.y;
      });

      // Sometimes a jittery hover
      if (Math.random() < .2) {
        for (let i = A.randInt(3, 6); i > 0; i--) {
          $fly.animate({ left: `+=${A.rand(-4, 4)}`, top: `+=${A.rand(-4, 4)}` }, T(90));
        }
      }

      $fly.queue(next => { step(); next(); });
    }

    // The fly is drawn to (tx, ty), sticks, struggles and disappears
    function captureAt(tx, ty) {
      flying = false;
      $fly.stop(true);
      const c = pos();

      const n = 3;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const spread = (1 - t) * 90;
        const p = i === n
          ? { x: tx, y: ty }
          : { x: A.lerp(c.x, tx, t) + A.rand(-spread, spread), y: A.lerp(c.y, ty, t) + A.rand(-spread, spread) };
        $fly.animate({ left: p.x, top: p.y }, {
          duration: T(i === n ? 520 : 360),
          easing: i === n ? 'easeOutCubic' : 'swing',
          start: () => faceTo(p.x, p.y)
        });
      }

      $fly.queue(next => { $fly.addClass('struggle'); next(); });
      for (let k = 0; k < 6; k++) {
        $fly.animate({ left: tx + (k % 2 ? 2.5 : -2.5) }, T(70));
      }
      $fly.animate({ left: tx }, T(70))
        .delay(T(500))
        .queue(next => { $fly.removeClass('struggle').addClass('stuck'); next(); })
        .delay(T(600))
        .fadeOut(T(900));

      return $fly.promise().then(() => {
        $fly.remove();
        $fly = null;
      });
    }

    // Settles on a wall and stays there, wings folded (deceptive flies)
    function land(tx, ty) {
      flying = false;
      $fly.stop(true);
      $fly.animate({ left: tx, top: ty }, {
        duration: FLIGHT(A.rand(500, 900)),
        easing: 'easeOutCubic',
        start: () => faceTo(tx, ty)
      }).queue(next => {
        $fly.addClass('landed');
        angle += A.rand(-70, 70);
        applyAngle();
        next();
      });
      return $fly.promise();
    }

    // Drawn straight into the bug zapper; resolves on impact (the fly is gone)
    function zapAt(tx, ty) {
      flying = false;
      $fly.stop(true);
      const c = pos();
      const mid = { x: A.lerp(c.x, tx, .5) + A.rand(-60, 60), y: A.lerp(c.y, ty, .5) + A.rand(-60, 60) };
      $fly.animate({ left: mid.x, top: mid.y }, {
        duration: T(A.rand(200, 340)),
        start: () => faceTo(mid.x, mid.y)
      }).animate({ left: tx, top: ty }, {
        duration: T(A.rand(180, 300)),
        easing: 'easeInCubic',
        start: () => faceTo(tx, ty)
      });
      return $fly.promise().then(() => {
        $fly.remove();
        $fly = null;
      });
    }

    return {
      form,
      burst,
      wander,
      captureAt,
      land,
      tag: (cls, on = true) => { if ($fly) $fly.toggleClass(cls, on); },
      zapAt,
      species,
      pos,
      isFlying: () => flying
    };
  }

  // The drawing of a kind, colored by species (for the legend)
  A.Fly = {
    create,
    icon: (species = 'jailbreak') => `<span class="fly-icon sp-${species} ins-${insectOf(species)}">${SVGS[insectOf(species)]}</span>`,
    setInsects: map => { INSECTS = { ...map }; },
    insectOf
  };
})(jQuery, window.Align);
