import type { EvalRow, PromptVariant } from './types';

export interface PromptInput {
  profileA: string;
  profileB: string;
}

// Helper: build a PromptInput from an EvalRow (drops unrelated fields).
export function promptInputFromRow(row: EvalRow): PromptInput {
  return { profileA: row.profileA, profileB: row.profileB };
}

// Registry: variant name → function that produces the full prompt string.
export const promptVariants: Record<PromptVariant, (input: PromptInput) => string> = {
  default: buildDefaultPrompt,
  simplified: buildSimplifiedPrompt,
};

function buildDefaultPrompt({ profileA, profileB }: PromptInput): string {
  return `You are an expert relationship psychologist.

Given two profiles, score their compatibility from 0 (zero chance this works) to 100 (perfect match).
Consider values, lifestyle, emotional availability, and long-term potential.

Profile A:
${profileA}

Profile B:
${profileB}

Return STRICT JSON with no markdown:
{
  "score": <integer 0-100>,
  "reasoning": "<2-4 sentences explaining the score>"
}`;
}

function buildSimplifiedPrompt({ profileA, profileB }: PromptInput): string {
  return `Score 0-100 how compatible these two people are.

A: ${profileA}
B: ${profileB}

JSON: {"score": N, "reasoning": "text"}`;
}
