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

-- 3) Badge print history — one row per badge print, whoever/whatever
-- performs the print (the badgedesk kiosk at ieml-badgedesk.vercel.app
-- writes print_count directly to mart_days_registrations; this portal
-- never prints anything itself). ON DELETE CASCADE means if a buyer
-- registration is ever deleted, their print log rows go with it.
CREATE TABLE IF NOT EXISTS badge_print_log (
  id SERIAL PRIMARY KEY,
  urn TEXT NOT NULL REFERENCES mart_days_registrations(urn) ON DELETE CASCADE,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_badge_print_log_urn ON badge_print_log (urn);
CREATE INDEX IF NOT EXISTS idx_badge_print_log_printed_at ON badge_print_log (printed_at);

-- 3b) Two triggers make the history + auto-check-in work automatically,
-- no matter which application increments print_count (badgedesk today,
-- possibly something else later — this portal included, though it
-- currently has no print action of its own).
--
-- Trigger A (BEFORE UPDATE): whenever print_count goes up, force
-- attended = true. attended_at is only set the FIRST time (COALESCE
-- keeps an existing check-in time rather than overwriting it on a
-- reprint) — this can still be unchecked manually from the portal.
CREATE OR REPLACE FUNCTION trg_badge_print_autocheckin() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.print_count > OLD.print_count THEN
    NEW.attended := TRUE;
    NEW.attended_at := COALESCE(OLD.attended_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS badge_print_autocheckin ON mart_days_registrations;
CREATE TRIGGER badge_print_autocheckin
  BEFORE UPDATE ON mart_days_registrations
  FOR EACH ROW
  EXECUTE FUNCTION trg_badge_print_autocheckin();

-- Trigger B (AFTER UPDATE): whenever print_count goes up, log the event
-- so the portal's Print History page has a day-wise, per-buyer trail —
-- this fires whether badgedesk, this portal, or a future admin tool is
-- the one that changed the count.
CREATE OR REPLACE FUNCTION trg_badge_print_log() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.print_count > OLD.print_count THEN
    INSERT INTO badge_print_log (urn) VALUES (NEW.urn);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS badge_print_log_insert ON mart_days_registrations;
CREATE TRIGGER badge_print_log_insert
  AFTER UPDATE ON mart_days_registrations
  FOR EACH ROW
  EXECUTE FUNCTION trg_badge_print_log();

-- 4) Sort-column indexes — every Buyers/Mart Owners page load sorts by
-- these columns (newest first). Without an index Postgres has to sort
-- the whole table on every request; this makes it instant regardless of
-- how many rows accumulate over the event.
CREATE INDEX IF NOT EXISTS idx_mart_days_registered_at ON mart_days_registrations (registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_owners_created_at ON mart_owners (created_at DESC);