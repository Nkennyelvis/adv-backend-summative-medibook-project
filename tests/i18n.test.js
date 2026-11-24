const {
  pickLanguage, getStrings, formatDate, LOCALES,
} = require('../src/utils/i18n');
const { escapeHtml } = require('../src/controllers/feedbackController');

describe('i18n', () => {
  test('default language is English', () => {
    expect(pickLanguage(undefined)).toBe('en');
  });

  test('fr is supported', () => {
    expect(pickLanguage('fr')).toBe('fr');
    expect(getStrings('fr').questions[0]).toMatch(/difficile/);
  });

  test('unsupported language falls back to English', () => {
    expect(pickLanguage('de')).toBe('en');
    expect(pickLanguage(['fr', 'en'])).toBe('en'); // ?lang=fr&lang=en gives an array
    expect(getStrings('xx').title).toBe(LOCALES.en.title);
  });

  test('every locale has exactly 5 questions and 5 answers', () => {
    for (const strings of Object.values(LOCALES)) {
      expect(strings.questions).toHaveLength(5);
      expect(strings.answers).toHaveLength(5);
      expect(Object.keys(strings).sort()).toEqual(Object.keys(LOCALES.en).sort());
    }
  });

  test('date is formatted for the locale', () => {
    const d = new Date('2026-12-01T10:00:00');
    expect(formatDate('en', d)).toMatch(/December/);
    expect(formatDate('fr', d)).toMatch(/décembre/);
  });

  test('html is escaped', () => {
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  });
});
