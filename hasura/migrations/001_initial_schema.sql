-- Migration: Initial Database Schema
-- Created: 2026-02-15
-- Description: Complete schema for KE Agenda V3 with auth, business, and cache tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- AUTH TABLES (Better Auth managed)
-- =============================================================================

CREATE TABLE auth_user (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE auth_session (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE TABLE auth_account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP WITH TIME ZONE,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- BUSINESS TABLES
-- =============================================================================

CREATE TABLE users (
  id TEXT PRIMARY KEY REFERENCES auth_user(id),
  business_name TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  service_area_miles INTEGER DEFAULT 25,
  business_latitude DECIMAL(10,8),
  business_longitude DECIMAL(11,8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  scheduling_flexibility TEXT DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE pets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other')),
  breed TEXT,
  size TEXT CHECK (size IN ('tiny', 'small', 'medium', 'large', 'giant')),
  age_years INTEGER,
  weight_lbs DECIMAL(5,2),
  behavior_notes TEXT,
  medical_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE services (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER,
  weather_dependent BOOLEAN DEFAULT FALSE,
  location_type TEXT NOT NULL CHECK (location_type IN ('client_location', 'business_location', 'mobile')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  pet_id TEXT REFERENCES pets(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  location_type TEXT NOT NULL CHECK (location_type IN ('client_location', 'business_location', 'mobile')),
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  internal_notes TEXT,
  weather_alert BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================================================
-- CACHE TABLES
-- =============================================================================

CREATE TABLE weather_cache (
  id TEXT PRIMARY KEY,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  forecast_date DATE NOT NULL,
  temperature_f INTEGER,
  conditions TEXT,
  precipitation_probability INTEGER,
  wind_speed_mph INTEGER,
  is_outdoor_suitable BOOLEAN,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(latitude, longitude, forecast_date)
);

CREATE TABLE route_cache (
  id TEXT PRIMARY KEY,
  appointment_ids TEXT[] NOT NULL,
  optimized_order TEXT[] NOT NULL,
  total_duration_minutes INTEGER NOT NULL,
  total_distance_miles DECIMAL(8,2) NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX idx_auth_session_user_id ON auth_session(user_id);
CREATE INDEX idx_auth_session_token ON auth_session(token);
CREATE INDEX idx_auth_account_user_id ON auth_account(user_id);
CREATE INDEX idx_clients_user_id ON clients(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pets_client_id ON pets(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_user_id ON services(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_user_id_date ON appointments(user_id, start_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_client_id ON appointments(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_status ON appointments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_weather_location_date ON weather_cache(latitude, longitude, forecast_date);
CREATE INDEX idx_weather_expires ON weather_cache(expires_at);
CREATE INDEX idx_route_expires ON route_cache(expires_at);

-- =============================================================================
-- AUTOMATIC TIMESTAMP UPDATES
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auth_user_updated_at BEFORE UPDATE ON auth_user
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auth_session_updated_at BEFORE UPDATE ON auth_session
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auth_account_updated_at BEFORE UPDATE ON auth_account
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
