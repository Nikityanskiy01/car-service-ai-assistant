import { productConfig } from '../../config/productConfig';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { usePageMeta } from '../../hooks/usePageMeta';

export function AdminAppearancePage() {
  usePageMeta({ title: 'Оформление', description: 'White-label настройки продукта.' });

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Оформление"
        description="Название, цвета и брендинг. Изменения через конфигурацию окружения до появления API редактора."
      />

      <div className="grid two">
        <Card>
          <h2>Текущие настройки</h2>
          <dl className="detail-dl">
            <div>
              <dt>Название продукта</dt>
              <dd>{productConfig.productName}</dd>
            </div>
            <div>
              <dt>Короткое название</dt>
              <dd>{productConfig.shortName}</dd>
            </div>
            <div>
              <dt>Имя ассистента</dt>
              <dd>{productConfig.assistantName}</dd>
            </div>
            <div>
              <dt>Основной цвет</dt>
              <dd>
                <span className="color-swatch" style={{ background: productConfig.theme.primary }} />
                {productConfig.theme.primary}
              </dd>
            </div>
            <div>
              <dt>Дополнительный цвет</dt>
              <dd>
                <span className="color-swatch" style={{ background: productConfig.theme.secondary }} />
                {productConfig.theme.secondary}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="appearance-preview">
          <h2>Предпросмотр</h2>
          <div className="preview-hero" style={{ borderColor: productConfig.theme.primary }}>
            <strong>{productConfig.productName}</strong>
            <p>{productConfig.description}</p>
            <button type="button" className="btn" style={{ background: productConfig.theme.primary }}>
              Записаться
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
