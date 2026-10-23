const CACHE_NAME = 'jesuita-sou-eu-20261023-v12';
const CACHE_PREFIX = 'jesuita-sou-eu-';
let requiredAssets;
const absolute = path => new URL(path, self.registration.scope).href;
async function assetList() {
  if (requiredAssets) return requiredAssets;
  const response = await fetch(absolute('offline-assets.json'), { cache: 'no-store' });
  if (!response.ok) throw new Error('A lista de recursos não está disponível.');
  const data = await response.json();
  requiredAssets = data.assets.map(absolute);
  return requiredAssets;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const assets = await assetList(); const cache = await caches.open(CACHE_NAME);
    await cache.addAll(assets.map(url => new Request(url, { credentials: 'same-origin', cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Keep this site's caches separate from every other application.
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (event.request.mode === 'navigate') {
      const home = await cache.match(absolute('index.html'));
      if (home) {
        // Hosting redirects /index.html to /. Navigation uses redirect: manual,
        // which rejects cached redirected responses. Rebuild the response to
        // keep its content and headers without the redirect metadata.
        return home.redirected
          ? new Response(home.body, { status: home.status, statusText: home.statusText, headers: home.headers })
          : home;
      }
      return fetch(event.request);
    }
    const cached = await cache.match(event.request, { ignoreSearch: false });
    return cached || fetch(event.request);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_READY' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Read the cached manifest to make this check work without a network.
      const response = await cache.match(absolute('offline-assets.json'));
      if (!response) { event.ports[0].postMessage({ ready: false }); return; }
      const data = await response.json(); const missing = [];
      for (const path of data.assets) if (!(await cache.match(absolute(path)))) missing.push(path);
      event.ports[0].postMessage({ ready: missing.length === 0, count: data.assets.length });
    } catch { event.ports[0].postMessage({ ready: false }); }
  })());
});
