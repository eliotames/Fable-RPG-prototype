/* THE LONG NOON — title screen */
registerScreen({
  id: 'title', title: 'Title',
  render(el) {
    el.innerHTML = `
    <div class="title-root">
      <div class="title-horizon">
        <svg class="title-sun" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="15" fill="none" stroke="var(--ink-dim)" stroke-width="1"></circle>
          <line x1="32" y1="32" x2="21.3" y2="20.1" stroke="var(--accent-bright)" stroke-width="1.2"></line>
          <line x1="32" y1="32" x2="32" y2="23" stroke="var(--ink-dim)" stroke-width="1.6"></line>
          <circle cx="32" cy="32" r="1.4" fill="var(--ink-dim)"></circle>
          <line x1="32" y1="9" x2="32" y2="13" stroke="var(--ink-faint)" stroke-width="1"></line>
          <line x1="32" y1="51" x2="32" y2="55" stroke="var(--ink-faint)" stroke-width="1"></line>
          <line x1="9" y1="32" x2="13" y2="32" stroke="var(--ink-faint)" stroke-width="1"></line>
          <line x1="51" y1="32" x2="55" y2="32" stroke="var(--ink-faint)" stroke-width="1"></line>
        </svg>
      </div>
      <h1 class="title-name display">The Long Noon</h1>
      <p class="title-tag label faint">A CHRONICLE OF HALVER&rsquo;S CROSS &nbsp;&middot;&nbsp; SEVEN MINUTES WAS THE PRICE</p>
      <nav class="title-menu">
        <button class="tm-item" data-go="world">
          <span>Continue</span>
          <span class="tm-sub label small faint">NOON +2,191 &mdash; GALLOWS ROW</span>
        </button>
        <button class="tm-item" data-go="create"><span>New Game</span></button>
        <button class="tm-item" data-go="journal"><span>Chronicle</span></button>
        <button class="tm-item" data-go="options"><span>Options</span></button>
        <button class="tm-item dim"><span>Quit to Dust</span></button>
      </nav>
      <footer class="title-foot">
        <span class="label small faint">v0.9.3 &mdash; &ldquo;GREENWICH&rdquo; BUILD</span>
        <span class="label small faint">HALVER&rsquo;S CROSS WORKSHOP &middot; MMXXVI</span>
      </footer>
    </div>
    <style>
      .title-root{ position:absolute; inset:0; background:var(--bg-0);
        display:flex; flex-direction:column; align-items:center; }
      .title-horizon{ position:absolute; top:0; left:0; right:0; height:308px;
        display:flex; align-items:flex-end; justify-content:center; }
      .title-horizon::before,.title-horizon::after{ content:''; position:absolute; bottom:31px;
        height:1px; background:var(--line); width:calc(50% - 120px); }
      .title-horizon::before{ left:0; }
      .title-horizon::after{ right:0; }
      .title-sun{ width:64px; height:64px; margin-bottom:14px; }
      .title-name{ margin-top:354px; font-size:128px; font-weight:500; letter-spacing:.24em;
        padding-left:.24em; text-transform:uppercase; color:var(--ink); line-height:1; }
      .title-tag{ margin-top:34px; letter-spacing:.34em; padding-left:.34em; white-space:nowrap; }
      .title-menu{ margin-top:96px; display:flex; flex-direction:column; align-items:center; gap:6px; }
      .tm-item{ display:flex; flex-direction:column; align-items:center; gap:5px;
        background:none; border:none; cursor:pointer; padding:10px 40px; position:relative; }
      .tm-item > span:first-child{ font-family:var(--f-display); font-size:25px; font-weight:500;
        letter-spacing:.3em; padding-left:.3em; text-transform:uppercase; color:var(--ink-dim);
        transition:color .15s; white-space:nowrap; }
      .tm-item:hover > span:first-child{ color:var(--ink); }
      .tm-item::before{ content:'◆'; position:absolute; left:8px; top:16px; font-size:9px;
        color:var(--accent-bright); opacity:0; transition:opacity .15s; }
      .tm-item:hover::before{ opacity:1; }
      .tm-item.dim > span:first-child{ color:var(--ink-faint); }
      .tm-sub{ letter-spacing:.26em; white-space:nowrap; }
      .title-foot{ position:absolute; left:56px; right:56px; bottom:40px;
        display:flex; justify-content:space-between; }
      .title-foot span{ white-space:nowrap; }
    </style>`;
    el.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => go(b.getAttribute('data-go'))));
  },
});
