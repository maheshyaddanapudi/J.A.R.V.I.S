-- 0002_model_calls: gateway call audit (slice 1.2, R-MODEL-03)
-- Records routing outcomes; never message content and never credentials.

CREATE TABLE model_calls (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  role          text NOT NULL,
  provider      text,
  model         text,
  privacy_class text NOT NULL,
  source        text NOT NULL,
  ok            boolean NOT NULL,
  error         text,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  latency_ms    integer NOT NULL DEFAULT 0,
  fallback_from text[] NOT NULL DEFAULT '{}',
  offline_mode  boolean NOT NULL DEFAULT false
);

CREATE INDEX model_calls_at_idx ON model_calls (at DESC);
CREATE INDEX model_calls_role_idx ON model_calls (role, at DESC);
