// Header blendet beim Runterscrollen aus und beim Hochscrollen wieder ein.
export default {
  name: 'headerHide',
  init() {
    let last = scrollY, t = false;
    const upd = () => {
      t = false;
      const header = document.querySelector('.site-header'); if (!header) return;
      const y = Math.max(0, scrollY), d = y - last;
      if (Math.abs(d) > 6) { header.classList.toggle('is-hidden', d > 0 && y > 160); last = y; }
      if (y < 40) header.classList.remove('is-hidden');
    };
    addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(upd); } }, { passive: true });
    return true;
  },
};
