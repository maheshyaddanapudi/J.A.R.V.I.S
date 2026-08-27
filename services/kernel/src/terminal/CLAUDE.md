# kernel/src/terminal — terminal-with-policy (Phase 2)

A **REAL** shell-command capability (`bash -lc`), the Phase-2 "terminal with
policy" pillar — not a simulator. It is high-risk, so it is the most tightly gated
capability after physical devices.

## Files
- `contract.ts` — `TerminalRunner` interface + `CommandResult`.
- `policy.ts` — `assessCommand(command)` → `read_only` | `consequential` | `denied`:
  - **DENY** (refused outright, clean pre-approval denial): privilege escalation
    (`sudo`/`su`/`doas`), recursive force-delete of `/`~`/`$HOME`/`..`/`*`, disk
    wipes (`mkfs`/`dd of=/dev`/`shred`/`fdisk`), fork bombs, `shutdown`/`reboot`,
    pipe-download-to-shell (`curl … | bash`), world-writable root chmod, offensive
    tooling (`nmap`/`sqlmap`/…), credential exfil (`cat ~/.ssh/id_rsa`),
    malware terms, disabling firewall/audit. Mirrors the trust-core PROHIBITED
    semantics applied to the command text.
  - **READ_ONLY** (auto-run): a small conservative allowlist that can't read
    arbitrary files, mutate, escalate, or reach the network — `pwd`, `whoami`,
    `uname`, `hostname`, `uptime`, `df`, `free`, `ls` (relative paths only),
    `git status|log|diff|branch|show|rev-parse|…`, `node|npm|pnpm|python3 --version`.
    Any shell operator (`|`, `>`, `;`, `&&`, `` ` ``, `$( )`) disqualifies READ_ONLY
    so a safe prefix can't smuggle an unsafe suffix.
  - **CONSEQUENTIAL** (per-command approval): everything else.
- `runner.ts` — `LocalTerminal`: `execFile('/bin/bash', ['-lc', cmd])` with the
  working dir **confined to the workspace root**, a hard timeout (default 20s, max
  120s; timeout → exit 124), and bounded output (1 MiB buffer, 20k chars/stream).
- `tools.ts` — two gated tools mapping the policy onto static risk classes:
  `terminal.inspect` (READ_ONLY — only accepts `read_only` commands, else clean
  denial) and `terminal.run` (CONSEQUENTIAL — DENY refused before approval, the
  rest approval-gated). Command output is fed to the agent as `detail` (D-0033);
  the audit records only the summary — **command output stays local**.

## Verified (2026-07-17)
- 14 tests (`test/terminal.test.ts`): policy assessment (read-only allowlist,
  denylist, operator-disqualification, `ls` path scoping) + REAL shell (real
  output, honest exit codes, cwd confinement, timeout kill) + gated loop
  (`inspect` auto-runs safe / refuses unsafe; `run` denies dangerous before
  approval, requires approval, executes when approved). Full suite **170 pass**.
- Live end-to-end: `terminal.inspect ls -la` auto-ran (real listing);
  `terminal.inspect rm …` refused; `terminal.run sudo rm -rf /` refused before
  approval; `terminal.run echo … > proof.txt` approved → the file was really
  written. Harness row **P-TERM-01**.

## Real-adapter note
REAL in-container already. On the Mac it's the same runner (a login `bash`);
macOS TCC may prompt for disk/automation access the first time a command touches
protected paths — documented in the Mac bring-up.
