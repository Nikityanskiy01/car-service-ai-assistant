import { GenericRestAdapter } from './adapters/genericRest.adapter.js';

const genericRest = new GenericRestAdapter();

/**
 * @param {string} provider
 */
export function getAdapter(provider) {
  switch (String(provider || '').toUpperCase()) {
    case 'GENERIC_REST':
      return genericRest;
    default:
      return null;
  }
}

export function listRegisteredProviders() {
  return ['GENERIC_REST'];
}
