/**
 * Command safety policy for the terminal capability. Three verdicts:
 *   - "denied"        → dangerous/prohibited; refused outright (never offered for
 *                       approval), a clean pre-approval denial.
 *   - "read_only"     → a small, conservative allowlist of safe inspections that
 *                       cannot read arbitrary files, mutate, escalate, or reach the
 *                       network; auto-runs (READ_ONLY class).
 *   - "consequential" → everything else; requires per-command approval.
 *
 * The policy is deliberately conservative: when in doubt a command is
 * CONSEQUENTIAL (approval), and anything matching the denylist is refused. Shell
 * operators (pipes, redirects, chaining, command substitution) disqualify a
 * command from READ_ONLY so a safe prefix can't smuggle an unsafe suffix.
 */

export type Verdict = "read_only" | "consequential" | "denied";

export interface Assessment {
  verdict: Verdict;
  reason?: string;
  ruleId?: string;
}

/** Refused outright — dangerous, destructive, privilege-escalating, or prohibited. */
const DENY: { id: string; re: RegExp }[] = [
  { id: "privilege_escalation", re: /\b(sudo|doas|pkexec|su)\b/i },
  { id: "recursive_force_delete", re: /\brm\b[^\n]*-[a-z]*(rf|fr)[^\n]*(\s|=)(\/|~|\$HOME|\.\.|\*)/i },
  { id: "disk_wipe", re: /\b(mkfs\S*|wipefs|shred|fdisk|parted|blkdiscard)\b/i },
  { id: "dd_to_device", re: /\bdd\b[^\n]*\bof=\/dev\//i },
  { id: "write_block_device", re: />\s*\/dev\/(sd|nvme|disk|hd)/i },
  { id: "fork_bomb", re: /\(\s*\)\s*\{[^}]*[:|][^}]*&[^}]*\}/ },
  { id: "shutdown", re: /\b(shutdown|reboot|halt|poweroff|init\s+0|init\s+6)\b/i },
  { id: "pipe_download_to_shell", re: /\b(curl|wget|fetch)\b[^\n|]*\|\s*(sudo\s+)?(bash|sh|zsh|ksh|python3?|node|perl|ruby)\b/i },
  { id: "chmod_world_writable_root", re: /\bchmod\b[^\n]*(777|a\+rwx)\b[^\n]*(\/|~|\$HOME)/i },
  { id: "kill_everything", re: /\bkill(all)?\b[^\n]*-9[^\n]*\b(-1|1)\b/i },
  { id: "history_wipe", re: /\bhistory\s+-c\b|>\s*~\/\.bash_history/i },
  // trust-core prohibited semantics (mirrors policy PROHIBITED, applied to the command text)
  { id: "offensive_security_tooling", re: /\b(nmap|masscan|sqlmap|hydra|hashcat|john|metasploit|msfconsole|aircrack)\b/i },
  { id: "credential_exfiltration", re: /\b(cat|cp|scp|curl|tar)\b[^\n]*(id_rsa|id_ed25519|\.ssh\/|\.aws\/credentials|\.env\b)/i },
  { id: "malware_terms", re: /\b(keylogger|rootkit|ransomware|backdoor)\b/i },
  { id: "disable_safety", re: /\b(iptables\s+-F|ufw\s+disable|systemctl\s+stop\s+\S*(firewall|audit))/i },
];

/**
 * READ_ONLY allowlist: base program → predicate over the tokenized args. Only
 * commands that report state without reading arbitrary files, mutating, escalating,
 * or reaching the network. `ls` is allowed but only for relative paths.
 */
const READ_ONLY: Record<string, (args: string[]) => boolean> = {
  pwd: () => true,
  whoami: () => true,
  id: () => true,
  date: () => true,
  uname: () => true,
  hostname: () => true,
  uptime: () => true,
  arch: () => true,
  df: () => true,
  free: () => true,
  ls: (args) => args.every((a) => a.startsWith("-") || (!a.startsWith("/") && !a.includes(".."))),
  node: (args) => args.length === 1 && /^(--version|-v)$/.test(args[0]!),
  npm: (args) => args.length === 1 && /^(--version|-v)$/.test(args[0]!),
  pnpm: (args) => args.length === 1 && /^(--version|-v)$/.test(args[0]!),
  python3: (args) => args.length === 1 && /^(--version|-V)$/.test(args[0]!),
  git: (args) =>
    args.length > 0 &&
    ["status", "log", "diff", "branch", "show", "remote", "rev-parse", "describe", "config"].includes(args[0]!) &&
    // `git config` is read-only only when just listing
    (args[0] !== "config" || args.includes("--list") || args.includes("-l")),
};

const SHELL_OPERATORS = /[|&;<>`]|\$\(|\|\||&&|\n/;

/** Assess a single command string. */
export function assessCommand(command: string): Assessment {
  const cmd = command.trim();
  if (!cmd) return { verdict: "denied", reason: "empty command" };

  for (const rule of DENY) {
    if (rule.re.test(cmd)) {
      return { verdict: "denied", reason: rule.id, ruleId: rule.id };
    }
  }

  // Shell operators can't be safely classified as read-only.
  if (!SHELL_OPERATORS.test(cmd)) {
    const tokens = cmd.split(/\s+/);
    const prog = (tokens[0] ?? "").split("/").pop() ?? "";
    const predicate = READ_ONLY[prog];
    if (predicate && predicate(tokens.slice(1))) {
      return { verdict: "read_only" };
    }
  }

  return { verdict: "consequential" };
}
