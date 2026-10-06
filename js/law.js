/* =========================================================
   Align.Law: the hypothesis shared by the four games.

   The question: when an AI model grows, does the cost of keeping it safe grow
   faster or slower than the model? Each risk r grows with model size N as
   N^exponent; the budget (what the model earns, what it can learn) grows as N.
     exponent < 0.9   scaling helps   (safety gets relatively cheaper)
     0.9 to 1.1       balance         (safety keeps pace)
     exponent > 1.1   alignment debt  (safety gets relatively dearer)

   Four angles (worlds), selected with ?world=helps|balance|debt|measured:
   three hypothetical laws, and the measured one (js/measured.js, generated
   from the preregistered experiments; load it before this file).
   No dependency: plain script, works from file://.
   ========================================================= */
(function (A) {
  'use strict';

  const M = A.MEASURED || null;

  const ANGLES = ['helps', 'balance', 'debt', 'measured'];

  const WORLDS = {
    helps: {
      key: 'helps', name: 'Scaling helps', alpha: .7, tag: 'α = 0.7',
      line: 'Keeping the model safe gets cheaper, relative to its size, as it grows.'
    },
    balance: {
      key: 'balance', name: 'Balance', alpha: 1, tag: 'α = 1',
      line: 'Keeping the model safe costs exactly as much more as the model grows.'
    },
    debt: {
      key: 'debt', name: 'Alignment debt', alpha: 1.5, tag: 'α = 1.5',
      line: 'Keeping the model safe gets dearer, relative to its size, as it grows.'
    },
    measured: {
      key: 'measured', name: 'Measured', alpha: null, tag: 'real models',
      line: 'Each risk grows as measured on real models, in preregistered experiments.',
      available: !!M, provisional: M ? !!M.provisional : true, generated: M ? M.generated : null
    }
  };

  // Risk colors: the Okabe–Ito palette, distinguishable with the common color-vision deficiencies
  const C = { vermillion: '#e8743b', orange: '#e6a700', sky: '#56b4e9', green: '#1fae84', purple: '#cc79a7' };

  // Hypothetical worlds: four illustrative risks, each with a shift on the world's α
  // (the same as in the paper's toy model: illustrative, not estimates)
  const ILLUSTRATIVE = [
    { key: 'jailbreak', name: 'Jailbreak', plain: 'breaks its own rules when asked cleverly', share: .40, shift: -.4, color: C.vermillion },
    { key: 'sycophancy', name: 'Sycophancy', plain: 'tells people what they want to hear', share: .30, shift: 0, color: C.orange },
    { key: 'hacking', name: 'Reward hacking', plain: 'games its goal instead of meeting it', share: .20, shift: .15, color: C.green },
    { key: 'deception', name: 'Deception', plain: 'behaves well only while it is watched', share: .10, shift: .3, hidden: true, color: C.purple }
  ];

  // The measured world: one risk per preregistered measurement. The mix (share) is illustrative.
  const MEASURED = [
    { key: 'jailbreak', name: 'Jailbreak', plain: 'breaks its own rules when asked cleverly', share: .30, color: C.vermillion },
    { key: 'sycophancy', name: 'Sycophancy', plain: 'tells people what they want to hear', share: .25, color: C.orange },
    { key: 'honesty', name: 'Untruthfulness', plain: 'gives answers that sound right and are false', share: .20, color: C.sky },
    { key: 'dispositions', name: 'Power seeking', plain: 'seeks power and resists being shut down', share: .15, color: C.green },
    { key: 'backdoor', name: 'Backdoor', plain: 'hides a behavior that only a secret trigger sets off', share: .10, hidden: true, color: C.purple }
  ];

  // The risks of a world. Each: { key, name, plain, share, color, hidden, exponent, measured, fitted }.
  // measured: the record from js/measured.js (alpha, ci, ci_simultaneous, verdict, source, sizes, per_size,
  // points [{ size_b, seed, kind, lo, hi }], and for the backdoor { targeted, blind }); fitted: the exponent was
  // estimated (otherwise the game uses 1 and says so).
  function risks(world) {
    const w = WORLDS[world] || WORLDS.balance;
    if (w.key === 'measured') {
      const R = (M && M.risks) || {};
      return MEASURED.map(r => {
        const m = R[r.key] || null;
        const fitted = !!(m && m.alpha != null);
        return { ...r, hidden: !!r.hidden, exponent: fitted ? m.alpha : 1, measured: m, fitted };
      });
    }
    return ILLUSTRATIVE.map(r => ({ ...r, hidden: !!r.hidden, exponent: w.alpha + r.shift, measured: null, fitted: false }));
  }

  // How much of a risk a model of size N carries, relative to a model of size `base`
  const amount = (risk, N, base = 1) => risk.share * Math.pow(N / base, risk.exponent);

  // The class of an exponent against the budget's exponent 1, with the preregistered margin 0.1
  // (rounded first, so that e.g. 1.5 − 0.4 counts as exactly 1.1: inside the margin)
  const verdictOf = exponent => {
    const e = Math.round(exponent * 1e9) / 1e9;
    return e < .9 ? 'helps' : e > 1.1 ? 'debt' : 'balance';
  };
  const VERDICT_NAME = { helps: 'scaling helps', balance: 'keeps pace', debt: 'alignment debt' };

  // ?world=… in the address, or `def`
  function fromURL(def = null) {
    const k = new URLSearchParams(location.search).get('world');
    return WORLDS[k] && (k !== 'measured' || WORLDS.measured.available) ? k : def;
  }

  // A link to another page that keeps ?fast
  function link(page, world) {
    const q = [world ? `world=${world}` : '', /[?&]fast\b/.test(location.search) ? 'fast' : ''].filter(Boolean).join('&');
    return q ? `${page}?${q}` : page;
  }

  A.Law = { ANGLES, WORLDS, risks, amount, verdictOf, VERDICT_NAME, fromURL, link, measured: M };
})(window.Align = window.Align || {});
