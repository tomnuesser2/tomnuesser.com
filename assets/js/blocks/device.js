import { h } from '../core/dom.js';
import { mediaEl, isEmbedUrl, videoCfg, parseYouTube, parseVimeo } from '../core/media.js';
import { track, still, clamp, trackProgress, holdScroll, releaseScroll } from '../core/scrollhub.js';
import { createLaptop } from '../core/laptopGL.js';
import { LAP_FIN, hexc, easeOut, eA, pose, normAnim, holdT, alphaAt } from '../core/laptopAnim.js';
import { ticker, watchSize, mediaNode, dragHandler } from '../core/reelKit.js';
// Device: Smartphone (Hochformat-Videos/Reels, wie Stories) oder Laptop (Websites, scrollen im Bildschirm) neben Text.
// Beim Scrollen klebt die Bühne fest: Das Gerät schaltet durch die Einträge, der Text daneben wechselt mit.
const isVideo = (s) => /\.(mp4|webm|mov)(\?|$)/i.test(s || '');
const media = (src) => isEmbedUrl(src)
  ? mediaEl({ vimeo: src, ratio: '1/1', radius: 'none', reveal: false, parallax: false, sound: false, hud: false, ext: true })
  : isVideo(src)
  ? h('video', { src, muted: true, loop: true, playsinline: true, preload: 'metadata', 'aria-hidden': 'true' })
  : h('img', { src, alt: '', decoding: 'async', loading: 'lazy' });

export default {
  type: 'device', label: 'Gerät (Smartphone / Laptop mit Text)',
  fields: [
    { name: 'kind', label: 'Gerät', type: 'select', options: ['phone', 'laptop'], default: 'phone' },
    { name: 'side', label: 'Gerät steht', type: 'select', options: ['left', 'right'], default: 'left' },
    { name: 'textAlign', label: 'Text-Versatz neben dem Gerät', type: 'select', options: ['links', 'mitte', 'rechts'], default: 'links' },
    { name: 'kicker', label: 'Kleine Zeile (z. B. short-form / web)', type: 'text', default: '' },
    { name: 'title', label: 'Überschrift', type: 'text', default: '' },
    { name: 'text', label: 'Text unter der Überschrift', type: 'textarea', default: '' },
    { name: 'titleSize', label: '🔠 Größe der Überschrift am Computer (Schieber, 1 = normal)', type: 'range', min: .5, max: 3, step: .05, default: 1 },
    { name: 'titleSizeMobile', label: '📱 Größe der Überschrift am Handy (0 = wie am Computer)', type: 'range', min: 0, max: 3, step: .05, default: 0 },
    { name: 'textSize', label: '🔠 Größe des Textblocks am Computer (Schieber, 1 = normal)', type: 'range', min: .5, max: 3, step: .05, default: 1 },
    { name: 'textSizeMobile', label: '📱 Größe des Textblocks am Handy (0 = wie am Computer)', type: 'range', min: 0, max: 3, step: .05, default: 0 },
    { name: 'items', label: 'Einträge (Bild, .mp4 oder Vimeo/YouTube-Link; beim Laptop hohe Website-Screenshots)', type: 'list', itemFields: [
      { name: 'src', label: 'Bild oder Video (Datei oder Vimeo-/YouTube-Link)', type: 'image' }, { name: 'title', label: 'Titel (steht neben dem Gerät)', type: 'text' }, { name: 'url', label: 'Text in der Adresszeile oben (leer = Titel; bei „Adresszeile anzeigen“ aus unsichtbar)', type: 'text' }, { name: 'text', label: 'Kurztext', type: 'textarea' }] },
    { name: 'chrome', label: '💻 Laptop: Adresszeile oben anzeigen (Punkte + Text)', type: 'checkbox', default: true },
    { name: 'chromeMobile', label: '📱 Auf dem Handy des Besuchers: Adresszeile anzeigen', type: 'checkbox', default: true },
    { name: 'volumeUi', label: '🔊 Lautstärke-Regler einblenden (Besucher kann Ton an/aus und Lautstärke wählen)', type: 'checkbox', default: false },
    { name: 'linkText', label: 'Link-Text (optional)', type: 'text', default: '' },
    { name: 'linkUrl', label: 'Link-Ziel (optional)', type: 'text', default: '' },
  ],
  render(p) {
    const pos = (v) => (Number(v) > 0 ? Number(v) : 0);
    const sizeVars = (q) => { const o = {}; if (pos(q.titleSize)) o['--hs'] = pos(q.titleSize); if (pos(q.titleSizeMobile)) o['--hs-m'] = pos(q.titleSizeMobile); if (pos(q.textSize)) o['--ps'] = pos(q.textSize); if (pos(q.textSizeMobile)) o['--ps-m'] = pos(q.textSizeMobile); return o; };
    const items = (p.items || []).filter(i => i.src);
    const n = Math.max(1, items.length), phone = p.kind !== 'laptop';
    const screens = items.map((it) => h('div', { class: 'dv__scr' }, p._gl && isEmbedUrl(it.src) ? mediaNode(it.src, '', '') : media(it.src)));
    let device, gp = null;
    if (phone) {
      const bars = items.map(() => h('i', {}, h('b', {})));
      device = h('div', { class: 'dv__phone' }, h('div', { class: 'dv__screen' }, h('div', { class: 'dv__bars' }, bars), screens,
        h('button', { class: 'dv__tap dv__tap--l', type: 'button', 'aria-label': 'previous' }), h('button', { class: 'dv__tap dv__tap--r', type: 'button', 'aria-label': 'next' })),
        h('span', { class: 'dv__island' }), h('span', { class: 'dv__home' }));
    } else {
      device = h('div', { class: 'dv__laptop' }, h('div', { class: 'dv__lid' }, h('div', { class: 'dv__screen' },
        h('div', { class: 'dv__chrome' }, h('i', {}), h('i', {}), h('i', {}), h('span', { class: 'dv__url' }, items[0] ? (items[0].url ?? items[0].title ?? '') : '')), h('div', { class: 'dv__page' }, screens))), h('div', { class: 'dv__base' }));
      // 3D-Variante (Block „Laptop 3D“): WebGL-Laptop; die DOM-Medien dienen unsichtbar als Textur-Quelle
      if (p._gl) {
        try {
          const cv = h('canvas', { class: 'dv__gl', 'aria-hidden': 'true' }); gp = createLaptop(cv, { onLost: () => { gp = null; } });
          if (gp) { const fin = LAP_FIN[p.finish] || LAP_FIN['space schwarz'], fc = hexc(p.frameColor); gp.setTint(fc || fin); const lsrc = p.logo === undefined ? 'media/notua-logo.png' : p.logo; if (lsrc) { const lg = new Image(); lg.crossOrigin = 'anonymous'; lg.src = lsrc; gp.setLogo(lg); } const srcs = h('div', { class: 'dv__gsrc', 'aria-hidden': 'true' }, screens); screens.forEach(sc => sc.querySelectorAll('img').forEach(im => { im.loading = 'eager'; if (!/^(\/|\.|data:|blob:)/.test(im.getAttribute('src') || '')) im.crossOrigin = 'anonymous'; })); device = h('div', { class: 'dv__laptop dv__laptop--gl' }, cv, h('div', { class: 'dv__sh' }), srcs); }
        } catch (e) { console.warn('Laptop3D:', e); gp = null; }
      }
    }
    const copyItem = h('div', { class: 'dv__item' }, h('h3', { class: 'dv__it' }), h('p', { class: 'dv__ix' }));
    const dots = h('div', { class: 'dv__dots' }, items.map((_, i) => h('span', {}, String(i + 1).padStart(2, '0'))));
    const copy = h('div', { class: 'dv__copy' }, p.kicker ? h('p', { class: 'dv__k' }, p.kicker) : null, h('h2', { class: 'dv__h' }, p.title || ''),
      p.text ? h('p', { class: 'dv__p' }, p.text) : null, copyItem, items.length > 1 ? dots : null,
      p.linkText && p.linkUrl ? h('a', { class: 'dv__link', href: p.linkUrl, ...(/^https?:/.test(p.linkUrl) ? { target: '_blank', rel: 'noopener' } : { 'data-link': '' }) }, p.linkText + ' ↗') : null);
    const stage = h('div', { class: 'dv__stage' }, device, copy);
    const el = h('section', { class: `dv dv--${phone ? 'phone' : 'laptop'} dv--${p.side === 'right' ? 'right' : 'left'} dv--ta-${p.textAlign === 'mitte' ? 'center' : p.textAlign === 'rechts' ? 'right' : 'left'}${p.chrome === false ? ' dv--nochrome' : ''}${p.chromeMobile === false ? ' dv--nochrome-m' : ''}${p.volumeUi ? ' dv--vol' : ''}`, id: p.id, style: { '--n': n, '--ls': Number(p.scale) > 0 ? Number(p.scale) : 1, '--ts': Number(p.textScale) > 0 ? Number(p.textScale) : 1, ...sizeVars(p) } }, h('div', { class: 'dv__track' }, stage));

    // Lautstärke-Regler (optional)
    let vol = 0, lastVol = Math.max(10, Number(videoCfg.volume) || 40), cur = -1;
    const applyVol = () => screens.forEach((sc, k) => {
      const f = sc.querySelector('.media-frame'), v = sc.querySelector('video');
      if (f && f.tnVol) f.tnVol(k === cur ? vol : 0);
      if (v) { v.muted = !(k === cur && vol > 0); v.volume = Math.max(0, Math.min(1, vol / 100)); }
    });
    if (p.volumeUi && screens.some(sc => sc.querySelector('video, .media-frame'))) {
      const rng = h('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Lautstärke', class: 'dv__rng' });
      const btn = h('button', { type: 'button', class: 'dv__mute', 'aria-label': 'Ton an/aus' });
      btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path class="on" d="M15 8.5a5 5 0 0 1 0 7M17.6 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="off" d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      const ui = h('div', { class: 'dv__vol', 'data-nodrag': '' }, btn, rng);
      const setV = (v) => { vol = v; if (v > 0) lastVol = v; rng.value = String(v); ui.classList.toggle('is-on', v > 0); applyVol(); };
      rng.addEventListener('input', () => setV(Number(rng.value)));
      btn.addEventListener('click', (e) => { e.stopPropagation(); setV(vol > 0 ? 0 : lastVol); });
      ui.addEventListener('click', (e) => e.stopPropagation());
      el.querySelector('.dv__screen').append(ui);
    }
    const setCur = (i) => {
      if (i === cur) return; cur = i;
      screens.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.classList.toggle('is-past', k < i); const v = s.querySelector('video'); if (v) { if (k === i) v.play?.().catch(() => {}); else v.pause?.(); } });
      copyItem.classList.remove('is-in'); void copyItem.offsetWidth;
      copyItem.querySelector('.dv__it').textContent = items[i]?.title || ''; copyItem.querySelector('.dv__ix').textContent = items[i]?.text || '';
      copyItem.classList.add('is-in'); dots.childNodes.forEach((d, k) => d.classList.toggle('is-on', k === i));
      const u = el.querySelector('.dv__url'); if (u && items[i]) u.textContent = items[i].url || items[i].title || ''; applyVol();
    };
    setCur(0);
    // Handy: Lange Texte erst etwas kleiner setzen (bis 75 %), dann erst das Gerät schrumpfen lassen – nichts wird abgeschnitten.
    const mq = matchMedia('(max-width: 899px)');
    const fit = () => {
      copy.style.zoom = ''; stage.classList.remove('dv--fix');
      if (!mq.matches || !stage.isConnected || !stage.clientHeight) return;
      stage.classList.add('dv--fix'); const keep = cur; let worst = 1;
      const over = () => copy.getBoundingClientRect().bottom > stage.getBoundingClientRect().bottom - 10;
      items.forEach((it, k) => { copyItem.querySelector('.dv__it').textContent = it.title || ''; copyItem.querySelector('.dv__ix').textContent = it.text || ''; let z = 1; copy.style.zoom = ''; while (z > .75 && over()) { z -= .04; copy.style.zoom = z.toFixed(2); } worst = Math.min(worst, z); });
      copy.style.zoom = ''; copyItem.querySelector('.dv__it').textContent = items[keep]?.title || ''; copyItem.querySelector('.dv__ix').textContent = items[keep]?.text || '';
      if (worst < 1) copy.style.zoom = worst.toFixed(2);
      if (over()) stage.classList.remove('dv--fix');
    };
    requestAnimationFrame(() => requestAnimationFrame(fit)); addEventListener('resize', fit); setTimeout(fit, 600); document.fonts?.ready?.then(fit);
    const go = (i) => { const r = el.querySelector('.dv__track').getBoundingClientRect(); const total = r.height - stage.offsetHeight; const y = scrollY + r.top + ((clamp(i, 0, n - 1) + .5) / n) * total; scrollTo({ top: y, behavior: 'smooth' }); };
    el.addEventListener('click', (e) => { if (e.target.closest('.dv__tap--l')) go(cur - 1); else if (e.target.closest('.dv__tap--r')) go(cur + 1); });
    // ===== Laptop 3D: WebGL-Laptop wird vom Scroll gesteuert (frontal auf das Logo → aufklappen + drehen), Maus neigt ihn =====
    const PAD = 1.5, gpOn = !!gp, L = { p: 0, fr: 0, i: 0, a: 0 }; let A = null;
    if (gpOn) {
      const cv = el.querySelector('.dv__gl'), srcEl = (k) => screens[k]?.querySelector('video, img'), statik = still();
      let shown = 0, to = -1, mixv = 0, oc = statik ? 1 : 0, hx = 0, hy = 0, tx = 0, ty = 0, started = false;
      gp.setSlot(0, srcEl(0));
      // Auflösung: mind. 2-faches Supersampling (glatte Kanten), mit Pixel-Budget; wird automatisch gesenkt, wenn das Gerät zu langsam ist
      let rq = 1, cw = 0, ch = 0, slow = 0, fast = 0;
      if (mq.matches) { cv.style.transition = 'opacity .45s ease'; }
      const resize = () => { if (!cw) return; const mobile = matchMedia('(pointer: coarse)').matches, budget = mobile ? 2.3e6 : 7.5e6, want = Math.min(Math.max(window.devicePixelRatio || 1, 2), mobile ? 2.5 : 3) * rq, sc = Math.min(want, Math.sqrt(budget / (cw * ch))); const nw = Math.max(2, Math.round(cw * sc)), nh = Math.max(2, Math.round(ch * sc)); if (cv.width !== nw || cv.height !== nh) { cv.width = nw; cv.height = nh; } };
      watchSize(cv, (w, hh) => { cw = w; ch = hh; resize(); });
      if (!statik) {
        el.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = cv.getBoundingClientRect(); tx = clamp(((e.clientX - r.left) / r.width - .5) * 2 * PAD, -1.2, 1.2); ty = clamp(((e.clientY - r.top) / r.height - .5) * 2 * PAD, -1.2, 1.2); }, { passive: true });
        el.addEventListener('pointerleave', () => { tx = ty = 0; });
      }
      const lerp = (a, b, t) => a + (b - a) * t, ease = (t) => 1 - Math.pow(1 - t, 3), dir = p.side === 'right' ? 1 : -1;
      // Start: Laptop liegt zugeklappt dort, wo der Text steht (Text unsichtbar) → fährt beim Scrollen auf seinen Platz, dreht und öffnet sich, der Text erscheint dahinter
      const lap = el.querySelector('.dv__laptop'); let ox = 0, oy = 0;
      const measure = () => { if (!lap.isConnected || !copy.offsetWidth) return; ox = (copy.offsetLeft + copy.offsetWidth / 2) - (lap.offsetLeft + lap.offsetWidth / 2); oy = (copy.offsetTop + copy.offsetHeight / 2) - (lap.offsetTop + lap.offsetHeight / 2); if (Math.abs(oy) > Math.abs(ox)) ox = 0; const sw = stage.clientWidth, l0 = lap.offsetLeft; ox = Math.max(8 - l0, Math.min(sw - 8 - l0 - lap.offsetWidth, ox)); };
      requestAnimationFrame(() => requestAnimationFrame(measure)); addEventListener('resize', measure); setTimeout(measure, 700); document.fonts?.ready?.then(measure);
      let lastAl = -1; const shEl = lap.querySelector('.dv__sh'); const mqA = matchMedia('(max-width: 899px)'), pickA = () => { const src = mqA.matches ? (p.animMobile || p.anim) : p.anim; A = src && typeof src === 'object' ? normAnim(src, p.side, mqA.matches && !!p.animMobile) : null; }; pickA(); mqA.addEventListener('change', pickA); // eigene Animation aus dem Admin-Editor
      // ===== Laptop mit Maus/Finger drehen (wie beim Handy): waagerecht ziehen = drehen, senkrecht = kippen; nach dem Loslassen federt er zurück =====
      const dr = { ry: 0, rx: 0, ryV: 0, rxV: 0, on: false, skip: false, ly: 0 };
      if (!statik && p.drag !== false) {
        const lapEl = el.querySelector('.dv__laptop'); lapEl.classList.add('is-grab');
        dragHandler(lapEl, { threshold: 4,
          start: (e) => { dr.skip = !!e.target.closest('[data-nodrag]') || oc < .9; dr.ly = e.clientY; dr.ryV = 0; dr.rxV = 0; },
          move: (dx, e) => { if (dr.skip) return; dr.on = true; const dy = e.clientY - dr.ly; dr.ly = e.clientY; dr.ry = clamp(dr.ry + dx * .45, -170, 170); dr.rx = clamp(dr.rx + dy * .3, -35, 35); },
          end: () => { dr.on = false; } });
      }
      // ===== Vimeo/YouTube: echtes, geloopt abspielendes Video liegt passgenau über dem 3D-Bildschirm (WebGL kann kein Iframe-Video zeichnen) + Ton-Regler neben dem Laptop =====
      const h2m = (sp, q) => { const M = []; sp.forEach(([x, y], i) => { const [u, v] = q[i]; M.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u], [0, 0, 0, x, y, 1, -x * v, -y * v, v]); });
        for (let c = 0; c < 8; c++) { let m = c; for (let r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[m][c])) m = r; [M[c], M[m]] = [M[m], M[c]]; const d = M[c][c] || 1e-9; for (let k = c; k < 9; k++) M[c][k] /= d; for (let r = 0; r < 8; r++) if (r !== c) { const f = M[r][c]; if (f) for (let k = c; k < 9; k++) M[r][k] -= f * M[c][k]; } }
        const [a, b, c, d, e, f, g, hh2] = M.map(r => r[8]); return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh2},0,0,1,0,${c},${f},0,1)`; };
      const embedUrl = (src) => { const yt = parseYouTube(src); if (yt) return { yt: true, url: `https://www.youtube-nocookie.com/embed/${yt.id}?autoplay=1&mute=1&loop=1&playlist=${yt.id}&controls=0&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1` }; const v = parseVimeo(src); return v ? { yt: false, url: `https://player.vimeo.com/video/${v.id}?${v.hash ? 'h=' + v.hash + '&' : ''}autoplay=1&loop=1&muted=1&controls=0&title=0&byline=0&portrait=0&dnt=1&playsinline=1&autopause=0` } : null; };
      const ov = h('div', { class: 'dv__ov', 'aria-hidden': 'true' }); lapOv(ov);
      function lapOv(n) { el.querySelector('.dv__laptop').append(n); }
      const emb = items.map((it) => { const u = isEmbedUrl(it.src) ? embedUrl(it.src) : null; return u ? { ...u, f: null } : null; });
      let ovk = 0, calm = 0, ovAlpha = 1, soundVol = 0, lastIdx = -1, hasSnd = items.some((it) => isVideo(it.src) || isEmbedUrl(it.src));
      const post = (e, msg) => { try { e.f?.contentWindow?.postMessage(typeof msg === 'string' ? msg : JSON.stringify(msg), '*'); } catch { /* */ } };
      const applyEmbedVol = (e, v) => { if (!e.f) return; if (e.yt) { post(e, { event: 'command', func: v > 0 ? 'unMute' : 'mute', args: '' }); post(e, { event: 'command', func: 'setVolume', args: [Math.round(v * 100)] }); } else { post(e, { method: 'setVolume', value: v }); post(e, { method: 'setMuted', value: v <= 0 }); } };
      const applySound = () => { items.forEach((it, k) => { const on = k === L.i; const vv = screens[k]?.querySelector('video'); if (vv) { vv.muted = !(on && soundVol > 0); vv.volume = on ? soundVol : 0; } if (emb[k]) applyEmbedVol(emb[k], on ? soundVol : 0); }); };
      if (p.soundUi !== false && hasSnd && !statik) {
        const rng = h('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Lautstärke', class: 'dv__vr' }), btn = h('button', { type: 'button', class: 'dv__mute', 'aria-label': 'Ton an/aus' });
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path class="on" d="M15 8.5a5 5 0 0 1 0 7M17.6 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path class="off" d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
        const vs = h('div', { class: 'dv__vs', 'data-nodrag': '' }, btn, rng); let lastV = Math.max(20, Number(videoCfg.volume) || 40);
        const setV = (v) => { soundVol = v / 100; if (v > 0) lastV = v; rng.value = String(v); vs.classList.toggle('is-on', v > 0); applySound(); };
        rng.addEventListener('input', () => setV(Number(rng.value))); btn.addEventListener('click', (e) => { e.stopPropagation(); setV(soundVol > 0 ? 0 : lastV); }); vs.addEventListener('click', (e) => e.stopPropagation());
        el.querySelector('.dv__laptop').append(vs); L.vs = vs;
      }
      const updOverlay = (visible, appear) => {
        const q = (visible || appear) ? gp.screenQuad(p.chrome !== false, -.004) : null;
        emb.forEach((e, k) => {
          if (!e) return; const on = visible && q && q.facing > .004 && k === L.i;
          if (on && !e.f) { e.f = h('iframe', { class: 'dv__if', src: e.url, allow: 'autoplay; fullscreen; picture-in-picture', tabindex: '-1', loading: 'eager', title: '' }); ov.append(e.f); e.f.addEventListener('load', () => setTimeout(applySound, 600)); }
          if (!e.f) return;
          if (on) { const W0 = 1280, H0 = W0 / q.aspect, cw0 = cv.clientWidth, ch0 = cv.clientHeight; e.f.style.width = W0 + 'px'; e.f.style.height = H0.toFixed(1) + 'px'; e.f.style.clipPath = 'none'; /* Das Video bleibt 16:9 (Vimeo setzt schwarze Balken oben/unten), die schwarze Fläche deckt den ganzen Bildschirm ab */ { const mt = h2m([[0, 0], [W0, 0], [W0, H0], [0, H0]], q.pts.map(([x, y]) => [x * cw0, y * ch0])); if (e.mt !== mt) { e.mt = mt; e.f.style.transform = mt; } }; e.f.style.opacity = String(ovAlpha); } else e.f.style.opacity = '0';
        });
        if (L.vs) {
          const vq = appear && q && q.facing > .004 ? q : null, vsEl = L.vs;
          if (vq) { // am Laptop „festgemacht": mit Abstand außen neben dem Bildschirm, folgt jeder Bewegung und Drehung
            const cl = cv.offsetLeft, ct = cv.offsetTop, cwv = cv.clientWidth, chv = cv.clientHeight;
            let x0 = 9e9, x1 = -9e9, y0 = 9e9, y1 = -9e9; vq.pts.forEach(([fx, fy]) => { x0 = Math.min(x0, fx); x1 = Math.max(x1, fx); y0 = Math.min(y0, fy); y1 = Math.max(y1, fy); });
            const left = x0 * cwv + cl, right = x1 * cwv + cl, top = y0 * chv + ct, bot = y1 * chv + ct, sh = bot - top, hh = Math.max(84, Math.min(190, sh * .46)), w = vsEl.offsetWidth || 36, gap = Math.max(14, Math.min(34, sh * .09)), wide = innerWidth >= 900;
            const onRight = el.classList.contains('dv--right') ? true : false;
            // Desktop: Regler außen neben dem Laptop (Laptop links → links, rechts → rechts); Handy: knapp innen am Rand
            if (wide) { const lx = onRight ? right + gap : left - gap - w; vsEl.style.right = 'auto'; vsEl.style.transform = 'none'; vsEl.style.left = lx.toFixed(1) + 'px'; vsEl.style.top = ((top + bot) / 2 - hh / 2).toFixed(1) + 'px'; vsEl.style.height = hh.toFixed(1) + 'px'; vsEl.style.maxHeight = 'none'; }
            else { // Handy: waagerechter Regler unter dem Laptop, überdeckt ihn nie
              const lw = lap.clientWidth, lh = lap.clientHeight; vsEl.style.right = 'auto'; vsEl.style.transform = 'none'; vsEl.style.height = 'auto'; vsEl.style.maxHeight = 'none'; vsEl.style.left = (lw / 2 - (vsEl.offsetWidth || 150) / 2).toFixed(1) + 'px'; vsEl.style.top = (lh + 4).toFixed(1) + 'px';
            }
          }
          vsEl.style.opacity = vq ? String(Math.min(1, ovAlpha)) : '0'; vsEl.style.pointerEvents = vq ? 'auto' : 'none';
        }
      };
      ticker(cv, (dt, t) => {
        if (!cv.width) return;
        if (dt > .034) { if (++slow > 25 && rq > .55) { rq *= .8; slow = 0; resize(); } } else if (slow > 0) slow--;
        const k = Math.min(1, dt * 6), tgt = statik ? 1 : A ? L.a : clamp(L.p / .26); if (A && !statik) { const stp = Math.min(dt, .1) / Math.max(.6, Number(A.dur) || 4.5); oc = tgt > oc ? Math.min(tgt, oc + stp) : Math.max(tgt, oc - stp); } else oc += (tgt - oc) * Math.min(1, dt * 7);
        hx += (tx - hx) * k; hy += (ty - hy) * k;
        calm = (!dr.on && Math.abs(dr.ry) < .3 && Math.abs(dr.rx) < .3) ? calm + dt : 0; ovk += ((emb.some((e) => e && e.f) && oc > .985 ? 1 : 0) - ovk) * Math.min(1, dt * 3);
        if (!dr.on) { const sd = Math.min(dt, .05); dr.ryV += (-60 * dr.ry - 11 * dr.ryV) * sd; dr.ry += dr.ryV * sd; dr.rxV += (-60 * dr.rx - 11 * dr.rxV) * sd; dr.rx += dr.rxV * sd; if (Math.abs(dr.ry) < .02 && Math.abs(dr.ryV) < .05) { dr.ry = 0; dr.ryV = 0; } if (Math.abs(dr.rx) < .02 && Math.abs(dr.rxV) < .05) { dr.rx = 0; dr.rxV = 0; } }
        if (L.i !== shown && to < 0) { to = L.i; gp.setSlot(1, srcEl(to)); mixv = 0; }
        if (to >= 0) { mixv += dt / .5; if (mixv >= 1) { shown = to; to = -1; mixv = 0; gp.setSlot(0, srcEl(shown)); } }
        const o = ease(clamp(oc)), idle = statik ? 0 : 1 - ovk, mv = 1 - ease(clamp(oc * 1.05));
        if (A) {
          const pz = pose(A, statik ? 1 : holdT(A, eA(A, clamp(oc)))); { const al = statik ? 1 : alphaAt(A, eA(A, clamp(oc))) * (mq.matches && L.a === 0 && oc < .002 ? 0 : 1); ovAlpha = al; if (al !== lastAl) { lastAl = al; cv.style.opacity = al.toFixed(3); if (shEl) shEl.style.opacity = al.toFixed(3); } };
          if (!statik) { lap.style.translate = `${(pz.x / 100 * stage.clientWidth).toFixed(1)}px ${(pz.y / 100 * stage.clientHeight).toFixed(1)}px`; copy.style.opacity = clamp((eA(A, clamp(oc)) - (A.textAt ?? .42)) / .22).toFixed(3); }
          gp.draw({ pad: PAD, open: pz.open, rz: pz.rz, rx: pz.rx + dr.rx - hy * 4 * (1 - ovk) + Math.sin(t * .5) * 1.2 * idle, ry: pz.ry + dr.ry + hx * 11 * (1 - ovk) + (L.p - .5) * 8 * idle + Math.sin(t * .4) * 1.6 * idle, y: Math.sin(t * .9) * .008 * idle, fit: pz.fit,
            mix: to >= 0 ? ease(clamp(mixv)) : 0, intro: clamp((pz.open - .3) / .45), time: t, light: 1, scroll: clamp((L.fr - .08) / .84), chrome: p.chrome !== false });
          if (L.i !== lastIdx) { lastIdx = L.i; applySound(); }
          { const ap = statik || (oc > .985 && to < 0 && ovAlpha > .02); updOverlay(statik || (ap && calm > .22), ap); }
          if (!started) { started = true; el.classList.add('is-gl'); }
          return;
        }
        if (!statik) { lap.style.translate = `${(ox * mv).toFixed(1)}px ${(oy * mv - stage.clientHeight * .13 * mv).toFixed(1)}px`; const ta = clamp((o - .42) / .5); copy.style.opacity = ta.toFixed(3); }
        gp.draw({ pad: PAD, open: o, rx: lerp(80, 11, o) - hy * 4 * (1 - ovk) + Math.sin(t * .5) * 1.2 * idle, ry: dir * (50 * Math.pow(1 - o, 1.7) * clamp(o * 6) - o * 15) + hx * 11 * (1 - ovk) + (L.p - .5) * 8 * idle + Math.sin(t * .4) * 1.6 * idle,
          y: Math.sin(t * .9) * .008 * idle, fit: 1.1 - .24 * Math.sin(Math.PI * o), mix: to >= 0 ? ease(clamp(mixv)) : 0, intro: clamp((o - .3) / .45), time: t, light: 1, scroll: clamp((L.fr - .08) / .84), chrome: p.chrome !== false });
        if (L.i !== lastIdx) { lastIdx = L.i; applySound(); }
        { const ap = o > .985 && to < 0; updOverlay(ap && calm > .22, ap); }
        if (!started) { started = true; el.classList.add('is-gl'); }
      });
    }
    if (still()) { el.classList.add('is-still'); return el; }
    const bars = [...el.querySelectorAll('.dv__bars b')];
    track(el.querySelector('.dv__track'), (r, vh) => {
      const p0 = trackProgress(r, stage.offsetHeight), f = p0 * n, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
      setCur(i);
      el.style.setProperty('--p', p0.toFixed(4)); el.style.setProperty('--e', clamp(p0 / .12).toFixed(3));
      if (gpOn) { L.p = p0; L.fr = fr; L.i = i; L.top = r.top; if (A) { const th = (mq.matches ? Math.min(.55, clamp(Number(A.pre ?? .85))) : clamp(Number(A.pre ?? .85))) * vh; if (r.top < th) { L.a = 1; } else if (r.top > th + .06 * vh) L.a = 0; } }
      bars.forEach((b, k) => { b.style.transform = `scaleX(${k < i ? 1 : k === i ? fr : 0})`; });
      if (!phone && !gpOn) {
        const pg = screens[i]?.querySelector('img'); const page = el.querySelector('.dv__page');
        if (pg && page) { const over = Math.max(0, pg.clientHeight - page.clientHeight); pg.style.transform = `translate3d(0,${(-over * clamp((fr - .08) / .84)).toFixed(1)}px,0)`; }
      }
    });
    return el;
  },
};
