// Statusleiste (Uhrzeit, Akku) am Handy: Die Seite läuft randlos bis unter die Notch (viewport-fit=cover + safe-area-Abstände im CSS).
// Damit Uhrzeit & Symbole lesbar bleiben, folgt <meta name="theme-color"> dem, was gerade ganz oben unter der Leiste liegt:
// heller Hintergrund → dunkle Symbole, dunkler Hintergrund (Videos, dunkle Abschnitte) → helle Symbole.
const LIGHT = '#fcfcfc', DARK = '#0b0b0c';
const lum = (c) => { const m = String(c).match(/[\d.]+/g); if (!m || m.length < 3) return null; if (m.length > 3 && Number(m[3]) < .5) return null; return (.2126 * m[0] + .7152 * m[1] + .0722 * m[2]) / 255; };

export default {
  name: 'statusbar',
  init() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    let cur = '', queued = false;
    const set = (c) => { if (c === cur) return; cur = c; meta.setAttribute('content', c); document.documentElement.style.setProperty('--statusbar', c); };
    const sample = () => {
      queued = false;
      const hd = document.querySelector('.site-header');
      if (hd && (hd.classList.contains('over-dark') || hd.classList.contains('over-fl-dark'))) return set(DARK);
      if (document.body.classList.contains('is-entering')) return set(LIGHT);
      let stack = []; try { stack = document.elementsFromPoint(innerWidth / 2, 1); } catch { /* */ }
      for (const el of stack) {
        if (el.closest?.('.site-header')) continue;
        if (el.getBoundingClientRect().width < innerWidth * .95) continue; // kleine Elemente (Buttons, Texte) zählen nicht als Hintergrund
        if (/^(VIDEO|IFRAME)$/.test(el.tagName)) return set(DARK);
        const l = lum(getComputedStyle(el).backgroundColor);
        if (l != null) return set(l < .45 ? DARK : LIGHT);
      }
      set(LIGHT);
    };
    const kick = () => { if (!queued) { queued = true; requestAnimationFrame(sample); } };
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick, { passive: true });
    new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.querySelector('.site-header') && new MutationObserver(kick).observe(document.querySelector('.site-header'), { attributes: true, attributeFilter: ['class'] });
    kick(); setTimeout(kick, 600);
    return true;
  },
  onPage() { setTimeout(() => { dispatchEvent(new Event('scroll')); }, 120); },
};
