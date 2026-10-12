import { h } from '../core/dom.js';
// Projektseite: großer Titel, Metazeile (Rolle · Ort · Jahr · Kamera) und Zurück-Link.
export default {
  type: 'projectHead', label: 'Projekt-Kopf (Titel + Eckdaten)',
  fields: [
    { name: 'back', label: 'Text „zurück“-Link', type: 'text', default: '← all projects' },
    { name: 'title', label: 'Titel', type: 'textarea', default: '' },
    { name: 'meta', label: 'Eckdaten (eine pro Zeile, Format „Rolle: Wert“)', type: 'textarea', default: 'Role: Videography\nPlace: Flensburg\nYear: 2026' },
  ],
  render(p) {
    const meta = String(p.meta || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i), l.slice(i + 1).trim()] : ['', l]; });
    return h('header', { class: 'ph', id: p.id },
      h('a', { class: 'ph__back', href: 'home#video', 'data-link': '' }, p.back || '← all projects'),
      h('h1', { class: 'ph__t' }, String(p.title || '').split('\n').map(t => h('span', {}, t))),
      meta.length ? h('dl', { class: 'ph__meta' }, meta.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))) : null);
  },
};
