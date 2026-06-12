/* THE LONG NOON — world exploration (top-down oblique) */
registerScreen({
  id: 'world', title: 'World',
  render(el) {
    const G = window.GAME;
    const W = '#13100b', SH = '#0d0a07';

    function bld(x, y, w, h, wall, sh, tone, ridge) {
      return `
      <polygon points="${x + w},${y + 10} ${x + w + sh},${y + 10 + sh * 0.3} ${x + w + sh},${y + h + wall + sh * 0.3} ${x + w},${y + h + wall}" fill="${SH}" opacity="0.55"></polygon>
      <rect x="${x}" y="${y + h}" width="${w}" height="${wall}" fill="${W}"></rect>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${tone}"></rect>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#wd-hatch)" opacity="0.35"></rect>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#3c3227" stroke-width="1"></rect>
      ${ridge ? `<line x1="${x + 14}" y1="${y + h / 2}" x2="${x + w - 14}" y2="${y + h / 2}" stroke="#3c3227" stroke-width="1"></line>` : ''}`;
    }

    let ties = '';
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, x = t * 1920, y = 822 - t * 58;
      ties += `<line x1="${x}" y1="${y - 9}" x2="${x + 1.4}" y2="${y + 23}" stroke="#241d15" stroke-width="5"></line>`;
    }

    el.innerHTML = `
    <div class="wd-root">
      <svg class="wd-scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="wd-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke="#0f0c09" stroke-width="1.6"></line>
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="#191510"></rect>
        <ellipse cx="500" cy="900" rx="420" ry="190" fill="#17120d" opacity="0.8"></ellipse>
        <ellipse cx="1500" cy="300" rx="380" ry="220" fill="#17120d" opacity="0.6"></ellipse>
        <ellipse cx="980" cy="560" rx="320" ry="180" fill="#1d1711" opacity="0.7"></ellipse>
        <polygon points="640,0 900,0 850,1080 550,1080" fill="#1f1913"></polygon>
        <line x1="640" y1="0" x2="550" y2="1080" stroke="#272015" stroke-width="1" opacity="0.7"></line>
        <line x1="900" y1="0" x2="850" y2="1080" stroke="#272015" stroke-width="1" opacity="0.7"></line>
        <polygon points="0,440 640,452 636,560 0,548" fill="#1e1812"></polygon>
        ${ties}
        <line x1="0" y1="826" x2="1920" y2="768" stroke="#3a3024" stroke-width="1.6"></line>
        <line x1="0" y1="840" x2="1920" y2="782" stroke="#3a3024" stroke-width="1.6"></line>
        ${bld(110, 90, 390, 250, 26, 90, '#2a2219', true)}
        ${bld(150, 620, 290, 150, 22, 70, '#272016', true)}
        ${bld(1010, 60, 230, 130, 18, 60, '#272016', false)}
        ${bld(1330, 110, 310, 220, 26, 100, '#2a2219', true)}
        <circle cx="1485" cy="160" r="24" fill="#1b1610" stroke="#322a20" stroke-width="1"></circle>
        <circle cx="1485" cy="160" r="7" fill="none" stroke="var(--brass)" stroke-width="1" opacity="0.7"></circle>
        ${bld(1400, 560, 300, 190, 24, 80, '#292118', true)}
        <rect x="1012" y="470" width="96" height="74" fill="#211a13" stroke="#322a20" stroke-width="1"></rect>
        <line x1="1030" y1="470" x2="1030" y2="430" stroke="#0f0c09" stroke-width="4"></line>
        <line x1="1090" y1="470" x2="1090" y2="430" stroke="#0f0c09" stroke-width="4"></line>
        <line x1="1022" y1="430" x2="1098" y2="430" stroke="#0f0c09" stroke-width="4"></line>
        <circle cx="1060" cy="444" r="9" fill="none" stroke="var(--brass)" stroke-width="1.2" opacity="0.8"></circle>
        <line x1="1060" y1="453" x2="1060" y2="458" stroke="var(--brass)" stroke-width="1" opacity="0.8"></line>
        <line x1="1108" y1="436" x2="1240" y2="468" stroke="${SH}" stroke-width="6" opacity="0.5"></line>
        <circle cx="760" cy="500" r="20" fill="#16110c" stroke="#322a20" stroke-width="1"></circle>
        <circle cx="760" cy="500" r="11" fill="#0d0a07"></circle>
        <rect x="1356" y="640" width="22" height="22" fill="#1d1711" stroke="#322a20" stroke-width="1" transform="rotate(8 1367 651)"></rect>
        <rect x="1352" y="668" width="18" height="18" fill="#1d1711" stroke="#322a20" stroke-width="1"></rect>
        <g stroke="#322a20" stroke-width="1.4">
          <line x1="1130" y1="852" x2="1188" y2="852"></line>
          <line x1="1136" y1="864" x2="1182" y2="864"></line>
          <line x1="1142" y1="876" x2="1176" y2="876"></line>
          <line x1="1148" y1="888" x2="1170" y2="888"></line>
        </g>
        <line x1="430" y1="240" x2="498" y2="240" stroke="#progress" opacity="0"></line>
      </svg>
      <div class="wd-hud-loc">
        <div class="label">HALVER&rsquo;S CROSS &mdash; GALLOWS ROW</div>
        <div class="label small faint" style="margin-top:7px">11:53. AS ALWAYS.</div>
      </div>
      <div class="wd-exit n label small faint">&uarr;&nbsp; TO SYNOD SQUARE</div>
      <div class="wd-exit s label small faint">&darr;&nbsp; TO THE DRY MARCHES</div>
      <div class="wd-party"></div>
      <div class="wd-hud-actions">
        <button class="wd-act" data-go="party">PARTY</button>
        <button class="wd-act" data-go="inventory">PACK</button>
        <button class="wd-act" data-go="journal">JOURNAL</button>
        <button class="wd-act" data-go="skills">ARTS</button>
        <button class="wd-act dim">REST</button>
      </div>
      <div class="wd-hot" style="left:1322px; top:648px" data-go="dialogue">
        <span class="g">◆</span><span class="t">THE SPENT HOUR</span>
      </div>
      <div class="wd-hot" style="left:1042px; top:386px" data-go="journal">
        <span class="g">◆</span><span class="t">THE HANGING BELL</span>
      </div>
      <div class="wd-hot" style="left:1130px; top:910px" data-go="combat">
        <span class="g">◆</span><span class="t">UNDERCROFT STAIR</span>
      </div>
      <div class="wd-tokens">
        <div class="wd-tok lead" style="left:772px; top:606px"><i></i><span>ODILE</span></div>
        <div class="wd-tok" style="left:716px; top:668px"><i></i><span>CASIMIR</span></div>
        <div class="wd-tok" style="left:812px; top:672px"><i></i><span>WREN</span></div>
        <div class="wd-tok" style="left:766px; top:722px"><i></i><span>GREAVES</span></div>
      </div>
    </div>
    <style>
      .wd-root{ position:absolute; inset:0; background:#191510; }
      .wd-scene{ position:absolute; inset:0; width:100%; height:100%; }
      .wd-hud-loc{ position:absolute; top:46px; left:56px; z-index:3; }
      .wd-hud-loc .label{ white-space:nowrap; }
      .wd-exit{ position:absolute; z-index:3; letter-spacing:.3em; white-space:nowrap; }
      .wd-exit.n{ top:46px; left:50%; transform:translateX(-50%); }
      .wd-exit.s{ bottom:46px; left:600px; }
      .wd-hud-actions{ position:absolute; right:56px; bottom:40px; z-index:3; display:flex; gap:8px; }
      .wd-act{ font-family:var(--f-mono); font-size:11px; letter-spacing:.22em; color:var(--ink-dim);
        background:rgba(10,8,6,.55); border:1px solid var(--line); padding:11px 20px; cursor:pointer;
        transition:color .12s,border-color .12s; }
      .wd-act:hover{ color:var(--ink); border-color:var(--line-strong); }
      .wd-act.dim{ color:var(--ink-faint); }
      .wd-hot{ position:absolute; z-index:3; display:flex; align-items:center; gap:10px; cursor:pointer; }
      .wd-hot .g{ font-size:9px; color:var(--ink-dim); transition:color .12s; }
      .wd-hot .t{ font-family:var(--f-mono); font-size:11px; letter-spacing:.24em; color:var(--ink-dim);
        border-bottom:1px solid transparent; padding-bottom:3px; transition:color .12s,border-color .12s; white-space:nowrap; }
      .wd-hot:hover .g{ color:var(--accent-bright); }
      .wd-hot:hover .t{ color:var(--ink); border-bottom-color:var(--line-strong); }
      .wd-tok{ position:absolute; z-index:2; display:flex; flex-direction:column; align-items:center; gap:7px; }
      .wd-tok i{ width:15px; height:15px; background:#0f0c09; border:1.5px solid var(--ink-dim);
        transform:rotate(45deg); display:block; }
      .wd-tok span{ font-family:var(--f-mono); font-size:9px; letter-spacing:.2em; color:var(--ink-faint); }
      .wd-tok.lead i{ border-color:var(--accent-bright); outline:1px solid rgba(194,86,61,.25); outline-offset:4px; }
      .wd-tok.lead span{ color:var(--ink-dim); }
      .wd-pstrip{ position:absolute; left:56px; bottom:40px; z-index:3; display:flex; gap:10px; }
      .wd-pstrip .pp{ width:64px; cursor:pointer; }
      .wd-pstrip .pframe{ width:64px; height:76px; }
      .wd-pstrip .bar{ margin-top:5px; }
    </style>`;

    const strip = document.createElement('div');
    strip.className = 'wd-pstrip';
    strip.innerHTML = G.PARTY.map((p) => `
      <div class="pp" title="${p.name}">
        <div class="pframe">${G.portrait(p.id)}</div>
        ${G.bar(p.hp[0], p.hp[1], 'hp')}
      </div>`).join('');
    el.querySelector('.wd-root').appendChild(strip);
    strip.addEventListener('click', () => go('party'));

    el.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => go(b.getAttribute('data-go'))));
  },
});
