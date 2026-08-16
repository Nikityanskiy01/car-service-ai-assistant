import { Link } from 'react-router-dom';
import { clientInitials, statusLabel, statusVariant } from '../../lib/managerClientDossier';

type DossierFeedRowProps = {
  when: string | null;
  href?: string;
  title: string;
  detail?: string | null;
  owner?: string | null;
  status?: string | null;
};

export function DossierFeedRow({ when, href, title, detail, owner, status }: DossierFeedRowProps) {
  const tone = status ? statusVariant(status) : null;
  const inner = (
    <>
      <span className="manager-dossier-gutter">
        <time>{when || ''}</time>
        {status ? <span className={`manager-dossier-state is-${tone}`}>{statusLabel(status)}</span> : null}
      </span>
      <span className="manager-dossier-feed-copy">
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {owner ? (
        <span className="manager-dossier-owner" title={owner} aria-label={owner}>
          {clientInitials(owner)}
        </span>
      ) : null}
    </>
  );

  const className = `manager-dossier-feed-item${tone ? ` is-${tone}` : ''}`;

  if (href) {
    return (
      <Link to={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
