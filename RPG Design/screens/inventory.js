/* THE LONG NOON — equipment & inventory */
registerScreen({
  id: 'inventory', title: 'Inventory',
  render(el) {
    const G = window.GAME;
    const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1">${p}</svg>`;
    const ICONS = {
      ammo: I('<rect x="6" y="8" width="3" height="9"/><rect x="11" y="6" width="3" height="11"/><rect x="16" y="8" width="3" height="9"/><path d="M6 8 L7.5 5 L9 8 M11 6 L12.5 3 L14 6 M16 8 L17.5 5 L19 8"/>'),
      kit: I('<rect x="4" y="6" width="16" height="13"/><path d="M12 9 L12 16 M8.5 12.5 L15.5 12.5"/>'),
      candle: I('<rect x="10" y="9" width="4" height="11"/><path d="M12 7 q2.4 -3 0 -5 q-2.4 2 0 5"/>'),
      key: I('<circle cx="8" cy="8" r="3.5"/><path d="M10.5 10.5 L18 18 M15 15 L17 13 M16.5 16.5 L19 14.5"/>'),
      map: I('<path d="M4 6 L9.5 4 L14.5 6 L20 4 L20 18 L14.5 20 L9.5 18 L4 20 Z M9.5 4 L9.5 18 M14.5 6 L14.5 20"/>'),
      spike: I('<path d="M6 18 L16 5 M16 5 L18 3 M14 7 L19 9"/>'),
      flask: I('<path d="M10 4 L14 4 M11 4 L11 9 L6.5 18 a1 1 0 0 0 1 1.5 L16.5 19.5 a1 1 0 0 0 1 -1.5 L13 9 L13 4"/><path d="M8.5 15 L15.5 15"/>'),
      dice: I('<rect x="5" y="5" width="14" height="14"/><circle cx="9" cy="9" r="0.8" fill="currentColor"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/><circle cx="15" cy="15" r="0.8" fill="currentColor"/>'),
      letter: I('<rect x="4" y="6" width="16" height="12"/><path d="M4 7 L12 13 L20 7"/>'),
      spring: I('<path d="M7 19 C3 16 9 13 12 12 C15 11 21 8 17 5"/><path d="M7 19 L9 20 M17 5 L15 4"/>'),
      weapon: I('<path d="M4 14 L13 14 L13 10 L19 10 L19 13 L15 13 L14 17 L10 17 L10 14 M13 10 L13 8"/>'),
    };
    const state = { sel: 0, item: { src: 'pack', i: 0 } };

    el.innerHTML = `
    <div class="screen-pad iv-root">
      <header class="screen-head">
        <div>
          <div class="label faint">WHAT THE COMPANY CARRIES</div>
          <h2 class="screen-title screen-sub">Inventory</h2>
        </div>
        <div class="tab-row iv-tabs"></div>
      </header>
      <div class="iv-cols">
        <div class="iv-doll">
          <div class="pframe tick-frame iv-portrait"></div>
          <div class="iv-equip"></div>
        </div>
        <div class="iv-mid">
          <div class="label small faint" style="margin-bottom:16px">COMMON PACK</div>
          <div class="iv-grid"></div>
          <div class="iv-burden">
            <span class="label small faint">BURDEN &nbsp;31 / 80</span>
            <span class="label small"><span style="color:var(--brass)">◆</span>&nbsp; 212 MARKS</span>
          </div>
        </div>
        <div class="iv-detail"></div>
      </div>
    </div>
    <style>
      .iv-root{ display:flex; flex-direction:column; }
      .iv-cols{ flex:1; display:grid; grid-template-columns:300px 480px 1fr; gap:104px; margin-top:58px; min-height:0; }
      .iv-portrait{ width:190px; height:226px; cursor:default; margin-bottom:30px; }
      .iv-eq{ display:grid; grid-template-columns:92px 1fr; align-items:baseline;
        padding:11px 2px; border-bottom:1px solid var(--line); cursor:pointer; }
      .iv-eq:first-child{ border-top:1px solid var(--line); }
      .iv-eq .en{ font-family:var(--f-mono); font-size:10px; letter-spacing:.2em; color:var(--ink-faint); text-transform:uppercase; }
      .iv-eq .ev{ font-family:var(--f-prose); font-size:16.5px; color:var(--ink-dim); transition:color .12s; }
      .iv-eq:hover .ev{ color:var(--ink); }
      .iv-eq.sel .ev{ color:var(--ink); }
      .iv-eq.sel .en{ color:var(--accent-bright); }
      .iv-eq .ev.none{ color:var(--ink-faint); font-style:italic; }
      .iv-grid{ display:grid; grid-template-columns:repeat(6,72px); grid-auto-rows:72px; gap:10px; }
      .iv-slot{ border:1px solid var(--line); display:grid; place-items:center; position:relative;
        color:var(--ink-dim); cursor:pointer; transition:border-color .12s,color .12s; background:rgba(12,10,8,.3); }
      .iv-slot svg{ width:30px; height:30px; }
      .iv-slot:hover{ border-color:var(--line-strong); color:var(--ink); }
      .iv-slot.sel{ border-color:var(--line-strong); color:var(--ink); }
      .iv-slot.sel::after{ content:''; position:absolute; left:0; right:0; bottom:0; height:2px; background:var(--accent); }
      .iv-slot.empty{ cursor:default; background:none; border-color:var(--line); opacity:.45; }
      .iv-slot .q{ position:absolute; right:5px; bottom:3px; font-family:var(--f-mono); font-size:10px; color:var(--ink-faint); }
      .iv-burden{ display:flex; justify-content:space-between; margin-top:26px; width:482px; }
      .iv-detail{ max-width:460px; display:flex; flex-direction:column; }
      .iv-dname{ font-family:var(--f-display); font-size:36px; font-weight:500; letter-spacing:.04em; line-height:1.15; }
      .iv-dkind{ margin-top:10px; }
      .iv-dstats{ margin:26px 0 0; font-family:var(--f-mono); font-size:13px; letter-spacing:.14em; color:var(--brass); }
      .iv-dprose{ margin-top:24px; font-style:italic; color:var(--ink-dim); font-size:18px; line-height:1.66; }
      .iv-dfoot{ margin-top:54px; display:flex; gap:44px; }
      .iv-dfoot .label{ white-space:nowrap; }
    </style>`;

    const tabs = el.querySelector('.iv-tabs');
    const equipBox = el.querySelector('.iv-equip');
    const grid = el.querySelector('.iv-grid');
    const detail = el.querySelector('.iv-detail');

    function renderTabs() {
      tabs.innerHTML = G.PARTY.map((p, i) =>
        `<button class="tab ${i === state.sel ? 'sel' : ''}" data-i="${i}">${p.name.split(' ')[0]}</button>`).join('');
      tabs.querySelectorAll('.tab').forEach((t) =>
        t.addEventListener('click', () => { state.sel = +t.dataset.i; state.item = { src: 'equip', i: 3 }; renderAll(); }));
    }
    function renderDoll() {
      const p = G.PARTY[state.sel];
      el.querySelector('.iv-portrait').innerHTML = G.portrait(p.id);
      equipBox.innerHTML = G.EQUIP[p.id].map(([slot, item], i) =>
        `<div class="iv-eq ${state.item.src === 'equip' && state.item.i === i ? 'sel' : ''}" data-i="${i}">
          <span class="en">${slot}</span><span class="ev ${item === '\u2014' ? 'none' : ''}">${item}</span>
        </div>`).join('');
      equipBox.querySelectorAll('.iv-eq').forEach((r) =>
        r.addEventListener('click', () => { state.item = { src: 'equip', i: +r.dataset.i }; renderAll(); }));
    }
    function renderGrid() {
      let h = G.PACK.map((it, i) =>
        `<div class="iv-slot ${state.item.src === 'pack' && state.item.i === i ? 'sel' : ''}" data-i="${i}" title="${it.n}">
          ${ICONS[it.icon] || ''}${it.q > 1 ? `<span class="q">${it.q}</span>` : ''}
        </div>`).join('');
      for (let i = G.PACK.length; i < 18; i++) h += '<div class="iv-slot empty"></div>';
      grid.innerHTML = h;
      grid.querySelectorAll('.iv-slot:not(.empty)').forEach((s) =>
        s.addEventListener('click', () => { state.item = { src: 'pack', i: +s.dataset.i }; renderAll(); }));
    }
    function renderDetail() {
      let d;
      if (state.item.src === 'pack') {
        const it = G.PACK[state.item.i];
        d = { n: it.n, kind: it.kind, stats: '', prose: it.d, wt: it.wt, val: it.val, q: it.q };
      } else {
        const p = G.PARTY[state.sel];
        const [slot, item] = G.EQUIP[p.id][state.item.i];
        const w = G.WEAPON_DETAIL[item];
        d = item === '\u2014'
          ? { n: 'Nothing', kind: slot + ' — Empty', stats: '', prose: 'An honest absence. In Halver\u2019s Cross, that is rarer than it sounds.', wt: 0, val: '\u2014' }
          : { n: item, kind: w ? w.kind : slot + ' — Worn', stats: w ? w.stats : '', prose: w ? w.d : 'Kept, mended, and trusted. ' + G.PARTY[state.sel].name.split(' ')[0] + ' would not part with it for marks.', wt: w ? w.wt : 1.0, val: w ? w.val : 8 };
      }
      detail.innerHTML = `
        <div class="label small faint" style="margin-bottom:16px">THE ARTICLE</div>
        <h3 class="iv-dname">${d.n}${d.q > 1 ? ` <span style="color:var(--ink-faint);font-size:22px">× ${d.q}</span>` : ''}</h3>
        <div class="iv-dkind label">${d.kind.toUpperCase()}</div>
        ${d.stats ? `<div class="iv-dstats">${d.stats}</div>` : ''}
        <p class="iv-dprose prose">${d.prose}</p>
        <div class="iv-dfoot">
          <div><div class="label small faint" style="margin-bottom:4px">WEIGHT</div><span class="label">${d.wt} LB</span></div>
          <div><div class="label small faint" style="margin-bottom:4px">VALUE</div><span class="label">${d.val} MARKS</span></div>
        </div>`;
    }
    function renderAll() { renderTabs(); renderDoll(); renderGrid(); renderDetail(); }
    renderAll();
  },
});
