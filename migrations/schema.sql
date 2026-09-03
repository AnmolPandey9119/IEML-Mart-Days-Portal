-- IEML Mart Sourcing Days — admin portal migration
--
-- Run this ONCE against the SAME Neon database used by the public
-- registration site (ieml-martdays-registration.vercel.app).
-- It only ADDS things — it never drops or rewrites existing columns,
-- so your visitor registrations are 100% safe. Safe to re-run.
--
-- Confirmed table name: "mart_days_registrations" (urn TEXT PRIMARY KEY,
-- FK to public.visitors(urn) ON DELETE CASCADE). If this ever changes,
-- update buyers_TABLE in server.js to match.

-- 1) Attendance tracking — new columns only this portal writes to.
ALTER TABLE mart_days_registrations ADD COLUMN IF NOT EXISTS attended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mart_days_registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

-- 1b) Registration approval workflow (Approve / Reject action buttons).
-- Defaults every existing row to 'Registered' so nothing looks rejected
-- by accident.
ALTER TABLE mart_days_registrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Registered';

-- 2) Mart Owners — brand-new, blank table. Kept simple on purpose;
-- add columns later with more ALTER TABLE ... ADD COLUMN statements
-- if the final list needs more fields.
CREATE TABLE IF NOT EXISTS mart_owners (
  id SERIAL PRIMARY KEY,
  urn TEXT,
  full_name TEXT NOT NULL,
  company_name TEXT,
  category TEXT,
  mobile_number TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If mart_owners already existed from an earlier run of this migration
-- (before URN was added), this adds the column without touching any
-- rows you've already entered.
ALTER TABLE mart_owners ADD COLUMN IF NOT EXISTS urn TEXT;