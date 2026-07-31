import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { ConsentCheckbox } from '../../components/forms/ConsentCheckbox';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { claimGuestConsultationSessionIfPresent } from '../../features/consultations/claimGuestSession';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  getEmailError,
  getFullNameError,
  getPasswordError,
  getPhoneError,
} from '../../lib/validation';

type FieldErrors = {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
};

export function RegisterPage() {
  usePageMeta({
    title: 'Регистрация',
    description: 'Создайте аккаунт для консультаций, заявок и отслеживания обращений.',
  });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

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
      const data = await api<{ user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: { fullName, phone, email, password, consentPersonalData: true },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setUser(data.user);
      await claimGuestConsultationSessionIfPresent();
      navigate('/dashboard/client', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-page">
      <header className="fm-page-head">
        <h1>Регистрация</h1>
        <p>
          Аккаунт для заявок и истории обращений. Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </header>
      <div className="fm-auth-grid">
        <section className="fm-card fm-card-static">
          <form className="fm-form stack" onSubmit={onSubmit} noValidate>
            <FormField
              label="ФИО"
              htmlFor="registerName"
              hint="Как в паспорте или как к вам обращаться"
              error={fieldErrors.fullName}
            >
              <Input
                name="fullName"
                autoComplete="name"
                required
                placeholder="Иван Иванов"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
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
                name="phone"
                required
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
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
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
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
                name="password"
                required
                autoComplete="new-password"
                placeholder="Password123!ab"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
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
            {error ? <p className="error-text">{error}</p> : null}
          </form>
        </section>
        <aside className="fm-card fm-card-accent fm-card-static">
          <h2>После регистрации</h2>
          <ul className="fm-list">
            <li>История консультаций и заявок</li>
            <li>Статусы работ в кабинете</li>
            <li>Быстрый повторный визит и связь с мастером</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
