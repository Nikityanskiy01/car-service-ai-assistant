import { NavLink } from 'react-router-dom';

export function MobileNavigation({
  open,
  onClose,
  links,
}: {
  open: boolean;
  onClose: () => void;
  links: Array<{ to: string; label: string }>;
}) {
  if (!open) return null;
  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} onClick={onClose}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
