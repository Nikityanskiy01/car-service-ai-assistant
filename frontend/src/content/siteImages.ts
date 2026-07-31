/** Centralized static image paths for the public site. */
import { normalizeImageUrl } from '../lib/imageUrl';

export const siteImages = {
  hero: {
    home: '/placeholders/hero-home.jpg',
    about: '/placeholders/about-hero.jpg',
    services: '/placeholders/services-hero.jpg',
  },
  gallery: {
    reception: '/placeholders/gallery-reception.jpg',
    bay: '/placeholders/gallery-bay.jpg',
    shopfloor: '/placeholders/gallery-shopfloor.jpg',
    alignment: '/placeholders/gallery-alignment.jpg',
    tools: '/placeholders/gallery-tools.jpg',
    ready: '/placeholders/gallery-ready.jpg',
    fallback: [
      '/placeholders/gallery-01.jpg',
      '/placeholders/gallery-02.jpg',
      '/placeholders/gallery-03.jpg',
      '/placeholders/gallery-04.jpg',
      '/placeholders/gallery-05.jpg',
      '/placeholders/gallery-06.jpg',
      '/placeholders/gallery-reception.jpg',
      '/placeholders/gallery-bay.jpg',
    ] as const,
  },
  works: {
    default: '/placeholders/works-01.jpg',
    brakes: '/placeholders/works-brakes.jpg',
    suspension: '/placeholders/works-suspension.jpg',
    diagnostics: '/placeholders/works-diagnostics.jpg',
    service: '/placeholders/works-service.jpg',
    transmission: '/placeholders/works-transmission.jpg',
    electrics: '/placeholders/works-electrics.jpg',
  },
} as const;

export interface FallbackGalleryItem {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
}

export const fallbackGalleryItems: FallbackGalleryItem[] = [
  {
    id: 'fg1',
    title: 'Зона приёма клиентов',
    description: 'Комфортная зона ожидания и оформление заявки у администратора.',
    imageUrl: siteImages.gallery.reception,
  },
  {
    id: 'fg2',
    title: 'Пост на подъёмнике',
    description: 'Ремонт и диагностика на профессиональном оборудовании.',
    imageUrl: siteImages.gallery.bay,
  },
  {
    id: 'fg3',
    title: 'Цех обслуживания',
    description: 'Несколько постов для одновременной работы над разными авто.',
    imageUrl: siteImages.gallery.shopfloor,
  },
  {
    id: 'fg4',
    title: 'Развал-схождение',
    description: 'Компьютерная регулировка углов установки колёс.',
    imageUrl: siteImages.gallery.alignment,
  },
  {
    id: 'fg5',
    title: 'Инструмент и оснастка',
    description: 'Профессиональный инструмент и диагностическое оборудование.',
    imageUrl: siteImages.gallery.tools,
  },
  {
    id: 'fg6',
    title: 'Выдача автомобиля',
    description: 'Готовое авто после ремонта или планового обслуживания.',
    imageUrl: siteImages.gallery.ready,
  },
  {
    id: 'fg7',
    title: 'Компьютерная диагностика',
    description: 'Считывание ошибок ЭБУ и проверка датчиков.',
    imageUrl: siteImages.works.diagnostics,
  },
  {
    id: 'fg8',
    title: 'Тормозная система',
    description: 'Диагностика и восстановление тормозных узлов.',
    imageUrl: siteImages.works.brakes,
  },
];

export function galleryImageAt(index: number, imageUrl?: string | null): string {
  if (imageUrl) return normalizeImageUrl(imageUrl);
  return siteImages.gallery.fallback[index % siteImages.gallery.fallback.length];
}

export function workImageAt(imageUrl?: string | null): string {
  return normalizeImageUrl(imageUrl, siteImages.works.default);
}
