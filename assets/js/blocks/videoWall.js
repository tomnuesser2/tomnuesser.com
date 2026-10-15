import { h } from '../core/dom.js';
import { still } from '../core/scrollhub.js';
import { parseVimeo, parseYouTube, videoCfg } from '../core/media.js';

// Reel-Wand: 1–8 Videos gleichzeitig. Alle laufen stumm in Schleife, eines ist im Fokus (breit, mit Ton) – die anderen bleiben als Streifen daneben lebendig.
// Quellen: eigene Datei (z. B. media/reel-1.mp4) ODER Vimeo-/YouTube-Link. Nur sichtbare Videos laufen (spart Akku und Datenvolumen).
const ITEM = [
  { name: 'video', label: 'Video (Datei aus media/ wählen oder Vimeo-/YouTube-Link einfügen)', type: 'image', default: '' },
  { name: 'poster', label: 'Vorschaubild (optional, erscheint bis das Video läuft)', type: 'image', default: '' },
  { name: 'title', label: 'Titel (optional, z. B. Spiel oder Szene)', type: 'text', default: '' },
  { name: 'tag', label: 'Kleine Marke oben (optional, z. B. 01 oder Finale)', type: 'text', default: '' },
];
const LAYOUTS = ['Akkordeon (Fokus)', 'Fächer', 'Raster'];
const FORMATS = ['9:16 hochkant (Reels)', '16:9 quer'];
const OTHERS = ['laufen stumm weiter', 'pausieren, solange eines im Fokus ist'];
const ICO = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>',
  snd: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path d="M15 8.5a5 5 0 0 1 0 7M17.6 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const num = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));
const vol = () => Math.max(0, Math.min(100, Number(videoCfg.volume) || 40));

// Ein Abspieler, egal ob Datei oder Einbettung: { el, load(), play(), pause(), mute(bool) }
function makePlayer(src, poster, onLive) {
  const yt = parseYouTube(src), vm = yt ? null : (/vimeo\.com|^\d{6,}$/i.test(src) ? parseVimeo(src) : null);
  if (!yt && !vm) {
    const v = h('video', { class: 'vw__media', loop: true, muted: true, playsinline: true, preload: 'none', poster: poster || null, src, 'aria-hidden': 'true', tabindex: '-1' });
    v.muted = true; v.setAttribute('webkit-playsinline', ''); v.addEventListener('playing', () => onLive && onLive());
    return { el: v, load() { if (v.preload === 'none') v.preload = 'metadata'; }, play() { const r = v.play(); if (r && r.catch) r.catch(() => {}); }, pause() { v.pause(); }, mute(b) { v.muted = b; if (!b) v.volume = vol() / 100; } };
  }
  let ifr = null, ready = false; const want = { play: false, muted: true }, wrap = h('div', { class: 'vw__media vw__embed' });
  const send = (o) => { if (!ifr || !ready) return; try { ifr.contentWindow.postMessage(JSON.stringify(o), yt ? 'https://www.youtube-nocookie.com' : 'https://player.vimeo.com'); } catch { /* weg */ } };
  const apply = () => {
    if (yt) { send({ event: 'command', func: want.muted ? 'mute' : 'unMute', args: [] }); if (!want.muted) send({ event: 'command', func: 'setVolume', args: [vol()] }); send({ event: 'command', func: want.play ? 'playVideo' : 'pauseVideo', args: [] }); }
    else { send({ method: 'setMuted', value: want.muted }); if (!want.muted) send({ method: 'setVolume', value: vol() / 100 }); send({ method: want.play ? 'play' : 'pause' }); }
  };
  return {
    el: wrap,
    load() {
      if (ifr) return;
      const q = new URLSearchParams(yt ? { autoplay: '1', mute: '1', loop: '1', playlist: yt.id, controls: '0', rel: '0', playsinline: '1', modestbranding: '1', disablekb: '1', enablejsapi: '1' }
        : { autoplay: '1', loop: '1', muted: '1', controls: '0', title: '0', byline: '0', portrait: '0', dnt: '1', playsinline: '1', autopause: '0', api: '1' });
      if (vm && vm.hash) q.set('h', vm.hash);
      ifr = h('iframe', { src: yt ? `https://www.youtube-nocookie.com/embed/${yt.id}?${q}` : `https://player.vimeo.com/video/${vm.id}?${q}`, allow: 'autoplay; fullscreen; picture-in-picture', tabindex: '-1', 'aria-hidden': 'true', title: 'Video', loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin' });
      ifr.addEventListener('load', () => { ready = true; apply(); setTimeout(apply, 500); setTimeout(apply, 1600); });
      wrap.append(ifr);
    },
    play() { want.play = true; apply(); if (onLive) setTimeout(onLive, 1200); }, pause() { want.play = false; apply(); }, mute(b) { want.muted = b; apply(); },
  };
}

let cssDone = false;
function css() {
  if (cssDone || document.getElementById('vw-css')) return; cssDone = true;
  const s = document.createElement('style'); s.id = 'vw-css';
  s.textContent = `
.vw{position:relative;width:min(100% - 2*var(--gutter,20px),1500px);margin:calc(var(--header-h,76px) * .5 + 8px) auto clamp(16px,3vw,40px);color:#fff;--vwh:620px;--vwg:3;--acc:#ff6a4d;--ar:9/16;--arn:.5625;scroll-margin-top:calc(var(--header-h,76px) + 14px)}
.vw--land{--ar:16/9;--arn:1.7778}
.vw--full{width:100%}
.vw__stagebg{border-radius:22px;padding:clamp(14px,2.4vw,30px);background:#0b0b0c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.vw--light .vw__stagebg{background:#f1f1ee;box-shadow:inset 0 0 0 1px rgba(0,0,0,.07);color:#111}
.vw--clear .vw__stagebg{background:transparent;box-shadow:none;padding-left:0;padding-right:0}
.vw__head{position:relative;z-index:60;margin:0 0 clamp(12px,2vw,22px);font-size:clamp(20px,3vw,34px);font-weight:500;letter-spacing:-.02em}
.vw__row{display:flex;gap:10px;height:var(--vwh);align-items:stretch}
.vw__c{position:relative;flex:1 1 0;min-width:0;border-radius:16px;overflow:hidden;background:#17181b;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;isolation:isolate;
  transition:flex-grow .75s cubic-bezier(.2,.8,.2,1),filter .5s ease,transform .6s cubic-bezier(.2,.8,.2,1),translate .8s cubic-bezier(.2,.8,.2,1),opacity .7s ease;opacity:0;translate:0 34px}
.vw.is-in .vw__c{opacity:1;translate:none;transition-delay:0s,0s,0s,calc(var(--i)*70ms),calc(var(--i)*70ms)}
.vw.is-ready .vw__c{transition-delay:0s}
.vw--acc .vw__c.is-focus{flex-grow:var(--vwg)}
.vw--acc .vw__c:not(.is-focus){filter:saturate(.55) brightness(.7)}
.vw--acc .vw__c:not(.is-focus):hover{filter:saturate(.9) brightness(.9)}
.vw__media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border:0;display:block;background:#17181b}
.vw__embed{container-type:size;overflow:hidden}
.vw__embed iframe{position:absolute;left:50%;top:50%;aspect-ratio:var(--ar);width:max(100cqw,calc(100cqh*var(--arn)));height:auto;transform:translate(-50%,-50%);border:0;pointer-events:none}
.vw__poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;transition:opacity .5s ease}
.vw__c.is-live .vw__poster{opacity:0;pointer-events:none}
.vw__shade{position:absolute;inset:0;z-index:2;background:linear-gradient(180deg,rgba(0,0,0,.45),transparent 28%,transparent 55%,rgba(0,0,0,.7));pointer-events:none}
.vw__tag{position:absolute;left:12px;top:12px;z-index:3;font:600 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;padding:6px 8px;border-radius:99px;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.vw__cap{position:absolute;left:14px;right:14px;bottom:14px;z-index:3;font-size:clamp(13px,1.3vw,17px);font-weight:500;letter-spacing:-.01em;text-shadow:0 1px 10px rgba(0,0,0,.6);transition:opacity .4s ease,transform .5s cubic-bezier(.2,.8,.2,1)}
.vw--acc .vw__c:not(.is-focus) .vw__cap{opacity:0;transform:translateY(8px)}
.vw__btns{position:absolute;right:10px;top:10px;z-index:4;display:flex;gap:6px;opacity:0;transition:opacity .25s ease}
.vw__c:hover .vw__btns,.vw__c:focus-visible .vw__btns,.vw__c.is-focus .vw__btns,.vw--touch .vw__btns{opacity:1}
.vw--acc .vw__c:not(.is-focus) .vw__btns{display:none}
.vw__b{width:34px;height:34px;border:0;border-radius:50%;display:grid;place-items:center;color:#fff;background:rgba(0,0,0,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer;padding:0}
.vw__b svg{width:18px;height:18px;fill:currentColor}
.vw__b:hover{background:var(--acc)}
.vw__c.is-paused .vw__tag::after{content:' · pause'}
.vw__c.is-focus::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2px var(--acc);z-index:5;pointer-events:none}
.vw__all{margin:14px auto 0;display:flex;justify-content:center}
.vw__all button{font:600 13px system-ui;border:1px solid currentColor;background:transparent;color:inherit;border-radius:99px;padding:9px 16px;cursor:pointer;display:flex;gap:8px;align-items:center;opacity:.85}
.vw__all button:hover{opacity:1;background:var(--acc);border-color:var(--acc);color:#fff}
.vw__all svg{width:14px;height:14px;fill:currentColor}
/* Fächer */
.vw--fan .vw__row{position:relative;display:block;perspective:1600px;margin:34px 0 26px}
.vw--fan .vw__c{position:absolute;left:50%;top:50%;height:100%;aspect-ratio:var(--ar);width:auto;flex:none;margin-left:calc(var(--vwh)*var(--arn)*-.5);margin-top:calc(var(--vwh)*-.5);
  transform:translateX(calc(var(--k)*var(--spread)*1px)) translateY(calc(var(--k)*var(--k)*26px)) rotate(calc(var(--k)*7deg)) scale(.86);transform-origin:50% 120%;z-index:calc(20 - var(--abs))}
.vw--fan .vw__c.is-focus{transform:translateX(calc(var(--k)*var(--spread)*1px)) translateY(-14px) rotate(0) scale(1);z-index:40}
.vw--fan .vw__c:not(.is-focus){filter:brightness(.75)}
/* Raster */
.vw--grid .vw__row{height:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(clamp(150px,18vw,230px),1fr));justify-content:center}
.vw--grid .vw__c{aspect-ratio:var(--ar);flex:none}
.vw--land.vw--grid .vw__row{grid-template-columns:repeat(auto-fit,minmax(clamp(180px,22vw,320px),1fr))}
.vw--grid .vw__c.is-focus{transform:scale(1.03);z-index:2}
/* Fächer: nur die Fokus-Karte zeigt Knöpfe/Text */
.vw--fan .vw__c:not(.is-focus) .vw__btns{display:none}
.vw--fan .vw__c:not(.is-focus) .vw__cap{opacity:0}
/* Smartphone: immer Fächer, Antippen = groß */
@media (max-width:759px){
  .vw{margin:20px auto}
  .vw__stagebg{padding:12px 6px 14px;border-radius:18px}
  .vw__head{margin-bottom:6px;padding-left:8px}
  .vw--fan .vw__c:not(.is-focus){transform:translateX(calc(var(--k)*var(--spread)*1px)) translateY(calc(var(--k)*var(--k)*18px)) rotate(calc(var(--k)*6deg)) scale(.74)}
  .vw__btns{opacity:1}
}
@media (prefers-reduced-motion:reduce){.vw__c{transition:none!important;opacity:1;translate:none}}
`;
  document.head.append(s);
}

export default {
  type: 'videoWall',
  label: 'Reel-Wand (1–8 Videos gleichzeitig, eines im Fokus)',
  fields: [
    { name: 'title', label: 'Überschrift (optional)', type: 'text', default: '' },
    { name: 'items', label: 'Videos (1 bis 8)', type: 'list', itemFields: ITEM, multiLabel: '+ Mehrere Videos auf einmal hochladen (jedes wird ein Eintrag)', default: [] },
    { name: 'format', label: 'Format der Videos (Ränder werden zugeschnitten, nichts bleibt schwarz)', type: 'select', options: FORMATS, default: FORMATS[0] },
    { name: 'layout', label: 'Anordnung', type: 'select', options: LAYOUTS, default: LAYOUTS[0] },
    { name: 'others', label: 'Die anderen Videos, wenn eines im Fokus ist', type: 'select', options: OTHERS, default: OTHERS[0] },
    { name: 'sound', label: 'Fokus-Video bekommt Ton (nach Antippen/Klick)', type: 'checkbox', default: true },
    { name: 'allBtn', label: 'Knopf „alle pausieren / abspielen“ unter der Wand', type: 'checkbox', default: true },
    { name: 'height', label: 'Maximale Höhe in px (wird automatisch an den Bildschirm angepasst, bei Querformat niedriger)', type: 'number', default: 620 },
    { name: 'accent', label: 'Akzentfarbe (Rahmen/Knöpfe)', type: 'text', default: '#ff6a4d' },
    { name: 'width', label: 'Breite', type: 'select', options: ['Rahmen', 'volle Breite'], default: 'Rahmen' },
    { name: 'bg', label: 'Hintergrund', type: 'select', options: ['dunkel', 'hell', 'transparent'], default: 'dunkel' },
  ],
  render(p0) {
    css();
    const p = { format: FORMATS[0], layout: LAYOUTS[0], others: OTHERS[0], sound: true, allBtn: true, height: 620, accent: '#ff6a4d', width: 'Rahmen', bg: 'dunkel', ...p0 };
    const items = (p.items || []).filter((i) => i && String(i.video || '').trim()).slice(0, 8);
    const land = p.format === FORMATS[1], ar = land ? 16 / 9 : 9 / 16, H0 = Math.round(num(p.height, 620) * (land ? .56 : 1));
    const baseMode = p.layout === LAYOUTS[1] ? 'fan' : p.layout === LAYOUTS[2] ? 'grid' : 'acc', mq = matchMedia('(max-width:759px)');
    const modeNow = () => (mq.matches ? 'fan' : baseMode); let mode = modeNow();
    const el = h('div', { class: `vw vw--${mode}${land ? ' vw--land' : ''}${p.bg === 'hell' ? ' vw--light' : p.bg === 'transparent' ? ' vw--clear' : ''}${p.width === 'volle Breite' ? ' vw--full' : ''}${matchMedia('(hover: none)').matches ? ' vw--touch' : ''}`, style: { '--vwh': H0 + 'px', '--acc': p.accent || '#ff6a4d' } });
    const bg = h('div', { class: 'vw__stagebg' }); el.append(bg);
    if (p.title) bg.append(h('h2', { class: 'vw__head' }, p.title));
    if (!items.length) { bg.append(h('p', { class: 'vw__head', style: { fontSize: '15px', opacity: .7 } }, 'Reel-Wand: noch keine Videos – im Admin unter „Videos“ auf „+ Mehrere Videos auf einmal hochladen“ klicken.')); return el; }
    const row = h('div', { class: 'vw__row' }); bg.append(row);
    const N = items.length, reduced = still(), others = p.others === OTHERS[1];
    let focus = mode === 'fan' ? Math.floor((N - 1) / 2) : 0, userSound = false, allPaused = false;
    const cards = items.map((it, i) => {
      const src = String(it.video).trim(), pl = makePlayer(src, it.poster || null, () => c.classList.add('is-live'));
      const k = N === 1 ? 0 : (i / (N - 1)) * 2 - 1;
      const poster = it.poster ? h('img', { class: 'vw__poster', src: it.poster, alt: '', loading: 'lazy', decoding: 'async' }) : null;
      const bPlay = h('button', { class: 'vw__b', type: 'button', 'aria-label': 'Pause / Abspielen', html: ICO.pause }), bSnd = p.sound !== false ? h('button', { class: 'vw__b', type: 'button', 'aria-label': 'Ton an/aus', html: ICO.mute }) : null;
      const c = h('div', { class: 'vw__c', role: 'button', tabindex: '0', 'aria-label': it.title || `Video ${i + 1}`, style: { '--i': i, '--k': k.toFixed(3), '--abs': Math.round(Math.abs(k) * 10) } },
        pl.el, poster, h('i', { class: 'vw__shade' }), it.tag ? h('span', { class: 'vw__tag' }, it.tag) : null, it.title ? h('span', { class: 'vw__cap' }, it.title) : null, h('div', { class: 'vw__btns' }, bPlay, bSnd));
      const S = { c, pl, i, vis: false, paused: false, muted: true, bPlay, bSnd, loaded: false };
      return S;
    });
    row.append(...cards.map((s) => s.c));
    const sync = (s) => {
      const run = !reduced && s.vis && !s.paused && !allPaused && !(others && focus != null && s.i !== focus);
      if (s.vis && !s.loaded) { s.loaded = true; s.pl.load(); }
      const wantMuted = !(userSound && p.sound !== false && s.i === focus);
      if (wantMuted !== s.muted || !s.muteSet) { s.muted = wantMuted; s.muteSet = true; s.pl.mute(wantMuted); }
      if (run) { s.pl.play(); } else { s.pl.pause(); }
      s.c.classList.toggle('is-paused', s.paused || allPaused);
      s.bPlay.innerHTML = s.paused || allPaused ? ICO.play : ICO.pause;
      if (s.bSnd) s.bSnd.innerHTML = s.muted ? ICO.mute : ICO.snd;
    };
    const syncAll = () => cards.forEach(sync);
    const setFocus = (i) => { focus = i; cards.forEach((s) => s.c.classList.toggle('is-focus', s.i === i)); layout(); syncAll(); };
    cards.forEach((s) => {
      s.c.addEventListener('click', (e) => {
        if (e.target.closest('.vw__btns')) return;
        if (s.i !== focus) { userSound = true; setFocus(s.i); } else { s.paused = !s.paused; sync(s); }
      });
      s.c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.c.click(); } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (s.i + (e.key === 'ArrowRight' ? 1 : N - 1)) % N; cards[n].c.focus(); } });
      s.bPlay.addEventListener('click', (e) => { e.stopPropagation(); s.paused = !s.paused; allPaused = false; sync(s); });
      if (s.bSnd) s.bSnd.addEventListener('click', (e) => { e.stopPropagation(); if (s.i !== focus) setFocus(s.i); userSound = s.muted ? true : !userSound; syncAll(); });
    });
    if (p.allBtn !== false && N > 1 && !reduced) {
      const b = h('button', { type: 'button' }); const upd = () => { b.innerHTML = (allPaused ? ICO.play : ICO.pause) + `<span>${allPaused ? 'alle abspielen' : 'alle pausieren'}</span>`; };
      b.addEventListener('click', () => { allPaused = !allPaused; if (!allPaused) cards.forEach((s) => (s.paused = false)); upd(); syncAll(); }); upd();
      bg.append(h('div', { class: 'vw__all' }, b));
    }
    // Größen: im Akkordeon ist die Fokus-Karte genau 9:16 breit, die anderen teilen sich den Rest als Streifen
    const layout = () => {
      const W = row.clientWidth, mobile = mq.matches; if (W < 10) return;
      let H = mobile ? Math.min(H0, Math.round(innerHeight * .62), Math.round(W * (land ? .74 : .64) / ar)) : Math.min(H0, Math.max(240, innerHeight - 300));
      H = Math.max(120, H); el.style.setProperty('--vwh', H + 'px');
      if (mode === 'acc') {
        const gap = 10, target = Math.min(W - (N - 1) * 70 - (N - 1) * gap, H * ar), unit = Math.max(40, (W - (N - 1) * gap - target) / Math.max(1, N - 1));
        el.style.setProperty('--vwg', (N === 1 ? 1 : Math.max(1, target / unit)).toFixed(3));
      } else if (mode === 'fan') {
        const cw = H * ar; el.style.setProperty('--spread', Math.max(mobile ? 20 : 24, Math.min(cw * .62, (W - cw) / Math.max(1, N - 1) / 2 * 1.9)).toFixed(1));
      }
    };
    mq.addEventListener?.('change', () => {
      const m = modeNow(); if (m === mode) return;
      el.classList.remove('vw--' + mode); mode = m; el.classList.add('vw--' + mode);
      el.style.removeProperty('--vwg'); el.style.removeProperty('--spread'); setFocus(mode === 'fan' ? Math.floor((N - 1) / 2) : 0);
    });
    new ResizeObserver(layout).observe(row);
    // Sichtbarkeit: nur Videos im Bild laufen; nahe Videos werden schon vorgeladen
    const io = new IntersectionObserver((es) => { for (const e of es) { const s = cards.find((x) => x.c === e.target); if (!s) continue; s.vis = e.isIntersecting; if (e.isIntersecting && !s.loaded) { s.loaded = true; s.pl.load(); } sync(s); } }, { threshold: 0.25, rootMargin: '120px' });
    cards.forEach((s) => io.observe(s.c));
    const inObs = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { el.classList.add('is-in'); inObs.disconnect(); } }, { threshold: 0.12 });
    inObs.observe(el);
    cards[focus].c.classList.add('is-focus'); requestAnimationFrame(() => { layout(); syncAll(); }); setTimeout(() => el.classList.add('is-ready'), 1600);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cards.forEach((s) => s.pl.pause()); else syncAll(); });
    return el;
  },
};
