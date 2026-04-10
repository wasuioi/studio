// USD per 1M tokens. Extend as you add more models.
// Sources: OpenRouter pricing page as of 2026-04-10. Values are approximate —
// cost displays in the UI are "directional", not invoices.

export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
}

export const modelPrices: Record<string, ModelPrice> = {
  'google/gemini-2.5-flash': { inputPerM: 0.075, outputPerM: 0.30 },
  'anthropic/claude-3.5-sonnet': { inputPerM: 3.0, outputPerM: 15.0 },
  'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.60 },
  'meta-llama/llama-3-8b-instruct': { inputPerM: 0.05, outputPerM: 0.08 },
};

// Compute cost in USD from token counts. Returns null if the model isn't in the table.
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const price = modelPrices[model];
  if (!price) return null;
  return (promptTokens * price.inputPerM + completionTokens * price.outputPerM) / 1_000_000;
}
