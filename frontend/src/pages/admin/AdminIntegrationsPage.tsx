import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createIntegration,
  disableIntegration,
  enableIntegration,
  listIntegrations,
  testIntegration,
} from '../../api/integrations';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { IntegrationStatusBadge } from '../../components/ui/IntegrationStatusBadge';
import { Loader } from '../../components/ui/Loader';
import { Modal } from '../../components/ui/Modal';
import { INTEGRATION_PROVIDER_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { IntegrationConnection, IntegrationProvider } from '../../types/integration';

const PROVIDER_CARDS: Array<{ provider: IntegrationProvider; description: string; supported: boolean }> = [
  { provider: 'ONE_C', description: 'HTTP-сервис, OData, EnterpriseData, файловый обмен', supported: false },
  { provider: 'AUTODEALER_DESKTOP', description: 'Локальный модуль или согласованный файл', supported: false },
  { provider: 'AUTODEALER_WEB', description: 'Ограниченный обмен через web-интерфейс', supported: false },
  { provider: 'AUTODEALER_ONLINE', description: 'Требуется официальный API и тестовый аккаунт', supported: false },
  { provider: 'BITRIX24', description: 'REST API Bitrix24', supported: false },
  { provider: 'AMOCRM', description: 'REST API amoCRM', supported: false },
  { provider: 'YCLIENTS', description: 'API YCLIENTS', supported: false },
  { provider: 'GENERIC_REST', description: 'Универсальный REST-коннектор с проверкой соединения', supported: true },
  { provider: 'GENERIC_WEBHOOK', description: 'Исходящие webhook-события', supported: false },
  { provider: 'FILE_EXCHANGE', description: 'CSV, XLSX, XML, JSON', supported: false },
];

export function AdminIntegrationsPage() {
  usePageMeta({ title: 'Интеграции', description: 'Подключение CRM и учётных систем.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [form, setForm] = useState({ name: '', baseUrl: '', healthPath: '/health', token: '' });
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setConnections(await listIntegrations());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function createConnection() {
    if (!selectedProvider) return;
    const row = await createIntegration({
      name: form.name || INTEGRATION_PROVIDER_LABELS[selectedProvider],
      provider: selectedProvider,
      mode: 'api',
      config: { baseUrl: form.baseUrl, healthPath: form.healthPath },
      credentials: form.token ? { token: form.token } : undefined,
    });
    setConnections((prev) => [row, ...prev]);
    setWizardOpen(false);
    setWizardStep(1);
    setSelectedProvider(null);
    setForm({ name: '', baseUrl: '', healthPath: '/health', token: '' });
  }

  async function runTest(id: string) {
    const out = await testIntegration(id);
    setTestResult(out.ok ? 'Подключение успешно проверено' : out.message || 'Проверка не пройдена');
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Интеграции"
        description="Подключите учётную систему для передачи заявок и клиентов."
        actions={
          <Button onClick={() => setWizardOpen(true)}>Подключить систему</Button>
        }
      />

      {testResult ? <div className="alert">{testResult}</div> : null}

      {connections.length ? (
        <div className="integration-cards-grid">
          {connections.map((c) => (
            <Card key={c.id} className="integration-card">
              <header>
                <h3>{c.name}</h3>
                <IntegrationStatusBadge status={c.status} />
              </header>
              <p>{INTEGRATION_PROVIDER_LABELS[c.provider]}</p>
              {c.lastErrorMessage ? <p className="danger">{c.lastErrorMessage}</p> : null}
              <div className="row gap-sm">
                <Link to={`/dashboard/admin/integrations/${c.id}`}>
                  <Button variant="ghost">Открыть</Button>
                </Link>
                <Button variant="ghost" onClick={() => void runTest(c.id)}>
                  Проверить
                </Button>
                {c.enabled ? (
                  <Button variant="ghost" onClick={() => void disableIntegration(c.id).then(load)}>
                    Отключить
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => void enableIntegration(c.id).then(load)}>
                    Включить
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Нет подключённых систем"
          description="Подключите Generic REST или другую CRM через мастер настройки."
        />
      )}

      <h2>Доступные системы</h2>
      <div className="integration-cards-grid">
        {PROVIDER_CARDS.map((card) => (
          <Card key={card.provider} className={`integration-card${card.supported ? '' : ' muted'}`}>
            <h3>{INTEGRATION_PROVIDER_LABELS[card.provider]}</h3>
            <p>{card.description}</p>
            <p>{card.supported ? 'Доступен мастер подключения' : 'Требуется согласование API с заказчиком'}</p>
            {card.supported ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedProvider(card.provider);
                  setWizardOpen(true);
                  setWizardStep(2);
                }}
              >
                Настроить
              </Button>
            ) : null}
          </Card>
        ))}
      </div>

      <Modal open={wizardOpen} title="Мастер подключения" onClose={() => setWizardOpen(false)}>
        {wizardStep === 1 && (
          <div className="stack">
            <p>Шаг 1. Выберите систему</p>
            <div className="integration-cards-grid">
              {PROVIDER_CARDS.filter((c) => c.supported).map((card) => (
                <button
                  key={card.provider}
                  type="button"
                  className="quick-action-card"
                  onClick={() => {
                    setSelectedProvider(card.provider);
                    setWizardStep(2);
                  }}
                >
                  {INTEGRATION_PROVIDER_LABELS[card.provider]}
                </button>
              ))}
            </div>
          </div>
        )}
        {wizardStep === 2 && selectedProvider && (
          <div className="stack">
            <p>Шаг 2–3. Укажите адрес и доступ</p>
            <label>
              Название подключения
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={INTEGRATION_PROVIDER_LABELS[selectedProvider]}
              />
            </label>
            <label>
              Адрес API
              <input
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://crm.example.com/api"
              />
            </label>
            <label>
              Путь проверки
              <input
                value={form.healthPath}
                onChange={(e) => setForm((f) => ({ ...f, healthPath: e.target.value }))}
              />
            </label>
            <label>
              Токен (не отображается после сохранения)
              <input
                type="password"
                value={form.token}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
              />
            </label>
            <div className="row gap-sm">
              <Button variant="ghost" onClick={() => setWizardStep(1)}>
                Назад
              </Button>
              <Button onClick={() => void createConnection().catch((e) => setError(String(e)))}>
                Создать и проверить позже
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
