CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Event',
  city TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  state TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (state IN ('SCHEDULED','OPEN','FROZEN','DRAWING','CLAIMING','CLOSED','SOLD_OUT','CANCELLED')),
  entry_opens_at TIMESTAMPTZ,
  entry_closes_at TIMESTAMPTZ,
  claim_window_seconds INTEGER NOT NULL DEFAULT 7200 CHECK (claim_window_seconds > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','SELECTED','WAITLISTED','NOT_SELECTED','EXPIRED','CONFIRMED')),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  draw_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS entries_event_rank_idx ON entries(event_id, draw_rank) WHERE draw_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS entries_event_idx ON entries(event_id, created_at);

CREATE TABLE IF NOT EXISTS draws (
  event_id TEXT PRIMARY KEY REFERENCES events(id),
  algorithm TEXT NOT NULL DEFAULT 'HMAC-SHA256',
  version TEXT NOT NULL DEFAULT '1.0',
  snapshot_hash TEXT,
  commitment_hash TEXT,
  encrypted_seed BYTEA,
  revealed_seed TEXT,
  stage TEXT NOT NULL DEFAULT 'queued',
  progress DOUBLE PRECISION,
  participant_count INTEGER NOT NULL DEFAULT 0,
  frozen_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (event_id, snapshot_hash)
);

CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rank INTEGER NOT NULL CHECK (rank > 0),
  seat TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OFFERED','CONFIRMED','EXPIRED')),
  claim_expires_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE (event_id, user_id),
  UNIQUE (event_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS allocations_active_seat_idx ON allocations(event_id, seat) WHERE status IN ('OFFERED','CONFIRMED');
CREATE INDEX IF NOT EXISTS allocations_claim_idx ON allocations(event_id, status, rank);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_event_created_idx ON audit_log(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS request_metrics (
  minute TIMESTAMPTZ NOT NULL,
  event_id TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (minute, event_id, status_code)
);
