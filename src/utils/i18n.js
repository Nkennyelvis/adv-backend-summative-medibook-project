const en = require('../../locales/en.json');
const fr = require('../../locales/fr.json');

const LOCALES = { en, fr };
const DEFAULT_LANG = 'en';

// unknown or missing ?lang= falls back to English
function pickLanguage(lang) {
  if (typeof lang !== 'string') return DEFAULT_LANG;
  const short = lang.toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(LOCALES, short) ? short : DEFAULT_LANG;
}

function getStrings(lang) {
  return LOCALES[pickLanguage(lang)];
}

function formatDate(lang, date = new Date()) {
  const strings = getStrings(lang);
  return new Intl.DateTimeFormat(strings.locale, { dateStyle: 'full' }).format(date);
}

module.exports = {
  LOCALES, DEFAULT_LANG, pickLanguage, getStrings, formatDate,
};
