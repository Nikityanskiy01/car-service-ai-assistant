import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { managerZonePaths } from '../../../config/managerPaths';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../../lib/labels';
import type { ConsultPageModel } from '../useConsultPage';

export function ConsultChrome({
  page,
  assistantName,
}: {
  page: ConsultPageModel;
  assistantName: string;
}) {
  const {
    isAuthenticated,
    user,
    bootstrapping,
    isSending,
    startNewSession,
    openContactModal,
    successRequestId,
    goToBooking,
    error,
    handleRetry,
  } = page;

  return (
    <>
      <header className="consultation-page-head consult-head">
        <div>
          <h1>Интеллектуальная диагностика автомобиля</h1>
          <p>
            Опишите симптомы своими словами — «{assistantName}» уточнит детали и подготовит предварительный
            отчёт. Это не замена осмотра в сервисе.
          </p>
        </div>
        <div className="consult-head-actions">
          <Button variant="ghost" type="button" onClick={() => void startNewSession()} disabled={bootstrapping || isSending}>
            <Plus size={16} aria-hidden="true" />
            Новая сессия
          </Button>
        </div>
      </header>

      {!isAuthenticated ? (
        <div className="consult-guest-banner" role="status">
          Гостевой режим: история сохранится в этой сессии браузера.{' '}
          <button type="button" className="consult-guest-banner__link" onClick={() => openContactModal('login')}>
            Войдите
          </button>
          , чтобы вести обращения в кабинете.
        </div>
      ) : null}

      {successRequestId ? (
        <div className="success-block consult-success-banner" role="status" aria-live="polite">
          <h4>Заявка создана</h4>
          <p>
            Номер заявки: <strong>{formatRequestNumber(successRequestId)}</strong>
          </p>
          <p>
            Статус: <strong>{SERVICE_REQUEST_STATUS_LABELS.NEW}</strong>
          </p>
          <p className="consult-success-hint">
            Менеджер свяжется с вами для подтверждения деталей и времени записьа.
          </p>
          <div className="consult-success-actions">
            <Button type="button" variant="primary" onClick={goToBooking}>
              Выбрать время записи
            </Button>
            {isAuthenticated ? (
              <Link
                className="btn btn-secondary"
                to={
                  user?.role === 'CLIENT'
                    ? '/dashboard/client/cases'
                    : `${managerZonePaths(user?.role === 'ADMINISTRATOR').requests}/${successRequestId}`
                }
              >
                {user?.role === 'CLIENT' ? 'В кабинет' : 'Открыть заявку'}
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => openContactModal('login')}>
                Войти в кабинет
              </button>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="consult-error-wrap">
          <ErrorState message={error} onRetry={handleRetry} />
        </div>
      ) : null}
    </>
  );
}
