import { randomBytes } from 'crypto';
import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  isExtractedComplete,
  mergeExtracted,
  progressFromExtracted,
} from '../../lib/consultationProgress.js';
import { estimateCostFromMinor } from '../../lib/pricing.js';
import { pickPlaybook } from '../../lib/diagnosticPlaybooks.js';
import { topWorksForCategory, topWorksForCategoryAndMake } from '../../lib/workStats.js';
import { runLlmTurn } from '../ai/llm.js';

const sessionDetailInclude = {
  extracted: true,
  messages: { orderBy: { createdAt: 'asc' } },
  recommendations: true,
  serviceCategory: true,
  serviceRequest: true,
};

/**
 * @typedef {{ kind: 'staff', user: { id: string, role: string } } | { kind: 'owner', user: { id: string } } | { kind: 'guest' }} ConsultationActor
 */

/** @param {import('@prisma/client').ConsultationSession} session @param {ConsultationActor} actor */
function assertActorCanReadSession(session, actor) {
  if (actor.kind === 'staff') return;
  if (actor.kind === 'owner') {
    if (session.clientId !== actor.user.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  if (actor.kind === 'guest') {
    if (session.clientId != null) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

/** @param {import('@prisma/client').ConsultationSession} session @param {ConsultationActor} actor */
function assertActorCanPost(session, actor) {
  if (actor.kind === 'staff') throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  if (actor.kind === 'owner') {
    if (session.clientId !== actor.user.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  if (actor.kind === 'guest') {
    if (session.clientId != null) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  throw new AppError(403, 'Forbidden', 'FORBIDDEN');
}

export async function createSessionForClient(clientId, { serviceCategoryId } = {}) {
  if (serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!cat) throw new AppError(400, 'Unknown service category', 'BAD_REQUEST');
  }
  const row = await prisma.consultationSession.create({
    data: {
      clientId,
      guestToken: null,
      serviceCategoryId: serviceCategoryId || null,
      extracted: { create: {} },
    },
    include: { extracted: true, serviceCategory: true },
  });
  await bootstrapOpeningTurn(row.id);
  return prisma.consultationSession.findUnique({
    where: { id: row.id },
    include: { extracted: true, serviceCategory: true },
  });
}

export async function createGuestSession({ serviceCategoryId } = {}) {
  if (serviceCategoryId) {
    const cat = await prisma.serviceCategory.findUnique({ where: { id: serviceCategoryId } });
    if (!cat) throw new AppError(400, 'Unknown service category', 'BAD_REQUEST');
  }
  const guestToken = randomBytes(32).toString('hex');
  const row = await prisma.consultationSession.create({
    data: {
      clientId: null,
      guestToken,
      serviceCategoryId: serviceCategoryId || null,
      extracted: { create: {} },
    },
    include: { extracted: true, serviceCategory: true },
  });
  await bootstrapOpeningTurn(row.id);
  const full = await prisma.consultationSession.findUnique({
    where: { id: row.id },
    include: { extracted: true, serviceCategory: true },
  });
  return { session: full, guestToken };
}

export async function bootstrapOpeningTurn(sessionId) {
  try {
    const session = await prisma.consultationSession.findUnique({
      where: { id: sessionId },
      include: { extracted: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) return;
    const aiPayload = await runLlmTurn(session, '__SESSION_START__');
    await prisma.$transaction([
      prisma.message.create({
        data: { sessionId, sender: 'ASSISTANT', content: aiPayload.reply },
      }),
      prisma.consultationSession.update({
        where: { id: sessionId },
        data: { preliminaryNote: aiPayload.preliminaryNote || null },
      }),
    ]);
  } catch {
    await prisma.message.create({
      data: {
        sessionId,
        sender: 'ASSISTANT',
        content:
          'Здравствуйте! Я виртуальный консультант автосервиса. Расскажите, пожалуйста: марку и модель автомобиля, год выпуска, пробег, что вас беспокоит и при каких условиях это проявляется.',
      },
    });
  }
}

export async function claimSession(sessionId, clientId, guestToken) {
  const t = String(guestToken || '').trim();
  if (!t) throw new AppError(400, 'guestToken required', 'BAD_REQUEST');
  const session = await prisma.consultationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId) throw new AppError(409, 'Session already linked to account', 'CONFLICT');
  if (session.guestToken !== t) throw new AppError(403, 'Invalid guest token', 'FORBIDDEN');
  await prisma.$transaction([
    prisma.consultationSession.update({
      where: { id: sessionId },
      data: { clientId, guestToken: null },
    }),
    // If a guest already created a service request for this session,
    // attach it to the new account so it appears in the client's dashboard.
    prisma.serviceRequest.updateMany({
      where: { consultationSessionId: sessionId, clientId: null },
      data: {
        clientId,
        guestName: null,
        guestPhone: null,
        guestEmail: null,
      },
    }),
  ]);
  return getSessionDetail(sessionId, { kind: 'owner', user: { id: clientId } });
}

export async function listSessions(clientId) {
  return prisma.consultationSession.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    include: {
      extracted: true,
      serviceRequest: { select: { id: true, status: true } },
    },
  });
}

export async function getSessionDetail(sessionId, actor) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: sessionDetailInclude,
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  assertActorCanReadSession(session, actor);
  return session;
}

export async function postMessage(sessionId, actor, content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new AppError(400, 'Message required', 'BAD_REQUEST');

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      messages: { orderBy: { createdAt: 'asc' } },
      serviceRequest: true,
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  assertActorCanPost(session, actor);
  if (session.status === 'COMPLETED' || session.serviceRequest) {
    throw new AppError(400, 'Consultation is closed', 'CLOSED');
  }
  if (session.status === 'ABANDONED') {
    throw new AppError(400, 'Session abandoned', 'ABANDONED');
  }

  await prisma.message.create({
    data: { sessionId, sender: 'USER', content: trimmed },
  });

  const afterUser = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  let aiPayload;
  try {
    aiPayload = await runLlmTurn(afterUser, trimmed);
  } catch (e) {
    // Don't break UX if local LLM returns non-JSON or is temporarily flaky.
    // We keep the session usable and ask for missing fields deterministically.
    aiPayload = {
      reply:
        'Я не смог обработать ответ ИИ-модуля, но консультация продолжится. ' +
        'Пожалуйста, уточните марку и модель, год выпуска, пробег, что беспокоит и при каких условиях это проявляется.',
      extracted: {},
      recommendations: [],
      progressPercent: progressFromExtracted(afterUser.extracted),
      confidencePercent: null,
      costFromMinor: null,
      preliminaryNote:
        'Ответ носит информационный характер и не заменяет осмотр автомобиля в сервисе.',
    };
  }

  // LLM can hallucinate missing facts. We only accept some extracted fields
  // when there is evidence in the user's latest message.
  function sanitizeExtractedFromUserText(userText, partial) {
    const p = partial && typeof partial === 'object' ? { ...partial } : {};
    const t = String(userText || '');
    const tl = t.toLowerCase();
    const hasAny = (arr) => arr.some((k) => tl.includes(k));

    function parseMakeModelFromText() {
      const s = t
        .replace(/[,.;:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const makeMap = new Map([
        ['шкода', 'Skoda'],
        ['skoda', 'Skoda'],
        ['фольксваген', 'Volkswagen'],
        ['volkswagen', 'Volkswagen'],
        ['vw', 'Volkswagen'],
        ['ауди', 'Audi'],
        ['audi', 'Audi'],
        ['тойота', 'Toyota'],
        ['toyota', 'Toyota'],
        ['хендай', 'Hyundai'],
        ['hyundai', 'Hyundai'],
        ['киа', 'Kia'],
        ['kia', 'Kia'],
        ['лада', 'Lada'],
        ['ваз', 'VAZ'],
        ['vaz', 'VAZ'],
        ['рено', 'Renault'],
        ['renault', 'Renault'],
        ['ниссан', 'Nissan'],
        ['nissan', 'Nissan'],
        ['бмв', 'BMW'],
        ['bmw', 'BMW'],
        ['мерседес', 'Mercedes-Benz'],
        ['mercedes', 'Mercedes-Benz'],
        ['mercedes-benz', 'Mercedes-Benz'],
        ['опель', 'Opel'],
        ['opel', 'Opel'],
        ['пежо', 'Peugeot'],
        ['peugeot', 'Peugeot'],
        ['ситроен', 'Citroen'],
        ['citroen', 'Citroen'],
        ['мазда', 'Mazda'],
        ['mazda', 'Mazda'],
        ['хонда', 'Honda'],
        ['honda', 'Honda'],
        ['митсубиси', 'Mitsubishi'],
        ['mitsubishi', 'Mitsubishi'],
        ['субару', 'Subaru'],
        ['subaru', 'Subaru'],
        ['лексус', 'Lexus'],
        ['lexus', 'Lexus'],
        ['вольво', 'Volvo'],
        ['volvo', 'Volvo'],
        ['чери', 'Chery'],
        ['chery', 'Chery'],
        ['джили', 'Geely'],
        ['geely', 'Geely'],
        ['порше', 'Porsche'],
        ['porsche', 'Porsche'],
        ['сузуки', 'Suzuki'],
        ['suzuki', 'Suzuki'],
        ['шевроле', 'Chevrolet'],
        ['chevrolet', 'Chevrolet'],
        ['форд', 'Ford'],
        ['ford', 'Ford'],
        ['джип', 'Jeep'],
        ['jeep', 'Jeep'],
      ]);

      const titleize = (word) => {
        const w = String(word || '').trim();
        if (!w) return '';
        // Keep numeric/alphanumeric (e.g., X5, A8) readable.
        if (/^[a-z0-9]+$/i.test(w) && /[a-z]/i.test(w)) return w.toUpperCase().startsWith('X') ? w.toUpperCase() : w;
        const first = w.slice(0, 1).toUpperCase();
        const rest = w.slice(1).toLowerCase();
        return first + rest;
      };

      const parts = s.split(' ').filter(Boolean);
      if (parts.length < 1) return null;
      const mk = makeMap.get(parts[0].toLowerCase()) || null;
      if (!mk) return null;
      const model = parts
        .slice(1, 4)
        .map(titleize)
        .join(' ')
        .trim();
      return { make: mk, model: model || null };
    }

    const symptomKeywords = [
      'стук',
      'скрип',
      'вибрац',
      'увод',
      'тормоз',
      'троит',
      'пропуск',
      'не завод',
      'не запуска',
      'check engine',
      'чек',
      'перегрев',
      'дым',
      'расход',
      'пинки',
      'рывки',
      'акпп',
      'сцеплен',
      'шум',
      'кондиц',
      'печк',
      'утечк',
      'масл',
      'антифриз',
      'пинает',
      'пинается',
      'пинк',
    ];
    const conditionKeywords = ['на холод', 'на горяч', 'при ', 'когда', 'после', 'только', 'в пробке', 'на трассе'];

    const yearMatch = t.match(/\b(19[7-9]\d|20[0-2]\d)\b/);
    const mileageMatch =
      // Most reliable: explicit "пробег 110000" / "пробег: 110" / "пробег 110 тыс"
      t.match(/пробег\D{0,10}(\d{2,7})/i) ||
      // "110 тыс"
      t.match(/(\d{2,3})\s*тыс/i) ||
      // "120 000"
      t.match(/\b(\d{2,3}\s?\d{3})\b/) ||
      // "120000 км"
      t.match(/(\d{3,7})\s*км\b/i);

    const isCarOnly =
      t.length <= 40 &&
      !hasAny(symptomKeywords) &&
      !/\bпробег\b/i.test(t) &&
      !/\bкм\b/i.test(t) &&
      !/\bуслов/i.test(t) &&
      !/\bна холод|на горяч|при\b/i.test(t);

    // Allow deterministic make/model parsing from "car-only" messages.
    const car = parseMakeModelFromText();
    if (car && isCarOnly) {
      p.make = car.make;
      if (car.model) p.model = car.model;
    }

    if (!yearMatch) {
      delete p.year;
    }
    if (!mileageMatch) {
      delete p.mileage;
    } else {
      // Normalize short mileage like "пробег 110" => 110000, or "110 тыс" => 110000
      const raw = String(mileageMatch[1] || mileageMatch[0] || '').replace(/\s+/g, '');
      const n = Number(raw);
      if (Number.isFinite(n)) {
        const hasThousandWord = /тыс/i.test(t);
        const hasProbegWord = /пробег/i.test(t);
        if ((hasProbegWord || hasThousandWord) && n > 0 && n < 1000) {
          p.mileage = n * 1000;
        } else if (hasThousandWord && n >= 10 && n < 10000) {
          p.mileage = n * 1000;
        } else {
          p.mileage = n;
        }
      }
    }

    if (isCarOnly || !hasAny(symptomKeywords)) {
      delete p.symptoms;
    }
    if (isCarOnly || !hasAny(conditionKeywords)) {
      delete p.problemConditions;
    }

    return p;
  }

  const mergedExtracted = mergeExtracted(
    {
      make: afterUser.extracted?.make ?? null,
      model: afterUser.extracted?.model ?? null,
      year: afterUser.extracted?.year ?? null,
      mileage: afterUser.extracted?.mileage ?? null,
      symptoms: afterUser.extracted?.symptoms ?? null,
      problemConditions: afterUser.extracted?.problemConditions ?? null,
    },
    sanitizeExtractedFromUserText(trimmed, aiPayload.extracted),
  );

  const ruleProgress = progressFromExtracted(mergedExtracted);
  const complete = isExtractedComplete(mergedExtracted);

  // Progress is deterministic: only from actually extracted fields.
  let progressPercent = complete ? 100 : ruleProgress;

  const missing = [];
  if (!mergedExtracted.make) missing.push('марку');
  if (!mergedExtracted.model) missing.push('модель');
  if (!(mergedExtracted.year != null && Number.isFinite(Number(mergedExtracted.year)))) missing.push('год выпуска');
  if (!(mergedExtracted.mileage != null && Number.isFinite(Number(mergedExtracted.mileage))))
    missing.push('пробег');
  if (!mergedExtracted.symptoms) missing.push('симптомы (что именно происходит)');
  if (!mergedExtracted.problemConditions)
    missing.push('условия проявления (на холодную/на горячую, скорость, дорога и т.д.)');

  // If LLM "thinks" it's done but required fields are missing, force a deterministic follow-up.
  if (!complete) {
    aiPayload.progressPercent = ruleProgress;
    aiPayload.confidencePercent = null;
    aiPayload.costFromMinor = null;
    if (!Array.isArray(aiPayload.recommendations) || aiPayload.recommendations.length === 0) {
      aiPayload.recommendations = [];
    }
    if (missing.length > 0) {
      aiPayload.reply =
        'Чтобы подготовить итог и рекомендации, уточните, пожалуйста: ' +
        missing.join(', ') +
        '. Можно одним сообщением.';
    }
  }

  // When mandatory fields are collected, we force a deterministic "final" turn
  // so the UX doesn't depend on the LLM being smart enough to finish.
  if (complete) {
    aiPayload.reply =
      'Все обязательные данные собраны. Я подготовил предварительный итог по симптомам и условиям проявления.';
    if (!Array.isArray(aiPayload.recommendations) || aiPayload.recommendations.length === 0) {
      const pb = pickPlaybook(mergedExtracted, trimmed);
      aiPayload.recommendations = pb
        ? pb.hypotheses.slice(0, 5).map((t, i) => ({ title: t, probabilityPercent: Math.max(10, 60 - i * 10) }))
        : [{ title: 'Диагностика в сервисе (подтверждение причины)', probabilityPercent: 60 }];
    }
    if (aiPayload.preliminaryNote == null) {
      aiPayload.preliminaryNote =
        'Результат предварительный и не заменяет осмотр автомобиля в сервисе.';
    }
    if (aiPayload.costFromMinor == null || !Number.isFinite(Number(aiPayload.costFromMinor))) {
      aiPayload.costFromMinor = estimateCostFromMinor(mergedExtracted, aiPayload);
    }
    if (aiPayload.confidencePercent == null || !Number.isFinite(Number(aiPayload.confidencePercent))) {
      aiPayload.confidencePercent = 70;
    }

    // Add service-statistics hint (real works) to the final message to reduce "LLM fantasy".
    const pb = pickPlaybook(mergedExtracted, trimmed);
    const catId =
      pb?.id === 'engine-misfire' || pb?.id === 'engine-no-start' || pb?.id === 'engine-check-engine'
        ? 'engine'
        : pb?.id === 'cooling-overheat'
          ? 'cooling'
          : pb?.id === 'brakes-vibration'
            ? 'brakes'
            : pb?.id === 'suspension-knock'
              ? 'suspension'
              : pb?.id === 'at-shift'
                ? 'transmission'
                : null;
    const works =
      catId && mergedExtracted.make
        ? topWorksForCategoryAndMake(catId, mergedExtracted.make, 5)
        : catId
          ? topWorksForCategory(catId, 5)
          : [];
    if (works.length) {
      aiPayload.reply +=
        '\n\nПо статистике сервиса в похожих случаях часто выполняют:\n- ' + works.join('\n- ');
    }
    aiPayload.reply += '\n\nВы можете сохранить отчёт и оформить заявку в сервис.';
  }

  await prisma.$transaction([
    prisma.message.create({
      data: { sessionId, sender: 'ASSISTANT', content: aiPayload.reply },
    }),
    prisma.extractedDiagnosticData.update({
      where: { sessionId },
      data: {
        make: mergedExtracted.make ?? null,
        model: mergedExtracted.model ?? null,
        year: mergedExtracted.year ?? null,
        mileage: mergedExtracted.mileage ?? null,
        symptoms: mergedExtracted.symptoms ?? null,
        problemConditions: mergedExtracted.problemConditions ?? null,
      },
    }),
    prisma.diagnosticRecommendation.deleteMany({ where: { sessionId } }),
    ...aiPayload.recommendations.map((r) =>
      prisma.diagnosticRecommendation.create({
        data: {
          sessionId,
          title: r.title,
          probabilityPercent: r.probabilityPercent,
        },
      }),
    ),
    prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        status: complete ? 'COMPLETED' : 'IN_PROGRESS',
        progressPercent: Math.min(100, progressPercent),
        confidencePercent: aiPayload.confidencePercent,
        costFromMinor:
          aiPayload.costFromMinor != null && Number.isFinite(aiPayload.costFromMinor)
            ? Math.round(aiPayload.costFromMinor)
            : null,
        preliminaryNote: aiPayload.preliminaryNote,
      },
    }),
  ]);

  return getSessionDetail(sessionId, actor);
}

export async function saveReport(sessionId, userId, { label } = {}) {
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      extracted: true,
      recommendations: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 80 },
    },
  });
  if (!session) throw new AppError(404, 'Session not found', 'NOT_FOUND');
  if (session.clientId !== userId) throw new AppError(403, 'Forbidden', 'FORBIDDEN');

  const ext = session.extracted;
  if (!isExtractedComplete(ext) && session.status !== 'COMPLETED') {
    throw new AppError(400, 'Complete consultation before saving report', 'INCOMPLETE');
  }

  const snapshotJson = {
    sessionId: session.id,
    status: session.status,
    progressPercent: session.progressPercent,
    confidencePercent: session.confidencePercent,
    costFromMinor: session.costFromMinor,
    preliminaryNote: session.preliminaryNote,
    extracted: ext,
    recommendations: session.recommendations,
    messages: session.messages.map((m) => ({
      sender: m.sender,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    savedAt: new Date().toISOString(),
  };

  return prisma.consultationReport.create({
    data: {
      userId,
      consultationSessionId: sessionId,
      snapshotJson,
      label: label ? String(label).slice(0, 200) : null,
    },
  });
}

export async function listMyReports(userId) {
  return prisma.consultationReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
