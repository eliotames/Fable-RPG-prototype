/* THE LONG NOON — dialogue & interactions */
registerScreen({
  id: 'dialogue', title: 'Dialogue',
  render(el) {
    const G = window.GAME;
    el.innerHTML = `
    <div class="dl-root">
      <svg class="dl-scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <rect width="1920" height="1080" fill="var(--bg-0)"></rect>
        <radialGradient id="dl-lamp" cx="0.32" cy="0.42" r="0.5">
          <stop offset="0" stop-color="#2b2317"></stop>
          <stop offset="1" stop-color="#14100c"></stop>
        </radialGradient>
        <rect width="1920" height="1080" fill="url(#dl-lamp)"></rect>
        <line x1="120" y1="0" x2="120" y2="1080" stroke="#1d1812" stroke-width="22"></line>
        <line x1="430" y1="0" x2="430" y2="1080" stroke="#1d1812" stroke-width="16"></line>
        <line x1="60" y1="330" x2="980" y2="330" stroke="#241d15" stroke-width="3"></line>
        <line x1="60" y1="334" x2="980" y2="334" stroke="#0f0c09" stroke-width="1"></line>
        <rect x="180" y="284" width="26" height="44" fill="#0f0c09"></rect>
        <rect x="236" y="296" width="18" height="32" fill="#0f0c09"></rect>
        <rect x="610" y="290" width="22" height="38" fill="#0f0c09"></rect>
        <circle cx="540" cy="180" r="34" fill="none" stroke="#2a2218" stroke-width="1.5"></circle>
        <line x1="540" y1="180" x2="540" y2="158" stroke="#2a2218" stroke-width="1.5"></line>
        <line x1="540" y1="180" x2="526" y2="166" stroke="var(--accent)" stroke-width="1" opacity="0.6"></line>
        <line x1="0" y1="760" x2="1100" y2="760" stroke="#0f0c09" stroke-width="120"></line>
        <line x1="0" y1="700" x2="1100" y2="700" stroke="#241d15" stroke-width="4"></line>
      </svg>
      <div class="dl-bars top"></div>
      <div class="dl-bars bottom"></div>
      <div class="dl-loc label small faint">THE SPENT HOUR &mdash; GALLOWS ROW &nbsp;&middot;&nbsp; 11:53, AS ALWAYS</div>
      <div class="dl-speaker">
        <div class="pframe tick-frame dl-pframe">${G.portrait('ulm')}</div>
        <div class="dl-sname display">Ulm Halversen</div>
        <div class="label small faint">KEEPER OF THE SPENT HOUR</div>
      </div>
      <div class="dl-col">
        <div class="dl-log scroll">
          <div class="dl-line">
            <span class="dl-who">ULM HALVERSEN</span>
            <p class="prose">&ldquo;You&rsquo;re asking about the bell. Everyone asks about the bell, eventually. Drink first &mdash; the bell doesn&rsquo;t care to be discussed dry.&rdquo;</p>
          </div>
          <div class="dl-line">
            <p class="prose dl-narr">He pours without being asked. The glass is clean. The habit is not.</p>
          </div>
          <div class="dl-line">
            <span class="dl-who voice">INTUITION &mdash; <span class="check-pass">MODERATE: SUCCESS</span></span>
            <p class="prose dl-voice">He poured a second glass for himself and his hand missed it by nothing at all. There&rsquo;s a name on that list he keeps behind the bar, and it&rsquo;s one he shaves around every morning. Bet on it.</p>
          </div>
          <div class="dl-line">
            <span class="dl-who">ULM HALVERSEN</span>
            <p class="prose">&ldquo;Three names left drinking, friend. I keep the list because somebody in this town ought to keep <i>something</i>. The Synod keeps secrets, the Court keeps debts. I keep the list.&rdquo;</p>
          </div>
        </div>
        <div class="dl-opts">
          <div class="dl-opt" data-n="1">
            <span class="dl-num">1.</span>
            <p class="prose">&ldquo;Whose names, Ulm? You can tell me or I can read the bell&rsquo;s mind.&rdquo;</p>
          </div>
          <div class="dl-opt" data-n="2">
            <span class="dl-num">2.</span>
            <p class="prose"><span class="dl-check check-hard">[SILVER TONGUE &mdash; FORMIDABLE 13]</span> &ldquo;Yours is on it. That&rsquo;s why the list stays close and the glass stays full.&rdquo;</p>
          </div>
          <div class="dl-opt" data-n="3">
            <span class="dl-num">3.</span>
            <p class="prose"><span class="dl-check check-pass">[LITURGY &mdash; TRIVIAL 6]</span> &ldquo;A bell that tolls for the future dead. There&rsquo;s an old rite for quieting those. It wants a name freely given.&rdquo;</p>
          </div>
          <div class="dl-opt" data-n="4" data-go="world">
            <span class="dl-num">4.</span>
            <p class="prose dl-narr">Just the drink. [Leave.]</p>
          </div>
        </div>
      </div>
    </div>
    <style>
      .dl-root{ position:absolute; inset:0; background:var(--bg-0); }
      .dl-scene{ position:absolute; inset:0; width:100%; height:100%; }
      .dl-bars{ position:absolute; left:0; right:0; height:74px; background:#0a0806; z-index:2; }
      .dl-bars.top{ top:0; border-bottom:1px solid #15110d; }
      .dl-bars.bottom{ bottom:0; border-top:1px solid #15110d; }
      .dl-loc{ position:absolute; top:30px; left:56px; z-index:3; }
      .dl-speaker{ position:absolute; left:130px; bottom:130px; z-index:3;
        display:flex; flex-direction:column; gap:10px; }
      .dl-pframe{ width:234px; height:280px; cursor:default; margin-bottom:8px; }
      .dl-sname{ font-size:33px; font-weight:500; letter-spacing:.06em; }
      .dl-col{ position:absolute; top:74px; bottom:74px; right:0; width:780px; z-index:3;
        background:linear-gradient(90deg, rgba(10,8,6,0) 0%, rgba(10,8,6,.88) 9%, rgba(10,8,6,.94) 100%);
        display:flex; flex-direction:column; padding:64px 96px 56px 110px; }
      .dl-log{ flex:1; display:flex; flex-direction:column; gap:34px; padding-right:18px; }
      .dl-who{ display:block; font-family:var(--f-mono); font-size:12px; letter-spacing:.24em;
        color:var(--ink-dim); margin-bottom:9px; }
      .dl-line .prose{ font-size:19px; }
      .dl-narr{ font-style:italic; color:var(--ink-faint); }
      .dl-voice{ color:var(--ink-dim); font-style:italic; }
      .dl-opts{ border-top:1px solid var(--line); padding-top:26px; margin-top:30px;
        display:flex; flex-direction:column; gap:4px; }
      .dl-opt{ display:flex; gap:16px; padding:9px 10px 9px 4px; cursor:pointer; align-items:baseline; }
      .dl-opt .prose{ font-size:18px; color:var(--ink-dim); transition:color .12s; }
      .dl-opt:hover .prose{ color:var(--ink); }
      .dl-num{ font-family:var(--f-mono); font-size:13px; color:var(--ink-faint); flex:none; }
      .dl-opt:hover .dl-num{ color:var(--accent-bright); }
      .dl-check{ font-family:var(--f-mono); font-size:12.5px; letter-spacing:.06em; }
    </style>`;
    el.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => go(b.getAttribute('data-go'))));
  },
});
