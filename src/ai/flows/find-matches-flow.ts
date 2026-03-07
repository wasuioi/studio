'use server';
/**
 * @fileOverview Weighted Matching Engine for TrueVibe.
 * Calculates compatibility using persona-to-persona alignment and category weights.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  persona: z.object({
    summary: z.string(),
    tags: z.array(z.string()),
  }).optional(),
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
    weights: z.object({
      career: z.number(),
      lifestyle: z.number(),
      emotionalIntelligence: z.number(),
      humor: z.number(),
      physicalActivity: z.number(),
    }),
  }),
  potentialMatches: z.array(ProfileSchema),
});

const MatchResultSchema = z.object({
  targetUserId: z.string(),
  score: z.number().min(0).max(100),
  reason: z.string().describe('A 1-2 sentence explanation focusing on why their vibes match based on user weights.'),
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
  prompt: `You are a high-end Relationship Psychologist and Matching Specialist. 
Your task is to calculate compatibility scores (0-100) between a User and Potential Matches.

## Matching Logic:
1. **Core Alignment**: Compare the User's 'Ideal Partner' profile against the Potential Match's persona.
2. **Weighted Priority**: Use the User's Weights (1-5) to prioritize certain categories. 
   - If User weights 'Emotional Intelligence' as 5, a match with high EQ scores much higher.
   - If 'Career' is weighted 1, differences in ambition are less penalized.
3. **Vibe Match**: Look for overlap in 'Trait Tags'.

## User Profile:
Name: {{{currentUser.name}}}
Persona: {{{currentUser.persona.summary}}}
Tags: {{#each currentUser.persona.tags}}{{{this}}}, {{/each}}

## User's Ideal Partner:
Desire: {{{currentUser.ideal_partner.summary}}}
Ideal Tags: {{#each currentUser.ideal_partner.tags}}{{{this}}}, {{/each}}
Weights (Priority):
- Career: {{{currentUser.weights.career}}}
- Lifestyle: {{{currentUser.weights.lifestyle}}}
- EQ: {{{currentUser.weights.emotionalIntelligence}}}
- Humor: {{{currentUser.weights.humor}}}
- Activity: {{{currentUser.weights.physicalActivity}}}

## Potential Matches:
{{#each potentialMatches}}
---
ID: {{{this.id}}}
Name: {{{this.name}}}
Summary: {{{this.summary}}}
{{/each}}

Rank matches by score and provide a concise reason for the vibe match.`,
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