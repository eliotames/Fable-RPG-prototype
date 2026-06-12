/* THE LONG NOON — shell: routing, scaling, nav */
(function () {
  const screens = window.__screens;
  const container = document.getElementById('screens');
  const nav = document.getElementById('screen-nav');
  const stage = document.getElementById('stage');
  const byId = {};

  screens.forEach((s) => {
    const sec = document.createElement('section');
    sec.className = 'scrn';
    sec.id = 'scrn-' + s.id;
    sec.setAttribute('data-screen-label', s.title);
    container.appendChild(sec);
    byId[s.id] = { def: s, el: sec, rendered: false };

    const b = document.createElement('button');
    b.className = 'nav-btn';
    b.textContent = s.title;
    b.setAttribute('data-target', s.id);
    b.addEventListener('click', () => go(s.id));
    nav.appendChild(b);
  });

  let current = null;
  function activate(id) {
    if (!byId[id]) id = screens[0].id;
    if (current === id) return;
    current = id;
    Object.keys(byId).forEach((k) => {
      const rec = byId[k];
      const on = k === id;
      if (on && !rec.rendered) { rec.def.render(rec.el); rec.rendered = true; }
      rec.el.classList.toggle('active', on);
    });
    nav.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('current', b.getAttribute('data-target') === id);
    });
  }

  window.go = function (id) {
    if (!byId[id]) id = screens[0].id;
    if (('#' + id) !== location.hash) location.hash = id;
    activate(id);
  };

  window.addEventListener('hashchange', () => activate(location.hash.slice(1)));
  window.__activate = activate;

  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight - 44;
    const s = Math.min(vw / 1920, vh / 1080);
    const tx = (vw - 1920 * s) / 2, ty = (vh - 1080 * s) / 2;
    stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  const initial = location.hash.slice(1);
  activate(byId[initial] ? initial : screens[0].id);
})();
