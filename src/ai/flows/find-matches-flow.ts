
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
    communicationStyle: z.string(),
    introversionLevel: z.number(),
    emotionalExpression: z.number(),
    lifestyle: z.string(),
    relationshipIntent: z.string(),
    values: z.array(z.string()),
  }),
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
  reason: z.string(),
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
  prompt: `You are a high-end matchmaking AI. Your task is to calculate compatibility scores (0-100) between a User and a list of Potential Matches.

Compatibility should be based on:
1. Values Alignment: Do their core values overlap or complement each other?
2. Communication Style: Will they understand each other or clash?
3. Lifestyle Compatibility: Social vs. Homebody, Career vs. Leisure.
4. Emotional Expression: Can they support each other's emotional needs?

User Profile:
Name: {{{currentUser.name}}}
Traits: Communication: {{{currentUser.traits.communicationStyle}}}, Introversion: {{{currentUser.traits.introversionLevel}}}, Emotional: {{{currentUser.traits.emotionalExpression}}}, Lifestyle: {{{currentUser.traits.lifestyle}}}, Intent: {{{currentUser.traits.relationshipIntent}}}
Values: {{#each currentUser.traits.values}}{{{this}}}, {{/each}}
Summary: {{{currentUser.summary}}}

Potential Matches:
{{#each potentialMatches}}
---
ID: {{{this.id}}}
Name: {{{this.name}}}
Traits: Communication: {{{this.traits.communicationStyle}}}, Introversion: {{{this.traits.introversionLevel}}}, Emotional: {{{this.traits.emotionalExpression}}}, Lifestyle: {{{this.traits.lifestyle}}}, Intent: {{{this.traits.relationshipIntent}}}
Values: {{#each this.traits.values}}{{{this}}}, {{/each}}
Summary: {{{this.summary}}}
{{/each}}

Return a list of matches with scores and reasons. Only include matches where the score is 60 or higher.`,
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
