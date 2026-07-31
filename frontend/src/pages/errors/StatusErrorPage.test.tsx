import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatusErrorPage } from './StatusErrorPage';
import { STATUS_ERROR_CODES } from './statusErrorCatalog';

describe('status error pages', () => {
  it.each(STATUS_ERROR_CODES)('renders status %s', (code) => {
    render(
      <MemoryRouter>
        <StatusErrorPage code={code} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(`Ошибка ${code}`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
