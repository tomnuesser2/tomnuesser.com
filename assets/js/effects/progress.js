// Scroll-Fortschritt ganz oben auf jeder Seite: dünne Leiste mit Hintergrundspur, auf hellem und dunklem Grund sichtbar (Differenz-Blendung).
export default {
  name: 'progress',
  init() {
    const bar = document.createElement('div'); bar.className = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('i'); bar.append(fill);
    document.body.append(bar);
    let t = false;
    const upd = () => { t = false; const m = document.documentElement.scrollHeight - innerHeight; fill.style.transform = `scaleX(${m > 0 ? Math.min(1, Math.max(0, scrollY / m)) : 0})`; };
    const req = () => { if (!t) { t = true; requestAnimationFrame(upd); } };
    addEventListener('scroll', req, { passive: true }); addEventListener('resize', req, { passive: true });
    // Seitenwechsel / nachladende Inhalte ändern die Seitenhöhe ohne Scroll-Ereignis
    if ('ResizeObserver' in window) new ResizeObserver(req).observe(document.body);
    req();
    return true;
  },
};
