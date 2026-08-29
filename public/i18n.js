const STORAGE_KEY = 'secret-relay:lang';

function readStoredLang() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage unavailable (private mode etc.) — language choice just won't persist
  }
}

export function detectLang() {
  const saved = readStoredLang();
  if (saved === 'ru' || saved === 'en') return saved;
  return navigator.language && navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function applyTranslations(strings, lang) {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = strings[lang]?.[el.getAttribute('data-i18n')];
    if (value !== undefined) el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const value = strings[lang]?.[el.getAttribute('data-i18n-html')];
    if (value !== undefined) el.innerHTML = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const value = strings[lang]?.[el.getAttribute('data-i18n-placeholder')];
    if (value !== undefined) el.setAttribute('placeholder', value);
  });
  if (strings[lang]?.pageTitle) document.title = strings[lang].pageTitle;
}

export function initLangSwitcher(strings) {
  let lang = detectLang();
  applyTranslations(strings, lang);

  const buttons = document.querySelectorAll('[data-lang-switch]');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang-switch') === lang);
    btn.addEventListener('click', () => {
      lang = btn.getAttribute('data-lang-switch');
      writeStoredLang(lang);
      applyTranslations(strings, lang);
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  return () => lang;
}
