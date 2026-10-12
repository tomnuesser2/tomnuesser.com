import { h, paragraphs } from '../core/dom.js';

export default {
  type: 'text',
  label: 'Textabschnitt',
  fields: [
    { name: 'text', label: 'Text (Leerzeile = neuer Absatz)', type: 'textarea', default: '' },
    { name: 'align', label: 'Ausrichtung', type: 'select', options: ['left', 'center'], default: 'left' },
  ],
  render(p) {
    const wrap = h('div', { class: `b-text container align-${p.align || 'left'}` });
    const inner = h('div', { class: 'b-text-narrow', 'data-reveal': 'up' });
    for (const para of paragraphs(p.text)) inner.append(h('p', {}, para));
    wrap.append(inner);
    return wrap;
  },
};
