-- Event Check-In: schema setup
-- Run this in the Supabase SQL editor before importing Luma data.
-- Safe to re-run: uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS throughout.

create extension if not exists "pgcrypto";

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  email_normalized text,
  phone text,
  phone_normalized text,
  address text,
  gender text,
  occupation text,
  day1_checkin timestamptz,
  day2_checkin timestamptz,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  -- NOTE: attendees_contact_present is intentionally omitted here.
  -- It is added at the end of post_luma_import.sql after normalized fields are populated.
  constraint attendees_source_valid
    check (source in ('luma', 'manual'))
);

-- Add columns that may be missing if the table was created before this version.
alter table attendees add column if not exists address    text;
alter table attendees add column if not exists gender     text;
alter table attendees add column if not exists occupation text;

-- Drop the contact constraint so CSV imports are not blocked.
-- post_luma_import.sql re-adds it after normalization.
alter table attendees drop constraint if exists attendees_contact_present;

create unique index if not exists attendees_email_norm_idx
  on attendees (email_normalized)
  where email_normalized is not null;

create unique index if not exists attendees_phone_norm_idx
  on attendees (phone_normalized)
  where phone_normalized is not null;

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references attendees(id) on delete cascade,
  day smallint not null check (day in (1, 2)),
  checked_in_at timestamptz not null default now(),
  source_ip text
);

create index if not exists check_ins_attendee_idx on check_ins (attendee_id);
create index if not exists check_ins_day_idx on check_ins (day, checked_in_at);
