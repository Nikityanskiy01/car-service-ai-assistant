import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

describe('404 page', () => {
  it('renders not found UI', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('Ошибка 404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /нет такой страницы/i })).toBeInTheDocument();
  });
});
