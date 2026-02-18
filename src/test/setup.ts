/**
 * Vitest Test Setup
 *
 * Global test configuration and setup
 */

import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.BETTER_AUTH_URL = 'http://localhost:3000'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.APPLE_CLIENT_ID = 'test-apple-client-id'
process.env.APPLE_CLIENT_SECRET = 'test-apple-client-secret'
