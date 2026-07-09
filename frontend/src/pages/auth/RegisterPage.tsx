import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: { fullName, phone, email, password },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setUser(data.user);
      navigate('/dashboard/client', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <Card>
        <h1>Регистрация</h1>
        <form className="stack" onSubmit={onSubmit}>
          <FormField label="ФИО" htmlFor="registerName">
            <Input id="registerName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormField>
          <FormField label="Телефон" htmlFor="registerPhone">
            <PhoneInput id="registerPhone" required value={phone} onChange={setPhone} />
          </FormField>
          <FormField label="Email" htmlFor="registerEmail">
            <Input
              id="registerEmail"
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
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <Button disabled={loading}>{loading ? 'Регистрация...' : 'Создать аккаунт'}</Button>
          {error ? <p className="error-text">{error}</p> : null}
        </form>
      </Card>
      <aside className="auth-aside">
        <h2>После регистрации</h2>
        <ul>
          <li>Доступ к истории консультаций и заявок.</li>
          <li>Отслеживание статусов обращения в личном кабинете.</li>
          <li>Быстрый запуск новой консультации в один клик.</li>
        </ul>
      </aside>
    </div>
  );
}
