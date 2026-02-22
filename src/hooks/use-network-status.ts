'use client';

import { useState, useEffect, useCallback } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [since, setSince] = useState<Date | null>(null);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setSince(new Date());
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setSince(new Date());
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, since };
}
