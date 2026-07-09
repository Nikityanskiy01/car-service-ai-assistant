import { useEffect } from 'react';
import { productConfig } from '../config/productConfig';

export function usePageMeta({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    document.title = `${title} · ${productConfig.productName}`;
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag && description) {
      descTag.setAttribute('content', description);
    }
  }, [description, title]);
}
