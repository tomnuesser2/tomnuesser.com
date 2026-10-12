// Pixel: Das Bild löst sich aus grobem Mosaik scharf auf (Canvas-Pixelierung, Stufen wie ein Retro-Decoder).
import { h } from '../core/dom.js';
import { seg, setVars, mediaNode, shadeNode, infoNode, ctaNode, idxNode, infoCta } from './shared.js';

const STEPS = [10, 18, 32, 60, 110, 200];       // Anzahl Blöcke über die Breite
function draw(sc, level) {
  const cv = sc.q('.vp__cv'), img = sc.q('.scene__media img');
  if (!cv || !img || !img.complete || !img.naturalWidth) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.max(1, Math.round(cv.clientWidth * dpr)), H = Math.max(1, Math.round(cv.clientHeight * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; sc.lvl = -1; }
  if (sc.lvl === level) return; sc.lvl = level;
  const cols = STEPS[level], rows = Math.max(1, Math.round(cols * H / W));
  const small = sc.small || (sc.small = document.createElement('canvas')); small.width = cols; small.height = rows;
  const sx = small.getContext('2d'); sx.imageSmoothingEnabled = true;
  const k = Math.max(cols / img.naturalWidth, rows / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  sx.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.clearRect(0, 0, W, H); cx.drawImage(small, 0, 0, cols, rows, 0, 0, W, H);
}

export default {
  name: 'pixel', label: 'Pixel – Mosaik löst sich beim Scrollen scharf auf', len: 240,
  build({ pr, i, n }) {
    return [mediaNode(pr, i), h('canvas', { class: 'vp__cv', 'aria-hidden': 'true' }), shadeNode(), idxNode(i, n), infoNode(pr), ctaNode(pr)];
  },
  init(sc) {
    const img = sc.q('.scene__media img');
    if (img && !img.complete) img.addEventListener('load', () => { sc.lvl = -1; draw(sc, sc.want ?? 0); }, { once: true });
    addEventListener('resize', () => { sc.lvl = -1; }, { passive: true });
  },
  update(sc, p) {
    const e = seg(p, .02, .42);
    const level = e >= 1 ? STEPS.length : Math.min(STEPS.length - 1, Math.floor(e * STEPS.length));
    sc.want = Math.min(level, STEPS.length - 1);
    const cv = sc.q('.vp__cv');
    if (level >= STEPS.length) cv.style.opacity = '0'; else { cv.style.opacity = '1'; draw(sc, level); }
    sc.q('.scene__media').style.transform = `scale(${(1.04 + .06 * p).toFixed(4)})`;
    setVars(sc.stage, { '--d': (.08 + .3 * seg(p, .4, .55)).toFixed(3) });
    infoCta(sc, p, { inA: .44, inB: .56, outA: .84, outB: .94, cA: .5, cB: .6 });
  },
};
