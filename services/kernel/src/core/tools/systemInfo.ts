import { hostname, platform, arch, totalmem, freemem, uptime, loadavg } from "node:os";
import type { Tool, ToolResult } from "../tools.js";

/**
 * Phase-1 READ-ONLY tool (AT1.6). Reads REAL host state — no mock data.
 * Runs automatically (read-only class); still audited by the loop.
 */
export const systemInfoTool: Tool = {
  name: "system.info",
  description: "Report real local machine state: host, OS, CPU arch, memory, uptime, load.",
  riskClass: "READ_ONLY",
  action: "read system information",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async run(): Promise<ToolResult> {
    const gb = (b: number) => +(b / 1024 ** 3).toFixed(1);
    const data = {
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      memoryTotalGB: gb(totalmem()),
      memoryFreeGB: gb(freemem()),
      uptimeSeconds: Math.round(uptime()),
      loadAverage: loadavg().map((n) => +n.toFixed(2)),
    };
    return {
      ok: true,
      summary: `${data.hostname} · ${data.platform}/${data.arch} · ${data.memoryFreeGB}/${data.memoryTotalGB} GB free · load ${data.loadAverage[0]}`,
      data,
      detail: JSON.stringify(data),
    };
  },
};
