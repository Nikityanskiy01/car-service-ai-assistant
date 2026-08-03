import { useMemo, type CSSProperties } from 'react';

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
};

function avatarHue(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export function UserAvatar({ name, avatarUrl, size = 36, className = '' }: Props) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const src = useMemo(() => {
    if (!avatarUrl) return null;
    const cacheBust = `v=${encodeURIComponent(name)}`;
    return avatarUrl.includes('?') ? `${avatarUrl}&${cacheBust}` : `${avatarUrl}?${cacheBust}`;
  }, [avatarUrl, name]);

  const hue = avatarHue(name || '?');
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.34), '--avatar-hue': hue } as CSSProperties;

  if (src) {
    return (
      <img
        className={`user-avatar user-avatar-image ${className}`.trim()}
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`user-avatar user-avatar-initials ${className}`.trim()}
      style={style}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
