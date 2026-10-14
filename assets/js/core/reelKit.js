// Gemeinsame Bausteine für die Galerie-Blöcke (Album-Rail, Phone 3D, Elastic Reel, Parallax, Spin Shutter, Frame Scrub).
// Jeder Block hat eine Computer- und eine Smartphone-Variante: 💻 Bild/Video (meist 16:9) und 📱 Bild/Video (meist 9:16).
// Fehlt eine Variante, wird die andere genommen – es geht also immer beides.
import { h } from './dom.js';
import { imgFor, mobileView, isEmbedUrl, parseVimeo, parseYouTube, vimeoThumb } from './media.js';
import { still } from './scrollhub.js';

export const isVideo = (s) => /\.(mp4|webm)(\?|$)/i.test(s || '');
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const num = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));

export const ITEM = [
  { name: 'image', label: '💻 Bild oder Video für Computer (z. B. 16:9)', type: 'image' },
  { name: 'imageMobile', label: '📱 Bild oder Video für Smartphone (z. B. 9:16, leer = wie Computer)', type: 'image' },
  { name: 'title', label: 'Titel (optional)', type: 'text' },
  { name: 'subtitle', label: 'Untertitel (optional)', type: 'text' },
  { name: 'link', label: 'Link beim Anklicken (optional, z. B. ein Projekt-Name)', type: 'text' },
];
export const SOURCE = { name: 'source', label: 'Inhalt', type: 'select', options: ['eigene Bilder', 'alle Projekte'], default: 'eigene Bilder' };
export const ITEMS = { name: 'items', label: 'Bilder / Videos', type: 'list', itemFields: ITEM, default: [] };
export const AUTO = 'automatisch (PC 16:9 · Handy 9:16)';
export const FORMAT = (def = AUTO) => ({ name: 'format', label: 'Format der Bilder/Videos', type: 'select', options: [AUTO, '16:9', '9:16', '1:1', '4:5', '4:3', '3:2'], default: def });
export const BG = { name: 'bg', label: 'Hintergrund', type: 'select', options: ['transparent', 'dunkel', 'hell'], default: 'transparent' };
export const HEIGHT = (pc, mob) => [
  { name: 'height', label: '💻 Höhe am Computer in px', type: 'number', default: pc },
  { name: 'heightMobile', label: '📱 Höhe am Smartphone in px', type: 'number', default: mob },
];

export const view = () => (mobileView() ? 'm' : 'd');
// Seitenverhältnis (Breite ÷ Höhe) aus der Format-Einstellung
export function aspectOf(format, pcAuto = 16 / 9, mobAuto = 9 / 16) {
  const f = String(format || AUTO);
  const m = f.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  return mobileView() ? mobAuto : pcAuto;
}
export const heightOf = (p, pc, mob) => num(mobileView() ? p.heightMobile : p.height, mobileView() ? mob : pc);

export function getItems(p, ctx) {
  if (p.source === 'alle Projekte') {
    const idx = ctx.content.index;
    return (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden)
      .map(x => ({ src: imgFor(x), srcAlt: x.image, title: String(x.title || x.slug).replace(/\n/g, ' '), subtitle: x.roles || '', href: x.slug, ratio: x.ratio || '' }));
  }
  return (p.items || []).filter(i => i.image || i.imageMobile).map(i => ({
    src: mobileView() ? (i.imageMobile || i.image) : (i.image || i.imageMobile),
    srcAlt: mobileView() ? (i.image || i.imageMobile) : (i.imageMobile || i.image),
    title: i.title || '', subtitle: i.subtitle || '', href: i.link || '',
    screens: (i.screens || []).filter(x => x && x.src).map(x => ({ src: x.src, size: x.size || '' })),
  }));
}

// Bild oder Video (mp4/webm läuft stumm in Schleife, nur wenn sichtbar)
export function mediaNode(src, cls = '', alt = '') {
  // Vimeo-/YouTube-Link: kann nicht in 3D/Fächern laufen, daher wird das Vorschaubild des Videos gezeigt (für echtes Abspielen eine mp4-Datei hochladen)
  if (isEmbedUrl(src)) {
    const im = h('img', { class: cls, alt, decoding: 'async', draggable: 'false', crossorigin: 'anonymous' });
    const yt = parseYouTube(src), v = yt ? { id: yt.id, yt: true } : parseVimeo(src);
    if (v) vimeoThumb(v).then((u) => { if (u) im.src = u; });
    return im;
  }
  if (isVideo(src)) {
    const v = h('video', { class: cls, src, muted: '', loop: '', playsinline: '', preload: 'metadata', 'aria-label': alt || null });
    v.muted = true; v.defaultMuted = true; v.dataset.vid = '1';
    return v;
  }
  return h('img', { class: cls, src, alt, loading: 'lazy', decoding: 'async', draggable: 'false' });
}
// Videos in einem Element nur abspielen, solange es im Bild ist
export function playVideosWhenVisible(root) {
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver((es) => { for (const e of es) root.querySelectorAll('video[data-vid]').forEach(v => { if (e.isIntersecting && !still()) v.play().catch(() => {}); else v.pause(); }); }, { rootMargin: '15%' }).observe(root);
}

export const goto = (href) => { if (!href) return; const a = document.createElement('a'); a.href = href; a.setAttribute('data-link', ''); a.hidden = true; document.body.append(a); a.click(); a.remove(); };
export const bgClass = (bg) => (bg === 'dunkel' ? ' is-dark' : bg === 'hell' ? ' is-light' : '');

// Läuft nur, solange das Element im Bild ist. fn(dt in Sekunden, t in Sekunden)
export function ticker(el, fn) {
  let vis = false, raf = 0, last = 0;
  const loop = (t) => { raf = 0; if (!vis) return; const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t; try { fn(dt, t / 1000); } catch (e) { console.error('[reel]', e); } raf = requestAnimationFrame(loop); };
  const start = () => { if (vis && !raf) { last = 0; raf = requestAnimationFrame(loop); } };
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; start(); }, { rootMargin: '10%' }).observe(el); else { vis = true; start(); }
  return { get on() { return vis; } };
}
// Größe beobachten (Breite/Höhe in px) – ruft cb sofort, sobald das Element eine Größe hat
export function watchSize(el, cb) {
  let w = 0, hh = 0;
  const run = () => { const nw = el.clientWidth, nh = el.clientHeight; if (nw > 5 && nh > 5 && (nw !== w || nh !== hh)) { w = nw; hh = nh; cb(w, hh); } };
  if ('ResizeObserver' in window) new ResizeObserver(run).observe(el); else addEventListener('resize', run);
  requestAnimationFrame(run);
}
// Ziehen mit der Maus/dem Finger: Senkrecht-Wischen scrollt weiter die Seite (touch-action: pan-y)
export function dragHandler(el, { start, move, end, threshold = 5 }) {
  let id = null, sx = 0, sy = 0, lx = 0, lt = 0, vx = 0, moved = false, pt = 'mouse';
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return; id = e.pointerId; pt = e.pointerType || 'mouse'; sx = lx = e.clientX; sy = e.clientY; lt = performance.now(); vx = 0; moved = false; start?.(e);
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - lx, now = performance.now(), dt = Math.max(1, now - lt);
    if (!moved && pt !== 'mouse') {
      // Finger: erst entscheiden, ob waagerecht gewischt (Carousel) oder senkrecht gescrollt (Seite) wird – beim Scrollen lassen wir die Seite in Ruhe
      const ax = Math.abs(e.clientX - sx), ay = Math.abs(e.clientY - sy);
      if (ay > 8 && ay > ax * .7) { id = null; el.classList.remove('is-drag'); end?.(false, 0, e); return; }
      if (ax < 10 || ax < ay * 1.4) { lx = e.clientX; lt = now; return; }
    }
    if (!moved && Math.abs(e.clientX - sx) > threshold) { moved = true; try { el.setPointerCapture(id); } catch { /* */ } el.classList.add('is-drag'); }
    if (moved) { vx = vx * .6 + (dx / dt) * .4; move?.(dx, e, vx); }
    lx = e.clientX; lt = now;
  }, { passive: true });
  const up = (e) => { if (e.pointerId !== id) return; const was = moved; id = null; el.classList.remove('is-drag'); end?.(was, vx, e); if (was) { const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; el.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => el.removeEventListener('click', stop, true), 60); } };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
}

// Großansicht: Bild/Video vergrößert über der Seite. Schließen per Klick daneben, ×, Esc; Pfeile/Tasten wechseln zum nächsten Bild.
export function openLightbox(list, start = 0) {
  const items = (list || []).filter(i => i && i.src); if (!items.length) return;
  let i = Math.max(0, Math.min(start, items.length - 1));
  const box = h('div', { class: 'lbx', role: 'dialog', 'aria-modal': 'true' });
  const stage = h('div', { class: 'lbx__st' }), cap = h('div', { class: 'lbx__cap' });
  const close = h('button', { type: 'button', class: 'lbx__x', 'aria-label': 'Schließen' }, '×');
  const prev = h('button', { type: 'button', class: 'lbx__n lbx__n--p', 'aria-label': 'Zurück' }, '‹'), next = h('button', { type: 'button', class: 'lbx__n lbx__n--n', 'aria-label': 'Weiter' }, '›');
  box.append(stage, cap, close); if (items.length > 1) box.append(prev, next);
  const show = () => {
    const it = items[i]; stage.textContent = '';
    let m;
    if (isEmbedUrl(it.src)) { m = mediaNode(it.src, 'lbx__m', it.title); }
    else if (isVideo(it.src)) { m = h('video', { class: 'lbx__m', src: it.src, controls: '', autoplay: '', loop: '', playsinline: '' }); }
    else m = h('img', { class: 'lbx__m', src: it.src, alt: it.title || '', draggable: 'false' });
    stage.append(m); cap.textContent = [it.title, it.subtitle].filter(Boolean).join(' · ');
  };
  const go = (d) => { i = (i + d + items.length) % items.length; show(); };
  const end = () => { document.removeEventListener('keydown', key, true); box.classList.remove('is-on'); setTimeout(() => { box.remove(); document.documentElement.classList.remove('lbx-open'); }, 200); };
  const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); end(); } else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
  box.addEventListener('click', (e) => { if (e.target === box || e.target === stage || e.target === close) end(); });
  prev.addEventListener('click', (e) => { e.stopPropagation(); go(-1); }); next.addEventListener('click', (e) => { e.stopPropagation(); go(1); });
  let tx = null; box.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => { if (tx == null || items.length < 2) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', key, true); document.documentElement.classList.add('lbx-open');
  show(); document.body.append(box); requestAnimationFrame(() => box.classList.add('is-on')); close.focus({ preventScroll: true });
}
