import { useEffect } from 'react';
import { useProductConfig } from '../config/ProductConfigProvider';

export function usePageMeta({ title, description }: { title: string; description?: string }) {
  const productConfig = useProductConfig();
  useEffect(() => {
    document.title = `${title} · ${productConfig.productName}`;
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag && description) {
      descTag.setAttribute('content', description);
    }
  }, [description, productConfig.productName, title]);
}
