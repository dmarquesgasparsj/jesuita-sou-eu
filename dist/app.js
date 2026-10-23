import { mountPhotoGallery } from './photo-gallery.js';
import { rankPortraits } from './matching.js';
import { t, currentLanguage, translateElements, setLanguage } from './i18n.js';
import { detectFacesForComparison, minimumFaceSize, warmFaceModels } from './face-engine.js';
import { cameraSupportError, cameraErrorKey, requestCameraStream, playCameraVideo } from './camera-access.js';

const $ = id => document.getElementById(id);
const state = { gallery: [], texts: {}, resultMatches: null, biographyId: null, biographyPhoto: 0, photos: {}, stream: null, phase: 'welcome', front: true, enginePromise: null, fallbackPromise: null, engineReady: false, registrationPromise: null, offlineReady: false, cameraTested: false, busy: false, operation: 0, resetTimer: null };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLink = (url, label, className = 'source-link') => `<a class="${className}" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`;

class ExperienceError extends Error {
  constructor(key) { super(key); this.translationKey = key; }
}
function setStatus(id, key, kind = '', parameters = {}) {
  const el = $(id); el.dataset.i18n = key; el.dataset.i18nParams = JSON.stringify(parameters);
  el.textContent = t(key, parameters); el.className = kind;
}
function message(key, isError = false) { setStatus('station-message', key, isError ? 'station-message error' : 'station-message'); }
function personText(person) { return { ...person, ...(state.texts[person.id]?.locales[currentLanguage()] || state.texts[person.id]?.locales.pt || {}) }; }
function biographyHtml(person, className = '') { return person.biography.map(paragraph => `<p${className ? ` class="${className}"` : ''}>${escape(paragraph)}</p>`).join(''); }
function jesuitTitle(person) { return t(person.title === 'Beato' ? 'jesuitBlessed' : 'jesuitSaint'); }
const imageFit = person => person.imageFit === 'contain' ? 'contain' : 'cover';
function imageLicense(person) {
  const label = person.licenseKind === 'cc' ? person.license : t('publicDomain');
  return sourceLink(person.licenseUrl, label, '');
}
function imageAuthor(person) {
  if (person.authorUnknown) return t('authorUnknown');
  if (['luis-gonzaga','pedro-claver'].includes(person.id)) return t('authorUnknown');
  if (person.id === 'francisco-xavier') return t('authorUnknownJapanese');
  if (person.id === 'roberto-belarmino') return t('authorUnknownItalian');
  if (person.id === 'pedro-fabro') return `${t('engraverUnknown')} · ${t('reproduction')}: Bwag`;
  if (person.id === 'joao-berchmans') return `${t('engraverUnknown')} · ${t('reproduction')}: Grentidez`;
  if (person.id === 'joao-brito') return `${t('authorUnknown')} · ${t('reproduction')}: Grentidez`;
  return person.imageAuthor;
}
function showDialog(id) { const dialog = $(id); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
function closeDialog(id) { const dialog = $(id); if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
function setBusy(busy) { state.busy = busy; ['camera-start','capture','retry','upload-button','camera-flip','camera-cancel','demo-test'].forEach(id => $(id).disabled = busy); }
function setProcessing(on, key = 'findingLookalike') { $('processing-cover').hidden = !on; setStatus('processing-label', key); }
function stopStream() { if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; } $('camera').srcObject = null; }
function clearPhoto() { ['photo-preview','result-selfie'].forEach(id => { $(id).removeAttribute('src'); }); const c = $('capture-canvas'); c.width = 1; c.height = 1; $('photo-file').value = ''; }

function updateReadiness() {
  $('header-offline-dot').classList.toggle('ready', state.offlineReady);
  const ready = state.engineReady && state.offlineReady && state.cameraTested;
  setStatus('stand-summary', ready ? 'readyTestOffline' : state.engineReady && state.offlineReady ? 'readyTestCamera' : 'readyPrepare', 'stand-summary');
}

function renderGallery() {
  $('gallery-grid').innerHTML = state.gallery.map((raw, i) => {
    const p = personText(raw);
    return `<button type="button" class="saint-card" data-person="${escape(p.id)}" aria-label="${escape(t('meetPerson', { name: p.name }))}"><span class="saint-image" style="display:block"><img src="${escape(p.image)}" alt="${escape(t('portraitOf', { name: p.name }))}" loading="lazy" decoding="async" style="object-fit:${imageFit(p)};object-position:${escape(p.position || '50% 35%')}"><span class="saint-number">${String(i + 1).padStart(2, '0')}</span></span><span class="card-name">${escape(p.name)}</span><span class="card-theme"><span>${escape(p.theme)}</span><span aria-hidden="true">↗</span></span></button>`;
  }).join('');
  const collage = [state.gallery[0], state.gallery[4], state.gallery[1]].filter(Boolean);
  $('portrait-collage').innerHTML = collage.map(p => `<img class="collage-portrait" src="${escape(p.image)}" style="object-fit:${imageFit(p)};object-position:${escape(p.position || '50% 35%')}" alt="">`).join('');
}

let biographyGallery;
function renderBiography(id) {
  const raw = state.gallery.find(x => x.id === id); if (!raw) return;
  const p = personText(raw);
  const photos = [{ image: p.image, caption: t('comparisonPortrait', { name: p.name }), author: imageAuthor(p), license: p.licenseKind === 'cc' ? p.license : t('publicDomain'), licenseUrl: p.licenseUrl, sourceUrl: p.imageSource, note: t(p.imageFit === 'contain' ? 'portraitResizedOnly' : 'portraitChanges') + (p.imageNote ? ' ' + p.imageNote : '') }, ...(state.photos[id] || []).map(photo => ({ ...photo, caption: photo.captions?.[currentLanguage()] || photo.captions?.pt || t('portraitOf', { name: p.name }), note: t('photoResized') }))];
  $('biography-content').innerHTML = `<div class="biography-photos"></div><div class="biography-text"><p class="eyebrow">${escape(p.theme)}</p><h2>${escape(p.name)}</h2><p class="life-dates">${escape(p.dates)} · ${escape(jesuitTitle(p))}</p>${biographyHtml(p)}<div class="question-card"><span>${escape(t('conversationQuestion'))}</span><p>${escape(p.question)}</p></div>${sourceLink(p.biographyUrl, t('knowStory'))}</div>`;
  biographyGallery?.destroy();
  biographyGallery = mountPhotoGallery($('biography-content').querySelector('.biography-photos'), photos, { previous: t('previousPhoto'), next: t('nextPhoto'), enlarge: t('enlargePhoto'), gallery: t('photoGallery', { name: p.name }), counter: (index, total) => t('photoCounter', { index, total }), credit: t('photoCredit'), source: t('sourceCredits') }, {
    index: state.biographyPhoto,
    onChange: index => { state.biographyPhoto = index; },
    onEnlarge: photo => {
      $('photo-content').innerHTML = `<img src="${escape(photo.image)}" alt="${escape(photo.caption)}"><p>${escape(photo.caption)}</p>`;
      showDialog('photo-dialog');
    }
  });
}
function openBiography(id) { state.biographyPhoto = 0; state.biographyId = id; renderBiography(id); if (!$('biography-dialog').open) showDialog('biography-dialog'); }

async function loadGallery() {
  try {
    const [response, textsResponse, photosResponse] = await Promise.all([fetch('./gallery.json'), fetch('./saints-text.json'), fetch('./biography-photos.json')]);
    if (!response.ok || !textsResponse.ok || !photosResponse.ok) throw new Error('gallery');
    const [data, texts, photos] = await Promise.all([response.json(), textsResponse.json(), photosResponse.json()]);
    state.photos = photos;
    if (data.some(p => !texts[p.id]?.locales.pt?.biography || texts[p.id].locales.pt.biography.length !== 2)) throw new Error('biographies');
    state.texts = texts;
    if (!Array.isArray(data) || data.length < 3 || new Set(data.map(p => p.id)).size !== data.length || data.some(p => !Array.isArray(p.descriptor) || p.descriptor.length !== 128 || p.descriptor.some(n => !Number.isFinite(n)))) throw new Error('gallery');
    state.gallery = data; renderGallery(); setStatus('gallery-status', 'galleryReady', 'ready', { count: data.length });
    return data;
  } catch (error) {
    setStatus('gallery-status', 'galleryLoadFailed', 'error');
    $('gallery-grid').innerHTML = `<p class="loading-hint" data-i18n="galleryLoadHint">${escape(t('galleryLoadHint'))}</p>`;
    message('galleryLoadError', true);
    throw error;
  }
}
const galleryPromise = loadGallery();
// Keep the rejected promise handled until an interaction can display recovery.
galleryPromise.catch(() => {});

async function ensureEngine() {
  if (state.engineReady) return;
  if (state.enginePromise) return state.enginePromise;
  state.enginePromise = (async () => {
    setStatus('model-status', 'modelPreparing');
    for (let i = 0; !window.faceapi && i < 120; i++) await sleep(100);
    const f = window.faceapi;
    if (!f) throw new ExperienceError('modelLoadError');
    try { const ok = await f.tf.setBackend('webgl'); if (!ok) await f.tf.setBackend('cpu'); }
    catch { await f.tf.setBackend('cpu'); }
    const modelUrl = new URL('./models/', location.href).toString();
    let count = 0;
    const load = async net => { await net.loadFromUri(modelUrl); setStatus('model-status', 'modelLoadProgress', '', { count: ++count }); };
    await Promise.all([load(f.nets.tinyFaceDetector), load(f.nets.faceLandmark68Net), load(f.nets.faceRecognitionNet)]);
    await galleryPromise;
    try { await warmFaceModels(f); }
    catch { await f.tf.setBackend('cpu'); }
    state.engineReady = true;
    setStatus('model-status', 'modelReady', 'ready'); updateReadiness();
  })().catch(error => {
    state.enginePromise = null; state.engineReady = false;
    setStatus('model-status', 'modelRetry', 'error'); updateReadiness();
    throw new ExperienceError(error.translationKey || 'modelPrepareError');
  });
  return state.enginePromise;
}

async function ensureFallbackDetector() {
  if (!state.fallbackPromise) {
    const modelUrl = new URL('./models/', location.href).toString();
    state.fallbackPromise = window.faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl).catch(error => { state.fallbackPromise = null; throw error; });
  }
  return state.fallbackPromise;
}

function updateCameraLink() {
  const url = new URL(location.href); url.hash = ''; url.searchParams.set('lang', currentLanguage());
  $('camera-link').value = url.href; $('camera-open-separate').href = url.href;
}
function showCameraHelp(key) {
  $('camera-help').hidden = false; updateCameraLink();
  setStatus('camera-help-status', key || 'cameraHelp');
}
async function copyCameraLink() {
  const input = $('camera-link');
  try { await navigator.clipboard.writeText(input.value); setStatus('camera-help-status', 'cameraCopied'); }
  catch { input.focus(); input.select?.(); setStatus('camera-help-status', 'cameraCopyManual'); }
}

function cameraView(on) {
  $('welcome-art').hidden = on; $('camera').hidden = !on; $('face-guide').hidden = !on;
  $('photo-preview').hidden = true; $('viewfinder-badge').hidden = on;
  $('camera-start').hidden = on; $('capture').hidden = !on;
  $('camera-flip').hidden = !on; $('camera-cancel').hidden = !on; $('retry').hidden = true;
}

async function startCamera() {
  if (state.busy) return;
  const issue = cameraSupportError(window, document, navigator);
  if (issue) { message(issue, true); showCameraHelp(issue); return; }
  setBusy(true); stopStream(); clearPhoto(); message('cameraOpening');
  $('camera-help').hidden = true; state.phase = 'camera-opening';
  $('camera-cancel').hidden = false; $('camera-cancel').disabled = false;
  const op = ++state.operation;
  try {
    const stream = await requestCameraStream(navigator.mediaDevices, { front: state.front, isCurrent: () => op === state.operation });
    if (op !== state.operation) { stream.getTracks().forEach(t => t.stop()); return; }
    state.stream = stream; const video = $('camera');
    cameraView(true);
    await playCameraVideo(video, stream);
    if (op !== state.operation) { stopStream(); return; }
    video.classList.toggle('rear-camera', !state.front);
    state.phase = 'camera'; cameraView(true);
    setStatus('camera-status', 'cameraOpened');
    message('cameraInstructions');
    // Warm the local model while the visitor frames the photograph.
    ensureEngine().catch(() => {});
  } catch (error) {
    if (op === state.operation) {
      stopStream(); cameraView(false); state.phase = 'welcome';
      setStatus('camera-status', 'notTested', 'error');
      const key = cameraErrorKey(error); message(key, true); showCameraHelp(key);
    }
  } finally { if (op === state.operation) setBusy(false); }
}

function drawSource(source, maxSize = 640) {
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  if (!w || !h) throw new ExperienceError('imageNotReady');
  let sx = 0, sy = 0, sw = w, sh = h;
  // Match the visible camera frame instead of photographing hidden margins.
  if (source === $('camera')) {
    const frame = $('viewfinder'); const ratio = frame.clientWidth / frame.clientHeight;
    if (w / h > ratio) { sw = h * ratio; sx = (w - sw) / 2; }
    else { sh = w / ratio; sy = (h - sh) / 2; }
  }
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = $('capture-canvas'); canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function detectPortrait(canvas, isDemo = false) {
  const f = window.faceapi;
  const execute = () => detectFacesForComparison(f, canvas, { isDemo, loadFallback: ensureFallbackDetector });
  try { return await execute(); }
  catch (error) {
    if (f.tf.getBackend() !== 'cpu') { await f.tf.setBackend('cpu'); return execute(); }
    throw error;
  }
}

async function analyse(canvas, op, fromCamera = false, isDemo = false) {
  try {
    state.phase = 'processing';
    const dataUrl = canvas.toDataURL('image/jpeg', .88);
    $('photo-preview').src = dataUrl; $('photo-preview').hidden = false;
    $('welcome-art').hidden = true; $('camera').hidden = true; $('face-guide').hidden = true; $('viewfinder-badge').hidden = true;
    $('camera-start').hidden = true; $('capture').hidden = true; $('camera-cancel').hidden = true; $('camera-flip').hidden = true;
    setProcessing(true, state.engineReady ? 'findingLookalike' : 'firstComparison');
    await ensureEngine(); if (op !== state.operation) return;
    setStatus('processing-label', 'findingLookalike');
    await new Promise(resolve => requestAnimationFrame(resolve));
    const faces = await detectPortrait(canvas, isDemo);
    if (op !== state.operation) return;
    if (faces.length === 0) throw new ExperienceError('noFace');
    if (faces.length > 1) throw new ExperienceError('multipleFaces');
    const box = faces[0].detection.box;
    if (!isDemo && (box.width < minimumFaceSize(canvas) || box.height < minimumFaceSize(canvas))) throw new ExperienceError('faceTooSmall');
    const matches = rankPortraits(faces[0].descriptor, state.gallery);
    if (fromCamera) { state.cameraTested = true; setStatus('camera-status', 'cameraTested', 'ready'); updateReadiness(); }
    stopStream(); setProcessing(false); showResults(matches, dataUrl);
  } catch (error) {
    if (op !== state.operation) return;
    stopStream(); state.phase = 'error'; setProcessing(false);
    $('retry').hidden = false; $('camera-start').hidden = false;
    message(error.translationKey || 'comparisonInterrupted', true);
    clearTimeout(state.resetTimer); state.resetTimer = setTimeout(() => resetExperience(false), 90000);
  } finally { if (op === state.operation) setBusy(false); }
}

async function capturePhoto() {
  if (state.busy || !state.stream) return;
  setBusy(true); const op = ++state.operation;
  try {
    for (let n = 3; n > 0; n--) { if (op !== state.operation) return; $('countdown').hidden = false; $('countdown').textContent = n; await sleep(650); }
    $('countdown').hidden = true;
    const canvas = drawSource($('camera'));
    await analyse(canvas, op, true);
  } catch (error) { if (op === state.operation) { message(error.translationKey || 'comparisonInterrupted', true); setBusy(false); $('countdown').hidden = true; } }
}

async function loadImage(url) {
  const image = new Image(); image.decoding = 'async';
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new ExperienceError('imageOpenError')); image.src = url; });
  return image;
}

async function uploadPhoto(event) {
  const file = event.target.files?.[0]; if (!file || state.busy) return;
  if (file.size > 25 * 1024 * 1024) { message('fileTooLarge', true); event.target.value = ''; return; }
  if (file.type && !file.type.startsWith('image/')) { message('chooseImageFile', true); event.target.value = ''; return; }
  stopStream(); clearTimeout(state.resetTimer); setBusy(true); const op = ++state.operation;
  const objectUrl = URL.createObjectURL(file);
  try { const image = await loadImage(objectUrl); if (op !== state.operation) return; await analyse(drawSource(image), op); }
  catch (error) { if (op === state.operation) { cameraView(false); message(error.translationKey || 'comparisonInterrupted', true); setBusy(false); } }
  finally { URL.revokeObjectURL(objectUrl); event.target.value = ''; }
}

function renderResultCopy(matches) {
  const p = personText(matches[0].person);
  $('result-portrait').alt = t('portraitOf', { name: p.name });
  $('result-portrait-caption').textContent = p.name;
  $('result-story').innerHTML = `<p class="eyebrow">${escape(p.theme)}</p><h3>${escape(p.name)}</h3><p class="life-dates">${escape(p.dates)} · ${escape(jesuitTitle(p))}</p>${biographyHtml(p, 'biography')}<div class="question-card"><span>${escape(t('conversationQuestion'))}</span><p>${escape(p.question)}</p></div><button type="button" class="text-button" data-person="${escape(p.id)}">${escape(t('knowStoryPortrait'))} ↗</button>`;
  $('other-matches').innerHTML = matches.slice(1).map((m, i) => {
    const other = personText(m.person);
    return `<button type="button" class="other-match" data-person="${escape(other.id)}"><img src="${escape(other.image)}" alt="" style="object-fit:${imageFit(other)};object-position:${escape(other.position || '50% 35%')}"><span><strong>${escape(other.name)}</strong><small>${escape(t('rankedPortrait', { rank: i + 2 }))}</small></span></button>`;
  }).join('');
}
function showResults(matches, dataUrl) {
  const p = matches[0].person;
  state.resultMatches = matches;
  state.phase = 'result'; $('experiencia').hidden = true; $('results').hidden = false;
  $('result-selfie').src = dataUrl; $('result-portrait').src = p.image;
  $('result-portrait').style.objectPosition = p.position || '50% 35%';
  $('result-portrait').style.objectFit = imageFit(p);
  renderResultCopy(matches);
  $('result-title').focus({ preventScroll: true }); $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  armResetTimer();
}

function armResetTimer() {
  clearTimeout(state.resetTimer);
  if (state.phase === 'result') state.resetTimer = setTimeout(() => resetExperience(false), 90000);
}

function resetExperience(scroll = true) {
  ++state.operation; clearTimeout(state.resetTimer); stopStream(); clearPhoto(); setBusy(false); setProcessing(false);
  state.phase = 'welcome'; state.resultMatches = null; state.biographyId = null; $('countdown').hidden = true; $('results').hidden = true; $('experiencia').hidden = false;
  $('result-story').innerHTML = ''; $('other-matches').innerHTML = '';
  $('result-portrait').removeAttribute('src'); cameraView(false); message('welcomeMessage');
  $('camera-help').hidden = true;
  for (const dialog of document.querySelectorAll('dialog[open]')) { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  if (scroll) { $('experiencia').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('camera-start').focus({ preventScroll: true }); }
}

async function checkOffline(registration) {
  const worker = registration.active || navigator.serviceWorker.controller;
  if (!worker) return false;
  return new Promise(resolve => {
    const channel = new MessageChannel(); const timer = setTimeout(() => resolve(false), 10000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data?.ready === true); };
    worker.postMessage({ type: 'CHECK_READY' }, [channel.port2]);
  });
}

async function prepareOffline() {
  if (window.JESUITA_BUNDLED_ASSETS === true || window.JesuitaNative?.bundledAssetsAvailable?.() === true) {
    state.offlineReady = true; setStatus('offline-status', 'offlineSaved', 'ready'); updateReadiness(); return true;
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    setStatus('offline-status', 'offlineUnavailable', 'error'); return false;
  }
  if (state.registrationPromise) return state.registrationPromise;
  state.registrationPromise = (async () => {
    setStatus('offline-status', 'offlineSaving');
    let registration = await navigator.serviceWorker.getRegistration('./');
    if (!registration?.active) {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
      registration = await Promise.race([navigator.serviceWorker.ready, sleep(50000).then(() => { throw new Error('offline-timeout'); })]);
    } else if (navigator.onLine) {
      // An existing installation must remain usable when an update cannot be
      // fetched. Opening the stand offline never requires a fresh registration.
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    }
    const ready = await checkOffline(registration);
    state.offlineReady = ready;
    setStatus('offline-status', ready ? 'offlineSaved' : 'offlineIncomplete', ready ? 'ready' : 'error'); updateReadiness();
    if (!ready) state.registrationPromise = null;
    return ready;
  })().catch(() => { state.registrationPromise = null; state.offlineReady = false; setStatus('offline-status', 'offlineRetry', 'error'); updateReadiness(); return false; });
  return state.registrationPromise;
}

async function prepareStand() {
  const button = $('prepare-stand'); button.disabled = true; setStatus('prepare-label', 'preparingDevice');
  try { await Promise.all([ensureEngine(), prepareOffline()]); }
  catch (error) { setStatus('stand-summary', error.translationKey || 'modelPrepareError', 'stand-summary'); }
  finally { button.disabled = false; setStatus('prepare-label', 'checkPreparation'); updateReadiness(); }
}

async function demoTest() {
  if (state.busy) return;
  closeDialog('stand-dialog'); resetExperience(); setBusy(true); const op = ++state.operation;
  try { await galleryPromise; const image = await loadImage(state.gallery[0].image); if (op !== state.operation) return; await analyse(drawSource(image), op, false, true); }
  catch (error) { if (op === state.operation) { setBusy(false); message(error.translationKey || 'comparisonInterrupted', true); } }
}

translateElements();
$('language-select').addEventListener('change', event => setLanguage(event.target.value));
document.addEventListener('languagechange', () => {
  updateCameraLink();
  if (state.gallery.length) renderGallery();
  if (state.resultMatches) renderResultCopy(state.resultMatches);
  if (state.biographyId && $('biography-dialog').open) renderBiography(state.biographyId);
  updateReadiness();
});
$('biography-dialog').addEventListener('close', () => { state.biographyId = null; biographyGallery?.destroy(); biographyGallery = null; });
$('camera-start').addEventListener('click', startCamera);
$('capture').addEventListener('click', capturePhoto);
$('camera-flip').addEventListener('click', () => { state.front = !state.front; startCamera(); });
$('camera-cancel').addEventListener('click', () => resetExperience(false));
$('retry').addEventListener('click', () => resetExperience(false));
$('new-person').addEventListener('click', () => resetExperience());
$('upload-button').addEventListener('click', () => { if (!state.busy) { stopStream(); clearPhoto(); cameraView(false); state.phase = 'welcome'; $('photo-file').click(); } });
$('photo-file').addEventListener('change', uploadPhoto);
$('camera-copy-link').addEventListener('click', copyCameraLink);
$('stand-open').addEventListener('click', () => { updateReadiness(); showDialog('stand-dialog'); });
$('about-open').addEventListener('click', () => showDialog('about-dialog'));
$('prepare-stand').addEventListener('click', prepareStand);
$('demo-test').addEventListener('click', demoTest);
document.addEventListener('click', event => { const button = event.target.closest('[data-person]'); if (button) openBiography(button.dataset.person); });
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog').id)));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(dialog.id); } }));
['pointerdown','keydown'].forEach(eventName => document.addEventListener(eventName, () => { if (state.phase === 'result') armResetTimer(); }, { passive: true }));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.phase === 'result') resetExperience(false);
  else if (document.hidden && state.phase === 'camera' && !state.busy) { stopStream(); cameraView(false); state.phase = 'welcome'; message('cameraPaused'); }
});
window.addEventListener('pagehide', () => { state.operation++; stopStream(); clearPhoto(); });
window.addEventListener('jesuita-native-pause', () => resetExperience(false));
window.addEventListener('pageshow', event => { if (event.persisted) resetExperience(false); });
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', async () => { const registration = await navigator.serviceWorker.getRegistration(); if (registration) { state.offlineReady = await checkOffline(registration); setStatus('offline-status', state.offlineReady ? 'offlineSaved' : 'offlineIncomplete', state.offlineReady ? 'ready' : 'error'); updateReadiness(); } });
// Start loading before the visitor opens the camera. This uses public model
// files only: camera permission is still requested exclusively by the button.
// Cache the full gallery afterwards so optional model downloads do not compete
// with the three files needed for the first comparison.
const prepareAhead = () => {
  if (document.hidden) { prepareOffline(); return; }
  ensureEngine().then(() => prepareOffline(), () => prepareOffline());
};
if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(prepareAhead, { timeout: 1500 });
else setTimeout(prepareAhead, 0);
updateCameraLink();
const cameraIssue = cameraSupportError(window, document, navigator);
if (cameraIssue) showCameraHelp(cameraIssue);
