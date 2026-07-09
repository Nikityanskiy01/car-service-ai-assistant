import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAppRuntime } from '../../app/providers/AppRuntimeProvider';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { usePageMeta } from '../../hooks/usePageMeta';

export function LoginPage() {
  usePageMeta({
    title: 'Вход в систему',
    description: 'Вход в личный кабинет клиента, менеджера или администратора.',
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const { demoMode, demoAccounts } = useAppRuntime();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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

  async function loginAsDemo(role: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR') {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ user: AuthUser }>('/auth/demo-login', {
        method: 'POST',
        body: { role },
        skipAuthRefresh: true,
        skipCsrf: true,
      });
      setUser(data.user);
      if (role === 'ADMINISTRATOR') navigate('/dashboard/admin', { replace: true });
      else if (role === 'MANAGER') navigate('/dashboard/manager', { replace: true });
      else navigate('/dashboard/client', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить demo-вход');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <Card>
        <h1>Вход в систему</h1>
        <form className="stack" onSubmit={onSubmit}>
          <FormField label="Email" htmlFor="loginEmail" error={null}>
            <Input id="loginEmail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Пароль" htmlFor="loginPassword" error={null}>
            <PasswordInput id="loginPassword" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <Button disabled={loading}>{loading ? 'Вход...' : 'Войти'}</Button>
          {error ? <p className="error-text">{error}</p> : null}
        </form>
        {demoMode ? (
          <div className="demo-quick-login">
            <h3>Быстрый вход (демо)</h3>
            <div className="row gap-sm">
              {demoAccounts.map((account) => (
                <Button
                  key={account.role}
                  type="button"
                  variant="ghost"
                  onClick={() => void loginAsDemo(account.role)}
                >
                  Войти как {account.label.toLowerCase()}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
      <aside className="auth-aside">
        <h2>Что вы получаете после входа</h2>
        <ul>
          <li>Просмотр и обработка обращений в едином интерфейсе.</li>
          <li>Контроль статусов заявок и коммуникации с клиентом.</li>
          <li>Доступ к аналитике и управлению контентом по ролям.</li>
        </ul>
      </aside>
    </div>
  );
}
