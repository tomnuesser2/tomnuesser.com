import { isFinePointer } from '../core/dom.js';
import { scramble } from '../core/scramble.js';

export default {
  name: 'scramble',
  init() {
    // Hover (Desktop) und Antippen (Handy) lassen Text kurz „entschlüsseln“.
    const trigger = (e) => {
      const el = e.target.closest?.('[data-scramble]:not([data-scramble="scene"]):not([data-scramble="load"])');
      if (!el || (e.type === 'pointerover' && el.contains(e.relatedTarget))) return;
      scramble(el, { duration: 450 });
    };
    if (isFinePointer()) document.addEventListener('pointerover', trigger);
    else document.addEventListener('pointerdown', trigger, { passive: true });
    return true;
  },
  onPage(root) {
    root.querySelectorAll('[data-scramble="load"]').forEach((el, i) => scramble(el, { duration: 900 + i * 300, delay: 200 + i * 250 }));
  },
};
