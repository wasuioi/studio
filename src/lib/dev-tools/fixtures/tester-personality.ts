// src/lib/dev-tools/fixtures/tester-personality.ts
// DEV-ONLY. Shape mirrors the personalityProfile object returned by Vera.
// If the real schema changes, update this fixture too.

export const TESTER_PERSONALITY = {
  user_persona: {
    summary:
      'Warm, thoughtful, and independent. Alex balances a creative career with deep friendships and values honesty above almost everything else.',
    tags: ['Warm', 'Independent', 'Creative', 'Honest'],
  },
  ideal_partner: {
    summary:
      'Someone grounded and curious who welcomes slow mornings and big conversations. Kindness first, wit a close second.',
    tags: ['Kind', 'Curious', 'Grounded', 'Witty'],
  },
  psychological_insights: {
    attachmentStyle: 'Secure-leaning',
    coreNeed: 'Consistent emotional presence, not performative grand gestures.',
    behavioralInsights:
      'Prefers one-on-one depth over group socializing; loyal once trust is established.',
  },
} as const;
