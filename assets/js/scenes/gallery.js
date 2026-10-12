// Gallery: Das Bild und die Stills laufen als horizontale Reihe durchs Bild, während man nach unten scrollt.
import { h } from '../core/dom.js';
import { seg, sm, setVars, infoNode, ctaNode, idxNode, stillsOf, infoCta } from './shared.js';

export default {
  name: 'gallery', label: 'Gallery – horizontaler Bilderlauf beim Scrollen', len: 320, light: true,
  build({ pr, i, n }) {
    const imgs = stillsOf(pr);
    return [idxNode(i, n), h('div', { class: 'vg__row' }, imgs.map(s => h('img', { src: s, alt: '', decoding: 'async', loading: 'eager' }))),
      infoNode(pr, { dark: true, summary: false, cls: 'vg__info' }), ctaNode(pr)];
  },
  update(sc, p, { vw }) {
    const row = sc.q('.vg__row');
    const w = row.scrollWidth, e = seg(p, .06, .94);
    const x = vw * .08 - e * Math.max(0, w - vw * .84);
    row.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    row.style.opacity = String(sm(seg(p, 0, .08)));
    infoCta(sc, p, { inA: .03, inB: .12, outA: .92, outB: .98, cA: .1, cB: .2 });
  },
};
