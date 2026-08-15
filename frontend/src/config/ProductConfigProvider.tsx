/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPublicSiteSettings } from '../api/adminSite';
import { productConfig, type ProductConfig } from './productConfig';

type ProductConfigContextValue = {
  config: ProductConfig;
  ready: boolean;
  refresh: () => Promise<void>;
};

const ProductConfigContext = createContext<ProductConfigContextValue>({
  config: productConfig,
  ready: false,
  refresh: async () => {},
});

function mergeConfig(remote: Partial<ProductConfig>): ProductConfig {
  return {
    ...productConfig,
    ...remote,
    theme: { ...productConfig.theme, ...(remote.theme || {}) },
    legal: { ...productConfig.legal, ...(remote.legal || {}) },
  };
}

export function ProductConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ProductConfig>(productConfig);
  const [ready, setReady] = useState(false);

  async function refresh() {
    try {
      const { updatedAt, ...rest } = await getPublicSiteSettings();
      void updatedAt;
      setConfig(mergeConfig(rest));
    } catch {
      setConfig(productConfig);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(() => ({ config, ready, refresh }), [config, ready]);

  return <ProductConfigContext.Provider value={value}>{children}</ProductConfigContext.Provider>;
}

export function useProductConfig(): ProductConfig {
  return useContext(ProductConfigContext).config;
}

export function useProductConfigState() {
  return useContext(ProductConfigContext);
}
