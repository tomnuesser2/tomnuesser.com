import { h, paragraphs } from '../core/dom.js';
// Projektseite: Textabschnitt – links die Überschrift, rechts der Text (Handy: untereinander).
export default {
  type: 'projectText', label: 'Projekt-Textabschnitt',
  fields: [
    { name: 'heading', label: 'Überschrift', type: 'text', default: '' },
    { name: 'text', label: 'Text (Leerzeile = neuer Absatz)', type: 'textarea', default: '' },
  ],
  render(p) {
    return h('section', { class: 'pt', id: p.id, 'data-reveal': 'up' }, h('h2', { class: 'pt__h' }, p.heading || ''), h('div', { class: 'pt__b' }, paragraphs(p.text).map(t => h('p', {}, t))));
  },
};
