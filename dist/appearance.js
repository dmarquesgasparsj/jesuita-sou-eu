export const THEME_KEY = 'jesuita-sou-eu-theme';
export const THEME_IDS = Object.freeze(['original', 'magis', 'portugal']);
export const THEME_BROWSER_COLORS = Object.freeze({ original: '#263d32', magis: '#77b09e', portugal: '#bf2f37' });

export function initAppearance(doc = globalThis.document, storage) {
  const toggle = doc.getElementById('appearance-open');
  const panel = doc.getElementById('appearance-panel');
  if (!toggle || !panel) return;
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch {} }
  const choices = THEME_IDS.map(id => doc.getElementById('appearance-' + id));
  const meta = doc.getElementById('browser-theme-color');
  let selected = 'original';
  try { const saved = storage?.getItem(THEME_KEY); if (THEME_IDS.includes(saved)) selected = saved; } catch {}
  function apply(id, persist = false) {
    if (!THEME_IDS.includes(id)) return;
    selected = id;
    doc.documentElement.dataset.theme = id;
    meta?.setAttribute('content', THEME_BROWSER_COLORS[id]);
    choices.forEach((choice, index) => { if (choice) choice.checked = THEME_IDS[index] === id; });
    if (persist) { try { storage?.setItem(THEME_KEY, id); } catch {} }
  }
  function close(restoreFocus = false) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    if (opening) choices.find(choice => choice?.checked)?.focus();
  });
  doc.getElementById('appearance-close')?.addEventListener('click', () => close(true));
  choices.forEach((choice, index) => choice?.addEventListener('change', () => { if (choice.checked) apply(THEME_IDS[index], true); }));
  doc.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(true); });
  doc.addEventListener('pointerdown', event => { if (!panel.hidden && !event.target?.closest?.('#appearance-settings')) close(); });
  apply(selected);
  return { get theme() { return selected; }, close };
}
