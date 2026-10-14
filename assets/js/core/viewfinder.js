import { h } from './dom.js';
import { mediaNode, openLightbox } from './reelKit.js';
import { still } from './scrollhub.js';

// „Sucher" – Handy-Darstellung für Bildreihen mit gemischten Formaten (9:16 und 16:9):
// Ein Kamera-Sucher mit Eckklammern zeigt immer ein Bild. Beim Wechsel zieht sich der Rahmen mit Federung auf das Format des nächsten
// Bildes (hoch ↔ quer), das neue Bild fokussiert sich ein (Zoom + Unschärfe), unten läuft ein Filmstreifen mit allen Bildern im echten Format.
const pad = (n) => String(n).padStart(2, '0');
export function mountFinder(host, { getList, aspOf, interval = 3600, title = '', text = '' }) {
  let abs = 0, snapT = 0, list = [], i = 0, W = 0, H = 0, t0 = 0, timer = 0, vis = false, held = false, tTouch = 0, layer = 0;
  const A = h('div', { class: 'pcs__l' }), B = h('div', { class: 'pcs__l' }); let cur = A;
  const frame = h('div', { class: 'pcs__f' }, A, B);
  const rec = h('span', { class: 'pcs__rec' }, h('i'), 'REC'), fmt = h('span', { class: 'pcs__fmt' }), cnt = h('span', { class: 'pcs__cnt' });
  const br = ['tl', 'tr', 'bl', 'br'].map(c => h('i', { class: `pcs__c pcs__c--${c}` }));
  const wrap = h('div', { class: 'pcs__w' }, frame, ...br, rec, fmt, cnt);
  const stage = h('div', { class: 'pcs__st' }, wrap);
  const cap = h('div', { class: 'pcs__cap' }), stripIn = h('div', { class: 'pcs__si' }), strip = h('div', { class: 'pcs__s' }, stripIn);
  const head = (title || text) ? h('div', { class: 'pcs__h' }, title ? h('h3', {}, title) : null, text ? h('p', {}, text) : null) : null;
  const root = h('div', { class: 'pcs' }, head, stage, cap, strip);
  host.append(root);

  const label = (a) => (a < .75 ? '9:16' : a > 1.4 ? '16:9' : a > .95 && a < 1.05 ? '1:1' : a < 1 ? '4:5' : '4:3');
  const sizeFor = (a) => {
    const aw = Math.max(120, W - 28), ah = Math.max(120, stage.clientHeight - 46);
    let w, hh; if (a >= 1) { w = aw; hh = w / a; if (hh > ah) { hh = ah; w = hh * a; } } else { hh = ah; w = hh * a; if (w > aw) { w = aw; hh = w / a; } }
    return [Math.round(w), Math.round(hh)];
  };
  function fillLayer(L, it) {
    L.textContent = ''; const m = mediaNode(it.src, 'pcs__m', it.title || ''); L.append(m); if (m.tagName === 'VIDEO') { m.play?.().catch(() => {}); }
  }
  function show(n, instant, jumpTo) {
    if (!list.length) return; const prevI = i; i = (n + list.length) % list.length; const it = list[i], a = aspOf(it.src), [w, hh] = sizeFor(a);
    const next = cur === A ? B : A; fillLayer(next, it);
    wrap.style.width = w + 'px'; wrap.style.height = hh + 'px';
    if (instant) { cur.classList.remove('is-on'); next.classList.add('is-on'); next.style.transition = 'none'; requestAnimationFrame(() => { next.style.transition = ''; }); }
    else { next.classList.remove('is-on', 'is-out'); void next.offsetWidth; next.classList.add('is-on'); cur.classList.remove('is-on'); cur.classList.add('is-out'); setTimeout(() => cur.classList.remove('is-out'), 700); }
    cur = next; fmt.textContent = label(a); cnt.textContent = `${pad(i + 1)} / ${pad(list.length)}`;
    cap.textContent = it.title || ''; cap.classList.toggle('is-on', !!it.title);
    centerStrip(instant, prevI, jumpTo);
  }
  // Endlos-Filmstreifen: alle Bilder dreimal hintereinander; nach dem Wechsel über die Kante springt der Streifen unsichtbar zurück in die Mitte
  function centerStrip(instant, prevI, jumpTo) {
    const n = list.length; if (!n || !stripIn.children.length) return;
    if (jumpTo != null) abs = jumpTo;
    else if (instant || prevI == null) abs = n + i;
    else { let d = (i - prevI + n) % n; if (d > n / 2) d -= n; abs += d; }
    const place = (noAnim) => { const t = stripIn.children[abs]; if (!t) return; [...stripIn.children].forEach((c, k) => c.classList.toggle('is-cur', k === abs)); const x = t.offsetLeft + t.offsetWidth / 2; if (noAnim) stripIn.style.transition = 'none'; stripIn.style.transform = `translateX(${Math.round(strip.clientWidth / 2 - x)}px)`; if (noAnim) { void stripIn.offsetWidth; stripIn.style.transition = ''; } };
    place(!!instant); clearTimeout(snapT);
    if (abs < n || abs >= 2 * n) snapT = setTimeout(() => { while (abs >= 2 * n) abs -= n; while (abs < n) abs += n; place(true); }, 640);
  }
  function buildStrip() {
    stripIn.textContent = '';
    [0, 1, 2].forEach((copy) => list.forEach((it, k0) => { const k = k0 + copy * list.length; const a = aspOf(it.src), th = 54, tw = Math.round(th * Math.max(.5, Math.min(2, a))); const m = mediaNode(it.src, 'pcs__tm', ''); const b = h('button', { type: 'button', class: 'pcs__t', style: { width: tw + 'px', height: th + 'px' }, 'aria-label': it.title || String(k + 1) }, m); b.addEventListener('click', () => { restart(); show(k0, false, k); }); stripIn.append(b); }));
  }
  const restart = () => { clearTimeout(timer); tTouch = performance.now(); if (vis && !still()) timer = setTimeout(autoNext, interval); };
  const autoNext = () => { if (!vis || held || still() || document.hidden) { timer = setTimeout(autoNext, 800); return; } show(i + 1); timer = setTimeout(autoNext, interval); };
  // Wischen: links/rechts wechselt das Bild (senkrecht scrollt weiter die Seite)
  let px = null, py = 0, moved = false;
  stage.addEventListener('pointerdown', (e) => { if (e.button > 0) return; px = e.clientX; py = e.clientY; moved = false; held = true; });
  addEventListener('pointermove', (e) => { if (px == null) return; const dx = e.clientX - px; if (!moved && Math.abs(e.clientY - py) > 10 && Math.abs(e.clientY - py) > Math.abs(dx)) { px = null; held = false; return; } if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - py)) { moved = true; wrap.style.transition = 'none'; wrap.style.transform = `translateX(${(dx * .35).toFixed(1)}px) rotate(${(dx * .012).toFixed(2)}deg)`; } }, { passive: true });
  const up = (e) => {
    if (px == null) return; const dx = e.clientX - px; px = null; held = false; wrap.style.transition = ''; wrap.style.transform = '';
    if (moved && Math.abs(dx) > 40) { restart(); show(i + (dx < 0 ? 1 : -1)); }
    else if (!moved && list[i]) openLightbox(list, i);
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', () => { px = null; held = false; wrap.style.transform = ''; });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { vis = e.isIntersecting; clearTimeout(timer); if (vis) restart(); }, { threshold: .25 }).observe(host); else vis = true;

  return {
    layout(w, hh) { W = w; H = hh; root.style.height = hh + 'px'; show(i, true); },
    refresh() { const keep = list[i] && list[i].src; list = getList().slice(); if (keep) { const k = list.findIndex(x => x.src === keep); i = k >= 0 ? k : 0; } buildStrip(); show(i, true); },
    destroy() { clearTimeout(timer); root.remove(); },
  };
}
