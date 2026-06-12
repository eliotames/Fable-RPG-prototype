/* THE LONG NOON — skill & ability trees */
registerScreen({
  id: 'skills', title: 'Arts',
  render(el) {
    const G = window.GAME;
    // status: 2 = learned, 1 = attainable, 0 = beyond reach
    const TREES = {
      odile: { insights: 3, branches: [
        { name: 'Iron Liturgy', nodes: [
          ['Fan the Hammer', 2, '3 AP — Empty three chambers into adjacent fates. Accuracy is a prayer, volume is a doctrine.'],
          ['Deadeye', 2, '2 AP — Take the time nobody else has. +25% to hit, ignores cover.'],
          ['Sixth Chamber', 1, 'Passive — The last round in the cylinder always counts as blessed.'],
          ['The Hour Strikes', 0, '5 AP — Once per battle, it is noon for exactly one bullet. It does not miss.'],
        ]},
        { name: 'Warden\u2019s Oath', nodes: [
          ['Brace', 2, '1 AP — Plant your feet. +2 Armor until your next turn.'],
          ['Hold the Line', 1, 'Passive — Enemies pay 1 extra AP to move past you. The timetable is sacred.'],
          ['No Passage', 0, 'Reaction — Strike the first enemy to cross your line each round.'],
          ['Last Warden', 0, 'Passive — While below half Vitality, your Oath abilities cost no AP.'],
        ]},
        { name: 'Last Rites', nodes: [
          ['Pistol-Whip', 2, '1 AP — The butt end of the argument. Dazes for one turn.'],
          ['Mercy', 1, '2 AP — Execute a Dazed enemy below a quarter Vitality. Quick. Quiet. Owed.'],
          ['Read the Sentence', 0, '1 AP — Name an enemy\u2019s crime. They lose 2 Resolve; you regain 2.'],
          ['Seven to Noon', 0, 'Passive — Each enemy felled returns one minute to the world. Allegedly.'],
        ]},
      ]},
      casimir: { insights: 1, branches: [
        { name: 'Horologium', nodes: [
          ['Wind Down', 2, '2 AP — Slow a mechanism or a man. Target loses 2 AP next turn.'],
          ['Escapement', 2, 'Passive — Casimir always acts on a predictable beat. +3 Initiative.'],
          ['Stop the Tooth', 1, '3 AP — Halt one construct or clockwork outright for a round.'],
          ['Anti-Clockwise', 0, '6 AP — Turn one event back by six seconds. The Synod burned people for this.'],
        ]},
        { name: 'Choirworks', nodes: [
          ['Hymn of Oil', 2, '2 AP — A working song. Ally weapon gains +2 damage for the battle.'],
          ['Stalled Chord', 1, '3 AP — A note the world forgot to finish. Enemies in a line lose 3 Resolve.'],
          ['Bell Logic', 0, 'Passive — When any bell sounds, Casimir\u2019s next art is free.'],
          ['The Quiet Octave', 0, '4 AP — Silence everything in the arena for one round. Everything.'],
        ]},
        { name: 'Benediction', nodes: [
          ['Salve', 2, '2 AP — Oil and scripture. Restore 8\u201314 Vitality to a touched ally.'],
          ['Unction', 1, '2 AP — Restore 6 Resolve. The words are old; the comfort is older.'],
          ['Last Oil', 0, '3 AP — A fallen ally rises with 1 Vitality and a debt.'],
          ['Absolution', 0, 'Passive — Allies who fall beside Casimir keep their Resolve when they rise.'],
        ]},
      ]},
      wren: { insights: 2, branches: [
        { name: 'Latchcraft', nodes: [
          ['Pick', 2, 'Field — No lock under a Formidable rating resists. None ever have.'],
          ['Through the Keyhole', 2, 'Field — Learn what waits behind any door before opening it.'],
          ['Skeleton Hand', 1, 'Passive — Once per scene, steal an item nobody saw her near.'],
          ['No Door', 0, 'Field — Walls under two feet of brick are a suggestion.'],
        ]},
        { name: 'Veilwork', nodes: [
          ['Soft Step', 2, 'Passive — Movement makes no sound on wood, stone, or conscience.'],
          ['Dustcloak', 1, '2 AP — Vanish until your next act. The dust owes her family.'],
          ['Unwitnessed', 0, 'Passive — Attacks from hiding cannot be traced to her. Ever. By anyone.'],
          ['Gone', 0, 'Reaction — When reduced below a quarter Vitality, leave the battle. Choose where.'],
        ]},
        { name: 'Knifesong', nodes: [
          ['First Verse', 2, '1 AP — A short blade, a short argument. Bleeds 2 per turn.'],
          ['Refrain', 1, '2 AP — Strike twice. The second cut lands where the first taught it to.'],
          ['Harmony', 0, 'Passive — Bleeding enemies take +3 from all Company attacks.'],
          ['Coda', 0, '4 AP — End a bleeding enemy below a third Vitality. The song resolves.'],
        ]},
      ]},
      greaves: { insights: 4, branches: [
        { name: 'The Quiet Yard', nodes: [
          ['Dig In', 2, '1 AP — Greaves becomes terrain. Cannot be moved until he wills it.'],
          ['Headstone', 2, '2 AP — Plant the spade. Adjacent allies gain +2 Armor behind it.'],
          ['Six Feet', 1, '3 AP — Open the ground beneath an enemy. They spend a turn climbing out.'],
          ['Potter\u2019s Field', 0, 'Passive — The unburied dead in the arena answer to him, not the enemy.'],
        ]},
        { name: 'Bearing', nodes: [
          ['Shoulder', 2, '1 AP — Carry a fallen ally and keep fighting one-handed.'],
          ['Unmoved', 1, 'Passive — Immune to fear, charm, and persuasive economics.'],
          ['Cornerstone', 0, 'Passive — Allies adjacent to Greaves cannot be knocked down.'],
          ['Atlas of Graves', 0, 'Passive — +1 to all rolls on consecrated ground. He consecrates quickly.'],
        ]},
        { name: 'Old Rites', nodes: [
          ['Salt the Ground', 2, '2 AP — Nothing dead crosses the line he draws. Nothing.'],
          ['Bell, Book, Spade', 1, '3 AP — The full rite, abbreviated. 9\u201316 damage to the unhallowed.'],
          ['Lych Way', 0, 'Field — Walk the corpse-roads between any two churchyards.'],
          ['The Long Service', 0, '6 AP — Bury something that is still standing up.'],
        ]},
      ]},
    };
    const POS = {
      branch: [
        [[420, 452], [318, 360], [243, 258], [192, 148]],
        [[570, 430], [570, 322], [570, 214], [570, 106]],
        [[720, 452], [822, 360], [897, 258], [948, 148]],
      ],
      root: [570, 548],
    };
    const state = { sel: 0, node: [0, 0] };

    el.innerHTML = `
    <div class="screen-pad sk-root">
      <header class="screen-head">
        <div>
          <div class="label faint">WHAT THE COMPANY KNOWS HOW TO DO</div>
          <h2 class="screen-title screen-sub">Arts &amp; Disciplines</h2>
        </div>
        <div class="tab-row sk-tabs"></div>
      </header>
      <div class="sk-cols">
        <div class="sk-treewrap"><svg class="sk-svg" viewBox="0 0 1140 640"></svg></div>
        <div class="sk-detail"></div>
      </div>
    </div>
    <style>
      .sk-root{ display:flex; flex-direction:column; }
      .sk-cols{ flex:1; display:grid; grid-template-columns:1140px 1fr; gap:60px; margin-top:30px; min-height:0; }
      .sk-svg{ width:100%; height:100%; }
      .sk-node{ cursor:pointer; }
      .sk-blabel{ font-family:var(--f-mono); font-size:11px; letter-spacing:.24em; fill:var(--ink-faint); text-transform:uppercase; }
      .sk-nlabel{ font-family:var(--f-prose); font-size:15px; fill:var(--ink-dim); }
      .sk-node:hover .sk-nlabel{ fill:var(--ink); }
      .sk-detail{ max-width:440px; display:flex; flex-direction:column; padding-top:36px; }
      .sk-dname{ font-family:var(--f-display); font-size:36px; font-weight:500; letter-spacing:.04em; line-height:1.15; }
      .sk-dstate{ margin-top:12px; }
      .sk-dprose{ margin-top:26px; font-size:18.5px; line-height:1.66; color:var(--ink-dim); }
      .sk-insights{ margin-top:auto; padding-top:30px; display:flex; align-items:baseline; gap:14px; }
      .sk-insights b{ font-family:var(--f-display); font-weight:600; font-size:30px; color:var(--brass); }
      .sk-learnbtn{ margin-top:22px; align-self:flex-start; }
    </style>`;

    const tabs = el.querySelector('.sk-tabs');
    const svg = el.querySelector('.sk-svg');
    const detail = el.querySelector('.sk-detail');

    function renderTabs() {
      tabs.innerHTML = G.PARTY.map((p, i) =>
        `<button class="tab ${i === state.sel ? 'sel' : ''}" data-i="${i}">${p.name.split(' ')[0]}</button>`).join('');
      tabs.querySelectorAll('.tab').forEach((t) =>
        t.addEventListener('click', () => { state.sel = +t.dataset.i; state.node = [0, 0]; renderTabs(); renderTree(); renderDetail(); }));
    }

    function renderTree() {
      const p = G.PARTY[state.sel];
      const tree = TREES[p.id];
      const [rx, ry] = POS.root;
      let h = '';
      tree.branches.forEach((br, bi) => {
        const pts = POS.branch[bi];
        let prev = [rx, ry], prevSt = 2;
        br.nodes.forEach(([, st], ni) => {
          const [x, y] = pts[ni];
          const lit = st === 2 && prevSt === 2;
          h += `<line x1="${prev[0]}" y1="${prev[1]}" x2="${x}" y2="${y}"
            stroke="${lit ? 'var(--line-strong)' : 'var(--line)'}" stroke-width="1"
            ${st === 0 ? 'stroke-dasharray="3 5"' : ''}></line>`;
          prev = [x, y]; prevSt = st;
        });
        const tip = pts[3];
        h += `<text class="sk-blabel" x="${tip[0]}" y="${tip[1] - 34}" text-anchor="middle">${br.name}</text>`;
      });
      h += `<circle cx="${rx}" cy="${ry}" r="17" fill="none" stroke="var(--line-strong)" stroke-width="1"></circle>
            <circle cx="${rx}" cy="${ry}" r="6" fill="var(--ink-dim)"></circle>
            <text class="sk-blabel" x="${rx}" y="${ry + 44}" text-anchor="middle">${p.epithet.replace('The ', 'THE ')}</text>`;
      tree.branches.forEach((br, bi) => {
        br.nodes.forEach(([name, st], ni) => {
          const [x, y] = POS.branch[bi][ni];
          const sel = state.node[0] === bi && state.node[1] === ni;
          let core = '';
          if (st === 2) core = `<circle cx="${x}" cy="${y}" r="8" fill="var(--accent)"></circle>
                                <circle cx="${x}" cy="${y}" r="13" fill="none" stroke="var(--line-strong)" stroke-width="1"></circle>`;
          else if (st === 1) core = `<circle cx="${x}" cy="${y}" r="9" fill="var(--bg-1)" stroke="var(--ink-dim)" stroke-width="1.2"></circle>`;
          else core = `<circle cx="${x}" cy="${y}" r="7" fill="var(--bg-1)" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="2 3"></circle>`;
          const lx = bi === 0 ? x - 22 : bi === 2 ? x + 22 : x + 24;
          const anch = bi === 0 ? 'end' : 'start';
          h += `<g class="sk-node" data-b="${bi}" data-n="${ni}">
            ${sel ? `<circle cx="${x}" cy="${y}" r="19" fill="none" stroke="var(--accent-bright)" stroke-width="1"></circle>` : ''}
            ${core}
            <text class="sk-nlabel" x="${lx}" y="${y + 5}" text-anchor="${anch}" ${st === 0 ? 'opacity="0.55"' : ''}>${name}</text>
            <circle cx="${x}" cy="${y}" r="26" fill="transparent"></circle>
          </g>`;
        });
      });
      svg.innerHTML = h;
      svg.querySelectorAll('.sk-node').forEach((n) =>
        n.addEventListener('click', () => { state.node = [+n.dataset.b, +n.dataset.n]; renderTree(); renderDetail(); }));
    }

    function renderDetail() {
      const p = G.PARTY[state.sel];
      const tree = TREES[p.id];
      const br = tree.branches[state.node[0]];
      const [name, st, desc] = br.nodes[state.node[1]];
      const states = ['BEYOND REACH — THE PATH IS NOT YET WALKED', 'ATTAINABLE — 1 INSIGHT', 'KNOWN'];
      detail.innerHTML = `
        <div class="label small faint" style="margin-bottom:16px">${br.name.toUpperCase()}</div>
        <h3 class="sk-dname">${name}</h3>
        <div class="sk-dstate label ${st === 1 ? '' : 'faint'}">${states[st]}</div>
        <p class="sk-dprose prose">${desc}</p>
        ${st === 1 ? '<button class="btn primary sk-learnbtn">Commit Insight</button>' : ''}
        <div class="sk-insights">
          <span class="label small faint">INSIGHTS UNSPENT</span><b>${tree.insights}</b>
        </div>`;
      const learn = detail.querySelector('.sk-learnbtn');
      if (learn) learn.addEventListener('click', () => {
        if (tree.insights > 0) { br.nodes[state.node[1]][1] = 2; tree.insights--; renderTree(); renderDetail(); }
      });
    }
    renderTabs(); renderTree(); renderDetail();
  },
});
