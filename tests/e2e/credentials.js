function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required for e2e (same env vars as prisma seed)`);
  }
  return value;
}

export const e2eUsers = {
  client: {
    email: process.env.DEMO_CLIENT_EMAIL || 'client@example.local',
    password: requiredEnv('DEMO_CLIENT_PASSWORD'),
  },
  manager: {
    email: process.env.DEMO_MANAGER_EMAIL || 'manager@example.local',
    password: requiredEnv('DEMO_MANAGER_PASSWORD'),
  },
  admin: {
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@example.local',
    password: requiredEnv('DEMO_ADMIN_PASSWORD'),
  },
};

/** Скрыть первый тур кабинета, чтобы e2e видели рабочий стол, а не оверлей. */
export async function skipManagerOnboarding(page) {
  await page.addInitScript(() => {
    localStorage.setItem('car_service_manager_onboarding_done', '1');
  });
}
