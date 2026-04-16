import type { EvalRow, Strategy } from './types';

// 4 hardcoded test rows, each exercising a different compatibility pattern.
// Expected scores are placeholder starting values — relabel from the /eval UI.
export const seedRows: EvalRow[] = [
  {
    id: 'r1-high-match',
    label: 'High match: aligned introverts',
    profileA:
      'Alex, 28. Quiet writer and climber. Values deep conversation over small talk. Looking for someone who reads books and wants to build a calm, stable life together. Secure attachment style.',
    profileB:
      'Sam, 29. Therapist. Warm and emotionally present. Enjoys slow mornings, hiking, and long honest talks. Looking for a creative, introspective partner who values emotional attunement. Secure attachment.',
    expected: {
      score: 90,
      reasoning:
        'Both secure, aligned core values (depth, calm, creativity), mutual fit on lifestyle and attachment style.',
    },
    tags: ['high-match', 'secure-secure', 'aligned'],
  },

  {
    id: 'r2-deal-breaker',
    label: 'Deal-breaker: anxious + avoidant',
    profileA:
      'Jordan, 26. Affectionate and needs reassurance. Gets anxious when partners go silent for more than a day. Looking for someone warm, consistent, and emotionally available.',
    profileB:
      'Riley, 30. Values independence above all. Slow to open up, needs lots of alone time, uncomfortable with frequent check-ins. Looking for someone who respects space.',
    expected: {
      score: 10,
      reasoning:
        'Classic anxious + avoidant pairing. Jordan needs the reassurance Riley is wired to withhold, creating a predictable cycle of frustration.',
    },
    tags: ['deal-breaker', 'anxious-avoidant', 'attachment-mismatch'],
  },

  {
    id: 'r3-medium',
    label: 'Medium match: partial overlap',
    profileA:
      'Taylor, 31. Outdoorsy, spontaneous, loves art and music festivals. Looking for an adventurous partner who is also grounded and calm.',
    profileB:
      'Morgan, 29. Enjoys hiking and climbing on weekends but also needs significant quiet time. Introverted; recharges alone. Looking for someone spontaneous who also appreciates downtime.',
    expected: {
      score: 65,
      reasoning:
        'Shared adventure tag and lifestyle compatibility, but Taylor wants high-energy social fun while Morgan needs quiet recharge — possible friction around pace.',
    },
    tags: ['medium-match', 'partial-overlap'],
  },

  {
    id: 'r4-asymmetric',
    label: 'Asymmetric: one-sided attraction',
    profileA:
      'Avery, 27. Loud, impulsive party lover. Looking for a calm, grounded intellectual to balance their energy.',
    profileB:
      'Quinn, 30. Calm, grounded intellectual. Dislikes loud environments and social chaos. Looking for a quiet, introspective partner.',
    expected: {
      score: 35,
      reasoning:
        'Avery would find Quinn fulfilling, but Quinn would find Avery exhausting. One-sided compatibility lowers the overall score.',
    },
    tags: ['asymmetric', 'reciprocity-test'],
  },
];

// 4 default strategies seeded on first load. All models are keys in modelPrices.
// Sonnet fix: 'claude-sonnet-4' replaces the deprecated 'claude-3.5-sonnet' from v1.
export const seedStrategies: Strategy[] = [
  {
    id: 'gemini-flash-default',
    name: 'Gemini 2.5 Flash (default)',
    model: 'google/gemini-2.5-flash',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4 (default)',
    model: 'anthropic/claude-sonnet-4',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'gpt-4o-mini-default',
    name: 'GPT-4o mini (default)',
    model: 'openai/gpt-4o-mini',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'llama-3-8b-budget',
    name: 'Llama 3 8B (budget)',
    model: 'meta-llama/llama-3-8b-instruct',
    promptVariant: 'default',
    runCount: 1,
  },
];
