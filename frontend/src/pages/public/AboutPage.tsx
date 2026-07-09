import { useState } from 'react';
import { api } from '../../api/client';
import { FormField } from '../../components/forms/FormField';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { usePageMeta } from '../../hooks/usePageMeta';

export function AboutPage() {
  usePageMeta({
    title: 'О продукте',
    description: 'Описание платформы, сценариев внедрения и формы обратной связи.',
  });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await api('/contact', {
        method: 'POST',
        body: { fullName, phone, message },
        skipAuthRefresh: true,
      });
      setStatus('Сообщение отправлено.');
      setMessage('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось отправить сообщение.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <h1>О системе</h1>
      <Card>
        <p>
          Платформа помогает организовать первичную диагностику, обработку заявок и взаимодействие между
          клиентом, менеджером и администратором.
        </p>
        <ul>
          <li>Консультация строится в формате диалога с уточняющими вопросами.</li>
          <li>Результат включает вероятные причины, чек-лист проверок и ориентировочную стоимость.</li>
          <li>Результат не является окончательным диагнозом и требует подтверждения специалистом.</li>
        </ul>
      </Card>

      <Card>
        <h2>Обратная связь</h2>
        <form className="stack" onSubmit={onSubmit}>
          <FormField label="Имя" htmlFor="contactName">
            <Input id="contactName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </FormField>
          <FormField label="Телефон" htmlFor="contactPhone">
            <PhoneInput id="contactPhone" value={phone} onChange={setPhone} required />
          </FormField>
          <FormField label="Сообщение" htmlFor="contactMessage">
            <Textarea
              id="contactMessage"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </FormField>
          <Button disabled={loading}>{loading ? 'Отправка...' : 'Отправить'}</Button>
          {status ? <p>{status}</p> : null}
        </form>
      </Card>
    </div>
  );
}
