import { CalendarClock, ClipboardList, Sparkles, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { STORAGE_KEYS } from '../../lib/storageKeys';

type Step = {
  id: string;
  icon: LucideIcon;
  accent: 'cases' | 'ai' | 'booking';
  title: string;
  lead: string;
  bullets: string[];
  cta?: string;
  to?: string;
};

const STEPS: Step[] = [
  {
    id: 'cases',
    icon: ClipboardList,
    accent: 'cases',
    title: 'Мои обращения',
    lead: 'Вся история с автосервисом — от первого симптома до готовности авто.',
    bullets: [
      'Диагностика, заявка и переписка связаны в одной цепочке',
      'Статусы и документы всегда под рукой',
      'Не нужно заново объяснять, что уже обсуждали',
    ],
    cta: 'Открыть обращения',
    to: '/dashboard/client/cases',
  },
  {
    id: 'ai',
    icon: Sparkles,
    accent: 'ai',
    title: 'ИИ-консультация',
    lead: 'Опишите симптомы в чате — ассистент поможет сориентироваться до записи.',
    bullets: [
      'Уточнит детали и предложит возможные причины',
      'Сохранит результат в вашем обращении',
      'Менеджер увидит контекст и быстрее подключится',
    ],
    cta: 'Начать консультацию',
    to: '/consult',
  },
  {
    id: 'booking',
    icon: CalendarClock,
    accent: 'booking',
    title: 'Запись в сервис',
    lead: 'Выберите удобное время и следите за записьом в кабинете.',
    bullets: [
      'Онлайн-запись без звонков',
      'Напоминание и файл для календаря',
      'Статус записи обновляется в реальном времени',
    ],
    cta: 'Записаться на сервис',
    to: '/booking',
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ClientOnboarding({ open, onClose }: Props) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  function dismissForever() {
    localStorage.setItem(STORAGE_KEYS.clientOnboardingDone, '1');
    onClose();
  }

  function goNext() {
    if (isLast) {
      dismissForever();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="client-onboarding" role="dialog" aria-modal="true" aria-labelledby="client-onboarding-title">
      <button
        type="button"
        className="client-onboarding-backdrop"
        aria-label="Закрыть подсказки"
        onClick={dismissForever}
      />

      <div className={`client-onboarding-card client-onboarding-card--${current.accent}`}>
        <header className="client-onboarding-header">
          <div className="client-onboarding-progress" aria-hidden="true">
            <div className="client-onboarding-progress-track">
              <div className="client-onboarding-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="client-onboarding-dots">
              {STEPS.map((item, index) => (
                <span
                  key={item.id}
                  className={`client-onboarding-dot${index <= step ? ' is-active' : ''}${index === step ? ' is-current' : ''}`}
                />
              ))}
            </div>
          </div>

          <button type="button" className="client-onboarding-close" onClick={dismissForever} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <div className="client-onboarding-body">
          <p className="client-onboarding-kicker">
            {isFirst ? 'Добро пожаловать в кабинет' : `Шаг ${step + 1} из ${STEPS.length}`}
          </p>

          <div className={`client-onboarding-icon client-onboarding-icon--${current.accent}`} aria-hidden="true">
            <Icon size={26} strokeWidth={1.75} />
          </div>

          <h2 id="client-onboarding-title">{current.title}</h2>
          <p className="client-onboarding-lead">{current.lead}</p>

          <ul className="client-onboarding-bullets">
            {current.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <footer className="client-onboarding-footer">
          <div className="client-onboarding-actions">
            {!isFirst ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Назад
              </Button>
            ) : (
              <button type="button" className="client-onboarding-skip" onClick={dismissForever}>
                Пропустить тур
              </button>
            )}

            <div className="client-onboarding-actions-end">
              {isLast && current.to ? (
                <>
                  <Button type="button" variant="secondary" onClick={dismissForever}>
                    В кабинет
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

          <button type="button" className="client-onboarding-dismiss" onClick={dismissForever}>
            Больше не показывать
          </button>
        </footer>
      </div>
    </div>
  );
}
