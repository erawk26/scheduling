/**
 * GraphQL Queries for Hasura Data Pull
 *
 * Used by the initial data pull on first login to populate local SQLite.
 * Hasura permissions automatically filter by X-Hasura-User-Id.
 */

import { gql } from 'graphql-request';

/**
 * Pull all user data in a single query.
 * Hasura row-level security ensures only the authenticated user's data is returned.
 */
export const PULL_ALL_USER_DATA = gql`
  query PullAllUserData {
    users {
      id
      business_name
      phone
      timezone
      service_area_miles
      business_latitude
      business_longitude
      created_at
      updated_at
      version
      synced_at
    }
    clients {
      id
      user_id
      first_name
      last_name
      email
      phone
      address
      latitude
      longitude
      notes
      created_at
      updated_at
      version
      synced_at
      deleted_at
    }
    pets {
      id
      client_id
      name
      species
      breed
      size
      age_years
      weight_lbs
      behavior_notes
      medical_notes
      created_at
      updated_at
      version
      synced_at
      deleted_at
    }
    services {
      id
      user_id
      name
      description
      duration_minutes
      price_cents
      weather_dependent
      location_type
      created_at
      updated_at
      version
      synced_at
      deleted_at
    }
    appointments {
      id
      user_id
      client_id
      pet_id
      service_id
      start_time
      end_time
      status
      location_type
      address
      latitude
      longitude
      notes
      internal_notes
      weather_alert
      created_at
      updated_at
      version
      synced_at
      deleted_at
    }
  }
`;

/**
 * Response type for the initial data pull
 */
export interface PullAllUserDataResponse {
  users: Array<{
    id: string;
    business_name: string | null;
    phone: string | null;
    timezone: string;
    service_area_miles: number;
    business_latitude: number | null;
    business_longitude: number | null;
    created_at: string;
    updated_at: string;
    version: number;
    synced_at: string | null;
  }>;
  clients: Array<{
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    version: number;
    synced_at: string | null;
    deleted_at: string | null;
  }>;
  pets: Array<{
    id: string;
    client_id: string;
    name: string;
    species: string;
    breed: string | null;
    size: string | null;
    age_years: number | null;
    weight_lbs: number | null;
    behavior_notes: string | null;
    medical_notes: string | null;
    created_at: string;
    updated_at: string;
    version: number;
    synced_at: string | null;
    deleted_at: string | null;
  }>;
  services: Array<{
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number | null;
    weather_dependent: boolean;
    location_type: string;
    created_at: string;
    updated_at: string;
    version: number;
    synced_at: string | null;
    deleted_at: string | null;
  }>;
  appointments: Array<{
    id: string;
    user_id: string;
    client_id: string;
    pet_id: string | null;
    service_id: string;
    start_time: string;
    end_time: string;
    status: string;
    location_type: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    notes: string | null;
    internal_notes: string | null;
    weather_alert: boolean;
    created_at: string;
    updated_at: string;
    version: number;
    synced_at: string | null;
    deleted_at: string | null;
  }>;
}
