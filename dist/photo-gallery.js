// Photo browsing is independent of facial matching; only the original portrait
// is used by the face engine. All displayed images are bundled for offline use.
const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountPhotoGallery(host, photos, labels, options = {}) {
  let index = Math.max(0, Math.min(options.index || 0, photos.length - 1));
  let touch = null;
  let suppressClick = false;
  const controller = new AbortController();
  const listen = (type, callback) => host.addEventListener(type, callback, { signal: controller.signal });
  function render(focusAction) {
    const photo = photos[index];
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', labels.gallery);
    host.setAttribute('aria-roledescription', 'carousel');
    host.innerHTML = `<figure class="photo-gallery"><div class="photo-viewport" data-gallery-viewport><button class="photo-enlarge" type="button" data-photo-action="enlarge" aria-label="${escape(labels.enlarge)}"><img class="biography-hero" src="${escape(photo.image)}" alt="${escape(photo.caption)}" decoding="async"><span aria-hidden="true" class="photo-enlarge-hint">⤢</span></button></div><div class="photo-navigation"${photos.length < 2 ? ' hidden' : ''}><button type="button" data-photo-action="previous" aria-label="${escape(labels.previous)}">←</button><span aria-live="polite" aria-atomic="true">${escape(labels.counter(index + 1, photos.length))}</span><button type="button" data-photo-action="next" aria-label="${escape(labels.next)}">→</button></div><figcaption><p class="photo-caption">${escape(photo.caption)}</p><p class="photo-credits">${escape(labels.credit)}: ${escape(photo.author)}. <a href="${escape(photo.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(photo.license)}</a>. ${escape(photo.note)} <a href="${escape(photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(labels.source)} ↗</a></p></figcaption></figure>`;
    // Keep keyboard focus on the same arrow as the visitor browses.
    if (focusAction) host.querySelector(`[data-photo-action="${focusAction}"]`)?.focus({ preventScroll: true });
  }
  function move(delta, focusAction) {
    index = (index + delta + photos.length) % photos.length;
    options.onChange?.(index);
    render(focusAction);
  }
  listen('click', event => {
    const action = event.target.closest('[data-photo-action]')?.dataset.photoAction;
    if (!action) return;
    if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
    if (action === 'enlarge') options.onEnlarge?.(photos[index]);
    else move(action === 'next' ? 1 : -1, action);
  });
  listen('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (photos.length < 2) return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1, event.target.dataset.photoAction);
  });
  listen('pointerdown', event => {
    suppressClick = false;
    if (event.pointerType === 'mouse' || !event.isPrimary || !event.target.closest('[data-gallery-viewport]')) return;
    touch = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.target.setPointerCapture?.(event.pointerId);
  });
  listen('pointerup', event => {
    if (!touch || touch.id !== event.pointerId) return;
    const dx = event.clientX - touch.x, dy = event.clientY - touch.y;
    touch = null;
    if (photos.length < 2 || Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    suppressClick = true; event.preventDefault();
    move(dx < 0 ? 1 : -1);
  });
  listen('pointercancel', () => { touch = null; });
  render();
  return { destroy() { controller.abort(); }, get index() { return index; } };
}
