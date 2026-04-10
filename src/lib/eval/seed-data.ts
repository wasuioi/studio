import type { EvalPair, Strategy } from './types';

// 4 hardcoded pairs with fake expected scores. Edit these from the /eval UI to relabel.
// Each pair exercises a different scoring mechanic:
//   p1: high match (both secure, aligned core values)
//   p2: deal-breaker (anxious + avoidant → score 0)
//   p3: medium match (partial tag overlap)
//   p4: asymmetric (user loves match, match wouldn't love user back)
export const seedPairs: EvalPair[] = [
  {
    id: 'p1-secure-secure-aligned',
    label: 'High match: secure + secure, aligned core values',
    currentUser: {
      id: 'p1-user',
      name: 'Alex',
      persona: { summary: 'Thoughtful creative who values long conversations.', tags: ['creative', 'introspective', 'loyal'] },
      ideal_partner: { summary: 'Someone emotionally available and curious.', tags: ['curious', 'kind', 'secure'] },
      psychological_insights: {
        attachmentStyle: 'secure',
        coreValueVsSurfaceDesire: { surface: 'fun dates', core: 'being deeply understood' },
        shadowSelf: { silentDealBreakers: ['dishonesty'], recurringNeeds: 'emotional attunement' },
        behavioralInsights: 'Writes long thoughtful messages.',
      },
      summary: 'Alex, 28, writer and climber.',
    },
    candidates: [
      {
        id: 'p1-c1',
        name: 'Sam',
        persona: { summary: 'Warm, grounded, emotionally present.', tags: ['curious', 'kind', 'secure'] },
        ideal_partner: { summary: 'A creative who loves deep conversation.', tags: ['creative', 'introspective', 'loyal'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Sam, 29, therapist.',
      },
    ],
    expected: [
      {
        candidateId: 'p1-c1',
        expectedFinalScore: 90,
        expectedReasoning: 'Secure+secure with full mutual tag fit and core need alignment.',
        shouldTriggerDealBreaker: false,
      },
    ],
  },

  {
    id: 'p2-anxious-avoidant-dealbreaker',
    label: 'Deal-breaker: anxious + avoidant (score 0)',
    currentUser: {
      id: 'p2-user',
      name: 'Jordan',
      persona: { summary: 'Needs reassurance and closeness.', tags: ['loyal', 'affectionate'] },
      ideal_partner: { summary: 'Someone who shows up consistently.', tags: ['consistent', 'warm'] },
      psychological_insights: {
        attachmentStyle: 'anxious',
        coreValueVsSurfaceDesire: { core: 'reliable closeness' },
        shadowSelf: { silentDealBreakers: ['emotional unavailability'] },
      },
      summary: 'Jordan, 26.',
    },
    candidates: [
      {
        id: 'p2-c1',
        name: 'Riley',
        persona: { summary: 'Values independence above all; slow to open up.', tags: ['independent', 'reserved'] },
        ideal_partner: { summary: 'Someone who respects space.', tags: ['independent'] },
        psychological_insights: { attachmentStyle: 'avoidant' },
        summary: 'Riley, 30.',
      },
    ],
    expected: [
      {
        candidateId: 'p2-c1',
        expectedFinalScore: 0,
        expectedReasoning: 'Anxious + avoidant = hard deal-breaker per rubric.',
        shouldTriggerDealBreaker: true,
      },
    ],
  },

  {
    id: 'p3-medium-partial-overlap',
    label: 'Medium match: partial tag overlap',
    currentUser: {
      id: 'p3-user',
      name: 'Taylor',
      persona: { summary: 'Outdoorsy, spontaneous.', tags: ['adventurous', 'optimistic', 'artistic'] },
      ideal_partner: { summary: 'Someone adventurous and grounded.', tags: ['adventurous', 'grounded'] },
      psychological_insights: { attachmentStyle: 'secure' },
      summary: 'Taylor, 31.',
    },
    candidates: [
      {
        id: 'p3-c1',
        name: 'Morgan',
        persona: { summary: 'Adventurous but also needs quiet time.', tags: ['adventurous', 'quiet'] },
        ideal_partner: { summary: 'Spontaneous type who also likes art.', tags: ['spontaneous', 'artistic'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Morgan, 29.',
      },
      {
        id: 'p3-c2',
        name: 'Casey',
        persona: { summary: 'Homebody, analytical.', tags: ['analytical', 'calm'] },
        ideal_partner: { summary: 'Someone who pulls them out of their shell.', tags: ['extroverted'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Casey, 32.',
      },
    ],
    expected: [
      {
        candidateId: 'p3-c1',
        expectedFinalScore: 65,
        expectedReasoning: 'One shared core tag (adventurous) + partial reciprocity (artistic matches).',
        shouldTriggerDealBreaker: false,
      },
      {
        candidateId: 'p3-c2',
        expectedFinalScore: 30,
        expectedReasoning: 'Little tag overlap, lifestyles mismatch.',
        shouldTriggerDealBreaker: false,
      },
    ],
  },

  {
    id: 'p4-asymmetric',
    label: 'Asymmetric: user loves match, match would not love user back',
    currentUser: {
      id: 'p4-user',
      name: 'Avery',
      persona: { summary: 'Loud, impulsive, party lover.', tags: ['loud', 'spontaneous'] },
      ideal_partner: { summary: 'A calm, grounded intellectual.', tags: ['calm', 'grounded', 'intellectual'] },
      psychological_insights: { attachmentStyle: 'secure' },
      summary: 'Avery, 27.',
    },
    candidates: [
      {
        id: 'p4-c1',
        name: 'Quinn',
        persona: { summary: 'Calm, grounded intellectual.', tags: ['calm', 'grounded', 'intellectual'] },
        ideal_partner: { summary: 'Quiet, introspective, low-key.', tags: ['quiet', 'introspective'] },
        psychological_insights: { attachmentStyle: 'secure' },
        summary: 'Quinn, 30.',
      },
    ],
    expected: [
      {
        candidateId: 'p4-c1',
        expectedFinalScore: 45,
        expectedReasoning: 'User fulfilled (high unidirectional) but reciprocity is low — Quinn would not feel fulfilled by Avery. The 50/50 formula pulls the final score down.',
        shouldTriggerDealBreaker: false,
      },
    ],
  },
];

// 4 default strategies seeded on first load. Match the price table in model-prices.ts.
export const seedStrategies: Strategy[] = [
  {
    id: 'gemini-flash-default',
    name: 'Gemini 2.5 Flash (default)',
    model: 'google/gemini-2.5-flash',
    promptVariant: 'default',
    runCount: 1,
  },
  {
    id: 'claude-sonnet-default',
    name: 'Claude 3.5 Sonnet (default)',
    model: 'anthropic/claude-3.5-sonnet',
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
