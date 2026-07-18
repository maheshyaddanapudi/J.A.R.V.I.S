-- 0020_ui_panels: A2UI — agent-generated declarative UI panels (D-0061)
--
-- J.A.R.V.I.S. can compose a UI panel as DATA (a whitelisted declarative spec),
-- which the Command Center renders through a sandboxed renderer. The spec never
-- contains code/HTML/URLs — only references to catalogued settings and
-- registered gated tools — so a generated panel can only do what the user could
-- already do through the safe contracts. Specs are validated on write (kernel)
-- and again at render (client). This table just stores the validated specs.

CREATE TABLE ui_panels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  spec       jsonb NOT NULL,
  created_by text NOT NULL DEFAULT 'jarvis',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ui_panels_created_idx ON ui_panels (created_at DESC);
