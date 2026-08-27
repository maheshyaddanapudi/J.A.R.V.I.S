import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { AuditLog, redactSecrets } from "../src/core/audit.js";

const dbUrl =
  process.env.JARVIS_TEST_DATABASE_URL ??
  "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";

let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  /* skip */
}

describe("redactSecrets (unit)", () => {
  it("redacts api-key-shaped tokens and key:value secrets", () => {
    expect(redactSecrets("my key is sk-abcdefgh12345")).toContain("<REDACTED>");
    expect(redactSecrets("my key is sk-abcdefgh12345")).not.toContain("abcdefgh12345");
    expect(redactSecrets('{"password":"hunter2xyz"}')).not.toContain("hunter2xyz");
    expect(redactSecrets("token = supersecretvalue")).toContain("<REDACTED>");
  });
  it("leaves ordinary text intact", () => {
    expect(redactSecrets("write hello.txt with content world")).toBe(
      "write hello.txt with content world",
    );
  });
});

describe.skipIf(!pool)("AuditLog hash chain (integration)", () => {
  const audit = new AuditLog(pool!);

  beforeAll(async () => {
    await pool!.query(`CREATE TABLE IF NOT EXISTS audit_log (
      seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      at timestamptz NOT NULL DEFAULT now(),
      actor text NOT NULL, event text NOT NULL, payload jsonb NOT NULL,
      prev_hash text NOT NULL, chain_hash text NOT NULL)`);
  });
  beforeEach(async () => {
    await pool!.query("TRUNCATE audit_log RESTART IDENTITY");
  });
  afterAll(async () => {
    // Do NOT drop audit_log — it is a migrated table SHARED with the rest of the
    // suite (serial file execution). Dropping it here used to leave every later
    // file that uses a real AuditLog with "relation audit_log does not exist".
    await pool!.query("TRUNCATE audit_log RESTART IDENTITY");
    await pool!.end();
  });

  it("chains entries and verifies intact", async () => {
    await audit.append({ actor: "kernel", event: "a", payload: { n: 1 } });
    await audit.append({ actor: "kernel", event: "b", payload: { n: 2 } });
    await audit.append({ actor: "user", event: "c", payload: { n: 3 } });
    const v = await audit.verifyChain();
    expect(v).toMatchObject({ intact: true, brokenAtSeq: null, entries: 3 });
  });

  it("detects tampering with a historical row", async () => {
    await audit.append({ actor: "kernel", event: "a", payload: { n: 1 } });
    await audit.append({ actor: "kernel", event: "b", payload: { amount: 5 } });
    await audit.append({ actor: "kernel", event: "c", payload: { n: 3 } });
    // tamper: change row 2's payload without recomputing the chain
    await pool!.query(`UPDATE audit_log SET payload = '{"amount": 5000}'::jsonb WHERE seq = 2`);
    const v = await audit.verifyChain();
    expect(v.intact).toBe(false);
    expect(v.brokenAtSeq).toBe(2);
  });

  it("redacts secrets before persisting", async () => {
    await audit.append({
      actor: "kernel",
      event: "tool_call",
      payload: { note: "api_key=sk-verysecret123 in the file" },
    });
    const { rows } = await pool!.query<{ payload: { note: string } }>(
      "SELECT payload FROM audit_log WHERE seq = 1",
    );
    expect(rows[0]!.payload.note).not.toContain("sk-verysecret123");
    expect(rows[0]!.payload.note).toContain("<REDACTED>");
  });
});
