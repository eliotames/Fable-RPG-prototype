/* THE LONG NOON — character creation */
registerScreen({
  id: 'create', title: 'Creation',
  render(el) {
    const G = window.GAME;
    const ORIGINS = [
      { id: 'warden', name: 'Line-Warden', pid: 'odile',
        trait: ['The Timetable', 'Once per battle, act out of turn — precisely on the stroke of an hour that no longer comes.'],
        skills: '+2 Iron Hand · +1 Menace · +1 Composure',
        prose: 'You kept a schedule for a railway that outlived the sun. The Company is gone, the rails are singing to no one, and the only thing still running on time in Halver\u2019s Cross is you. People find that comforting. People are wrong.' },
      { id: 'novice', name: 'Synod Novice', pid: 'casimir',
        trait: ['The Kept Lens', 'Examine any mechanism and learn one true thing about it. The mechanism learns one true thing about you.'],
        skills: '+2 Horology · +1 Liturgy · +1 Appraise',
        prose: 'You were raised in the cathedral works, oiled and wound like everything else the Synod loves. You asked the forbidden question — not how the sun stopped, but who profited. They unmade your vows. Your hands still keep the winding rhythm in your sleep.' },
      { id: 'bastard', name: 'Dust Court Bastard', pid: 'wren',
        trait: ['Born Collateral', 'Debts notice you. Once per scene, transfer one consequence to someone who deserves it more.'],
        skills: '+2 Sleight · +1 Veilcraft · +1 Silver Tongue',
        prose: 'Your birth certificate is a promissory note. You grew up in the Court\u2019s ledgers, a liability with a pulse, and you have been quietly amending the arithmetic ever since. Locks open for you the way doors open for the respectable.' },
      { id: 'orphan', name: 'Yard Orphan', pid: 'greaves',
        trait: ['Six Feet of Patience', 'The dead do not startle you. Nothing does. Immune to Dread in the first round of any encounter.'],
        skills: '+2 Endure · +1 Labor · +1 Liturgy',
        prose: 'The Quiet Yard took you in when nothing else would, and you paid your keep in honest digging. You know what the city owes the people under it, grave by grave, name by name. Someday you intend to collect.' },
    ];
    const ATTRS = ['GRIT', 'GUILE', 'LORE', 'NERVE'];
    const state = { origin: 0, attrs: { GRIT: 2, GUILE: 2, LORE: 2, NERVE: 2 }, pool: 4 };

    el.innerHTML = `
    <div class="screen-pad cr-root">
      <header class="screen-head">
        <div>
          <div class="label faint">HALVER&rsquo;S CROSS &middot; NOON +2,191</div>
          <h2 class="screen-title screen-sub">Who Walks Out of the Dust</h2>
        </div>
        <div class="label faint">CHARACTER CREATION &mdash; I OF I</div>
      </header>
      <div class="cr-cols">
        <div class="cr-left">
          <div class="label small faint">ORIGIN</div>
          <div class="cr-origins"></div>
          <div class="pframe tick-frame cr-portrait"></div>
          <div>
            <div class="label small faint" style="margin-bottom:10px">NAME</div>
            <input class="input-line" type="text" placeholder="Unwritten&hellip;" value="" />
          </div>
        </div>
        <div class="cr-mid">
          <div class="cr-pool-row">
            <span class="label small faint">ATTRIBUTES</span>
            <span class="label small"><span class="cr-pool numeral" style="font-size:18px;color:var(--brass)">4</span>&nbsp; TO ALLOT</span>
          </div>
          <div class="cr-attrs"></div>
          <div class="rule" style="margin:38px 0 26px"><span>◆</span></div>
          <div class="cr-derived"></div>
        </div>
        <div class="cr-right">
          <h3 class="display cr-oname"></h3>
          <p class="prose cr-oprose"></p>
          <div class="hairline" style="margin:30px 0 22px"></div>
          <div class="label small faint" style="margin-bottom:10px">SIGNATURE</div>
          <div class="cr-trait"></div>
          <div class="label small faint" style="margin:28px 0 8px">INCLINATIONS</div>
          <div class="label cr-skills" style="letter-spacing:.14em"></div>
        </div>
      </div>
      <footer class="cr-foot">
        <button class="btn" data-go="title">&larr; Turn Back</button>
        <button class="btn primary" data-go="world">Walk Into the Noon</button>
      </footer>
    </div>
    <style>
      .cr-root{ display:flex; flex-direction:column; }
      .cr-cols{ flex:1; display:grid; grid-template-columns:330px 430px 1fr; gap:96px; margin-top:64px; min-height:0; }
      .cr-left{ display:flex; flex-direction:column; gap:26px; }
      .cr-origins{ display:flex; flex-direction:column; }
      .cr-orig{ background:none; border:none; text-align:left; cursor:pointer; padding:8px 2px;
        font-family:var(--f-display); font-size:23px; font-weight:500; color:var(--ink-faint);
        letter-spacing:.04em; transition:color .15s; display:flex; align-items:baseline; gap:12px; }
      .cr-orig::before{ content:'◇'; font-size:9px; color:var(--ink-faint); }
      .cr-orig:hover{ color:var(--ink-dim); }
      .cr-orig.sel{ color:var(--ink); }
      .cr-orig.sel::before{ content:'◆'; color:var(--accent-bright); }
      .cr-portrait{ width:204px; height:244px; cursor:default; }
      .cr-pool-row{ display:flex; justify-content:space-between; align-items:baseline; }
      .cr-attrs{ display:flex; flex-direction:column; margin-top:14px; }
      .cr-attr{ display:grid; grid-template-columns:1fr 70px 110px; align-items:center;
        padding:17px 2px; border-bottom:1px solid var(--line); }
      .cr-attr:first-child{ border-top:1px solid var(--line); }
      .cr-attr .an{ font-family:var(--f-mono); font-size:13px; letter-spacing:.26em; color:var(--ink-dim); }
      .cr-attr .av{ font-family:var(--f-display); font-weight:600; font-size:34px; color:var(--ink); text-align:center; }
      .cr-attr .stepper{ justify-content:flex-end; display:flex; }
      .cr-derived{ display:flex; gap:54px; }
      .cr-der .label{ margin-bottom:6px; }
      .cr-der b{ font-family:var(--f-display); font-weight:600; font-size:30px; color:var(--ink); }
      .cr-right{ max-width:560px; }
      .cr-oname{ font-size:40px; font-weight:500; letter-spacing:.1em; text-transform:uppercase; margin-bottom:22px; }
      .cr-trait b{ font-family:var(--f-display); font-size:24px; font-weight:600; color:var(--brass); display:block; margin-bottom:6px; }
      .cr-trait p{ font-family:var(--f-prose); font-size:17px; line-height:1.55; color:var(--ink-dim); }
      .cr-foot{ display:flex; justify-content:space-between; margin-top:30px; }
    </style>`;

    const origBox = el.querySelector('.cr-origins');
    const attrBox = el.querySelector('.cr-attrs');

    function renderOrigins() {
      origBox.innerHTML = ORIGINS.map((o, i) =>
        `<button class="cr-orig ${i === state.origin ? 'sel' : ''}" data-i="${i}">${o.name}</button>`).join('');
      origBox.querySelectorAll('.cr-orig').forEach((b) =>
        b.addEventListener('click', () => { state.origin = +b.dataset.i; renderOrigins(); renderOrigin(); }));
    }
    function renderOrigin() {
      const o = ORIGINS[state.origin];
      el.querySelector('.cr-portrait').innerHTML = window.GAME.portrait(o.pid);
      el.querySelector('.cr-oname').textContent = o.name;
      el.querySelector('.cr-oprose').textContent = o.prose;
      el.querySelector('.cr-trait').innerHTML = `<b>${o.trait[0]}</b><p>${o.trait[1]}</p>`;
      el.querySelector('.cr-skills').textContent = o.skills;
    }
    function renderAttrs() {
      attrBox.innerHTML = ATTRS.map((a) => `
        <div class="cr-attr">
          <span class="an">${a}</span>
          <span class="av">${G.roman(state.attrs[a])}</span>
          <span class="stepper">
            <button data-a="${a}" data-d="-1" ${state.attrs[a] <= 1 ? 'disabled' : ''}>&minus;</button>
            <button data-a="${a}" data-d="1" ${state.pool <= 0 || state.attrs[a] >= 5 ? 'disabled' : ''}>+</button>
          </span>
        </div>`).join('');
      el.querySelector('.cr-pool').textContent = state.pool;
      el.querySelector('.cr-derived').innerHTML = `
        <div class="cr-der"><div class="label small faint">VITALITY</div><b>${30 + state.attrs.GRIT * 8}</b></div>
        <div class="cr-der"><div class="label small faint">RESOLVE</div><b>${20 + state.attrs.NERVE * 6}</b></div>
        <div class="cr-der"><div class="label small faint">INITIATIVE</div><b>${6 + state.attrs.GUILE * 2 + state.attrs.NERVE}</b></div>`;
      attrBox.querySelectorAll('.stepper button').forEach((b) =>
        b.addEventListener('click', () => {
          const a = b.dataset.a, d = +b.dataset.d;
          if (d > 0 && state.pool > 0 && state.attrs[a] < 5) { state.attrs[a]++; state.pool--; }
          if (d < 0 && state.attrs[a] > 1) { state.attrs[a]--; state.pool++; }
          renderAttrs();
        }));
    }
    renderOrigins(); renderOrigin(); renderAttrs();
    el.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => go(b.getAttribute('data-go'))));
  },
});
