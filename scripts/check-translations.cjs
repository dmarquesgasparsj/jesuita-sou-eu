const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../dist');
async function main() {
  const { languages, translations, translate } = await import(pathToFileURL(path.join(root, 'translations.js')));
  const gallery = JSON.parse(fs.readFileSync(path.join(root, 'gallery.json'), 'utf8'));
  const saints = JSON.parse(fs.readFileSync(path.join(root, 'saints-text.json'), 'utf8'));
  assert.deepEqual(languages.map(x => x.code), ['pt','es','fr','en','ko']);
  const keys = Object.keys(translations.pt).sort();
  for (const { code } of languages) {
    assert.deepEqual(Object.keys(translations[code]).sort(), keys);
    for (const key of keys) {
      assert.equal(typeof translations[code][key], 'string', code + ':' + key);
      assert(translations[code][key].trim(), code + ':' + key);
      const tokens = text => (text.match(/\{\w+\}/g) || []).sort();
      assert.deepEqual(tokens(translations[code][key]), tokens(translations.pt[key]), code + ':' + key);
    }
    for (const person of gallery) {
      const content = saints[person.id]?.locales[code];
      assert(content, person.id + ':' + code);
      assert.equal(content.biography.length, 2, 'Two paragraphs per biography');
      assert(content.biography.every(p => typeof p === 'string' && p.trim().length > 45));
      assert(content.name && content.theme && content.question);
      const years = locale => [...new Set(locale.biography.join(' ').match(/(?<![0-9])[0-9]{4}(?![0-9])/g) || [])].sort();
      assert.deepEqual(years(content), years(saints[person.id].locales.pt), person.id + ':' + code + ': consistent years');
      if (code === 'ko') assert(/[가-힣]/.test(content.name + content.biography.join('')));
      if (code === 'pt') assert.equal(content.question, person.question, 'Keep the original Portuguese question');
      assert(saints[person.id].sources.length >= 1);
      assert(saints[person.id].sources.some(url=>url.startsWith('https://www.jesuits.global/')));
    }
    assert(!translate(code, 'modelLoadProgress', { count: 2 }).includes('{count}'));
    assert(translate(code, 'meetPerson', { name: 'TEST_NAME' }).includes('TEST_NAME'));
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/data-i18n(?:-html|-aria|-alt|-content)?="([^"]+)"/g)) assert(keys.includes(match[1]), 'Missing HTML translation: ' + match[1]);
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  for (const match of app.matchAll(/\bt\('([^']+)'/g)) assert(keys.includes(match[1]), 'Missing app translation: ' + match[1]);
  for (const match of app.matchAll(/\b(?:message|ExperienceError)\('([^']+)'/g)) assert(keys.includes(match[1]), 'Missing message translation: ' + match[1]);
  for (const match of app.matchAll(/setStatus\('[^']+', '([^']+)'/g)) assert(keys.includes(match[1]), 'Missing status translation: ' + match[1]);
  console.log(JSON.stringify({ status: 'passed', languages: 5, interface_keys_per_language: keys.length, biographies: gallery.length * languages.length, biography_paragraphs: gallery.length * languages.length * 2, portuguese_questions: 'unchanged' }));
}
main().catch(error => { console.error(error.message); process.exit(1); });
