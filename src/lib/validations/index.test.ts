/**
 * Validation Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  serviceSchema,
  clientSchema,
  petSchema,
  appointmentSchema,
} from './index';

// ============================================================================
// serviceSchema
// ============================================================================

describe('serviceSchema', () => {
  const validService = {
    name: 'Dog Grooming',
    duration_minutes: 60,
    price_cents: 5000,
    weather_dependent: 0,
    location_type: 'client_location' as const,
  };

  it('accepts valid service data', () => {
    expect(serviceSchema.safeParse(validService).success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = serviceSchema.safeParse({ ...validService, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = serviceSchema.safeParse({ ...validService, name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects duration below 15 minutes', () => {
    const result = serviceSchema.safeParse({ ...validService, duration_minutes: 10 });
    expect(result.success).toBe(false);
  });

  it('rejects duration not a multiple of 15', () => {
    const result = serviceSchema.safeParse({ ...validService, duration_minutes: 25 });
    expect(result.success).toBe(false);
  });

  it('rejects duration above 480 minutes', () => {
    const result = serviceSchema.safeParse({ ...validService, duration_minutes: 495 });
    expect(result.success).toBe(false);
  });

  it('rejects negative price_cents', () => {
    const result = serviceSchema.safeParse({ ...validService, price_cents: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts zero price_cents', () => {
    const result = serviceSchema.safeParse({ ...validService, price_cents: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts null price_cents', () => {
    const result = serviceSchema.safeParse({ ...validService, price_cents: null });
    expect(result.success).toBe(true);
  });

  it('rejects invalid location_type', () => {
    const result = serviceSchema.safeParse({ ...validService, location_type: 'home' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid location_type values', () => {
    for (const lt of ['client_location', 'business_location', 'mobile'] as const) {
      const result = serviceSchema.safeParse({ ...validService, location_type: lt });
      expect(result.success).toBe(true);
    }
  });

  it('defaults weather_dependent to 0 when omitted', () => {
    const { weather_dependent: _, ...rest } = validService;
    const result = serviceSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weather_dependent).toBe(0);
    }
  });
});

// ============================================================================
// clientSchema
// ============================================================================

describe('clientSchema', () => {
  const validClient = {
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    phone: '555-1234',
  };

  it('accepts valid client data', () => {
    expect(clientSchema.safeParse(validClient).success).toBe(true);
  });

  it('rejects missing first_name', () => {
    const result = clientSchema.safeParse({ ...validClient, first_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing last_name', () => {
    const result = clientSchema.safeParse({ ...validClient, last_name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = clientSchema.safeParse({ ...validClient, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts empty string email (treated as no email)', () => {
    const result = clientSchema.safeParse({ ...validClient, email: '' });
    expect(result.success).toBe(true);
  });

  it('accepts null email', () => {
    const result = clientSchema.safeParse({ ...validClient, email: null });
    expect(result.success).toBe(true);
  });

  it('accepts client with no optional fields', () => {
    const result = clientSchema.safeParse({ first_name: 'Jane', last_name: 'Smith' });
    expect(result.success).toBe(true);
  });

  it('rejects first_name longer than 100 characters', () => {
    const result = clientSchema.safeParse({ ...validClient, first_name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// petSchema
// ============================================================================

describe('petSchema', () => {
  const validPet = {
    name: 'Buddy',
    species: 'dog' as const,
  };

  it('accepts valid pet data', () => {
    expect(petSchema.safeParse(validPet).success).toBe(true);
  });

  it('rejects missing pet name', () => {
    const result = petSchema.safeParse({ ...validPet, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid species', () => {
    const result = petSchema.safeParse({ ...validPet, species: 'hamster' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid species values', () => {
    for (const species of ['dog', 'cat', 'bird', 'rabbit', 'other'] as const) {
      const result = petSchema.safeParse({ ...validPet, species });
      expect(result.success).toBe(true);
    }
  });

  it('rejects negative age_years', () => {
    const result = petSchema.safeParse({ ...validPet, age_years: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects age_years above 50', () => {
    const result = petSchema.safeParse({ ...validPet, age_years: 51 });
    expect(result.success).toBe(false);
  });

  it('rejects negative weight_lbs', () => {
    const result = petSchema.safeParse({ ...validPet, weight_lbs: -0.1 });
    expect(result.success).toBe(false);
  });

  it('accepts all valid size values', () => {
    for (const size of ['tiny', 'small', 'medium', 'large', 'giant'] as const) {
      const result = petSchema.safeParse({ ...validPet, size });
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================================
// appointmentSchema
// ============================================================================

describe('appointmentSchema', () => {
  const validAppointment = {
    client_id: 'client-1',
    service_id: 'service-1',
    start_time: '2026-03-01T09:00:00',
    end_time: '2026-03-01T10:00:00',
    status: 'scheduled' as const,
    location_type: 'client_location' as const,
  };

  it('accepts valid appointment data', () => {
    expect(appointmentSchema.safeParse(validAppointment).success).toBe(true);
  });

  it('rejects missing client_id', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, client_id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing service_id', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, service_id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects end_time before start_time', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      start_time: '2026-03-01T10:00:00',
      end_time: '2026-03-01T09:00:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects end_time equal to start_time', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      start_time: '2026-03-01T09:00:00',
      end_time: '2026-03-01T09:00:00',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid status values', () => {
    const statuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as const;
    for (const status of statuses) {
      const result = appointmentSchema.safeParse({ ...validAppointment, status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('defaults status to scheduled when omitted', () => {
    const { status: _, ...rest } = validAppointment;
    const result = appointmentSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('scheduled');
    }
  });

  it('accepts all valid location_type values', () => {
    for (const lt of ['client_location', 'business_location', 'mobile'] as const) {
      const result = appointmentSchema.safeParse({ ...validAppointment, location_type: lt });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid location_type', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, location_type: 'home' });
    expect(result.success).toBe(false);
  });

  it('accepts optional pet_id as null', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, pet_id: null });
    expect(result.success).toBe(true);
  });
});
