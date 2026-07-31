import { useEffect } from 'react';
import { useProductConfig } from '../config/ProductConfigProvider';
import { normalizeImageUrl } from '../lib/imageUrl';

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
    const existing = document.querySelector<HTMLLinkElement>(`link[rel="preload"][href="${href}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, [preloadImage]);
}
