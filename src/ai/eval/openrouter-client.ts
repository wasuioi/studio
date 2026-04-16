import 'server-only';
import { EvalConfigError } from '@/lib/eval/types';

export interface OpenRouterCallParams {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  // When true, we ask the model for JSON output. Not all OpenRouter providers honor
  // response_format strictly, so the prompt itself must also demand JSON.
  wantsJson?: boolean;
}

export interface OpenRouterCallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Thin wrapper around OpenRouter's chat/completions endpoint.
// Throws EvalConfigError if API key is missing.
// Throws a regular Error on non-2xx responses — caller (run-strategy.ts) decides how to surface it.
export async function callOpenRouter(params: OpenRouterCallParams): Promise<OpenRouterCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new EvalConfigError(
      'OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server.',
    );
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };
  if (params.wantsJson) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter requires these headers for proper routing & attribution.
      'HTTP-Referer': 'https://truevibe.local/eval',
      'X-Title': 'TrueVibe Eval Framework',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`);
  }

  type OpenRouterResponse = {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  const json = (await res.json()) as OpenRouterResponse;

  const content = json.choices?.[0]?.message?.content ?? '';
  return {
    content,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };
}
