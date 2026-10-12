// Tilt: Die Karte kippt im Raum auf, folgt auf dem Desktop dem Mauszeiger und hat Glanz.
import { h } from '../core/dom.js';
import { seg, io3, sm, mediaNode, infoNode, ctaNode, idxNode, infoCta } from './shared.js';
import { isFinePointer } from '../core/dom.js';

export default {
  name: 'tilt', label: 'Tilt – 3D-Karte kippt auf, Mauszeiger neigt sie (Desktop)', len: 240, light: true,
  build({ pr, i, n }) {
    return [idxNode(i, n), h('div', { class: 'vt__card' }, h('div', { class: 'vt__tilt' }, mediaNode(pr, i), h('span', { class: 'vt__glare' }))),
      infoNode(pr, { dark: true, cls: 'vt__info' }), ctaNode(pr)];
  },
  init(sc) {
    if (!isFinePointer()) return;
    const st = sc.stage;
    st.addEventListener('pointermove', (e) => {
      const r = st.getBoundingClientRect();
      st.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      st.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
    st.addEventListener('pointerleave', () => { st.style.setProperty('--px', 0); st.style.setProperty('--py', 0); });
  },
  update(sc, p, { vh }) {
    const e = io3(seg(p, 0, .3)), o = sm(seg(p, .78, 1));
    sc.q('.vt__card').style.transform = `translate3d(0,${((1 - e) * vh * .22 - o * vh * .06).toFixed(1)}px,0) rotateX(${((1 - e) * 52 - o * 28).toFixed(2)}deg) rotateY(${((1 - e) * -16).toFixed(2)}deg) scale(${(.84 + .16 * e).toFixed(4)})`;
    infoCta(sc, p, { inA: .3, inB: .42, outA: .84, outB: .94 });
  },
};
