export interface ProductThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
}

export interface ProductConfig {
  productName: string;
  shortName: string;
  description: string;
  logoUrl: string | null;
  supportEmail: string | null;
  phone: string | null;
  address: string | null;
  assistantName: string;
  footerCaption: string;
  theme: ProductThemeConfig;
}

export const productConfig: ProductConfig = {
  productName: 'Интеллектуальный ассистент автосервиса',
  shortName: 'Автосервис',
  description: 'Автоматизация первичной консультации клиентов',
  logoUrl: null,
  supportEmail: null,
  phone: null,
  address: null,
  assistantName: 'ИИ-ассистент',
  footerCaption: 'Коммерческая демонстрационная версия SaaS-платформы для автосервисов.',
  theme: {
    primary: '#3563ff',
    secondary: '#0f182d',
    accent: '#17c3b2',
  },
};
