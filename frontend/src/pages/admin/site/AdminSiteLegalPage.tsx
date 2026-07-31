import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminSiteSettings, patchAdminSiteSettings } from '../../../api/adminSite';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { resolveAdminBreadcrumbs } from '../../../config/adminRoutes';
import { useProductConfigState } from '../../../config/ProductConfigProvider';
import type { LegalOperatorConfig } from '../../../config/productConfig';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function AdminSiteLegalPage() {
  usePageMeta({ title: 'Юридические данные', description: 'Реквизиты оператора ПДн.' });
  const { refresh } = useProductConfigState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [legal, setLegal] = useState<LegalOperatorConfig>({
    legalName: '',
    ogrn: '',
    inn: '',
    legalAddress: '',
    privacyEmail: '',
  });

  useEffect(() => {
    void getAdminSiteSettings()
      .then((data) => setLegal({ ...data.legal }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await patchAdminSiteSettings({ legal });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader />;
  if (error && !legal.legalName) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Юридические данные"
        description="Реквизиты для юридических документов сайта."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/site/legal')}
        actions={
          <>
            <Link to="/privacy" className="btn btn-secondary" target="_blank" rel="noreferrer">
              Политика обработки ПДн
            </Link>
            <Link to="/terms" className="btn btn-secondary" target="_blank" rel="noreferrer">
              Пользовательское соглашение
            </Link>
          </>
        }
      />

      <Card>
        <form className="stack compact" onSubmit={(e) => void onSave(e)}>
          <input value={legal.legalName} onChange={(e) => setLegal((l) => ({ ...l, legalName: e.target.value }))} placeholder="Юрлицо" aria-label="Юрлицо" />
          <input value={legal.ogrn} onChange={(e) => setLegal((l) => ({ ...l, ogrn: e.target.value }))} placeholder="ОГРН" aria-label="ОГРН" />
          <input value={legal.inn} onChange={(e) => setLegal((l) => ({ ...l, inn: e.target.value }))} placeholder="ИНН" aria-label="ИНН" />
          <input value={legal.legalAddress} onChange={(e) => setLegal((l) => ({ ...l, legalAddress: e.target.value }))} placeholder="Юридический адрес" aria-label="Адрес" />
          <input value={legal.privacyEmail} onChange={(e) => setLegal((l) => ({ ...l, privacyEmail: e.target.value }))} placeholder="Email для ПДн" aria-label="Privacy email" />
          {error ? <p className="error-text">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
