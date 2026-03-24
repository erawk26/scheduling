/**
 * Environment Variable Validation
 *
 * Validates required environment variables at app startup.
 * Fails fast with clear error messages if critical vars are missing.
 */

const required = [
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
] as const;

const requiredPublic = [
  'NEXT_PUBLIC_APP_URL',
] as const;

const optional = [
  'TOMORROW_IO_API_KEY',
  'GRAPHHOPPER_API_KEY',
  'NEXT_PUBLIC_OFFLINEKIT_SYNC_ENDPOINT',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_CLIENT_ID',
  'APPLE_CLIENT_SECRET',
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  for (const key of requiredPublic) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nCopy .env.example to .env.local and fill in the required values.`
    );
  }
}

export function getEnv() {
  return {
    betterAuthSecret: process.env.BETTER_AUTH_SECRET!,
    betterAuthUrl: process.env.BETTER_AUTH_URL!,
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
    tomorrowIoApiKey: process.env.TOMORROW_IO_API_KEY,
    graphhopperApiKey: process.env.GRAPHHOPPER_API_KEY,
    syncEndpoint: process.env.NEXT_PUBLIC_OFFLINEKIT_SYNC_ENDPOINT,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
  };
}

// Satisfy TypeScript: optional is referenced to avoid unused variable warning
void optional;
