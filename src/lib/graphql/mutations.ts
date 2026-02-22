/**
 * GraphQL Mutations for Hasura Sync
 *
 * Upsert and soft-delete mutations for all business tables.
 * Uses Hasura's insert_*_one with on_conflict for upsert behavior.
 */

import { gql } from 'graphql-request';

// ============================================================================
// Users
// ============================================================================

export const UPSERT_USER = gql`
  mutation UpsertUser($object: users_insert_input!, $update_columns: [users_update_column!]!) {
    insert_users_one(
      object: $object
      on_conflict: { constraint: users_pkey, update_columns: $update_columns }
    ) {
      id
    }
  }
`;

export const USER_UPDATE_COLUMNS = [
  'business_name',
  'phone',
  'timezone',
  'service_area_miles',
  'business_latitude',
  'business_longitude',
  'updated_at',
  'version',
  'synced_at',
];

// ============================================================================
// Clients
// ============================================================================

export const UPSERT_CLIENT = gql`
  mutation UpsertClient($object: clients_insert_input!, $update_columns: [clients_update_column!]!) {
    insert_clients_one(
      object: $object
      on_conflict: { constraint: clients_pkey, update_columns: $update_columns }
    ) {
      id
    }
  }
`;

export const SOFT_DELETE_CLIENT = gql`
  mutation SoftDeleteClient($id: String!, $deleted_at: timestamptz!, $updated_at: timestamptz!) {
    update_clients_by_pk(
      pk_columns: { id: $id }
      _set: { deleted_at: $deleted_at, updated_at: $updated_at }
    ) {
      id
    }
  }
`;

export const CLIENT_UPDATE_COLUMNS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'address',
  'latitude',
  'longitude',
  'notes',
  'updated_at',
  'version',
  'synced_at',
  'deleted_at',
];

// ============================================================================
// Pets
// ============================================================================

export const UPSERT_PET = gql`
  mutation UpsertPet($object: pets_insert_input!, $update_columns: [pets_update_column!]!) {
    insert_pets_one(
      object: $object
      on_conflict: { constraint: pets_pkey, update_columns: $update_columns }
    ) {
      id
    }
  }
`;

export const SOFT_DELETE_PET = gql`
  mutation SoftDeletePet($id: String!, $deleted_at: timestamptz!, $updated_at: timestamptz!) {
    update_pets_by_pk(
      pk_columns: { id: $id }
      _set: { deleted_at: $deleted_at, updated_at: $updated_at }
    ) {
      id
    }
  }
`;

export const PET_UPDATE_COLUMNS = [
  'name',
  'species',
  'breed',
  'size',
  'age_years',
  'weight_lbs',
  'behavior_notes',
  'medical_notes',
  'updated_at',
  'version',
  'synced_at',
  'deleted_at',
];

// ============================================================================
// Services
// ============================================================================

export const UPSERT_SERVICE = gql`
  mutation UpsertService($object: services_insert_input!, $update_columns: [services_update_column!]!) {
    insert_services_one(
      object: $object
      on_conflict: { constraint: services_pkey, update_columns: $update_columns }
    ) {
      id
    }
  }
`;

export const SOFT_DELETE_SERVICE = gql`
  mutation SoftDeleteService($id: String!, $deleted_at: timestamptz!, $updated_at: timestamptz!) {
    update_services_by_pk(
      pk_columns: { id: $id }
      _set: { deleted_at: $deleted_at, updated_at: $updated_at }
    ) {
      id
    }
  }
`;

export const SERVICE_UPDATE_COLUMNS = [
  'name',
  'description',
  'duration_minutes',
  'price_cents',
  'weather_dependent',
  'location_type',
  'updated_at',
  'version',
  'synced_at',
  'deleted_at',
];

// ============================================================================
// Appointments
// ============================================================================

export const UPSERT_APPOINTMENT = gql`
  mutation UpsertAppointment($object: appointments_insert_input!, $update_columns: [appointments_update_column!]!) {
    insert_appointments_one(
      object: $object
      on_conflict: { constraint: appointments_pkey, update_columns: $update_columns }
    ) {
      id
    }
  }
`;

export const SOFT_DELETE_APPOINTMENT = gql`
  mutation SoftDeleteAppointment($id: String!, $deleted_at: timestamptz!, $updated_at: timestamptz!) {
    update_appointments_by_pk(
      pk_columns: { id: $id }
      _set: { deleted_at: $deleted_at, updated_at: $updated_at }
    ) {
      id
    }
  }
`;

export const APPOINTMENT_UPDATE_COLUMNS = [
  'client_id',
  'pet_id',
  'service_id',
  'start_time',
  'end_time',
  'status',
  'location_type',
  'address',
  'latitude',
  'longitude',
  'notes',
  'internal_notes',
  'weather_alert',
  'updated_at',
  'version',
  'synced_at',
  'deleted_at',
];
