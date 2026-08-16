import { Link } from 'react-router-dom';
import { managerZonePaths } from '../../config/managerPaths';
import { MANAGER_GUIDE_SECTIONS, helpHref } from '../../lib/managerGuide';
import { usePageMeta } from '../../hooks/usePageMeta';
import { HelpLegend } from '../../components/manager/help/HelpLegend';

const paths = managerZonePaths(false);

const SECTION_LINKS: Record<string, string | undefined> = {
  desk: paths.root,
  queue: paths.requests,
  calendar: paths.calendar,
  clients: paths.clients,
  contacts: paths.contacts,
  ai: paths.aiQuality,
};

export function ManagerHelpPage() {
  usePageMeta({
    title: 'Справка кабинета',
    description: 'Как работать в кабинете менеджера: очередь, записи, клиенты и оценка ИИ.',
  });

  return (
    <article className="manager-help-page">
      <header className="manager-help-page-head">
        <p className="manager-help-kicker">Кабинет менеджера</p>
        <h1>Как работать в смене</h1>
        <p>
          Сначала то, что горит на столе. Потом очередь, запись и оценка ИИ. Справку можно открыть из шапки на любом
          экране.
        </p>
      </header>

      <nav className="manager-help-page-toc" aria-label="Содержание гайда">
        {MANAGER_GUIDE_SECTIONS.map((section) => (
          <a key={section.id} href={helpHref(section.hash)}>
            {section.title}
          </a>
        ))}
      </nav>

      {MANAGER_GUIDE_SECTIONS.map((section) => {
        const to = SECTION_LINKS[section.id];
        return (
          <section key={section.id} id={section.hash} className="manager-help-page-section">
            <header>
              <h2>{section.title}</h2>
              <p>{section.lead}</p>
            </header>
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {section.legend ? <HelpLegend items={section.legend} /> : null}
            {to ? (
              <p className="manager-help-page-go">
                <Link to={to}>Открыть раздел</Link>
              </p>
            ) : null}
          </section>
        );
      })}
    </article>
  );
}
