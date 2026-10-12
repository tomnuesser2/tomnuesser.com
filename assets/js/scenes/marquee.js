// Marquee: Zeilen mit dem Projektnamen laufen quer zum Scroll, die Karte schiebt sich davor.
import { h } from '../core/dom.js';
import { seg, io3, sm, setVars, mediaNode, infoNode, ctaNode, idxNode, infoCta } from './shared.js';

export default {
  name: 'marquee', label: 'Marquee – Namens-Laufband hinter einer aufsteigenden Karte', len: 260, light: true,
  build({ pr, i, n }) {
    const t = pr.title || pr.slug;
    const row = (cls) => h('div', { class: `vm__row ${cls}` }, h('div', { class: 'vm__track' }, Array.from({ length: 6 }, () => h('span', {}, t + ' — '))));
    return [idxNode(i, n), row('vm__row--a'), row('vm__row--b'),
      h('div', { class: 'vm__card' }, mediaNode(pr, i)), infoNode(pr, { dark: true, cls: 'vm__info' }), ctaNode(pr)];
  },
  update(sc, p, { vh }) {
    const e = io3(seg(p, 0, .24));
    sc.q('.vm__row--a .vm__track').style.transform = `translate3d(${(-p * 38).toFixed(2)}%,0,0)`;
    sc.q('.vm__row--b .vm__track').style.transform = `translate3d(${(-50 + p * 38).toFixed(2)}%,0,0)`;
    const card = sc.q('.vm__card');
    card.style.transform = `translate3d(0,${((1 - e) * vh * .4 - sm(seg(p, .8, 1)) * vh * .12).toFixed(1)}px,0) scale(${(.88 + .12 * e).toFixed(4)})`;
    card.firstChild.style.transform = `scale(1.16) translate3d(0,${((p - .5) * -7).toFixed(2)}%,0)`;
    infoCta(sc, p, { inA: .26, inB: .38, outA: .86, outB: .95 });
  },
};
