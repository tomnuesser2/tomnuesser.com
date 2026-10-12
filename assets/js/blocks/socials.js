import { h, svg } from '../core/dom.js';

export const ICONS = {
  youtube: '<svg viewBox="0 0 24 24"><path d="M21.6 3H2.4A2.4 2.4 0 0 0 0 5.4v13.2A2.4 2.4 0 0 0 2.4 21h19.2a2.4 2.4 0 0 0 2.4-2.4V5.4A2.4 2.4 0 0 0 21.6 3zM9.75 16.1V7.9L16.9 12z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><path d="M7 1h10a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6zm0 2.2A3.8 3.8 0 0 0 3.2 7v10A3.8 3.8 0 0 0 7 20.8h10a3.8 3.8 0 0 0 3.8-3.8V7A3.8 3.8 0 0 0 17 3.2zM12 6.6a5.4 5.4 0 1 1 0 10.8 5.4 5.4 0 0 1 0-10.8zm0 2.2a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.6-3.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24"><path d="M2 2h20a0 0 0 0 1 0 0v20a0 0 0 0 1 0 0H2a0 0 0 0 1 0 0V2zm3.3 8.2V19h2.9v-8.8zM6.75 5.6a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM10.4 10.2V19h2.9v-4.6c0-1.2.5-2 1.6-2s1.4.8 1.4 2V19h2.9v-5.2c0-2.5-1.3-3.8-3.2-3.8-1.4 0-2.2.8-2.6 1.4v-1.2z"/></svg>',
  vimeo: '<svg viewBox="0 0 24 24"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197a315.065 315.065 0 003.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797z"/></svg>',
};

export default {
  type: 'socials',
  label: 'Social-Icons',
  fields: [{ name: 'note', label: 'Links pflegst du unter „Einstellungen“ (socials).', type: 'info' }],
  render(p, ctx) {
    const wrap = h('div', { class: 'b-socials', 'data-reveal': 'up' });
    for (const s of ctx.site.socials || []) {
      const icon = ICONS[s.icon] || ICONS[String(s.label || '').toLowerCase()];
      if (!icon) continue;
      wrap.append(h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': s.label || s.icon, 'data-magnetic': '1' }, svg(icon)));
    }
    return wrap;
  },
};
