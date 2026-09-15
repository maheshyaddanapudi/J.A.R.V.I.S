-- Night Lab experiment ledger (D-0079, R-LAB-04): every experiment — kept,
-- discarded, or crashed — durably recorded with scores, cost, bench hash, and
-- provenance. This is autoresearch's results.tsv with receipts; the morning
-- report is GENERATED from these rows, never composed freely (R-LAB-07).
CREATE TABLE lab_experiments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign      text NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  -- the full candidate (prompt contents + setting values) — needed to apply a
  -- winner later and to revert it precisely
  candidate     jsonb NOT NULL,
  candidate_summary text NOT NULL DEFAULT '',
  hypothesis    text NOT NULL DEFAULT '',
  -- baseline scores this night's runs are compared against
  baseline      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- one entry per bench run of the candidate: {scores, gates_pass, report_path}
  trials        jsonb NOT NULL DEFAULT '[]'::jsonb,
  verdict       text NOT NULL CHECK (verdict IN ('keep','discard','crash')),
  verdict_reason text NOT NULL DEFAULT '',
  gate_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  tokens_spent  integer NOT NULL DEFAULT 0,
  bench_hash    text NOT NULL DEFAULT '',
  -- three-envelope application state (L4): kept winners may be applied to the
  -- live instance via the normal gated APIs; proposals wait for the user
  envelope      text NOT NULL DEFAULT 'auto' CHECK (envelope IN ('auto','proposal')),
  applied_to_live boolean NOT NULL DEFAULT false,
  applied_ref   text NOT NULL DEFAULT ''
);

CREATE INDEX lab_experiments_campaign_idx ON lab_experiments (campaign, started_at DESC);
