/* =========================================================
   The hub: pick one of four games, then one of four angles.
   ========================================================= */
(function (A) {
  'use strict';

  const L = A.Law;
  const GAMES = [
    { page: 'replay.html', icon: '🔬', name: 'The experiment', badge: 'start here',
      line: 'What we actually measured: models of seven sizes, and how many lessons each needed to fix each risk.' },
    { page: 'money.html', icon: '💰', name: 'The company',
      line: 'Run an AI company. A bigger model earns more, but its safety bill grows too. Can you stay in the black?' },
    { page: 'garden.html', icon: '🌱', name: 'The garden',
      line: 'Grow a garden. More ground means more weeds, and some roots stay hidden. Does weeding take over?' },
    { page: 'house.html', icon: '🪰', name: 'The house',
      line: 'The original toy model: flies in a house, traps, and a model that spends capability on every correction.' }
  ];

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const $games = document.getElementById('games');
  GAMES.forEach(g => {
    const card = el('article', 'game');
    const head = el('div', 'game-head');
    head.append(el('span', 'game-icon', g.icon), el('h2', null, g.name));
    if (g.badge) head.append(el('span', 'badge', g.badge));
    card.append(head, el('p', 'game-line', g.line));
    const row = el('div', 'angle-row');
    L.ANGLES.forEach(k => {
      const w = L.WORLDS[k];
      const a = el('a', `angle angle-${k}`);
      a.href = L.link(g.page, k);
      a.append(el('strong', null, w.name), el('span', null, w.tag + (k === 'measured' && w.provisional ? ' · provisional' : '')));
      if (k === 'measured' && !w.available) {
        a.classList.add('off');
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
      }
      row.append(a);
    });
    card.append(row);
    $games.append(card);
  });

  const $angles = document.getElementById('angles');
  L.ANGLES.forEach(k => {
    const w = L.WORLDS[k];
    const li = el('li', `angle-help angle-${k}`);
    li.append(el('strong', null, `${w.name} (${w.tag})`), el('span', null, w.line));
    $angles.append(li);
  });
})(window.Align);
