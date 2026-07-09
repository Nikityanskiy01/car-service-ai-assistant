import { expect, test } from '@playwright/test';

test('consultation request is not aborted on rerender', async ({ page }) => {
  await page.goto('/consult');

  const startButton = page.getByRole('button', { name: /Начать новую сессию|Начать консультацию/i });
  await expect(startButton.first()).toBeVisible();
  await startButton.first().click();

  const input = page.getByPlaceholder('Опишите симптомы или ответьте на уточняющий вопрос');
  await expect(input).toBeVisible();
  await input.fill('Вибрация при торможении на скорости');
  await page.getByRole('button', { name: 'Отправить' }).click();

  await expect(page.getByText('Превышено время ожидания ответа ИИ. Попробуйте повторить отправку.')).toHaveCount(0);
  await expect(
    page.getByText('Не удалось получить ответ интеллектуального ассистента вовремя. Введённые данные сохранены.'),
  ).toHaveCount(0);
  await expect(page.getByText('Уточните, пожалуйста, марку автомобиля.')).toBeVisible({ timeout: 15_000 });
});

