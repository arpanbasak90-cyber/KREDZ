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

-- 3. Seal columns — the mentor's permanent, chained signature over the
--    already-approved credential hash. seal_hash is set once by
--    POST /api/seal/{token} and is never overwritten afterward.
alter table credentials
  add column if not exists seal_hash  text,
  add column if not exists sealed_by  text,
  add column if not exists sealed_at  timestamptz;

-- 4. GitHub-view tracking — records, server-side, whether the mentor
--    actually opened the linked repo before endorsing. This lives in the
--    DB (not just frontend React state) because client-side state resets
--    on refresh and can be bypassed — the endorsement gate needs a source
--    of truth the mentor can't clear just by reloading the page.
--    Set by POST /api/track-github-view/{token}.
alter table credentials
  add column if not exists github_viewed    boolean     not null default false,
  add column if not exists github_viewed_at timestamptz;
