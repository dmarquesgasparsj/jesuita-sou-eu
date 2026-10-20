import { languages, translate } from './translations.js';

const requested = new URLSearchParams(globalThis.location?.search || '').get('lang');
let language = languages.some(item => item.code === requested) ? requested : 'pt';
export const currentLanguage = () => language;
export const t = (key, parameters = {}) => translate(language, key, parameters);

export function translateElements(root = document) {
  for (const element of root.querySelectorAll('[data-i18n]')) {
    let parameters = {};
    try { parameters = JSON.parse(element.dataset.i18nParams || '{}'); } catch {}
    element.textContent = t(element.dataset.i18n, parameters);
  }
  for (const element of root.querySelectorAll('[data-i18n-html]')) element.innerHTML = t(element.dataset.i18nHtml);
  for (const [selector, attribute, key] of [['[data-i18n-aria]', 'aria-label', 'i18nAria'], ['[data-i18n-alt]', 'alt', 'i18nAlt'], ['[data-i18n-content]', 'content', 'i18nContent']]) {
    for (const element of root.querySelectorAll(selector)) element.setAttribute(attribute, t(element.dataset[key]));
  }
  document.documentElement.lang = languages.find(item => item.code === language).tag;
  document.title = t('title');
  const selector = document.getElementById('language-select'); if (selector) selector.value = language;
}

export function setLanguage(code) {
  if (!languages.some(item => item.code === code)) return;
  language = code;
  const url = new URL(location.href); url.searchParams.set('lang', code);
  history.replaceState(null, '', url);
  translateElements();
  document.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}
