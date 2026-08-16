import { trackProductEvent } from './productEvents';

function report(name: string, value: number) {
  if (!Number.isFinite(value)) return;
  trackProductEvent('rum_web_vital', { name, value: Math.round(value) });
}

export function startRum() {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const lcp = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) report('LCP', last.startTime);
    });
    lcp.observe({ type: 'largest-contentful-paint', buffered: true });

    const cls = new PerformanceObserver((list) => {
      let score = 0;
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) score += Number(entry.value || 0);
      }
      if (score) report('CLS', score * 1000);
    });
    cls.observe({ type: 'layout-shift', buffered: true });

    const inp = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as (PerformanceEntry & { duration?: number }) | undefined;
      if (last?.duration) report('INP', last.duration);
    });
    inp.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch {
    /* Safari older */
  }
}
