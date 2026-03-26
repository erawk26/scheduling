/**
 * Booking JWT utilities
 *
 * Server-side only. Uses jose for HS256 JWT signing/verification.
 * Secret: BOOKING_JWT_SECRET env var.
 */

import { SignJWT, jwtVerify, errors as JoseErrors } from 'jose';

export interface BookingSlot {
  label: string;
  value: string;
}

export interface BookingTokenPayload {
  appointmentId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  businessName: string;
  slots: BookingSlot[];
  deadline: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.BOOKING_JWT_SECRET;
  if (!secret) {
    throw new Error('BOOKING_JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function generateBookingToken(payload: BookingTokenPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('48h')
    .sign(secret);
}

export async function verifyBookingToken(
  token: string
): Promise<{ payload: BookingTokenPayload; expired: boolean } | null> {
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      payload: payload as unknown as BookingTokenPayload,
      expired: false,
    };
  } catch (err) {
    if (err instanceof JoseErrors.JWTExpired) {
      // Token is expired but otherwise structurally valid — decode without verification
      const parts = token.split('.');
      const payload64 = parts[1];
      if (parts.length !== 3 || !payload64) return null;
      try {
        const decoded = JSON.parse(Buffer.from(payload64, 'base64url').toString('utf8'));
        return { payload: decoded as BookingTokenPayload, expired: true };
      } catch {
        return null;
      }
    }
    return null;
  }
}
