import { useEffect, useRef } from 'react';

/**
 * Периодическое фоновое обновление данных кабинета.
 *
 * Колбэк держим в ref: иначе каждый ререндер пересоздаёт интервал, и на живой
 * странице обновление может не наступить никогда. Пока вкладка скрыта, запросы
 * не идут, а при возврате данные подтягиваются сразу.
 */
export function useDashboardPolling(callback: () => void | Promise<void>, intervalMs = 60_000) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (intervalMs <= 0) return;

    let timer = 0;

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    }

    function start() {
      stop();
      timer = window.setInterval(() => {
        void savedCallback.current();
      }, intervalMs);
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void savedCallback.current();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);
}
