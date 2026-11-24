const fs = require('fs/promises');
const path = require('path');
const {
  LOCALES, pickLanguage, getStrings, formatDate,
} = require('../utils/i18n');

const TEMPLATE = path.join(__dirname, '..', '..', 'views', 'feedback.html');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// GET /feedback?lang=fr
async function showFeedback(req, res) {
  const lang = pickLanguage(req.query.lang);
  const t = getStrings(lang);
  let html = await fs.readFile(TEMPLATE, 'utf8');

  const questions = t.questions.map((q, i) => `
    <div class="question">
      <label for="q${i + 1}">${i + 1}. ${escapeHtml(q)}</label>
      <textarea id="q${i + 1}" name="q${i + 1}">${escapeHtml(t.answers[i] || '')}</textarea>
    </div>`).join('');

  const langLinks = Object.keys(LOCALES).map((code) => {
    const cls = code === lang ? ' class="active"' : '';
    return `<a href="/feedback?lang=${code}"${cls}>${escapeHtml(LOCALES[code].lang_name)}</a>`;
  }).join(' ');

  const values = {
    lang,
    title: escapeHtml(t.title),
    instructions: escapeHtml(t.instructions),
    date_label: escapeHtml(t.date_label),
    language_label: escapeHtml(t.language_label),
    submit: escapeHtml(t.submit),
    today: escapeHtml(formatDate(lang)),
    lang_links: langLinks,
    questions,
  };
  html = html.replace(/{{(\w+)}}/g, (match, key) => (key in values ? values[key] : match));

  res.status(200).type('html').send(html);
}

module.exports = { showFeedback, escapeHtml };
