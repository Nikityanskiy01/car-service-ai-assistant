import { useOutletContext } from 'react-router-dom';
import type { DashboardOutletContext } from './DashboardShell';

export function useDashboardContext() {
  return useOutletContext<DashboardOutletContext>();
}
