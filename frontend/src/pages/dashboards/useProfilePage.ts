import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { patchProfile } from '../../api/dashboard';
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  type NotificationPreferences,
} from '../../api/notifications';
import { parseProfileTab, type ProfileTab } from '../../lib/profileTabs';
import { parseSecuritySection, type SecuritySection } from '../../lib/profileSecurityTabs';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { PreferredContact } from '../../types/auth';

export type NotificationPrefs = Pick<
  NotificationPreferences,
  'bookingReminders' | 'messageAlerts' | 'marketing' | 'channelEmail' | 'channelTelegram' | 'channelSms'
>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  bookingReminders: true,
  messageAlerts: true,
  marketing: false,
  channelEmail: true,
  channelTelegram: true,
  channelSms: false,
};

export function formatMemberSince(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function roleLabel(role: string) {
  if (role === 'ADMINISTRATOR') return 'Администратор';
  if (role === 'MANAGER') return 'Менеджер';
  return 'Клиент';
}

export function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return phone;
}

export function useProfilePage() {
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
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить изменения');
      return false;
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

  return {
    user,
    refreshCurrentUser,
    tab,
    securitySection,
    isClient,
    fullName,
    setFullName,
    phone,
    setPhone,
    emailProfile,
    setEmailProfile,
    city,
    setCity,
    telegram,
    setTelegram,
    preferredContact,
    setPreferredContact,
    loading,
    saving,
    error,
    success,
    notificationPrefs,
    notificationMeta,
    memberSince,
    isDirty,
    setTab,
    setSecuritySection,
    handleSave,
    resetForm,
    updateNotificationPref,
  };
}

export type ProfilePageModel = ReturnType<typeof useProfilePage>;
