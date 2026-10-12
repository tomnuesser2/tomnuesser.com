# tom nuesser – modulare Portfolio-Seite

Reines HTML/CSS/JS ohne Build-Schritt. Läuft direkt auf GitHub Pages. Inhalte stehen in JSON-Dateien, ein lokales Admin-Backend bearbeitet sie.

## Starten (lokal)

Voraussetzung: Node.js 18 oder neuer.

```
node admin/server.mjs
```

- Seite: http://127.0.0.1:8787/
- Admin: http://127.0.0.1:8787/admin/ (läuft nur auf deinem Rechner)

Nur die Seite ansehen, ohne Admin: `node tools/serve.mjs`

## Aufbau

```
index.html / 404.html      Einstieg (404.html ist eine Kopie, damit Unterseiten auf GitHub Pages funktionieren)
content/site.json          Name, Menü, Social-Links, Kontakt, Effekte an/aus, Theme-Overrides
content/pages/*.json       Seiten (z. B. home)
content/projects/*.json    Projektseiten + Vorschau-Karte für die Startseite
content/index.json         wird automatisch erzeugt (node tools/build-index.mjs)
media/                     hochgeladene Bilder
assets/css/                base (Design-Variablen), layout, blocks, effects
assets/js/blocks/          ein Block = eine Datei
assets/js/effects/         ein Effekt = eine Datei
assets/js/core/            Registry, Medien-Helfer, DOM-Helfer
admin/                     lokales CMS
tools/                     Server, Index-Builder, Screenshot-Check
```

## Was du im Admin machst

- **Projekte:** + klicken, Titel/Vimeo-Link/Vorschaubild eintragen, Blöcke ergänzen. „Gruppe“ steuert die Abstände auf der Startseite (gleiche Zahl = eng gestapelt). Reihenfolge mit ↑ ↓.
- **Seiten:** beliebige neue Seiten aus Blöcken (erreichbar unter /<name>).
- **Einstellungen:** Menü, Social-Links, Formular-Endpunkt, Effekte einzeln an/aus.
- **Online stellen:** führt `git add`, `git commit`, `git push` aus.

Vimeo: Link oder ID eintragen (auch private Links mit Hash). Ohne Vorschaubild wird das Vimeo-Vorschaubild automatisch geladen. Der Player lädt erst nach dem Klick.

## Neuen Block bauen (z. B. Landingpage-Hero, Marquee, Galerie)

1. Datei `assets/js/blocks/meinBlock.js` anlegen:

```js
import { h } from '../core/dom.js';
export default {
  type: 'meinBlock',
  label: 'Mein Block',
  fields: [{ name: 'text', label: 'Text', type: 'text', default: '' }],
  render: (p, ctx) => h('section', { class: 'b-mein container', 'data-reveal': 'up' }, p.text),
};
```
2. In `assets/js/core/registry.js` importieren und ins Array `blocks` eintragen.
3. Fertig: Der Block erscheint im Admin unter „Block hinzufügen“, das Formular entsteht automatisch aus `fields`. Feldtypen: text, textarea, number, select, checkbox, image, list, info.

## Neuen Effekt bauen (z. B. Nachbau eines React-Bits-Effekts)

Eine Datei in `assets/js/effects/` mit `{ name, init(), onPage(root), beforeNavigate?, afterNavigate? }`, in `effects/index.js` eintragen. Danach erscheint er im Admin unter Einstellungen → Effekte. Elemente markierst du über Attribute wie `data-reveal`, `data-split`, `data-parallax`, `data-magnetic`.

### Signature-Features (Wiedererkennung)

- **Scenes auf der Startseite:** Jedes Projekt ist eine Scroll-Szene. Die Karte klappt zum Vollbild auf, zeigt Titel, Rollen und Kurztext, danach läuft ein Filmstreifen mit Stills durchs Bild. Erst dann klickt man ins Projekt. Texte, Rollen, Kamera und Stills pflegst du im Admin beim jeweiligen Projekt. Wer lieber die ruhige Kartenliste will: Block „Projektliste“ → Darstellung `stack`, oder Effekt `scenes` ausschalten.
- **10 Animationen pro Projekt:** Im Admin unter Projekte → „Animation auf der Startseite“ wählst du für jedes Projekt eine: `expand`, `curtain`, `marquee`, `stack`, `gallery`, `iris`, `tilt`, `pullback`, `pixel`, `words`. Im Block „Projektliste“ kannst du auch eine Animation für alle erzwingen. Neue Animation = eine Datei in `assets/js/scenes/` (siehe `curtain.js` als Vorlage) + Eintrag in `assets/js/scenes/index.js`, danach erscheint sie im Admin-Dropdown (Namen dort in `admin/admin.js` ergänzen).
- **Kamera-Sucher (HUD):** Eckmarken, blinkender REC-Punkt, Kamera-Label und laufender Timecode (Tageszeit, 24 fps) über den großen Medien, dazu eine feste REC-Leiste mit Scroll-Prozent.
- **Focus Pull:** Medien laufen beim Einblenden aus der Unschärfe in den Fokus.
- **Blenden-Übergang:** Seitenwechsel wie eine Kamerablende (Iris) um den Klickpunkt.
- **Entwickler-Details:** Logo mit blinkendem Cursor, Scramble-Text („entschlüsselt“ beim Hover/Antippen), Pfad-Zeile `~/work/<projekt>`, Command-Palette mit ⌘K bzw. Strg+K.
- **Menü:** nummerierte Einträge, Tagline und Live-Uhr deines Ortes.

Enthalten: Scroll-Reveal, Wort-für-Wort-Titel, Parallax, Magnet-Buttons, weiches Desktop-Scrolling (am Handy bleibt natives Scrollen), Film-Grain über Medien, Scroll-Fortschritt, Cursor, Header blendet beim Scrollen aus, Seitenübergang, Intro-Übergang. Bei „Bewegung reduzieren“ im System werden alle Bewegungen abgeschaltet.

## Auf GitHub Pages veröffentlichen

1. Neues GitHub-Repository anlegen, diesen Ordner hineinpushen.
2. Settings → Pages → Branch `main`, Ordner `/ (root)`.
3. Eigene Domain: Datei `CNAME` mit `tomnuesser.com` anlegen und beim Domain-Anbieter DNS auf GitHub Pages zeigen lassen. Auf github.io/<repo>/ in `index.html`, `404.html` den Wert `site-base` auf `/<repo>/` setzen.

## Noch von dir einzutragen

- Social-Links (aktuell nur die Startseiten von YouTube/Instagram/LinkedIn)
- Kontaktformular: Endpunkt (z. B. Formspree/Web3Forms) oder E-Mail für mailto unter Einstellungen
- Vimeo-Links und Bilder der Projekte; die Projekte „Project 3–5“ sind Platzhalter
- LEONA-Text: auf dem Screenshot war der zweite Absatz abgeschnitten, er endet jetzt nach „Sony A7 IV.“
- Schrift: Andale Mono ist nicht frei einbettbar. Die Seite nutzt sie, wenn sie auf dem Gerät vorhanden ist (Mac/Windows), sonst Ubuntu Mono / DejaVu Sans Mono. Für identische Darstellung überall eine freie Mono-Schrift als .woff2 in `assets/fonts/` legen und per @font-face in `base.css` einbinden.

## Qualitätscheck

`node tools/verify.mjs` (benötigt Playwright) macht Screenshots auf Handy- und Desktop-Breite und meldet Konsolenfehler und horizontalen Überlauf.

## Video einbinden (Vollbild-Intermezzo „kinetic“)
1. Video als **mp4** (H.264, am besten 10–20 s, unter ~10 MB, ohne Ton nötig) in den Ordner `media/` legen – oder im Admin beim Feld „Hintergrund-Video“ auf „Wählen / hochladen“ klicken.
2. Im Admin die Seite „home“ öffnen → Block „Motion-Intermezzo“ → Feld **Hintergrund-Video** = `media/dein-video.mp4`. Optional ein Vorschaubild und die Abdunklung (%).
3. Das Video läuft automatisch (stumm, Dauerschleife, startet erst wenn man dort ankommt). Die Wörter („film / design / develop / one thread.“) änderst du im gleichen Block, auch die Schriftgröße.

## Bereiche (Videografie / Social Media / Code)
Jedes Projekt hat unter „Projekte“ das Feld **Bereich** (video · social · code). Jede „Projektliste“ auf der Startseite zeigt nur den Bereich, den du dort einstellst.

## Weitere Blöcke
Hero (Überschrift/Unterschrift/Text mit Größe), NOTUA-Flug (eigene App, 3D mit Glitch), Kontakt (mit Impressum-Button), Statement, Leistungen.

## Admin starten (Windows)
`Admin-starten.bat` doppelklicken – installiert bei Bedarf Node.js, startet den Server und öffnet `http://127.0.0.1:8787/admin/`. Ausführliche Erklärung: `ANLEITUNG.html`.
Videos: Vimeo- **und** YouTube-Links werden erkannt (Feld „Video-Link“).
