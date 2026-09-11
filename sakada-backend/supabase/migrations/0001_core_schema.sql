-- Sakada Logistics — Core schema
-- Run this first, in order, in the Supabase SQL Editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ========== ENUM TYPES ==========

create type user_role as enum ('farmer', 'vendor', 'driver', 'admin');

create type delivery_status as enum (
  'pending',          -- created, waiting for a driver
  'driver_assigned',  -- a driver accepted, hasn't picked up yet
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled'
);

-- ========== PROFILES ==========
-- One row per Supabase auth.users entry. Created automatically on signup —
-- see 0003_auth_trigger.sql. Holds fields common to every role.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== ROLE-SPECIFIC PROFILES ==========
-- Matches Phase 0.1: farmer, vendor, and driver profiles are distinct entities.

create table farmer_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  farm_name text,
  farm_address text,
  created_at timestamptz not null default now()
);

create table vendor_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  business_name text,
  business_address text,
  created_at timestamptz not null default now()
);

create table driver_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  license_number text,
  vehicle_type text,
  vehicle_plate text,
  is_available boolean not null default true,
  current_lat double precision,
  current_lng double precision,
  created_at timestamptz not null default now()
);

-- ========== DELIVERIES ==========
-- Covers "delivery request", "booking", and "assignment" from your Phase 3
-- entity list as one lifecycle table — a request becomes a booking becomes
-- an assignment by moving through `status`, rather than three separate
-- tables that would need to stay in sync with each other.

create sequence delivery_code_seq start 1;

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_code text not null unique
    default ('SK-' || lpad(nextval('delivery_code_seq')::text, 5, '0')),

  requester_id uuid not null references profiles(id),   -- farmer or vendor
  driver_id uuid references profiles(id),                -- null until accepted

  pickup_address text not null,
  pickup_lat double precision,
  pickup_lng double precision,

  dropoff_address text not null,
  dropoff_lat double precision,
  dropoff_lng double precision,

  goods_description text not null,
  quantity_kg numeric,

  scheduled_pickup_at timestamptz,
  notes text,
  estimated_cost numeric,

  status delivery_status not null default 'pending',

  -- live tracking (Phase 7): updated by the driver while in transit
  current_lat double precision,
  current_lng double precision,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_deliveries_requester on deliveries(requester_id);
create index idx_deliveries_driver on deliveries(driver_id);
create index idx_deliveries_status on deliveries(status);

-- ========== updated_at helper ==========

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create trigger trg_deliveries_updated_at before update on deliveries
  for each row execute function set_updated_at();