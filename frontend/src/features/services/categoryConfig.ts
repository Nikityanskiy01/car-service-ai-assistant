import {
  Car,
  CircleGauge,
  Cog,
  Disc3,
  Fuel,
  Search,
  Snowflake,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { siteImages } from '../../content/siteImages';

export interface ServiceCategoryMeta {
  label: string;
  icon: LucideIcon;
  image: string;
  accent: string;
}

const categoryMap: Record<string, ServiceCategoryMeta> = {
  Диагностика: {
    label: 'Диагностика',
    icon: Search,
    image: siteImages.works.diagnostics,
    accent: '#fb923c',
  },
  'Тормозная система': {
    label: 'Тормозная система',
    icon: Disc3,
    image: siteImages.works.brakes,
    accent: '#f87171',
  },
  Подвеска: {
    label: 'Подвеска',
    icon: CircleGauge,
    image: siteImages.works.suspension,
    accent: '#60a5fa',
  },
  ТО: {
    label: 'ТО',
    icon: Wrench,
    image: siteImages.works.service,
    accent: '#4ade80',
  },
  Трансмиссия: {
    label: 'Трансмиссия',
    icon: Cog,
    image: siteImages.works.transmission,
    accent: '#a78bfa',
  },
  Электрика: {
    label: 'Электрика',
    icon: Zap,
    image: siteImages.works.electrics,
    accent: '#fbbf24',
  },
  Двигатель: {
    label: 'Двигатель',
    icon: Fuel,
    image: siteImages.works.diagnostics,
    accent: '#f97316',
  },
  Кондиционер: {
    label: 'Кондиционер',
    icon: Snowflake,
    image: siteImages.gallery.tools,
    accent: '#38bdf8',
  },
};

const defaultMeta: ServiceCategoryMeta = {
  label: 'Услуги',
  icon: Car,
  image: siteImages.gallery.reception,
  accent: '#fb923c',
};

export function getCategoryMeta(category?: string): ServiceCategoryMeta {
  if (!category) return defaultMeta;
  return categoryMap[category] ?? { ...defaultMeta, label: category };
}

export function getAllCategories(services: { category?: string }[]): string[] {
  const seen = new Set<string>();
  for (const item of services) {
    if (item.category) seen.add(item.category);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'ru'));
}
