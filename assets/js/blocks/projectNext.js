import { h } from '../core/dom.js';
// Projektseite: Link zum nächsten Projekt (aus der Projektliste).
export default {
  type: 'projectNext', label: 'Nächstes Projekt (automatisch)',
  fields: [{ name: 'label', label: 'Beschriftung', type: 'text', default: 'next project', de: 'nächstes Projekt' }],
  render(p, ctx) {
    const idx = ctx.content.index, list = (idx.order || []).filter(s => idx.projects[s] && !idx.projects[s].hidden);
    const i = list.indexOf(ctx.route); const next = list[(i + 1) % list.length]; if (!next || next === ctx.route) return null;
    const pr = idx.projects[next];
    return h('a', { class: 'pn', href: next, 'data-link': '' }, h('span', { class: 'pn__k' }, p.label || 'next project'), h('span', { class: 'pn__t' }, pr.title, ' ↗'), pr.image ? h('img', { class: 'pn__i', src: pr.image, alt: '', loading: 'lazy' }) : null);
  },
};
