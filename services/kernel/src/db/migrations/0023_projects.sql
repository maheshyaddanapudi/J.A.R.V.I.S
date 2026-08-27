-- 0023_projects: durable long-horizon goals (D-0069) — how J.A.R.V.I.S. "runs
-- companies": a goal it keeps working across many heartbeats/days until done,
-- with a running progress log and a next action, not a single-shot agenda item.
-- Goal + log entries are AES-256-GCM encrypted at rest when a vault is present.

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  goal        text NOT NULL DEFAULT '',        -- encrypted at rest
  status      text NOT NULL DEFAULT 'active'   CHECK (status IN ('active','paused','done','abandoned')),
  next_action text NOT NULL DEFAULT '',        -- encrypted at rest — what to do at the next heartbeat
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_active_idx ON projects (updated_at DESC) WHERE status = 'active';

CREATE TABLE project_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL DEFAULT now(),
  entry       text NOT NULL,                   -- encrypted at rest — a progress note
  by          text NOT NULL DEFAULT 'jarvis'
);
CREATE INDEX project_log_idx ON project_log (project_id, at DESC);
