import { useEffect, useState } from 'react';
import { getAdminSiteSettings, patchAdminSiteSettings } from '../../../api/adminSite';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { resolveAdminBreadcrumbs } from '../../../config/adminRoutes';
import { useProductConfig, useProductConfigState } from '../../../config/ProductConfigProvider';
import type { ProductConfig } from '../../../config/productConfig';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function AdminSiteAppearancePage() {
  usePageMeta({ title: 'Оформление', description: 'White-label настройки продукта.' });
  const live = useProductConfig();
  const { refresh } = useProductConfigState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Pick<ProductConfig, 'productName' | 'shortName' | 'description' | 'assistantName' | 'phone' | 'address' | 'workingHours' | 'mapUrl' | 'supportEmail' | 'footerCaption' | 'theme'>>({
    productName: live.productName,
    shortName: live.shortName,
    description: live.description,
    assistantName: live.assistantName,
    phone: live.phone || '',
    address: live.address || '',
    workingHours: live.workingHours,
    mapUrl: live.mapUrl || '',
    supportEmail: live.supportEmail || '',
    footerCaption: live.footerCaption,
    theme: { ...live.theme },
  });

  useEffect(() => {
    void getAdminSiteSettings()
      .then((data) => {
        setForm({
          productName: data.productName,
          shortName: data.shortName,
          description: data.description,
          assistantName: data.assistantName,
          phone: data.phone || '',
          address: data.address || '',
          workingHours: data.workingHours,
          mapUrl: data.mapUrl || '',
          supportEmail: data.supportEmail || '',
          footerCaption: data.footerCaption,
          theme: { ...data.theme },
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await patchAdminSiteSettings({
        ...form,
        phone: form.phone || null,
        address: form.address || null,
        mapUrl: form.mapUrl || null,
        supportEmail: form.supportEmail || null,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader />;
  if (error && !form.productName) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Оформление"
        description="Название, контакты и цвета бренда — сразу на публичном сайте."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/site/appearance')}
      />

      <div className="grid two">
        <Card>
          <form className="stack compact" onSubmit={(e) => void onSave(e)}>
            <input value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} placeholder="Название" aria-label="Название" />
            <input value={form.shortName} onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))} placeholder="Короткое имя" aria-label="Короткое имя" />
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Описание" rows={2} aria-label="Описание" />
            <input value={form.assistantName} onChange={(e) => setForm((f) => ({ ...f, assistantName: e.target.value }))} placeholder="Имя ассистента" aria-label="Имя ассистента" />
            <input value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Телефон" aria-label="Телефон" />
            <input value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Адрес" aria-label="Адрес" />
            <input value={form.workingHours ?? ''} onChange={(e) => setForm((f) => ({ ...f, workingHours: e.target.value }))} placeholder="Часы работы" aria-label="Часы работы" />
            <input value={form.supportEmail ?? ''} onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))} placeholder="Email поддержки" aria-label="Email" />
            <input value={form.mapUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))} placeholder="Ссылка на карту" aria-label="Карта" />
            <input
              value={form.footerCaption ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, footerCaption: e.target.value }))}
              placeholder="Короткий слоган в футере (не юридический текст)"
              aria-label="Слоган в футере"
            />
            <div className="admin-color-row">
              <label>
                Primary
                <input type="color" value={form.theme.primary} onChange={(e) => setForm((f) => ({ ...f, theme: { ...f.theme, primary: e.target.value } }))} />
              </label>
              <label>
                Secondary
                <input type="color" value={form.theme.secondary} onChange={(e) => setForm((f) => ({ ...f, theme: { ...f.theme, secondary: e.target.value } }))} />
              </label>
              <label>
                Accent
                <input type="color" value={form.theme.accent} onChange={(e) => setForm((f) => ({ ...f, theme: { ...f.theme, accent: e.target.value } }))} />
              </label>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </form>
        </Card>

        <Card className="appearance-preview">
          <h2>Предпросмотр</h2>
          <div
            className="preview-hero"
            style={{
              borderColor: form.theme.primary,
              background: `linear-gradient(160deg, ${form.theme.secondary}, #151821)`,
            }}
          >
            <strong style={{ color: '#fff' }}>{form.productName}</strong>
            <p style={{ color: '#a1a1aa' }}>{form.description}</p>
            <div className="row gap-sm">
              <button type="button" className="btn btn-primary" style={{ background: form.theme.primary, border: 'none' }}>
                ИИ-диагностика
              </button>
              <button type="button" className="btn btn-secondary">
                Записаться
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
