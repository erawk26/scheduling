/**
 * Validation Schemas - Zod schemas for form data
 *
 * CRITICAL: These schemas MUST match database types in types.ts
 * These are for FORM INPUT validation (user-facing fields only)
 * Database fields like id, created_at, etc. are NOT validated here
 */

import { z } from 'zod';

// ============================================================================
// Services Schema
// ============================================================================

export const serviceSchema = z.object({
  name: z
    .string()
    .min(1, 'Service name is required')
    .max(100, 'Service name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional(),
  duration_minutes: z
    .number()
    .min(15, 'Duration must be at least 15 minutes')
    .max(480, 'Duration must be 480 minutes or less')
    .multipleOf(15, 'Duration must be in 15-minute increments'),
  price_cents: z
    .number()
    .min(0, 'Price cannot be negative')
    .nullable()
    .optional(),
  weather_dependent: z.boolean().default(false),
  location_type: z.enum(['client_location', 'business_location', 'mobile']).superRefine((val, ctx) => {
    if (!['client_location', 'business_location', 'mobile'].includes(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid location type',
      });
    }
  }),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;

// ============================================================================
// Clients Schema
// ============================================================================

export const clientSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or less'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or less'),
  email: z
    .string()
    .email('Invalid email address')
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(20, 'Phone number must be 20 characters or less')
    .nullable()
    .optional(),
  address: z
    .string()
    .max(500, 'Address must be 500 characters or less')
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less')
    .nullable()
    .optional(),
  scheduling_flexibility: z
    .enum(['unknown', 'flexible', 'fixed'])
    .default('unknown')
    .optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// ============================================================================
// Pets Schema
// ============================================================================

export const petSchema = z.object({
  name: z
    .string()
    .min(1, 'Pet name is required')
    .max(100, 'Pet name must be 100 characters or less'),
  species: z.enum(['dog', 'cat', 'bird', 'rabbit', 'other']).superRefine((val, ctx) => {
    if (!['dog', 'cat', 'bird', 'rabbit', 'other'].includes(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid species',
      });
    }
  }),
  breed: z
    .string()
    .max(100, 'Breed must be 100 characters or less')
    .nullable()
    .optional(),
  size: z
    .enum(['tiny', 'small', 'medium', 'large', 'giant'])
    .nullable()
    .optional(),
  age_years: z
    .number()
    .min(0, 'Age cannot be negative')
    .max(50, 'Age must be 50 years or less')
    .nullable()
    .optional(),
  weight_lbs: z
    .number()
    .min(0, 'Weight cannot be negative')
    .max(300, 'Weight must be 300 lbs or less')
    .nullable()
    .optional(),
  behavior_notes: z
    .string()
    .max(2000, 'Behavior notes must be 2000 characters or less')
    .nullable()
    .optional(),
  medical_notes: z
    .string()
    .max(2000, 'Medical notes must be 2000 characters or less')
    .nullable()
    .optional(),
});

export type PetFormData = z.infer<typeof petSchema>;

// ============================================================================
// Appointments Schema
// ============================================================================

export const appointmentSchema = z
  .object({
    client_id: z.string().min(1, 'Client is required'),
    service_id: z.string().min(1, 'Service is required'),
    pet_id: z.string().nullable().optional(),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    status: z
      .enum([
        'draft',
        'pending',
        'scheduled',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
      ])
      .default('scheduled'),
    location_type: z.enum(['client_location', 'business_location', 'mobile']).superRefine((val, ctx) => {
      if (!['client_location', 'business_location', 'mobile'].includes(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid location type',
        });
      }
    }),
    address: z
      .string()
      .max(500, 'Address must be 500 characters or less')
      .nullable()
      .optional(),
    notes: z
      .string()
      .max(2000, 'Notes must be 2000 characters or less')
      .nullable()
      .optional(),
    internal_notes: z
      .string()
      .max(2000, 'Internal notes must be 2000 characters or less')
      .nullable()
      .optional(),
  })
  .refine((data) => new Date(data.end_time) > new Date(data.start_time), {
    message: 'End time must be after start time',
    path: ['end_time'],
  });

export type AppointmentFormData = z.infer<typeof appointmentSchema>;
