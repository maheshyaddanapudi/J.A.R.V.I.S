-- 0024_capability_activation: Stage-B (D-0073). A capability, once approved, is
-- activated as a COMPOSITION of existing gated tools (never executed manifest
-- code) — safe by construction. The enum already defines 'active'/'disabled';
-- this adds the executable composition + an activation timestamp. The R-CAP-08
-- hard limit is UNCHANGED: a manifest touching a protected path/permission/symbol
-- is still rejected terminally at Stage-A and re-checked at activation.
ALTER TABLE capabilities ADD COLUMN composition  jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE capabilities ADD COLUMN activated_at timestamptz;
