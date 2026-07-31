import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { normalizeImageUrl, PLACEHOLDER_FALLBACK, toWebpUrl } from '../../lib/imageUrl';

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
  width,
  height,
  ...props
}: SiteImageProps) {
  const resolvedSrc = src ? normalizeImageUrl(String(src)) : PLACEHOLDER_FALLBACK;
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const webpSrc = toWebpUrl(currentSrc);

  useEffect(() => {
    setCurrentSrc(resolvedSrc);
  }, [resolvedSrc]);

  const img = (
    <img
      {...props}
      src={currentSrc}
      width={width}
      height={height}
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

  if (!webpSrc || webpSrc === currentSrc) return img;

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      {img}
    </picture>
  );
}
