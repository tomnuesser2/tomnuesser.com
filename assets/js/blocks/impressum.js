import { h, paragraphs } from '../core/dom.js';

export default {
  type: 'impressum',
  label: 'Impressum',
  fields: [
    { name: 'title', label: 'Titel', type: 'text', default: 'Impressum' },
    { name: 'text', label: 'Text (Leerzeile = neuer Absatz, einfacher Umbruch bleibt erhalten)', type: 'textarea', default: '' },
  ],
  render(p) {
    const wrap = h('section', { class: 'b-imp', id: p.id });
    wrap.append(h('h2', { 'data-split': '1' }, p.title || 'Impressum'));
    const body = h('div', { 'data-reveal': 'up' });
    for (const para of paragraphs(p.text)) body.append(h('p', {}, para));
    wrap.append(body);
    return wrap;
  },
};
