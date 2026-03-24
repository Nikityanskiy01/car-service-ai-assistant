import prisma from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80);
}

export async function listCategories() {
  return prisma.serviceCategory.findMany({ orderBy: { name: 'asc' } });
}

export async function createCategory({ name, description }) {
  const slug = slugify(name) || `cat-${Date.now()}`;
  return prisma.serviceCategory.create({
    data: { name, slug, description: description || null },
  });
}

export async function listScenarios() {
  return prisma.consultationScenario.findMany({
    orderBy: { title: 'asc' },
    include: { questions: true, hints: true },
  });
}

export async function createScenario({ title, description }) {
  return prisma.consultationScenario.create({
    data: { title, description: description || null },
  });
}

export async function listQuestions(scenarioId) {
  return prisma.consultationQuestion.findMany({
    where: { scenarioId },
    orderBy: { order: 'asc' },
  });
}

export async function createQuestion(scenarioId, { text, order }) {
  const sc = await prisma.consultationScenario.findUnique({ where: { id: scenarioId } });
  if (!sc) throw new AppError(404, 'Scenario not found', 'NOT_FOUND');
  return prisma.consultationQuestion.create({
    data: { scenarioId, text, order: order ?? 0 },
  });
}

export async function listHints(scenarioId) {
  return prisma.hint.findMany({
    where: { scenarioId },
    orderBy: { order: 'asc' },
  });
}

export async function createHint(scenarioId, { text, order }) {
  return prisma.hint.create({
    data: { scenarioId: scenarioId || null, text, order: order ?? 0 },
  });
}

export async function listReferenceMaterials() {
  return prisma.referenceMaterial.findMany({
    orderBy: { title: 'asc' },
    include: { category: true },
  });
}

export async function createReferenceMaterial({ title, body, categoryId }) {
  return prisma.referenceMaterial.create({
    data: {
      title,
      body,
      categoryId: categoryId || null,
    },
  });
}
