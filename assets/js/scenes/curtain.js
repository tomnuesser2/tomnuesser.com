// Vorhang: Der Titel steht auf zwei Hälften, die auseinanderfahren und das Bild freigeben.
import { h } from '../core/dom.js';
import { seg, io3, sm, setVars, mediaNode, shadeNode, infoNode, ctaNode, idxNode, infoCta } from './shared.js';

export default {
  name: 'curtain', label: 'Curtain – Titel teilt sich, Vorhang öffnet das Bild', len: 220,
  build({ pr, i, n }) {
    const half = (s) => h('div', { class: `vc__p vc__p--${s}` }, h('span', { class: 'vc__t' }, pr.title || pr.slug));
    return [h('div', { class: 'vc__media' }, mediaNode(pr, i)), shadeNode(), half('l'), half('r'), idxNode(i, n), infoNode(pr), ctaNode(pr)];
  },
  update(sc, p) {
    const o = io3(seg(p, .06, .34));
    sc.q('.vc__p--l').style.transform = `translate3d(${(-o * 101).toFixed(2)}%,0,0)`;
    sc.q('.vc__p--r').style.transform = `translate3d(${(o * 101).toFixed(2)}%,0,0)`;
    sc.q('.vc__media').style.transform = `scale(${(1.22 - .22 * o + .05 * p).toFixed(4)})`;
    setVars(sc.stage, { '--d': (.05 + .35 * seg(p, .34, .5)).toFixed(3) });
    infoCta(sc, p, { inA: .4, inB: .52, outA: .84, outB: .94, cA: .5, cB: .6 });
  },
};
