/* =========================================================
   Align.Chart: a small dependency-free SVG line chart.
   One series per chart (no dual axis), optional dashed
   projection, crosshair + tooltip on hover and keyboard
   (arrow keys).
   ========================================================= */
(function ($, A) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function text(parent, x, y, str, cls, anchor = 'start') {
    const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
    t.textContent = str;
    return t;
  }

  /* opts:
       title       accessible label
       data        [{ label, v, tip: [[value, label], …], name }]
       projection  [{ label, v, tip, name }]   (dashed, optional)
       max         top of the axis; ticks: gridline values
       fmtTick     tick formatting; fmtValue: end label
       color       series color; area: wash under the line
       ref         { v, label }: dashed reference line (optional)
       second      { values, color, label }: a second, dashed series on the same axis (optional) */
  function line(host, opts) {
    const $host = $(host).addClass('chart').empty();
    let o = opts;
    let focus = -1;

    const $tip = $('<div class="chart-tip" role="status"></div>').hide();

    function draw() {
      $host.children('svg').remove();
      const W = $host.width(), H = $host.height();
      if (W < 60 || H < 50 || !o.data.length) return;

      const all = o.data.concat(o.projection || []);
      const n = all.length;
      const m = { l: 40, r: 44, t: 16, b: 20 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const x = i => m.l + (n > 1 ? i * iw / (n - 1) : iw / 2);
      const y = v => m.t + ih - (A.clamp(v, 0, o.max) / o.max) * ih;

      const svg = el('svg', {
        width: W, height: H, viewBox: `0 0 ${W} ${H}`,
        class: 'chart-svg', role: 'img', tabindex: 0, 'aria-label': o.title
      });

      // Grid and ticks
      o.ticks.forEach(t => {
        el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'chart-grid' }, svg);
        text(svg, m.l - 6, y(t) + 3, o.fmtTick(t), 'chart-tick', 'end');
      });
      const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 30))));
      // Every `every`-th label, plus the last one; skip any that would collide with it
      all.forEach((d, i) => {
        if (i !== n - 1 && (i % every || n - 1 - i < every)) return;
        text(svg, x(i), H - 5, d.label, 'chart-tick', 'middle');
      });

      // Reference line (e.g. what was measured), labeled at its right end
      if (o.ref) {
        el('line', { x1: m.l, x2: W - m.r, y1: y(o.ref.v), y2: y(o.ref.v), class: 'chart-ref' }, svg);
        text(svg, W - m.r, y(o.ref.v) - 5, o.ref.label, 'chart-note', 'end');
      }

      // Observed series
      const pts = o.data.map((d, i) => [x(i), y(d.v)]);
      const last = pts[pts.length - 1];
      if (o.area && pts.length > 1) {
        el('path', {
          d: `M${pts[0][0]},${y(0)} L${pts.map(p => p.join(',')).join(' L')} L${last[0]},${y(0)}Z`,
          class: 'chart-area', fill: o.color
        }, svg);
      }
      el('path', { d: 'M' + pts.map(p => p.join(',')).join(' L'), class: 'chart-line', stroke: o.color }, svg);

      // Projection
      const proj = o.projection || [];
      if (proj.length) {
        const pp = [last].concat(proj.map((d, j) => [x(o.data.length + j), y(d.v)]));
        el('path', { d: 'M' + pp.map(p => p.join(',')).join(' L'), class: 'chart-line chart-proj', stroke: o.color }, svg);
        pp.slice(1).forEach(p => el('circle', { cx: p[0], cy: p[1], r: 4, class: 'chart-dot hollow', stroke: o.color }, svg));
        const pe = pp[pp.length - 1];
        text(svg, pe[0], pe[1] - 10, 'projection', 'chart-note', 'end');
      }
      // Second series (same unit, same axis), dashed, labeled at its end
      if (o.second && o.second.values.length) {
        const sp = o.second.values.map((v, i) => [x(i), y(v)]);
        el('path', { d: 'M' + sp.map(p => p.join(',')).join(' L'), class: 'chart-line chart-second', stroke: o.second.color }, svg);
        sp.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 3, class: 'chart-dot', fill: o.second.color }, svg));
        const se = sp[sp.length - 1];
        text(svg, se[0] - 8, Math.min(se[1] + 14, m.t + ih - 4), o.second.label, 'chart-note', 'end');
      }
      pts.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 4, class: 'chart-dot', fill: o.color }, svg));

      // Label: last observed value, on the side the line leaves free
      const lastLabel = o.fmtValue(o.data[o.data.length - 1].v);
      if (!proj.length) text(svg, last[0] + 8, last[1] + 4, lastLabel, 'chart-value');
      else {
        const prev = pts[pts.length - 2] || last;
        const rising = prev[1] > last[1];
        text(svg, last[0] + (rising ? -8 : 8), last[1] - 8, lastLabel, 'chart-value', rising ? 'end' : 'start');
      }

      // Crosshair + hover area (the whole plot surface)
      const cross = el('line', { x1: 0, x2: 0, y1: m.t, y2: m.t + ih, class: 'chart-cross', visibility: 'hidden' }, svg);
      const hit = el('rect', { x: m.l - 10, y: 0, width: iw + 20, height: H, fill: 'transparent' }, svg);

      function show(i) {
        focus = A.clamp(i, 0, n - 1);
        const d = all[focus];
        cross.setAttribute('x1', x(focus));
        cross.setAttribute('x2', x(focus));
        cross.setAttribute('visibility', 'visible');
        $tip.empty().append($('<div class="chart-tip-title"></div>').text(d.name || d.label));
        (d.tip || []).forEach(([val, lab]) => {
          $tip.append($('<div class="chart-tip-row"></div>').append(
            $('<strong></strong>').text(val), $('<span></span>').text(lab)));
        });
        $tip.show();
        const tw = $tip.outerWidth();
        const left = x(focus) + 12 + tw > W ? x(focus) - 12 - tw : x(focus) + 12;
        $tip.css({ left, top: m.t });
      }
      function hide() {
        cross.setAttribute('visibility', 'hidden');
        $tip.hide();
      }

      hit.addEventListener('pointermove', e => {
        const r = svg.getBoundingClientRect();
        show(Math.round((e.clientX - r.left - m.l) / (n > 1 ? iw / (n - 1) : 1)));
      });
      hit.addEventListener('pointerleave', hide);
      svg.addEventListener('focus', () => show(focus < 0 ? n - 1 : focus));
      svg.addEventListener('blur', hide);
      svg.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { show(focus - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { show(focus + 1); e.preventDefault(); }
      });

      $host.prepend(svg);
      if (!$tip.parent().length) $tip.appendTo($host);
    }

    new ResizeObserver(draw).observe($host[0]);
    draw();

    return {
      update(next) {
        o = { ...o, ...next };
        draw();
      }
    };
  }

  A.Chart = { line };
})(jQuery, window.Align);
