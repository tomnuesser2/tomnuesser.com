import { h } from '../core/dom.js';

export default {
  type: 'heading',
  label: 'Überschrift',
  fields: [
    { name: 'text', label: 'Text', type: 'text', default: 'Überschrift' },
    { name: 'level', label: 'Ebene', type: 'select', options: ['1', '2', '3'], default: '2' },
    { name: 'align', label: 'Ausrichtung', type: 'select', options: ['left', 'center'], default: 'left' },
    { name: 'bold', label: 'Fett', type: 'checkbox', default: true },
  ],
  render(p) {
    const lvl = ['1', '2', '3'].includes(String(p.level)) ? p.level : '2';
    const wrap = h('div', { class: `b-heading container align-${p.align || 'left'}${p.bold ? ' is-bold' : ''}` });
    wrap.append(h(`h${lvl}`, { 'data-split': '1' }, p.text || ''));
    return wrap;
  },
};
