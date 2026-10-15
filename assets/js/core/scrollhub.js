// Ein gemeinsamer Scroll-Takt für alle scrollgesteuerten Blöcke (statt vieler eigener Listener).
// track(el, fn): fn(rect, vh) läuft bei jedem Scroll, solange el in der Nähe des Bildschirms ist.
import { prefersReducedMotion } from './dom.js';
const subs = new Set(); let queued = false, bound = false;
const run = () => {
  queued = false; const vh = innerHeight, live = [];
  // 1) alle Maße lesen (ein einziges Layout), 2) erst danach die Blöcke zeichnen lassen – sonst erzwingt jeder Block ein neues Layout
  for (const s of subs) {
    if (!s.el.isConnected) { subs.delete(s); continue; }
    const r = s.el.getBoundingClientRect();
    if (r.bottom < -vh * .5 || r.top > vh * 1.5) continue;
    live.push([s, r]);
  }
  for (const [s, r] of live) { try { s.fn(r, vh); } catch (e) { console.error('[scrollhub]', e); } }
};
export const kick = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
export function track(el, fn) {
  subs.add({ el, fn });
  if (!bound) { bound = true; addEventListener('scroll', kick, { passive: true }); addEventListener('resize', kick, { passive: true }); }
  kick(); requestAnimationFrame(kick); setTimeout(() => initSnapStop(), 0);
}
export const still = () => prefersReducedMotion();
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// Fortschritt (0–1) durch eine hohe Scroll-Strecke mit klebender Bühne.
export const trackProgress = (r, stageH) => clamp(-r.top / Math.max(1, r.height - stageH));

// Handy: beim Scroll-Stopp den restlichen Schwung (Auslaufen des Wischens) entfernen und für ms den Scroll sperren – z. B. solange eine zeitgesteuerte Animation läuft.
// So rauscht man nicht an Abschnitten vorbei und die Animation landet immer im perfekten Bild. Am Computer (Maus) passiert nichts.
let holdT = 0, held = false;
const coarse = () => matchMedia('(pointer: coarse)').matches;
export function releaseScroll() {
  clearTimeout(holdT); if (!held) return; held = false;
  const de = document.documentElement; de.style.overflow = ''; de.style.overscrollBehavior = ''; document.body.style.overflow = '';
}
export function holdScroll(ms = 200) {
  if (!coarse() || ms <= 0) return;
  const de = document.documentElement, y = window.scrollY;
  if (!held) { held = true; de.style.overflow = 'hidden'; de.style.overscrollBehavior = 'none'; document.body.style.overflow = 'hidden'; window.scrollTo(0, y); }
  clearTimeout(holdT); holdT = setTimeout(releaseScroll, Math.min(9000, ms));
}

/* ---------- Handy: Anhalten an Abschnitten und Hero-Karten ----------
   Grundregel: EIN Wisch geht höchstens bis zum nächsten Anhaltepunkt (Abschnittsanfang oder Hero-Karte).
   - Android/Chrome: Der Schwung wird schon im Auslaufen am Punkt gestoppt ("Bremse").
   - iOS/Safari und alles andere: JS kann den Schwung dort nicht sicher abbrechen. Deshalb wird NACH dem Auslaufen geprüft,
     welchen Punkt der Wisch überfahren hat – und es gleitet zu GENAU diesem Punkt zurück (nicht zum übernächsten).
   - Kein Anhaltepunkt überfahren: leichter Wisch bleibt wo er ist, kräftiger Wisch kurz vor dem nächsten Punkt rastet dort ein.
   - Die Hero-Animation läuft nach dem Loslassen immer bis zur nächsten Karte zu Ende. */
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let samples = [], snapOn = false, snapWhy = 'nicht gestartet', lastY = 0, fingers = 0, snapping = false, gestY = 0, gestT = 0, relY = 0, flickG = false, touched = false, dirLast = 1, glideRaf = 0;
const stat = { brake: 0, settle: 0, back: 0, strong: 0, glide: 0, last: '-' };
const stopFns = [];
// Abschnitte können eigene Anhaltepunkte melden (absolute Scroll-Positionen). settle: Läuft eine Animation zwischen zwei Punkten, wird sie nach dem Loslassen zu Ende geführt.
export function registerStops(fn, settle = false) { const z = { fn, settle }; stopFns.push(z); return () => { const i = stopFns.indexOf(z); if (i >= 0) stopFns.splice(i, 1); }; }
function extraStops() { const o = []; for (const z of stopFns) { try { for (const v of z.fn() || []) o.push(Math.round(v)); } catch { /* weg */ } } return o; }
const isHome = () => !!document.querySelector('.page[data-page="home"]');
function snapTargets() {
  const out = [...extraStops()];
  if (isHome()) for (const b of document.querySelectorAll('.page[data-page="home"] > [data-bi]')) out.push(Math.round(b.getBoundingClientRect().top + scrollY));
  out.sort((a, b) => a - b);
  // Punkte, die fast aufeinander liegen (z. B. kleine Kapitel-Überschrift direkt vor dem Abschnitt), zählen als einer – der erste gilt
  const min = innerHeight * .15, res = [];
  for (const v of out) if (!res.length || v - res[res.length - 1] > min) res.push(v);
  return res;
}
const nextStop = (from, dir, list) => dir > 0 ? list.find((v) => v > from + 6) : [...list].reverse().find((v) => v < from - 6);
// eigenes sanftes Gleiten (überall gleich, unabhängig davon, ob der Browser "smooth" kann; Berührung bricht es ab)
function glide(top) {
  cancelAnimationFrame(glideRaf);
  const y0 = scrollY, dist = top - y0; if (Math.abs(dist) < 2) { snapping = false; return; }
  snapping = true; stat.glide++;
  const dur = clamp(230 + Math.abs(dist) * .42, 230, 640), t0 = performance.now();
  const step = (now) => {
    const t = clamp((now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
    window.scrollTo(0, y0 + dist * e);
    if (t < 1 && snapping) glideRaf = requestAnimationFrame(step); else { snapping = false; lastY = scrollY; touched = false; }
  };
  glideRaf = requestAnimationFrame(step);
}
export function snapInfo() {
  let list = []; try { list = snapTargets(); } catch { /* weg */ }
  return { on: snapOn, why: snapWhy, coarse: coarse(), ios: IOS, y: Math.round(scrollY), vh: innerHeight, fingers, touched, snapping, held, dir: dirLast, gestY: Math.round(gestY), flick: flickG, relY: Math.round(relY), stops: list.length, list: list.slice(0, 12).join(','), ...stat };
}
export function initSnapStop() {
  if (snapOn) return;
  if (!coarse()) { snapWhy = 'kein Touch (pointer: coarse = false)'; return; }
  if (prefersReducedMotion()) { snapWhy = 'Bewegung reduzieren ist am Gerät an'; return; }
  snapOn = true; snapWhy = 'ok'; lastY = scrollY;
  addEventListener('touchstart', (e) => { fingers = e.touches.length; touched = true; if (snapping) { snapping = false; cancelAnimationFrame(glideRaf); } if (fingers === 1) { gestY = scrollY; gestT = performance.now(); samples = []; } }, { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) { samples.push([t.clientY, performance.now()]); if (samples.length > 8) samples.shift(); } }, { passive: true });
  addEventListener('touchend', (e) => {
    fingers = e.touches.length;
    if (!fingers) {
      relY = scrollY; const now = performance.now(), last = samples[samples.length - 1], old = samples.find((q) => last && last[1] - q[1] <= 120);
      // Fingergeschwindigkeit beim Loslassen: schneller Wisch (Flick) = Schwung folgt
      const v = last && old && last[1] > old[1] && now - last[1] < 120 ? Math.abs(last[0] - old[0]) / (last[1] - old[1]) : 0; flickG = v > .6; stat.v = Math.round(v * 100) / 100;
    }
  }, { passive: true });
  addEventListener('touchcancel', () => { fingers = 0; relY = scrollY; flickG = false; }, { passive: true });
  let settleT = 0;
  const settle = () => {
    if (fingers || snapping || held || !touched) return;
    const y = scrollY, vh = innerHeight, from = flickG ? gestY : relY, dir = Math.abs(y - from) > 6 ? (y > from ? 1 : -1) : dirLast;   // Kurzer Wisch (Flick): zählt ab Berührungsbeginn, damit auch ein Anhaltepunkt anhält, den der Finger selbst schon überfahren hat
    touched = false;
    // 1) Hero (Animation zwischen Punkten): immer zum nächsten Punkt in Wischrichtung zu Ende laufen
    for (const z of stopFns) {
      if (!z.settle) continue; let st; try { st = (z.fn() || []).map(Math.round).sort((a, b) => a - b); } catch { continue; } if (st.length < 2) continue;
      if (y < st[0] - 4 || y > st[st.length - 1] + 4) continue; if (st.some((v) => Math.abs(v - y) <= 6)) return;
      const t = nextStop(from, dir, st) ?? nextStop(y, dir, st); if (t == null || Math.abs(t - y) > vh * 2.2) return;
      stat.settle++; stat.last = `hero ${Math.round(y)}→${t}`; glide(t); return;
    }
    if (!isHome()) return;
    // 2) Abschnittsanfänge: Wurde der nächste Anfang überfahren → genau dorthin zurück/hin. Sonst nur bei kräftigem Wisch kurz davor einrasten.
    const list = snapTargets(), s1 = nextStop(from, dir, list); if (s1 == null) return;
    const passed = dir > 0 ? y >= s1 - 6 : y <= s1 + 6;
    if (passed) { if (Math.abs(y - s1) > 2 && Math.abs(y - s1) <= vh * 1.6) { stat.back++; stat.last = `block ${Math.round(y)}→${s1}`; glide(s1); } return; }
    if (Math.abs(y - gestY) >= vh * .45 && Math.abs(s1 - y) < vh * .5) { stat.strong++; stat.last = `kräftig ${Math.round(y)}→${s1}`; glide(s1); }
  };
  addEventListener('scroll', () => {
    const y = scrollY, d = y - lastY; lastY = y; if (Math.abs(d) > 0) dirLast = d > 0 ? 1 : -1;
    clearTimeout(settleT); settleT = setTimeout(settle, 170);
    // Bremse im Auslaufen (nicht iOS: dort lässt sich der Schwung per Script nicht sicher stoppen)
    if (IOS || snapping || held || fingers || !touched || Math.abs(d) < 14 || !isHome()) return;
    const dir = d > 0 ? 1 : -1, vh = innerHeight;
    const hit = snapTargets().filter((v) => dir > 0 ? (v > y - d + 4 && v <= y + 4) : (v < y - d - 4 && v >= y - 4)).sort((a, b) => dir > 0 ? a - b : b - a)[0];
    if (hit == null || Math.abs(hit - y) > vh) return;
    stat.brake++; stat.last = `bremse ${Math.round(y)}→${hit}`; glide(hit);
  }, { passive: true });
}
