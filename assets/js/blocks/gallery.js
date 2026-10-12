import { h } from '../core/dom.js';
import { carousel3d } from '../core/carousel3d.js';
import { flexCarousel } from '../core/flexCarousel.js';
import { still, clamp } from '../core/scrollhub.js';
import { getLang } from '../core/i18n.js';

// Galerie-Elemente für Projektseiten (und überall sonst): 3D-Karussell, Flex-Karussell, Accordion, Vorher/Nachher.
const ITEM = [
  { name: 'image', label: 'Bild', type: 'image' },
  { name: 'title', label: 'Titel (optional)', type: 'text' },
  { name: 'subtitle', label: 'Untertitel (optional)', type: 'text' },
  { name: 'link', label: 'Link beim Antippen (optional, z. B. ein Projekt-Name)', type: 'text' },
];
const SOURCE = { name: 'source', label: 'Inhalt', type: 'select', options: ['eigene Bilder', 'alle Projekte'], default: 'eigene Bilder' };
const HEIGHT = { name: 'height', label: 'Höhe am PC in px (am Handy passt sie sich an)', type: 'number', default: 560 };

function getItems(p, ctx) {
  if (p.source === 'alle Projekte') {
    const idx = ctx.content.index;
    return (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden)
      .map(x => ({ src: x.image, title: String(x.title || x.slug).replace(/\n/g, ' '), subtitle: x.roles || '', href: x.slug }));
  }
  return (p.items || []).filter(i => i.image).map(i => ({ src: i.image, title: i.title || '', subtitle: i.subtitle || '', href: i.link || '' }));
}
const wrapEl = (cls, p, extra = {}) => {
  const el = h('div', { class: `b-gal ${cls}${p.bg === 'dunkel' ? ' b-gal--dark' : ''}`, style: { '--gh': `${Number(p.height) || 560}px`, ...extra } });
  return el;
};
const goto = (it) => { if (!it.href) return; const a = document.createElement('a'); a.href = it.href; a.setAttribute('data-link', ''); a.hidden = true; document.body.append(a); a.click(); a.remove(); };
// Elemente starten erst, wenn sie im Bild sind (spart Leistung, WebGL braucht eine Größe)
const whenSized = (el, fn) => { const ro = new ResizeObserver(() => { if (el.clientWidth > 10 && el.clientHeight > 10) { ro.disconnect(); fn(); } }); ro.observe(el); };

export const carousel3dBlock = {
  type: 'carousel3d', label: '3D-Karussell (überlappende Karten)',
  fields: [
    SOURCE, { name: 'items', label: 'Bilder', type: 'list', itemFields: ITEM, default: [] }, HEIGHT,
    { name: 'format', label: 'Kartenformat', type: 'select', options: ['automatisch', 'hochkant', 'quer'], default: 'automatisch' },
    { name: 'speed', label: 'Drehgeschwindigkeit (0 = steht)', type: 'number', default: 14 },
  ],
  render(p0, ctx) {
    const p = { source: 'eigene Bilder', height: 560, format: 'automatisch', speed: 14, ...p0 };
    const items = getItems(p, ctx); const el = wrapEl('b-gal--3d', p);
    if (items.length < 3) { el.append(h('p', { class: 'b-gal__empty' }, 'Mindestens 3 Bilder hinzufügen.')); return el; }
    const tall = (r) => p.format === 'hochkant' || (p.format !== 'quer' && r.width < 700);
    whenSized(el, () => carousel3d(el, items, { speed: still() ? 0 : Number(p.speed) || 0, reduced: still(), onFront: goto, fitAngle: 100, light: matchMedia('(max-width: 899px)').matches,
      size: (r) => tall(r) ? { w: Math.min(r.width * .6, r.height * .8 * .5625), aspect: .5625 } : { w: Math.min(r.width * .6, r.height * .8 * 16 / 9), aspect: 16 / 9 } }));
    return el;
  },
};

export const flexBlock = {
  type: 'flexCarousel', label: 'Flex-Karussell (Bilderreihe mit Knick, WebGL)',
  fields: [
    SOURCE, { name: 'items', label: 'Bilder', type: 'list', itemFields: ITEM, default: [] }, HEIGHT,
    { name: 'preset', label: 'Form der Linse', type: 'select', options: ['liquid', 'ribbon', 'vortex', 'arch'], default: 'liquid' },
    { name: 'fit', label: 'Kartenform', type: 'select', options: ['natural', 'portrait', 'square', 'landscape'], default: 'landscape' },
    { name: 'captions', label: 'Titel und Zähler zeigen', type: 'checkbox', default: true },
    { name: 'autoplay', label: 'Automatisch weiterblättern', type: 'checkbox', default: false },
  ],
  render(p0, ctx) {
    const p = { source: 'eigene Bilder', height: 560, preset: 'liquid', fit: 'landscape', captions: true, autoplay: false, ...p0 };
    const items = getItems(p, ctx); const el = wrapEl('b-gal--flex', p);
    if (items.length < 2) { el.append(h('p', { class: 'b-gal__empty' }, 'Mindestens 2 Bilder hinzufügen.')); return el; }
    whenSized(el, () => {
      const narrow = el.clientWidth < 700;
      const c = flexCarousel(el, items, { preset: p.preset, fit: narrow && p.fit === 'landscape' ? 'portrait' : p.fit, cardHeight: narrow ? .62 : .66, gap: narrow ? 10 : 14, radius: 10, captions: !!p.captions, autoplay: !!p.autoplay, onSelect: goto });
      if (!c) { el.classList.add('is-nogl'); items.forEach(i => el.append(h('img', { src: i.src, alt: i.title || '', loading: 'lazy' }))); }
    });
    return el;
  },
};

export const accordionBlock = {
  type: 'accordion', label: 'Accordion-Galerie (Bilder klappen auf)',
  fields: [
    SOURCE, { name: 'items', label: 'Bilder', type: 'list', itemFields: ITEM, default: [] },
    { name: 'height', label: 'Höhe in px', type: 'number', default: 460 },
    { name: 'open', label: 'Zuerst geöffnetes Bild (Nummer, 1 = erstes)', type: 'number', default: 3 },
    { name: 'trigger', label: 'Öffnen bei', type: 'select', options: ['hover', 'click'], default: 'hover' },
    { name: 'grayscale', label: 'Geschlossene Bilder in Schwarz-Weiß', type: 'checkbox', default: true },
    { name: 'tilt', label: 'Kippwinkel der geschlossenen Bilder (Grad)', type: 'number', default: 8 },
  ],
  render(p0, ctx) {
    const p = { source: 'eigene Bilder', height: 460, open: 3, trigger: 'hover', grayscale: true, tilt: 8, ...p0 };
    const items = getItems(p, ctx); const n = items.length;
    const el = h('div', { class: 'ag', role: 'list' });
    if (n < 2) { el.append(h('p', { class: 'b-gal__empty' }, 'Mindestens 2 Bilder hinzufügen.')); return el; }
    let active = clamp(Math.round(Number(p.open) || 1) - 1, 0, n - 1);
    const panels = items.map((it, i) => {
      const img = h('img', { src: it.src, alt: it.title || '', draggable: 'false', loading: 'lazy' });
      const media = h('span', { class: 'ag__media' }, img);
      const label = h('span', { class: 'ag__label', 'aria-hidden': 'true' }, h('span', { class: 'ag__bar' }), h('span', { class: 'ag__text' }, it.title || '', it.subtitle ? h('em', {}, it.subtitle) : null));
      const a = h(it.href ? 'a' : 'div', { class: 'ag__panel', role: 'listitem', tabindex: '0', 'aria-label': it.title || '', ...(it.href ? { href: it.href, 'data-link': '' } : {}) }, h('span', { class: 'ag__frame' }, media, h('span', { class: 'ag__overlay' })), label);
      a.addEventListener('pointerenter', (e) => { if (p.trigger === 'hover' && e.pointerType === 'mouse') set(i); });
      a.addEventListener('focus', () => set(i));
      a.addEventListener('click', (e) => { if (i !== active) { e.preventDefault(); set(i); } else if (!it.href) e.preventDefault(); });
      a.addEventListener('keydown', (e) => { const k = e.key; if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); set((i + 1) % n, true); } else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); set((i - 1 + n) % n, true); } });
      return { a, media };
    });
    el.append(...panels.map(x => x.a));
    const R = .52, grow = (R * (n - 1)) / (1 - R);
    const layout = () => {
      const vertical = el.clientWidth < 520; el.classList.toggle('ag--v', vertical);
      el.style.height = (vertical ? Math.round(Math.max(Number(p.height) || 460, 120 * n)) : Number(p.height) || 460) + 'px';
      const total = vertical ? el.clientHeight : el.clientWidth, size = Math.max(140, (total - 10 * (n - 1)) * R * 1.22);
      el.style.setProperty('--ag-size', size + 'px');
      panels.forEach(({ a, media }, i) => {
        const on = i === active, rot = on ? 0 : i < active ? p.tilt : -p.tilt, shift = clamp(active - i, -1.5, 1.5) * .5 * size * .06;
        a.style.flexGrow = on ? grow : 1; a.classList.toggle('is-on', on);
        a.style.transform = vertical || still() ? '' : (`rotate${vertical ? 'X' : 'Y'}(${vertical ? -rot : rot}deg)`);
        media.style.setProperty('--sx', (on ? 0 : shift).toFixed(1) + 'px');
        media.style.setProperty('--gray', p.grayscale ? (on ? 0 : 1) : 0); media.style.setProperty('--dim', on ? 0 : .35);
      });
    };
    function set(i) { if (i === active) return; active = i; layout(); }
    new ResizeObserver(layout).observe(el); layout();
    return el;
  },
};

export const compareBlock = {
  type: 'compare', label: 'Vorher / Nachher (z. B. Color Grading)',
  fields: [
    { name: 'before', label: 'Vorher-Bild', type: 'image', default: '' },
    { name: 'after', label: 'Nachher-Bild', type: 'image', default: '' },
    { name: 'labelBefore', label: 'Beschriftung links', type: 'text', default: 'before', de: 'Vorher' },
    { name: 'labelAfter', label: 'Beschriftung rechts', type: 'text', default: 'after', de: 'Nachher' },
    { name: 'ratio', label: 'Seitenverhältnis (z. B. 16/9)', type: 'text', default: '16/9' },
    { name: 'start', label: 'Startposition in % (0–100)', type: 'number', default: 50 },
    { name: 'orientation', label: 'Trennlinie', type: 'select', options: ['senkrecht', 'waagerecht'], default: 'senkrecht' },
    { name: 'radius', label: 'Rundung', type: 'select', options: ['sm', 'xl', 'none'], default: 'sm' },
    { name: 'caption', label: 'Bildunterschrift (optional)', type: 'text', default: '' },
  ],
  render(p0) {
    const p = { labelBefore: 'before', labelAfter: 'after', ratio: '16/9', start: 50, orientation: 'senkrecht', radius: 'sm', ...p0 };
    const vertical = p.orientation === 'waagerecht';
    const el = h('figure', { class: `cmp cmp--${p.radius} ${vertical ? 'cmp--h' : ''}`, style: { aspectRatio: p.ratio || '16/9' } });
    if (!p.before || !p.after) { el.append(h('p', { class: 'b-gal__empty' }, 'Vorher- und Nachher-Bild auswählen.')); return el; }
    const handle = h('button', { class: 'cmp__handle', type: 'button', role: 'slider', 'aria-label': `${p.labelBefore} / ${p.labelAfter}`, 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', {}));
    el.append(h('img', { class: 'cmp__img', src: p.after, alt: p.labelAfter, draggable: 'false' }),
      h('div', { class: 'cmp__before' }, h('img', { class: 'cmp__img', src: p.before, alt: p.labelBefore, draggable: 'false' })),
      h('span', { class: 'cmp__tag cmp__tag--a' }, p.labelBefore), h('span', { class: 'cmp__tag cmp__tag--b' }, p.labelAfter), handle,
      p.caption ? h('figcaption', { class: 'cmp__cap' }, p.caption) : null);
    let v = clamp(Number(p.start) / 100 || .5), drag = false;
    const apply = () => { el.style.setProperty('--v', (v * 100).toFixed(2) + '%'); handle.setAttribute('aria-valuenow', String(Math.round(v * 100))); };
    const at = (e) => { const r = el.getBoundingClientRect(); v = clamp(vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width, .0, 1); apply(); };
    el.addEventListener('pointerdown', (e) => { if (e.button) return; drag = true; el.classList.add('is-drag'); try { el.setPointerCapture(e.pointerId); } catch { /* egal */ } at(e); });
    el.addEventListener('pointermove', (e) => { if (drag) at(e); });
    const end = () => { drag = false; el.classList.remove('is-drag'); }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => { const d = { ArrowLeft: -.04, ArrowDown: -.04, ArrowRight: .04, ArrowUp: .04 }[e.key]; if (d) { e.preventDefault(); v = clamp(v + d); apply(); } });
    apply();
    return el;
  },
};
// Hintergrund: weiß (Standard) oder dunkel
const BG = { name: 'bg', label: 'Hintergrund', type: 'select', options: ['weiß', 'dunkel'], default: 'weiß' };
for (const b of [carousel3dBlock, flexBlock, accordionBlock, compareBlock]) if (!b.fields.some(f => f.name === 'bg')) b.fields.push(BG);
export default [carousel3dBlock, flexBlock, accordionBlock, compareBlock];
