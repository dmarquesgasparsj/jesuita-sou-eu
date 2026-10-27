const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
async function main() {
  const people = JSON.parse(fs.readFileSync(path.join(dist, 'gallery.json'), 'utf8'));
  assert.equal(people.length, 45, 'Devem existir 45 retratos.');
  assert.equal(new Set(people.map(p => p.id)).size, 45);
  const { rankPortraits, euclideanDistance } = await import(pathToFileURL(path.join(dist, 'matching.js')));
  for (const p of people) {
    assert.equal(p.descriptor.length, 128, `Descritor de ${p.id}`);
    assert(p.descriptor.every(Number.isFinite));
    assert(fs.statSync(path.join(dist, p.image)).size > 1000, `Imagem de ${p.id}`);
    assert(p.biography && p.question && p.name && p.license && p.imageAuthor);
    assert(['Santo','Beato'].includes(p.title), 'Estatuto de ' + p.id);
    assert(p.licenseUrl?.startsWith('https://'), 'Licença de ' + p.id);
    assert(p.imageSource.startsWith('https://commons.wikimedia.org/'));
    assert(p.biographyUrl.startsWith('https://www.jesuits.global/'));
    const ordered = rankPortraits(p.descriptor, people);
    assert.equal(ordered[0].person.id, p.id, `Associação do retrato ${p.id}`);
    assert.equal(ordered.length, 3);
  }
  let closest = Infinity;
  for (let a = 0; a < people.length; a++) for (let b = a + 1; b < people.length; b++) closest = Math.min(closest, euclideanDistance(people[a].descriptor, people[b].descriptor));
  assert(closest > .10, 'Os retratos não podem ter descritores duplicados.');
  for (const model of ['tiny_face_detector_model', 'ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'models', model + '-weights_manifest.json'), 'utf8'));
    for (const group of manifest) for (const file of group.paths) assert(fs.statSync(path.join(dist, 'models', file)).size > 1000, 'Falta um ficheiro do modelo.');
  }
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'IDs HTML únicos.');
  const app = fs.readFileSync(path.join(dist, 'app.js'), 'utf8');
  for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(match[1]), 'Falta elemento ' + match[1]);
  for (const m of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) assert(fs.existsSync(path.join(dist, m[1])), 'Falta recurso HTML: ' + m[1]);
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'offline-assets.json'), 'utf8'));
  const cached = new Set(manifest.assets);
  function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(dist, path.join(dir, e.name)).replaceAll(path.sep, '/')]); }
  for (const file of walk(dist)) if (file !== 'sw.js') assert(cached.has(file), 'Falta no modo offline: ' + file);
  for (const file of manifest.assets) assert(fs.existsSync(path.join(dist, file)), 'Recurso offline inexistente: ' + file);
  for (const file of ['app.js', 'appearance.js', 'camera-access.js', 'face-engine.js', 'matching.js', 'i18n.js', 'translations.js', 'photo-gallery.js', 'sw.js']) execFileSync(process.execPath, ['--check', path.join(dist, file)], { stdio: 'pipe' });
  assert(!/Math\.random|localStorage|sessionStorage|indexedDB|sendBeacon/.test(app), 'A aplicação não deve gerar resultados aleatórios nem persistir fotografias.');
  assert(!/fetch\([^)]*method\s*:\s*['"]POST/.test(app));
  const bytes = walk(dist).reduce((n, f) => n + fs.statSync(path.join(dist, f)).size, 0);
  console.log(JSON.stringify({ status: 'passed', portraits: people.length, offline_assets: cached.size, javascript: 'syntax valid', min_portrait_distance: Number(closest.toFixed(4)), total_bytes: bytes }));
}
main().catch(e => { console.error(e.message); process.exit(1); });
