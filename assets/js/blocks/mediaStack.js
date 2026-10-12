import { h } from '../core/dom.js';
import { mediaEl } from '../core/media.js';
import { mediaFields } from './media.js';

export default {
  type: 'mediaStack',
  label: 'Bildstapel',
  fields: [{ name: 'items', label: 'Bilder / Videos', type: 'list', itemFields: mediaFields, default: [] }],
  render(p) {
    const stack = h('div', { class: 'b-stack' });
    for (const it of p.items || []) stack.append(mediaEl(it));
    return h('div', { class: 'b-stack-wrap' }, stack);
  },
};
