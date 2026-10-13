import { h } from '../core/dom.js';
import { track, still, trackProgress } from '../core/scrollhub.js';
import { mobileView, imgFor } from '../core/media.js';
import { clamp, num, ITEM, bgClass } from '../core/reelKit.js';

// Frame Scrub: Bildsequenz, die beim Scrollen abgespielt wird (Stage klebt am Bildschirm, Scrollen = Zeitleiste).
const VARIANTS = ['blend', 'plain', 'ghost', 'slice', 'mosaic', 'wipe'];
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.9'/></svg>\")";

export default {
  type: 'frameScrub', label: 'Frame Scrub (Bildsequenz läuft beim Scrollen)',
  fields: [
    { name: 'frames', label: '💻 Bildsequenz für Computer (z. B. 16:9): Knopf drücken und die Reihe wählen. Anzahl wird automatisch erkannt.', type: 'sequence', default: '', countField: 'frameCount', startField: 'frameStart', countLabel: 'Anzahl Bilder (Computer)' },
    { name: 'frameStart', label: 'Erste Bildnummer (Computer, meist 1)', type: 'number', default: 1 },
    { name: 'frameCount', label: 'Anzahl Bilder (Computer)', type: 'number', default: 48 },
    { name: 'framesMobile', label: '📱 Bildsequenz für Smartphone (z. B. 9:16, leer = wie Computer)', type: 'sequence', default: '', countField: 'frameCountMobile', startField: 'frameStartMobile', countLabel: 'Anzahl Bilder (Smartphone)' },
    { name: 'frameStartMobile', label: 'Erste Bildnummer (Smartphone, meist 1)', type: 'number', default: 1 },
    { name: 'frameCountMobile', label: 'Anzahl Bilder (Smartphone)', type: 'number', default: 48 },
    { name: 'items', label: 'ODER einzelne Bilder als Einzelbilder (statt Sequenz)', type: 'list', itemFields: ITEM.slice(0, 2), default: [] },
    { name: 'variant', label: 'Übergang zwischen den Bildern', type: 'select', options: VARIANTS, default: 'blend' },
    { name: 'scrollLength', label: 'Scroll-Strecke (in Bildschirmhöhen)', type: 'number', default: 3 },
    { name: 'smooth', label: 'Weichheit (0 = direkt, 0.3 = sehr träge)', type: 'number', default: .18 },
    { name: 'fit', label: 'Bild füllt die Fläche', type: 'select', options: ['cover', 'contain'], default: 'cover' },
    { name: 'width', label: 'Maximale Breite am Computer in px', type: 'number', default: 1020 },
    { name: 'height', label: '💻 Höhe der Fläche (Anteil der Bildschirmhöhe, 0.3–1)', type: 'number', default: .72 },
    { name: 'heightMobile', label: '📱 Höhe der Fläche am Smartphone (Anteil, 0.3–1)', type: 'number', default: .78 },
    { name: 'borderRadius', label: 'Rundung in px', type: 'number', default: 20 },
    { name: 'background', label: 'Hintergrundfarbe der Fläche (Hex)', type: 'text', default: '#0a0a0a' },
    { name: 'accent', label: 'Farbe des Zählers (Hex)', type: 'text', default: '#ededed' },
    { name: 'trail', label: 'Nachzieh-Bilder bei „ghost“', type: 'number', default: 4 },
    { name: 'slices', label: 'Streifen bei „slice“', type: 'number', default: 14 },
    { name: 'cells', label: 'Spalten bei „mosaic“', type: 'number', default: 6 },
    { name: 'lag', label: 'Versatz in Bildern bei slice/mosaic', type: 'number', default: 2.4 },
    { name: 'punch', label: 'Kleiner Zoom am Anfang (0–0.3)', type: 'number', default: .06 },
    { name: 'grain', label: 'Filmkorn (0–0.3)', type: 'number', default: .07 },
    { name: 'vignette', label: 'Vignette (0–1)', type: 'number', default: .34 },
    { name: 'showCounter', label: 'Bildzähler in der Ecke', type: 'checkbox', default: true },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const mob = mobileView();
    // Quelle wählen: Sequenz (💻 / 📱) oder Einzelbilder
    const pat = mob && p.framesMobile ? p.framesMobile : p.frames;
    const N0 = mob && p.framesMobile ? num(p.frameCountMobile, 48) : num(p.frameCount, 48), S0 = mob && p.framesMobile ? num(p.frameStartMobile, 1) : num(p.frameStart, 1);
    const urls = [];
    if (pat) { const w = (pat.match(/#+/) || ['####'])[0].length; for (let i = 0; i < Math.max(1, N0); i++) urls.push(pat.replace(/#+/, String(i + S0).padStart(w, '0'))); }
    else for (const it of (p.items || [])) { const u = imgFor(it); if (u) urls.push(u); }
    const el = h('section', { class: 'fs', id: p.id, style: { '--len': Math.max(1, num(p.scrollLength, 3)) } });
    if (urls.length < 2) { el.style.minHeight = '200px'; el.append(h('p', { class: 'reel-empty' }, 'Bildsequenz wählen (Knopf „Bildsequenz aus media/ wählen“) oder mindestens 2 Bilder hinzufügen.')); return el; }
    const cv = h('canvas', { class: 'fs__cv' }), counter = p.showCounter !== false ? h('div', { class: 'fs__count' }) : null;
    const stage = h('div', { class: 'fs__stage', style: { '--r': num(p.borderRadius, 20) + 'px', '--bg': p.background || '#0a0a0a', '--ac': p.accent || '#ededed', '--h': String(clamp(num(mob ? p.heightMobile : p.height, mob ? .78 : .72), .3, 1)), '--maxw': num(p.width, 1020) + 'px' } },
      cv, h('i', { class: 'fs__grain', style: { backgroundImage: GRAIN, opacity: String(clamp(num(p.grain, .07), 0, .4)) } }), h('i', { class: 'fs__vig', style: { opacity: String(clamp(num(p.vignette, .34), 0, 1)) } }), counter);
    el.append(h('div', { class: 'fs__track' }, h('div', { class: 'fs__sticky' }, stage)));
    const N = urls.length, imgs = urls.map(u => { const im = new Image(); im.decoding = 'async'; im.src = u; return im; });
    const ctx2 = cv.getContext('2d'); let cw = 0, ch = 0, dpr = 1, last = '', cur = 0, tgt = 0, raf = 0, vis = false;
    const ok = (im) => im && im.complete && im.naturalWidth > 0;
    const fit = () => { const r = stage.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.round(r.width * dpr), hh = Math.round(r.height * dpr); if (w > 4 && (w !== cw || hh !== ch)) { cw = cv.width = w; ch = cv.height = hh; last = ''; } };
    // Bild passend in die Fläche zeichnen (cover/contain); a = Deckkraft; clipX = nur linker Teil; band = (y0,y1) oder spalte (x0,x1)
    const drawImg = (im, a = 1, clip = null, zoom = 1) => {
      if (!ok(im)) return; const iw = im.naturalWidth, ih = im.naturalHeight, cover = p.fit !== 'contain';
      const k = (cover ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih)) * zoom, dw = iw * k, dh = ih * k, dx = (cw - dw) / 2, dy = (ch - dh) / 2;
      ctx2.save(); ctx2.globalAlpha = a; if (clip) { ctx2.beginPath(); ctx2.rect(clip[0], clip[1], clip[2], clip[3]); ctx2.clip(); } ctx2.drawImage(im, dx, dy, dw, dh); ctx2.restore();
    };
    const frame = (f) => { const i = clamp(Math.round(f), 0, N - 1); if (ok(imgs[i])) return imgs[i]; for (let k = 1; k < N; k++) { if (ok(imgs[i - k])) return imgs[i - k]; if (ok(imgs[i + k])) return imgs[i + k]; } return imgs[i]; }; // noch nicht geladene Bilder: nächstes geladenes zeigen
    const render = (q) => {
      if (!cw) return;
      const f = q * (N - 1), i0 = Math.floor(f), fr = f - i0, v = p.variant, zoom = 1 + num(p.punch, .06) * (1 - clamp(q * 7));
      const key = `${f.toFixed(3)}|${cw}|${v}`; if (key === last) return; last = key;
      ctx2.fillStyle = p.background || '#0a0a0a'; ctx2.fillRect(0, 0, cw, ch);
      if (v === 'plain') drawImg(frame(f), 1, null, zoom);
      else if (v === 'ghost') { const T = Math.max(1, Math.round(num(p.trail, 4))); for (let k = T; k >= 1; k--) drawImg(frame(f - k), .32 / k + .04, null, zoom); drawImg(frame(f), 1, null, zoom); }
      else if (v === 'slice') { const S = Math.max(2, Math.round(num(p.slices, 14))), lag = num(p.lag, 2.4); for (let s = 0; s < S; s++) drawImg(frame(f + (s / (S - 1) - .5) * lag), 1, [0, s * ch / S, cw, Math.ceil(ch / S) + 1], zoom); }
      else if (v === 'mosaic') { const C = Math.max(2, Math.round(num(p.cells, 6))), lag = num(p.lag, 2.4); for (let c = 0; c < C; c++) drawImg(frame(f + (c / (C - 1) - .5) * lag), 1, [c * cw / C, 0, Math.ceil(cw / C) + 1, ch], zoom); }
      else if (v === 'wipe') { drawImg(frame(i0), 1, null, zoom); if (fr > 0) drawImg(frame(i0 + 1), 1, [0, 0, cw * fr, ch], zoom); }
      else { drawImg(frame(i0), 1, null, zoom); if (fr > 0) drawImg(frame(i0 + 1), fr, null, zoom); } // blend
      if (counter) counter.textContent = `${String(Math.round(f) + 1).padStart(String(N).length, '0')} / ${N}`;
    };
    const tick = () => { raf = 0; const k = clamp(num(p.smooth, .18), 0, .6); cur += (tgt - cur) * (k ? 1 - Math.pow(k, .6) * .9 : 1); if (Math.abs(tgt - cur) < .0004) cur = tgt; render(cur); if (vis && cur !== tgt) raf = requestAnimationFrame(tick); };
    if ('ResizeObserver' in window) new ResizeObserver(() => { fit(); render(cur); }).observe(stage); else fit();
    imgs.forEach(im => im.addEventListener('load', () => { last = ''; if (!raf) raf = requestAnimationFrame(tick); }));
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(tick); }, { rootMargin: '40%' }).observe(el); else vis = true;
    const sticky = el.querySelector('.fs__sticky');
    if (still()) { tgt = cur = 0; requestAnimationFrame(() => { fit(); render(0); }); return el; }
    track(el.querySelector('.fs__track'), (r) => { tgt = trackProgress(r, sticky.offsetHeight); if (!raf) raf = requestAnimationFrame(tick); });
    requestAnimationFrame(() => { fit(); render(0); });
    return el;
  },
};
