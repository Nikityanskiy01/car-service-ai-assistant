import { I18nProvider } from './I18nProvider';
import { render, screen } from '@testing-library/react';
import { translate } from './messages';

test('ru and en dictionaries share keys', () => {
  expect(translate('en', 'navHome')).toBe('Home');
  expect(translate('ru', 'navHome')).toBe('Главная');
});

test('provider renders children', () => {
  render(
    <I18nProvider>
      <span>ok</span>
    </I18nProvider>,
  );
  expect(screen.getByText('ok')).toBeInTheDocument();
});
