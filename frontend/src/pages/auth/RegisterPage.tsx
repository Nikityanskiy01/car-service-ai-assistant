import { CalendarClock, Car, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { ConsentCheckbox } from '../../components/forms/ConsentCheckbox';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { PasswordStrengthIndicator } from '../../components/forms/PasswordStrengthIndicator';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  getEmailError,
  getFullNameError,
  getPasswordConfirmError,
  getPasswordError,
  getPhoneError,
} from '../../lib/validation';

const REGISTER_BENEFITS = [
  {
    icon: MessageSquare,
    title: 'История консультаций и заявок',
    text: 'Все обращения и переписка с сервисом сохраняются в кабинете.',
  },
  {
    icon: Car,
    title: 'Статусы работ в кабинете',
    text: 'Отслеживайте диагностику, ремонт и готовность к выдаче.',
  },
  {
    icon: CalendarClock,
    title: 'Быстрый повторный запись',
    text: 'Запись и связь с мастером без повторного ввода данных.',
  },
] as const;

type FieldErrors = {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export function RegisterPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Регистрация',
    description: 'Создайте аккаунт для консультаций, заявок и отслеживания обращений.',
  });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    const nameError = getFullNameError(fullName);
    if (nameError) nextErrors.fullName = nameError;
    const phoneError = getPhoneError(phone);
    if (phoneError) nextErrors.phone = phoneError;
    const emailError = getEmailError(email);
    if (emailError) nextErrors.email = emailError;
    const passwordError = getPasswordError(password);
    if (passwordError) nextErrors.password = passwordError;
    const confirmError = getPasswordConfirmError(password, confirmPassword);
    if (confirmError) nextErrors.confirmPassword = confirmError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!consent) {
      setConsentError('Отметьте согласие на обработку персональных данных');
      return;
    }
    setConsentError(null);
    setLoading(true);
    setError(null);
    try {
      const data = await api<{
        requiresEmailVerification?: boolean;
        message?: string;
        email?: string;
      }>('/auth/register', {
        method: 'POST',
        body: { fullName, phone, email, password, consentPersonalData: true },
        skipCsrf: true,
        skipAuthRefresh: true,
      });

      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, {
        replace: true,
        state: {
          justRegistered: true,
          message: data.message,
          maskedEmail: data.email,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-page fm-auth-page">
      <div className="fm-auth-shell">
        <section className="fm-auth-main" aria-labelledby="register-title">
          <header className="fm-auth-head">
            <p className="fm-pill">Личный кабинет</p>
            <h1 id="register-title">Регистрация</h1>
            <p className="fm-auth-subtitle">
              Создайте аккаунт для заявок, консультаций и истории обращений в {productConfig.shortName}.
            </p>
          </header>

          <form className="fm-form fm-auth-form stack" onSubmit={onSubmit} noValidate>
            {error ? <Alert kind="error">{error}</Alert> : null}

            <FormField
              label="ФИО"
              htmlFor="registerName"
              hint="Как к вам обращаться"
              error={fieldErrors.fullName}
            >
              <Input
                id="registerName"
                name="fullName"
                autoComplete="name"
                required
                placeholder="Иван Иванов"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                  if (error) setError(null);
                }}
              />
            </FormField>

            <FormField
              label="Телефон"
              htmlFor="registerPhone"
              hint="Для связи по заявкам и записи"
              error={fieldErrors.phone}
            >
              <PhoneInput
                id="registerPhone"
                name="phone"
                required
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  if (error) setError(null);
                }}
              />
            </FormField>

            <FormField
              label="Email"
              htmlFor="registerEmail"
              hint="Для входа в личный кабинет и уведомлений"
              error={fieldErrors.email}
            >
              <Input
                id="registerEmail"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  if (error) setError(null);
                }}
              />
            </FormField>

            <FormField
              label="Пароль"
              htmlFor="registerPassword"
              hint="Минимум 12 символов: латиница, цифра и спецсимвол"
              error={fieldErrors.password}
            >
              <PasswordInput
                id="registerPassword"
                name="password"
                required
                autoComplete="new-password"
                placeholder="Password123!ab"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  if (error) setError(null);
                }}
              />
              <PasswordStrengthIndicator password={password} id="registerPassword" />
            </FormField>

            <FormField
              label="Подтверждение пароля"
              htmlFor="registerPasswordConfirm"
              hint="Введите пароль ещё раз"
              error={fieldErrors.confirmPassword}
            >
              <PasswordInput
                id="registerPasswordConfirm"
                name="confirmPassword"
                required
                autoComplete="new-password"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                  if (error) setError(null);
                }}
              />
            </FormField>

            <ConsentCheckbox
              id="registerConsent"
              checked={consent}
              onChange={(v) => {
                setConsent(v);
                if (v) setConsentError(null);
              }}
              error={consentError}
            />

            <Button type="submit" disabled={loading}>
              {loading ? 'Регистрация...' : 'Создать аккаунт'}
            </Button>
          </form>

          <p className="fm-auth-switch">
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </section>

        <aside className="fm-auth-aside" aria-label="Преимущества регистрации">
          <h2>После регистрации</h2>
          <p className="fm-auth-aside-lead">
            Всё, что нужно для работы с автосервисом — в одном личном кабинете.
          </p>
          <ul className="fm-auth-benefits">
            {REGISTER_BENEFITS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <span className="fm-auth-benefit-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <span className="fm-auth-benefit-text">{item.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
