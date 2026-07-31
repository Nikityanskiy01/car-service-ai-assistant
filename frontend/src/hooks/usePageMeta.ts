import { useEffect } from 'react';
import { useProductConfig } from '../config/ProductConfigProvider';
import { normalizeImageUrl, toWebpUrl } from '../lib/imageUrl';

function ensurePreload(href: string, type?: string) {
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="preload"][href="${href}"]`);
  if (existing) return null;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = href;
  if (type) link.type = type;
  document.head.appendChild(link);
  return link;
}

export function usePageMeta({
  title,
  description,
  preloadImage,
}: {
  title: string;
  description?: string;
  preloadImage?: string;
}) {
  const productConfig = useProductConfig();

  useEffect(() => {
    document.title = `${title} · ${productConfig.productName}`;
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag && description) {
      descTag.setAttribute('content', description);
    }
  }, [description, productConfig.productName, title]);

  useEffect(() => {
    if (!preloadImage) return;

    const href = normalizeImageUrl(preloadImage);
    const webp = toWebpUrl(href);
    const links = [webp ? ensurePreload(webp, 'image/webp') : null, ensurePreload(href)].filter(
      Boolean,
    ) as HTMLLinkElement[];

    return () => {
      for (const link of links) link.remove();
    };
  }, [preloadImage]);
}
