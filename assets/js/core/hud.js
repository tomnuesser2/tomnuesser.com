import { h } from './dom.js';

// Sucher-Overlay wie in einer Kamera: Eckmarken, REC-Punkt, Kamera-Label, Timecode (Tageszeit, 24 fps).
export function hudEl({ cam = '', side = '' } = {}) {
  return h('div', { class: 'hud', 'aria-hidden': 'true' },
    ['tl', 'tr', 'bl', 'br'].map(c => h('i', { class: `hud__c hud__c--${c}` })),
    h('span', { class: 'hud__rec' }, h('i'), 'REC'),
    (cam || side) ? h('span', { class: 'hud__cam' }, side || cam) : null,
    h('span', { class: 'hud__tc' }, '00:00:00:00'));
}

const p2 = (n) => String(n).padStart(2, '0');
export function timecode(d = new Date(), fps = 24) {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}:${p2(Math.floor(d.getMilliseconds() * fps / 1000))}`;
}
