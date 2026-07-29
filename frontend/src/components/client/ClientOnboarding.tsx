import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { STORAGE_KEYS } from '../../lib/storageKeys';

const STEPS = [
  {
    title: 'Мои обращения',
    description: 'Вся история — от симптома до ремонта — в одном месте. Диагностика, заявка и переписка связаны.',
    cta: 'Посмотреть обращения',
    to: '/dashboard/client/cases',
  },
  {
    title: 'ИИ-диагностика',
    description: 'Опишите симптомы в чате — ассистент подскажет возможные причины и поможет подготовиться к визиту.',
    cta: 'Начать диагностику',
    to: '/consult',
  },
  {
    title: 'Записи в сервис',
    description: 'Выберите удобное время, добавьте визит в календарь и отслеживайте статус записи в кабинете.',
    cta: 'Записаться',
    to: '/booking',
  },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ClientOnboarding({ open, onClose }: Props) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function dismissForever() {
    localStorage.setItem(STORAGE_KEYS.clientOnboardingDone, '1');
    onClose();
  }

  return (
    <div className="client-onboarding" role="dialog" aria-modal="true" aria-labelledby="client-onboarding-title">
      <div className="client-onboarding-card">
        <p className="client-onboarding-kicker">
          Шаг {step + 1} из {STEPS.length}
        </p>
        <h2 id="client-onboarding-title">{current.title}</h2>
        <p>{current.description}</p>
        <div className="client-onboarding-actions">
          <Button type="button" variant="ghost" onClick={dismissForever}>
            Пропустить
          </Button>
          <div className="client-onboarding-actions-end">
            {!isLast ? (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s + 1)}>
                Далее
              </Button>
            ) : (
              <Link className="btn btn-primary" to={current.to} onClick={dismissForever}>
                {current.cta}
              </Link>
            )}
          </div>
        </div>
        <button type="button" className="client-onboarding-dismiss" onClick={dismissForever}>
          Не показывать снова
        </button>
      </div>
    </div>
  );
}
