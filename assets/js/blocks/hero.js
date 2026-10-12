import { h } from '../core/dom.js';
import { track, still, clamp } from '../core/scrollhub.js';
import { isFinePointer } from '../core/dom.js';
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
  ],
  render(p0, ctx) {
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
