import {
  createApp,
  encrypted,
  IndexedDBAdapter,
  MemoryAdapter,
} from '@erawk26/localkit';
import type { StorageAdapter, Doc, Filter, Change } from '@erawk26/localkit';
import { collections, type Collections } from './schema';

const syncEndpoint = process.env.NEXT_PUBLIC_OFFLINEKIT_SYNC_ENDPOINT || 'http://localhost:8787';
const authBaseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3025';

const ENC_KEY_STORAGE = 'ke-agenda-enc-key';

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(ENC_KEY_STORAGE);
  if (stored) {
    const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  const encoded = btoa(
    String.fromCharCode(...new Uint8Array(exported as ArrayBuffer)),
  );
  localStorage.setItem(ENC_KEY_STORAGE, encoded);
  return key;
}

/**
 * Wraps IndexedDBAdapter with AES-GCM 256-bit encryption via localkit's
 * encrypted() function. Initialisation is deferred so createApp() can remain
 * synchronous while encryption is set up asynchronously on first use.
 *
 * Falls back to MemoryAdapter in SSR contexts where IndexedDB / Web Crypto
 * are unavailable.
 */
class LazyEncryptedAdapter implements StorageAdapter {
  private readonly ready: Promise<StorageAdapter>;

  constructor() {
    this.ready = this.init();
  }

  private async init(): Promise<StorageAdapter> {
    if (typeof window === 'undefined') {
      return new MemoryAdapter();
    }
    const key = await getOrCreateEncryptionKey();
    const inner = new IndexedDBAdapter('ke-agenda');
    return encrypted(inner, { key });
  }

  async get(collection: string, id: string): Promise<Doc | null> {
    return (await this.ready).get(collection, id);
  }

  async getRaw(collection: string, id: string): Promise<Doc | null> {
    const adapter = await this.ready;
    return adapter.getRaw?.(collection, id) ?? adapter.get(collection, id);
  }

  async getMany(collection: string, filter?: Filter): Promise<Doc[]> {
    return (await this.ready).getMany(collection, filter);
  }

  async put(collection: string, id: string, doc: Doc): Promise<void> {
    return (await this.ready).put(collection, id, doc);
  }

  async delete(collection: string, id: string): Promise<void> {
    return (await this.ready).delete(collection, id);
  }

  async getChangesSince(timestamp: number): Promise<Change[]> {
    return (await this.ready).getChangesSince(timestamp);
  }
}

export const app = createApp<Collections>({
  collections,
  storage: new LazyEncryptedAdapter(),
  sync: {
    endpoint: syncEndpoint,
  },
  auth: {
    type: 'better-auth',
    baseURL: authBaseURL,
  },
});
