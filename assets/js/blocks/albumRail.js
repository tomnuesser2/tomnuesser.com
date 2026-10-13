import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { SOURCE, ITEMS, FORMAT, BG, HEIGHT, getItems, mediaNode, playVideosWhenVisible, goto, bgClass, ticker, watchSize, dragHandler, aspectOf, heightOf, clamp, num } from '../core/reelKit.js';

// Album-Rail: Fächer aus Covern mit Schallplatte, Lineal mit Play-Knopf unten.
export default {
  type: 'albumRail', label: 'Album-Rail (Cover-Fächer mit Schallplatte)',
  fields: [
    SOURCE, ITEMS, FORMAT('1:1'), ...HEIGHT(620, 640), BG,
    { name: 'size', label: 'Größe des mittleren Covers (0.3–0.9)', type: 'number', default: .62 },
    { name: 'spread', label: 'Abstand zu den Nachbarn (0.3–1)', type: 'number', default: .58 },
    { name: 'fan', label: 'Fächer-Neigung in Grad', type: 'number', default: 6 },
    { name: 'stack', label: 'Dichte der weiter entfernten Cover (0 = gleichmäßig, 1 = eng gestapelt)', type: 'number', default: .5 },
    { name: 'turn', label: 'Wegdrehen der Nachbarn in Grad', type: 'number', default: 22 },
    { name: 'depth', label: 'Tiefe: Nachbarn werden kleiner (0–1)', type: 'number', default: .5 },
    { name: 'visible', label: 'Sichtbare Cover pro Seite (1–5)', type: 'number', default: 3 },
    { name: 'radius', label: 'Rundung in px', type: 'number', default: 14 },
    { name: 'dim', label: 'Abdunklung der Nachbarn (0–1)', type: 'number', default: .45 },
    { name: 'vinyl', label: 'Schallplatte hinter jedem Cover', type: 'checkbox', default: true },
    { name: 'vinylColor', label: 'Farbe der Platte (Hex)', type: 'text', default: '#131116' },
    { name: 'accent', label: 'Farbe des Play-Knopfs (Hex)', type: 'text', default: '#ff6a4d' },
    { name: 'rpm', label: 'Drehzahl der Platte', type: 'number', default: 33 },
    { name: 'autoplay', label: 'Automatisch weiterblättern', type: 'checkbox', default: true },
    { name: 'interval', label: 'Sekunden zwischen den Covern', type: 'number', default: 4 },
    { name: 'loop', label: 'Endlos (wieder von vorn)', type: 'checkbox', default: true },
    { name: 'wheel', label: 'Mausrad blättert (sonst scrollt die Seite normal)', type: 'checkbox', default: false },
    { name: 'captions', label: 'Titel und Untertitel anzeigen', type: 'checkbox', default: true },
    { name: 'controls', label: 'Lineal mit Play-Knopf anzeigen', type: 'checkbox', default: true },
  ],
  render(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const items = getItems(p, ctx);
    const el = h('div', { class: `ar${bgClass(p.bg)}`, style: { '--accent': p.accent || '#ff6a4d', '--vinyl': p.vinylColor || '#131116', '--rad': num(p.radius, 14) + 'px' } });
    if (items.length < 2) { el.style.height = '200px'; el.append(h('p', { class: 'reel-empty' }, 'Mindestens 2 Bilder hinzufügen.')); return el; }
    const n = items.length, asp = aspectOf(p.format, 1, 1);
    const stage = h('div', { class: 'ar__stage', tabindex: '0', role: 'group', 'aria-label': 'Album-Rail' });
    const its = items.map((it, i) => {
      const art = mediaNode(it.src, 'ar__img', it.title);
      const rec = p.vinyl !== false ? h('div', { class: 'ar__rec', 'aria-hidden': 'true' }, h('i', { style: { backgroundImage: it.src && !/\.(mp4|webm)/i.test(it.src) ? `url("${it.src}")` : 'none' } })) : null;
      const cov = h('div', { class: 'ar__cov' }, art, h('b', { class: 'ar__dim' }));
      const node = h('div', { class: 'ar__it', 'data-i': i }, rec, cov); stage.append(node);
      return { node, cov, rec };
    });
    const capT = h('b', {}), capS = h('span', {}), cap = p.captions !== false ? h('div', { class: 'ar__cap' }, capT, capS) : null;
    const tickEls = items.map(() => h('i'));
    const ticks = h('div', { class: 'ar__ticks' }, tickEls);
    const play = h('button', { class: 'ar__play', type: 'button', 'aria-label': 'Platte abspielen' }, h('svg', { viewBox: '0 0 24 24', width: 18, height: 18 }, h('path', { d: 'M8 5v14l11-7z', fill: 'currentColor' })));
    const prev = h('button', { class: 'ar__arr', type: 'button', 'aria-label': 'Zurück' }, '‹'), next = h('button', { class: 'ar__arr', type: 'button', 'aria-label': 'Weiter' }, '›');
    const rule = h('div', { class: 'ar__rule' }, prev, h('div', { class: 'ar__ruler' }, ticks, play), next);
    el.append(stage); if (cap) el.append(cap); if (p.controls !== false) el.append(rule);
    playVideosWhenVisible(el);

    let W = 0, H = 0, SH = 0, cw = 0, ch = 0, pos = 0, target = 0, playing = -1, hover = false, held = false, acc = 0, vinylOut = 0, spin = 0, shown = -1;
    const loop = p.loop !== false, vis = Math.max(1, Math.min(5, Math.round(num(p.visible, 3))));
    const spread = num(p.spread, .58), fan = num(p.fan, 6), turn = num(p.turn, 22), depth = num(p.depth, .5), dim = num(p.dim, .45);
    const wrap = (d) => (loop ? ((d % n) + n + n / 2) % n - n / 2 : d);
    const idx = () => ((Math.round(pos) % n) + n) % n;
    const goTo = (t) => { target = loop ? t : clamp(t, 0, n - 1); };
    const step = (d) => { playing = -1; goTo(Math.round(target) + d); };
    watchSize(el, (w, hh) => {
      W = w; H = hh; const capH = (p.captions !== false ? 64 : 10) + (p.controls !== false ? 74 : 10);
      SH = Math.max(120, H - capH); ch = Math.min(SH * num(p.size, .62), SH * .92); cw = ch * asp;
      if (cw > W * .78) { cw = W * .78; ch = cw / asp; }
      stage.style.height = SH + 'px';
      its.forEach(({ cov, rec }) => { cov.style.width = cw + 'px'; cov.style.height = ch + 'px'; if (rec) { rec.style.width = rec.style.height = ch * .96 + 'px'; rec.style.top = `calc(50% - ${ch * .48}px)`; rec.style.left = -(ch * .96) / 2 + 'px'; } });
    });
    const paint = (dt) => {
      if (!cw) return;
      pos += (target - pos) * (1 - Math.pow(.0009, dt)); if (Math.abs(target - pos) < .0005) pos = target;
      const fi = idx(), isP = playing === fi && p.vinyl !== false;
      vinylOut += ((isP ? 1 : hover && !held ? .22 : 0) - vinylOut) * Math.min(1, dt * 7); spin += isP ? dt * num(p.rpm, 33) * 6 : 0;
      its.forEach(({ node, rec }, i) => {
        const d = wrap(i - pos), a = Math.abs(d), s = Math.sign(d), m = Math.min(a, 1);
        if (a > vis + .6) { node.style.visibility = 'hidden'; return; }
        node.style.visibility = 'visible';
        const ex = a <= 1 ? a : 1 + (a - 1) * (1 - .55 * clamp(num(p.stack, .5)));
        const x = s * cw * spread * ex, sc = 1 - depth * .26 * Math.min(a, 1.7), fade = clamp((vis + .6 - a) / 1.2);
        node.style.transform = `translate3d(${x.toFixed(1)}px,0,${(-Math.min(a, 2) * 80).toFixed(0)}px) rotateY(${(-s * turn * m).toFixed(1)}deg) rotateZ(${(s * fan * m).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        node.style.zIndex = String(100 - Math.round(a * 10));
        node.style.opacity = fade.toFixed(3);
        node.querySelector('.ar__dim').style.opacity = (dim * Math.min(a, 1.15)).toFixed(3);
        if (rec) {
          const o = i === fi ? vinylOut : 0; rec.style.transform = `translateX(${(o * ch * .62).toFixed(1)}px) rotate(${i === fi ? spin : 0}deg)`; rec.style.opacity = i === fi ? '1' : '0';
        }
      });
      if (cap && shown !== fi) { shown = fi; capT.textContent = items[fi].title || ''; capS.textContent = items[fi].subtitle || ''; cap.classList.remove('is-in'); void cap.offsetWidth; cap.classList.add('is-in'); }
      // Lineal: Strich unter dem Knopf = aktuelles Cover
      const gap = 26;
      tickEls.forEach((t, i) => { const dd = wrap(i - pos), d = Math.abs(dd); t.style.transform = `translate(${(dd * gap).toFixed(1)}px,-50%)`; t.style.opacity = String(clamp(1 - d / 7) * (d < .45 ? 0 : .8)); t.style.height = (10 + clamp(1 - d / 3) * 8) + 'px'; });
    };
    ticker(el, (dt) => {
      if (p.autoplay !== false && !still() && !hover && !held && playing < 0) { acc += dt; if (acc >= Math.max(1, num(p.interval, 4))) { acc = 0; if (loop || Math.round(target) < n - 1) goTo(Math.round(target) + 1); else goTo(0); } } else acc = 0;
      paint(dt);
    });
    // Eingaben
    const perCard = () => cw * spread * 1.0;
    dragHandler(stage, { start: () => { held = true; }, move: (dx) => { pos -= dx / perCard(); target = pos; playing = -1; }, end: (was, v) => { held = false; if (was) goTo(Math.round(pos - v * 14 / (perCard() / 16))); else goTo(Math.round(target)); } });
    stage.addEventListener('click', (e) => {
      const it = e.target.closest('.ar__it'); if (!it) return; const i = Number(it.dataset.i), d = wrap(i - pos);
      if (Math.abs(d) > .5) { playing = -1; goTo(Math.round(target + d)); return; }
      if (p.vinyl !== false) playing = playing === i ? -1 : i; else if (items[i].href) goto(items[i].href);
    });
    stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Enter') { const i = idx(); if (p.vinyl !== false) playing = playing === i ? -1 : i; else goto(items[i].href); } });
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && p.pauseOnHover !== false) hover = true; }); el.addEventListener('pointerleave', () => { hover = false; });
    if (p.wheel) stage.addEventListener('wheel', (e) => { e.preventDefault(); step(Math.sign(e.deltaY || e.deltaX)); }, { passive: false });
    prev.addEventListener('click', () => step(-1)); next.addEventListener('click', () => step(1));
    play.addEventListener('click', () => { const i = idx(); playing = playing === i ? -1 : i; });
    // Lineal ziehen / antippen
    dragHandler(rule.querySelector('.ar__ruler'), { start: () => { held = true; }, move: (dx) => { pos -= dx / 26; target = pos; playing = -1; }, end: () => { held = false; goTo(Math.round(pos)); } });
    return el;
  },
};
