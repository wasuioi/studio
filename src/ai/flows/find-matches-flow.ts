
'use server';
/**
 * @fileOverview AI flow to calculate compatibility between users and suggest matches.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  traits: z.object({
    communicationStyle: z.string().optional(),
    introversionLevel: z.number().optional(),
    emotionalExpression: z.number().optional(),
    lifestyle: z.string().optional(),
    relationshipIntent: z.string().optional(),
    values: z.array(z.string()).optional(),
  }).optional(),
  summary: z.string(),
});

const FindMatchesInputSchema = z.object({
  currentUser: ProfileSchema,
  potentialMatches: z.array(ProfileSchema),
});
export type FindMatchesInput = z.infer<typeof FindMatchesInputSchema>;

const MatchResultSchema = z.object({
  targetUserId: z.string(),
  score: z.number().min(0).max(100),
  reason: z.string().describe('A short, 1-2 sentence explanation of the compatibility.'),
});

const FindMatchesOutputSchema = z.object({
  matches: z.array(MatchResultSchema),
});
export type FindMatchesOutput = z.infer<typeof FindMatchesOutputSchema>;

export async function findMatches(input: FindMatchesInput): Promise<FindMatchesOutput> {
  return findMatchesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findMatchesPrompt',
  input: { schema: FindMatchesInputSchema },
  output: { schema: FindMatchesOutputSchema },
  prompt: `You are a high-end matchmaking AI specialist. Your task is to calculate compatibility scores (0-100) between a User and a list of Potential Matches based on their detailed personality summaries and traits.

Compatibility should be based on:
1. Values Alignment: Do their core values, cultural backgrounds, and long-term goals (marriage, children) overlap?
2. Communication Style: Will their communication styles (direct vs. reflective, intellectual vs. emotional) complement each other?
3. Lifestyle Compatibility: Social vs. Homebody, Career-focused vs. Adventure-seeking, Independence vs. Togetherness needs.
4. Emotional Intelligence: Can they support each other's emotional needs and conflict resolution styles?

User Profile:
Name: {{{currentUser.name}}}
Summary: {{{currentUser.summary}}}

Potential Matches:
{{#each potentialMatches}}
---
ID: {{{this.id}}}
Name: {{{this.name}}}
Summary: {{{this.summary}}}
{{/each}}

Analyze the detailed summaries carefully. Some profiles have specific deal-breakers (e.g., tattoos, religion, smoking). If the user summary mentions these, factor them heavily into the score.

Return a ranked list of all matches with scores and concise reasons (max 2 sentences).`,
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
