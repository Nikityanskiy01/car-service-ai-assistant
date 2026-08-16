export const locales = ['ru', 'en'] as const;
export type Locale = (typeof locales)[number];

const STORAGE_KEY = 'car-service-locale';

const dict = {
  ru: {
    navHome: 'Главная',
    navServices: 'Услуги',
    navConsult: 'ИИ-диагностика',
    navWorks: 'Работы',
    navGallery: 'Галерея',
    navAbout: 'О сервисе',
    bookCta: 'Записаться',
    bookAria: 'Записаться в сервис',
    consultCta: 'ИИ-диагностика',
    cabinet: 'Кабинет',
    logout: 'Выйти',
    login: 'Вход',
    navMain: 'Основная навигация',
    navMobile: 'Мобильная навигация',
    openMenu: 'Открыть меню',
    closeMenu: 'Закрыть меню',
    personalCabinet: 'Личный кабинет',
    bookService: 'Записаться в сервис',
    langRu: 'RU',
    langEn: 'EN',
    langSwitcher: 'Язык',
  },
  en: {
    navHome: 'Home',
    navServices: 'Services',
    navConsult: 'AI diagnosis',
    navWorks: 'Work',
    navGallery: 'Gallery',
    navAbout: 'About',
    bookCta: 'Book',
    bookAria: 'Book a visit',
    consultCta: 'AI diagnosis',
    cabinet: 'Dashboard',
    logout: 'Log out',
    login: 'Sign in',
    navMain: 'Main navigation',
    navMobile: 'Mobile navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    personalCabinet: 'Dashboard',
    bookService: 'Book a visit',
    langRu: 'RU',
    langEn: 'EN',
    langSwitcher: 'Language',
  },
} as const;

export type MessageKey = keyof typeof dict.ru;

export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ru') return stored;
  } catch {
    /* ignore */
  }
  return 'ru';
}

export function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = locale;
}

export function translate(locale: Locale, key: MessageKey) {
  return dict[locale][key] || dict.ru[key];
}
