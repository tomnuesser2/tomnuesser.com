import { h } from '../core/dom.js';
import { track, still, clamp, trackProgress, kick } from '../core/scrollhub.js';
import { isFinePointer } from '../core/dom.js';
import { ui } from '../core/i18n.js';
// Hero: auffächernde Projekt-Karten (zentriert, Hover = größer), darunter frei editierbarer Titel / Untertitel / Text.
export default {
  type: 'hero', label: 'Hero (Karten + Titel)',
  fields: [
    { name: 'title', label: 'Überschrift (eine Zeile pro Umbruch – die Zeilen leuchten nacheinander auf)', type: 'textarea', default: 'videographer,\ndesigner &\ndeveloper.', de: 'Videograf,\nDesigner &\nEntwickler.' },
    { name: 'titleSize', label: 'Größe der Überschrift', type: 'select', options: ['s', 'm', 'l', 'xl'], default: 'l' },
    { name: 'cycle', label: 'Zeilen nacheinander aufleuchten lassen', type: 'checkbox', default: true },
    { name: 'subtitle', label: 'Unterschrift (optional)', type: 'text', default: '' },
    { name: 'subSize', label: 'Größe der Unterschrift', type: 'select', options: ['s', 'm', 'l'], default: 'm' },
    { name: 'text', label: 'Textfeld (optional)', type: 'textarea', default: '' },
    { name: 'cue', label: 'Hinweis unten', type: 'text', default: 'scroll', de: 'scrollen' },
    { name: 'cards', label: 'Anzahl Karten (aus den ersten Projekten)', type: 'number', default: 4 },
    { name: 'mobileCount', label: 'Handy: Anzahl Vollbild-Projekte, falls keine Projekte markiert sind (Markierung: im Projekt „Im Handy-Intro zeigen“)', type: 'number', default: 4 },
  ],
  render(p0, ctx) {
    const desk = this.renderDesk(p0, ctx);
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const mob = mobileHero(p, ctx);
    return h('div', { class: 'hero-wrap', id: undefined }, desk, mob);
  },
  renderDesk(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const idx = ctx.content.index;
    const list = (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden).slice(0, Math.max(2, Math.min(6, p.cards || 4)));
    const n = list.length;
    const cards = list.map((pr, i) => h('a', { class: 'hero__card', href: pr.slug, 'data-link': '', 'aria-label': pr.title, style: { '--i': i, '--k': n === 1 ? 0 : (i / (n - 1)) * 2 - 1 } },
      h('img', { src: pr.image, alt: '', decoding: 'async' })));
    const lines = String(p.title || '').split('\n').map(s => s.trim()).filter(Boolean);
    const lineEls = lines.map((r) => h('span', { class: 'hero__role' }, r));
    const el = h('section', { class: 'hero', id: p.id },
      h('div', { class: 'hero__cards' }, cards),
      h('h1', { class: `hero__roles is-${p.titleSize}` }, lineEls),
      p.subtitle ? h('p', { class: `hero__sub is-${p.subSize}` }, p.subtitle) : null,
      p.text ? h('p', { class: 'hero__text' }, p.text) : null,
      h('a', { class: 'hero__cue', href: 'home#work', 'data-link': '' }, p.cue || 'scroll', h('i', { 'aria-hidden': 'true' }, '↓')));
    if (still() || !p.cycle) { lineEls.forEach(r => r.classList.add('is-on')); if (still()) return el; }
    if (p.cycle) { let a = 0; const cycle = () => { lineEls.forEach((r, i) => r.classList.toggle('is-on', i === a)); a = (a + 1) % lineEls.length; };
      cycle(); const t = setInterval(() => { if (!el.isConnected) return clearInterval(t); cycle(); }, 1700); }
    if (isFinePointer()) addEventListener('pointermove', (e) => { el.style.setProperty('--px', (e.clientX / innerWidth * 2 - 1).toFixed(3)); el.style.setProperty('--py', (e.clientY / innerHeight * 2 - 1).toFixed(3)); }, { passive: true });
    track(el, (r, vh) => { el.style.setProperty('--hp', clamp(-r.top / (vh * .9)).toFixed(4)); });
    return el;
  },
};


// ---------- Handy-Intro: Vollbild ----------
// 1) Mosaik aller Projekte mit dem Titel davor. 2) Das erste ausgewählte Projekt wächst aus dem Mosaik auf Vollbild.
// 3) Die weiteren ausgewählten Projekte schieben sich nacheinander als Vollbild darüber – alles gesteuert durch das Scrollen.
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
function mobileHero(p, ctx) {
  const idx = ctx.content.index;
  const all = (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden);
  if (all.length < 2) return null;
  let feat = all.filter(x => x.featured);
  if (!feat.length) feat = all.slice(0, Math.max(1, Math.min(8, Number(p.mobileCount) || 4)));
  const N = feat.length, COLS = 3, ROWS = 5, CENTER = 7, G = 3;
  const others = all.filter(x => x !== feat[0]); let o = 0;
  const tiles = Array.from({ length: COLS * ROWS }, (_, i) => (i === CENTER ? feat[0] : others[o++ % others.length]));
  const name = (x) => String(x.title || x.slug).replace(/\n/g, ' ');

  const tileEls = tiles.map((t, i) => h('i', { class: 'hm__tile', style: { '--c': i % COLS } }, h('img', { src: t.image, alt: '', decoding: 'async', loading: i < 6 ? 'eager' : 'lazy' })));
  const grid = h('div', { class: 'hm__grid' }, tileEls);
  const lines = String(p.title || '').split('\n').map(s => s.trim()).filter(Boolean);
  const title = h('h1', { class: 'hm__title' }, lines.map(l => h('span', {}, l)));
  const cue = h('p', { class: 'hm__cue' }, p.cue || 'scroll', h('i', { 'aria-hidden': 'true' }, '↓'));
  const veil = h('div', { class: 'hm__veil' });
  const shots = feat.map((f, i) => {
    const img = h('img', { src: f.image, alt: '', decoding: 'async' });
    const cap = h('div', { class: 'hm__cap' }, h('span', { class: 'hm__n' }, `${String(i + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`), h('strong', { class: 'hm__t' }, name(f)), f.roles ? h('em', { class: 'hm__r' }, f.roles) : null);
    const a = h('a', { class: 'hm__shot', href: f.slug, 'data-link': '', 'aria-label': name(f) }, h('div', { class: 'hm__img' }, img), h('i', { class: 'hm__shade' }), cap);
    return { a, img: a.firstChild, cap };
  });
  const stage = h('div', { class: 'hm__stage' }, grid, veil, title, cue, shots.map(s => s.a));
  const T = 0.8 + 1 + .6 + (N - 1) * 1.6 + .25;                 // Länge der Animation in "Einheiten"
  const el = h('section', { class: 'hm', 'aria-label': p.title || '', style: { '--len': (T * .5).toFixed(2) } }, h('div', { class: 'hm__track' }, stage));
  if (still()) { el.classList.add('is-still'); return el; }

  let W = 0, H = 0, R = null;
  const measure = () => {
    W = stage.clientWidth; H = stage.clientHeight; const w = (W - (COLS - 1) * G) / COLS, hh = (H - (ROWS - 1) * G) / ROWS, c = CENTER % COLS, r = Math.floor(CENTER / COLS);
    const l = c * (w + G), t = r * (hh + G); R = { t, r: W - l - w, b: H - t - hh, l };
  };
  const apply = (u) => {
    if (!R) measure();
    const z = ease(clamp((u - .8) / 1)), intro = clamp(u / 1.6);
    // Mosaik: Spalten laufen gegenläufig, leichter Zoom, dann verschwindet es hinter dem ersten Vollbild
    grid.style.transform = `scale(${(1 + .1 * intro).toFixed(4)})`; grid.style.visibility = z >= 1 ? 'hidden' : 'visible';
    tileEls.forEach((t, i) => { const dir = (i % COLS) % 2 ? 1 : -1; t.style.transform = `translateY(${(dir * intro * H * .035).toFixed(1)}px)`; });
    veil.style.opacity = String(1 - z * .6);
    const tOp = 1 - clamp((u - .15) / .55); title.style.opacity = tOp.toFixed(3); title.style.transform = `translateY(${(-(1 - tOp) * 26).toFixed(1)}px)`; cue.style.opacity = (1 - clamp(u / .25)).toFixed(3);
    title.style.visibility = cue.style.visibility = tOp <= 0 ? 'hidden' : 'visible';
    shots.forEach((s, i) => {
      const start = i === 0 ? .8 : 2.4 + (i - 1) * 1.6, e = ease(clamp((u - start) / 1));
      if (i === 0) {
        const k = 1 - e, rad = 10 * k;
        s.a.style.clipPath = e >= 1 ? 'none' : `inset(${(R.t * k).toFixed(1)}px ${(R.r * k).toFixed(1)}px ${(R.b * k).toFixed(1)}px ${(R.l * k).toFixed(1)}px round ${rad.toFixed(1)}px)`;
        s.a.style.opacity = clamp(e * 4).toFixed(3);
      } else { s.a.style.clipPath = e >= 1 ? 'none' : `inset(${((1 - e) * 100).toFixed(2)}% 0 0 0)`; s.a.style.opacity = '1'; }
      s.a.style.visibility = (i === 0 ? e > 0 : e > 0) ? 'visible' : 'hidden';
      s.img.style.transform = `scale(${(lerp(i === 0 ? 1.35 : 1.25, 1, e)).toFixed(4)})`;
      // Bildschiebung des vorherigen Bildes, wenn das nächste kommt
      const nstart = 2.4 + i * 1.6, ne = i < N - 1 ? ease(clamp((u - nstart) / 1)) : 0;
      s.a.firstChild.style.transform = `translateY(${(-ne * 7).toFixed(2)}%)`;
      s.cap.style.opacity = (clamp((e - .55) / .3) * (1 - clamp(ne / .3))).toFixed(3);
      s.cap.style.transform = `translateY(${((1 - clamp((e - .55) / .3)) * 18).toFixed(1)}px)`;
    });
  };
  addEventListener('resize', () => { R = null; kick(); }, { passive: true });
  track(el.querySelector('.hm__track'), (r) => { apply(trackProgress(r, stage.offsetHeight) * T); });
  apply(0);
  return el;
}
