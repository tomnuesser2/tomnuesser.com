import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { ITEMS, BG, HEIGHT, isVideo, playVideosWhenVisible, goto, bgClass, ticker, watchSize, dragHandler, clamp, num } from '../core/reelKit.js';
import { createPhone } from '../core/phoneGL.js';
import { isEmbedUrl, parseVimeo, parseYouTube, vimeoThumb } from '../core/media.js';

// Phone 3D: echtes 3D-Smartphone (WebGL, ohne Bibliothek) mit Studio-Licht, Titan-Rahmen, Glas und Kameramodul.
const FINISH = { // [Rahmen, Rückseite] als lineare Reflexionsfarbe
  black: [[.12, .12, .13], [.055, .055, .06]], titanium: [[.2, .195, .19], [.085, .083, .08]], silver: [[.78, .79, .82], [.66, .67, .7]],
  gold: [[.8, .65, .42], [.6, .48, .3]], blue: [[.32, .4, .55], [.18, .25, .38]],
};
const hex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(v => Math.pow(v, 2.2)); };
const ease = (t) => 1 - Math.pow(1 - t, 3);

export default {
  type: 'phone3d', label: 'Phone 3D (echtes 3D-Smartphone, dreht sich mit)',
  fields: [
    { ...ITEMS, label: 'Bildschirm-Inhalte (Bilder oder Videos; mehrere = Wechsel per Tippen). Hochkant = 📱-Feld, quer = 💻-Feld.' }, ...HEIGHT(620, 560), BG,
    { name: 'scrollSpin', label: '🌀 Scroll-Animation: Sobald man hinscrollt, fliegt das Telefon mit einem Spin aus dem Nichts in die Mitte (läuft von allein zu Ende, auch wenn man aufhört zu scrollen)', type: 'checkbox', default: false },
    { name: 'startItem', label: 'Welcher Eintrag (Bild/Video) steht am Ende der Drehung auf dem Display? (Nummer, 1 = erster)', type: 'number', default: 1 },
    { name: 'spinFrom', label: 'Scroll-Animation: Start-Drehung in Grad (360 = ein ganzer Spin, 180 = halber)', type: 'number', default: 360 },
    { name: 'spinDuration', label: 'Scroll-Animation: Dauer in Sekunden', type: 'number', default: 1.6 },
    { name: 'showLeft', label: 'Text links anzeigen', type: 'checkbox', default: true },
    { name: 'showRight', label: 'Text rechts anzeigen', type: 'checkbox', default: true },
    { name: 'leftTitle', label: 'Text links: Überschrift (leer = kein Text links)', type: 'text', default: '' },
    { name: 'leftText', label: 'Text links', type: 'textarea', default: '' },
    { name: 'rightTitle', label: 'Text rechts: Überschrift (leer = kein Text rechts)', type: 'text', default: '' },
    { name: 'rightText', label: 'Text rechts', type: 'textarea', default: '' },
    { name: 'leftTitleM', label: '📱 Handy: Text oben – Überschrift (leer = wie PC-Text links)', type: 'text', default: '' },
    { name: 'leftTextM', label: '📱 Handy: Text oben (leer = wie PC-Text links)', type: 'textarea', default: '' },
    { name: 'rightTitleM', label: '📱 Handy: Text unten – Überschrift (leer = wie PC-Text rechts)', type: 'text', default: '' },
    { name: 'rightTextM', label: '📱 Handy: Text unten (leer = wie PC-Text rechts)', type: 'textarea', default: '' },
    { name: 'mobTextSize', label: '📱 Handy: Textgröße oben/unten (1 = normal, 0.7 klein, 1.4 groß)', type: 'number', default: 1 },
    { name: 'mobTextGap', label: '📱 Handy: Abstand der Texte zum Telefon in px (negativ = näher ans Telefon heran)', type: 'number', default: -30 },
    { name: 'orientation', label: 'Ausrichtung', type: 'select', options: ['hochkant', 'quer'], default: 'hochkant' },
    { name: 'finish', label: 'Gehäuse', type: 'select', options: ['black', 'titanium', 'silver', 'gold', 'blue'], default: 'titanium' },
    { name: 'frameColor', label: 'Eigene Gehäusefarbe (Hex, leer = wie oben)', type: 'text', default: '' },
    { name: 'scale', label: 'Größe (0.3–1, Anteil der Blockhöhe)', type: 'number', default: .86 },
    { name: 'rotateX', label: 'Neigung vor/zurück in Grad', type: 'number', default: -4 },
    { name: 'rotateY', label: 'Drehung zur Seite in Grad', type: 'number', default: -14 },
    { name: 'rotateZ', label: 'Schräglage in Grad', type: 'number', default: 0 },
    { name: 'tilt', label: 'Neigung zum Mauszeiger in Grad', type: 'number', default: 12 },
    { name: 'float', label: 'Schweben im Leerlauf (0 = aus, 1 = normal)', type: 'number', default: 1 },
    { name: 'lift', label: 'Anheben beim Darüberfahren (0–2)', type: 'number', default: 1 },
    { name: 'drag', label: 'Ziehen dreht das Telefon (links/rechts und hoch/runter)', type: 'checkbox', default: true },
    { name: 'reflection', label: 'Lichtreflexe (0–2)', type: 'number', default: 1 },
    { name: 'shadow', label: 'Schatten (0–2)', type: 'number', default: 1 },
    { name: 'intro', label: 'Einblend-Animation beim Erscheinen', type: 'checkbox', default: true },
    { name: 'interval', label: 'Bildschirm wechselt automatisch alle … Sekunden (0 = nur per Tippen)', type: 'number', default: 0 },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const land = p.orientation === 'quer';
    const raw = (p.items || []).filter(i => i.image || i.imageMobile);
    const items = raw.map(i => ({ src: land ? (i.image || i.imageMobile) : (i.imageMobile || i.image), title: i.title || '', href: i.link || '' }));
    const el = h('div', { class: `ph3${land ? ' ph3--land' : ''}${bgClass(p.bg)}` });
    if (!items.length) { el.style.height = '200px'; el.append(h('p', { class: 'reel-empty' }, 'Mindestens 1 Bild hinzufügen.')); return el; }
    const media = items.map(it => { if (isVideo(it.src)) { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.crossOrigin = 'anonymous'; v.preload = 'auto'; v.dataset.vid = '1'; v.setAttribute('playsinline', ''); v.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none'; v.src = it.src; v.play().catch(() => { }); return v; } const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async'; if (isEmbedUrl(it.src)) { const yt = parseYouTube(it.src), v = yt ? { id: yt.id, yt: true } : parseVimeo(it.src); if (v) vimeoThumb(v).then((u) => { if (u) im.src = u; }); } else im.src = it.src; return im; });
    const canvas = h('canvas', { class: 'ph3__cv' }), shadow = h('div', { class: 'ph3__shadow' });
    const stage = h('div', { class: 'ph3__stage', style: { '--h-d': num(p.height, 620) + 'px', '--h-m': num(p.heightMobile, 560) + 'px' } }, shadow, canvas);
    const col = (title, text, side, cls) => { if (!title && !text) return null; const c = h('div', { class: `ph3__t ph3__t--${side}${cls ? ' ' + cls : ''}` }); if (title) c.append(h('h3', {}, title)); for (const para of String(text || '').split(/\n\s*\n/).filter(Boolean)) c.append(h('p', {}, para)); return c; };
    const mk = (side, show, t, x, tm, xm) => { if (show === false) return []; const hasM = !!(tm || xm); if (!hasM) { const c = col(t, x, side); return c ? [c] : []; } return [col(t, x, side, 'ph3__v-d'), col(tm, xm, side, 'ph3__v-m')].filter(Boolean); };
    const tlA = mk('l', p.showLeft, p.leftTitle, p.leftText, p.leftTitleM, p.leftTextM), trA = mk('r', p.showRight, p.rightTitle, p.rightText, p.rightTitleM, p.rightTextM);
    const tl = tlA.length ? tlA : null, tr = trA.length ? trA : null;
    const row = h('div', { class: 'ph3__row', style: { '--tm-s': String(num(p.mobTextSize, 1) || 1), '--tm-g': num(p.mobTextGap, -30) + 'px' } }); const scroll = !!p.scrollSpin;
    if (tl || tr) { row.classList.add('ph3--txt'); row.append(...(tl || [h('div', { class: 'ph3__t ph3__t--l is-empty' })]), stage, ...(tr || [h('div', { class: 'ph3__t ph3__t--r is-empty' })])); } else row.append(stage);
    el.append(row); if (scroll) el.classList.add('ph3--scroll');
    media.forEach(m => { if (m.tagName === 'VIDEO') el.append(m); }); // im Dokument, damit der Browser das Video durchgehend weiterspielt
    const fin = FINISH[p.finish] || FINISH.titanium, fc = hex(p.frameColor);
    let gp = null; try { gp = createPhone(canvas, { tint: fc || fin[0], back: fc ? fc.map(v => v * .6) : fin[1] }); } catch (e) { console.warn('Phone3D:', e); }
    if (!gp) { // Ohne WebGL: einfaches Bild im runden Rahmen
      stage.textContent = ''; const f = h('div', { class: 'ph3__flat' }); f.append(media[0]); media[0].className = 'ph3__flatimg'; stage.append(f); return el;
    }
    let cur = clamp(Math.round(num(p.startItem, 1)) - 1, 0, media.length - 1), mix = 0, to = -1;
    gp.setSlot(0, media[cur]);
    const show = (i) => { if (i === cur || to >= 0) return; to = i; gp.setSlot(1, media[i]); mix = 0; };
    const next = () => { if (media.length > 1) show((cur + 1) % media.length); };
    let W = 0, H = 0, dpr = 1, cvOff = 0;
    const set = { rx: 0, ry: 0, spin: 0, spinV: 0, pitch: 0, pitchV: 0, drag: false, hover: false, px: 0, py: 0, lift: 0, intro: p.intro !== false && !still() && !scroll ? 0 : 1 };
    let sp = still() ? 1 : 0, playing = still();
    if (scroll && !still() && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio > .18) playing = true; else if (!e.isIntersecting) { playing = false; sp = 0; } }, { threshold: [0, .18, .4] }).observe(el); else if (scroll) { playing = true; }
    watchSize(stage, (w, hh) => { W = w; H = hh; dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.max(2, Math.round(w * dpr)); canvas.height = Math.max(2, Math.round(hh * dpr)); });
    playVideosWhenVisible(el);
    const rect = () => stage.getBoundingClientRect();
    stage.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || !p.tilt) return; const r = rect(); set.px = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); set.py = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1); set.hover = true; });
    stage.addEventListener('pointerleave', () => { set.hover = false; });
    if (p.drag !== false) { let ly = 0, lyt = 0; dragHandler(stage, { start: (e) => { set.drag = true; set.spinV = 0; set.pitchV = 0; ly = e.clientY; lyt = performance.now(); }, move: (dx, e, v) => { const dy = e.clientY - ly, now = performance.now(); set.pitch += dy * .45; set.pitchV = set.pitchV * .6 + (dy / Math.max(1, now - lyt)) * 22 * .4; ly = e.clientY; lyt = now; set.spin += dx * .5; set.spinV = v * 22; }, end: () => { set.drag = false; } }); }
    stage.addEventListener('click', () => { if (items[cur]?.href && media.length < 2) { goto(items[cur].href); return; } next(); set.spinV += 70; });
    let acc = 0;
    ticker(el, (dt, t) => {
      if (!W) return;
      if (p.interval > 0 && !still()) { acc += dt; if (acc >= p.interval) { acc = 0; next(); } }
      if (to >= 0) { mix += dt / .5; if (mix >= 1) { cur = to; to = -1; mix = 0; gp.setSlot(0, media[cur]); } }
      { const mv = media[to >= 0 ? to : cur], mc = media[cur]; [mv, mc].forEach(m => { if (m && m.tagName === 'VIDEO' && m.paused && m.readyState >= 2 && !still()) m.play().catch(() => { }); }); }
      if (set.intro < 1) set.intro = Math.min(1, set.intro + dt / 1.4);
      const iv = ease(set.intro), fl = still() ? 0 : num(p.float, 1), tiltD = num(p.tilt, 12);
      const tx = set.hover ? -set.py * tiltD : Math.sin(t * .7) * 2.4 * fl, ty = set.hover ? set.px * tiltD : Math.cos(t * .5) * 4 * fl;
      set.rx += (tx - set.rx) * Math.min(1, dt * 6); set.ry += (ty - set.ry) * Math.min(1, dt * 6);
      if (!set.drag) { const k = 24, c = 6; set.spinV += (-k * set.spin - c * set.spinV) * dt * 4; set.spin += set.spinV * dt * 4; if (Math.abs(set.spin) < .01 && Math.abs(set.spinV) < .01) { set.spin = 0; set.spinV = 0; } }
      if (!set.drag) { set.pitchV += (-24 * set.pitch - 6 * set.pitchV) * dt * 4; set.pitch += set.pitchV * dt * 4; if (Math.abs(set.pitch) < .01 && Math.abs(set.pitchV) < .01) { set.pitch = 0; set.pitchV = 0; } }
      else { set.spin = clamp(set.spin, -200, 200); set.pitch = clamp(set.pitch, -80, 80); }
      const lift = set.hover || set.drag ? 1 : 0; set.lift += (lift - set.lift) * Math.min(1, dt * 6);
      const S = clamp(num(p.scale, .86), .2, 1);
      let spinAdd = 0, rxAdd = 0, sk = 1, upY = 0;
      if (scroll) { if (playing) sp = Math.min(1, sp + dt / Math.max(.4, num(p.spinDuration, 1.6))); const e = ease(clamp(sp / .8)); spinAdd = num(p.spinFrom, 360) * (1 - e); rxAdd = -8 * (1 - e); sk = Math.max(.001, e); upY = -Math.pow(1 - e, 1.5) * 1.5; const tf = clamp((sp - .7) / .3); [tl, tr].forEach(c => { if (c) { c.style.opacity = tf.toFixed(3); c.style.transform = `translateY(${((1 - tf) * 24).toFixed(1)}px)`; } }); }
      gp.draw({ rx: num(p.rotateX, -4) + set.rx + rxAdd + set.pitch, ry: num(p.rotateY, -14) + set.ry + set.spin + spinAdd + (1 - iv) * -50, rz: num(p.rotateZ, 0) + (land ? 90 : 0), y: set.lift * .035 * num(p.lift, 1) - (1 - iv) * .25 + Math.sin(t * .9) * .012 * fl + upY, fit: S * (.9 + .1 * iv) * sk, mix: to >= 0 ? ease(clamp(mix)) : 0, intro: .1 + .9 * clamp((iv - .3) / .7), light: clamp(num(p.reflection, 1), 0, 2), time: t });
      const sh = clamp(num(p.shadow, 1), 0, 2);
      // Steht die Bühne am Seitenanfang (z. B. als erstes Element unter dem Menü) tiefer als die Fenstermitte, wird das Gerät fest um den Unterschied nach oben geschoben (unabhängig vom Scrollen)
      { const r = stage.getBoundingClientRect(), dt0 = r.top + scrollY, off = dt0 < innerHeight * .5 ? clamp(dt0 + r.height / 2 - innerHeight / 2, 0, H * .3) : 0; cvOff += (off - cvOff) * Math.min(1, dt * 4); canvas.style.transform = `translateY(${(-cvOff).toFixed(1)}px)`; shadow.dataset.o = (-cvOff).toFixed(1); row.style.setProperty('--tdy', (-cvOff).toFixed(1) + 'px'); }
      shadow.style.opacity = String((.5 * sh * iv * clamp(sk * 1.4)).toFixed(3)); shadow.style.width = (Math.min(H * S * (land ? 1.0 : .38), W * .8)) + 'px'; shadow.style.transform = `translate(-50%,${shadow.dataset.o || 0}px) scale(${(1 - set.lift * .1).toFixed(3)})`;
    });
    return el;
  },
};
