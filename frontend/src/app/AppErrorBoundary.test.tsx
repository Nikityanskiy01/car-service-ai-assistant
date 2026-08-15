import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppErrorBoundary } from './AppErrorBoundary';

function Boom(): ReactNode {
  throw new Error('boom');
}

describe('AppErrorBoundary', () => {
  it('renders recovery UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /не смог отрисоваться/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});
