import { ui } from '../core/i18n.js';
import { h, svg, paragraphs } from '../core/dom.js';
import { ICONS } from './socials.js';
import { isFinePointer } from '../core/dom.js';
// Kontakt: dunkle Karte mit Leuchtfläche (folgt dem Mauszeiger), großer Überschrift, Formular und Impressum-Button direkt neben "Send".
export default {
  type: 'contactForm',
  label: 'Kontakt (Formular + Impressum-Button)',
  fields: [
    { name: 'title', label: 'Überschrift', type: 'textarea', default: 'Got a story?\nLet’s make it move.', de: 'Du hast eine Story?\nLass uns Bewegung reinbringen.' },
    { name: 'text', label: 'Text', type: 'textarea', default: 'Film, design or a website – tell me what you have in mind and I will get back to you.', de: 'Film, Design oder Website – erzähl mir, was du vorhast, und ich melde mich bei dir.' },
    { name: 'nameLabel', label: 'Feld „Name“', type: 'text', default: 'Your name', de: 'Dein Name' },
    { name: 'emailLabel', label: 'Feld „E-Mail“', type: 'text', default: 'Your email', de: 'Deine E-Mail' },
    { name: 'messageLabel', label: 'Feld „Nachricht“', type: 'text', default: 'Your message', de: 'Deine Nachricht' },
    { name: 'sendLabel', label: 'Button-Text', type: 'text', default: 'Send ↗', de: 'Senden ↗' },
    { name: 'sendingLabel', label: 'Text beim Senden', type: 'text', default: 'Sending…', de: 'Wird gesendet…' },
    { name: 'okText', label: 'Meldung: gesendet', type: 'text', default: 'Thank you — your message has been sent.', de: 'Danke – deine Nachricht ist angekommen.' },
    { name: 'errText', label: 'Meldung: Fehler', type: 'text', default: 'Something went wrong. Please try again later.', de: 'Da ist etwas schiefgelaufen. Bitte versuch es später noch einmal.' },
    { name: 'fillText', label: 'Meldung: Felder fehlen', type: 'text', default: 'Please fill in all fields.', de: 'Bitte fülle alle Felder aus.' },
    { name: 'endpoint', label: 'Formular-Endpunkt (z. B. Formspree-URL) – leer = Wert aus Einstellungen', type: 'text', default: '' },
    { name: 'impressumLabel', label: 'Überschrift Impressum', type: 'text', default: 'Impressum' },
    { name: 'impressumText', label: 'Impressum-Text (Leerzeile = neuer Absatz) – steht rechts neben dem Formular', type: 'textarea', default: '' },
  ],
  render(p0, ctx) {
    const p = { ...Object.fromEntries(this.fields.filter(f => f.default !== undefined).map(f => [f.name, f.default])), ...p0 };
    const endpoint = p.endpoint || ctx.site.contact?.endpoint || '';
    const mailto = ctx.site.contact?.email || '';
    const note = h('p', { class: 'form-note', role: 'status', 'aria-live': 'polite' });
    const btn = h('button', { class: 'btn', type: 'submit', 'data-magnetic': '1' }, p.sendLabel);
    const field = (name, label, tag = 'input', type = 'text') => {
      const el = h(tag, { name, id: `f-${name}`, placeholder: ' ', required: true, autocomplete: name === 'name' ? 'name' : name === 'email' ? 'email' : 'off', type: tag === 'input' ? type : null, rows: tag === 'textarea' ? 1 : null });
      if (tag === 'textarea') el.addEventListener('input', () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; });
      return h('div', { class: 'field' }, el, h('label', { for: `f-${name}` }, label));
    };
    const impBody = paragraphs(p.impressumText).map(t => h('p', {}, t));
    const form = h('form', { class: 'cx__form', novalidate: true },
      field('name', p.nameLabel), field('email', p.emailLabel, 'input', 'email'), field('message', p.messageLabel, 'textarea'),
      h('input', { class: 'hp', type: 'text', name: '_gotcha', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
      h('div', { class: 'cx__actions' }, btn), note);
    const socials = h('div', { class: 'cx__soc' });
    for (const s of ctx.site.socials || []) { const icon = ICONS[s.icon] || ICONS[String(s.label || '').toLowerCase()]; if (icon) socials.append(h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': s.label || s.icon }, svg(icon))); }
    const lines = String(p.title).split('\n').filter(Boolean).map(t => h('span', {}, t));
    const el = h('section', { class: 'cx', id: p.id },
      h('div', { class: 'cx__card', 'data-reveal': 'up' },
        h('div', { class: 'cx__l' }, h('h2', { class: 'cx__t' }, lines), h('p', { class: 'cx__p' }, p.text), form),
        h('aside', { class: 'cx__r' }, h('h3', { class: 'cx__ih' }, p.impressumLabel || 'Impressum'), h('div', { class: 'cx__imp' }, impBody), mailto ? h('a', { class: 'cx__mail', href: `mailto:${mailto}` }, mailto) : null, socials)));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      note.className = 'form-note';
      const data = new FormData(form);
      if (data.get('_gotcha')) return;
      if (!form.checkValidity()) { note.textContent = p.fillText; note.classList.add('is-error'); return; }
      if (!endpoint) {
        if (mailto) {
          const body = encodeURIComponent(`${data.get('message')}\n\n— ${data.get('name')} (${data.get('email')})`);
          location.href = `mailto:${mailto}?subject=${encodeURIComponent(ui('mailSubject') + data.get('name'))}&body=${body}`;
          return;
        }
        note.textContent = ui('formOff'); note.classList.add('is-error'); return;
      }
      btn.disabled = true; btn.textContent = p.sendingLabel;
      try {
        const r = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(String(r.status));
        form.reset(); form.querySelector('textarea').style.height = '';
        note.textContent = p.okText;
      } catch {
        note.textContent = p.errText; note.classList.add('is-error');
      } finally { btn.disabled = false; btn.textContent = p.sendLabel; }
    });
    return el;
  },
};
