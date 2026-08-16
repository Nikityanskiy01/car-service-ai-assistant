import { describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, useOutletContext } from 'react-router-dom';
import {
  bindDashboardChrome,
  DashboardContext,
  useDashboardContext,
  type DashboardContextValue,
} from './dashboardContext';

describe('useDashboardContext', () => {
  it('does not throw without a provider and still forwards badges after bind', () => {
    const received: Record<string, number>[] = [];
    const unbind = bindDashboardChrome({
      setPageTitle: () => {},
      setBadges: (badges: Record<string, number>) => {
        received.push(badges);
      },
      openManagerHelp: () => {},
    });

    const { result } = renderHook(() => useDashboardContext());
    expect(() => {
      const { setBadges } = result.current;
      setBadges({ requests: 3 });
    }).not.toThrow();
    expect(received).toEqual([{ requests: 3 }]);
    unbind();
  });

  it('survives a nested Outlet that wipes react-router outlet context', () => {
    const setBadges = vi.fn();
    const value: DashboardContextValue = { setPageTitle: () => {}, setBadges, openManagerHelp: () => {} };

    function Shell() {
      bindDashboardChrome(value);
      return (
        <DashboardContext.Provider value={value}>
          <Outlet context={value} />
        </DashboardContext.Provider>
      );
    }

    function RoleGuard() {
      return <Outlet />;
    }

    function WorkDesk() {
      const { setBadges: updateBadges } = useDashboardContext();
      updateBadges({ requests: 2 });
      return <div>work-desk</div>;
    }

    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Shell />,
          children: [{ element: <RoleGuard />, children: [{ index: true, element: <WorkDesk /> }] }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    expect(screen.getByText('work-desk')).toBeInTheDocument();
    expect(setBadges).toHaveBeenCalledWith({ requests: 2 });
  });

  it('forwards outlet context through a role-guard Outlet', () => {
    const setBadges = vi.fn();
    const value: DashboardContextValue = { setPageTitle: () => {}, setBadges, openManagerHelp: () => {} };

    function Shell() {
      return (
        <DashboardContext.Provider value={value}>
          <Outlet context={value} />
        </DashboardContext.Provider>
      );
    }

    function RoleGuard() {
      const ctx = useOutletContext<DashboardContextValue | undefined>();
      return <Outlet context={ctx} />;
    }

    function WorkDesk() {
      const { setBadges: updateBadges } = useDashboardContext();
      updateBadges({ contacts: 1 });
      return <div>desk-ok</div>;
    }

    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <Shell />,
          children: [{ element: <RoleGuard />, children: [{ index: true, element: <WorkDesk /> }] }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);
    expect(screen.getByText('desk-ok')).toBeInTheDocument();
    expect(setBadges).toHaveBeenCalledWith({ contacts: 1 });
  });
});
