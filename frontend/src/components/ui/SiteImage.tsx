import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { normalizeImageUrl, PLACEHOLDER_FALLBACK } from '../../lib/imageUrl';

type SiteImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Above-the-fold / LCP image: eager load + high fetch priority. */
  priority?: boolean;
  /** Image shown if the primary source fails. Set `recover={false}` to disable fallback. */
  fallbackSrc?: string;
  recover?: boolean;
};

export function SiteImage({
  priority = false,
  fallbackSrc = PLACEHOLDER_FALLBACK,
  recover = true,
  loading,
  fetchPriority,
  decoding = 'async',
  src,
  onError,
  ...props
}: SiteImageProps) {
  const resolvedSrc = src ? normalizeImageUrl(String(src)) : PLACEHOLDER_FALLBACK;
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);

  useEffect(() => {
    setCurrentSrc(resolvedSrc);
  }, [resolvedSrc]);

  return (
    <img
      {...props}
      src={currentSrc}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      fetchPriority={fetchPriority ?? (priority ? 'high' : undefined)}
      decoding={decoding}
      onError={(event) => {
        if (recover && fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
}
