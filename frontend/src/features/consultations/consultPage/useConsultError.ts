import { useRef, useState } from 'react';

export function useConsultError() {
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  function setErrorWithRetry(msg: string, retry?: () => void) {
    setError(msg);
    retryRef.current = retry ?? null;
  }

  function clearError() {
    setError(null);
    retryRef.current = null;
  }

  function handleRetry(fallback: () => void) {
    clearError();
    if (retryRef.current) {
      retryRef.current();
      return;
    }
    fallback();
  }

  return { error, setErrorWithRetry, clearError, handleRetry };
}
