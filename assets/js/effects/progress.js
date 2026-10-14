// Scroll-Fortschritt ganz oben auf jeder Seite: dünne Leiste mit Hintergrundspur, auf hellem und dunklem Grund sichtbar (heller Balken mit dunklem Rand).
export default {
  name: 'progress',
  init() {
    const bar = document.createElement('div'); bar.className = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('i'); bar.append(fill);
    document.body.append(bar);
    let t = false, max = 0;
    // Die Seitenhöhe wird nur bei Größenänderung gemessen, nicht bei jedem Scroll (sonst erzwingt jeder Frame ein Layout)
    const measure = () => { max = document.documentElement.scrollHeight - innerHeight; req(); };
    const upd = () => { t = false; fill.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0})`; };
    const req = () => { if (!t) { t = true; requestAnimationFrame(upd); } };
    addEventListener('scroll', req, { passive: true }); addEventListener('resize', measure, { passive: true });
    // Seitenwechsel / nachladende Inhalte ändern die Seitenhöhe ohne Scroll-Ereignis
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
    measure();
    return true;
  },
};
