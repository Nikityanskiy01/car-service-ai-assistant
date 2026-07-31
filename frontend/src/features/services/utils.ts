import { getCategoryMeta } from './categoryConfig';
import { normalizeImageUrl } from '../../lib/imageUrl';
import type { ServiceItem, ServiceSort } from './types';

export function resolveServiceImage(item: ServiceItem): string {
  if (item.imageUrl) return normalizeImageUrl(item.imageUrl);
  if (item.category) return getCategoryMeta(item.category).image;
  return normalizeImageUrl(null);
}

export function parsePriceValue(price?: string): number | null {
  if (!price) return null;
  const lower = price.toLowerCase();
  if (lower.includes('бесплат')) return 0;
  const match = price.replace(/\s/g, '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function filterServices(
  services: ServiceItem[],
  { query, category }: { query: string; category: string | null },
): ServiceItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return services.filter((item) => {
    const matchesCategory = !category || item.category === category;
    if (!normalizedQuery) return matchesCategory;

    const haystack = [item.title, item.description, item.category, item.price]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return matchesCategory && haystack.includes(normalizedQuery);
  });
}

export function sortServices(services: ServiceItem[], sort: ServiceSort): ServiceItem[] {
  const copy = [...services];

  if (sort === 'title') {
    return copy.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }

  if (sort === 'price-asc' || sort === 'price-desc') {
    return copy.sort((a, b) => {
      const aPrice = parsePriceValue(a.price);
      const bPrice = parsePriceValue(b.price);
      if (aPrice === null && bPrice === null) return 0;
      if (aPrice === null) return 1;
      if (bPrice === null) return -1;
      return sort === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
    });
  }

  return copy;
}

export function isFeaturedService(item: ServiceItem): boolean {
  return item.title.toLowerCase().includes('ии-консультация');
}

export function estimateDuration(category?: string): string {
  switch (category) {
    case 'Диагностика':
      return '30–60 мин';
    case 'ТО':
      return '1–3 ч';
    case 'Тормозная система':
    case 'Подвеска':
      return '2–5 ч';
    case 'Трансмиссия':
    case 'Двигатель':
      return 'от 4 ч';
    case 'Электрика':
      return '1–4 ч';
    case 'Кондиционер':
      return '1–2 ч';
    default:
      return 'по осмотру';
  }
}
