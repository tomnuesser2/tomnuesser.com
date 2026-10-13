// Gemeinsame Helfer für alle Scroll-Szenen-Varianten.
import { h } from '../core/dom.js';
import { imgFor, parseVimeo, parseYouTube, vimeoThumb } from '../core/media.js';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const sm = (t) => t * t * (3 - 2 * t);
export const io3 = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const eo3 = (t) => 1 - Math.pow(1 - t, 3);
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const pad = (n) => String(n).padStart(2, '0');
export const ratioNum = (r = '16/9') => { const [a, b] = String(r).split('/').map(Number); return a && b ? a / b : 16 / 9; };
export const rolesOf = (pr) => String(pr.roles || '').split(',').map(s => s.trim()).filter(Boolean);
export const stillsOf = (pr) => [...new Set([imgFor(pr), ...(pr.stills || [])].filter(Boolean))];
export const setVars = (el, o) => { for (const k in o) el.style.setProperty(k, String(o[k])); };

export function mediaNode(pr, i, cls = 'scene__media') {
  const media = h('div', { class: cls });
  const setImg = (src) => media.replaceChildren(h('img', { src, alt: '', decoding: 'async', loading: i < 2 ? 'eager' : 'lazy' }));
  if (pr.image) setImg(imgFor(pr));
  else {
    media.append(h('div', { class: 'ph', style: { '--h1': (i * 67) % 360, '--h2': (i * 67 + 70) % 360 } }));
    const yy = parseYouTube(pr.vimeo), v = yy ? { id: yy.id, yt: true } : parseVimeo(pr.vimeo); if (v) vimeoThumb(v).then(t => { if (t) setImg(t); });
  }
  return media;
}
export const shadeNode = () => h('span', { class: 'scene__shade' });
export const idxNode = (i, n, extra = '') => h('span', { class: `scene__idx scene__idx--g ${extra}` }, `${pad(i + 1)}/${pad(n)}`);
export function infoNode(pr, { dark = false, title = true, summary = true, cls = '' } = {}) {
  const roles = rolesOf(pr);
  return h('div', { class: `scene__info ${dark ? 'scene__info--dark' : ''} ${cls}` },
    title ? h('h2', { class: 'scene__title' }, pr.title || pr.slug) : null,
    roles.length ? h('p', { class: 'scene__roles' }, roles.map(r => h('span', {}, r))) : null,
    summary && pr.summary ? h('p', { class: 'scene__sum' }, pr.summary) : null);
}
export const ctaNode = (pr) => h('a', { class: 'scene__cta', href: pr.slug, 'data-link': '', 'data-magnetic': '1' }, 'open project ↗');
// Blendet Info (--i) und Button (--c) anhand von Scroll-Fortschritt ein/aus.
export function infoCta(sc, p, { inA = .3, inB = .42, outA = .85, outB = .95, cA = inA, cB = inB } = {}) {
  const i = sm(seg(p, inA, inB)) * (1 - sm(seg(p, outA, outB)));
  const c = sm(seg(p, cA, cB)) * (1 - sm(seg(p, .97, 1)));
  setVars(sc.stage, { '--i': i.toFixed(3), '--c': c.toFixed(3) });
  const cta = sc.q('.scene__cta'); if (cta) cta.style.pointerEvents = c > .6 ? 'auto' : 'none';
}
