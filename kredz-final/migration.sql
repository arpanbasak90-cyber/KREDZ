-- ─────────────────────────────────────────────────────────────────────────────
-- Kredz DB migration: mentor QR verification workflow
-- Run this in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Mentors table
create table if not exists mentors (
  id           bigserial primary key,
  full_name    text        not null,
  institution  text        not null,
  email        text        not null unique,
  password     text        not null,
  created_at   timestamptz not null default now()
);

-- 2. Add qr_token column to credentials so we can look up a credential
--    directly from the scanned QR link (without exposing the full bundle_hash).
alter table credentials
  add column if not exists qr_token text;

-- Create an index for fast token lookups
create index if not exists idx_credentials_qr_token on credentials(qr_token);
