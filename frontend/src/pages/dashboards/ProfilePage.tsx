import { Link, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Calendar,
  Car,
  Check,
  KeyRound,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Phone,
  Send,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { patchProfile } from '../../api/dashboard';
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  type NotificationPreferences,
} from '../../api/notifications';
import { ProfileAvatarPicker } from '../../components/profile/ProfileAvatarPicker';
import { ProfilePasswordForm } from '../../components/profile/ProfilePasswordForm';
import { ProfileSecurityPanel } from '../../components/profile/ProfileSecurityPanel';
import { ProfileSwitch } from '../../components/profile/ProfileSwitch';
import { NotificationChannelRow } from '../../components/notifications/NotificationChannelRow';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { FormField } from '../../components/forms/FormField';
import { Input } from '../../components/ui/Input';
import { Loader } from '../../components/ui/Loader';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Tabs } from '../../components/ui/Tabs';
import { parseProfileTab, type ProfileTab } from '../../lib/profileTabs';
import { parseSecuritySection, SECURITY_SECTION_ITEMS, type SecuritySection } from '../../lib/profileSecurityTabs';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { PreferredContact } from '../../types/auth';

type NotificationPrefs = Pick<
  NotificationPreferences,
  'bookingReminders' | 'messageAlerts' | 'marketing' | 'channelEmail' | 'channelTelegram' | 'channelSms'
>;

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  bookingReminders: true,
  messageAlerts: true,
  marketing: false,
  channelEmail: true,
  channelTelegram: true,
  channelSms: false,
};

const PREFERRED_CONTACT_OPTIONS: Array<{ value: PreferredContact; label: string; icon: typeof Phone }> = [
  { value: 'PHONE', label: 'Телефон', icon: Phone },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'TELEGRAM', label: 'Telegram', icon: Send },
];

const TAB_ITEMS_CLIENT = [
  { id: 'contacts', label: 'Личные данные' },
  { id: 'notifications', label: 'Уведомления' },
  { id: 'security', label: 'Безопасность' },
];

function formatMemberSince(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return null;
  }
}

function roleLabel(role: string) {
  if (role === 'ADMINISTRATOR') return 'Администратор';
  if (role === 'MANAGER') return 'Менеджер';
  return 'Клиент';
}

function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return phone;
}

export function ProfilePage() {
  usePageMeta({ title: 'Профиль', description: 'Личные данные, уведомления и безопасность аккаунта.' });
  const { user, refreshCurrentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseProfileTab(searchParams.get('tab'));
  const securitySection = parseSecuritySection(searchParams.get('section'));
  const isClient = user?.role === 'CLIENT';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emailProfile, setEmailProfile] = useState('');
  const [city, setCity] = useState('');
  const [telegram, setTelegram] = useState('');
  const [preferredContact, setPreferredContact] = useState<PreferredContact | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [notificationMeta, setNotificationMeta] = useState<NotificationPreferences['channels'] | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setEmailProfile(user.emailProfile || '');
    setCity(user.city || '');
    setTelegram(user.telegram || '');
    setPreferredContact(user.preferredContact || '');
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isClient) return;
    let cancelled = false;
    void (async () => {
      try {
        const prefs = await getNotificationPreferences();
        if (cancelled) return;
        setNotificationPrefs({
          bookingReminders: prefs.bookingReminders,
          messageAlerts: prefs.messageAlerts,
          marketing: prefs.marketing,
          channelEmail: prefs.channelEmail,
          channelTelegram: prefs.channelTelegram,
          channelSms: prefs.channelSms,
        });
        setNotificationMeta(prefs.channels);
      } catch {
        /* оставляем значения по умолчанию */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isClient]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const memberSince = useMemo(() => formatMemberSince(user?.createdAt), [user?.createdAt]);

  const isDirty = useMemo(() => {
    if (!user) return false;
    return (
      fullName !== (user.fullName || '') ||
      phone !== (user.phone || '') ||
      emailProfile !== (user.emailProfile || '') ||
      city !== (user.city || '') ||
      telegram !== (user.telegram || '') ||
      preferredContact !== (user.preferredContact || '')
    );
  }, [user, fullName, phone, emailProfile, city, telegram, preferredContact]);

  function setTab(next: ProfileTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    if (next !== 'security') {
      params.delete('section');
    }
    setSearchParams(params, { replace: true });
  }

  function setSecuritySection(next: SecuritySection) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'security');
    if (next === 'password') {
      params.delete('section');
    } else {
      params.set('section', next);
    }
    setSearchParams(params, { replace: true });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await patchProfile({
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        emailProfile: emailProfile.trim() || null,
        city: city.trim() || null,
        telegram: telegram.trim() || null,
        preferredContact: preferredContact || null,
      });
      await refreshCurrentUser();
      setSuccess('Изменения сохранены');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    if (!user) return;
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setEmailProfile(user.emailProfile || '');
    setCity(user.city || '');
    setTelegram(user.telegram || '');
    setPreferredContact(user.preferredContact || '');
    setError(null);
  }

  async function updateNotificationPref<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
    const prev = notificationPrefs;
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    try {
      const saved = await patchNotificationPreferences({ [key]: value });
      setNotificationPrefs({
        bookingReminders: saved.bookingReminders,
        messageAlerts: saved.messageAlerts,
        marketing: saved.marketing,
        channelEmail: saved.channelEmail,
        channelTelegram: saved.channelTelegram,
        channelSms: saved.channelSms,
      });
      setNotificationMeta(saved.channels);
    } catch {
      setNotificationPrefs(prev);
    }
  }

  if (loading) return <Loader label="Загрузка профиля…" />;
  if (!user) return <ErrorState message="Пользователь не найден" />;

  const tabItems = isClient
    ? TAB_ITEMS_CLIENT
    : [
        { id: 'contacts', label: 'Контакты' },
        { id: 'security', label: 'Безопасность' },
      ];

  return (
    <div className="stack dashboard-page profile-page">
      <section className="profile-hero" aria-label="Профиль пользователя">
        <div className="profile-hero-top">
          <ProfileAvatarPicker
            name={user.fullName || user.email}
            avatarUrl={user.avatarUrl}
            onUpdated={refreshCurrentUser}
          />
          <div className="profile-hero-body">
            <span className="profile-hero-badge">{roleLabel(user.role)}</span>
            <h1 className="profile-hero-name">{user.fullName || 'Профиль'}</h1>
            <div className="profile-hero-meta">
              <span>
                <Mail size={14} aria-hidden />
                {user.email}
              </span>
              {memberSince ? (
                <span>
                  <Calendar size={14} aria-hidden />
                  В сервисе с {memberSince}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {isClient ? (
          <div className="profile-hero-footer">
            <div className="profile-hero-chips">
              <span className="profile-hero-chip">
                <Phone size={14} aria-hidden />
                {user.phone ? formatPhoneDisplay(user.phone) : 'Телефон не указан'}
              </span>
              {city ? (
                <span className="profile-hero-chip">
                  <MapPin size={14} aria-hidden />
                  {city}
                </span>
              ) : null}
              {telegram ? (
                <span className="profile-hero-chip">
                  <Send size={14} aria-hidden />
                  @{telegram}
                </span>
              ) : null}
            </div>
            <Link className="profile-hero-link" to="/dashboard/client/vehicles">
              <Car size={15} aria-hidden />
              Гараж
            </Link>
          </div>
        ) : null}
      </section>

      <div className="profile-shell">
        {tabItems.length > 1 ? (
          <Tabs
            className="profile-tabs"
            value={tab}
            onChange={(next) => setTab(next as ProfileTab)}
            items={tabItems}
          />
        ) : null}

        {tab === 'contacts' ? (
          <div
            className="profile-panel"
            role="tabpanel"
            id="tabpanel-contacts"
            aria-labelledby="tab-contacts"
          >
            <Card className="profile-settings-card">
              <div className="profile-settings-grid">
                <section className="profile-settings-section">
                  <header className="profile-section-head">
                    <span className="profile-section-icon" aria-hidden>
                      <User size={18} />
                    </span>
                    <div>
                      <h2>Основные данные</h2>
                      <p>Имя и телефон, по которым с вами свяжется сервис</p>
                    </div>
                  </header>
                  <div className="profile-fields">
                    <FormField label="Имя и фамилия" htmlFor="profile-name">
                      <Input
                        id="profile-name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Иван Иванов"
                        autoComplete="name"
                      />
                    </FormField>
                    <FormField
                      label="Email для входа"
                      htmlFor="profile-email"
                      hint="Этот адрес нужен, чтобы войти в кабинет. Сменить его можно только через сервис."
                    >
                      <Input id="profile-email" value={user.email} disabled readOnly className="input-readonly" />
                    </FormField>
                    <FormField label="Телефон" htmlFor="profile-phone">
                      <PhoneInput id="profile-phone" required value={phone} onChange={setPhone} />
                    </FormField>
                    {isClient ? (
                      <FormField label="Город" htmlFor="profile-city" hint="Можно не заполнять">
                        <Input
                          id="profile-city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Москва"
                          autoComplete="address-level2"
                        />
                      </FormField>
                    ) : null}
                  </div>
                </section>

                {isClient ? (
                  <section className="profile-settings-section">
                    <header className="profile-section-head">
                      <span className="profile-section-icon" aria-hidden>
                        <MessageSquare size={18} />
                      </span>
                      <div>
                        <h2>Как с вами связаться</h2>
                        <p>Дополнительный email, Telegram и удобный способ связи</p>
                      </div>
                    </header>
                    <div className="profile-fields">
                      <FormField
                        label="Email для писем"
                        htmlFor="profile-email-profile"
                        hint="Сюда придут счета и уведомления. Если не указать — письма придут на адрес для входа."
                      >
                        <Input
                          id="profile-email-profile"
                          type="email"
                          value={emailProfile}
                          onChange={(e) => setEmailProfile(e.target.value)}
                          placeholder="ivan@mail.ru"
                          autoComplete="email"
                        />
                      </FormField>
                      <FormField label="Telegram" htmlFor="profile-telegram" hint="Имя пользователя без символа @">
                        <Input
                          id="profile-telegram"
                          value={telegram}
                          onChange={(e) => setTelegram(e.target.value)}
                          placeholder="ivanov"
                          autoComplete="off"
                        />
                      </FormField>
                      <fieldset className="profile-segment-field">
                        <legend>Основной способ связи</legend>
                        <p className="field-hint">Сервис свяжется с вами этим способом в первую очередь.</p>
                        <div className="profile-segment" role="radiogroup" aria-label="Основной способ связи">
                          {PREFERRED_CONTACT_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const selected = preferredContact === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                className={`profile-segment-btn${selected ? ' is-active' : ''}`}
                                onClick={() => setPreferredContact(selected ? '' : opt.value)}
                              >
                                <Icon size={15} aria-hidden />
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>
                  </section>
                ) : null}
              </div>

              {(isDirty || error || success) && tab === 'contacts' ? (
                <div className={`profile-save-bar${isDirty ? ' is-dirty' : ''}`}>
                  <div className="profile-save-status">
                    {error ? <p className="form-error">{error}</p> : null}
                    {success ? (
                      <p className="profile-save-success">
                        <Check size={16} aria-hidden />
                        {success}
                      </p>
                    ) : null}
                    {isDirty && !error && !success ? (
                      <p className="profile-save-hint">Есть несохранённые изменения</p>
                    ) : null}
                  </div>
                  <div className="profile-save-actions">
                    {isDirty ? (
                      <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                        Отменить
                      </Button>
                    ) : null}
                    <Button type="button" disabled={saving || !isDirty} onClick={() => void handleSave()}>
                      {saving ? 'Сохранение…' : 'Сохранить'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        {isClient && tab === 'notifications' ? (
          <div
            className="profile-panel"
            role="tabpanel"
            id="tabpanel-notifications"
            aria-labelledby="tab-notifications"
          >
            <Card className="profile-settings-card">
              <section className="profile-settings-section profile-notifications-section">
                <header className="profile-section-head profile-section-head-inline">
                  <span className="profile-section-icon" aria-hidden>
                    <Bell size={18} />
                  </span>
                  <div>
                    <h2>Уведомления</h2>
                    <p>Сайт и почта работают сразу. Telegram — если бот подключён. SMS подключим позже.</p>
                  </div>
                </header>
                <div className="profile-notifications-layout">
                  <div className="profile-notifications-block">
                    <h3 className="profile-notifications-subhead">О чём напоминать</h3>
                    <div className="profile-switch-list">
                      <ProfileSwitch
                        id="pref-booking"
                        label="Записи в сервис"
                        description="Подтверждение, перенос, отмена и напоминания за день и за час"
                        checked={notificationPrefs.bookingReminders}
                        onChange={(v) => void updateNotificationPref('bookingReminders', v)}
                      />
                      <ProfileSwitch
                        id="pref-messages"
                        label="Сообщения от менеджера"
                        description="Когда менеджер ответит по вашей заявке"
                        checked={notificationPrefs.messageAlerts}
                        onChange={(v) => void updateNotificationPref('messageAlerts', v)}
                      />
                      <ProfileSwitch
                        id="pref-marketing"
                        label="Акции и спецпредложения"
                        description="Скидки на обслуживание и сезонные предложения"
                        checked={notificationPrefs.marketing}
                        onChange={(v) => void updateNotificationPref('marketing', v)}
                      />
                    </div>
                  </div>

                  <div className="profile-notifications-block">
                    <h3 className="profile-notifications-subhead">Куда присылать</h3>
                    <div className="notification-channel-grid">
                      <NotificationChannelRow
                        icon={Monitor}
                        label="На сайте"
                        description="Колокольчик в кабинете — всегда включён"
                        tone="inapp"
                        staticRow
                        statusLabel="Включено"
                        statusVariant="on"
                      />
                      <NotificationChannelRow
                        id="pref-channel-email"
                        icon={Mail}
                        label="Электронная почта"
                        description={notificationMeta?.email.destination || 'Письма на адрес аккаунта'}
                        tone="email"
                        checked={notificationPrefs.channelEmail}
                        onChange={(v) => void updateNotificationPref('channelEmail', v)}
                      />
                      <NotificationChannelRow
                        id="pref-channel-telegram"
                        icon={Send}
                        label="Telegram"
                        description={
                          user.telegramLinked
                            ? 'Сообщения в привязанный чат с ботом'
                            : 'Сначала подключите Telegram в «Безопасность» → «Вход»'
                        }
                        tone="telegram"
                        checked={notificationPrefs.channelTelegram}
                        onChange={(v) => void updateNotificationPref('channelTelegram', v)}
                        disabled={!user.telegramLinked}
                      />
                      <NotificationChannelRow
                        id="pref-channel-sms"
                        icon={Phone}
                        label="SMS"
                        description="Код готов, провайдера подключим позже — сообщения пока не уходят"
                        tone="sms"
                        checked={notificationPrefs.channelSms}
                        onChange={(v) => void updateNotificationPref('channelSms', v)}
                        badge="Подключим позже"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </Card>
          </div>
        ) : null}

        {tab === 'security' ? (
          <div
            className="profile-panel"
            role="tabpanel"
            id="tabpanel-security"
            aria-labelledby="tab-security"
          >
            <Tabs
              className="profile-tabs profile-security-tabs"
              value={securitySection}
              onChange={(next) => setSecuritySection(next as SecuritySection)}
              items={SECURITY_SECTION_ITEMS}
            />

            {securitySection === 'password' ? (
              <Card className="profile-security-card profile-password-card">
                <header className="profile-section-head profile-section-head-inline">
                  <span className="profile-section-icon" aria-hidden>
                    <KeyRound size={18} />
                  </span>
                  <div>
                    <h2>Смена пароля</h2>
                    <p>Новый пароль заменит текущий сразу после сохранения</p>
                  </div>
                </header>
                <ProfilePasswordForm onPasswordChanged={refreshCurrentUser} />
              </Card>
            ) : (
              <ProfileSecurityPanel section={securitySection} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
