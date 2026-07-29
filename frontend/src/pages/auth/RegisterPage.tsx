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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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
            <FormField label="ФИО" htmlFor="registerName">
              <Input
                id="registerName"
                name="fullName"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </FormField>
            <FormField label="Телефон" htmlFor="registerPhone">
              <PhoneInput id="registerPhone" name="phone" required value={phone} onChange={setPhone} />
            </FormField>
            <FormField label="Email" htmlFor="registerEmail">
              <Input
                id="registerEmail"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>
            <FormField label="Пароль" htmlFor="registerPassword">
              <PasswordInput
                id="registerPassword"
                name="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
