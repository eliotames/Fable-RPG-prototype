/* THE LONG NOON — options */
registerScreen({
  id: 'options', title: 'Options',
  render(el) {
    const CATS = {
      DISPLAY: [
        ['choice', 'Resolution', ['1920 × 1080', '2560 × 1440', '3840 × 2160'], 0],
        ['choice', 'Display Mode', ['Borderless', 'Fullscreen', 'Windowed'], 0],
        ['slider', 'Vignette', 55],
        ['slider', 'Gamma — “how dark is too dark”', 40],
        ['toggle', 'Film Grain', true],
        ['toggle', 'Letterbox in Dialogue', true],
      ],
      SOUND: [
        ['slider', 'Master', 70],
        ['slider', 'Music — The Stalled Choir', 55],
        ['slider', 'Effects', 80],
        ['slider', 'Voices', 75],
        ['toggle', 'Quiet When the Bell Rings', true],
      ],
      GAMEPLAY: [
        ['choice', 'Difficulty', ['Mercied', 'Grim', 'The Long Noon'], 1],
        ['toggle', 'Auto-Pause on Sighting', true],
        ['toggle', 'Show Hit Chances', true],
        ['toggle', 'Iron Vow — one save, no mercy', false],
        ['choice', 'Combat Speed', ['Deliberate', 'Brisk'], 0],
      ],
      ACCESSIBILITY: [
        ['choice', 'Text Size', ['Standard', 'Large', 'Larger Still'], 1],
        ['toggle', 'High-Contrast Ink', false],
        ['toggle', 'Reduce Motion', false],
        ['toggle', 'Extended Combat Timers', true],
      ],
    };
    const state = { cat: 'DISPLAY' };

    el.innerHTML = `
    <div class="screen-pad op-root">
      <header class="screen-head">
        <div>
          <div class="label faint">THE LONG NOON</div>
          <h2 class="screen-title screen-sub">Options</h2>
        </div>
        <div class="label faint">CHANGES TAKE EFFECT &middot; EVENTUALLY</div>
      </header>
      <div class="op-cols">
        <nav class="op-cats"></nav>
        <div class="op-body scroll"></div>
      </div>
      <footer class="op-foot">
        <button class="btn" data-go="title">&larr; Title</button>
        <div style="display:flex; gap:18px">
          <button class="btn framed op-defaults">Restore Defaults</button>
          <button class="btn primary" data-go="title">Keep These</button>
        </div>
      </footer>
    </div>
    <style>
      .op-root{ display:flex; flex-direction:column; }
      .op-cols{ flex:1; display:grid; grid-template-columns:280px 760px; gap:120px; margin-top:70px; min-height:0; }
      .op-cats{ display:flex; flex-direction:column; gap:4px; }
      .op-cat{ background:none; border:none; text-align:left; cursor:pointer; padding:13px 2px;
        font-family:var(--f-mono); font-size:13px; letter-spacing:.26em; color:var(--ink-faint);
        transition:color .15s; }
      .op-cat:hover{ color:var(--ink-dim); }
      .op-cat.sel{ color:var(--ink); }
      .op-cat.sel::after{ content:' ◆'; color:var(--accent-bright); font-size:9px; }
      .op-row{ display:grid; grid-template-columns:1fr 300px; align-items:center;
        padding:21px 2px; border-bottom:1px solid var(--line); }
      .op-row:first-child{ border-top:1px solid var(--line); }
      .op-name{ font-family:var(--f-prose); font-size:19px; color:var(--ink); }
      .op-ctl{ display:flex; justify-content:flex-end; align-items:center; gap:14px; }
      .op-choice{ display:flex; align-items:center; gap:14px; width:100%; justify-content:flex-end; }
      .op-choice button{ background:none; border:none; color:var(--ink-faint); cursor:pointer;
        font-family:var(--f-mono); font-size:14px; padding:2px 6px; }
      .op-choice button:hover{ color:var(--ink); }
      .op-choice .val{ font-family:var(--f-mono); font-size:12px; letter-spacing:.16em;
        text-transform:uppercase; color:var(--ink-dim); min-width:150px; text-align:center; }
      .op-slider{ display:flex; align-items:center; gap:16px; width:100%; }
      .op-slider .pc{ font-family:var(--f-mono); font-size:11px; color:var(--ink-faint); width:34px; text-align:right; }
      .op-foot{ display:flex; justify-content:space-between; margin-top:30px; }
    </style>`;

    const catBox = el.querySelector('.op-cats');
    const body = el.querySelector('.op-body');

    function renderCats() {
      catBox.innerHTML = Object.keys(CATS).map((c) =>
        `<button class="op-cat ${c === state.cat ? 'sel' : ''}" data-c="${c}">${c}</button>`).join('');
      catBox.querySelectorAll('.op-cat').forEach((b) =>
        b.addEventListener('click', () => { state.cat = b.dataset.c; renderCats(); renderBody(); }));
    }
    function renderBody() {
      body.innerHTML = CATS[state.cat].map((row, i) => {
        const [kind, name] = row;
        let ctl = '';
        if (kind === 'toggle') ctl = `<span class="toggle ${row[2] ? 'on' : ''}" data-i="${i}"><span class="tk"></span></span>`;
        if (kind === 'slider') ctl = `<span class="op-slider"><input class="rng" data-i="${i}" type="range" min="0" max="100" value="${row[2]}"><span class="pc">${row[2]}</span></span>`;
        if (kind === 'choice') ctl = `<span class="op-choice" data-i="${i}"><button data-d="-1">‹</button><span class="val">${row[2][row[3]]}</span><button data-d="1">›</button></span>`;
        return `<div class="op-row"><span class="op-name">${name}</span><span class="op-ctl">${ctl}</span></div>`;
      }).join('');
      body.querySelectorAll('.toggle').forEach((t) =>
        t.addEventListener('click', () => {
          const row = CATS[state.cat][+t.dataset.i];
          row[2] = !row[2]; t.classList.toggle('on', row[2]);
        }));
      body.querySelectorAll('.rng').forEach((r) =>
        r.addEventListener('input', () => {
          CATS[state.cat][+r.dataset.i][2] = +r.value;
          r.parentElement.querySelector('.pc').textContent = r.value;
        }));
      body.querySelectorAll('.op-choice button').forEach((b) =>
        b.addEventListener('click', () => {
          const wrap = b.closest('.op-choice');
          const row = CATS[state.cat][+wrap.dataset.i];
          row[3] = (row[3] + +b.dataset.d + row[2].length) % row[2].length;
          wrap.querySelector('.val').textContent = row[2][row[3]];
        }));
    }
    renderCats(); renderBody();
    el.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => go(b.getAttribute('data-go'))));
  },
});
