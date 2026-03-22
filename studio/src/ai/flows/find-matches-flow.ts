'use server';
/**
 * @fileOverview Weighted Matching Engine for TrueVibe.
 * Calculates compatibility using persona-to-persona alignment and psychological insights.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const PsychologicalInsightsSchema = z.object({
  attachmentStyle: z.string().optional(),
  coreValueVsSurfaceDesire: z.object({
    surface: z.string().optional(),
    core: z.string().optional(),
  }).optional(),
  shadowSelf: z.object({
    silentDealBreakers: z.array(z.string()).optional(),
    recurringNeeds: z.string().optional(),
  }).optional(),
  behavioralInsights: z.string().optional(),
});

const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  persona: z.object({
    summary: z.string(),
    tags: z.array(z.string()),
  }).optional(),
  ideal_partner: z.object({
    summary: z.string(),
    tags: z.array(z.string()),
  }).optional(),
  psychological_insights: PsychologicalInsightsSchema.optional(),
  summary: z.string().describe('Full descriptive summary of the potential match.'),
});

const FindMatchesInputSchema = z.object({
  currentUser: z.object({
    id: z.string(),
    name: z.string(),
    persona: z.object({
      summary: z.string(),
      tags: z.array(z.string()),
    }),
    ideal_partner: z.object({
      summary: z.string(),
      tags: z.array(z.string()),
    }),
    psychological_insights: PsychologicalInsightsSchema.optional(),
  }),
  potentialMatches: z.array(ProfileSchema),
});

const MatchResultSchema = z.object({
  targetUserId: z.string(),
  unidirectionalScore: z.number().min(0).max(100).describe('How fulfilling the match is for the user (one-way)'),
  reciprocityScore: z.number().min(0).max(100).describe('Mutual compatibility: how well the user fits the match too'),
  finalScore: z.number().min(0).max(100).describe('Final score: 50% reciprocity + 50% unidirectional (mutual fulfillment matters most)'),
  failReason: z.string().optional().describe('If score is 0 due to deal-breaker, explain why'),
  reason: z.string().describe('A 2-3 sentence explanation focusing on why their vibes match based on psychological compatibility.'),
});

const FindMatchesOutputSchema = z.object({
  matches: z.array(MatchResultSchema),
});

export async function findMatches(input: z.infer<typeof FindMatchesInputSchema>): Promise<z.infer<typeof FindMatchesOutputSchema>> {
  return findMatchesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findMatchesPrompt',
  input: { schema: FindMatchesInputSchema },
  output: { schema: FindMatchesOutputSchema },
  prompt: `You are a high-end Relationship Psychologist and Matching Specialist for TrueVibe.
Your task is to calculate compatibility scores (0-100) between a User and Potential Matches.

## CRITICAL: Reciprocity First Philosophy
The most fulfilling matches are MUTUAL. A match where the user finds them fulfilling but they wouldn't find the user fulfilling leads to rejection, frustration, and wasted time.
You MUST calculate BOTH directions:
1. How fulfilled the user would feel with this match (unidirectional)
2. How likely the match would also feel fulfilled by the user (reciprocity) — check if the user's persona matches the match's ideal_partner profile

## Explicit Scoring Rubric (Use This!)

### Attachment Style Compatibility Matrix (+25 points max)
| User \\ Match | Secure | Anxious | Avoidant |
|--------------|--------|---------|----------|
| Secure       | +25    | +20     | +10      |
| Anxious      | +20    | +15     | -20      |
| Avoidant     | +10    | -20     | +20      |

### Core Value Alignment (+20 points max)
- Match addresses user's CORE need (not just surface want): +20
- Partial alignment: +10
- No alignment: 0

### Ideal Partner Fit (+20 points max)
- User's persona matches match's ideal_partner: +20
- 2-3 tag overlap: +12
- 1 tag overlap: +5
- No overlap: 0

### Shadow Self Check (+10 points max)
- Match addresses user's recurring needs: +10
- No conflict but no alignment: +3
- Match triggers silent deal-breaker: **FAIL** (score = 0, explain in failReason)

### Vibe/Communication (+5 points max)
- Behavioral insights align: +5

## Deal-Breaker Fail-Fast Rules (Score = 0)
If ANY of these are true, the match is automatically disqualified:
1. Match's persona triggers user's silent deal-breakers (from shadowSelf.silentDealBreakers)
2. User's persona contains match's explicit deal-breakers (check each match's ideal_partner)
3. Attachment style conflict: Anxious + Avoidant pairing

## Reciprocity Calculation
For each potential match, also evaluate:
"Would {{{this.name}}} find {{{currentUser.name}}} fulfilling?"
- Check if currentUser's persona matches the potential match's ideal_partner
- Check if currentUser's psychological profile is compatible with what the match likely needs

## Final Score Formula
finalScore = (reciprocityScore * 0.5) + (unidirectionalScore * 0.5)
Rationale: A match where BOTH people feel fulfilled is 50% more valuable than one-way fulfillment.

## Current User Profile:
Name: {{{currentUser.name}}}
Persona: {{{currentUser.persona.summary}}}
Tags: {{#each currentUser.persona.tags}}{{{this}}}, {{/each}}

## User's Ideal Partner:
Desire: {{{currentUser.ideal_partner.summary}}}
Ideal Tags: {{#each currentUser.ideal_partner.tags}}{{{this}}}, {{/each}}

## User's Psychological Insights:
{{#if currentUser.psychological_insights}}
  Attachment Style: {{currentUser.psychological_insights.attachmentStyle}}
  Core Need: {{currentUser.psychological_insights.coreValueVsSurfaceDesire.core}}
  Silent Deal-Breakers: {{#each currentUser.psychological_insights.shadowSelf.silentDealBreakers}}{{{this}}}, {{/each}}
  Recurring Needs: {{currentUser.psychological_insights.shadowSelf.recurringNeeds}}
  Behavioral Insights: {{currentUser.psychological_insights.behavioralInsights}}
{{/if}}

## Potential Matches:
{{#each potentialMatches}}
---
ID: {{{this.id}}}
Name: {{{this.name}}}
Persona: {{{this.persona.summary}}}
Tags: {{#each this.persona.tags}}{{{this}}}, {{/each}}
Ideal Partner: {{{this.ideal_partner.summary}}}
Ideal Partner Tags: {{#each this.ideal_partner.tags}}{{{this}}}, {{/each}}
{{#if this.psychological_insights}}
  Attachment Style: {{this.psychological_insights.attachmentStyle}}
  Core Need: {{this.psychological_insights.coreValueVsSurfaceDesire.core}}
  Silent Deal-Breakers: {{#each this.psychological_insights.shadowSelf.silentDealBreakers}}{{{this}}}, {{/each}}
{{/if}}
Summary: {{{this.summary}}}
{{/each}}

For EACH potential match, calculate:
1. unidirectionalScore: How fulfilled the user would be (0-100)
2. reciprocityScore: How likely the match would also be fulfilled by the user (0-100)
3. finalScore: Weighted average
4. failReason: If score = 0, explain which deal-breaker triggered
5. reason: 2-3 sentence explanation

Rank ALL matches by finalScore (highest first). Even matches with score 0 should be listed with failReason.`,
});

const findMatchesFlow = ai.defineFlow(
  {
    name: 'findMatchesFlow',
    inputSchema: FindMatchesInputSchema,
    outputSchema: FindMatchesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);