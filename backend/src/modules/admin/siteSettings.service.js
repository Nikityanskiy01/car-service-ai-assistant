import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

const SETTINGS_ID = 'default';

/** Defaults aligned with frontend productConfig starter. */
export const DEFAULT_SITE_SETTINGS = {
  productName: 'Автосервис',
  shortName: 'Автосервис',
  description: 'Ремонт, ТО и онлайн ИИ-диагностика автомобиля',
  logoUrl: null,
  supportEmail: 'info@autoservice-demo.zernov.online',
  phone: '+7 (999) 000-00-00',
  address: 'Москва',
  workingHours: 'пн–сб 10:00–20:00',
  mapUrl: 'https://yandex.ru/maps/?text=Москва',
  assistantName: 'ИИ-ассистент',
  footerCaption: 'Онлайн-запись, консультации и личный кабинет.',
  theme: {
    primary: '#EA580C',
    secondary: '#0B0D12',
    accent: '#FB923C',
  },
  legal: {
    legalName: 'ООО «Автосервис» (шаблон — укажите реальное юрлицо)',
    ogrn: '0000000000000',
    inn: '0000000000000',
    legalAddress: 'г. Москва',
    privacyEmail: 'privacy@autoservice-demo.zernov.online',
  },
};

function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function mergeSettings(base, patch) {
  const next = structuredClone(base);
  const scalarKeys = [
    'productName',
    'shortName',
    'description',
    'logoUrl',
    'supportEmail',
    'phone',
    'address',
    'workingHours',
    'mapUrl',
    'assistantName',
    'footerCaption',
  ];
  for (const key of scalarKeys) {
    if (patch[key] !== undefined) {
      const val = patch[key];
      next[key] = val === null || val === '' ? null : String(val).trim();
    }
  }
  if (patch.theme) {
    next.theme = {
      ...next.theme,
      ...(patch.theme.primary && isHexColor(patch.theme.primary) ? { primary: patch.theme.primary } : {}),
      ...(patch.theme.secondary && isHexColor(patch.theme.secondary) ? { secondary: patch.theme.secondary } : {}),
      ...(patch.theme.accent && isHexColor(patch.theme.accent) ? { accent: patch.theme.accent } : {}),
    };
  }
  if (patch.legal) {
    next.legal = { ...next.legal };
    for (const key of ['legalName', 'ogrn', 'inn', 'legalAddress', 'privacyEmail']) {
      if (patch.legal[key] !== undefined) {
        next.legal[key] = String(patch.legal[key] || '').trim();
      }
    }
  }
  return next;
}

export async function getSiteSettings() {
  const row = await prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row?.configJson) return { ...DEFAULT_SITE_SETTINGS, updatedAt: null };
  return {
    ...mergeSettings(DEFAULT_SITE_SETTINGS, row.configJson),
    updatedAt: row.updatedAt?.toISOString() || null,
  };
}

export async function patchSiteSettings(actorId, patch) {
  const current = await getSiteSettings();
  const merged = mergeSettings(current, patch);
  const row = await prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      configJson: merged,
      updatedBy: actorId || null,
    },
    update: {
      configJson: merged,
      updatedBy: actorId || null,
    },
  });
  await prisma.adminAuditEvent.create({
    data: {
      actorId: actorId || null,
      action: 'SITE_SETTINGS_UPDATE',
      entityType: 'site_settings',
      entityId: SETTINGS_ID,
      payloadJson: { keys: Object.keys(patch || {}) },
    },
  });
  return {
    ...merged,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function validateSiteSettingsPatch(patch) {
  if (!patch || typeof patch !== 'object') {
    throw new AppError(400, 'Пустое тело запроса', 'BAD_REQUEST');
  }
  if (patch.theme) {
    for (const [k, v] of Object.entries(patch.theme)) {
      if (v && !isHexColor(v)) {
        throw new AppError(400, `Некорректный цвет theme.${k}`, 'BAD_REQUEST');
      }
    }
  }
  return patch;
}
