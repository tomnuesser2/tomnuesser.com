// Karte klappt zum Vollbild auf → Infos → Stills-Filmstreifen (Signature-Szene).
import { h } from '../core/dom.js';
import { hudEl } from '../core/hud.js';
import { clamp, sm, io3, setVars, mediaNode, shadeNode, infoNode, ctaNode, stillsOf, pad } from './shared.js';

export default {
  name: 'expand', label: 'Expand – Karte klappt zum Vollbild auf, danach Stills-Streifen', len: 280,
  build({ pr, i, n }) {
    const stills = (pr.stills || []).filter(Boolean);
    const frame = h('a', { class: 'scene__frame', href: pr.slug, 'data-link': '', 'data-cursor': 'view', 'aria-label': pr.title || pr.slug },
      mediaNode(pr, i), shadeNode(), hudEl({ side: pr.cam || '' }), h('span', { class: 'scene__idx' }, `${pad(i + 1)}/${pad(n)}`));
    const strip = stills.length ? h('div', { class: 'scene__strip', 'aria-hidden': 'true' },
      stills.map((s, k) => h('img', { src: s, alt: '', loading: 'lazy', decoding: 'async', class: k % 2 ? 'is-b' : '' }))) : null;
    return [frame, infoNode(pr), strip, ctaNode(pr)];
  },
  update(sc, p, { vw }) {
    const e = io3(clamp(p / 0.2));
    const info = sm(clamp((p - 0.17) / 0.12)) * (1 - sm(clamp((p - 0.5) / 0.1)));
    const strip = clamp((p - 0.66) / 0.32);
    const cta = sm(clamp((p - 0.28) / 0.08)) * (1 - sm(clamp((p - 0.97) / 0.03)));
    setVars(sc.stage, { '--e': e.toFixed(4), '--p': p.toFixed(4), '--i': info.toFixed(3),
      '--d': clamp(0.08 + 0.34 * e + 0.3 * sm(strip * 3)).toFixed(3), '--z': (1 + 0.12 * p).toFixed(4), '--c': cta.toFixed(3) });
    const s = sc.q('.scene__strip');
    if (s) {
      const w = s.scrollWidth;
      const x = (1 - sm(clamp(strip * 1.15))) * vw * 0.95 - clamp(strip) * Math.max(0, w - vw * 0.55) * 0.9;
      s.style.transform = `translate3d(${x.toFixed(1)}px, -50%, 0)`;
      s.style.opacity = String(sm(clamp(strip * 6)) * (1 - sm(clamp((p - 0.97) / 0.03))));
    }
    const cc = sc.q('.scene__cta'); cc.style.pointerEvents = cta > 0.6 ? 'auto' : 'none';
  },
};
