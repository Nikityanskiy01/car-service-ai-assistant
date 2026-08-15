import { describe, expect, it } from 'vitest';
import { resolveClientOverviewFocus } from './resolveClientOverviewFocus';
import type { ClientDashboardSummary } from './resolveClientHero';

const base: ClientDashboardSummary = {
  profile: { fullName: 'Иван', phone: '+79990000000' },
  activeCasesCount: 0,
  unreadMessagesCount: 0,
  unreadThreads: [],
  hasAnyHistory: false,
  nextBooking: null,
  draftConsultation: null,
  recentActiveCases: [],
};

describe('resolveClientOverviewFocus', () => {
  it('returns null for newcomer without draft', () => {
    expect(resolveClientOverviewFocus(base)).toBeNull();
  });

  it('prioritizes draft as primary and unread as secondary', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      unreadMessagesCount: 8,
      unreadThreads: [
        {
          requestId: 'req-1',
          title: 'Toyota Camry',
          symptoms: 'Стук',
          unreadCount: 8,
          lastMessagePreview: 'Можно завтра в 10:00',
          lastMessageAt: '2026-08-15T10:00:00.000Z',
        },
      ],
      draftConsultation: {
        id: 'sess-1',
        make: 'Toyota',
        model: 'Camry',
        symptom: 'Стук',
      },
    });

    expect(focus?.primary.id).toBe('draft');
    expect(focus?.secondary.map((item) => item.id)).toEqual(['unread-req-1']);
    expect(focus?.secondary[0]?.title).toContain('Toyota Camry');
    expect(focus?.secondary[0]?.ctaTo).toBe('/dashboard/client/cases/req-1?tab=messages');
  });

  it('opens the specific unread chat from the primary focus', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      unreadMessagesCount: 2,
      unreadThreads: [
        {
          requestId: 'req-kia',
          title: 'Kia Rio',
          symptoms: 'Шум',
          unreadCount: 2,
          lastMessagePreview: 'Привезите авто к 11',
          lastMessageAt: '2026-08-15T11:00:00.000Z',
        },
      ],
    });

    expect(focus?.primary.id).toBe('unread-req-kia');
    expect(focus?.primary.title).toBe('2 новых сообщения — Kia Rio');
    expect(focus?.primary.description).toContain('Привезите авто к 11');
    expect(focus?.primary.ctaTo).toBe('/dashboard/client/cases/req-kia?tab=messages');
    expect(focus?.secondary).toEqual([]);
  });

  it('lists each unread chat separately', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      unreadMessagesCount: 3,
      unreadThreads: [
        {
          requestId: 'req-a',
          title: 'BMW X5',
          symptoms: 'Стук',
          unreadCount: 1,
          lastMessagePreview: 'Нужна диагностика',
          lastMessageAt: '2026-08-15T12:00:00.000Z',
        },
        {
          requestId: 'req-b',
          title: 'Kia Rio',
          symptoms: 'Шум',
          unreadCount: 2,
          lastMessagePreview: 'Ждём вас завтра',
          lastMessageAt: '2026-08-15T11:00:00.000Z',
        },
      ],
    });

    expect(focus?.primary.title).toBe('Ответ по BMW X5');
    expect(focus?.secondary.map((item) => item.id)).toEqual(['unread-req-b']);
    expect(focus?.secondary[0]?.ctaTo).toBe('/dashboard/client/cases/req-b?tab=messages');
  });

  it('keeps all unread chats for the grouped expandable list', () => {
    const unreadThreads = Array.from({ length: 6 }, (_, index) => ({
      requestId: `req-${index}`,
      title: `Автомобиль ${index + 1}`,
      symptoms: 'Диагностика',
      unreadCount: 1,
      lastMessagePreview: `Ответ менеджера ${index + 1}`,
      lastMessageAt: `2026-08-15T${String(12 - index).padStart(2, '0')}:00:00.000Z`,
    }));

    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      unreadMessagesCount: unreadThreads.length,
      unreadThreads,
    });

    expect(focus?.primary.id).toBe('unread-req-0');
    expect(focus?.secondary).toHaveLength(5);
    expect(focus?.secondary[4]?.id).toBe('unread-req-5');
  });

  it('does not duplicate draft in secondary list', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      draftConsultation: { id: 'sess-1', make: 'Kia', model: 'Rio', symptom: 'Шум' },
      nextBooking: {
        id: 'b1',
        preferredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'CONFIRMED',
      },
    });

    expect(focus?.primary.id).toBe('draft');
    expect(focus?.secondary.some((item) => item.id === 'draft')).toBe(false);
  });

  it('skips focus when only active cases exist (list covers them)', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
      activeCasesCount: 3,
    });

    expect(focus).toBeNull();
  });

  it('shows idle only when nothing is going on', () => {
    const focus = resolveClientOverviewFocus({
      ...base,
      hasAnyHistory: true,
    });

    expect(focus?.primary.id).toBe('idle');
    expect(focus?.secondary).toEqual([]);
  });
});
