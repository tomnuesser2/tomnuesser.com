import { h } from '../core/dom.js';
// Services: drei bis fünf Zeilen "Was ich mache" – ruhig, nummeriert, mit Linie.
export default {
  type: 'services', label: 'Leistungen (Zeilen)',
  fields: [{ name: 'numbers', label: 'Nummern anzeigen', type: 'checkbox', default: false }, { name: 'items', label: 'Zeilen', type: 'list', itemFields: [
    { name: 'title', label: 'Titel', type: 'text' }, { name: 'text', label: 'Text', type: 'textarea' }, { name: 'tags', label: 'Stichworte (Komma)', type: 'text' }] }],
  render(p) {
    const rows = (p.items || []).map((it, i) => h('div', { class: 'b-svc__row', 'data-reveal': 'up' },
      p.numbers ? h('span', { class: 'b-svc__n' }, String(i + 1).padStart(2, '0')) : null,
      h('h3', { class: 'b-svc__t' }, it.title || ''),
      h('div', { class: 'b-svc__d' }, h('p', {}, it.text || ''), it.tags ? h('p', { class: 'b-svc__tags' }, String(it.tags).split(',').map(t => h('span', {}, t.trim()))) : null)));
    return h('section', { class: `b-svc container${p.numbers ? '' : ' no-n'}`, id: p.id }, rows);
  },
};
