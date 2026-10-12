// Stack: Die Karte fährt von unten ein und sinkt am Ende wie ein Stapel-Blatt zurück.
import { h } from '../core/dom.js';
import { seg, io3, sm, setVars, mediaNode, shadeNode, infoNode, ctaNode, idxNode, infoCta } from './shared.js';

export default {
  name: 'stack', label: 'Stack – Karte fährt ein und sinkt wie ein Kartenstapel zurück', len: 240,
  build({ pr, i, n }) {
    return [idxNode(i, n), h('div', { class: 'vs__card' }, mediaNode(pr, i), shadeNode(), infoNode(pr), ctaNode(pr))];
  },
  update(sc, p, { vh }) {
    const e = io3(seg(p, 0, .26)), o = sm(seg(p, .74, 1));
    const card = sc.q('.vs__card');
    card.style.transform = `translate3d(0,${((1 - e) * vh * .75 - o * vh * .03).toFixed(1)}px,0) rotate(${((1 - e) * 2.5).toFixed(2)}deg) scale(${(1 - .1 * o).toFixed(4)})`;
    card.style.borderRadius = `${(18 + 16 * o).toFixed(1)}px`;
    sc.q('.scene__media').style.transform = `scale(${(1.14 - .08 * e).toFixed(4)})`;
    setVars(sc.stage, { '--d': (.12 + .5 * o + .12 * e).toFixed(3) });
    infoCta(sc, p, { inA: .24, inB: .36, outA: .7, outB: .8, cA: .3, cB: .4 });
  },
};
