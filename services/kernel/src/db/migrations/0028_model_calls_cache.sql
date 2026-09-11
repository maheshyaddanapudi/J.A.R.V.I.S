-- 0028_model_calls_cache: prompt-cache accounting on the gateway call audit
-- (Longitude-XL E-01, 2026-09-11). The planning role re-sent its tool
-- catalogue + system prompt on every agent step with no caching — 78% of a
-- 1000-day run's bill. The Anthropic adapter now marks that prefix cacheable;
-- these columns record what the provider reports as cached reads/writes so
-- /gateway/calls and the efficiency accounting can show the saving honestly.
ALTER TABLE model_calls ADD COLUMN IF NOT EXISTS cache_read_tokens  integer NOT NULL DEFAULT 0;
ALTER TABLE model_calls ADD COLUMN IF NOT EXISTS cache_write_tokens integer NOT NULL DEFAULT 0;
