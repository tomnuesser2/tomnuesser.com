// Zweisprachigkeit (Deutsch / Englisch).
// Prinzip: In den JSON-Dateien steht der englische Text wie gewohnt unter "title", der deutsche daneben unter "title_de".
// Vor dem Rendern wird alles in die aktive Sprache aufgelöst – die Blöcke selbst merken davon nichts.
export const LANGS = ['de', 'en'];
const KEY = 'tn-lang';
let lang = 'de';
try { const s = localStorage.getItem(KEY); if (LANGS.includes(s)) lang = s; } catch { /* Speicher gesperrt */ }
document.documentElement.lang = lang;

export const getLang = () => lang;
export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l; document.documentElement.lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* egal */ }
}

// Alle "<name>_de"-Schlüssel auflösen. Deutsch: ersetzt <name>, wenn nicht leer. Englisch: wird verworfen.
export function localize(v) {
  if (Array.isArray(v)) return v.map(localize);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) { if (!k.endsWith('_de')) out[k] = localize(val); }
    if (lang === 'de') for (const [k, val] of Object.entries(v)) {
      if (k.endsWith('_de') && typeof val === 'string' && val.trim() !== '') out[k.slice(0, -3)] = val;
    }
    return out;
  }
  return v;
}

// Texte der Oberfläche, die nicht im Admin stehen (Buttons, Hinweise, Fehlermeldungen)
const UI = {
  openMenu: { en: 'Open menu', de: 'Menü öffnen' }, closeMenu: { en: 'Close menu', de: 'Menü schließen' },
  main: { en: 'Main', de: 'Hauptmenü' }, home: { en: 'home', de: 'Startseite' },
  pressKey: { en: 'press', de: 'drücke' }, jumpAnywhere: { en: 'to jump anywhere', de: 'um überallhin zu springen' },
  goTo: { en: 'go to…', de: 'gehe zu…' }, noResults: { en: 'no results', de: 'keine Treffer' }, palette: { en: 'Command palette', de: 'Schnellsuche' },
  notFound: { en: 'Not found', de: 'Nicht gefunden' }, notFoundText: { en: 'This page does not exist.', de: 'Diese Seite gibt es nicht.' },
  loadFail: { en: 'Could not load site content.', de: 'Inhalte konnten nicht geladen werden.' },
  openProject: { en: 'open project', de: 'Projekt öffnen' },
  formOff: { en: 'The contact form is not connected yet.', de: 'Das Kontaktformular ist noch nicht verbunden.' },
  mailSubject: { en: 'Message from ', de: 'Nachricht von ' },
  language: { en: 'Language', de: 'Sprache' },
};
export const ui = (k) => (UI[k] ? UI[k][lang] || UI[k].en : k);
