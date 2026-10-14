import device from './device.js';

// Laptop 3D: echter 3D-Laptop (WebGL). Startet zugeklappt und frontal auf dem Deckel-Logo, klappt beim Runterscrollen auf und dreht sich in die Schrägansicht.
// Wie der Block „Gerät“ mit Text daneben (Überschrift, Text, Einträge) – nur mit dem 3D-Gerät. Läuft ohne WebGL automatisch als schlichter Laptop.
const DROP = new Set(['kind', 'chromeMobile', 'volumeUi']);
export default {
  ...device,
  type: 'laptop3d', label: 'Laptop 3D (echter 3D-Laptop, klappt beim Scrollen auf)',
  fields: [...device.fields.filter(f => !DROP.has(f.name)), 
    { name: 'finish', label: 'Gehäusefarbe', type: 'select', options: ['space schwarz', 'silber', 'space grau', 'mitternacht', 'sternenlicht', 'gold'], default: 'space schwarz' },
    { name: 'frameColor', label: 'Eigene Gehäusefarbe (Hex, z. B. #8a8f98; leer = wie oben)', type: 'text', default: '' },
    { name: 'logo', label: 'Logo auf dem Deckel (Bild; leer = kein Logo)', type: 'image', default: 'media/notua-logo.png' },
    { name: 'anim', type: 'laptopAnim', label: '🎬 Animation selbst bestimmen (Start → Ende mit Vorschau)' },
    { name: 'scale', label: 'Größe des Laptops (1 = normal, 1.3 = größer)', type: 'number', default: 1 },
  ].map(f => f.name === 'chrome' ? { ...f, label: 'Browser-Leiste oben im Bildschirm anzeigen (Punkte + Adresszeile)' } : f.name === 'items' ? { ...f, label: 'Einträge (Bild oder .mp4; hohe Website-Screenshots scrollen im Bildschirm)' } : f),
  render(p, ctx) { return device.render({ ...p, kind: 'laptop', _gl: true }, ctx); },
};
