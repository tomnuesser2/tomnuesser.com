import { h } from '../core/dom.js';
import { track, still, clamp } from '../core/scrollhub.js';
// Statement: Der Text füllt sich beim Scrollen Wort für Wort schwarz – führt die Besucher*innen durch die Aussage.
export default {
  type: 'statement', label: 'Statement (Text füllt sich beim Scrollen)',
  fields: [
    { name: 'kicker', label: 'Kleine Zeile darüber (optional)', type: 'text', default: '' },
    { name: 'text', label: 'Text', type: 'textarea', default: '' },
    { name: 'size', label: 'Größe', type: 'select', options: ['s', 'm', 'l'], default: 'm' },
  ],
  render(p) {
    const words = String(p.text || '').split(/\s+/).filter(Boolean);
    const para = h('p', { class: `b-statement__t is-${p.size || 'm'}` }, words.map(w => h('span', {}, w + ' ')));
    const el = h('section', { class: 'b-statement container', id: p.id }, p.kicker ? h('p', { class: 'b-statement__k', 'data-reveal': 'up' }, p.kicker) : null, para);
    if (still()) { el.classList.add('is-still'); return el; }
    const spans = [...para.children];
    track(el, (r, vh) => {
      const f = clamp((vh * .86 - r.top) / (vh * .5 + r.height * .5)) * (spans.length + 3);
      spans.forEach((s, i) => { s.style.opacity = (.13 + .87 * clamp(f - i)).toFixed(2); });
    });
    return el;
  },
};
