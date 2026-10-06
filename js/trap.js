/* =========================================================
   Align.Trap: the fly ribbons.
   They unroll from the ceiling and stay in the house once
   the fly is caught: with every wave, the ceiling gets a
   little more cluttered. Each room has its own ceiling and
   slots.
   ========================================================= */
(function ($, A) {
  'use strict';

  const T = A.T;
  const TUBE = 14;         // tube height

  // Ceiling (y) and slots (x) per room, avoiding the light fixtures
  const ROOMS = [
    { name: 'in the living room', ceiling: 22,
      slots: [345, 305, 265, 225, 185, 145, 105, 65, 530, 570, 610, 650, 690, 730, 770] },
    { name: 'in the kitchen', ceiling: 25,
      slots: [870, 912, 955, 1000, 1045, 1090, 1132] },
    { name: 'upstairs', ceiling: -417,
      slots: [50, 160, 400, 540, 700, 780, 960, 1040, 1130] }
  ];
  const taken = ROOMS.map(() => []);
  const traps = [];        // deployed ribbons: { x, ceiling, length, $trap }

  const freeIn = room => (ROOMS[room] ? ROOMS[room].slots.length - taken[room].length : 0);

  // Reserve n slots in a room, each as far as possible from existing traps
  function reserve(n, room = 0) {
    const { slots } = ROOMS[room];
    const used = taken[room];
    const out = [];
    for (let k = 0; k < n; k++) {
      const free = slots.filter(s => !used.includes(s));
      let pick;
      if (!free.length) pick = Math.round(A.rand(Math.min(...slots), Math.max(...slots)));
      else if (!used.length) pick = free[0];
      else {
        pick = free
          .map(s => ({ s, d: Math.min(...used.map(u => Math.abs(u - s))) + Math.random() * 10 }))
          .sort((a, b) => b.d - a.d)[0].s;
      }
      used.push(pick);
      out.push(pick);
    }
    return out;
  }

  // Unroll a ribbon. Resolves with the point where the fly will stick.
  function deploy(slot, delay = 0, room = 0) {
    const x = slot + A.rand(-3, 3);
    const ceiling = ROOMS[room].ceiling;
    const length = A.rand(140, 178);
    const $trap = $(`
      <div class="trap">
        <div class="trap-tube"></div>
        <div class="trap-ribbon"><div class="trap-tip"></div></div>
      </div>`)
      .css({ left: x, top: ceiling, opacity: 0 })
      .appendTo(A.House.stage());
    const trap = { x, ceiling, length, $trap };
    traps.push(trap);

    $trap.delay(delay).animate({ opacity: 1 }, T(250));

    return $trap.find('.trap-ribbon')
      .css('height', 0)
      .delay(delay + T(200))
      .animate({ height: length }, T(1200), 'easeOutBack')
      .promise()
      .then(() => ({ ...pointOn(trap, 60), $trap }));
  }

  // A random point on the ribbon (at least `margin` px below the tube)
  function pointOn(trap, margin = 30) {
    return { x: trap.x, y: trap.ceiling + TUBE + A.rand(margin, trap.length - 20) };
  }

  // The `n` ribbons closest to a point
  function nearest(x, y, n = 3) {
    const d = t => Math.hypot(t.x - x, t.ceiling + t.length / 2 - y);
    return traps.slice().sort((a, b) => d(a) - d(b)).slice(0, n);
  }

  // Gentle sway, each ribbon at its own pace
  function sway($trap) {
    $trap.css({
      animationDelay: `-${A.rand(0, 3).toFixed(2)}s`,
      animationDuration: `${A.rand(3, 4.2).toFixed(2)}s`
    }).addClass('sway');
  }

  A.Trap = {
    reserve, deploy, sway, pointOn, nearest, freeIn,
    roomName: room => (ROOMS[room] ? ROOMS[room].name : ''),
    count: () => traps.length
  };
})(jQuery, window.Align);
