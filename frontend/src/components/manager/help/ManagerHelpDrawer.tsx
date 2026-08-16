import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  guideSectionById,
  guideSectionForPath,
  helpHref,
  type GuideSectionId,
} from '../../../lib/managerGuide';
import { HelpLegend } from './HelpLegend';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../console/ui/sheet';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TOC_IDS: GuideSectionId[] = ['desk', 'queue', 'request', 'calendar', 'clients', 'contacts', 'ai', 'keys'];

export function ManagerHelpDrawer({ open, onOpenChange }: Props) {
  const location = useLocation();
  const fromPath = useMemo(() => guideSectionForPath(location.pathname).id, [location.pathname]);
  const [activeId, setActiveId] = useState<GuideSectionId>(fromPath);

  useEffect(() => {
    if (open) setActiveId(fromPath === 'shift' ? 'desk' : fromPath);
  }, [open, fromPath]);

  const section = guideSectionById(activeId);
  const overview = guideSectionById('shift');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="manager-help-drawer gap-0 p-0">
        <SheetHeader className="manager-help-drawer-head">
          <SheetTitle>Справка кабинета</SheetTitle>
          <SheetDescription>{overview.lead}</SheetDescription>
        </SheetHeader>

        <div className="manager-help-drawer-body">
          <nav className="manager-help-toc" aria-label="Разделы справки">
            {TOC_IDS.map((id) => {
              const item = guideSectionById(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`manager-help-toc-link${id === activeId ? ' is-current' : ''}`}
                  aria-current={id === activeId ? 'true' : undefined}
                  onClick={() => setActiveId(id)}
                >
                  {item.title}
                </button>
              );
            })}
          </nav>

          <section className="manager-help-panel">
            <h3>{section.title}</h3>
            <p>{section.lead}</p>
            <ol>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {section.legend ? <HelpLegend items={section.legend} compact /> : null}
          </section>
        </div>

        <footer className="manager-help-drawer-foot">
          <Link to={helpHref(section.hash)} className="btn btn-secondary" onClick={() => onOpenChange(false)}>
            Открыть полный гайд
          </Link>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
