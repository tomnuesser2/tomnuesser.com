import { h } from '../core/dom.js';
import { track, still, clamp, trackProgress, kick, registerStops } from '../core/scrollhub.js';
import { isFinePointer } from '../core/dom.js';
import { ui } from '../core/i18n.js';
import { carousel3d } from '../core/carousel3d.js';
// Hero: auffächernde Projekt-Karten (zentriert, Hover = größer), darunter frei editierbarer Titel / Untertitel / Text.
export default {
  type: 'hero', label: 'Hero (Karten + Titel)',
  fields: [
    { name: 'title', label: 'Überschrift (eine Zeile pro Umbruch – die Zeilen leuchten nacheinander auf)', type: 'textarea', default: 'videographer,\ndesigner &\ndeveloper.', de: 'Videograf,\nDesigner &\nEntwickler.' },
    { name: 'titleSize', label: 'Größe der Überschrift', type: 'select', options: ['s', 'm', 'l', 'xl'], default: 'l' },
    { name: 'cycle', label: 'Zeilen nacheinander aufleuchten lassen', type: 'checkbox', default: true },
    { name: 'subtitle', label: 'Unterschrift (optional)', type: 'text', default: '' },
    { name: 'subSize', label: 'Größe der Unterschrift', type: 'select', options: ['s', 'm', 'l'], default: 'm' },
    { name: 'text', label: 'Textfeld (optional)', type: 'textarea', default: '' },
    { name: 'cue', label: 'Hinweis unten', type: 'text', default: 'scroll', de: 'scrollen' },
    { name: 'showName', label: 'Projektname oben im Karussell zeigen (ganz dezent, mit Knopf; darunter optional der kleine Text, den du pro Projekt eingibst)', type: 'checkbox', default: true },
    { name: 'nameBtn', label: 'Text auf dem Knopf', type: 'text', default: 'view project', de: 'Projekt ansehen' },
    { name: 'carSize', label: '🖥 Karussell am Computer: Größe der Bilder (Schieber, 1 = Standard)', type: 'range', min: .5, max: 3, step: .05, default: 1.6 },
    { name: 'carSpread', label: '🖥 Karussell am Computer: Breite – wie weit es nach links/rechts an den Rand reicht (Schieber, 1 = Standard)', type: 'range', min: .3, max: 2.5, step: .05, default: 1.5 },
    { name: 'carY', label: '🖥 Karussell: Höhe verschieben (Schieber, Pixel – minus = hoch, plus = runter)', type: 'range', min: -300, max: 300, step: 5, default: 0 },
    { name: 'nameY', label: '🖥 Projektname über dem Karussell: Höhe verschieben (Pixel)', type: 'range', min: -300, max: 300, step: 5, default: 0 },
    { name: 'titleY', label: '🖥 Titel unten („digitaler & visueller künstler“): Höhe verschieben (Pixel)', type: 'range', min: -300, max: 300, step: 5, default: 0 },
    { name: 'cards', label: 'Anzahl Karten (aus den ersten Projekten)', type: 'number', default: 4 },
    { name: 'mobileCount', label: 'Handy: Anzahl Vollbild-Projekte, falls keine Projekte markiert sind (Markierung: im Projekt „Im Handy-Intro zeigen“)', type: 'number', default: 4 },
  ],
  render(p0, ctx) {
    const desk = this.renderDesk(p0, ctx);
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const mob = mobileHero(p, ctx);
    return h('div', { class: 'hero-wrap', id: undefined }, desk, mob);
  },
  renderDesk(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const idx = ctx.content.index;
    const list = (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden).slice(0, Math.max(2, Math.min(6, p.cards || 4)));
    const n = list.length;
    const cards = list.map((pr, i) => h('a', { class: 'hero__card', href: pr.slug, 'data-link': '', 'aria-label': pr.title, style: { '--i': i, '--k': n === 1 ? 0 : (i / (n - 1)) * 2 - 1 } },
      h('img', { src: pr.image, alt: '', decoding: 'async' })));
    const lines = String(p.title || '').split('\n').map(s => s.trim()).filter(Boolean);
    const lineEls = lines.map((r) => h('span', { class: 'hero__role' }, r));
    { let k = 0; lineEls.forEach((r) => { splitChars(r, k); k += r.textContent.length; }); }
    const el = h('section', { class: 'hero', id: p.id },
      h('div', { class: 'hero__cards' }, cards),
      h('h1', { class: `hero__roles is-${p.titleSize}` }, lineEls),
      p.subtitle ? h('p', { class: `hero__sub is-${p.subSize}` }, p.subtitle) : null,
      p.text ? h('p', { class: 'hero__text' }, p.text) : null,
      h('a', { class: 'hero__cue', href: 'home#work', 'data-link': '' }, p.cue || 'scroll', h('i', { 'aria-hidden': 'true' }, '↓')));
    // PC: statt des Kartenfächers das 3D-Karussell (querformatige Karten, groß, ziehbar, dreht langsam von selbst)
    if (matchMedia('(min-width: 900px)').matches && !still() && n >= 2) {
      const box = el.querySelector('.hero__cards'); el.classList.add('hero--car'); { const sh = (q, v) => { v = Number(v) || 0; if (v) el.style.setProperty(q, v + 'px'); }; sh('--car-y', p.carY); sh('--name-y', p.nameY); sh('--title-y', p.titleY); } el.style.setProperty('--cs', (1 + ((Number(p.carSize) || 1.6) - 1) * .3).toFixed(3)); box.replaceChildren();
      const all = (idx.order || []).map(sl => ({ slug: sl, ...idx.projects[sl] })).filter(x => x.image && !x.hidden);
      const labD = nameLabel(p, all); if (labD) { labD.el.classList.add('hn--d'); box.before(labD.el); }
      (window.tnEnterP || Promise.resolve()).then(() => requestAnimationFrame(() => el.isConnected && (carousel3d(box, all.map(x => ({ src: x.image, href: x.slug, title: String(x.title || x.slug).replace(/\n/g, ' ') })), { spread: Number(p.carSpread) || 1.5, zoom: Number(p.carSize) || 1.4, size: (r) => ({ w: Math.min(r.width * .46, r.height * 1.1 * 1.6), aspect: 1.6 }), fitAngle: 108, swerve: dirIn, onChange: (i) => labD && labD.set(i) }), fadeIn(box))));
    }
    if (still() || !p.cycle) { lineEls.forEach(r => r.classList.add('is-on')); if (still()) return el; }
    if (p.cycle) { let a = 0; const cycle = () => { lineEls.forEach((r, i) => r.classList.toggle('is-on', i === a)); a = (a + 1) % lineEls.length; };
      cycle(); const t = setInterval(() => { if (!el.isConnected) return clearInterval(t); cycle(); }, 1700); }
    if (isFinePointer()) addEventListener('pointermove', (e) => { el.style.setProperty('--px', (e.clientX / innerWidth * 2 - 1).toFixed(3)); el.style.setProperty('--py', (e.clientY / innerHeight * 2 - 1).toFixed(3)); }, { passive: true });
    track(el, (r, vh) => { el.style.setProperty('--hp', clamp(-r.top / (vh * .9)).toFixed(4)); });
    return el;
  },
};


// Projektname (dezent) + optionaler Kurztext + Knopf oben im Karussell; wechselt mit der vorderen Karte
function nameLabel(p, items) {
  if (p.showName === false || !items.length) return null;
  const t = h('strong', { class: 'hn__t' }), x = h('span', { class: 'hn__x' });
  const b = h('a', { class: 'hn__b', href: '#', 'data-link': '' }, p.nameBtn || 'view project', h('i', { 'aria-hidden': 'true' }, '→'));
  const inner = h('div', { class: 'hn__in' }, t, x, b), el = h('div', { class: 'hn' }, inner);
  let cur = -1;
  const set = (i) => {
    i = ((i % items.length) + items.length) % items.length; if (i === cur) return; const first = cur < 0; cur = i; const it = items[i];
    const apply = () => { t.textContent = String(it.title || it.slug).replace(/\n/g, ' '); x.textContent = it.heroText || ''; x.hidden = !it.heroText; b.href = it.slug; el.classList.remove('is-out'); };
    if (first) apply(); else { el.classList.add('is-out'); setTimeout(apply, 170); }
  };
  set(0); return { el, set };
}

// ---------- Handy-Intro: Vollbild ----------
// 1) Mosaik aller Projekte mit dem Titel davor. 2) Das erste ausgewählte Projekt wächst aus dem Mosaik auf Vollbild.
// 3) Die weiteren ausgewählten Projekte schieben sich nacheinander als Vollbild darüber – alles gesteuert durch das Scrollen.
// Einflug des Karussells: kommt aus einer zufälligen Richtung hereingeschwungen, dreht dabei und landet in der Mitte
const dirIn = Math.random() < .5 ? 1 : -1;
function fadeIn(el) {
  if (!el || !el.animate || still()) return;
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease-out', fill: 'backwards' });   // nur Opacity: läuft auf dem Compositor, kein Re-Raster der 3D-Karten
}
function swerveIn(el) {
  // Einflug von OBEN mit Einblenden (kein Weichzeichner: der ist auf großen 3D-Flächen teuer); die Drehung macht das Karussell selbst
  if (!el || !el.animate || still()) return;
  el.animate([{ transform: `translateY(-24vh) rotate(${dirIn * 5}deg) scale(.9)`, opacity: 0 }, { opacity: 1, offset: .5 }, { transform: 'none', opacity: 1 }], { duration: 1250, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
}
// Text in Wörter und Buchstaben zerlegen (für den Einflug-Effekt beim Seitenstart)
function splitChars(el, base = 0) {
  if (!el || el.dataset.split) return; el.dataset.split = '1'; let n = base;
  const txt = el.textContent; el.setAttribute('aria-label', txt); el.textContent = '';
  txt.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) { el.append(' '); return; }
    const word = document.createElement('span'); word.className = 'wd'; word.setAttribute('aria-hidden', 'true');
    for (const c of w) { const i = document.createElement('i'); i.className = 'ch'; i.style.setProperty('--d', (n++ * 22) + 'ms'); i.textContent = c; word.append(i); }
    el.append(word); });
}
const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
function mobileHero(p, ctx) {
  const idx = ctx.content.index;
  const all = (idx.order || []).map(s => ({ slug: s, ...idx.projects[s] })).filter(x => x.image && !x.hidden);
  if (all.length < 2) return null;
  let feat = all.filter(x => x.featured);
  if (!feat.length) feat = all.slice(0, Math.max(1, Math.min(8, Number(p.mobileCount) || 4)));
  const N = feat.length;
  const rest = all.filter(x => x !== feat[0]);
  const ring = [feat[0], ...rest];                              // vorne beginnt das erste ausgewählte Projekt
  const name = (x) => String(x.title || x.slug).replace(/\n/g, ' ');
  const carEl = h('div', { class: 'hm__car' });
  const cardSize = (r) => ({ w: Math.min(r.width * .6, r.height * .86 * .5625), aspect: .5625 });
  let car = null;
  const labM = nameLabel(p, ring); if (labM) labM.el.classList.add('hn--m');
  const lines = String(p.title || '').split('\n').map(s => s.trim()).filter(Boolean);
  const title = h('h1', { class: `hm__title is-${p.titleSize || 'l'}` }, lines.map(l => h('span', {}, l)));
  { let k = 0; [...title.children].forEach((r) => { splitChars(r, k); k += r.textContent.length; }); }
  const cue = h('p', { class: 'hm__cue' }, p.cue || 'scroll', h('i', { 'aria-hidden': 'true' }, '↓'));
  const shots = feat.map((f, i) => {
    const img = h('img', { src: f.imageMobile || f.image, alt: '', decoding: 'async' });
    const cap = h('div', { class: 'hm__cap' }, h('span', { class: 'hm__n' }, `${String(i + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`), h('strong', { class: 'hm__t' }, name(f)), f.roles ? h('em', { class: 'hm__r' }, f.roles) : null);
    const inn = h('div', { class: 'hm__in' }, h('div', { class: 'hm__img' }, img), h('i', { class: 'hm__shade' }), cap);
    const a = h('a', { class: 'hm__shot', href: f.slug, 'data-link': '', 'aria-label': name(f) }, inn);
    return { a, inn, iw: inn.firstChild, cap };
  });
  const stage = h('div', { class: 'hm__stage' }, carEl, labM ? labM.el : null, title, cue, shots.map(s => s.a));
  const OFF = .2, T = 0.8 + OFF + 1 + .6 + (N - 1) * 1.6 + .25;                 // Länge der Animation in "Einheiten"
  const el = h('section', { class: 'hm' + (labM ? ' hm--lab' : ''), 'aria-label': p.title || '', style: { '--len': (T * .5).toFixed(2) } }, h('div', { class: 'hm__track' }, stage));
  if (still()) { el.classList.add('is-still'); return el; }

  let W = 0, H = 0, R = null, frozen = false;
  const measure = () => {
    W = stage.clientWidth; H = stage.clientHeight; const cr = carEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const cs = cardSize(cr), cw = cs.w * 1.08, ch = cw / cs.aspect, cx = cr.left - sr.left + cr.width / 2, cy = cr.top - sr.top + cr.height / 2;
    const l = cx - cw / 2, t = cy - ch / 2; R = { t, r: W - l - cw, b: H - t - ch, l };
  };
  // Überschrift so verkleinern, dass die längste Zeile nie über den Rand ragt (egal ob Deutsch/Englisch oder wie groß eingestellt)
  const fitTitle = () => { title.style.fontSize = ''; const avail = stage.clientWidth - 2 * parseFloat(getComputedStyle(title).left || 20), need = Math.max(...[...title.children].map(s => s.scrollWidth));
    if (need > avail && need > 0) title.style.fontSize = (parseFloat(getComputedStyle(title).fontSize) * avail / need * .98).toFixed(1) + 'px';
    // Karussell endet immer oberhalb der Überschrift (egal wie viele Zeilen/wie groß)
    const th = Math.round(title.offsetHeight); if (th && String(th) !== el.dataset.th) { el.dataset.th = String(th); el.style.setProperty('--hmt', th + 'px'); R = null; kick(); } };
  requestAnimationFrame(fitTitle); [250, 900, 2200].forEach(t => setTimeout(fitTitle, t)); document.fonts && document.fonts.ready.then(fitTitle); addEventListener('resize', fitTitle, { passive: true });
  const open = (it) => { const a = document.createElement('a'); a.href = it.href; a.setAttribute('data-link', ''); a.hidden = true; document.body.append(a); a.click(); a.remove(); };
  (window.tnEnterP || Promise.resolve()).then(() => requestAnimationFrame(() => { car = carousel3d(carEl, ring.map(x => ({ src: x.imageMobile || x.image, href: x.slug, title: name(x) })), { size: cardSize, onFront: open, fitAngle: 100, light: true, swerve: dirIn, onChange: (i) => labM && labM.set(i) }); swerveIn(carEl); }));
  const apply = (u) => {
    if (!R) measure();
    const z = ease(clamp((u - 1) / 1)), rot = clamp((u - .04) / .96);
    // Phase 1: Das Karussell dreht per Scroll auf die erste Karte und zoomt dabei heran. Phase 2: diese Karte wächst auf Vollbild.
    if (car) { if (u > .02) car.scrub(rot); else car.release(); }
    carEl.style.transform = `scale(${(1 + .2 * ease(clamp(u / 1))).toFixed(4)})`; carEl.style.opacity = (1 - clamp((u - 1) / .75)).toFixed(3);
    carEl.style.display = z >= 1 ? 'none' : ''; if (labM) { labM.el.style.opacity = carEl.style.opacity; labM.el.style.visibility = z >= 1 ? 'hidden' : ''; labM.el.style.pointerEvents = u > .02 ? 'none' : ''; } carEl.style.pointerEvents = u > .02 ? 'none' : '';
    const dk = z > .12; if (dk !== stage.classList.contains('is-dark')) { stage.classList.toggle('is-dark', dk); dispatchEvent(new Event('tn-dark')); }
    const tOp = 1 - clamp((u - .15) / .55); title.style.opacity = tOp.toFixed(3); title.style.transform = `translateY(${(-(1 - tOp) * 26).toFixed(1)}px)`; cue.style.opacity = (1 - clamp(u / .25)).toFixed(3);
    title.style.visibility = cue.style.visibility = tOp <= 0 ? 'hidden' : 'visible';
    shots.forEach((s, i) => {
      const start = i === 0 ? 1 : 2.6 + (i - 1) * 1.6, e = ease(clamp((u - start) / 1));
      // Aufdecken rein per Transform (kein clip-path → kein Neuzeichnen des Vollbild-Bildes pro Frame, läuft auf der GPU)
      let bx = 0, by = 0, bw = W, bh = H, rad = 0;
      if (i === 0) { const k = 1 - e; bx = R.l * k; by = R.t * k; bw = W - (R.l + R.r) * k; bh = H - (R.t + R.b) * k; rad = 10 * k; s.a.style.opacity = clamp(e * 4).toFixed(3); }
      else { by = (1 - e) * H; bh = H - by; s.a.style.opacity = '1'; }
      const full = e >= 1, tf = full ? '' : `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0) scale(${(bw / W).toFixed(4)},${(bh / H).toFixed(4)})`;
      if (tf !== s.tf) { s.tf = tf; s.a.style.transform = tf; s.inn.style.transform = full ? '' : `scale(${(W / bw).toFixed(4)},${(H / bh).toFixed(4)}) translate3d(${(-bx).toFixed(1)}px,${(-by).toFixed(1)}px,0)`; s.a.style.borderRadius = rad > .2 ? `${(rad * W / bw).toFixed(2)}px / ${(rad * H / bh).toFixed(2)}px` : ''; }
      s.a.style.visibility = e > 0 ? 'visible' : 'hidden';
      // Bildschiebung des vorherigen Bildes, wenn das nächste kommt
      const nstart = 2.6 + i * 1.6, ne = i < N - 1 ? ease(clamp((u - nstart) / 1)) : 0;
      s.iw.style.transform = `translateY(${(-ne * 7).toFixed(2)}%)`;
      s.cap.style.opacity = (clamp((e - .55) / .3) * (1 - clamp(ne / .3))).toFixed(3);
      s.cap.style.transform = `translateY(${((1 - clamp((e - .55) / .3)) * 18).toFixed(1)}px)`;
    });
  };
  addEventListener('resize', () => { R = null; kick(); }, { passive: true });
  // Handy: Die Animation läuft nach dem Loslassen zu Ende und hält an jeder Vollbild-Karte an (Karussell → Karte 1 → Karte 2 …)
  { const trk = el.querySelector('.hm__track'), uStops = [0, 2]; for (let i = 1; i < N; i++) uStops.push(3.6 + (i - 1) * 1.6);
    registerStops(() => { if (!el.isConnected || !trk.offsetParent) return []; const top = trk.getBoundingClientRect().top + scrollY, run = trk.offsetHeight - stage.offsetHeight; return run > 50 ? uStops.map((u) => top + (u / T) * run) : []; }, true); }
  track(el.querySelector('.hm__track'), (r) => { apply(trackProgress(r, stage.offsetHeight) * T); });
  apply(0);
  return el;
}
