import { h } from '../core/dom.js';
import { track, still, clamp, trackProgress, holdScroll, releaseScroll } from '../core/scrollhub.js';
// NOTUA kurz (Startseite): Eine kurze Szene, die nur erklärt „das ist NOTUA“. Beim Scrollen setzt sich um die Überschrift herum ein kleines Board
// aus vier Karten zusammen, am Ende erscheinen die Buttons. Dauert nur etwa einen Bildschirm. Die lange Version (3D-Flug) gehört auf die Projektseite.
const lines = (s) => String(s == null ? '' : s).split('\n').map(x => x.trim()).filter(Boolean);
const ez = (x) => 1 - Math.pow(1 - clamp(x), 3);
const isExt = (u) => /^https?:/i.test(String(u || ''));
export default {
  type: 'notuaTeaser', label: 'NOTUA kurz (für die Startseite, kurzer Scroll)',
  fields: [
    { name: 'title', label: 'Titel', type: 'text', default: 'NOTUA – plan, sort and connect your ideas on one endless board.', de: 'NOTUA – plane, sortiere und verbinde deine Ideen auf einem endlosen Board.' },
    { name: 'text', label: 'Kurzer Text (was ist NOTUA? 1–2 Sätze)', type: 'textarea', default: 'My own creative planning app: notes, tables, tasks and boards in one place. Made by me – free to use.', de: 'Meine eigene Planungs-App für Kreative: Notizen, Tabellen, Aufgaben und Boards an einem Ort. Von mir gebaut – kostenlos.' },
    { name: 'logo', label: 'NOTUA-Logo (Bild)', type: 'image', default: 'media/notua-logo.png' },
    { name: 'linkText', label: 'Button 1: Text (öffnet die App)', type: 'text', default: 'open NOTUA ↗', de: 'NOTUA öffnen ↗' },
    { name: 'linkUrl', label: 'Button 1: Link', type: 'text', default: 'https://notua.site/' },
    { name: 'projectText', label: 'Button 2: Text (führt zur NOTUA-Projektseite)', type: 'text', default: 'view the project →', de: 'zum Projekt →' },
    { name: 'projectUrl', label: 'Button 2: Ziel (Projektname, oder „#next“ = direkt zum nächsten Abschnitt)', type: 'text', default: 'notua' },
    { name: 'sub', label: 'Kleine Zeile unter den Buttons', type: 'text', default: 'web · desktop · android', de: 'Web · Desktop · Android' },
    { name: 'notes', label: 'Notiz-Karte (1. Zeile = Titel)', type: 'textarea', default: 'Script intro\n– Hook in 3 sec\n– Scene 1: workshop', de: 'Skript-Intro\n– Hook in 3 Sek.\n– Szene 1: Werkstatt' },
    { name: 'tasksTitle', label: 'Aufgaben-Karte: Titel', type: 'text', default: 'Tasks', de: 'Aufgaben' },
    { name: 'tasks', label: 'Aufgaben-Karte: Aufgaben (Zeile mit „x “ am Anfang = abgehakt)', type: 'textarea', default: 'x Review footage\nx Rough cut\nColor grade\nExport in 4K', de: 'x Material sichten\nx Rohschnitt\nColor Grading\nExport in 4K' },
    { name: 'tableTitle', label: 'Tabellen-Karte: Titel', type: 'text', default: 'Scenes', de: 'Szenen' },
    { name: 'table', label: 'Tabellen-Karte: Zeilen (Zellen mit Komma trennen)', type: 'textarea', default: 'Intro, 0:12\nWorkshop, 0:28\nInterview, 0:45', de: 'Intro, 0:12\nWerkstatt, 0:28\nInterview, 0:45' },
    { name: 'boardsTitle', label: 'Boards-Karte: Titel', type: 'text', default: 'Boards', de: 'Boards' },
    { name: 'boards', label: 'Boards-Karte: Namen (mit | trennen)', type: 'text', default: 'Shoot 2026 | Clients | Ideas', de: 'Shoot 2026 | Kunden | Ideen' },
    { name: 'introDur', label: 'Dauer der Animation in Sekunden (läuft automatisch ab)', type: 'number', default: 2.8 },
    { name: 'scrollLength', label: 'Länge des Scrolls (in Bildschirmen, 0.5 = kurz)', type: 'number', default: .5 },
    { name: 'cBg', label: 'Look: Hintergrund (Hex)', type: 'text', default: '#E7EAEE' },
    { name: 'cDot', label: 'Look: Punktraster (Hex)', type: 'text', default: '#C6CCD4' },
    { name: 'cInk', label: 'Look: Text (Hex)', type: 'text', default: '#1B2027' },
    { name: 'cAccent', label: 'Look: Akzentfarbe (Hex)', type: 'text', default: '#FF6B57' },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const hd = (t, c) => h('div', { class: 'nt__h' }, h('i', {}), h('b', {}, t), c || null);
    const note = lines(p.notes), tasks = lines(p.tasks).slice(0, 5), table = lines(p.table).slice(0, 4), boards = String(p.boards || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const cards = [
      h('div', { class: 'nt__c nt__c--note' }, hd(note[0] || 'Note'), h('div', { class: 'nt__nb' }, note.slice(1).map(l => h('p', {}, l)))),
      h('div', { class: 'nt__c nt__c--tasks' }, hd(p.tasksTitle), h('div', { class: 'nt__tl' }, tasks.map(l => { const d = /^x\s/i.test(l); return h('p', { class: d ? 'is-done' : '' }, h('i', {}), l.replace(/^x\s/i, '')); }))),
      h('div', { class: 'nt__c nt__c--table' }, hd(p.tableTitle), h('table', { class: 'nt__tb' }, table.map(r => h('tr', {}, r.split(',').slice(0, 3).map(c => h('td', {}, c.trim())))))),
      h('div', { class: 'nt__c nt__c--boards' }, hd(p.boardsTitle), h('div', { class: 'nt__bd' }, boards.map(b => h('span', {}, h('i', {}), b)))),
    ];
    const logo = p.logo ? h('img', { class: 'nt__logo', src: p.logo, alt: 'NOTUA', decoding: 'async' }) : null;
    const t = h('h2', { class: 'nt__t' }, p.title), x = h('p', { class: 'nt__x' }, p.text);
    const b1 = h('a', { class: 'nt__b nt__b--1', href: p.linkUrl || 'https://notua.site/' }, p.linkText);
    if (isExt(p.linkUrl || 'https://')) { b1.target = '_blank'; b1.rel = 'noopener'; } else b1.setAttribute('data-link', '');
    const b2 = h('a', { class: 'nt__b nt__b--2', href: p.projectUrl || 'notua', 'data-link': '' }, p.projectText);
    const btns = h('div', { class: 'nt__btns' }, b1, b2), sub = p.sub ? h('p', { class: 'nt__sub' }, p.sub) : null;
    const copy = h('div', { class: 'nt__copy' }, logo, t, x, btns, sub);
    const stage = h('div', { class: 'nt__stage' }, h('div', { class: 'nt__grid' }), cards, copy);
    const len = Math.max(.3, Number(p.scrollLength) || .5);
    const el = h('section', { class: 'nt', id: p.id, style: { '--nt-len': String(len), '--nt-bg': p.cBg, '--nt-dot': p.cDot, '--nt-ink': p.cInk, '--nt-ac': p.cAccent } }, h('div', { class: 'nt__track' }, stage));
    // Startlagen der vier Karten (Richtung, aus der sie hereinfliegen, und Schräglage)
    const FROM = [[-70, -40, -9], [70, -50, 8], [-60, 55, 7], [65, 50, -8]];
    const apply = (pr) => {
      cards.forEach((c, i) => {
        const s = ez((pr - .06 - i * .1) / .38), [dx, dy, rot] = FROM[i], k = 1 - s;
        c.style.opacity = s.toFixed(3); c.style.transform = `translate3d(${(dx * k).toFixed(1)}vw, ${(dy * k).toFixed(1)}vh, 0) rotate(${(rot * k).toFixed(2)}deg) scale(${(.8 + .2 * s).toFixed(3)})`;
      });
      const a = ez((pr - .02) / .2), tx = ez((pr - .14) / .22), bt = ez((pr - .55) / .25);
      if (logo) { logo.style.opacity = a.toFixed(3); logo.style.transform = `translateY(${((1 - a) * 16).toFixed(1)}px)`; }
      t.style.opacity = a.toFixed(3); t.style.transform = `translateY(${((1 - a) * 22).toFixed(1)}px)`;
      x.style.opacity = tx.toFixed(3); x.style.transform = `translateY(${((1 - tx) * 18).toFixed(1)}px)`;
      btns.style.opacity = bt.toFixed(3); btns.style.transform = `translateY(${((1 - bt) * 16).toFixed(1)}px)`; btns.style.pointerEvents = bt > .6 ? 'auto' : 'none';
      if (sub) { sub.style.opacity = bt.toFixed(3); }
      stage.style.setProperty('--nt-p', pr.toFixed(3));
    };
    if (still()) { el.classList.add('is-still'); apply(1); return el; }
    // Läuft automatisch ab, sobald man hier ankommt/hinscrollt (zeitgesteuert, nicht am Scrollrad hängend); beim Wegscrollen setzt es sich zurück
    apply(0);
    let ip = 0, ipT = 0, raf = 0, lt = 0; const dur = Math.max(.8, Number(p.introDur) || 2.8);
    let held1 = false, topNow = 999;
    const tick = (t) => {
      raf = 0; const dt = lt ? Math.min(.1, (t - lt) / 1000) : .016; lt = t;
      // Scroll erst sperren, wenn die Bühne am Bildschirm klebt (nicht mitten beim Heranscrollen)
      if (ipT === 1 && ip < 1 && topNow <= 2 && !held1) { held1 = true; holdScroll((1 - ip) * dur * 1000 + 250); }
      if (ip >= 1 || ipT === 0) { held1 = false; releaseScroll(); }
      if (ip < ipT) ip = Math.min(ipT, ip + dt / dur); else if (ip > ipT) ip = Math.max(ipT, ip - dt / dur * 2.5);
      apply(ip); if (ip !== ipT) raf = requestAnimationFrame(tick); else lt = 0;
    };
    track(el.querySelector('.nt__track'), (r, vh) => {
      topNow = r.top;
      const past = trackProgress(r, stage.offsetHeight) > .6;
      const nt = (r.top < vh * .4 || past) ? 1 : (r.top > vh * .75 ? 0 : ipT);
      if (nt !== ipT || (ip !== ipT && !raf)) { ipT = nt; if (!raf) { lt = 0; raf = requestAnimationFrame(tick); } }
    });
    return el;
  },
};
