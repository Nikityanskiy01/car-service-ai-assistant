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

export async function updateCategory(id, { name, description }) {
  const row = await prisma.serviceCategory.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Category not found', 'NOT_FOUND');
  const slug = name != null ? slugify(name) || row.slug : row.slug;
  return prisma.serviceCategory.update({
    where: { id },
    data: {
      ...(name != null ? { name, slug } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
    },
  });
}

export async function deleteCategory(id) {
  try {
    await prisma.serviceCategory.delete({ where: { id } });
  } catch {
    throw new AppError(409, 'Category in use or not found', 'CONFLICT');
  }
}

export async function updateScenario(id, { title, description, active }) {
  const row = await prisma.consultationScenario.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Scenario not found', 'NOT_FOUND');
  return prisma.consultationScenario.update({
    where: { id },
    data: {
      ...(title != null ? { title } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(active != null ? { active } : {}),
    },
  });
}

export async function deleteScenario(id) {
  await prisma.consultationScenario.delete({ where: { id } });
}

export async function updateQuestion(id, { text, order }) {
  const row = await prisma.consultationQuestion.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Question not found', 'NOT_FOUND');
  return prisma.consultationQuestion.update({
    where: { id },
    data: {
      ...(text != null ? { text } : {}),
      ...(order != null ? { order } : {}),
    },
  });
}

export async function deleteQuestion(id) {
  await prisma.consultationQuestion.delete({ where: { id } });
}

export async function updateHint(id, { text, order, scenarioId }) {
  const row = await prisma.hint.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Hint not found', 'NOT_FOUND');
  return prisma.hint.update({
    where: { id },
    data: {
      ...(text != null ? { text } : {}),
      ...(order != null ? { order } : {}),
      ...(scenarioId !== undefined ? { scenarioId: scenarioId || null } : {}),
    },
  });
}

export async function deleteHint(id) {
  await prisma.hint.delete({ where: { id } });
}

export async function updateReferenceMaterial(id, { title, body, categoryId }) {
  const row = await prisma.referenceMaterial.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'Material not found', 'NOT_FOUND');
  return prisma.referenceMaterial.update({
    where: { id },
    data: {
      ...(title != null ? { title } : {}),
      ...(body != null ? { body } : {}),
      ...(categoryId !== undefined ? { categoryId: categoryId || null } : {}),
    },
  });
}

export async function deleteReferenceMaterial(id) {
  await prisma.referenceMaterial.delete({ where: { id } });
}

/** Активные сценарии с вопросами/подсказками для клиентской консультации (FR-018, smoke T041). */
export async function listActiveTemplatesForClient() {
  return prisma.consultationScenario.findMany({
    where: { active: true },
    orderBy: { title: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      questions: {
        orderBy: { order: 'asc' },
        select: { id: true, text: true, order: true },
      },
      hints: {
        orderBy: { order: 'asc' },
        select: { id: true, text: true, order: true },
      },
    },
  });
}
