import { api } from '../../api/client';
import { useAsyncState } from '../../hooks/useAsyncState';
import { fallbackServices } from './data';
import type { ServiceItem } from './types';

export function useServices() {
  const state = useAsyncState<ServiceItem[]>(() => api('/content/site-items?kind=service'));
  const services = state.data?.length ? state.data : fallbackServices;

  return {
    ...state,
    services,
    count: services.length,
    fromApi: Boolean(state.data?.length),
  };
}
