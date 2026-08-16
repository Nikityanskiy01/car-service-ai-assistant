import { useEffect } from 'react';
import { Calendar, KeyRound, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileAvatarPicker } from '../../components/profile/ProfileAvatarPicker';
import { ProfilePasswordForm } from '../../components/profile/ProfilePasswordForm';
import { ProfileSecurityPanel } from '../../components/profile/ProfileSecurityPanel';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Badge } from '../../components/console/ui/badge';
import { Button } from '../../components/console/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/console/ui/card';
import { Input } from '../../components/console/ui/input';
import { Label } from '../../components/console/ui/label';
import { Skeleton } from '../../components/console/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/console/ui/tabs';
import { SECURITY_SECTION_ITEMS } from '../../lib/profileSecurityTabs';
import { cn } from '../../lib/utils';
import { roleLabel, type ProfilePageModel } from '../dashboards/useProfilePage';

const fieldClass =
  'h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50';

export function ManagerProfileView(model: ProfilePageModel) {
  const {
    user,
    refreshCurrentUser,
    tab,
    securitySection,
    fullName,
    setFullName,
    phone,
    setPhone,
    loading,
    saving,
    error,
    success,
    memberSince,
    isDirty,
    setTab,
    setSecuritySection,
    handleSave,
    resetForm,
  } = model;

  const activeTab = tab === 'security' ? 'security' : 'contacts';

  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Профиль недоступен</AlertTitle>
        <AlertDescription>Пользователь не найден.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-3 py-0">
          <ProfileAvatarPicker
            name={user.fullName || user.email}
            avatarUrl={user.avatarUrl}
            onUpdated={refreshCurrentUser}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight">{user.fullName || 'Профиль'}</h1>
              <Badge variant="outline">{roleLabel(user.role)}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 truncate">
                <Mail size={14} aria-hidden />
                {user.email}
              </span>
              {memberSince ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} aria-hidden />
                  с {memberSince}
                </span>
              ) : null}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(next) => setTab(next === 'security' ? 'security' : 'contacts')}
      >
        <TabsList>
          <TabsTrigger value="contacts">Контакты</TabsTrigger>
          <TabsTrigger value="security">Безопасность</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex-col items-stretch justify-start gap-1">
              <CardTitle className="inline-flex items-center gap-2">
                <User size={16} aria-hidden />
                Рабочие контакты
              </CardTitle>
              <CardDescription>Имя и телефон, по которым с вами свяжется команда</CardDescription>
            </CardHeader>
            <CardContent className="flex w-full max-w-xl flex-col gap-3">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Не удалось сохранить</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manager-profile-name">Имя и фамилия</Label>
                <Input
                  id="manager-profile-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Иван Иванов"
                  autoComplete="name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manager-profile-email">Email для входа</Label>
                <Input id="manager-profile-email" value={user.email} disabled readOnly />
                <p className="text-xs text-muted-foreground">Сменить адрес можно только через сервис</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manager-profile-phone">Телефон</Label>
                <PhoneInput id="manager-profile-phone" required value={phone} onChange={setPhone} className={fieldClass} />
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-2 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">{isDirty ? 'Есть несохранённые изменения' : ' '}</p>
              <div className="flex items-center gap-2">
                {isDirty ? (
                  <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                    Отменить
                  </Button>
                ) : null}
                <Button type="button" disabled={saving || !isDirty} onClick={() => void handleSave()}>
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="flex flex-col gap-3">
          <Tabs
            value={securitySection}
            onValueChange={(next) => setSecuritySection(next as typeof securitySection)}
          >
            <TabsList className={cn('h-auto w-full flex-wrap justify-start')}>
              {SECURITY_SECTION_ITEMS.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {securitySection === 'password' ? (
            <Card>
              <CardHeader className="flex-col items-stretch justify-start gap-1">
                <CardTitle className="inline-flex items-center gap-2">
                  <KeyRound size={16} aria-hidden />
                  Смена пароля
                </CardTitle>
                <CardDescription>Новый пароль заменит текущий сразу после сохранения</CardDescription>
              </CardHeader>
              <CardContent className="manager-profile-security">
                <ProfilePasswordForm onPasswordChanged={refreshCurrentUser} />
              </CardContent>
            </Card>
          ) : (
            <div className="manager-profile-security">
              <ProfileSecurityPanel section={securitySection} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
