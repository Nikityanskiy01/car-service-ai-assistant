export interface ProductThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
}

export interface LegalOperatorConfig {
  /** Полное наименование оператора ПДн (ООО / ИП). Замените на реквизиты организации. */
  legalName: string;
  /** ОГРН / ОГРНИП */
  ogrn: string;
  /** ИНН */
  inn: string;
  /** Юридический адрес */
  legalAddress: string;
  /** Контакт для обращений субъектов ПДн */
  privacyEmail: string;
}

export interface ProductConfig {
  productName: string;
  shortName: string;
  description: string;
  logoUrl: string | null;
  supportEmail: string | null;
  phone: string | null;
  address: string | null;
  workingHours: string;
  mapUrl: string | null;
  assistantName: string;
  footerCaption: string;
  theme: ProductThemeConfig;
  /** Реквизиты оператора для документов по 152-ФЗ (шаблон — заменить перед продакшеном). */
  legal: LegalOperatorConfig;
}

/** White-label product config for production site. */
export const productConfig: ProductConfig = {
  productName: 'Автосервис',
  shortName: 'Автосервис',
  description: 'Ремонт, ТО и онлайн ИИ-диагностика автомобиля',
  logoUrl: null,
  supportEmail: 'info@autoservice-demo.zernov.online',
  phone: '+7 (999) 000-00-00',
  address: 'Москва',
  workingHours: 'пн–сб 10:00–20:00',
  mapUrl: 'https://yandex.ru/maps/?text=Москва',
  assistantName: 'ИИ-ассистент',
  footerCaption: 'Онлайн-запись, консультации и личный кабинет.',
  theme: {
    primary: '#EA580C',
    secondary: '#0B0D12',
    accent: '#FB923C',
  },
  legal: {
    legalName: 'ООО «Автосервис» (шаблон — укажите реальное юрлицо)',
    ogrn: '0000000000000',
    inn: '0000000000',
    legalAddress: 'г. Москва',
    privacyEmail: 'privacy@autoservice-demo.zernov.online',
  },
};
