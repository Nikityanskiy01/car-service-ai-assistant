import { CalendarDays, ClipboardList, LayoutDashboard, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { STORAGE_KEYS } from '../../../lib/storageKeys';
import { MANAGER_ONBOARDING_STEPS } from '../../../lib/managerGuide';

const ICONS: Record<(typeof MANAGER_ONBOARDING_STEPS)[number]['accent'], LucideIcon> = {
  desk: LayoutDashboard,
  queue: ClipboardList,
  request: Wrench,
  calendar: CalendarDays,
};

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenHelp: () => void;
};

export function ManagerOnboarding({ open, onClose, onOpenHelp }: Props) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = MANAGER_ONBOARDING_STEPS[step];
  const Icon = ICONS[current.accent];
  const isFirst = step === 0;
  const isLast = step === MANAGER_ONBOARDING_STEPS.length - 1;
  const progress = ((step + 1) / MANAGER_ONBOARDING_STEPS.length) * 100;

  function dismissForever() {
    localStorage.setItem(STORAGE_KEYS.managerOnboardingDone, '1');
    onClose();
  }

  function goNext() {
    if (isLast) {
      dismissForever();
      return;
    }
    setStep((value) => value + 1);
  }

  return (
    <div className="manager-onboarding" role="dialog" aria-modal="true" aria-labelledby="manager-onboarding-title">
      <button
        type="button"
        className="manager-onboarding-backdrop"
        aria-label="Закрыть подсказки"
        onClick={dismissForever}
      />

      <div className={`manager-onboarding-card is-${current.accent}`}>
        <header className="manager-onboarding-header">
          <div className="manager-onboarding-progress" aria-hidden="true">
            <div className="manager-onboarding-track">
              <div className="manager-onboarding-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="manager-onboarding-dots">
              {MANAGER_ONBOARDING_STEPS.map((item, index) => (
                <span
                  key={item.id}
                  className={`manager-onboarding-dot${index <= step ? ' is-active' : ''}${index === step ? ' is-current' : ''}`}
                />
              ))}
            </div>
          </div>
          <button type="button" className="manager-onboarding-close" onClick={dismissForever} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <div className="manager-onboarding-body">
          <p className="manager-onboarding-kicker">
            {isFirst ? 'Кабинет менеджера' : `Шаг ${step + 1} из ${MANAGER_ONBOARDING_STEPS.length}`}
          </p>
          <div className={`manager-onboarding-icon is-${current.accent}`} aria-hidden="true">
            <Icon size={26} strokeWidth={1.75} />
          </div>
          <h2 id="manager-onboarding-title">{current.title}</h2>
          <p className="manager-onboarding-lead">{current.lead}</p>
          <ul className="manager-onboarding-bullets">
            {current.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <footer className="manager-onboarding-footer">
          <div className="manager-onboarding-actions">
            {!isFirst ? (
              <Button type="button" variant="ghost" onClick={() => setStep((value) => value - 1)}>
                Назад
              </Button>
            ) : (
              <button type="button" className="manager-onboarding-skip" onClick={dismissForever}>
                Пропустить
              </button>
            )}
            <div className="manager-onboarding-actions-end">
              {isLast ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      dismissForever();
                      onOpenHelp();
                    }}
                  >
                    Справка
                  </Button>
                  <Link className="btn btn-primary" to={current.to} onClick={dismissForever}>
                    {current.cta}
                  </Link>
                </>
              ) : (
                <Button type="button" onClick={goNext}>
                  Далее
                </Button>
              )}
            </div>
          </div>
          <button type="button" className="manager-onboarding-dismiss" onClick={dismissForever}>
            Больше не показывать
          </button>
        </footer>
      </div>
    </div>
  );
}
