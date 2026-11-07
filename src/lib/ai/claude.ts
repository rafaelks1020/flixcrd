import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/** Modelo padrão: Haiku (barato e rápido para classificar nome de arquivo e gerar texto curto). */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL?.trim() || "claude-haiku-5-5";

let client: Anthropic | null = null;

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function getClient(): Anthropic {
  if (!claudeConfigured()) {
    throw new ClaudeNotConfiguredError();
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  }
  return client;
}

export class ClaudeNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY não configurada no servidor.");
  }
}

export class ClaudeRefusalError extends Error {
  constructor() {
    super("A IA recusou a solicitação.");
  }
}

/**
 * Chamada única com saída JSON validada pelo schema Zod (structured outputs).
 * Lança ClaudeNotConfiguredError, ClaudeRefusalError ou erros do SDK (Anthropic.APIError).
 */
export async function claudeJson<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const response = await getClient().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { effort: "low", format: zodOutputFormat(opts.schema) },
  });

  if (response.stop_reason === "refusal") throw new ClaudeRefusalError();
  if (response.parsed_output == null) {
    throw new Error(`Resposta da IA fora do formato (stop_reason=${response.stop_reason}).`);
  }
  return response.parsed_output as z.infer<T>;
}
