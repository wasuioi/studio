// src/lib/dev-tools/fixtures/fake-matches.ts
// DEV-ONLY. Used by devSeedDemoProfile to populate profiles.top_matches so the
// /matches page has visible cards without needing real users in the DB.
// Matches the shape that src/app/matches/page.tsx reads (match.id, name,
// photoURL, summary, score, reason).

// Unsplash portrait URLs (CC0) — used instead of picsum because picsum returns
// random stock photos (landscapes, objects) that look absurd on a dating app.
// The `?w=400&h=500&fit=crop` transform gives us a consistent 4:5 portrait.
const UNSPLASH = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?w=400&h=500&fit=crop&auto=format`;

export const FAKE_MATCHES = [
  {
    id: 'fake-match-001',
    name: 'Mila',
    photoURL: UNSPLASH('photo-1544005313-94ddf0286df2'),
    summary:
      'Curator at a small gallery, weekend potter, fiercely loyal once she decides you are worth it.',
    score: 94,
    reason:
      'Mirrors your taste for slow mornings and big conversations; her "kindness over performance" value lines up with your core need.',
  },
  {
    id: 'fake-match-002',
    name: 'Dao',
    photoURL: UNSPLASH('photo-1438761681033-6461ffad8d80'),
    summary:
      'Architect who reads history for fun and keeps a running list of places to take the person she likes.',
    score: 89,
    reason:
      'Shares your preference for depth over breadth socially; her thoughtful planning complements your independent streak.',
  },
  {
    id: 'fake-match-003',
    name: 'Noah',
    photoURL: UNSPLASH('photo-1507003211169-0a1dd7228f2d'),
    summary:
      'Backend engineer who cooks through cookbooks cover-to-cover. Calm, curious, terrible at small talk in a charming way.',
    score: 85,
    reason:
      'His quiet consistency matches the "consistent emotional presence" you said you actually need.',
  },
  {
    id: 'fake-match-004',
    name: 'Pim',
    photoURL: UNSPLASH('photo-1531123897727-8f129e1688ce'),
    summary:
      'Film editor with a soft spot for rainy days, long playlists, and dogs she does not own.',
    score: 82,
    reason:
      'Her creative rhythm and honesty-first communication line up with your "dishonesty is a dealbreaker" rule.',
  },
  {
    id: 'fake-match-005',
    name: 'Ari',
    photoURL: UNSPLASH('photo-1500648767791-00dcc994a43e'),
    summary:
      'Data scientist and part-time climbing instructor. Direct, warm, asks the question nobody else wants to ask.',
    score: 78,
    reason:
      'Ari brings the grounded curiosity from your ideal partner description without dialing down your independence.',
  },
] as const;
