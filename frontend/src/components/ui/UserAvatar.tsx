export function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return (
    <span
      className="user-avatar"
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.36) }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
