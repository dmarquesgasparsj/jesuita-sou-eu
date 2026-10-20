const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist');
const origin = 'https://offline-test.example';
const basePath = process.argv[2] || '/';
assert(basePath.startsWith('/') && basePath.endsWith('/'), 'The deployment path must begin and end with /.');
const scope = origin + basePath;
const events = {};
const stores = new Map();
let connected = true;
let networkReads = 0;
const key = r => typeof r === 'string' ? r : r.url;
function cloneCachedResponse(response) {
  if (!response) return undefined;
  const copy = response.clone();
  // Cache Storage preserves redirect metadata; our file-backed mock must too.
  Object.defineProperty(copy, 'redirected', { value: response.redirected });
  Object.defineProperty(copy, 'url', { value: response.url });
  return copy;
}
async function fetchFile(request) {
  if (!connected) throw new Error('Network disconnected');
  networkReads++;
  const url = new URL(key(request));
  assert(url.pathname.startsWith(basePath), 'Request outside the deployment path: ' + url.pathname);
  const relativePath = decodeURIComponent(url.pathname.slice(basePath.length));
  const file = path.join(root, relativePath);
  const response = new Response(fs.readFileSync(file), { status: 200 });
  // Exercise the index.html redirect within either deployment path.
  Object.defineProperty(response, 'redirected', { value: relativePath === 'index.html' });
  Object.defineProperty(response, 'url', { value: relativePath === 'index.html' ? scope : url.href });
  return response;
}
const cacheStorage = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async addAll(requests) { const pairs = await Promise.all(requests.map(async r => [key(r), await fetchFile(r)])); for (const [url, response] of pairs) store.set(url, response); },
      async match(request) { return cloneCachedResponse(store.get(key(request))); }
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); }
};
async function event(type, properties = {}) {
  let pending;
  let response;
  events[type]({ ...properties, waitUntil(p) { pending = p; }, respondWith(p) { response = p; } });
  if (pending) await pending;
  return response ? await response : undefined;
}
async function main() {
  const self = { registration: { scope }, location: { origin }, clients: { async claim() {} }, async skipWaiting() {}, addEventListener(name, callback) { events[name] = callback; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), { self, caches: cacheStorage, fetch: fetchFile, URL, Request, Response, console });
  await event('install'); await event('activate');
  connected = false; const readsBefore = networkReads;
  const assets = JSON.parse(fs.readFileSync(path.join(root, 'offline-assets.json'), 'utf8')).assets;
  for (const asset of assets) {
    const response = await event('fetch', { request: new Request(scope + asset) });
    assert(response?.ok, 'Unavailable offline: ' + asset);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(root, asset)));
  }
  const cache = await cacheStorage.open((await cacheStorage.keys())[0]);
  assert.equal((await cache.match(scope + 'index.html')).redirected, true, 'The regression must exercise the hosting redirect.');
  for (const route of ['/', '/?lang=pt', '/?lang=fr', '/index.html']) {
    const navigation = await event('fetch', { request: { url: scope + route.slice(1), method: 'GET', mode: 'navigate', redirect: 'manual' } });
    assert.equal(navigation.redirected, false, 'Browsers reject redirected service-worker responses on navigation: ' + route);
    assert.deepEqual(Buffer.from(await navigation.arrayBuffer()), fs.readFileSync(path.join(root, 'index.html')));
  }
  let readiness;
  await event('message', { data: { type: 'CHECK_READY' }, ports: [{ postMessage(data) { readiness = data; } }] });
  assert.equal(readiness.ready, true);
  assert.equal(networkReads, readsBefore, 'Offline use must not depend on network reads.');
  assert.equal(await event('fetch', { request: new Request('https://other.example/test') }), undefined);
  assert.equal(await event('fetch', { request: new Request(scope + 'photograph', { method: 'POST' }) }), undefined);
  if (basePath !== '/') assert.equal(await event('fetch', { request: new Request(origin + '/another-project/app.js') }), undefined);
  console.log(JSON.stringify({ status: 'passed', deployment_path: basePath, offline_assets_served: assets.length, cached_navigation_routes: 4, redirected_navigation_regression: 'passed', readiness: true, network_requests_during_offline_test: 0 }));
}
main().catch(e => { console.error(e.message); process.exit(1); });
