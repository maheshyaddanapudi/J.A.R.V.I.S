import type { ChatEvent, ChatRequest } from "./schema.js";

/**
 * Provider adapter contract. Adapters translate the neutral schema to one wire
 * format. They must NOT implement routing, privacy, fallback, or audit —
 * that's the router's job (separation keeps the trust logic in one place).
 */
export interface ProviderAdapter {
  readonly id: string;
  readonly kind: "ollama" | "anthropic" | "openai_compat";
  /** true = serving from this machine; false = remote egress (gated) */
  readonly local: boolean;

  chatStream(req: ChatRequest, model: string, signal?: AbortSignal): AsyncGenerator<ChatEvent>;

  /** optional capability — throws NotSupported when absent */
  embed?(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]>;

  /** cheap reachability probe for /gateway/status */
  ping(signal?: AbortSignal): Promise<{ ok: boolean; detail: string }>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
