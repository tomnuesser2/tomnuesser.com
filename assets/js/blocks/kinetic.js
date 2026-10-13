import { h, svg } from '../core/dom.js';
import { parseVimeo, isEmbedUrl, vimeoThumb } from '../core/media.js';
import { track, still, clamp, trackProgress } from '../core/scrollhub.js';
// Kinetic: Ein Vollbild-Motion-Intermezzo mitten auf der Seite. Die Karte klappt zum Vollbild auf, danach läuft
// beim Scrollen eine Typo-Animation (Wörter zoomen durch, Formen kreisen, Farbwechsel) – man "scrubbt" durch die Animation.
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default {
  type: 'kinetic', label: 'Motion-Intermezzo (Vollbild-Typo-Animation)',
  fields: [
    { name: 'words', label: 'Wörter (eins pro Zeile)', type: 'textarea', default: 'film\ndesign\ndevelop\none thread.' },
    { name: 'video', label: 'Hintergrund-Video: Datei (mp4/webm) oder Vimeo-Link. Bei „scrub“ läuft das Video durchs Scrollen vor und zurück (mp4 = ruckelfrei, Vimeo = etwas gröber). Leer = nur Typo-Animation.', type: 'image', default: '' },
    { name: 'videoMode', label: 'Video-Verhalten', type: 'select', options: ['scrub', 'loop'], default: 'scrub' },
    { name: 'frames', label: 'ODER Bildsequenz: Knopf drücken und die Reihe wählen (z. B. f_0001.jpg, f_0002.jpg … in einem Ordner unter media/). Anzahl wird automatisch erkannt.', type: 'sequence', default: '' },
    { name: 'frameStart', label: 'Erste Bildnummer der Sequenz (meist 1)', type: 'number', default: 1 },
    { name: 'frameCount', label: 'Anzahl Bilder der Sequenz', type: 'number', default: 120 },
    { name: 'length', label: 'Länge der Animation = Scroll-Strecke (in Bildschirmhöhen, z. B. 6 = sechs mal runterscrollen)', type: 'number', default: 6 },
    { name: 'smooth', label: 'Weichheit (0 = direkt, 0.2 = sehr weich/träge)', type: 'number', default: 0.12 },
    { name: 'wordsOn', label: 'Wörter einblenden', type: 'checkbox', default: true },
    { name: 'poster', label: 'Vorschaubild für das Video (optional)', type: 'image', default: '' },
    { name: 'dim', label: 'Abdunklung über dem Video in % (0–90)', type: 'number', default: 45 },
    { name: 'size', label: 'Schriftgröße', type: 'select', options: ['m', 'l', 'xl'], default: 'l' },
    { name: 'ctaText', label: 'Button unten in der Mitte: Text (bleibt beim Scrollen im Bild; leer = kein Button)', type: 'text', default: 'my recent design work', de: 'meine aktuellen Design-Arbeiten' },
    { name: 'ctaLink', label: 'Button unten: Ziel (Seite, z. B. projects)', type: 'text', default: 'projects' },
    { name: 'accent', label: 'Akzentfarbe (Hex)', type: 'text', default: '#ff2d2d' },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const words = String(p.words || '').split('\n').map(s => s.trim()).filter(Boolean);
    const n = Math.max(1, words.length);
    const wEls = words.map((w) => h('div', { class: 'kn__w' }, h('span', {}, w)));
    const shapes = svg('<svg class="kn__svg" viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle class="kn__ring" r="30" fill="none" stroke="currentColor" stroke-width=".35"/><circle class="kn__ring2" r="30" fill="none" stroke="currentColor" stroke-width=".2"/><rect class="kn__sq" x="-26" y="-26" width="52" height="52" fill="none" stroke="currentColor" stroke-width=".35"/><line class="kn__ln kn__ln--a" x1="-140" x2="140" y1="0" y2="0" stroke="currentColor" stroke-width=".25"/><line class="kn__ln kn__ln--b" x1="-140" x2="140" y1="0" y2="0" stroke="currentColor" stroke-width=".25"/><line class="kn__ln kn__ln--c" y1="-140" y2="140" x1="0" x2="0" stroke="currentColor" stroke-width=".25"/></svg>');
    const tc = { textContent: '' }, idx = { textContent: '' };
    const scrub = p.videoMode !== 'loop';
    // Vimeo-Link: Video-Frame per Scroll steuern (Vimeo-Player-API: setCurrentTime)
    const vm = isEmbedUrl(p.video) ? parseVimeo(p.video) : null;
    const vmf = vm ? h('iframe', { class: 'kn__vid kn__vimeo', tabindex: '-1', 'aria-hidden': 'true', title: 'Video', allow: 'autoplay; fullscreen', referrerpolicy: 'strict-origin-when-cross-origin' }) : null;
    const vid = p.video && !vm ? h('video', { class: 'kn__vid', src: p.video, poster: p.poster || null, muted: '', loop: scrub ? null : '', playsinline: '', preload: 'metadata', 'aria-hidden': 'true' }) : null;
    if (vid) { vid.muted = true; vid.defaultMuted = true; }
    if (vmf && p.poster) { vmf.style.background = `#000 url("${p.poster}") center / cover`; } else if (vmf) vimeoThumb(vm).then(t => { if (t) vmf.style.background = `#000 url("${t}") center / cover`; });
    const cv = p.frames ? h('canvas', { class: 'kn__cv' }) : null;
    const clip = h('div', { class: `kn__clip is-${p.size}${vid || vmf || cv ? ' has-vid' : ''}`, style: { '--dim': String((Number(p.dim) || 0) / 100) } }, vid, vmf, cv, shapes, wEls);
    const cta = p.ctaText ? h('a', { class: 'cta cta--light kn__cta', href: p.ctaLink || 'projects', 'data-link': '' }, h('span', {}, p.ctaText), h('i', { 'aria-hidden': 'true' }, '→')) : null;
    const stage = h('div', { class: 'kn__stage', style: { '--accent': p.accent || '#ff2d2d' } }, clip, cta);
    const L = Math.max(2, Number(p.length) || 6);
    const el = h('section', { class: 'kn', id: p.id, style: { '--n': n, '--len': L } }, h('div', { class: 'kn__track' }, stage));
    if (still()) { el.classList.add('is-still'); wEls.forEach((w, i) => { if (i) w.style.display = 'none'; }); stage.style.setProperty('--e', 1); return el; }
    const ring = shapes.querySelector('.kn__ring'), ring2 = shapes.querySelector('.kn__ring2'), sq = shapes.querySelector('.kn__sq');
    const la = shapes.querySelector('.kn__ln--a'), lb = shapes.querySelector('.kn__ln--b'), lc = shapes.querySelector('.kn__ln--c');
    if (vid && !scrub && 'IntersectionObserver' in window) new IntersectionObserver((es) => { es.forEach(e => { if (e.isIntersecting) vid.play().catch(() => {}); else vid.pause(); }); }, { rootMargin: '20%' }).observe(el);
    const SMALL = matchMedia('(max-width: 899px)').matches; let svgAt = 0, seekAt = 0, pend = false; let beat = -1, target = 0, curP = 0, vis = false, raf = 0;
    // Bildsequenz vorladen
    const imgs = []; let ctx2 = null, lastF = -1;
    if (cv) { const N = Math.max(1, Number(p.frameCount) || 1), pad = (i) => String(i).padStart((p.frames.match(/#+/) || ['####'])[0].length, '0'); ctx2 = cv.getContext('2d');
      for (let i = 0; i < N; i++) { const im = new Image(); im.decoding = 'async'; im.src = p.frames.replace(/#+/, pad(i + (Number(p.frameStart) || 1))); imgs.push(im); } }
    const drawFrame = (q) => { if (!cv) return; const i = Math.min(imgs.length - 1, Math.floor(q * imgs.length)); if (i === lastF) return; const im = imgs[i]; if (!im.complete || !im.naturalWidth) return; lastF = i; if (cv.width !== im.naturalWidth) { cv.width = im.naturalWidth; cv.height = im.naturalHeight; } ctx2.drawImage(im, 0, 0); };
    // Vimeo-Scrub
    let vDur = 0, vReady = false, vLast = -1, vAt = 0, vSrcSet = false;
    const vpost = (o) => { try { vmf.contentWindow.postMessage(JSON.stringify(o), 'https://player.vimeo.com'); } catch { /* weg */ } };
    if (vmf) {
      const base = new URLSearchParams({ controls: '0', api: '1', muted: '1', autopause: '0', title: '0', byline: '0', portrait: '0', dnt: '1', playsinline: '1', ...(scrub ? {} : { autoplay: '1', loop: '1', background: '1' }) }); if (vm.hash) base.set('h', vm.hash);
      const load = () => { if (vSrcSet) return; vSrcSet = true; vmf.src = `https://player.vimeo.com/video/${vm.id}?${base}`; };
      if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '60%' }); io.observe(el); } else load();
      // Falls der Player kein „ready“ meldet: nach dem Laden mehrfach nach der Länge fragen
      vmf.addEventListener('load', () => { let n = 0; const ask = () => { if (vDur || n++ > 12) return; vpost({ method: 'addEventListener', value: 'ready' }); vpost({ method: 'getDuration' }); vpost({ method: 'setMuted', value: true }); if (scrub) vpost({ method: 'pause' }); setTimeout(ask, 500); }; ask(); });
      addEventListener('message', (e) => {
        if (e.source !== vmf.contentWindow) return; let d = e.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
        if (d.event === 'ready') { vReady = true; vpost({ method: 'getDuration' }); vpost({ method: 'setMuted', value: true }); if (scrub) vpost({ method: 'pause' }); }
        else if (d.method === 'getDuration' && d.value) { vReady = true; vDur = Number(d.value) || 0; if (!raf) raf = requestAnimationFrame(tick); }
      });
      // Video füllt die Fläche (Cover, 16:9)
      const fit = () => { const w = clip.clientWidth, hh = clip.clientHeight; if (!w || !hh) return; const W = Math.max(w, hh * 16 / 9), H = Math.max(hh, w * 9 / 16); vmf.style.width = W + 'px'; vmf.style.height = H + 'px'; vmf.style.left = (w - W) / 2 + 'px'; vmf.style.top = (hh - H) / 2 + 'px'; };
      if ('ResizeObserver' in window) new ResizeObserver(fit).observe(clip); fit();
    }
    const tick = () => { raf = 0; pend = false; const k = Math.max(0, Math.min(1, Number(p.smooth)));
      curP += (target - curP) * (k ? 1 - Math.pow(1 - k, 1) : 1); if (Math.abs(target - curP) < .0004) curP = target;
      const q = clamp((curP - .1) / .9);
      if (vid && scrub && vid.duration) { const t = q * vid.duration, nw = performance.now(); if (!vid.seeking && Math.abs(vid.currentTime - t) > (SMALL ? .1 : .03) && nw - seekAt > (SMALL ? 110 : 0)) { seekAt = nw; vid.currentTime = t; } else if (Math.abs(vid.currentTime - t) > (SMALL ? .1 : .03)) pend = true; }
      if (vmf && scrub && vReady && vDur) { const t = Math.min(vDur - .05, q * vDur), nw = performance.now(); if (Math.abs(t - vLast) > .04 && nw - vAt > (SMALL ? 160 : 90)) { vAt = nw; vLast = t; vpost({ method: 'setCurrentTime', value: t }); } else if (Math.abs(t - vLast) > .04) pend = true; }
      drawFrame(q); apply(curP);
      if (vis && (curP !== target || pend)) raf = requestAnimationFrame(tick); };
    const apply = (raw) => {
      const e = ease(clamp(raw / .14));
      stage.style.setProperty('--e', e.toFixed(4));
      const f = clamp((raw - .1) / .9) * n, bi = Math.min(n - 1, Math.floor(f));
      if (bi !== beat) { beat = bi; stage.dataset.beat = String(bi % 3); idx.textContent = `${String(bi + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`; }
      wEls.forEach((w, i) => {
        const t = clamp(f - i), vis = f > i - .01 && f < i + 1.01 && (i !== 0 || f > 0 || true);
        let sc, op, bl;
        if (t < .32) { const k = ease(t / .32); sc = .45 + .55 * k; op = k; bl = 14 * (1 - k); }
        else if (t < .68) { sc = 1 + (t - .32) * .1; op = 1; bl = 0; }
        else { const k = (t - .68) / .32; sc = 1.04 + 5 * k * k; op = 1 - k; bl = 12 * k; }
        if (i === 0 && f < .001) { sc = .45; op = 0; }
        if (i === n - 1 && t >= .68) { sc = 1.04; op = 1; bl = 0; }                       // letztes Wort bleibt stehen
        w.style.opacity = (vis && p.wordsOn !== false) ? op.toFixed(3) : '0'; w.style.transform = `scale(${sc.toFixed(3)})`; w.style.filter = !SMALL && bl > .3 ? `blur(${bl.toFixed(1)}px)` : 'none';
      });
      const g = f / n;
      const nowT = performance.now(); if (SMALL && nowT - svgAt < 34 && raw < 1) { tc.textContent = `00:${String(Math.floor(raw * 24)).padStart(2, '0')}`; return; } svgAt = nowT;
      ring.setAttribute('r', (10 + ((f % 1) * 70)).toFixed(2)); ring.style.opacity = String(1 - (f % 1));
      ring2.setAttribute('r', (10 + (((f + .5) % 1) * 70)).toFixed(2)); ring2.style.opacity = String(1 - ((f + .5) % 1));
      sq.setAttribute('transform', `rotate(${(f * 90).toFixed(1)}) scale(${(.7 + Math.sin(f * 3) * .25).toFixed(3)})`);
      la.setAttribute('transform', `translate(0 ${(-60 + g * 120).toFixed(1)})`); lb.setAttribute('transform', `translate(0 ${(60 - g * 120).toFixed(1)})`); lc.setAttribute('transform', `translate(${(-50 + g * 100).toFixed(1)} 0)`);
      tc.textContent = `00:${String(Math.floor(raw * 24)).padStart(2, '0')}`;
    };
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { es.forEach(e => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(tick); }); }, { rootMargin: '30%' }).observe(el); else vis = true;
    if (vid && scrub) { vid.pause(); vid.addEventListener('loadedmetadata', () => { vid.currentTime = 0.001; }); }
    track(el.querySelector('.kn__track'), (r) => { target = trackProgress(r, stage.offsetHeight); if (!raf) raf = requestAnimationFrame(tick); });
    return el;
  },
};
