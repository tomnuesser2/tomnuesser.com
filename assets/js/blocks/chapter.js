import { h } from '../core/dom.js';
// Kapitel-Marke: gibt der Seite einen roten Faden (Nummer · Name · Linie). Die Leiste unten zeigt das aktuelle Kapitel.
export default {
  type: 'chapter', label: 'Kapitel-Marke',
  fields: [
    { name: 'num', label: 'Nummer (z. B. 01)', type: 'text', default: '01' },
    { name: 'label', label: 'Name (z. B. work)', type: 'text', default: 'work' },
    { name: 'note', label: 'Kleiner Zusatz rechts (optional)', type: 'text', default: '' },
  ],
  render(p) {
    return h('div', { class: 'b-chapter', id: p.id, 'data-chapter': p.label || '', 'data-num': p.num || '' },
      h('span', { class: 'b-chapter__n' }, p.num), h('span', { class: 'b-chapter__l' }, p.label), h('i', { class: 'b-chapter__line' }), p.note ? h('span', { class: 'b-chapter__r' }, p.note) : null);
  },
};
