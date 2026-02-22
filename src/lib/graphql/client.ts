/**
 * GraphQL Client - Hasura Integration
 *
 * Authenticated GraphQL client using graphql-request.
 * Gets JWT from Better Auth for Hasura authorization.
 */

import { GraphQLClient } from 'graphql-request';
import { authClient } from '@/lib/auth-client';

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_URL || 'http://localhost:8080/v1/graphql';

/**
 * Get a JWT token from Better Auth session
 * Returns null if not authenticated
 */
export async function getJwtToken(): Promise<string | null> {
  try {
    const { data, error } = await authClient.token();
    if (error || !data?.token) {
      return null;
    }
    return data.token;
  } catch {
    return null;
  }
}

/**
 * Create an authenticated GraphQL client for Hasura
 * Returns null if no JWT token available
 */
export async function getAuthenticatedClient(): Promise<GraphQLClient | null> {
  const token = await getJwtToken();
  if (!token) {
    console.warn('[GraphQL] No JWT token available, skipping sync');
    return null;
  }

  return new GraphQLClient(HASURA_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
