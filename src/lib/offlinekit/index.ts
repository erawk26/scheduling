import { createApp } from '@erawk26/localkit';
import { collections, type Collections } from './schema';

const syncEndpoint = process.env.NEXT_PUBLIC_OFFLINEKIT_SYNC_ENDPOINT || 'http://localhost:8787/sync';
const authBaseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const app = createApp<Collections>({
  collections,
  sync: {
    endpoint: syncEndpoint,
  },
  auth: {
    type: 'better-auth',
    baseURL: authBaseURL,
  },
});
