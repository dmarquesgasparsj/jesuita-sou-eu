// DOM-level application integration in Node. This does not replace a camera
// or layout test on the real iPad; it checks state and translated output.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../dist');
class Element {
  constructor(tag, attrs) {
    this.tagName = tag.toUpperCase(); this.attrs = attrs; this.id = attrs.id; this.dataset = {};
    for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    this.hidden = 'hidden' in attrs; this.open = false; this.disabled = false; this.style = {}; this.className = attrs.class || ''; this.textContent = ''; this.innerHTML = ''; this.listeners = {};
    this.classList = { toggle: (name, force) => { const set = new Set(this.className.split(' ').filter(Boolean)); const add = force === undefined ? !set.has(name) : force; if (add) set.add(name); else set.delete(name); this.className = [...set].join(' '); } };
    if (tag === 'video') { this.videoWidth = 640; this.videoHeight = 480; }
    if (this.id === 'viewfinder') { this.clientWidth = 400; this.clientHeight = 343; }
  }
  setAttribute(name, value) { this.attrs[name] = value; if (name === 'open') this.open = true; }
  removeAttribute(name) { delete this.attrs[name]; if (name === 'src') delete this.src; if (name === 'open') this.open = false; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  async fire(type, event = {}) { for (const listener of this.listeners[type] || []) await listener({ target: this, ...event }); }
  focus() {} scrollIntoView() {} click() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.fire('close'); }
  play() { assert.equal(this.hidden, false, 'The camera must be visible before playback'); assert.equal(this.muted, true); return Promise.resolve(); }
  getContext() { return { drawImage() {} }; }
  toDataURL() { return 'data:image/jpeg;base64,TEST_PHOTO'; }
}
async function main() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const elements = [...html.matchAll(/<([a-z][\w-]*)\b([^>]*?)>/gi)].map(match => {
    const attrs = {}; for (const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
    return new Element(match[1], attrs);
  });
  const byId = id => elements.find(e => e.id === id);
  const docListeners = {};
  global.document = {
    documentElement: {}, hidden: false,
    getElementById: byId,
    querySelectorAll(selector) {
      if (selector === 'dialog[open]') return elements.filter(e => e.tagName === 'DIALOG' && e.open);
      if (selector === 'dialog') return elements.filter(e => e.tagName === 'DIALOG');
      if (selector === '.dialog-close') return elements.filter(e => e.className.includes('dialog-close'));
      const attribute = selector.match(/^\[([^\]]+)\]$/)?.[1];
      return attribute ? elements.filter(e => attribute in e.attrs) : [];
    },
    addEventListener(type, listener) { (docListeners[type] ||= []).push(listener); },
    dispatchEvent(event) { for (const listener of docListeners[event.type] || []) listener(event); return true; }
  };
  global.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
  global.location = { href: 'https://example.test/?lang=pt', search: '?lang=pt' };
  global.history = { replaceState(_state, _title, url) { location.href = url.toString(); location.search = new URL(url).search; } };
  let tracksStopped = 0; let comparisons = 0; let detectionCalls = 0; let requestCount = 0; let denyCamera = false;
  const modelLoads = [];
  Object.defineProperty(global, 'navigator', { value: { onLine: true, mediaDevices: { async getUserMedia() { requestCount++; if (denyCamera) throw {name:'NotAllowedError'}; return { getTracks: () => [{ stop() { tracksStopped++; } }] }; } } }, configurable: true });
  const gallery = JSON.parse(fs.readFileSync(path.join(root, 'gallery.json'), 'utf8'));
  const text = JSON.parse(fs.readFileSync(path.join(root, 'saints-text.json'), 'utf8'));
  const net = name => ({ async loadFromUri() { modelLoads.push(name); } });
  const detection = { box: { width: 150, height: 180 } };
  const windowListeners = {};
  global.window = { isSecureContext: true, addEventListener(type, listener) { (windowListeners[type] ||= []).push(listener); }, faceapi: {
    tf: { async setBackend() { return true; }, getBackend() { return 'cpu'; } },
    nets: { tinyFaceDetector: net('tiny'), ssdMobilenetv1: net('ssd'), faceLandmark68Net: net('landmarks'), faceRecognitionNet: net('recognition') },
    SsdMobilenetv1Options: class {},
    TinyFaceDetectorOptions: class {},
    detectAllFaces() { detectionCalls++; return Promise.resolve([detection]); },
    DetectAllFaceLandmarksTask: class {
      constructor(parent) { this.parent = parent; }
      async withFaceDescriptors() { comparisons++; const faces = await this.parent; return faces.map(face => ({ ...face, descriptor: gallery[0].descriptor })); }
    }
  } };
  global.requestAnimationFrame = callback => setImmediate(callback);
  global.Image = class { constructor() { this.naturalWidth = 600; this.naturalHeight = 750; } set src(value) { this._src = value; queueMicrotask(() => this.onload()); } get src() { return this._src; } };
  global.fetch = async url => ({ ok: true, async json() { return JSON.parse(fs.readFileSync(path.join(root, String(url).replace(/^\.\//, '')), 'utf8')); } });
  await import(pathToFileURL(path.join(root, 'app.js')));
  for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(gallery.length, 30);
  assert.equal((byId('gallery-grid').innerHTML.match(/class="saint-card"/g) || []).length, 30);
  assert(byId('gallery-grid').innerHTML.includes('Inácio de Loyola'));
  const { translate } = await import(pathToFileURL(path.join(root, 'translations.js')));
  for (const code of ['pt','es','fr','en','ko']) {
    byId('language-select').value = code; await byId('language-select').fire('change');
    for (const person of gallery) {
      assert(byId('gallery-grid').innerHTML.includes(text[person.id].locales[code].name), person.id + ':' + code);
      document.dispatchEvent({ type: 'click', target: { closest: () => ({ dataset: { person: person.id } }) } });
      const profile = byId('biography-content').innerHTML;
      const title = translate(code, person.title === 'Beato' ? 'jesuitBlessed' : 'jesuitSaint');
      assert(profile.includes(title), person.id + ':' + code + ':title');
      assert(profile.includes(text[person.id].locales[code].biography[1]));
      assert(profile.includes(person.licenseUrl));
    }
  }
  byId('biography-dialog').close();
  byId('language-select').value = 'pt'; await byId('language-select').fire('change');
  document.permissionsPolicy = { allowsFeature: () => false };
  await byId('camera-start').fire('click');
  assert.equal(requestCount,0,'A blocked parent policy must be explained before requesting hardware');
  assert.equal(byId('camera-help').hidden,false);
  assert.equal(byId('camera-help-status').dataset.i18n,'cameraPolicyError');
  delete document.permissionsPolicy;
  denyCamera = true;
  await byId('camera-start').fire('click');
  assert.equal(byId('camera-start').disabled,false,'Permission denial must restore controls');
  assert.equal(byId('camera-help').hidden,false);
  assert.equal(byId('camera-help-status').dataset.i18n,'cameraPermissionError');
  assert.equal(byId('camera-link').value,'https://example.test/?lang=pt');
  denyCamera = false;
  await byId('camera-start').fire('click');
  assert.equal(byId('camera').hidden, false);
  assert.equal(byId('camera-help').hidden,true);
  for (const code of ['es','fr','en','ko','pt']) {
    byId('language-select').value = code; await byId('language-select').fire('change');
    assert.equal(byId('camera').hidden, false, 'Language switch must preserve a live camera');
    assert.equal(tracksStopped, 0);
    assert(byId('gallery-grid').innerHTML.includes(text[gallery[0].id].locales[code].name));
  }
  // Exercise capture through the lightweight detector. Only model outputs are
  // stubbed: state, ranking, translated rendering and cleanup are real.
  await byId('capture').fire('click');
  assert.equal(byId('results').hidden, false);
  assert.equal(comparisons, 1);
  assert.equal(detectionCalls, 1, 'A normal capture must detect only once');
  assert.deepEqual(modelLoads.sort(), ['landmarks','recognition','tiny']);
  assert(byId('capture-canvas').width <= 640 && byId('capture-canvas').height <= 640);
  const photo = byId('result-selfie').src;
  for (const code of ['es','fr','en','ko','pt']) {
    byId('language-select').value = code; await byId('language-select').fire('change');
    const localized = text[gallery[0].id].locales[code];
    assert(byId('result-story').innerHTML.includes(localized.name));
    assert.equal((byId('result-story').innerHTML.match(/class="biography"/g) || []).length, 2);
    assert.equal(byId('result-selfie').src, photo);
    assert.equal(comparisons, 1, 'Switching language must not repeat inference');
    document.dispatchEvent({ type: 'click', target: { closest: () => ({ dataset: { person: gallery[0].id } }) } });
    assert(byId('biography-content').innerHTML.includes(localized.biography[0]));
    assert(byId('biography-content').innerHTML.includes(localized.biography[1]));
    assert.equal(byId('biography-dialog').open, true);
  }
  await byId('new-person').fire('click');
  assert.equal(byId('result-selfie').src, undefined);
  assert.equal(byId('photo-preview').src, undefined);
  assert.equal(byId('results').hidden, true);
  assert.equal(byId('result-story').innerHTML, '');
  await byId('demo-test').fire('click');
  assert.equal(byId('results').hidden, false);
  assert.equal(modelLoads.filter(name => name === 'ssd').length, 1, 'Painted demos load the fallback only when needed');
  assert.equal(comparisons, 2);
  assert.equal(detectionCalls, 2);
  await byId('new-person').fire('click');
  window.JESUITA_BUNDLED_ASSETS = true;
  await byId('prepare-stand').fire('click');
  assert.equal(byId('offline-status').dataset.i18n,'offlineSaved','The Windows package must use its bundled offline resources');
  delete window.JESUITA_BUNDLED_ASSETS;
  window.JesuitaNative = { bundledAssetsAvailable: () => true };
  await byId('prepare-stand').fire('click');
  assert.equal(byId('offline-status').dataset.i18n,'offlineSaved','The Android bridge must use the bundled offline resources');
  await byId('camera-start').fire('click');
  const stopsBeforePause = tracksStopped;
  for (const listener of windowListeners['jesuita-native-pause']) listener();
  assert(tracksStopped > stopsBeforePause,'Leaving the native app must stop the camera');
  assert.equal(byId('camera').srcObject,null);
  assert.equal(byId('photo-preview').src,undefined);
  console.log(JSON.stringify({ status: 'passed', languages: 5, camera_preserved_on_language_switch: true, photo_preserved_on_language_switch: true, capture_uses_lightweight_detector: true, ssd_loaded_only_for_demo: true, biography_paragraphs_per_result: 2, reset_deletes_photo: true, native_bundled_assets: true, native_pause_stops_camera: true }));
}
main().catch(error => { console.error(error.stack); process.exit(1); });
