import { h } from '../core/dom.js';
import { parseVimeo, parseYouTube, vimeoInfo, vimeoThumb, videoCfg } from '../core/media.js';

// Reel-Wand (neu gebaut, Nov 2026): Überschrift zentriert oben, darunter bis zu 5 gleich große Reels symmetrisch in einer Reihe,
// darunter zentriert ein Text. Jedes Video füllt seine Karte randlos (keine schwarzen Ränder – auch ein 16:9-Video wird passend
// beschnitten), runde Ecken. Alle laufen stumm in Schleife, aber nur solange sie zu sehen sind. Antippen = Ton für dieses Video.
// Mehr als 5 Videos: Die Reihe lässt sich seitlich weiterwischen. Handy: wischbare Reihe, die Karte in der Mitte ist im Fokus.
const ITEM = [
  { name: 'video', label: 'Video (Vimeo-/YouTube-Link oder Datei aus media/)', type: 'image', default: '' },
  { name: 'poster', label: 'Vorschaubild (optional, bis das Video läuft)', type: 'image', default: '' },
  { name: 'title', label: 'Titel (optional, klein unten auf der Karte)', type: 'text', default: '' },
];
const FORMATS = ['9:16 hochkant (Reels)', '16:9 quer'];
const SND = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path d="M15 8.5a5 5 0 0 1 0 7M17.6 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.6L12 18.5v-13L7.6 9.5z"/><path d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const vol = () => Math.max(0, Math.min(100, Number(videoCfg.volume) || 40));

// Ein Abspieler, egal ob Datei, Vimeo oder YouTube – füllt seine Karte immer randlos
function makePlayer(src, poster, cardAspect) {
  const yt = parseYouTube(src), vm = yt ? null : (/vimeo\.com|^\d{6,}$/i.test(src) ? parseVimeo(src) : null);
  const box = h('div', { class: 'rw__media' });
  if (!yt && !vm) {
    const v = h('video', { loop: true, muted: true, playsinline: true, preload: 'none', poster: poster || null, src, 'aria-hidden': 'true', tabindex: '-1' });
    v.muted = true; v.setAttribute('webkit-playsinline', ''); box.append(v);
    return { el: box, load() { if (v.preload === 'none') v.preload = 'metadata'; }, play() { const r = v.play(); if (r && r.catch) r.catch(() => {}); }, pause() { v.pause(); }, mute(b) { v.muted = b; if (!b) v.volume = vol() / 100; } };
  }
  // Einbettung: Der Player wird so groß gezogen, dass er die Karte ganz füllt (Seitenverhältnis kommt von Vimeo, sonst 16:9)
  let ifr = null, ready = false; const want = { play: false, muted: true };
  const size = (va) => {
    const k = va / cardAspect;                                 // > 1: Video breiter als die Karte
    box.style.setProperty('--rw-w', (k > 1 ? k * 100 : 100).toFixed(2) + '%');
    box.style.setProperty('--rw-h', (k > 1 ? 100 : 100 / k).toFixed(2) + '%');
  };
  size(16 / 9);
  if (vm) {
    vimeoInfo(vm).then(i => { if (i && i.width && i.height) size(i.width / i.height); }).catch(() => {});
    if (!poster) vimeoThumb(vm).then(t => { if (t) box.style.backgroundImage = `url("${t}")`; }).catch(() => {});
  } else box.style.backgroundImage = `url("https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg")`;
  if (poster) box.style.backgroundImage = `url("${poster}")`;
  const send = (o) => { if (!ifr || !ready) return; try { ifr.contentWindow.postMessage(JSON.stringify(o), yt ? 'https://www.youtube-nocookie.com' : 'https://player.vimeo.com'); } catch { /* weg */ } };
  const apply = () => {
    if (yt) { send({ event: 'command', func: want.muted ? 'mute' : 'unMute', args: [] }); if (!want.muted) send({ event: 'command', func: 'setVolume', args: [vol()] }); send({ event: 'command', func: want.play ? 'playVideo' : 'pauseVideo', args: [] }); }
    else { send({ method: 'setMuted', value: want.muted }); if (!want.muted) send({ method: 'setVolume', value: vol() / 100 }); send({ method: want.play ? 'play' : 'pause' }); }
  };
  return {
    el: box,
    load() {
      if (ifr) return;
      const q = new URLSearchParams(yt ? { autoplay: '1', mute: '1', loop: '1', playlist: yt.id, controls: '0', rel: '0', playsinline: '1', modestbranding: '1', disablekb: '1', enablejsapi: '1' }
        : { autoplay: '1', loop: '1', muted: '1', controls: '0', title: '0', byline: '0', portrait: '0', dnt: '1', playsinline: '1', autopause: '0', api: '1' });
      if (vm && vm.hash) q.set('h', vm.hash);
      ifr = h('iframe', { src: yt ? `https://www.youtube-nocookie.com/embed/${yt.id}?${q}` : `https://player.vimeo.com/video/${vm.id}?${q}`, allow: 'autoplay; fullscreen; picture-in-picture', tabindex: '-1', 'aria-hidden': 'true', title: 'Video', loading: 'lazy' });
      ifr.addEventListener('load', () => { ready = true; apply(); setTimeout(apply, 500); setTimeout(apply, 1600); });
      box.append(ifr);
    },
    play() { want.play = true; apply(); }, pause() { want.play = false; apply(); }, mute(b) { want.muted = b; apply(); },
  };
}

export default {
  type: 'videoWall', label: 'Reel-Wand (bis zu 5 Reels nebeneinander, Text oben und unten)',
  fields: [
    { name: 'title', label: 'Überschrift (zentriert über den Reels)', type: 'text', default: '' },
    { name: 'text', label: 'Text darunter (zentriert unter den Reels)', type: 'textarea', default: '' },
    { name: 'items', label: 'Videos (5 passen nebeneinander; mehr lassen sich seitlich weiterwischen)', type: 'list', itemFields: ITEM },
    { name: 'format', label: 'Kartenformat', type: 'select', options: FORMATS, default: FORMATS[0] },
    { name: 'sound', label: 'Antippen schaltet den Ton für dieses Video ein', type: 'checkbox', default: true },
  ],
  render(p) {
    const items = (p.items || []).filter(i => i && String(i.video || '').trim());
    if (!items.length) return null;
    const land = /16\s*:\s*9|quer/i.test(String(p.format || ''));
    const cardAspect = land ? 16 / 9 : 9 / 16;
    let soundOn = -1;

    const cards = items.map((it, i) => {
      const pl = makePlayer(String(it.video).trim(), it.poster, cardAspect);
      const ico = h('span', { class: 'rw__snd', 'aria-hidden': 'true' }); ico.innerHTML = MUTE;
      const card = h(p.sound === false ? 'div' : 'button', { class: 'rw__c', type: p.sound === false ? null : 'button', 'aria-label': (it.title || `Video ${i + 1}`) + (p.sound === false ? '' : ' – Ton an/aus') },
        pl.el, it.title ? h('span', { class: 'rw__t' }, it.title) : null, p.sound === false ? null : ico);
      return { card, pl, ico, seen: false };
    });
    const setSound = (i) => {
      soundOn = soundOn === i ? -1 : i;
      cards.forEach((c, k) => { const on = k === soundOn; c.pl.mute(!on); c.card.classList.toggle('is-snd', on); c.ico.innerHTML = on ? SND : MUTE; });
    };
    if (p.sound !== false) cards.forEach((c, i) => c.card.addEventListener('click', () => setSound(i)));

    const row = h('div', { class: 'rw__row' + (items.length > 5 ? ' is-more' : '') }, cards.map(c => c.card));
    const el = h('section', { class: 'rw' + (land ? ' rw--land' : ''), id: p.id, style: { '--rw-n': String(Math.min(5, items.length)) } },
      p.title ? h('h2', { class: 'rw__h' }, p.title) : null,
      row,
      p.text ? h('p', { class: 'rw__p' }, p.text) : null);

    // Nur sichtbare Videos laufen (spart Akku und Datenvolumen); Ton geht aus, sobald das Video aus dem Bild ist
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach(e => {
        const c = cards.find(x => x.card === e.target); if (!c) return;
        if (e.isIntersecting) { c.pl.load(); c.pl.play(); }
        else { c.pl.pause(); if (cards.indexOf(c) === soundOn) setSound(soundOn); }
      }), { threshold: .2, rootMargin: '0px 200px 0px 200px' });
      cards.forEach(c => io.observe(c.card));
    } else cards.forEach(c => { c.pl.load(); c.pl.play(); });

    // Handy: wischbare Reihe startet mit der mittleren Karte in der Mitte – symmetrisch
    requestAnimationFrame(() => { if (row.scrollWidth > row.clientWidth + 4) { const mid = cards[Math.floor((cards.length - 1) / 2)].card; row.scrollLeft = mid.offsetLeft + mid.offsetWidth / 2 - row.clientWidth / 2; } });
    return el;
  },
};
