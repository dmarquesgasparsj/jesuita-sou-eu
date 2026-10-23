const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(root, path.join(dir, e.name)).replaceAll(path.sep, '/')]); }
const assets = walk(root).filter(f => f !== 'offline-assets.json' && f !== 'sw.js').sort();
assets.push('offline-assets.json');
fs.writeFileSync(path.join(root, 'offline-assets.json'), JSON.stringify({ version: '20261023-v11', assets }, null, 2) + '\n');
console.log('Recursos offline:', assets.length);
