import { productConfig } from '../../config/productConfig';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { resolveAdminBreadcrumbs } from '../../config/adminRoutes';
import { usePageMeta } from '../../hooks/usePageMeta';

export function AdminAppearancePage() {
  usePageMeta({ title: 'Оформление', description: 'White-label настройки продукта.' });

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Оформление"
        description="Название, цвета и брендинг white-label. Редактирование — в фазе C."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/site/appearance')}
      />

      <div className="grid two">
        <Card>
          <h2>Текущие настройки</h2>
          <dl className="detail-dl desk-profile-dl">
            <div>
              <dt>Продукт</dt>
              <dd>{productConfig.productName}</dd>
            </div>
            <div>
              <dt>Коротко</dt>
              <dd>{productConfig.shortName}</dd>
            </div>
            <div>
              <dt>Ассистент</dt>
              <dd>{productConfig.assistantName}</dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>{productConfig.phone || '—'}</dd>
            </div>
            <div>
              <dt>Адрес</dt>
              <dd>{productConfig.address || '—'}</dd>
            </div>
            <div>
              <dt>Основной</dt>
              <dd>
                <span className="color-swatch" style={{ background: productConfig.theme.primary }} />
                {productConfig.theme.primary}
              </dd>
            </div>
            <div>
              <dt>Акцент</dt>
              <dd>
                <span className="color-swatch" style={{ background: productConfig.theme.accent }} />
                {productConfig.theme.accent}
              </dd>
            </div>
            <div>
              <dt>Фон</dt>
              <dd>
                <span className="color-swatch" style={{ background: productConfig.theme.secondary }} />
                {productConfig.theme.secondary}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="appearance-preview">
          <h2>Предпросмотр шапки</h2>
          <div
            className="preview-hero"
            style={{
              borderColor: productConfig.theme.primary,
              background: `linear-gradient(160deg, ${productConfig.theme.secondary}, #151821)`,
            }}
          >
            <strong style={{ color: '#fff' }}>{productConfig.productName}</strong>
            <p style={{ color: '#a1a1aa' }}>{productConfig.description}</p>
            <div className="row gap-sm">
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: productConfig.theme.primary, border: 'none' }}
              >
                ИИ-диагностика
              </button>
              <button type="button" className="btn btn-secondary">
                Записаться
              </button>
            </div>
          </div>
          <p className="muted" style={{ marginTop: '0.85rem' }}>
            Редактор через UI появится позже. Сейчас правки — в `productConfig` / env.
          </p>
        </Card>
      </div>
    </div>
  );
}
