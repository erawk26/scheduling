import { vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// Import the test double
import { app as testApp, resetAll } from '@/test/localkit-double';

// Mock the entire localkit module to use the test double
vi.mock('@/lib/offlinekit', () => ({
  app: testApp,
}));

// Mock @erawk26/localkit/react's useCollection to read from the test double
vi.mock('@erawk26/localkit/react', () => {
  return {
    useCollection: vi.fn().mockImplementation((collection: any) => {
      // The test double collections have _raw() that returns all docs (including deleted)
      const data = collection._raw().filter((d: any) => !d._deleted);
      return {
        data,
        isLoading: false,
        error: null,
      };
    }),
  };
});

// Mock geocode to avoid network calls
vi.mock('@/lib/graphhopper/geocode', () => ({
  geocodeAddress: vi.fn().mockResolvedValue({ lat: 40.7128, lon: -74.006 }),
}));

export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
