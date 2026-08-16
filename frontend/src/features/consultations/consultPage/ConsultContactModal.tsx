import { ConsentCheckbox } from '../../../components/forms/ConsentCheckbox';
import { FormField } from '../../../components/forms/FormField';
import { PhoneInput } from '../../../components/forms/PhoneInput';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import type { ConsultPageModel } from '../useConsultPage';

export function ConsultContactModal({ page }: { page: ConsultPageModel }) {
  const {
    contactModalOpen,
    contactModalIntent,
    closeContactModal,
    guestFieldErrors,
    setGuestFieldErrors,
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
    guestConsent,
    setGuestConsent,
    guestConsentError,
    setGuestConsentError,
    creatingRequest,
    submitContactModal,
  } = page;

  return (
    <Modal
      open={contactModalOpen}
      title={contactModalIntent === 'login' ? 'Вход в кабинет' : 'Заявка в сервис'}
      onClose={closeContactModal}
    >
      <p className="consult-request-hint">
        {contactModalIntent === 'login'
          ? 'Оставьте контакты — мы сохраним обращение и откроем личный кабинет.'
          : 'Оставьте контакты — менеджер свяжется с вами и подтвердит детали.'}
      </p>
      <div className="fm-form consult-request-form stack">
        <FormField
          label="Ваше имя"
          htmlFor="consultGuestNameModal"
          hint="Менеджер обратится к вам по имени"
          error={guestFieldErrors.fullName}
        >
          <Input
            name="fullName"
            autoComplete="name"
            required
            placeholder="Иван Иванов"
            value={guestName}
            onChange={(e) => {
              setGuestName(e.target.value);
              if (guestFieldErrors.fullName) setGuestFieldErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
          />
        </FormField>
        <FormField
          label="Телефон"
          htmlFor="consultGuestPhoneModal"
          hint="Для звонка или сообщения с деталями"
          error={guestFieldErrors.phone}
        >
          <PhoneInput
            name="phone"
            required
            value={guestPhone}
            onChange={(value) => {
              setGuestPhone(value);
              if (guestFieldErrors.phone) setGuestFieldErrors((prev) => ({ ...prev, phone: undefined }));
            }}
          />
        </FormField>
        <ConsentCheckbox
          id="consultGuestConsentModal"
          checked={guestConsent}
          onChange={(v) => {
            setGuestConsent(v);
            if (v) setGuestConsentError(null);
          }}
          error={guestConsentError}
        />
        <Button
          type="button"
          variant="primary"
          className="consult-request-btn"
          disabled={creatingRequest}
          onClick={() => void submitContactModal()}
        >
          {creatingRequest
            ? 'Отправка...'
            : contactModalIntent === 'login'
              ? 'Продолжить ко входу'
              : 'Отправить заявку'}
        </Button>
      </div>
    </Modal>
  );
}
