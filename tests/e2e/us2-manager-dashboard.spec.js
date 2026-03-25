import { test, expect } from '@playwright/test';

const jsonHeader = { 'Content-Type': 'application/json' };

async function ensureManager(request) {
  const login = await request.post('/api/auth/login', {
    headers: jsonHeader,
    data: { email: 'manager@fox.local', password: 'Admin12345!' },
  });
  return login.status() === 200;
}

/** Полный цикл заявки через API (LLM_MOCK на сервере). */
async function createServiceRequestViaApi(request) {
  const email = `e2e_mgr_${Date.now()}@t.test`;
  const reg = await request.post('/api/auth/register', {
    headers: jsonHeader,
    data: {
      email,
      password: 'password123',
      fullName: 'E2E Client',
      phone: '+79990001122',
    },
  });
  if (!reg.ok()) throw new Error(`register ${reg.status()}`);
  const { accessToken } = await reg.json();

  const sRes = await request.post('/api/consultations', {
    headers: { Authorization: `Bearer ${accessToken}`, ...jsonHeader },
    data: {},
  });
  const { id: sid } = await sRes.json();

  for (let i = 0; i < 6; i++) {
    const m = await request.post(`/api/consultations/${sid}/messages`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: { content: `Шаг ${i}` },
    });
    if (!m.ok()) throw new Error(`message ${m.status()} ${await m.text()}`);
  }

  const srRes = await request.post(`/api/consultations/${sid}/service-request`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...jsonHeader },
    data: {},
  });
  if (!srRes.ok()) throw new Error(`service-request ${srRes.status()}`);
  const sr = await srRes.json();
  return sr.id;
}

test.describe('US2 manager dashboard', () => {
  test('login and see requests table', async ({ page, request }) => {
    if (!(await ensureManager(request))) {
      test.skip(true, 'Run backend with seed: manager@fox.local / Admin12345!');
    }

    await page.goto('/login.html');
    await page.fill('input[name="email"]', 'manager@fox.local');
    await page.fill('input[name="password"]', 'Admin12345!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboards\/manager/);
    await expect(page.locator('#mgrTable')).toBeVisible();
  });

  test('open request, change status, send follow-up (T034)', async ({ page, request }) => {
    if (!(await ensureManager(request))) {
      test.skip(true, 'Run backend with seed: manager@fox.local / Admin12345!');
    }

    const requestId = await createServiceRequestViaApi(request);

    page.on('dialog', (d) => d.accept());

    await page.goto('/login.html');
    await page.fill('input[name="email"]', 'manager@fox.local');
    await page.fill('input[name="password"]', 'Admin12345!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboards\/manager/);

    await page.waitForSelector(`tr[data-id="${requestId}"]`, { timeout: 30_000 });
    await page.locator(`tr[data-id="${requestId}"]`).click();

    await expect(page.locator('#statusSelect')).toBeVisible({ timeout: 15_000 });
    await page.selectOption('#statusSelect', 'IN_PROGRESS');
    await page.locator('#saveStatus').click();
    await page.waitForTimeout(600);

    await page.fill('#mgrThreadInput', 'Сообщение менеджера из E2E');
    await page.locator('#mgrThreadForm button[type="submit"]').click();
    await expect(page.locator('#mgrThread')).toContainText('Сообщение менеджера из E2E', {
      timeout: 15_000,
    });
  });
});
