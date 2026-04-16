// USD per 1M tokens + context window in tokens.
// Values are approximate — used for pre-run cost preview and context-window overflow checks.
// Verify against https://openrouter.ai/models at implementation time and update if stale.

export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
  contextWindow: number;   // total tokens (input + output)
}

export const modelPrices: Record<string, ModelPrice> = {
  'google/gemini-2.5-flash':        { inputPerM: 0.075, outputPerM: 0.30, contextWindow: 1_000_000 },
  'anthropic/claude-sonnet-4':      { inputPerM: 3.0,   outputPerM: 15.0, contextWindow: 200_000 },
  'openai/gpt-4o-mini':             { inputPerM: 0.15,  outputPerM: 0.60, contextWindow: 128_000 },
  'meta-llama/llama-3-8b-instruct': { inputPerM: 0.05,  outputPerM: 0.08, contextWindow: 8_192 },
};

// Cost in USD for a single call given measured token usage. Null if model unknown.
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const price = modelPrices[model];
  if (!price) return null;
  return (promptTokens * price.inputPerM + completionTokens * price.outputPerM) / 1_000_000;
}

// Rough pre-run token estimate. GPT tokenizer averages ~4 chars per token for English.
// Used by plan-sweep.ts for context-window overflow checks and cost preview.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
