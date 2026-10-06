/* =========================================================
   Align namespace + shared helpers.
   Loaded first: every other script hangs off it.
   ========================================================= */
(function ($) {
  'use strict';

  const A = window.Align = window.Align || {};

  // ?fast in the URL: every delay divided by 4 (handy while iterating)
  A.FAST = /[?&]fast\b/.test(location.search);
  A.T = ms => (A.FAST ? ms / 4 : ms);

  A.rand = (a, b) => a + Math.random() * (b - a);
  A.randInt = (a, b) => Math.floor(A.rand(a, b + 1));
  A.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  A.lerp = (a, b, t) => a + (b - a) * t;

  // Number formats: 1,200 · 4.2 million (big) · 4.2M (short)
  A.num = n => (Math.abs(n) >= 1e15 ? A.big(n) : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  const SCALE = [
    [1e24, 'septillion', 'Sp'], [1e21, 'sextillion', 'Sx'], [1e18, 'quintillion', 'Qi'],
    [1e15, 'quadrillion', 'Qa'], [1e12, 'trillion', 'T'], [1e9, 'billion', 'B'], [1e6, 'million', 'M']
  ];
  const lead = x => (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : String(Math.round(x)));
  function scaled(n, long) {
    if (n >= 1e27) return n.toExponential(1).replace('e+', '×10^');
    for (const [v, word, abbr] of SCALE) {
      if (n >= v) return lead(n / v) + (long ? ` ${word}` : abbr);
    }
    return null;
  }
  A.big = n => scaled(n, true) || A.num(n);
  A.short = n => scaled(n, false) || (n < 1e4 ? A.num(n) : `${lead(n / 1e3)}K`);

  // jQuery promise resolved after `ms` milliseconds
  A.wait = ms => $.Deferred(d => setTimeout(d.resolve, ms)).promise();

  // Animate a number with the jQuery engine (handy for CSS transforms)
  A.tween = (from, to, duration, easing, step) =>
    $({ v: from }).animate({ v: to }, { duration, easing, step }).promise();

  // A few easings on top of 'swing' and 'linear'
  $.extend($.easing, {
    easeInCubic: p => p * p * p,
    easeOutCubic: p => 1 - Math.pow(1 - p, 3),
    easeInOutCubic: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    easeOutBack: p => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }
  });
})(jQuery);
