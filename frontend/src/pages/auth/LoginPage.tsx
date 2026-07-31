import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { claimGuestConsultationSessionIfPresent } from '../../features/consultations/claimGuestSession';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getEmailError } from '../../lib/validation';

export function LoginPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Вход',
    description: 'Вход в личный кабинет.',
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextEmailError = getEmailError(email);
    setEmailError(nextEmailError);
    if (nextEmailError) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setUser(data.user);
      if (data.user.role === 'CLIENT') {
        await claimGuestConsultationSessionIfPresent();
      }
      const next = params.get('next');
      if (next) {
        navigate(next, { replace: true });
        return;
      }
      const role = data.user.role;
      if (role === 'ADMINISTRATOR') navigate('/dashboard/admin', { replace: true });
      else if (role === 'MANAGER') navigate('/dashboard/manager', { replace: true });
      else navigate('/dashboard/client', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-page">
      <header className="fm-page-head">
        <h1>Вход</h1>
        <p>
          Кабинет клиента и сотрудников {productConfig.shortName}. Нет аккаунта?{' '}
          <Link to="/register">Регистрация</Link>
        </p>
      </header>
      <div className="fm-auth-grid">
        <section className="fm-card fm-card-static">
          <form className="fm-form stack" onSubmit={onSubmit} noValidate>
            <FormField
              label="Email"
              htmlFor="loginEmail"
              hint="Адрес, указанный при регистрации"
              error={emailError || error}
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
                  if (emailError) setEmailError(null);
                  if (error) setError(null);
                }}
              />
            </FormField>
            <FormField label="Пароль" htmlFor="loginPassword" hint="Пароль от личного кабинета">
              <PasswordInput
                name="password"
                required
                autoComplete="current-password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <Button type="submit" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>
            <p className="form-legal-hint">
              Входя в кабинет, вы подтверждаете ознакомление с{' '}
              <Link to="/privacy">Политикой обработки персональных данных</Link> и{' '}
              <Link to="/terms">Пользовательским соглашением</Link>.
            </p>
          </form>
        </section>
        <aside className="fm-card fm-card-accent fm-card-static">
          <h2>После входа</h2>
          <ul className="fm-list">
            <li>История консультаций и заявок</li>
            <li>Статусы работ по автомобилю</li>
            <li>Для сотрудников — рабочий стол и запись</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
