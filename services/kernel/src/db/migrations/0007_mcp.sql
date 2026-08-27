-- 0007_mcp: MCP server registry persistence (dynamic capability platform)
-- Trust decisions and — critically — the manifest fingerprint + quarantine
-- state must survive a kernel restart, so a rug pull that happens while the
-- kernel is down is still detected on the next reconnect, and trusted servers
-- do not silently drop back to untrusted (forcing re-approval) on restart.
-- THREAT_MODEL T2 / R-CAP-02 / D-0027.

CREATE TABLE mcp_servers (
  id            text PRIMARY KEY,                         -- user-assigned server id
  trust         text NOT NULL DEFAULT 'untrusted'
                  CHECK (trust IN ('untrusted','limited','trusted')),
  manifest_hash text NOT NULL,                            -- sha256 tool-set fingerprint
  server_info   jsonb NOT NULL DEFAULT '{}'::jsonb,       -- {name, version} reported by server
  tools         jsonb NOT NULL DEFAULT '[]'::jsonb,       -- discovered tool specs (UNTRUSTED content)
  quarantined   boolean NOT NULL DEFAULT false,           -- disabled pending re-review after a manifest change
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
