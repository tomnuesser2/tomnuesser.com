import { h } from '../core/dom.js';

export default {
  type: 'spacer',
  label: 'Abstand',
  fields: [{ name: 'size', label: 'Höhe (px)', type: 'number', default: 48 }],
  render: (p) => h('div', { class: 'b-spacer', style: { '--h': `${Number(p.size ?? 48)}px` }, 'aria-hidden': 'true' }),
};
