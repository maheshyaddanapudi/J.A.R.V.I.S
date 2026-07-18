-- 0018_durable_grants: persist standing consent (D-0059)
--
-- "always-allow-in-scope" is a DURABLE consent ("always allow this tool in this
-- scope") — it must survive a restart, or the user silently loses a standing
-- decision and gets re-prompted. It used to live only in the loop's in-memory
-- session grants. "allow-for-session" correctly stays in-memory (a session
-- ends); only the durable kind is persisted here.
--
-- This is a Z1 trust-core record (it encodes approval consent) — it is written
-- only by the approval path, never by generated capabilities (R-CAP-08), and is
-- listable/revocable so a standing consent is always visible and reversible.

CREATE TABLE durable_grants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool         text NOT NULL,
  scope        text NOT NULL DEFAULT '*',
  risk_ceiling text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tool, scope)
);
