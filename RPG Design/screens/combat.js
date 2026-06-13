/* THE LONG NOON — turn-based combat */
registerScreen({
  id: 'combat', title: 'Combat',
  render(el) {
    const G = window.GAME;
    const state = { ability: 1 };

    const ABILITIES = [
      ['Move', 1, 'Cross the yard. Each step is a decision.'],
      ['Fan the Hammer', 3, 'Empty three chambers into adjacent fates. 3 × 4–7 damage, −15% to hit.'],
      ['Deadeye', 2, 'Take the time nobody else has. +25% to hit, ignores cover.'],
      ['Pistol-Whip', 1, 'The butt end of the argument. 2–5 damage, Dazes for one turn.'],
      ['Brace', 1, 'Plant your feet. +2 Armor until your next turn.'],
    ];
    const ORDER = [
      ['odile', 'party', true], ['tallow', 'enemy', false], ['wren', 'party', false],
      ['vicar', 'enemy', false], ['casimir', 'party', false], ['tallow', 'enemy', false],
      ['greaves', 'party', false],
    ];
    const LOG = [
      ['R3', 'GREAVES plants the Long Spade. The ground accepts it gratefully.'],
      ['R3', 'TALLOWMAN (still warm) closes the distance on soft warm feet.'],
      ['R3', 'CASIMIR — Hymn of Oil. The Sequence Six hums along. +2 DMG.'],
      ['R3', 'RUST-VICAR counts aloud. The Choir answers from nowhere. PARTY −2 RESOLVE.'],
      ['R3', 'WREN slips behind the lych-gate. Unwitnessed.'],
      ['R4', 'ODILE readies the Sequence Six. The third chamber. 9 o\u2019clock.'],
    ];

    let stones = '';
    [[560, 420], [700, 360], [880, 330], [1480, 700], [1560, 540], [430, 760], [1280, 860], [980, 250], [1660, 380]]
      .forEach(([x, y]) => {
        stones += `<line x1="${x + 6}" y1="${y + 14}" x2="${x + 34}" y2="${y + 22}" stroke="#0e0b08" stroke-width="7" opacity="0.6"></line>
        <rect x="${x}" y="${y}" width="16" height="22" fill="#211a13" stroke="#322a20" stroke-width="1"></rect>`;
      });
    let grid = '';
    for (let x = 380; x <= 1560; x += 74) grid += `<line x1="${x}" y1="220" x2="${x}" y2="920" stroke="#3a3024" stroke-width="0.6" opacity="0.16"></line>`;
    for (let y = 220; y <= 920; y += 74) grid += `<line x1="380" y1="${y}" x2="1560" y2="${y}" stroke="#3a3024" stroke-width="0.6" opacity="0.16"></line>`;

    el.innerHTML = `
    <div class="cb-root">
      <svg class="cb-scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <rect width="1920" height="1080" fill="#16110c"></rect>
        <rect x="0" y="0" width="1920" height="110" fill="#1c1610"></rect>
        <line x1="0" y1="110" x2="1920" y2="110" stroke="#2a2218" stroke-width="2"></line>
        <g fill="#13100b">
          <rect x="180" y="40" width="26" height="70"></rect><rect x="520" y="40" width="26" height="70"></rect>
          <rect x="860" y="40" width="26" height="70"></rect><rect x="1200" y="40" width="26" height="70"></rect>
          <rect x="1540" y="40" width="26" height="70"></rect>
        </g>
        <ellipse cx="960" cy="600" rx="640" ry="360" fill="#1b1510" opacity="0.9"></ellipse>
        ${grid}
        ${stones}
        <line x1="300" y1="540" x2="300" y2="460" stroke="#13100b" stroke-width="8"></line>
        <line x1="380" y1="540" x2="380" y2="460" stroke="#13100b" stroke-width="8"></line>
        <line x1="290" y1="460" x2="390" y2="460" stroke="#13100b" stroke-width="10"></line>
        <circle cx="640" cy="640" r="170" fill="none" stroke="var(--ink-dim)" stroke-width="1" stroke-dasharray="3 8" opacity="0.45"></circle>
        <line x1="640" y1="640" x2="1100" y2="560" stroke="var(--accent-bright)" stroke-width="1" stroke-dasharray="5 6" opacity="0.7"></line>
      </svg>
      <div class="cb-ribbon">
        <span class="label small faint" style="margin-right:18px">ROUND&nbsp;4</span>
        <div class="cb-chips"></div>
      </div>
      <div class="cb-hit label small">62% &mdash; CLEAR SHOT</div>
      <div class="cb-tokens"></div>
      <div class="cb-log">
        <div class="label small faint" style="margin-bottom:14px">THE RECORD</div>
        <div class="cb-loglines"></div>
      </div>
      <div class="cb-bar">
        <div class="cb-active">
          <div class="pframe" style="width:62px;height:74px;cursor:default">${G.portrait('odile')}</div>
          <div class="cb-vit">
            <div class="label small">ODILE VANCE</div>
            ${G.bar(52, 64, 'hp')}
            ${G.bar(31, 40, 'res')}
            ${G.pips(6, 4)}
          </div>
        </div>
        <div class="cb-abilities"></div>
        <button class="cb-end btn framed">End Turn</button>
      </div>
      <div class="cb-hint label small faint"></div>
    </div>
    <style>
      .cb-root{ position:absolute; inset:0; background:#16110c; }
      .cb-scene{ position:absolute; inset:0; width:100%; height:100%; }
      .cb-ribbon{ position:absolute; top:34px; left:50%; transform:translateX(-50%); z-index:3;
        display:flex; align-items:center; }
      .cb-chips{ display:flex; gap:8px; align-items:flex-end; }
      .cb-chip{ width:44px; height:52px; border:1px solid var(--line); background:var(--bg-0);
        position:relative; opacity:.75; }
      .cb-chip svg{ width:100%; height:100%; display:block; }
      .cb-chip.enemy{ border-color:#4a2620; }
      .cb-chip.now{ opacity:1; border-color:var(--line-strong); }
      .cb-chip.now::after{ content:''; position:absolute; left:0; right:0; bottom:-7px; height:2px; background:var(--accent); }
      .cb-hit{ position:absolute; left:846px; top:566px; z-index:3; color:var(--accent-bright); letter-spacing:.2em; }
      .cb-tok{ position:absolute; z-index:2; display:flex; flex-direction:column; align-items:center; gap:8px;
        transform:translate(-50%,-50%); }
      .cb-tok i{ width:16px; height:16px; background:#0f0c09; border:1.5px solid var(--ink-dim); transform:rotate(45deg); }
      .cb-tok.enemy i{ background:#241312; border-color:#7e3a2c; }
      .cb-tok.big i{ width:22px; height:22px; }
      .cb-tok.now i{ border-color:var(--accent-bright); outline:1px solid rgba(194,86,61,.3); outline-offset:5px; }
      .cb-tok .nm{ font-family:var(--f-mono); font-size:9px; letter-spacing:.18em; color:var(--ink-faint); white-space:nowrap; }
      .cb-tok .bar{ width:64px; }
      .cb-log{ position:absolute; right:56px; top:200px; width:330px; z-index:3; }
      .cb-logline{ display:flex; gap:12px; padding:13px 0; border-bottom:1px solid rgba(56,47,36,.5); }
      .cb-logline .r{ font-family:var(--f-mono); font-size:10px; color:var(--ink-faint); flex:none; padding-top:3px; }
      .cb-logline .t{ font-family:var(--f-prose); font-size:15.5px; line-height:1.45; color:var(--ink-dim); }
      .cb-logline:last-child .t{ color:var(--ink); }
      .cb-bar{ position:absolute; left:50%; bottom:36px; transform:translateX(-50%); z-index:3;
        display:flex; align-items:center; gap:34px; padding:18px 26px;
        background:rgba(10,8,6,.78); border:1px solid var(--line); }
      .cb-active{ display:flex; gap:16px; align-items:center; }
      .cb-vit{ display:flex; flex-direction:column; gap:7px; width:150px; }
      .cb-abilities{ display:flex; gap:8px; }
      .cb-ab{ width:112px; height:74px; border:1px solid var(--line); background:none; cursor:pointer;
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
        transition:border-color .12s; }
      .cb-ab .an{ font-family:var(--f-mono); font-size:9.5px; letter-spacing:.12em; color:var(--ink-dim);
        text-transform:uppercase; text-align:center; line-height:1.4; padding:0 6px; }
      .cb-ab .ac{ font-family:var(--f-mono); font-size:9px; color:var(--ink-faint); letter-spacing:.14em; white-space:nowrap; }
      .cb-ab:hover{ border-color:var(--line-strong); }
      .cb-ab:hover .an{ color:var(--ink); }
      .cb-ab.sel{ border-color:var(--accent); }
      .cb-ab.sel .an{ color:var(--ink); }
      .cb-ab.sel .ac{ color:var(--accent-bright); }
      .cb-end{ padding:14px 22px; }
      .cb-hint{ position:absolute; left:50%; bottom:158px; transform:translateX(-50%); z-index:3; letter-spacing:.18em; }
    </style>`;

    el.querySelector('.cb-chips').innerHTML = ORDER.map(([pid, side, now]) =>
      `<div class="cb-chip ${side} ${now ? 'now' : ''}">${G.portrait(pid)}</div>`).join('');

    const TOKS = [
      { x: 640, y: 640, nm: 'ODILE', cls: 'now', hp: null },
      { x: 520, y: 700, nm: 'CASIMIR', cls: '', hp: null },
      { x: 566, y: 770, nm: 'WREN', cls: '', hp: null },
      { x: 700, y: 752, nm: 'GREAVES', cls: '', hp: null },
      { x: 1240, y: 430, nm: 'RUST-VICAR', cls: 'enemy big', hp: [88, 88] },
      { x: 1100, y: 560, nm: 'TALLOWMAN', cls: 'enemy', hp: [26, 34] },
      { x: 1330, y: 590, nm: 'TALLOWMAN', cls: 'enemy', hp: [41, 41] },
    ];
    el.querySelector('.cb-tokens').innerHTML = TOKS.map((t) => `
      <div class="cb-tok ${t.cls}" style="left:${t.x}px; top:${t.y}px">
        ${t.hp ? G.bar(t.hp[0], t.hp[1], 'hp') : ''}
        <i></i><span class="nm">${t.nm}</span>
      </div>`).join('');

    el.querySelector('.cb-loglines').innerHTML = LOG.map(([r, t]) =>
      `<div class="cb-logline"><span class="r">${r}</span><span class="t">${t}</span></div>`).join('');

    const abBox = el.querySelector('.cb-abilities');
    const hint = el.querySelector('.cb-hint');
    function renderAbilities() {
      abBox.innerHTML = ABILITIES.map(([n, ap], i) =>
        `<button class="cb-ab ${i === state.ability ? 'sel' : ''}" data-i="${i}">
          <span class="an">${n}</span><span class="ac">${ap} AP</span>
        </button>`).join('');
      hint.textContent = ABILITIES[state.ability][2].toUpperCase();
      abBox.querySelectorAll('.cb-ab').forEach((b) => {
        b.addEventListener('click', () => { state.ability = +b.dataset.i; renderAbilities(); });
        b.addEventListener('mouseenter', () => { hint.textContent = ABILITIES[+b.dataset.i][2].toUpperCase(); });
        b.addEventListener('mouseleave', () => { hint.textContent = ABILITIES[state.ability][2].toUpperCase(); });
      });
    }
    renderAbilities();
    el.querySelector('.cb-end').addEventListener('click', () => go('world'));
  },
});
