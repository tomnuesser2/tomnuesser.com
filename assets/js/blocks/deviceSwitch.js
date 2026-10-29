import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { createPhone } from '../core/phoneGL.js';
import { createLaptop } from '../core/laptopGL.js';
import { ticker } from '../core/reelKit.js';
import { LAP_FIN } from '../core/laptopAnim.js';
import { parseVimeo, vimeoThumb, isEmbedUrl } from '../core/media.js';
// Short-form & Long-form: Smartphone (klein) und Laptop (groß) stehen gleichzeitig im Bild. Was angeklickt wird, kommt animiert nach vorn
// und läuft dort durch seine Einträge (Bilder nach "Dauer", Videos in ihrer eigenen Länge). Rechts steht nur kurz, was man sieht.
const isVideo = (s) => /\.(mp4|webm|mov)(\?|$)/i.test(s || '');
const LIST = [
  { name: 'vimeo', label: 'Vimeo-Link (z. B. https://vimeo.com/123456789) – läuft automatisch, stumm, bis zum Ende', type: 'text' },
  { name: 'src', label: 'oder Datei: Video (.mp4/.webm, volle Länge) oder Bild', type: 'image' },
  { name: 'title', label: 'Titel (kurz)', type: 'text' },
  { name: 'text', label: 'Kurztext (eine Zeile)', type: 'text' },
  { name: 'duration', label: 'Dauer in Sekunden (nur bei Bildern; bei Vimeo nur Notlösung, falls das Video nicht meldet, dass es zu Ende ist)', type: 'number', default: 4 },
];

export default {
  type: 'deviceSwitch', label: 'Short-form + Long-form (Smartphone & Laptop zusammen)',
  fields: [
    { name: 'kicker', label: 'Kleine Zeile', type: 'text', default: 'video formats', de: 'Videoformate' },
    { name: 'front', label: 'Wer startet vorne?', type: 'select', options: ['phone', 'laptop'], default: 'phone' },
    { name: 'shortTitle', label: 'Name Smartphone', type: 'text', default: 'Short-form', de: 'Short-Form' },
    { name: 'shortText', label: 'Kurztext Smartphone', type: 'text', default: 'Vertical stories for Reels, Shorts & ads.', de: 'Hochkant-Stories für Reels, Shorts & Ads.' },
    { name: 'shortItems', label: 'Smartphone-Einträge (Hochformat; Reihenfolge = Ablauf)', type: 'list', itemFields: LIST },
    { name: 'longTitle', label: 'Name Laptop', type: 'text', default: 'Long-form', de: 'Long-Form' },
    { name: 'longText', label: 'Kurztext Laptop', type: 'text', default: 'Live sessions & event films in full length.', de: 'Live-Sessions & Eventfilme in voller Länge.' },
    { name: 'longItems', label: 'Laptop-Einträge (Querformat; Reihenfolge = Ablauf)', type: 'list', itemFields: LIST },
    { name: 'ctaText', label: 'Großer Button unten: Text (leer = kein Button)', type: 'text', default: 'my recent work', de: 'meine aktuellen Arbeiten' },
    { name: 'ctaLink', label: 'Großer Button unten: Ziel (Seite, z. B. projects)', type: 'text', default: 'projects' },
    { name: 'auto', label: 'Automatisch durchschalten', type: 'checkbox', default: true },
    { name: 'swapSecs', label: 'Sekunden, bis Smartphone und Laptop automatisch die Plätze tauschen (10–15; die Pfeile drehen dabei)', type: 'range', min: 10, max: 15, step: 1, default: 12 },
    { name: 'autoProjects', label: 'Projekte automatisch einbinden (alle Projekte mit „In Short-form + Long-form zeigen“ – deren Vimeo-Videos; hochkant → Smartphone, quer → Laptop)', type: 'checkbox', default: true },
    { name: 'clipSecs', label: 'Sekunden pro automatischem Video, bevor es weiterwechselt (3–6, immer stumm)', type: 'range', min: 3, max: 6, step: .5, default: 5 },
  ],
  render(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const norm = (i) => (isEmbedUrl(i.src) && !i.vimeo ? { ...i, vimeo: i.src, src: '' } : i);
    const ok = (i) => i.src || parseVimeo(i.vimeo);
    const items = { phone: (p.shortItems || []).map(norm).filter(ok), laptop: (p.longItems || []).map(norm).filter(ok) };
    // Automatisch aus den Projekten (Schalter pro Projekt im Admin): Vimeo-Clips, stumm, je 3–6 s
    if (p.autoProjects !== false && ctx && ctx.content && ctx.content.index) {
      const seen = new Set(), idx = ctx.content.index, clip = Math.min(6, Math.max(3, Number(p.clipSecs) || 5));
      for (const slug of idx.order || []) { const pr = idx.projects[slug]; if (!pr || !pr.showcase) continue;
        for (const c of pr.clips || []) if (parseVimeo(c.vimeo) && !seen.has(c.vimeo)) seen.add(c.vimeo), items[c.kind === 'phone' ? 'phone' : 'laptop'].push({ vimeo: c.vimeo, src: '', title: pr.title || slug, text: c.title || pr.roles || pr.summary || '', duration: clip, clip }); }
    }
    const PH_RY_F = 16, PH_RY_B = 38, LP_RY_F = -16, LP_RY_B = -36;
    const S = { phone: { cur: 0, shots: [], el: null }, laptop: { cur: 0, shots: [], el: null } };
    let el0 = false, flyHook = null, front = items[p.front] && items[p.front].length ? p.front : (items.phone.length ? 'phone' : 'laptop'), timer, raf, visible = false;

    const bars = h('div', { class: 'dd__bars' });
    const pScr = h('div', { class: 'dd__scr' });
    const phone = h('button', { type: 'button', class: 'dd__phone', 'aria-label': p.shortTitle }, h('div', { class: 'dd__pscreen' }, pScr, bars), h('span', { class: 'dd__island' }));
    const lScr = h('div', { class: 'dd__scr' }), lBar = h('i', { class: 'dd__pb' }), lTitle = h('span', { class: 'dd__lt' });
    const playerEl = h('div', { class: 'dd__player' }, h('b', {}, '▶'), lTitle, h('span', { class: 'dd__tl' }, lBar));
    const laptop = h('button', { type: 'button', class: 'dd__laptop', 'aria-label': p.longTitle },
      h('div', { class: 'dd__lid' }, h('div', { class: 'dd__lscreen' }, lScr, playerEl)), h('div', { class: 'dd__base' }));
    S.phone.el = pScr; S.laptop.el = lScr;
    // Umschalter (Apple-Stil): Kapsel mit gleitendem Schieber, darunter läuft ein feiner Fortschrittsfaden bis zum nächsten automatischen Wechsel
    const tgProg = h('b', { class: 'dd__tgp' }), tgThumb = h('i', { class: 'dd__tgt' }), tgTrack = h('div', { class: 'dd__tgl' }, tgProg);
    const tgB = (m, label, ico) => { const b = h('button', { type: 'button', class: 'dd__tgb', 'data-m': m, 'aria-label': m === 'phone' ? p.shortTitle : p.longTitle }, h('span', { class: 'dd__tgi' }), h('span', {}, label)); b.firstChild.innerHTML = ico; return b; };
    const tgBtns = [tgB('phone', '9:16', '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.5 5.3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'), tgB('laptop', '16:9', '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5" width="15" height="10.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 19h19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>')];
    const swapBtn = h('div', { class: 'dd__tg', role: 'group' }, tgThumb, ...tgBtns, tgTrack);
    const dev = h('div', { class: 'dd__dev' }, phone, laptop, swapBtn);
    const devMount = () => { if (gl3) dev.prepend(gl3.shP, gl3.shL); };
    const k = h('p', { class: 'dd__k' }, p.kicker);
    // Alle Texte (beide Geräte, alle Einträge) liegen übereinander in je EINER Gitterzelle: Der Textblock ist immer so hoch wie der längste Text,
    // beim Weiterschalten springt oder wächst nichts mehr (kein Ruckeln der ganzen Bühne)
    const headEl = { phone: h('div', { class: 'dd__hd' }, h('h2', { class: 'dd__h' }, p.shortTitle || ''), h('p', { class: 'dd__p' }, p.shortText || '')), laptop: h('div', { class: 'dd__hd' }, h('h2', { class: 'dd__h' }, p.longTitle || ''), h('p', { class: 'dd__p' }, p.longText || '')) };
    const itemEl = { phone: items.phone.map(it => h('div', { class: 'dd__item' }, h('h3', { class: 'dd__it' }, it.title || ''), h('p', { class: 'dd__ix' }, it.text || ''))), laptop: items.laptop.map(it => h('div', { class: 'dd__item' }, h('h3', { class: 'dd__it' }, it.title || ''), h('p', { class: 'dd__ix' }, it.text || ''))) };
    const heads = h('div', { class: 'dd__heads' }, headEl.phone, headEl.laptop), item = h('div', { class: 'dd__items' }, itemEl.phone, itemEl.laptop);
    const sw = ['phone', 'laptop'].map(m => h('button', { type: 'button', class: 'dd__sw', 'data-m': m, 'aria-label': m === 'phone' ? p.shortTitle : p.longTitle }, h('i', {})));
    const cta = p.ctaText ? h('a', { class: 'cta dd__cta', href: p.ctaLink || 'projects', 'data-link': '', 'data-magnetic': '1' }, h('span', {}, p.ctaText), h('i', { 'aria-hidden': 'true' }, '→')) : null;
    const el = h('section', { class: 'dd', id: p.id }, h('div', { class: 'dd__sticky' }, h('div', { class: 'dd__stage' }, dev, h('div', { class: 'dd__copy' }, k, h('div', { class: 'dd__dots' }, sw), heads, item)), cta));

    // ===== Echte 3D-Geräte (WebGL, wie bei den 3D-Mockups): Handy und Laptop werden gerendert, der Bildschirminhalt (Video/Bild) liegt passgenau darüber =====
    let gl3 = null;
    if (!still()) { try {
      const cvP = h('canvas', { class: 'dd__cv', 'aria-hidden': 'true' }), cvL = h('canvas', { class: 'dd__cv', 'aria-hidden': 'true' });
      const gP = createPhone(cvP, { tint: [.2, .195, .19], back: [.085, .083, .08] }), gL = gP && createLaptop(cvL, { tint: LAP_FIN['space schwarz'] });
      if (gP && gL) {
        const ovP = h('div', { class: 'dd__ov dd__ov--p' }, pScr, bars), ovL = h('div', { class: 'dd__ov dd__ov--l' }, lScr, playerEl);
        phone.replaceChildren(cvP, ovP); laptop.replaceChildren(cvL, ovL); el0 = true;
        gl3 = { gP, gL, cvP, cvL, ovP, ovL, shP: h('i', { class: 'dd__fs' }), shL: h('i', { class: 'dd__fs' }) };
      }
    } catch (e) { console.warn('dd 3D:', e); gl3 = null; } }
    // Screens aufbauen
    for (const m of ['phone', 'laptop']) {
      S[m].shots = items[m].map(it => {
        const vm = parseVimeo(it.vimeo), v = !vm && isVideo(it.src);
        const node = vm ? h('div', { class: 'dd__vm' }) : v ? h('video', { src: it.src, muted: '', playsinline: '', preload: 'metadata', 'aria-hidden': 'true' }) : h('img', { src: it.src, alt: '', decoding: 'async', loading: 'lazy' });
        if (v) { node.muted = true; node.defaultMuted = true; node.preload = 'auto'; node.addEventListener('loadedmetadata', () => { try { if (node.paused && !node.currentTime) node.currentTime = .05; } catch { /* weg */ } }, { once: true }); }
        if (vm) vimeoThumb(vm).then(t => { if (t) node.style.background = `#000 url("${t}") center / cover no-repeat`; }).catch(() => {});
        const s = h('div', { class: 'dd__shot' }, node); S[m].el.append(s); return s;
      });
    }
    if (gl3) {
      el.classList.add('dd--gl');
      const h2m = (sp, q) => { const M = []; sp.forEach(([x, y], i) => { const [u, v] = q[i]; M.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u], [0, 0, 0, x, y, 1, -x * v, -y * v, v]); });
        for (let c = 0; c < 8; c++) { let m = c; for (let r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[m][c])) m = r; [M[c], M[m]] = [M[m], M[c]]; const d = M[c][c] || 1e-9; for (let k = c; k < 9; k++) M[c][k] /= d; for (let r = 0; r < 8; r++) if (r !== c) { const f = M[r][c]; if (f) for (let k = c; k < 9; k++) M[r][k] -= f * M[c][k]; } }
        const [a, b, c, d, e, f, g, hh] = M.map(r => r[8]); return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`; };
      const wob = (i) => { if (i >= 1) return 0; const u = Math.min(1, Math.max(0, (i - .72) / .28)); return Math.exp(-2.8 * i) * Math.sin(10 * i) * (1 - u * u * (3 - 2 * u)); }, spr = (i) => { if (i >= 1) return 1; const u = Math.min(1, Math.max(0, (i - .7) / .3)), w = 1 - u * u * (3 - 2 * u); return 1 - Math.exp(-5.5 * i) * Math.cos(6 * i) * w; }, gate = (i) => { const u = Math.min(1, Math.max(0, (i - .4) / .3)); return u * u * (3 - 2 * u); }; // federnde Landung: leicht über das Ziel hinaus, dann ausschwingen
      const bump = (i) => (i <= .45 || i >= 1) ? 0 : Math.pow(Math.sin(Math.PI * (i - .45) / .55), 2); // langsames, sanftes Nachfedern nach oben nach der Landung
      const fly = { phone: { i: 1, o: 1 }, laptop: { i: 1, o: 1 } }; const fi = (m) => { const x = Math.min(1, fly[m].i / .8), u = Math.min(1, Math.max(0, (x - .85) / .15)), w = 1 - u * u * (3 - 2 * u); return x >= 1 ? 1 : 1 - Math.exp(-5.5 * x) * Math.cos(4.2 * x) * w; }, hb = (m) => { const u = fly[m].i; return .18 + .82 * u * u * (3 - 2 * u); }; // fi: weiche Hauptbewegung (langsam rein, langsam raus); hb: Schweben wird nach der Landung stufenlos eingeblendet
       flyHook = (m) => { fly[m].i = 0; fly[m === 'phone' ? 'laptop' : 'phone'].o = 0; };
      const lerp = (a, b, t) => a + (b - a) * t, fa = { phone: front === 'phone' ? 1 : 0, laptop: front === 'laptop' ? 1 : 0 }, mob = matchMedia('(max-width: 899px)');
      const fitCv = (cv) => { const dpr = Math.min(devicePixelRatio || 1, mob.matches ? 1.5 : 2), w = Math.max(2, Math.round(cv.clientWidth * dpr)), hh = Math.max(2, Math.round(cv.clientHeight * dpr)); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; } };
      const place = (ov, cv, q, W0) => { if (!q || q.facing <= .0005) { ov.style.opacity = '0'; return; } const H0 = W0 / q.aspect, cw = cv.clientWidth, ch = cv.clientHeight; if (ov._w !== W0 || ov._h !== H0) { ov._w = W0; ov._h = H0; ov.style.width = W0 + 'px'; ov.style.height = H0.toFixed(1) + 'px'; } const mt = h2m([[0, 0], [W0, 0], [W0, H0], [0, H0]], q.pts.map(([x, y]) => [x * cw, y * ch])); if (ov._m !== mt) { ov._m = mt; ov.style.transform = mt; } ov.style.opacity = '1'; };
      ticker(el, (dt, t) => {
        const k = Math.min(1, dt * 4.6); for (const m of ['phone', 'laptop']) { fly[m].i = Math.min(1, fly[m].i + dt / 3.4); fly[m].o = Math.min(1, fly[m].o + dt / 1.4); } fa.phone += ((front === 'phone' ? 1 : 0) - fa.phone) * k; fa.laptop += ((front === 'laptop' ? 1 : 0) - fa.laptop) * k;
        fitCv(gl3.cvP); fitCv(gl3.cvL); const fl = Math.sin(t * .8);
        { // gemeinsame Standlinie: beide Geräte stehen unten auf derselben Höhe, Bodenschatten wächst mit der Gerätegröße
          const dh = dev.clientHeight, dw = dev.clientWidth, base = dh * .93, fP = lerp(.37, .8, fa.phone), fL = lerp(.4, .9, fa.laptop);
          const bP = base - dh * .08 * (1 - fa.phone), bL = base - dh * .08 * (1 - fa.laptop); // das hintere Gerät steht weiter hinten (höher im Raum)
          const dP = bP - dh / 2 - phone.clientHeight * fP / 2, dL = bL - dh / 2 - laptop.clientHeight * fL / 2 + laptop.clientHeight * .05;
          const Wu = dw / 2.6, sq = (v) => Math.pow(Math.sin(Math.PI * v), 2), bobP = Math.sin(t * .95), bobL = Math.sin(t * .95 + 1.3), arcP = sq(fi('phone')) * dh * .16 + wob(fi('phone')) * dh * .04 + bump(fly.phone.i) * dh * .035 - sq(fly.phone.o) * dh * .03 + (.35 + .65 * fa.phone) * hb('phone') * bobP * dh * .022, arcL = sq(fi('laptop')) * dh * .16 + wob(fi('laptop')) * dh * .04 + bump(fly.laptop.i) * dh * .035 - sq(fly.laptop.o) * dh * .03 + (.35 + .65 * fa.laptop) * hb('laptop') * bobL * dh * .022;
          const dxP = (lerp(.62, 1.3, fa.phone) - 1.3) * Wu, dxL = (lerp(2.0, 1.15, fa.laptop) - 1.3) * Wu;
          phone.style.transform = `translate(${dxP.toFixed(1)}px, calc(-50% + ${(dP - arcP).toFixed(1)}px))`; laptop.style.transform = `translate(${dxL.toFixed(1)}px, calc(-50% + ${(dL - arcL).toFixed(1)}px))`;
          phone.style.filter = `blur(${((1 - fa.phone) * 1.3).toFixed(2)}px) brightness(${(1 - .14 * (1 - fa.phone)).toFixed(3)})`; laptop.style.filter = `blur(${((1 - fa.laptop) * 1.3).toFixed(2)}px) brightness(${(1 - .14 * (1 - fa.laptop)).toFixed(3)})`;
          const sp = (sh, el, dx, bb, w, o) => { sh.style.width = w.toFixed(1) + 'px'; sh.style.opacity = o.toFixed(2); sh.style.transform = `translate(${(el.offsetLeft + dx + el.clientWidth / 2 - w / 2).toFixed(1)}px,${(bb - 5).toFixed(1)}px)`; };
          sp(gl3.shP, phone, dxP, bP, phone.clientWidth * lerp(.4, .72, fa.phone), lerp(.25, .62, fa.phone) * (1 - .1 * bobP)); sp(gl3.shL, laptop, dxL, bL, laptop.clientWidth * lerp(.45, .82, fa.laptop), lerp(.25, .62, fa.laptop) * (1 - .1 * bobL));
        }
        gl3.gP.draw({ rx: -3 + fl * 2.2 * hb('phone'), ry: lerp(PH_RY_B, PH_RY_F, fa.phone) + Math.cos(t * .6) * 3.2 * hb('phone') + 360 * (1 - fi('phone')) + 4 * wob(fi('phone')) - 50 * Math.pow(Math.sin(Math.PI * fly.phone.o), 2), rz: -10 * Math.pow(Math.sin(Math.PI * fi('phone')), 2), y: Math.sin(t * .8) * .02 * hb('phone'), fit: lerp(.37, .8, fa.phone), mix: 0, intro: 1, time: t, light: 1 });
        gl3.gL.draw({ open: 1, pad: 1, rx: lerp(18, 9, fa.laptop) + fl * hb('laptop'), ry: lerp(LP_RY_B, LP_RY_F, fa.laptop) + Math.cos(t * .6) * 3.2 * hb('laptop') - 360 * (1 - fi('laptop')) + 4 * wob(fi('laptop')) + 50 * Math.pow(Math.sin(Math.PI * fly.laptop.o), 2), rz: 6 * Math.pow(Math.sin(Math.PI * fi('laptop')), 2), y: Math.sin(t * .8 + 1) * .016 * hb('laptop'), fit: lerp(.4, .9, fa.laptop), mix: 0, intro: 1, time: t, light: 1, scroll: 0, chrome: false });
        place(gl3.ovP, gl3.cvP, gl3.gP.screenQuad(0), 360); place(gl3.ovL, gl3.cvL, gl3.gL.screenQuad(false, .004), 1280);
      });
    }
    devMount();
    bars.replaceChildren(...items.phone.map(() => h('i', {}, h('b', {}))));

    const clearT = () => { clearTimeout(timer); cancelAnimationFrame(raf); if (vmH) { removeEventListener('message', vmH); vmH = null; } };
    let vmH = null;
    const fill = (m, f) => { if (m === 'laptop') lBar.style.transform = `scaleX(${f})`; else { const b = bars.children[S.phone.cur]; if (b) b.firstChild.style.transform = `scaleX(${f})`; } };
    const show = (m, i, play = true) => {
      const list = items[m]; if (!list.length) return; const st = S[m];
      st.cur = (i + list.length) % list.length;
      st.shots.forEach((s, n) => { s.classList.toggle('is-on', n === st.cur); const v = s.querySelector('video'); if (v && n !== st.cur) { v.pause(); } const vf = s.querySelector('.dd__vm'); if (vf && n !== st.cur) vf.replaceChildren(); });
      if (m === 'phone') [...bars.children].forEach((b, n) => { b.firstChild.style.transform = `scaleX(${n < st.cur ? 1 : 0})`; });
      else lBar.style.transform = 'scaleX(0)';
      lTitle.textContent = items.laptop[S.laptop.cur] ? items.laptop[S.laptop.cur].title || '' : '';
      if (m === front) { itemEl.phone.forEach(e => e.classList.remove('is-in')); itemEl.laptop.forEach(e => e.classList.remove('is-in')); itemEl[m][st.cur]?.classList.add('is-in'); if (play) run(); }
    };
    // Fortschritt: Video = eigene Länge, Bild = Dauer
    const run = () => {
      clearT(); if (!visible) return; const m = front, st = S[m], list = items[m]; if (!list.length) return;
      const it = list[st.cur], shot = st.shots[st.cur], v = shot && shot.querySelector('video'), vm = parseVimeo(it.vimeo);
      const next = () => { if (!visible || front !== m) return; if (list.length > 1 || v) show(m, st.cur + 1); };
      if (vm) {
        // Vimeo: stumm, automatisch, ohne Bedienelemente; weiter zum nächsten Eintrag, sobald das Video zu Ende ist
        const host = shot.querySelector('.dd__vm'); host.replaceChildren();
        const q = new URLSearchParams({ autoplay: '1', muted: '1', controls: '0', api: '1', playsinline: '1', dnt: '1', autopause: '0', title: '0', byline: '0', portrait: '0', loop: list.length === 1 ? '1' : '0' }); if (vm.hash) q.set('h', vm.hash);
        const ifr = h('iframe', { src: `https://player.vimeo.com/video/${vm.id}?${q}`, allow: 'autoplay; fullscreen', tabindex: '-1', 'aria-hidden': 'true', title: it.title || 'Video', class: 'dd__vf' });
        host.append(ifr); fill(m, 0);
        const post = (o) => { try { ifr.contentWindow.postMessage(JSON.stringify(o), 'https://player.vimeo.com'); } catch { /* weg */ } };
        let got = false;
        vmH = (e) => {
          if (e.source !== ifr.contentWindow) return; let d = e.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
          if (d.event === 'ready') { got = true; clearTimeout(timer); post({ method: 'addEventListener', value: 'finish' }); post({ method: 'addEventListener', value: 'playProgress' }); post({ method: 'setMuted', value: true }); }
          else if (d.event === 'playProgress') { got = true; if (!it.clip) fill(m, Math.min(1, (d.data && d.data.percent) || 0)); }
          else if (d.event === 'finish') { if (list.length > 1) next(); }
        };
        addEventListener('message', vmH);
        if (it.clip && list.length > 1) {   // automatischer Clip: genau 3–6 s laufen lassen, eigener Fortschrittsbalken, dann weiter
          const dur = it.clip * 1000, t0 = performance.now(); clearTimeout(timer);
          const tk = (t) => { if (front !== m) return; const f = Math.min(1, (t - t0) / dur); fill(m, f); if (f >= 1) next(); else raf = requestAnimationFrame(tk); };
          raf = requestAnimationFrame(tk);
        }
        timer = setTimeout(() => { if (!got && list.length > 1) next(); }, Math.max(4, Number(it.duration) || 20) * 1000);
      } else if (v) {
        v.currentTime = 0; v.play().catch(() => {});
        const tick = () => { if (front !== m) return; const d = v.duration || 0; if (d) fill(m, Math.min(1, v.currentTime / d)); if (v.ended || (d && v.currentTime >= d - .05)) { if (list.length > 1) next(); else { v.currentTime = 0; v.play().catch(() => {}); } } raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      } else if (p.auto && !still() && list.length > 1) {
        const dur = Math.max(1.5, Number(it.duration) || 4) * 1000, t0 = performance.now();
        const tick = (t) => { if (front !== m) return; const f = Math.min(1, (t - t0) / dur); fill(m, f); if (f >= 1) next(); else raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      }
    };
    let swapT = 0;
    const armSwap = () => { clearTimeout(swapT); tgProg.style.animation = 'none'; if (p.auto !== false && !still() && visible && items.phone.length && items.laptop.length) { void tgProg.offsetWidth; tgProg.style.animation = `ddprog ${Math.min(15, Math.max(10, Number(p.swapSecs) || 12))}s linear forwards`; } if (p.auto === false || still() || !visible || !items.phone.length || !items.laptop.length) return; swapT = setTimeout(() => { if (visible) setFront(front === 'phone' ? 'laptop' : 'phone'); }, Math.min(15, Math.max(10, Number(p.swapSecs) || 12)) * 1000); };
    const setFront = (m) => {
      if (!items[m].length && items[m === 'phone' ? 'laptop' : 'phone'].length) return;
      if (front !== m && flyHook) flyHook(m);
      swapBtn.dataset.m = m; tgBtns.forEach(b => b.classList.toggle('is-on', b.dataset.m === m));
      front = m; el.dataset.front = m; sw.forEach(s => s.classList.toggle('is-on', s.dataset.m === m));
      headEl.phone.classList.toggle('is-on', m === 'phone'); headEl.laptop.classList.toggle('is-on', m === 'laptop');
      ['phone', 'laptop'].forEach(x => { if (x !== m) { S[x].shots.forEach(s => { const v = s.querySelector('video'); if (v) { v.pause(); } s.querySelector('.dd__vm')?.replaceChildren(); }); } });
      show(m, S[m].cur); armSwap();
    };
    // Bedienung: nicht vorne → nach vorn holen; vorne → Handy: links/rechts tippen, Laptop: nächster Eintrag
    phone.addEventListener('click', (e) => { if (front !== 'phone') return setFront('phone'); const r = phone.getBoundingClientRect(); show('phone', S.phone.cur + (e.clientX < r.left + r.width * .35 ? -1 : 1)); });
    laptop.addEventListener('click', () => { if (front !== 'laptop') return setFront('laptop'); show('laptop', S.laptop.cur + 1); });
    sw.forEach(s => s.addEventListener('click', () => setFront(s.dataset.m)));
    tgBtns.forEach(b => b.addEventListener('click', () => setFront(b.dataset.m)));
    // Handy: Gerätegröße so wählen, dass Gerät + Text + Button immer in den Bildschirm passen (egal wie lang der Text / wie groß die Schrift ist)
    const mqM = matchMedia('(max-width: 899px)'), sticky = el.firstChild;
    const fit = () => {
      el.style.removeProperty('--W');
      if (!mqM.matches || !el.isConnected || !sticky.clientHeight) return;
      const cs = getComputedStyle(sticky), avail = sticky.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const need = () => dev.parentElement.offsetHeight + (cta ? cta.offsetHeight + parseFloat(cs.rowGap || cs.gap || 14) : 0);
      let w = dev.offsetWidth / (el.classList.contains('dd--gl') ? 2.6 : 1.8); el.style.setProperty('--W', w + 'px');
      while (need() > avail && w > 80) { w -= 8; el.style.setProperty('--W', w + 'px'); }
    };
    requestAnimationFrame(() => requestAnimationFrame(fit)); addEventListener('resize', fit); setTimeout(fit, 700); document.fonts?.ready?.then(fit);
    el.dataset.front = front; swapBtn.dataset.m = front; setFront(front); show(front === 'phone' ? 'laptop' : 'phone', 0, false);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { es.forEach(e => { visible = e.isIntersecting; if (visible) { run(); armSwap(); } else { clearT(); clearTimeout(swapT); ['phone', 'laptop'].forEach(x => S[x].shots.forEach(s => s.querySelector('video')?.pause())); } }); }, { threshold: .2 }).observe(el);
    else { visible = true; run(); }
    return el;
  },
};
