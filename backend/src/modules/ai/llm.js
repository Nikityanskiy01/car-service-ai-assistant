import { getEnv } from '../../config/env.js';
import { progressFromExtracted } from '../../lib/consultationProgress.js';
import { AppError } from '../../lib/errors.js';
import { pickPlaybook, playbookToAiHints } from '../../lib/diagnosticPlaybooks.js';
import { topWorksForCategory, topWorksForCategoryAndMake } from '../../lib/workStats.js';
import { normalizeLlmPayload, parseLlmJson } from './parseResponse.js';

const MOCK_SEQUENCE = [
  ['make', 'Toyota'],
  ['model', 'Camry'],
  ['year', 2018],
  ['mileage', 120000],
  ['symptoms', 'Стук с передней оси при разгоне'],
  ['problemConditions', 'Проявляется на холодную, первые 5–10 минут'],
];

/**
 * @param {import('@prisma/client').ConsultationSession & { extracted: import('@prisma/client').ExtractedDiagnosticData | null }} session
 * @param {string} userContent
 */
export function mockLlmTurn(session, userContent) {
  if (String(userContent).trim() === '__SESSION_START__') {
    return {
      reply:
        'Здравствуйте! Чтобы подсказать вероятную причину и порядок действий, мне нужны данные о машине и симптомах. Расскажите, пожалуйста: марку и модель, год выпуска, пробег, что именно беспокоит и при каких условиях это проявляется (холодный/прогретый мотор, скорость, дорога и т.д.). Можно одним сообщением или по шагам — я уточню вопросы по ходу.',
      extracted: {
        make: null,
        model: null,
        year: null,
        mileage: null,
        symptoms: null,
        problemConditions: null,
      },
      recommendations: [],
      progressPercent: 0,
      confidencePercent: null,
      costFromMinor: null,
      preliminaryNote:
        'Ответ носит информационный характер и не заменяет осмотр автомобиля в сервисе.',
    };
  }

  const ext = session.extracted || {};
  for (const [key, val] of MOCK_SEQUENCE) {
    const filled =
      key === 'year' || key === 'mileage'
        ? ext[key] != null && Number.isFinite(ext[key])
        : typeof ext[key] === 'string' && ext[key].trim().length > 0;
    if (!filled) {
      const merged = { ...ext, [key]: val };
      return {
        reply:
          `Зафиксировал данные (${key}). ` +
          (userContent ? 'Если что-то неверно — напишите уточнение.' : 'Опишите симптомы подробнее.'),
        extracted: merged,
        recommendations: [
          { title: 'Подвеска / сайлентблоки', probabilityPercent: 35 },
          { title: 'Приводной вал', probabilityPercent: 20 },
        ],
        progressPercent: progressFromExtracted(merged),
        confidencePercent: 45,
        costFromMinor: 8000,
        preliminaryNote:
          'Результат предварительный и не заменяет осмотр на подъёмнике. Точная стоимость после диагностики.',
      };
    }
  }
  return {
    reply:
      'Все обязательные параметры собраны. Вы можете сохранить отчёт и оформить заявку в сервис.',
    extracted: ext,
    recommendations: [{ title: 'Диагностика ходовой части', probabilityPercent: 55 }],
    progressPercent: 100,
    confidencePercent: 72,
    costFromMinor: 12000,
    preliminaryNote:
      'Результат предварительный и не заменяет осмотр на подъёмнике. Точная стоимость после диагностики.',
  };
}

/**
 * @param {Array<{ role: string, content: string }>} messages
 */
async function realLlmTurn(messages) {
  const env = getEnv();
  const url = `${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: env.LLM_MODEL,
    messages: [
      {
        role: 'system',
        content: `Ты помощник автосервиса.
КРИТИЧЕСКИ ВАЖНО:
- Отвечай ТОЛЬКО валидным JSON (без пояснений, без markdown, без тройных кавычек).
- Пиши ТОЛЬКО НА РУССКОМ языке. Не используй английские слова/фразы. Латиница допустима только внутри марки/модели авто (например "BMW X5") и обозначений вроде "ABS", если это часть термина.
- Не здоровайся повторно и не начинай "заново", если консультация уже идёт.

Формат ответа строго такой:
{
  "reply": "текст пользователю",
  "extracted": { "make": "", "model": "", "year": null, "mileage": null, "symptoms": "", "problemConditions": "" },
  "recommendations": [{ "title": "", "probabilityPercent": 0 }],
  "progressPercent": 0,
  "confidencePercent": null,
  "costFromMinor": null,
  "preliminaryNote": null
}
Правила поведения:
- Если последнее сообщение пользователя ровно "__SESSION_START__": это начало консультации. В reply поздоровайся и коротко попроси марку, модель, год, пробег, симптомы и условия проявления. extracted оставь пустым (null/"").
- Иначе: извлекай/уточняй данные. Если какого-то обязательного поля не хватает — задай 1–3 уточняющих вопроса ровно по отсутствующим полям.
- Если все поля уже заполнены (или пользователь дал их в последнем сообщении) — НЕ задавай новых вопросов. Дай короткий итог и что делать дальше (сохранить отчёт / оформить заявку).
- Делай ответ полезным: в финале (когда все поля есть) дай 3–5 гипотез с кратким объяснением + 3–6 проверок/действий (что можно проверить до сервиса и что проверять в сервисе).
- Не придумывай факты (например, конкретные ошибки OBD) без данных. Если есть "Check Engine" — предложи компьютерную диагностику.
- Если пользователь не описал проблему/симптомы (symptoms пустое) — не делай гипотез и не давай "вероятные причины": сначала попроси описать, что именно происходит.
- В extracted заполняй ТОЛЬКО то, что прямо присутствует в сообщениях пользователя. Нельзя угадывать год, пробег, симптомы или условия по названию автомобиля.

Примеры (сохраняй формат JSON):
1) Пользователь: "__SESSION_START__"
Ответ: {"reply":"Здравствуйте! Напишите, пожалуйста: марку и модель, год выпуска, пробег, что беспокоит и при каких условиях это проявляется.","extracted":{"make":null,"model":null,"year":null,"mileage":null,"symptoms":null,"problemConditions":null},"recommendations":[],"progressPercent":0,"confidencePercent":null,"costFromMinor":null,"preliminaryNote":"Ответ носит информационный характер и не заменяет осмотр автомобиля в сервисе."}
2) Пользователь: "Toyota Camry 2018, 120000. Стук спереди при разгоне, на холодную 5–10 минут."
Ответ: {"reply":"Данные принял. Предварительно похоже на проблему в узлах подвески/приводов. Рекомендую: 1) визуально осмотреть пыльники ШРУСов, 2) проверить люфты шаровых/сайлентблоков, 3) сделать диагностику на подъёмнике. Хотите сохранить отчёт и оформить заявку в сервис?","extracted":{"make":"Toyota","model":"Camry","year":2018,"mileage":120000,"symptoms":"Стук спереди при разгоне","problemConditions":"На холодную 5–10 минут"},"recommendations":[{"title":"Диагностика ходовой части/приводов","probabilityPercent":60},{"title":"Проверка ШРУСов/пыльников","probabilityPercent":45},{"title":"Проверка опор двигателя/КПП","probabilityPercent":25}],"progressPercent":100,"confidencePercent":70,"costFromMinor":null,"preliminaryNote":"Результат предварительный и не заменяет осмотр автомобиля в сервисе."}
`,
      },
      ...messages,
    ],
    temperature: 0.3,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new AppError(503, `LLM unavailable: ${res.status} ${t.slice(0, 200)}`, 'LLM_ERROR');
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(503, 'LLM returned empty content', 'LLM_ERROR');
  }
  try {
    const raw = parseLlmJson(content);
    return normalizeLlmPayload(raw);
  } catch (e) {
    throw new AppError(503, `LLM JSON parse error: ${e.message}`, 'LLM_ERROR');
  }
}

/**
 * @param {import('@prisma/client').ConsultationSession & { extracted: import('@prisma/client').ExtractedDiagnosticData | null, messages: import('@prisma/client').Message[] }} session
 * @param {string} userContent
 */
export async function runLlmTurn(session, userContent) {
  const env = getEnv();
  if (env.LLM_MOCK) {
    return mockLlmTurn(session, userContent);
  }

  const extracted = session.extracted || {};
  const pb = pickPlaybook(extracted, userContent);
  const pbHints = playbookToAiHints(pb);
  const topWorks =
    pbHints?.categoryId && extracted?.make
      ? topWorksForCategoryAndMake(pbHints.categoryId, extracted.make, 10)
      : pbHints?.categoryId
        ? topWorksForCategory(pbHints.categoryId, 10)
        : [];
  const stateMsg = {
    role: 'system',
    content: `Текущее состояние консультации (истина; не спорь и не переспрашивай то, что уже заполнено):
${JSON.stringify(
  {
    extracted: {
      make: extracted.make ?? null,
      model: extracted.model ?? null,
      year: extracted.year ?? null,
      mileage: extracted.mileage ?? null,
      symptoms: extracted.symptoms ?? null,
      problemConditions: extracted.problemConditions ?? null,
    },
    playbook: pbHints,
    serviceStats: topWorks.length
      ? {
          note: 'Частые работы по статистике автосервиса (по категории). Используй как подсказку, но не выдавай как 100% факт.',
          topWorks,
        }
      : null,
  },
  null,
  2,
)}

Если playbook присутствует:
- Используй его как основу: гипотезы и проверки должны соответствовать плейбуку.
- В recommendations укажи 3–5 гипотез из playbook.hypotheses (с вероятностями, сумма не обязана быть 100).
- В reply перечисли 3–6 проверок из playbook.checks (кратко, по делу).

Ориентиры по ценам (в рублях, минимум):
- Комплексная диагностика: от 3500
- Компьютерная диагностика/ошибки двигателя (Check Engine): от 2500
- Диагностика подвески/стука: от 3000
- Диагностика тормозов/вибраций: от 2800
- Диагностика течей/охлаждения: от 3200
Если данных не хватает — НЕ выдумывай точные суммы: ставь costFromMinor=null.`,
  };

  const history = session.messages.map((m) => ({
    role: m.sender === 'USER' ? 'user' : m.sender === 'ASSISTANT' ? 'assistant' : 'system',
    content: m.content,
  }));
  history.push(stateMsg);
  history.push({ role: 'user', content: userContent });

  try {
    return await realLlmTurn(history);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(503, 'LLM unavailable', 'LLM_ERROR');
  }
}
