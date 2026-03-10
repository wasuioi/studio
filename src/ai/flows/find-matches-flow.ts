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
  score: z.number().min(0).max(100),
  reason: z.string().describe('A 1-2 sentence explanation focusing on why their vibes match based on psychological compatibility.'),
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

## Matching Logic:

1. **Psychological Alignment**: Compare the User's psychological insights against the Potential Match's psychological profile.
   - Attachment Style compatibility (e.g., Secure pairs well with Secure or Anxious; Avoidant often clashes with Anxious)
   - Core Value vs Surface Desire: Does the match address their actual core needs, not just surface wants?

2. **Ideal Partner Alignment**: Compare the User's 'Ideal Partner' profile against the Potential Match's persona.
   - Look for trait tag overlap
   - Assess whether the match fits their stated preferences

3. **Shadow Self Considerations**:
   - Check for silent deal-breakers that the potential match might trigger
   - Look for alignment with recurring needs identified in their psychological profile

4. **Vibe Match**: Overall energy and communication style compatibility based on behavioral insights.

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
  Behavioral Insights: {{currentUser.psychological_insights.behavioralInsights}}
{{/if}}

## Potential Matches:
{{#each potentialMatches}}
---
ID: {{{this.id}}}
Name: {{{this.name}}}
Summary: {{{this.summary}}}
{{/each}}

Rank matches by score and provide a concise reason for the vibe match. Consider psychological compatibility, not just surface preferences.`,
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