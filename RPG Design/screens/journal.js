/* THE LONG NOON — journal & quest log */
registerScreen({
  id: 'journal', title: 'Journal',
  render(el) {
    const G = window.GAME;
    const state = { tab: 'QUESTS', quest: 0 };

    el.innerHTML = `
    <div class="screen-pad jn-root">
      <header class="screen-head">
        <div>
          <div class="label faint">KEPT IN ODILE&rsquo;S HAND, MOSTLY</div>
          <h2 class="screen-title screen-sub">Journal</h2>
        </div>
        <div class="tab-row jn-tabs"></div>
      </header>
      <div class="jn-body"></div>
    </div>
    <style>
      .jn-root{ display:flex; flex-direction:column; }
      .jn-body{ flex:1; margin-top:58px; min-height:0; }
      .jn-quests{ height:100%; display:grid; grid-template-columns:440px 1fr; gap:130px; }
      .jn-group{ margin-bottom:36px; }
      .jn-group .label{ margin-bottom:10px; }
      .jn-detail{ max-width:760px; }
      .jn-qtitle{ font-family:var(--f-display); font-size:46px; font-weight:500; letter-spacing:.05em; line-height:1.1; }
      .jn-qloc{ margin-top:12px; }
      .jn-objs{ margin:36px 0 8px; }
      .jn-obj{ display:flex; gap:14px; align-items:baseline; padding:10px 0; }
      .jn-obj .d{ font-size:9px; color:var(--ink-dim); }
      .jn-obj.done .d{ color:var(--ink-faint); }
      .jn-obj .t{ font-family:var(--f-prose); font-size:19px; color:var(--ink); }
      .jn-obj.done .t{ color:var(--ink-faint); text-decoration:line-through; text-decoration-color:var(--line-strong); }
      .jn-entry{ margin-top:34px; }
      .jn-entry .label{ margin-bottom:10px; }
      .jn-entry p{ font-size:18.5px; }
      .jn-chron{ height:100%; display:grid; grid-template-columns:440px 1fr; gap:130px; }
      .jn-chron-intro{ font-style:italic; color:var(--ink-faint); font-size:19px; line-height:1.7; padding-top:6px; }
      .jn-chron-list{ max-width:760px; overflow-y:auto; }
      .jn-failed-note{ margin-top:26px; font-style:italic; color:var(--accent-bright); font-size:16px; opacity:.8; }
      .jn-scroll{ overflow-y:auto; height:100%; padding-right:20px; }
    </style>`;

    const tabs = el.querySelector('.jn-tabs');
    const body = el.querySelector('.jn-body');

    function renderTabs() {
      tabs.innerHTML = ['QUESTS', 'CHRONICLE'].map((t) =>
        `<button class="tab ${t === state.tab ? 'sel' : ''}" data-t="${t}">${t}</button>`).join('');
      tabs.querySelectorAll('.tab').forEach((t) =>
        t.addEventListener('click', () => { state.tab = t.dataset.t; renderTabs(); renderBody(); }));
    }

    function questList() {
      const groups = ['THE GREAT WORK', 'LESSER WORKS'];
      return groups.map((g) => `
        <div class="jn-group">
          <div class="label small faint">${g}</div>
          ${G.QUESTS.map((q, i) => q.group !== g ? '' : `
            <div class="qitem ${i === state.quest ? 'sel' : ''} ${q.status === 'done' ? 'done' : ''} ${q.status === 'failed' ? 'failed' : ''}" data-i="${i}">
              <span class="d">${q.status === 'active' ? '◆' : '◇'}</span>
              <span class="t">${q.title}</span>
            </div>`).join('')}
        </div>`).join('');
    }

    function renderBody() {
      if (state.tab === 'QUESTS') {
        const q = G.QUESTS[state.quest];
        body.innerHTML = `
        <div class="jn-quests">
          <div class="jn-scroll scroll">${questList()}</div>
          <div class="jn-detail jn-scroll scroll">
            <h3 class="jn-qtitle">${q.title}</h3>
            <div class="jn-qloc label faint">${q.loc.toUpperCase()} &nbsp;&middot;&nbsp; ${q.status.toUpperCase()}</div>
            <div class="jn-objs">
              ${q.objectives.map(([t, done]) =>
                `<div class="jn-obj ${done ? 'done' : ''}"><span class="d">${done ? '◇' : '◆'}</span><span class="t">${t}</span></div>`).join('')}
            </div>
            <div class="hairline"></div>
            ${q.entries.map(([d, t]) =>
              `<div class="jn-entry"><div class="label small faint">${d}</div><p class="prose">${t}</p></div>`).join('')}
            ${q.status === 'failed' ? '<p class="jn-failed-note">This work is concluded, and not in our favor.</p>' : ''}
          </div>
        </div>`;
        body.querySelectorAll('.qitem').forEach((it) =>
          it.addEventListener('click', () => { state.quest = +it.dataset.i; renderBody(); }));
      } else {
        body.innerHTML = `
        <div class="jn-chron">
          <p class="jn-chron-intro">Being a true account of the Company of the Stalled Sun, kept against the day there are days again — so that someone, somewhere, will know we did not simply stand here squinting.</p>
          <div class="jn-chron-list jn-scroll scroll">
            ${G.CHRONICLE.map(([d, t]) =>
              `<div class="jn-entry"><div class="label small faint">${d}</div><p class="prose">${t}</p></div>`).join('')}
          </div>
        </div>`;
      }
    }
    renderTabs(); renderBody();
  },
});
