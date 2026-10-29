import { h } from '../core/dom.js';
import { track, still, trackProgress, holdScroll, releaseScroll } from '../core/scrollhub.js';
import { getLang } from '../core/i18n.js';
import { watchSize, clamp, num } from '../core/reelKit.js';

// NOTUA-Board (Projekt-Variante): Beim Scrollen fliegt man durch fliegende Karten in ein Board hinein.
// Dort angekommen wird es zu einer kleinen, echten Spielwiese im Look von notua.site: Notizen, Aufgaben, Tabellen,
// Spalten und Bilder anlegen, anfassen und verschieben (nur zum Ausprobieren, nichts wird gespeichert).
const DE = getLang() === 'de';
const T = DE
  ? { note: 'Notiz', image: 'Bild', column: 'Spalte', tasks: 'Aufgaben', table: 'Tabelle', start: 'Start', reset: 'Zurücksetzen', del: 'Löschen', add: 'Hinzufügen', pick: 'Bild wählen', task: 'Aufgabe', item: 'Eintrag' }
  : { note: 'Note', image: 'Image', column: 'Column', tasks: 'Tasks', table: 'Table', start: 'Start', reset: 'Reset', del: 'Delete', add: 'Add', pick: 'Choose image', task: 'Task', item: 'Item' };

const ICON = {
  note: 'M5 3h10l4 4v14H5zM8 11h8M8 15h8M8 7h4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5h.01',
  column: 'M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z',
  tasks: 'M5 5h14v14H5zM8.5 9l1.5 1.5 2.5-3M8.5 15l1.5 1.5 2.5-3M14 9.5h2.5M14 15.5h2.5',
  table: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14',
  board: 'M3 7h7l2 2h9v10H3z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  cal: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
  reset: 'M4 12a8 8 0 108-8M4 4v6h6',
};
const svgI = (d, s = 18) => h('span', { class: 'nb__i', html: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>` });

const SEEDS_EN = [
  { type: 'note', text: 'Script intro\n– Hook in 3 sec\n– Scene 1: workshop', x: 4, y: 8, w: 21 },
  { type: 'note', text: 'Shot list\n1. Wide shot\n2. Close-up\n3. Hands detail', x: 30, y: 6, w: 21 },
  { type: 'tasks', title: 'Tasks', text: 'x Review footage\nx Rough cut\nColor grade\nExport in 4K', x: 57, y: 10, w: 24 },
  { type: 'table', title: 'Scene overview', text: 'Intro, 0:12, Wide\nWorkshop, 0:28, Close-up\nInterview, 0:45, Medium', x: 8, y: 48, w: 36 },
  { type: 'column', title: 'Pipeline', text: 'Moodboard\nCut v2\nGrading', x: 54, y: 50, w: 20 },
];
const SEEDS_DE = [
  { type: 'note', text: 'Drehbuch Intro\n– Hook in 3 Sek\n– Szene 1: Werkstatt', x: 4, y: 8, w: 21 },
  { type: 'note', text: 'Shotliste\n1. Totale\n2. Nahaufnahme\n3. Detail Hände', x: 30, y: 6, w: 21 },
  { type: 'tasks', title: 'Aufgaben', text: 'x Material sichten\nx Rohschnitt\nColor Grading\nExport in 4K', x: 57, y: 10, w: 24 },
  { type: 'table', title: 'Szenenübersicht', text: 'Intro, 0:12, Totale\nWerkstatt, 0:28, Nah\nInterview, 0:45, Halbnah', x: 8, y: 48, w: 36 },
  { type: 'column', title: 'Pipeline', text: 'Moodboard\nSchnitt v2\nGrading', x: 54, y: 50, w: 20 },
];

const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lines = (s) => String(s == null ? '' : s).split('\n').map(x => x.trim()).filter(Boolean);
const DEF_W = { note: .2, tasks: .24, table: .34, column: .2, image: .26 };

export default {
  type: 'notuaBoard', label: 'NOTUA-Board zum Ausprobieren (Flug ins Board – für die PROJEKTSEITE)',
  fields: [
    { name: 'kicker', label: 'Kleine Zeile über dem Titel', type: 'text', default: 'NOTUA', de: 'NOTUA' },
    { name: 'title', label: 'Titel (erscheint am Anfang, blendet beim Fliegen aus)', type: 'text', default: 'Fly into the board', de: 'Flieg ins Board' },
    { name: 'text', label: 'Text unter dem Titel', type: 'textarea', default: 'Scroll – and then try it yourself.', de: 'Scrolle – und probier es danach selbst aus.' },
    { name: 'hideTexts', label: 'Texte über dem Flug ausblenden', type: 'checkbox', default: false },
    { name: 'boardName', label: 'Name des Boards oben in der Leiste', type: 'text', default: 'Untitled board', de: 'Unbenanntes Board' },
    { name: 'url', label: 'Adresse in der Browserleiste (leer = Leiste aus)', type: 'text', default: 'notua.site' },
    { name: 'theme', label: 'Look des Boards', type: 'select', options: ['hell', 'dunkel'], default: 'hell' },
    { name: 'accent', label: 'Akzentfarbe (Hex)', type: 'text', default: '#FF6B57' },
    { name: 'cards', label: 'Karten, die im Board erscheinen (Position und Breite in % des Boards)', type: 'list', default: SEEDS_EN, de: SEEDS_DE, itemFields: [
      { name: 'type', label: 'Art', type: 'select', options: ['note', 'tasks', 'table', 'column', 'image'], default: 'note' },
      { name: 'title', label: 'Titel (nicht bei Notiz)', type: 'text' },
      { name: 'text', label: 'Inhalt: Notiz = Text · Aufgaben = pro Zeile eine Aufgabe, „x “ davor = erledigt · Tabelle = pro Zeile eine Zeile, Zellen mit Komma · Spalte = pro Zeile ein Eintrag', type: 'textarea' },
      { name: 'image', label: 'Bild (nur bei Art „image“)', type: 'image' },
      { name: 'x', label: 'Position von links in %', type: 'number', default: 10 },
      { name: 'y', label: 'Position von oben in %', type: 'number', default: 10 },
      { name: 'w', label: 'Breite in %', type: 'number', default: 22 },
    ] },
    { name: 'flyCards', label: 'Fliegende Karten beim Anflug (0 = keine)', type: 'number', default: 9 },
    { name: 'introDur', label: 'Dauer der Anflug-Animation in Sekunden (läuft automatisch, sobald man scrollt)', type: 'number', default: 4.2 },
    { name: 'flyText', label: 'Kleiner Button zum Losfliegen (unter dem Text)', type: 'text', default: 'Fly in ↓', de: 'Losfliegen ↓' },
    { name: 'tryText', label: 'Text am Pfeil nach dem Anflug', type: 'text', default: 'Try it yourself', de: 'Probier es selbst aus' },
    { name: 'scrollLength', label: 'Scroll-Strecke zum Ausprobieren (in Bildschirmhöhen, Board bleibt stehen)', type: 'number', default: 1.2 },
    { name: 'width', label: 'Maximale Breite des Boards am Computer in px', type: 'number', default: 1240 },
    { name: 'height', label: 'Höhe des Boards (Anteil der Bildschirmhöhe, 0.5–0.95)', type: 'number', default: .8 },
    { name: 'interactive', label: 'Im Board darf man selbst Karten anlegen und verschieben', type: 'checkbox', default: true },
    { name: 'outroLength', label: 'Scroll-Strecke für das Ende (Notizen verschwinden, Pfeil, großer Button) in Bildschirmhöhen', type: 'number', default: 1.6 },
    { name: 'endText', label: 'Großer Button am Ende: Text', type: 'text', default: 'Go to NOTUA ↗', de: 'Zu NOTUA ↗' },
    { name: 'endUrl', label: 'Großer Button am Ende: Ziel (https://… oder Projektname; leer = kein Button)', type: 'text', default: 'https://notua.site/' },
    { name: 'tools', label: 'Werkzeuge in der Leiste unten', type: 'select', options: ['alle', 'Notiz + Aufgaben + Tabelle', 'nur Notiz'], default: 'alle' },
  ],
  render(p0) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const live0 = p.interactive !== false, ac = /^#?[0-9a-f]{6}$/i.test(String(p.accent || '').trim()) ? '#' + String(p.accent).trim().replace('#', '') : '#FF6B57';
    const endUrl0 = String(p.endUrl == null ? 'https://notua.site/' : p.endUrl).trim();
    const root = h('div', { class: `nb${p.theme === 'dunkel' ? ' nb--dark' : ''}`, style: { '--nb-ac': ac, '--nb-len': String(Math.max(.5, num(p.scrollLength, 1.2)) + (endUrl0 ? Math.max(.6, num(p.outroLength, 1.6)) : 0)), '--nb-w': Math.max(480, num(p.width, 1240)) + 'px', '--nb-h': clamp(num(p.height, .8), .5, .95) } });
    const static0 = still();
    if (static0) root.classList.add('nb--static');

    /* ---- Fenster mit Board ---- */
    const cv = h('div', { class: 'nb__cv' });                         // Zeichenfläche (Punktraster)
    const layer = h('div', { class: 'nb__ly' });                      // Karten
    cv.append(layer);
    const crumb = h('div', { class: 'nb__crumb' }, h('span', {}, T.start), h('i', {}, '/'), h('b', {}, p.boardName || ''));
    const topbar = h('div', { class: 'nb__top' }, crumb, h('div', { class: 'nb__tr' }, svgI(ICON.search), svgI(ICON.cal), svgI(ICON.home)));
    const all = [['note', T.note], ['image', T.image], ['column', T.column], ['tasks', T.tasks], ['table', T.table]];
    const toolSet = p.tools === 'nur Notiz' ? ['note'] : p.tools === 'Notiz + Aufgaben + Tabelle' ? ['note', 'tasks', 'table'] : all.map(a => a[0]);
    const dock = h('div', { class: 'nb__dock' }, all.filter(a => toolSet.includes(a[0])).map(([k, l]) => {
      const b = h('button', { type: 'button', class: 'nb__db', 'data-k': k }, svgI(ICON[k], 20), h('span', {}, l)); return b;
    }));
    const resetB = h('button', { type: 'button', class: 'nb__rs', title: T.reset, 'aria-label': T.reset }, svgI(ICON.reset, 16), h('span', {}, T.reset));
    const zoomBox = h('div', { class: 'nb__zb' }, resetB);
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const app = h('div', { class: 'nb__app' }, topbar, cv, dock, live0 ? zoomBox : null, file);
    const chrome = p.url ? h('div', { class: 'nb__br' }, h('i'), h('i'), h('i'), h('span', { class: 'nb__url' }, h('b', {}, p.url))) : null;
    const win = h('div', { class: `nb__win${chrome ? ' has-br' : ''}` }, chrome, app);

    /* ---- Fliegende Karten ---- */
    const fly = [];
    const nFly = clamp(Math.round(num(p.flyCards, 9)), 0, 24);
    const seeds0 = (Array.isArray(p.cards) && p.cards.length ? p.cards : (DE ? SEEDS_DE : SEEDS_EN));
    // Handy: Das Board ist nur ~370 px breit. Die Positionen in % vom Computer passen dort nicht (Karten wären winzig und abgeschnitten).
    // Deshalb werden die Karten hier automatisch in zwei Spalten gepackt (Tabellen/Bilder über die volle Breite).
    const narrow = innerWidth < 600;
    const packNarrow = (list) => {
      const col = [14, 14], H = 480, out = [], nl = (x) => lines(x).length;
      list.forEach((s) => {
        const t = s.type || 'note'; const hpx = t === 'note' ? 100 : t === 'tasks' ? 44 + 26 * Math.max(2, nl(s.text)) : t === 'column' ? 40 + 34 * Math.max(1, nl(s.text)) : t === 'table' ? 44 + 30 * Math.max(3, nl(s.text)) : 130;
        const full = t === 'table' || (t === 'image' && num(s.w, 22) > 40);
        if (full) { const y = Math.max(col[0], col[1]); out.push({ ...s, x: 3, y: (y / H) * 100, w: 94 }); col[0] = col[1] = y + hpx + 10; }
        else { const c = col[0] <= col[1] ? 0 : 1; out.push({ ...s, x: c ? 52 : 3, y: (col[c] / H) * 100, w: 45 }); col[c] += hpx + 10; }
      });
      return out;
    };
    const seeds1 = narrow ? packNarrow(seeds0) : seeds0;
    const space = h('div', { class: 'nb__space' });
    for (let i = 0; i < nFly; i++) {
      const s = seeds0[i % seeds0.length] || {}, type = s.type || 'note';
      const body = type === 'tasks' ? h('div', { class: 'nb__fl' }, lines(s.text).slice(0, 4).map((t, k) => h('p', { class: k < 2 ? 'd' : '' }, t.replace(/^x\s+/i, ''))))
        : type === 'table' ? h('div', { class: 'nb__ft' }, [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => h('i')))
        : type === 'image' && s.image ? h('img', { src: s.image, alt: '', loading: 'lazy' })
        : h('div', { class: 'nb__fn' }, lines(s.text).slice(0, 4).map(t => h('p', {}, t)));
      const c = h('div', { class: 'nb__fc' }, h('div', { class: 'nb__fh' }, svgI(ICON[type] || ICON.note, 14), h('b', {}, s.title || '')), body);
      const a = (i / Math.max(1, nFly)) * Math.PI * 2 + i * .7, side = i % 2 ? 1 : -1;
      fly.push({ el: c, x: Math.cos(a) * (.34 + (i % 3) * .08) * 1.35 * side, y: Math.sin(a * 1.3) * .32, z0: -3200 + (i * 3400) / Math.max(1, nFly), rx: (Math.sin(i * 2.1)) * 18, ry: -side * (14 + (i % 3) * 8), rz: Math.sin(i * 1.7) * 7 });
      space.append(c);
    }
    const dots = h('div', { class: 'nb__dots' });
    const head = p.hideTexts ? null : h('div', { class: 'nb__head' }, p.kicker ? h('p', { class: 'nb__k' }, p.kicker) : null, p.title ? h('h2', { class: 'nb__h' }, p.title) : null, p.text ? h('p', { class: 'nb__p' }, p.text) : null, static0 ? null : h('button', { type: 'button', class: 'nb__fly' }, p.flyText == null ? (DE ? 'Losfliegen ↓' : 'Fly in ↓') : p.flyText));
    const isExt = /^https?:/i.test(endUrl0);
    const goBtn = endUrl0 ? h('a', { class: 'nb__go', href: endUrl0, ...(isExt ? { target: '_blank', rel: 'noopener' } : { 'data-link': '' }) }, p.endText || 'Go to NOTUA ↗') : null;
    const arrow = live0 ? h('div', { class: 'nb__ar', 'aria-hidden': 'true', html: `<span class="nb__art">${String(p.tryText == null ? 'Try it yourself' : p.tryText).replace(/[<>&]/g, '')}</span><svg viewBox="0 0 40 56" width="40" height="56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4v40M7 31l13 14 13-14"/></svg>` }) : null;
    const sticky = h('div', { class: 'nb__sticky' }, dots, space, win, head, arrow, static0 ? null : goBtn);
    root.append(h('div', { class: 'nb__track' }, sticky));
    if (static0 && goBtn) root.append(h('div', { class: 'nb__goW' }, goBtn));

    /* ---- Karten-Modell ---- */
    let bw = 1000, bh = 600, zTop = 10;
    const cards = [];
    const mkTitle = (c, ph) => { const inp = h('input', { class: 'nb__ct', type: 'text', value: c.title || '', placeholder: ph, spellcheck: 'false' }); inp.addEventListener('input', () => { c.title = inp.value; c.touched = true; }); inp.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); if (e.pointerType === 'mouse') return;
      // Touch: Das Titelfeld füllt fast die ganze Kopfzeile. Tippen = Text bearbeiten, Wischen = Karte verschieben (sonst ließe sich die Karte am Handy kaum anfassen)
      const sx = e.clientX, sy = e.clientY, id = e.pointerId, head = c.el && c.el.querySelector('.nb__ch');
      const off = () => { removeEventListener('pointermove', mv, true); removeEventListener('pointerup', off, true); removeEventListener('pointercancel', off, true); };
      const mv = (ev) => { if (ev.pointerId !== id || Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return; off(); inp.blur(); if (head) startDrag({ clientX: sx, clientY: sy, pointerId: id, currentTarget: head, preventDefault() {}, button: 0 }, c); };
      addEventListener('pointermove', mv, true); addEventListener('pointerup', off, true); addEventListener('pointercancel', off, true);
    }); return inp; };
    const editable = (c, cls, html, key) => { const d = h('div', { class: cls, contenteditable: 'true', spellcheck: 'false' }); d.textContent = html; d.addEventListener('input', () => { c.touched = true; if (key) c[key] = d.textContent; }); return d; };

    function build(c) {
      const el = h('div', { class: `nb__c nb__c--${c.type}` }); c.el = el;
      const del = h('button', { type: 'button', class: 'nb__x', title: T.del, 'aria-label': T.del }, '×');
      del.addEventListener('pointerdown', (e) => e.stopPropagation()); del.addEventListener('click', () => remove(c));
      const head2 = h('div', { class: 'nb__ch' }, svgI(ICON[c.type], 16), c.type === 'note' || c.type === 'image' ? h('span', { class: 'nb__sp' }) : mkTitle(c, T[c.type]), del);
      let body;
      if (c.type === 'note') { body = editable(c, 'nb__nb', c.text || '', 'text'); c.bodyEl = body; }
      else if (c.type === 'tasks') {
        body = h('div', { class: 'nb__tl' }); c.bodyEl = body; c.items ||= [];
        const row = (it) => { const r = h('div', { class: `nb__tk${it.done ? ' is-done' : ''}` }, h('button', { type: 'button', class: 'nb__ck', 'aria-label': 'check' }), editable(it, 'nb__tt', it.t || '', 't')); r.querySelector('.nb__ck').addEventListener('click', () => { it.done = !it.done; c.touched = true; r.classList.toggle('is-done', it.done); }); it.el = r; return r; };
        c.items.forEach(it => body.append(row(it)));
        const add = h('button', { type: 'button', class: 'nb__ad' }, '+ ' + T.task); add.addEventListener('click', () => { const it = { t: '', done: false }; c.items.push(it); body.insertBefore(row(it), add); it.el.querySelector('.nb__tt').focus(); c.touched = true; }); body.append(add);
      } else if (c.type === 'column') {
        body = h('div', { class: 'nb__cl' }); c.bodyEl = body; c.items ||= [];
        const row = (it) => { const r = h('div', { class: 'nb__co' }, editable(it, 'nb__tt', it.t || '', 't')); it.el = r; return r; };
        c.items.forEach(it => body.append(row(it)));
        const add = h('button', { type: 'button', class: 'nb__ad' }, '+ ' + T.item); add.addEventListener('click', () => { const it = { t: '' }; c.items.push(it); body.insertBefore(row(it), add); it.el.querySelector('.nb__tt').focus(); c.touched = true; }); body.append(add);
      } else if (c.type === 'table') {
        body = h('div', { class: 'nb__tbw' }); c.bodyEl = body; c.rows ||= [['', '', ''], ['', '', ''], ['', '', '']];
        const tb = h('table', { class: 'nb__tb' }); body.append(tb);
        const draw = () => {
          tb.replaceChildren(); const cols = Math.max(...c.rows.map(r => r.length));
          tb.append(h('tr', {}, h('th', { class: 'nb__rn' }), ...Array.from({ length: cols }, (_, k) => h('th', {}, String.fromCharCode(65 + k)))));
          c.rows.forEach((r, ri) => { const tr = h('tr', {}, h('th', { class: 'nb__rn' }, String(ri + 1))); for (let k = 0; k < cols; k++) { const td = h('td', {}); const d = h('div', { contenteditable: 'true', spellcheck: 'false' }); d.textContent = r[k] || ''; d.addEventListener('input', () => { r[k] = d.textContent; c.touched = true; }); td.append(d); tr.append(td); } tb.append(tr); });
        }; draw(); c.drawT = draw;
        const addR = h('button', { type: 'button', class: 'nb__ad' }, '+ ' + (DE ? 'Zeile' : 'Row')), addC = h('button', { type: 'button', class: 'nb__ad' }, '+ ' + (DE ? 'Spalte' : 'Col'));
        addR.addEventListener('click', () => { c.rows.push(Array(Math.max(...c.rows.map(r => r.length))).fill('')); c.touched = true; draw(); }); addC.addEventListener('click', () => { c.rows.forEach(r => r.push('')); c.touched = true; draw(); });
        body.append(h('div', { class: 'nb__tbb' }, addR, addC));
      } else if (c.type === 'image') {
        body = h('div', { class: 'nb__im' }); c.bodyEl = body;
        const show = () => { body.replaceChildren(); if (c.src) body.append(h('img', { src: c.src, alt: '', draggable: 'false' })); else { const b = h('button', { type: 'button', class: 'nb__pick' }, svgI(ICON.image, 26), h('span', {}, T.pick)); b.addEventListener('click', () => { pickFor = c; file.click(); }); body.append(b); } }; show(); c.show = show;
      }
      el.append(head2, body);
      if (c.type === 'note' || c.type === 'image') { const rs = h('i', { class: 'nb__rz' }); el.append(rs); rs.addEventListener('pointerdown', (e) => startResize(e, c)); }
      head2.addEventListener('pointerdown', (e) => startDrag(e, c));
      el.addEventListener('pointerdown', () => select(c), true);
      layer.append(el); place(c);
      return el;
    }
    function place(c) { const e = c.el; e.style.left = (c.fx * 100).toFixed(3) + '%'; e.style.top = (c.fy * 100).toFixed(3) + '%'; e.style.width = (c.fw * 100).toFixed(3) + '%'; e.style.height = c.fh ? (c.fh * 100).toFixed(3) + '%' : ''; }
    let sel = null;
    function select(c) { if (sel && sel !== c && sel.el) sel.el.classList.remove('is-sel'); sel = c; c.el.classList.add('is-sel'); c.el.style.zIndex = String(++zTop); }
    function remove(c) { const i = cards.indexOf(c); if (i >= 0) cards.splice(i, 1); if (sel === c) sel = null; c.el.classList.add('is-out'); setTimeout(() => c.el.remove(), 180); }
    function startDrag(e, c) {
      if (!live) return; if (e.button !== undefined && e.button > 0) return; e.preventDefault(); const t = e.currentTarget; t.setPointerCapture?.(e.pointerId); select(c);
      const sx = e.clientX, sy = e.clientY, fx = c.fx, fy = c.fy; c.el.classList.add('is-drag');
      const mv = (ev) => { c.fx = clamp(fx + (ev.clientX - sx) / bw, -.04, 1.02 - c.fw); c.fy = clamp(fy + (ev.clientY - sy) / bh, -.02, .96); place(c); };
      const up = () => { c.el.classList.remove('is-drag'); t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); c.touched = true; };
      t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
    }
    function startResize(e, c) {
      if (!live) return; e.preventDefault(); e.stopPropagation(); const t = e.currentTarget; t.setPointerCapture?.(e.pointerId); select(c);
      const sx = e.clientX, sy = e.clientY, fw = c.fw, r = c.el.getBoundingClientRect(), fh0 = r.height / bh;
      const mv = (ev) => { c.fw = clamp(fw + (ev.clientX - sx) / bw, .12, Math.min(.8, 1.02 - c.fx)); c.fh = clamp(fh0 + (ev.clientY - sy) / bh, .1, .9); place(c); };
      const up = () => { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); c.touched = true; };
      t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
    }
    let pickFor = null;
    file.addEventListener('change', () => { const f = file.files && file.files[0]; if (f && pickFor) { pickFor.src = URL.createObjectURL(f); pickFor.show(); } file.value = ''; pickFor = null; });

    const seedCard = (s, i) => {
      const type = ['note', 'tasks', 'table', 'column', 'image'].includes(s.type) ? s.type : 'note';
      const c = { type, seed: true, idx: i, title: s.title || '', text: s.text || '', fx: num(s.x, 10) / 100, fy: num(s.y, 10) / 100, fw: clamp(num(s.w, 22), 8, 80) / 100, fh: 0 };
      if (type === 'note') c.fh = .2;
      if (type === 'image') { c.src = s.image || ''; c.fh = .3; }
      if (type === 'tasks') c.items = lines(s.text).map(l => ({ t: l.replace(/^x\s+/i, ''), done: /^x\s+/i.test(l), full: l.replace(/^x\s+/i, '') }));
      if (type === 'column') c.items = lines(s.text).map(l => ({ t: l, full: l }));
      if (type === 'table') { const rs = lines(s.text).map(l => l.split(/[,|;]\s*/)); c.rows = rs.length ? rs : [['', '', ''], ['', '', '']]; while (c.rows.length < 3) c.rows.push(Array(c.rows[0].length).fill('')); c.full = JSON.parse(JSON.stringify(c.rows)); }
      c.fullText = c.text; return c;
    };
    const addSeeds = (instant) => { seeds1.forEach((s, i) => { const c = seedCard(s, i); cards.push(c); build(c); if (instant) { c.el.style.opacity = '1'; c.el.style.transform = 'none'; c.seedP = 1; } else c.el.style.opacity = '0'; }); };
    addSeeds(false);
    resetB.addEventListener('click', () => { cards.splice(0).forEach(c => c.el.remove()); sel = null; addSeeds(true); });
    dock.addEventListener('click', (e) => {
      const b = e.target.closest('.nb__db'); if (!b || !live) return; const k = b.dataset.k;
      const c = { type: k, fx: .22 + Math.random() * .4, fy: .2 + Math.random() * .35, fw: narrow ? Math.max(DEF_W[k], .46) : DEF_W[k], fh: k === 'note' ? .18 : k === 'image' ? .3 : 0, title: '', text: '', items: k === 'tasks' ? [{ t: '', done: false }, { t: '', done: false }] : k === 'column' ? [{ t: '' }] : undefined, touched: true };
      c.fx = Math.min(c.fx, .98 - c.fw); cards.push(c); const el = build(c); el.classList.add('is-new'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-new'))); select(c);
      if (k === 'note') c.bodyEl.focus(); else if (k === 'image') { pickFor = c; file.click(); } else { const f = el.querySelector('.nb__ct'); if (f) f.focus(); }
    });
    cv.addEventListener('pointerdown', (e) => { if (e.target === cv || e.target === layer) { if (sel && sel.el) sel.el.classList.remove('is-sel'); sel = null; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } });
    root.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel && live && !(document.activeElement && (document.activeElement.isContentEditable || document.activeElement.tagName === 'INPUT'))) { e.preventDefault(); remove(sel); } });

    watchSize(cv, (w, hh) => { bw = w; bh = hh; cv.style.setProperty('--k', clamp(w / 1000, .6, 1).toFixed(3)); });

    /* ---- Scroll-Animation ---- */
    let live = false, cur = static0 ? 1 : 0, tgt = cur, raf = 0, vw = 1000, vh = 800, ip = static0 ? 1 : 0, ipT = ip, lt = 0, tried = false;
    const L0 = Math.max(.5, num(p.scrollLength, 1.2)), O0 = endUrl0 ? Math.max(.6, num(p.outroLength, 1.6)) : 0, A0 = L0 / (L0 + O0);
    const noteBtn = dock.querySelector('[data-k="note"]') || dock.firstChild;
    const apply = (u) => {
      const pr = clamp(ip), q = O0 ? clamp((u - A0) / (1 - A0)) : 0;
      vw = innerWidth; vh = innerHeight;
      const fl = clamp(pr / .6), e = ease(fl), k1 = 1 - e;
      // Fenster: aus der Ferne, gekippt, angeflogen
      const wz = -2700 * k1, wy = 190 * k1, wx = 60 * k1;
      const dimE = clamp((q - .78) / .16); win.style.opacity = String(clamp(fl / .14) * (1 - .6 * dimE)); win.style.filter = dimE > 0 ? `blur(${(dimE * 4).toFixed(1)}px)` : '';
      win.style.transform = e >= .999 ? 'translate(-50%,-50%)' : `translate(-50%,-50%) translate3d(${wx.toFixed(1)}px,${wy.toFixed(1)}px,${wz.toFixed(1)}px) rotateX(${(46 * k1).toFixed(2)}deg) rotateY(${(-36 * k1).toFixed(2)}deg) rotateZ(${(7 * k1).toFixed(2)}deg)`;
      // UI-Rahmen blendet ein, danach erscheinen die Karten nacheinander
      const ui = clamp((pr - .48) / .12); app.style.setProperty('--ui', ui.toFixed(3));
      const was = live; live = live0 && pr >= .9 && q < .03; win.classList.toggle('is-live', live); root.classList.toggle('nb--live', live);
      cards.forEach((c) => {
        if (!c.seed) return; const st = .56 + c.idx * .045, tp = clamp((pr - st) / .08), done = pr >= .8 || c.touched;
        c.seedP = tp; c.el.style.opacity = String(clamp(tp * 2)); c.el.style.transform = tp >= 1 ? 'none' : `translateY(${((1 - tp) * 18).toFixed(1)}px) scale(${(.92 + .08 * tp).toFixed(3)})`;
        if (c.touched) return;
        const ty = done ? 1 : clamp((tp - .15) / .85);
        if (c.type === 'note' && c.bodyEl && document.activeElement !== c.bodyEl) { const s = c.fullText, n = Math.floor(s.length * ty); if (c.shown !== n) { c.shown = n; c.bodyEl.textContent = s.slice(0, n); c.text = c.bodyEl.textContent; } }
        if (c.type === 'tasks' || c.type === 'column') c.items.forEach((it, k) => { if (!it.el) return; const q = clamp(ty * c.items.length - k); const n = Math.floor(it.full.length * q); const tt = it.el.querySelector('.nb__tt'); if (tt && document.activeElement !== tt && it.shown !== n) { it.shown = n; tt.textContent = it.full.slice(0, n); it.t = tt.textContent; } });
        if (c.type === 'table' && c.bodyEl) { const cells = c.bodyEl.querySelectorAll('td > div'); let idx = 0; const total = c.full.reduce((a, r) => a + r.length, 0); c.full.forEach((r, ri) => r.forEach((v, ci) => { const q = clamp(ty * total * 1.1 - idx); idx++; const d = cells[ri * Math.max(...c.rows.map(x => x.length)) + ci]; if (d && document.activeElement !== d) { const n = Math.floor(v.length * q); if (d._n !== n) { d._n = n; d.textContent = v.slice(0, n); c.rows[ri][ci] = d.textContent; } } })); }
      });
      // Ende: alle Notizen verschwinden nacheinander (auch selbst angelegte) – dann zeigt ein Pfeil auf den Notiz-Button, danach kommt der große Button
      const nC = cards.length;
      cards.forEach((c, i) => {
        const out = q > 0 ? clamp((q - .04 - (i / Math.max(1, nC)) * .42) / .07) : 0;
        if (out > 0) { c.wasOut = true; c.el.style.opacity = String((c.seed ? clamp((c.seedP || 0) * 2) : 1) * (1 - out)); c.el.style.transform = `translateY(${(out * 10).toFixed(1)}px) scale(${(1 - .12 * out).toFixed(3)})`; }
        else if (c.wasOut) { c.wasOut = false; if (!c.seed) { c.el.style.opacity = ''; c.el.style.transform = ''; } }
      });
      if (arrow) {
        const a = (live && !tried && pr >= .94) ? 1 : 0;
        arrow.style.opacity = String(a); noteBtn && noteBtn.classList.toggle('is-hot', a > .5);
        if (a && noteBtn) { const ar = sticky.getBoundingClientRect(), br = noteBtn.getBoundingClientRect(); arrow.style.left = (br.left + br.width / 2 - ar.left) + 'px'; arrow.style.top = (br.top - ar.top - 64) + 'px'; }
      }
      if (goBtn && !static0) { const g = ease(clamp((q - .8) / .16)); goBtn.style.opacity = g.toFixed(3); goBtn.style.transform = `translate(-50%,-50%) scale(${(.86 + .14 * g).toFixed(3)})`; goBtn.style.visibility = g <= 0 ? 'hidden' : 'visible'; goBtn.style.pointerEvents = g > .6 ? 'auto' : 'none'; }
      // fliegende Karten (Parallaxe-Flug)
      const sc = clamp(vw / 1400, .62, 1.1);
      fly.forEach((f) => {
        const z = f.z0 + e * 3600; const near = (z - 700) / 500; // >0: sehr nah an der Kamera
        const op = clamp((z + 3000) / 900) * (1 - clamp(near));
        if (op <= 0.01 || z > 1100) { f.el.style.opacity = '0'; f.el.style.visibility = 'hidden'; return; }
        f.el.style.visibility = 'visible'; f.el.style.opacity = op.toFixed(3);
        f.el.style.transform = `translate(-50%,-50%) translate3d(${(f.x * vw).toFixed(1)}px,${(f.y * vh).toFixed(1)}px,${z.toFixed(0)}px) rotateX(${f.rx}deg) rotateY(${f.ry}deg) rotateZ(${f.rz}deg) scale(${sc.toFixed(3)})`;
      });
      dots.style.opacity = String((1 - clamp(fl * 1.2)) * .9); dots.style.transform = `scale(${(.7 + e * 2.2).toFixed(3)})`;
      if (head) { const fb = head.querySelector('.nb__fly'); if (fb) { fb.style.pointerEvents = pr < .02 ? 'auto' : 'none'; fb.style.opacity = pr < .02 ? '1' : '0'; } }
      if (head) { const o = 1 - clamp(pr / .2); head.style.opacity = o.toFixed(3); head.style.transform = `translate(-50%, ${(-pr * 90).toFixed(1)}px)`; head.style.visibility = o <= 0 ? 'hidden' : 'visible'; head.style.filter = o < 1 ? `blur(${((1 - o) * 6).toFixed(1)}px)` : ''; }
      if (was !== live && !live && document.activeElement && document.activeElement.blur && win.contains(document.activeElement)) document.activeElement.blur();
    };
    let held1 = false;
    const tick = (t) => {
      raf = 0; const dt = lt ? Math.min(.1, (t - lt) / 1000) : .016; lt = t;
      cur += (tgt - cur) * .16; if (Math.abs(tgt - cur) < .0008) cur = tgt;
      const sp = (O0 && tgt >= A0 ? 4 : 1) / Math.max(.8, num(p.introDur, 4.2));
      if (ip === 0 && ipT === 1 && !held1) { held1 = true; holdScroll(Math.max(.8, num(p.introDur, 4.2)) * 1000 + 250); }
      if (ip >= 1 || ipT === 0) { held1 = false; releaseScroll(); }
      if (ip < ipT) ip = Math.min(ipT, ip + dt * sp); else if (ip > ipT) ip = Math.max(ipT, ip - dt * sp * 2);
      if (ip <= 0) tried = false;
      apply(cur);
      if (cur !== tgt || ip !== ipT) raf = requestAnimationFrame(tick); else lt = 0;
    };
    const markTried = () => { if (tried) return; tried = true; if (arrow) arrow.style.opacity = '0'; noteBtn && noteBtn.classList.remove('is-hot'); };
    win.addEventListener('pointerdown', markTried, true);
    // Die Animation startet nicht beim Ankommen (auch nicht bei schnellem Scrollen): erst nach zwei weiteren Scroll-Bewegungen im Board-Fenster
    let arrT = performance.now(), gest = 0, lastG = 0, go1 = false;
    const countG = () => {
      const t = performance.now(); if (ipT || ip > 0 || t - arrT < 450 || t - lastG < 160) { lastG = t; return; }
      lastG = t; const r = root.querySelector('.nb__track').getBoundingClientRect(); if (r.top > 4 || r.bottom < innerHeight * .5) return;
      gest++; if (gest >= 2) { ipT = 1; if (!raf) { lt = 0; raf = requestAnimationFrame(tick); } }
    };
    if (!static0) { addEventListener('wheel', countG, { passive: true }); addEventListener('touchmove', countG, { passive: true }); addEventListener('keydown', (e) => { if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) countG(); }); }
    const flyB = head && head.querySelector('.nb__fly');
    if (flyB) flyB.addEventListener('click', () => { go1 = true; ipT = 1; if (!raf) { lt = 0; raf = requestAnimationFrame(tick); } });
    if (static0) { apply(A0); }
    else { apply(0); track(root.querySelector('.nb__track'), (r, vhh) => { tgt = trackProgress(r, sticky.offsetHeight); if (r.top > 4) { arrT = performance.now(); gest = 0; }
      ipT = (go1 || tgt >= A0 || (r.top <= 4 && gest >= 2)) ? 1 : (r.top > vhh * .25 ? (go1 = false, 0) : ipT); if (!raf) { lt = 0; raf = requestAnimationFrame(tick); } }); addEventListener('resize', () => apply(cur), { passive: true }); }
    return root;
  },
};
