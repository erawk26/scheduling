import { useMemo } from 'react';
import { useCollection } from '@erawk26/localkit/react';
import { app } from '@/lib/offlinekit';

export function useBusinessLocation() {
  const { data, isLoading } = useCollection(app.businessProfile);

  const location = useMemo(() => {
    if (!data) return { lat: null, lon: null };
    const profile = data.find((p) => !p._deleted);
    return {
      lat: profile?.business_latitude ?? null,
      lon: profile?.business_longitude ?? null,
    };
  }, [data]);

  return { data: location, isLoading };
}
