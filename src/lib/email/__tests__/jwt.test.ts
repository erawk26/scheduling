// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateBookingToken, verifyBookingToken } from '../jwt';
import type { BookingTokenPayload } from '../jwt';

const TEST_SECRET = 'test-secret-key-that-is-long-enough-for-hs256';

const samplePayload: BookingTokenPayload = {
  appointmentId: 'apt-123',
  clientId: 'client-456',
  clientName: 'Jane Smith',
  serviceName: 'Full Groom',
  businessName: 'Pawsome Groomers',
  slots: [
    { label: 'Monday 9am', value: '2026-04-06T09:00:00' },
    { label: 'Tuesday 2pm', value: '2026-04-07T14:00:00' },
  ],
  deadline: '2026-04-05T23:59:59',
};

describe('generateBookingToken', () => {
  beforeEach(() => {
    process.env.BOOKING_JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.BOOKING_JWT_SECRET;
  });

  it('generates a JWT string (three dot-separated parts)', async () => {
    const token = await generateBookingToken(samplePayload);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('uses HS256 algorithm in the header', async () => {
    const token = await generateBookingToken(samplePayload);
    const header = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'));
    expect(header.alg).toBe('HS256');
  });

  it('includes all payload fields', async () => {
    const token = await generateBookingToken(samplePayload);
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
    expect(payload.appointmentId).toBe('apt-123');
    expect(payload.clientId).toBe('client-456');
    expect(payload.clientName).toBe('Jane Smith');
    expect(payload.serviceName).toBe('Full Groom');
    expect(payload.businessName).toBe('Pawsome Groomers');
    expect(payload.slots).toHaveLength(2);
    expect(payload.deadline).toBe('2026-04-05T23:59:59');
  });

  it('includes iat (issued at) claim', async () => {
    const token = await generateBookingToken(samplePayload);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));
    expect(payload.iat).toBeDefined();
    expect(typeof payload.iat).toBe('number');
  });

  it('includes exp (expiration) claim set to ~48h from now', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await generateBookingToken(samplePayload);
    const after = Math.floor(Date.now() / 1000);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));
    expect(payload.exp).toBeDefined();
    const expectedExpMin = before + 48 * 3600;
    const expectedExpMax = after + 48 * 3600;
    expect(payload.exp).toBeGreaterThanOrEqual(expectedExpMin);
    expect(payload.exp).toBeLessThanOrEqual(expectedExpMax);
  });

  it('throws when BOOKING_JWT_SECRET is not set', async () => {
    delete process.env.BOOKING_JWT_SECRET;
    await expect(generateBookingToken(samplePayload)).rejects.toThrow(
      'BOOKING_JWT_SECRET environment variable is not set'
    );
  });
});

describe('verifyBookingToken', () => {
  beforeEach(() => {
    process.env.BOOKING_JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.BOOKING_JWT_SECRET;
  });

  it('verifies a valid token and returns the payload', async () => {
    const token = await generateBookingToken(samplePayload);
    const result = await verifyBookingToken(token);
    expect(result).not.toBeNull();
    expect(result!.expired).toBe(false);
    expect(result!.payload.appointmentId).toBe('apt-123');
    expect(result!.payload.clientName).toBe('Jane Smith');
  });

  it('returns full payload structure on valid token', async () => {
    const token = await generateBookingToken(samplePayload);
    const result = await verifyBookingToken(token);
    expect(result!.payload.slots).toHaveLength(2);
    expect(result!.payload.slots[0]!.label).toBe('Monday 9am');
    expect(result!.payload.businessName).toBe('Pawsome Groomers');
  });

  it('returns null for a completely invalid token string', async () => {
    const result = await verifyBookingToken('not.a.token');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const result = await verifyBookingToken('');
    expect(result).toBeNull();
  });

  it('returns null when signed with a different secret', async () => {
    process.env.BOOKING_JWT_SECRET = 'different-secret-key-for-testing-purposes';
    const tokenWithDifferentSecret = await generateBookingToken(samplePayload);
    process.env.BOOKING_JWT_SECRET = TEST_SECRET;
    const result = await verifyBookingToken(tokenWithDifferentSecret);
    expect(result).toBeNull();
  });

  it('returns null for a malformed base64 payload', async () => {
    const result = await verifyBookingToken('aaa.!!!.bbb');
    expect(result).toBeNull();
  });

  it('handles expired token: returns payload with expired=true', async () => {
    // Generate a token then manually forge an expired one using jose
    // We test by crafting a token with exp in the past via raw JWT construction
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(TEST_SECRET);
    const expiredToken = await new SignJWT({ ...samplePayload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // issued 2h ago
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // expired 1h ago
      .sign(secret);

    const result = await verifyBookingToken(expiredToken);
    expect(result).not.toBeNull();
    expect(result!.expired).toBe(true);
    expect(result!.payload.appointmentId).toBe('apt-123');
  });

  it('throws when BOOKING_JWT_SECRET is not set', async () => {
    delete process.env.BOOKING_JWT_SECRET;
    await expect(verifyBookingToken('any.token.here')).rejects.toThrow(
      'BOOKING_JWT_SECRET environment variable is not set'
    );
  });
});
