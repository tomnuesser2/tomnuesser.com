import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { parseVimeo, vimeoThumb } from '../core/media.js';
// Short-form & Long-form: Smartphone (klein) und Laptop (groß) stehen gleichzeitig im Bild. Was angeklickt wird, kommt animiert nach vorn
// und läuft dort durch seine Einträge (Bilder nach "Dauer", Videos in ihrer eigenen Länge). Rechts steht nur kurz, was man sieht.
const isVideo = (s) => /\.(mp4|webm|mov)(\?|$)/i.test(s || '');
const LIST = [
  { name: 'vimeo', label: 'Vimeo-Link (z. B. https://vimeo.com/123456789) – läuft automatisch, stumm, bis zum Ende', type: 'text' },
  { name: 'src', label: 'oder Datei: Video (.mp4/.webm, volle Länge) oder Bild', type: 'image' },
  { name: 'title', label: 'Titel (kurz)', type: 'text' },
  { name: 'text', label: 'Kurztext (eine Zeile)', type: 'text' },
  { name: 'duration', label: 'Dauer in Sekunden (nur bei Bildern; bei Vimeo nur Notlösung, falls das Video nicht meldet, dass es zu Ende ist)', type: 'number', default: 4 },
];

export default {
  type: 'deviceSwitch', label: 'Short-form + Long-form (Smartphone & Laptop zusammen)',
  fields: [
    { name: 'kicker', label: 'Kleine Zeile', type: 'text', default: 'video formats', de: 'Videoformate' },
    { name: 'front', label: 'Wer startet vorne?', type: 'select', options: ['phone', 'laptop'], default: 'phone' },
    { name: 'shortTitle', label: 'Name Smartphone', type: 'text', default: 'Short-form', de: 'Short-Form' },
    { name: 'shortText', label: 'Kurztext Smartphone', type: 'text', default: 'Vertical stories for Reels, Shorts & ads.', de: 'Hochkant-Stories für Reels, Shorts & Ads.' },
    { name: 'shortItems', label: 'Smartphone-Einträge (Hochformat; Reihenfolge = Ablauf)', type: 'list', itemFields: LIST },
    { name: 'longTitle', label: 'Name Laptop', type: 'text', default: 'Long-form', de: 'Long-Form' },
    { name: 'longText', label: 'Kurztext Laptop', type: 'text', default: 'Live sessions & event films in full length.', de: 'Live-Sessions & Eventfilme in voller Länge.' },
    { name: 'longItems', label: 'Laptop-Einträge (Querformat; Reihenfolge = Ablauf)', type: 'list', itemFields: LIST },
    { name: 'ctaText', label: 'Großer Button unten: Text (leer = kein Button)', type: 'text', default: 'my recent work', de: 'meine aktuellen Arbeiten' },
    { name: 'ctaLink', label: 'Großer Button unten: Ziel (Seite, z. B. projects)', type: 'text', default: 'projects' },
    { name: 'auto', label: 'Automatisch durchschalten', type: 'checkbox', default: true },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const ok = (i) => i.src || parseVimeo(i.vimeo);
    const items = { phone: (p.shortItems || []).filter(ok), laptop: (p.longItems || []).filter(ok) };
    const S = { phone: { cur: 0, shots: [], el: null }, laptop: { cur: 0, shots: [], el: null } };
    let front = items[p.front] && items[p.front].length ? p.front : (items.phone.length ? 'phone' : 'laptop'), timer, raf, visible = false;

    const bars = h('div', { class: 'dd__bars' });
    const pScr = h('div', { class: 'dd__scr' });
    const phone = h('button', { type: 'button', class: 'dd__phone', 'aria-label': p.shortTitle }, h('div', { class: 'dd__pscreen' }, pScr, bars), h('span', { class: 'dd__island' }));
    const lScr = h('div', { class: 'dd__scr' }), lBar = h('i', { class: 'dd__pb' }), lTitle = h('span', { class: 'dd__lt' });
    const laptop = h('button', { type: 'button', class: 'dd__laptop', 'aria-label': p.longTitle },
      h('div', { class: 'dd__lid' }, h('div', { class: 'dd__lscreen' }, lScr, h('div', { class: 'dd__player' }, h('b', {}, '▶'), lTitle, h('span', { class: 'dd__tl' }, lBar)))), h('div', { class: 'dd__base' }));
    S.phone.el = pScr; S.laptop.el = lScr;
    const dev = h('div', { class: 'dd__dev' }, laptop, phone);
    const k = h('p', { class: 'dd__k' }, p.kicker), gT = h('h2', { class: 'dd__h' }), gX = h('p', { class: 'dd__p' });
    const iT = h('h3', { class: 'dd__it' }), iX = h('p', { class: 'dd__ix' }), item = h('div', { class: 'dd__item' }, iT, iX);
    const sw = ['phone', 'laptop'].map(m => h('button', { type: 'button', class: 'dd__sw', 'data-m': m, 'aria-label': m === 'phone' ? p.shortTitle : p.longTitle }, h('i', {})));
    const cta = p.ctaText ? h('a', { class: 'cta dd__cta', href: p.ctaLink || 'projects', 'data-link': '', 'data-magnetic': '1' }, h('span', {}, p.ctaText), h('i', { 'aria-hidden': 'true' }, '→')) : null;
    const el = h('section', { class: 'dd', id: p.id }, h('div', { class: 'dd__stage' }, dev, h('div', { class: 'dd__copy' }, k, h('div', { class: 'dd__dots' }, sw), gT, gX, item)), cta);

    // Screens aufbauen
    for (const m of ['phone', 'laptop']) {
      S[m].shots = items[m].map(it => {
        const vm = parseVimeo(it.vimeo), v = !vm && isVideo(it.src);
        const node = vm ? h('div', { class: 'dd__vm' }) : v ? h('video', { src: it.src, muted: '', playsinline: '', preload: 'metadata', 'aria-hidden': 'true' }) : h('img', { src: it.src, alt: '', decoding: 'async', loading: 'lazy' });
        if (v) { node.muted = true; node.defaultMuted = true; }
        if (vm) vimeoThumb(vm).then(t => { if (t) node.style.background = `#000 url("${t}") center / cover no-repeat`; }).catch(() => {});
        const s = h('div', { class: 'dd__shot' }, node); S[m].el.append(s); return s;
      });
    }
    bars.replaceChildren(...items.phone.map(() => h('i', {}, h('b', {}))));

    const clearT = () => { clearTimeout(timer); cancelAnimationFrame(raf); if (vmH) { removeEventListener('message', vmH); vmH = null; } };
    let vmH = null;
    const fill = (m, f) => { if (m === 'laptop') lBar.style.transform = `scaleX(${f})`; else { const b = bars.children[S.phone.cur]; if (b) b.firstChild.style.transform = `scaleX(${f})`; } };
    const show = (m, i, play = true) => {
      const list = items[m]; if (!list.length) return; const st = S[m];
      st.cur = (i + list.length) % list.length;
      st.shots.forEach((s, n) => { s.classList.toggle('is-on', n === st.cur); const v = s.querySelector('video'); if (v && n !== st.cur) { v.pause(); } const vf = s.querySelector('.dd__vm'); if (vf && n !== st.cur) vf.replaceChildren(); });
      if (m === 'phone') [...bars.children].forEach((b, n) => { b.firstChild.style.transform = `scaleX(${n < st.cur ? 1 : 0})`; });
      else lBar.style.transform = 'scaleX(0)';
      lTitle.textContent = items.laptop[S.laptop.cur] ? items.laptop[S.laptop.cur].title || '' : '';
      if (m === front) { const it = list[st.cur]; iT.textContent = it.title || ''; iX.textContent = it.text || ''; item.classList.remove('is-in'); void item.offsetWidth; item.classList.add('is-in'); if (play) run(); }
    };
    // Fortschritt: Video = eigene Länge, Bild = Dauer
    const run = () => {
      clearT(); const m = front, st = S[m], list = items[m]; if (!list.length) return;
      const it = list[st.cur], shot = st.shots[st.cur], v = shot && shot.querySelector('video'), vm = parseVimeo(it.vimeo);
      const next = () => { if (!visible || front !== m) return; if (list.length > 1 || v) show(m, st.cur + 1); };
      if (vm) {
        // Vimeo: stumm, automatisch, ohne Bedienelemente; weiter zum nächsten Eintrag, sobald das Video zu Ende ist
        const host = shot.querySelector('.dd__vm'); host.replaceChildren();
        const q = new URLSearchParams({ autoplay: '1', muted: '1', controls: '0', api: '1', playsinline: '1', dnt: '1', autopause: '0', title: '0', byline: '0', portrait: '0', loop: list.length === 1 ? '1' : '0' }); if (vm.hash) q.set('h', vm.hash);
        const ifr = h('iframe', { src: `https://player.vimeo.com/video/${vm.id}?${q}`, allow: 'autoplay; fullscreen', tabindex: '-1', 'aria-hidden': 'true', title: it.title || 'Video', class: 'dd__vf' });
        host.append(ifr); fill(m, 0);
        const post = (o) => { try { ifr.contentWindow.postMessage(JSON.stringify(o), 'https://player.vimeo.com'); } catch { /* weg */ } };
        let got = false;
        vmH = (e) => {
          if (e.source !== ifr.contentWindow) return; let d = e.data; try { if (typeof d === 'string') d = JSON.parse(d); } catch { return; }
          if (d.event === 'ready') { got = true; clearTimeout(timer); post({ method: 'addEventListener', value: 'finish' }); post({ method: 'addEventListener', value: 'playProgress' }); post({ method: 'setMuted', value: true }); }
          else if (d.event === 'playProgress') { got = true; fill(m, Math.min(1, (d.data && d.data.percent) || 0)); }
          else if (d.event === 'finish') { if (list.length > 1) next(); }
        };
        addEventListener('message', vmH);
        timer = setTimeout(() => { if (!got && list.length > 1) next(); }, Math.max(4, Number(it.duration) || 20) * 1000);
      } else if (v) {
        v.currentTime = 0; v.play().catch(() => {});
        const tick = () => { if (front !== m) return; const d = v.duration || 0; if (d) fill(m, Math.min(1, v.currentTime / d)); if (v.ended || (d && v.currentTime >= d - .05)) { if (list.length > 1) next(); else { v.currentTime = 0; v.play().catch(() => {}); } } raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      } else if (p.auto && !still() && list.length > 1) {
        const dur = Math.max(1.5, Number(it.duration) || 4) * 1000, t0 = performance.now();
        const tick = (t) => { if (front !== m) return; const f = Math.min(1, (t - t0) / dur); fill(m, f); if (f >= 1) next(); else raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      }
    };
    const setFront = (m) => {
      if (!items[m].length && items[m === 'phone' ? 'laptop' : 'phone'].length) return;
      front = m; el.dataset.front = m; sw.forEach(s => s.classList.toggle('is-on', s.dataset.m === m));
      gT.textContent = m === 'phone' ? p.shortTitle : p.longTitle; gX.textContent = m === 'phone' ? p.shortText : p.longText;
      ['phone', 'laptop'].forEach(x => { if (x !== m) { S[x].shots.forEach(s => s.querySelector('video')?.pause()); } });
      show(m, S[m].cur);
    };
    // Bedienung: nicht vorne → nach vorn holen; vorne → Handy: links/rechts tippen, Laptop: nächster Eintrag
    phone.addEventListener('click', (e) => { if (front !== 'phone') return setFront('phone'); const r = phone.getBoundingClientRect(); show('phone', S.phone.cur + (e.clientX < r.left + r.width * .35 ? -1 : 1)); });
    laptop.addEventListener('click', () => { if (front !== 'laptop') return setFront('laptop'); show('laptop', S.laptop.cur + 1); });
    sw.forEach(s => s.addEventListener('click', () => setFront(s.dataset.m)));
    el.dataset.front = front; setFront(front); show(front === 'phone' ? 'laptop' : 'phone', 0, false);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { es.forEach(e => { visible = e.isIntersecting; if (visible) run(); else { clearT(); ['phone', 'laptop'].forEach(x => S[x].shots.forEach(s => s.querySelector('video')?.pause())); } }); }, { threshold: .3 }).observe(el);
    else visible = true;
    return el;
  },
};
