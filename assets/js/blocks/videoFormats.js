import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { createPhone } from '../core/phoneGL.js';
import { ticker } from '../core/reelKit.js';
import { parseVimeo, vimeoThumb, vimeoInfo, vimeoIsPortrait, isEmbedUrl } from '../core/media.js';
// Videoformate in EINEM Gerät: Ein echtes 3D-Handy zeigt die Videos nacheinander. Mit den Pfeilen wechselt man durch.
// Kommt ein Querformat-Video (16:9), dreht sich das Handy um 90° ins Querformat – wie wenn man es in der Hand kippt.
// Das Video steckt dabei "im" Handy: Es dreht sich mit und steht am Ende aufrecht. Rechts daneben stehen Titel und Text.

const isVideo = (s) => /\.(mp4|webm|mov)(\?|$)/i.test(s || '');
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const ITEM = [
  { name: 'vimeo', label: 'Vimeo-Link (z. B. https://vimeo.com/123456789) – läuft automatisch und stumm', type: 'text' },
  { name: 'src', label: 'oder Datei: Video (.mp4/.webm) oder Bild', type: 'image' },
  { name: 'ratio', label: 'Format', type: 'select', options: ['automatisch', '9:16 hoch', '16:9 quer'], default: 'automatisch' },
  { name: 'fit', label: 'Darstellung im Handy', type: 'select', options: ['schwarze Balken', 'Vollbild (randlos, wird beschnitten)'], default: 'schwarze Balken' },
  { name: 'title', label: 'Titel (kurz)', type: 'text' },
  { name: 'text', label: 'Kurztext (ein bis zwei Zeilen)', type: 'textarea' },
  { name: 'duration', label: 'Dauer in Sekunden (nur bei Bildern)', type: 'number', default: 5 },
];

export default {
  type: 'videoFormats', label: 'Videoformate – ein Handy, dreht sich bei 16:9',
  fields: [
    { name: 'kicker', label: 'Kleine Zeile', type: 'text', default: 'formats', de: 'Formate' },
    { name: 'title', label: 'Überschrift', type: 'text', default: 'One shoot, every format.', de: 'Ein Dreh, jedes Format.' },
    { name: 'text', label: 'Text darunter', type: 'textarea', default: 'Vertical for the feed, wide for the screen – same story, right shape.', de: 'Hochkant für den Feed, quer für den großen Schirm – gleiche Geschichte, passende Form.' },
    { name: 'items', label: 'Videos (werden automatisch abwechselnd sortiert: 16:9, 9:16, 16:9, 9:16 …)', type: 'list', itemFields: ITEM },
    { name: 'pickVimeo', label: 'Videos aus anderen Seiten/Projekten übernehmen (nur Vimeo)', type: 'vimeoPick', lists: { phone: 'items', laptop: 'items' }, ratioField: 'ratio', ratios: { phone: '9:16 hoch', laptop: '16:9 quer' } },
    { name: 'side', label: 'Handy steht …', type: 'select', options: ['links', 'rechts'], default: 'links' },
    { name: 'auto', label: 'Automatisch weiterschalten', type: 'checkbox', default: true },
    { name: 'clipSecs', label: 'Sekunden pro Video, bevor es weiterwechselt (3–10)', type: 'range', min: 3, max: 10, step: .5, default: 6 },
    { name: 'ctaText', label: 'Button unten: Text (leer = kein Button)', type: 'text', default: '' },
    { name: 'ctaLink', label: 'Button unten: Ziel (Seite, z. B. projects)', type: 'text', default: 'projects' },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const norm = (i) => (isEmbedUrl(i.src) && !i.vimeo ? { ...i, vimeo: i.src, src: '' } : i);
    const items = (p.items || []).map(norm).filter(i => i.src || parseVimeo(i.vimeo));
    if (!items.length) return null;
    // 16:9 (quer) → Handy dreht sich. Alles andere bleibt hochkant. "automatisch" fragt Vimeo nach den Maßen.
    const fixed = (i) => (/16\s*:\s*9|quer/i.test(String(i.ratio || '')) ? true : /9\s*:\s*16|hoch/i.test(String(i.ratio || '')) ? false : null);
    const land = items.map(i => fixed(i) ?? false);           // "automatisch": erst hochkant, Vimeo meldet gleich das echte Format
    const cover = (i) => /voll/i.test(String(i.fit || ''));
    let cur = 0, timer = 0, raf = 0, vmH = null, visible = false, curMs = 0, started = false;

    const scr = h('div', { class: 'vf__scr' });
    const shots = items.map((it, n) => {
      const vm = parseVimeo(it.vimeo), v = !vm && isVideo(it.src);
      const node = vm ? h('div', { class: 'vf__vm' })
        : v ? h('video', { src: it.src, muted: '', playsinline: '', preload: 'metadata', 'aria-hidden': 'true' })
          : h('img', { src: it.src, alt: '', decoding: 'async', loading: 'lazy' });
      if (v) { node.muted = true; node.defaultMuted = true; node.loop = items.length === 1; }
      if (vm) vimeoThumb(vm).then(t => { if (t) node.style.background = `#000 url("${t}") center / ${cover(it) ? 'cover' : 'contain'} no-repeat`; }).catch(() => {});
      // Jedes Video sitzt in einem eigenen Rahmen. Querformat liegt im Handy quer (gedreht) – zusammen mit der Handy-Drehung steht es am Ende aufrecht.
      const rot = h('div', { class: 'vf__rot' }, node);
      const s = h('div', { class: 'vf__shot' + (land[n] ? ' is-land' : '') + (cover(it) ? ' is-cover' : '') }, rot);
      scr.append(s); return s;
    });

    const cv = h('canvas', { class: 'vf__cv', 'aria-hidden': 'true' });
    const ov = h('div', { class: 'vf__ov' }, scr);
    const shadow = h('i', { class: 'vf__fs', 'aria-hidden': 'true' });
    const dev = h('div', { class: 'vf__dev' }, shadow, cv, ov);

    const ar = (dir, label) => h('button', {
      type: 'button', class: `vf__ar vf__ar--${dir > 0 ? 'n' : 'p'}`, 'aria-label': label,
    }, h('span', { 'aria-hidden': 'true' }));
    const prev = ar(-1, 'Vorheriges Video'), next = ar(1, 'Nächstes Video');
    const dots = h('div', { class: 'vf__dots' }, items.map((_, n) => h('i', { 'data-n': String(n) })));
    const bar = h('b', { class: 'vf__pp' }), line = h('div', { class: 'vf__pl' }, bar);
    const nav = h('div', { class: 'vf__nav' }, prev, dots, next);

    const itemEl = items.map(it => h('div', { class: 'vf__item' },
      h('h3', { class: 'vf__it' }, it.title || ''), h('p', { class: 'vf__ix' }, it.text || '')));
    // Reihenfolge immer abwechselnd: 16:9, 9:16, 16:9, 9:16 … (was übrig bleibt, kommt hinten dran)
    const resort = () => {
      const keep = items[cur], idx = items.map((_, n) => n), L = idx.filter(n => land[n]), P = idx.filter(n => !land[n]), perm = [];
      while (L.length || P.length) { if (L.length) perm.push(L.shift()); if (P.length) perm.push(P.shift()); }
      for (const a of [items, land, shots, itemEl]) { const c = perm.map(n => a[n]); a.splice(0, a.length, ...c); }
      shots.forEach((s, n) => s.classList.toggle('is-land', land[n]));
      cur = started ? Math.max(0, items.indexOf(keep)) : 0;
    };
    resort();
    // Vollbild bei Vimeo: Der Player wird so groß gezogen, dass er die Glasfläche ganz füllt (Ränder werden abgeschnitten).
    // Schwarze Balken (Standard): Der Player sitzt genau auf der Glasfläche, Vimeo setzt die Balken selbst.
    const fitFrames = () => {
      const W0 = ov.clientWidth, H0 = ov.clientHeight; if (W0 < 4 || H0 < 4) return;
      shots.forEach((s, n) => {
        const f = s.querySelector('.vf__vf'); if (!f) return;
        if (!s.classList.contains('is-cover')) { f.style.width = ''; f.style.height = ''; return; }
        const inf = items[n]._info, va = inf && inf.width && inf.height ? inf.width / inf.height : (land[n] ? 16 / 9 : 9 / 16);
        const bw = land[n] ? H0 : W0, bh = land[n] ? W0 : H0, ba = bw / bh;
        const w = va > ba ? bh * va : bw, hh = va > ba ? bh : bw / va;
        f.style.width = Math.ceil(w) + 'px'; f.style.height = Math.ceil(hh) + 'px';
      });
    };
    // Vimeo nach Maßen fragen: "automatisch" bekommt so sein echtes Format, Vollbild das richtige Seitenverhältnis
    Promise.all(items.map((it) => { const vm = parseVimeo(it.vimeo); return vm ? vimeoInfo(vm).then(i => { it._info = i; }).catch(() => {}) : null; })).then(() => {
      let changed = false;
      items.forEach((it, n) => { if (fixed(it) === null && it._info && (it._info.width || it._info.height)) { const l = !vimeoIsPortrait(it._info); if (l !== land[n]) { land[n] = l; changed = true; } } });
      if (changed) { resort(); show(cur, false); if (visible) run(); }
      fitFrames();
    });
    const badge = h('span', { class: 'vf__badge' }, '9:16');
    const cta = p.ctaText ? h('a', { class: 'cta vf__cta', href: p.ctaLink || 'projects', 'data-link': '', 'data-magnetic': '1' }, h('span', {}, p.ctaText), h('i', { 'aria-hidden': 'true' }, '→')) : null;
    const copy = h('div', { class: 'vf__copy' },
      // Nur Überschrift, Untertitel und die Pfeile – kein Videotitel/-text und kein Format-Schild (die kamen z. B. aus Vimeo und störten)
      p.kicker ? h('p', { class: 'vf__k' }, p.kicker) : null,
      p.title ? h('h2', { class: 'vf__h' }, p.title) : null,
      p.text ? h('p', { class: 'vf__p' }, p.text) : null,
      nav, line, cta);

    const el = h('section', { class: `vf vf--${p.side === 'rechts' ? 'r' : 'l'}`, id: p.id },
      h('div', { class: 'vf__sticky' }, h('div', { class: 'vf__stage' }, dev, copy)));

    // ---------- Anzeige des aktuellen Eintrags ----------
    const clearT = () => { clearTimeout(timer); cancelAnimationFrame(raf); raf = 0; if (vmH) { removeEventListener('message', vmH); vmH = null; } };
    const fill = (f) => { bar.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`; };
    let swapHook = null;                                   // setzt der 3D-Teil: kleiner Schwung beim Wechsel
    const show = (i, play = true) => {
      const to = (i + items.length) % items.length;
      if (swapHook && to !== cur) swapHook();
      cur = to; curMs = 0;
      shots.forEach((s, n) => {
        s.classList.toggle('is-on', n === cur);
        if (n !== cur) { s.querySelector('video')?.pause(); s.querySelector('.vf__vm')?.replaceChildren(); }
      });
      itemEl.forEach((e, n) => e.classList.toggle('is-in', n === cur));
      [...dots.children].forEach((d, n) => d.classList.toggle('is-on', n === cur));
      badge.textContent = land[cur] ? '16:9' : '9:16';
      el.dataset.ratio = land[cur] ? '16-9' : '9-16';
      fill(0); if (play) run();
    };
    // Fortschritt: Vimeo meldet sein Ende selbst, Dateien laufen ihre Länge, Bilder die eingestellte Dauer.
    const next1 = () => { if (visible && items.length > 1) show(cur + 1); };
    const run = () => {
      clearT(); if (!visible) return; started = true;
      const it = items[cur], shot = shots[cur], vm = parseVimeo(it.vimeo), v = shot.querySelector('video');
      const clip = Math.max(3, Math.min(10, num(p.clipSecs, 6))) * 1000;
      const byClock = (ms) => { const t0 = performance.now() - curMs; const tk = (t) => { curMs = t - t0; const f = Math.min(1, curMs / ms); fill(f); if (f >= 1) next1(); else raf = requestAnimationFrame(tk); }; raf = requestAnimationFrame(tk); };
      if (vm) {
        const host = shot.querySelector('.vf__vm'); host.replaceChildren();
        const q = new URLSearchParams({ autoplay: '1', muted: '1', controls: '0', api: '1', playsinline: '1', dnt: '1', autopause: '0', title: '0', byline: '0', portrait: '0', loop: items.length === 1 ? '1' : '0' });
        if (vm.hash) q.set('h', vm.hash);
        const ifr = h('iframe', { src: `https://player.vimeo.com/video/${vm.id}?${q}`, allow: 'autoplay; fullscreen', tabindex: '-1', 'aria-hidden': 'true', title: it.title || 'Video', class: 'vf__vf' });
        host.append(ifr); fitFrames();
        const post = (o) => { try { ifr.contentWindow.postMessage(JSON.stringify(o), 'https://player.vimeo.com'); } catch { /* weg */ } };
        let got = false;
        vmH = (e) => {
          if (e.source !== ifr.contentWindow) return; let d = e.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
          if (d.event === 'ready') { got = true; post({ method: 'addEventListener', value: 'finish' }); post({ method: 'addEventListener', value: 'playProgress' }); post({ method: 'setMuted', value: true }); }
          else if (d.event === 'playProgress') { got = true; if (p.auto === false) fill(Math.min(1, (d.data && d.data.percent) || 0)); }
          else if (d.event === 'finish') next1();
        };
        addEventListener('message', vmH);
        if (p.auto !== false && items.length > 1) byClock(clip);                                   // automatisch: nach den eingestellten Sekunden weiter
        else timer = setTimeout(() => { if (!got) next1(); }, 25000);                              // Notausgang, falls Vimeo nichts meldet
      } else if (v) {
        if (!curMs) v.currentTime = 0; v.play().catch(() => {});
        const tick = () => { const d = v.duration || 0; curMs = Math.max(1, v.currentTime * 1000); if (d) fill(Math.min(1, v.currentTime / d)); if (v.ended || (d && v.currentTime >= d - .05)) { if (items.length > 1) next1(); else { v.currentTime = 0; v.play().catch(() => {}); } } else raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      } else if (p.auto !== false && !still() && items.length > 1) {
        byClock(Math.max(1.5, num(items[cur].duration, 5)) * 1000);
      }
    };
    const step = (d) => { show(cur + d); };
    prev.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    [...dots.children].forEach(d => d.addEventListener('click', () => show(Number(d.dataset.n))));
    // Wischen auf dem Handy
    { let x0 = null; dev.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      dev.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = (e.changedTouches[0] || {}).clientX - x0; x0 = null; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); }, { passive: true }); }

    // ---------- Echtes 3D-Handy (WebGL). Ohne WebGL bleibt ein sauberer CSS-Rahmen stehen. ----------
    let gl = null;
    if (!still()) {
      try { gl = createPhone(cv, { tint: [.12, .12, .13], back: [.055, .055, .06] }); /* wie das 3D-Handy (QRUE): schwarzes Finish */ } catch (e) { console.warn('vf 3D:', e); gl = null; }
    }
    if (!gl) { el.classList.add('vf--flat'); cv.remove(); shadow.remove(); }
    else {
      el.classList.add('vf--gl');
      // Bildschirm-Inhalt passgenau auf die (perspektivisch verzerrte) Glasfläche legen
      const h2m = (sp, q) => { const M = []; sp.forEach(([x, y], i) => { const [u, v] = q[i]; M.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u], [0, 0, 0, x, y, 1, -x * v, -y * v, v]); });
        for (let c = 0; c < 8; c++) { let m = c; for (let r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[m][c])) m = r; [M[c], M[m]] = [M[m], M[c]]; const d = M[c][c] || 1e-9; for (let k = c; k < 9; k++) M[c][k] /= d; for (let r = 0; r < 8; r++) if (r !== c) { const f = M[r][c]; if (f) for (let k = c; k < 9; k++) M[r][k] -= f * M[c][k]; } }
        const [a, b, c2, d2, e2, f2, g2, hh2] = M.map(r => r[8]); return `matrix3d(${a},${d2},0,${g2},${b},${e2},0,${hh2},0,0,1,0,${c2},${f2},0,1)`; };
      const mob = matchMedia('(max-width: 899px)');
      const fitCv = () => { const dpr = Math.min(Math.max(devicePixelRatio || 1, 1.5) * 1.25, 2.5, Math.sqrt(6e6 / Math.max(1, cv.clientWidth * cv.clientHeight))), /* scharf wie das 3D-Handy, mit Pixel-Budget */ w = Math.max(2, Math.round(cv.clientWidth * dpr)), hh = Math.max(2, Math.round(cv.clientHeight * dpr)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } };
      const place = (q, W0) => {
        if (!q || q.facing <= .0005) { ov.style.opacity = '0'; return; }
        const cw = cv.clientWidth, ch = cv.clientHeight;
        // Video größer als der Bildschirm einbetten (wird verkleinert → scharf); nur bei deutlicher Änderung neu setzen
        { const [a0, a1] = q.pts, px = Math.hypot((a1[0] - a0[0]) * cw, (a1[1] - a0[1]) * ch), want = Math.max(400, Math.ceil(px * 1.5 / 40) * 40); /* größer einbetten und verkleinern = scharf */ if (!ov._w || Math.abs(want - ov._w) > 60) W0 = want; else W0 = ov._w; }
        const H0 = W0 / q.aspect;
        if (ov._w !== W0 || ov._h !== H0) { ov._w = W0; ov._h = H0; ov.style.width = W0 + 'px'; ov.style.height = H0.toFixed(1) + 'px'; ov.style.borderRadius = (W0 * .1007).toFixed(1) + 'px'; /* gleiche Ecken wie der 3D-Bildschirm */ el.style.setProperty('--vf-sw', W0 + 'px'); el.style.setProperty('--vf-sh', H0.toFixed(1) + 'px'); fitFrames(); }
        const mt = h2m([[0, 0], [W0, 0], [W0, H0], [0, H0]], q.pts.map(([x, y]) => [x * cw, y * ch]));
        if (ov._m !== mt) { ov._m = mt; ov.style.transform = mt; }
        ov.style.opacity = '1';
      };
      // Drehung: Feder, die ein kleines Stück über 90° hinausschwingt und weich zurückkommt
      let rot = land[0] ? 90 : 0, rotV = 0;
      const sq = (v) => Math.pow(Math.sin(Math.PI * v), 2);
      let swap = 1;                                                      // 0 → 1: kurzer Schwung beim Wechsel
      const onShow = () => { swap = 0; };
      ticker(el, (dt, t) => {
        fitCv();
        const target = land[cur] ? 90 : 0;
        // kritisch gedämpfte Feder (ruhig, kein Zappeln)
        const k = 46, c = 11.5;
        rotV += (target - rot) * k * dt - rotV * c * dt; rot += rotV * dt;
        if (Math.abs(target - rot) < .02 && Math.abs(rotV) < .05) { rot = target; rotV = 0; }
        swap = Math.min(1, swap + dt / 1.1);
        const fl = Math.sin(t * .8), air = sq(swap);
        gl.draw({
          rx: -3 + fl * 2.2,
          ry: 14 + Math.cos(t * .6) * 3.4 - 26 * air,                    // beim Wechsel kurz andrehen
          rz: rot,
          y: Math.sin(t * .85) * .022 + air * .05,                       // leichtes Schweben + kleiner Hüpfer
          fit: (mob.matches ? .9 : .88) - air * .05, mix: 0, intro: 1, time: t, light: 1,   // Handy: Gerät füllt sein Feld fast ganz (quer passt trotzdem, das Feld ist quadratisch)
        });
        place(gl.screenQuad(0), 360);
        const w = cv.clientWidth; shadow.style.width = (w * .5).toFixed(0) + 'px'; shadow.style.opacity = (.5 - air * .18).toFixed(2);
      });
      swapHook = onShow;
    }

    show(0, false);
    // Erst loslaufen, wenn der Abschnitt im Bild ist; kurzes Vorbeiscrollen stoppt nichts.
    let hideT = 0;
    const hide = () => { visible = false; clearT(); shots.forEach(s => s.querySelector('video')?.pause()); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach(e => {
        if (e.isIntersecting) { clearTimeout(hideT); hideT = 0; if (!visible) { visible = true; run(); } }
        else if (!hideT) hideT = setTimeout(() => { hideT = 0; hide(); }, 3000);
      }), { threshold: .05 }).observe(el);
    } else { visible = true; run(); }
    return el;
  },
};
