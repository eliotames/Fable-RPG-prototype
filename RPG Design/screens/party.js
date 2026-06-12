/* THE LONG NOON — party stats */
registerScreen({
  id: 'party', title: 'Party',
  render(el) {
    const G = window.GAME;
    const state = { sel: 0, hover: null };

    el.innerHTML = `
    <div class="screen-pad pt-root">
      <header class="screen-head">
        <div>
          <div class="label faint">THE COMPANY OF THE STALLED SUN</div>
          <h2 class="screen-title screen-sub">Party</h2>
        </div>
        <div class="label faint">NOON +2,191 &middot; GALLOWS ROW</div>
      </header>
      <div class="pt-cols">
        <div class="pt-rail"></div>
        <div class="pt-main"></div>
        <div class="pt-side"></div>
      </div>
    </div>
    <style>
      .pt-root{ display:flex; flex-direction:column; }
      .pt-cols{ flex:1; display:grid; grid-template-columns:150px 880px 1fr; gap:100px; margin-top:64px; min-height:0; }
      .pt-rail{ display:flex; flex-direction:column; gap:18px; }
      .pt-rail .pframe{ width:128px; height:152px; }
      .pt-name{ font-family:var(--f-display); font-size:52px; font-weight:500; letter-spacing:.06em; line-height:1.05; }
      .pt-epi{ margin-top:10px; }
      .pt-attr-row{ display:flex; gap:78px; margin:44px 0 10px; }
      .pt-attr .label{ margin-bottom:4px; }
      .pt-attr b{ font-family:var(--f-display); font-weight:600; font-size:38px; color:var(--ink); }
      .pt-skills{ display:grid; grid-template-columns:repeat(4,1fr); gap:0 56px; margin-top:26px; }
      .pt-sk{ display:flex; justify-content:space-between; align-items:baseline;
        padding:11px 2px; border-bottom:1px solid var(--line); cursor:default; }
      .pt-sk:nth-child(-n+8){ border-top:1px solid var(--line); }
      .pt-sk .sn{ font-family:var(--f-prose); font-size:16.5px; color:var(--ink-dim); transition:color .12s; white-space:nowrap; }
      .pt-sk .sv{ font-family:var(--f-mono); font-size:13px; color:var(--ink); }
      .pt-sk:hover .sn{ color:var(--ink); }
      .pt-sk.high .sv{ color:var(--brass); }
      .pt-skdesc{ margin-top:22px; min-height:26px; font-style:italic; color:var(--ink-faint);
        font-family:var(--f-prose); font-size:17px; }
      .pt-side{ max-width:420px; display:flex; flex-direction:column; }
      .pt-vital{ margin-bottom:26px; }
      .pt-vital .vr{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
      .pt-vital .vn{ font-family:var(--f-mono); font-size:11px; letter-spacing:.22em; color:var(--ink-faint); }
      .pt-vital .vv{ font-family:var(--f-mono); font-size:13px; color:var(--ink-dim); white-space:nowrap; }
      .pt-status{ margin:30px 0; }
      .pt-status .st{ font-family:var(--f-prose); font-size:16.5px; color:var(--ink-dim);
        padding:9px 0; border-bottom:1px solid var(--line); display:flex; gap:12px; align-items:baseline; }
      .pt-status .st::before{ content:'◆'; font-size:8px; color:var(--accent-bright); }
      .pt-bio{ font-style:italic; color:var(--ink-dim); font-size:17.5px; line-height:1.66; }
      .pt-mini{ display:flex; gap:36px; margin-top:34px; }
      .pt-mini .m .label{ margin-bottom:3px; }
      .pt-mini .m b{ font-family:var(--f-display); font-weight:600; font-size:26px; color:var(--ink); }
    </style>`;

    const rail = el.querySelector('.pt-rail');
    const main = el.querySelector('.pt-main');
    const side = el.querySelector('.pt-side');

    function renderRail() {
      rail.innerHTML = G.PARTY.map((p, i) =>
        `<div class="pframe ${i === state.sel ? 'sel' : ''}" data-i="${i}" title="${p.name}">${G.portrait(p.id)}</div>`).join('');
      rail.querySelectorAll('.pframe').forEach((f) =>
        f.addEventListener('click', () => { state.sel = +f.dataset.i; renderRail(); renderMain(); }));
    }
    function renderMain() {
      const p = G.PARTY[state.sel];
      const skillRows = Object.keys(G.SKILL_DEFS).map((attr) =>
        G.SKILL_DEFS[attr].map(([sn, sd]) => ({ attr, sn, sd, v: p.skills[sn] }))
      );
      // interleave columns: one column per attribute
      const cols = skillRows;
      let grid = '';
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          const s = cols[c][r];
          grid += `<div class="pt-sk ${s.v >= 8 ? 'high' : ''}" data-d="${s.sd}"><span class="sn">${s.sn}</span><span class="sv">${s.v}</span></div>`;
        }
      main.innerHTML = `
        <h3 class="pt-name">${p.name}</h3>
        <div class="pt-epi label">${p.epithet.toUpperCase()} &nbsp;&middot;&nbsp; ${p.cls.toUpperCase()}</div>
        <div class="pt-attr-row">${Object.keys(p.attrs).map((a) =>
          `<div class="pt-attr"><div class="label small faint">${a}</div><b>${G.roman(p.attrs[a])}</b></div>`).join('')}
        </div>
        <div class="pt-skills">
          ${Object.keys(G.SKILL_DEFS).map((a) => `<div class="label small faint" style="padding-bottom:10px">${a}</div>`).join('')}
          ${grid}
        </div>
        <div class="pt-skdesc">Hover a skill to hear from it.</div>`;
      main.querySelectorAll('.pt-sk').forEach((s) => {
        s.addEventListener('mouseenter', () => { main.querySelector('.pt-skdesc').textContent = '“' + s.dataset.d + '”'; });
        s.addEventListener('mouseleave', () => { main.querySelector('.pt-skdesc').textContent = 'Hover a skill to hear from it.'; });
      });
      side.innerHTML = `
        <div class="label small faint" style="margin-bottom:18px">CONDITION</div>
        <div class="pt-vital">
          <div class="vr"><span class="vn">VITALITY</span><span class="vv">${p.hp[0]} / ${p.hp[1]}</span></div>
          ${G.bar(p.hp[0], p.hp[1], 'hp tall')}
        </div>
        <div class="pt-vital">
          <div class="vr"><span class="vn">RESOLVE</span><span class="vv">${p.res[0]} / ${p.res[1]}</span></div>
          ${G.bar(p.res[0], p.res[1], 'res tall')}
        </div>
        <div class="pt-mini">
          <div class="m"><div class="label small faint">LEVEL</div><b>${p.lvl}</b></div>
          <div class="m"><div class="label small faint">INITIATIVE</div><b>${p.init}</b></div>
          <div class="m"><div class="label small faint">ARMOR</div><b>${p.armor}</b></div>
          <div class="m"><div class="label small faint">ACTION</div><b>${p.ap}</b></div>
        </div>
        <div class="pt-status">
          <div class="label small faint" style="margin-bottom:6px">BEARING</div>
          ${p.status.map((s) => `<div class="st">${s}</div>`).join('')}
        </div>
        <p class="pt-bio prose">${p.bio}</p>`;
    }
    renderRail(); renderMain();
  },
});
