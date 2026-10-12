// Pullback: Dolly-Zoom – das Bild zieht aus einer Großaufnahme zurück, Letterbox-Balken öffnen sich.
import { h } from '../core/dom.js';
import { seg, io3, eo3, sm, setVars, mediaNode, shadeNode, infoNode, ctaNode, idxNode, infoCta } from './shared.js';

export default {
  name: 'pullback', label: 'Pullback – Zoom-out aus der Großaufnahme mit Letterbox', len: 240,
  build({ pr, i, n }) {
    return [h('div', { class: 'vz__media' }, mediaNode(pr, i)), shadeNode(), h('i', { class: 'vz__bar vz__bar--t' }), h('i', { class: 'vz__bar vz__bar--b' }),
      idxNode(i, n), infoNode(pr), ctaNode(pr)];
  },
  update(sc, p) {
    const s = 2.3 - 1.3 * eo3(seg(p, 0, .38)) + .1 * seg(p, .38, 1);
    sc.q('.vz__media').style.transform = `scale(${s.toFixed(4)})`;
    const bars = (1 - io3(seg(p, .04, .4))) * 24 + sm(seg(p, .88, 1)) * 9;
    setVars(sc.stage, { '--bar': `${bars.toFixed(2)}svh`, '--d': (.05 + .3 * seg(p, .3, .5)).toFixed(3) });
    infoCta(sc, p, { inA: .36, inB: .48, outA: .84, outB: .93, cA: .44, cB: .54 });
  },
};
