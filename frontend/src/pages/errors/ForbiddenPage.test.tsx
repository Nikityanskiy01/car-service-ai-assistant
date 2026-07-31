import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForbiddenPage } from './ForbiddenPage';

describe('403 page', () => {
  it('renders forbidden UI', () => {
    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Ошибка 403')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /путь закрыт/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /на главную/i })).toBeInTheDocument();
  });
});
