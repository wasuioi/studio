'use server';
/**
 * @fileOverview Vera: Date Planner AI.
 * Suggests 3 perfect date options based on both users' preferences AND real locations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DateOptionSchema = z.object({
  location: z.string().describe('A specific, vivid location/place suggestion.'),
  dateTime: z.string().describe('Human-readable date/time, e.g. "Saturday, March 14 at 10:00 AM".'),
  scheduledFor: z.string().describe('ISO datetime string, e.g. "2026-03-14T10:00:00".'),
  description: z.string().describe('1-2 sentence vibe description of this date option.'),
});

const AiDatePlannerInputSchema = z.object({
  senderName: z.string(),
  receiverName: z.string(),
  senderLocationPref: z.string().describe("The sender's preferred date location type (e.g. café, park)."),
  senderTimePref: z.string().describe("The sender's preferred day/time for a date."),
  receiverLocationPref: z.string().describe("The receiver's preferred date location type."),
  receiverTimePref: z.string().describe("The receiver's preferred day/time for a date."),
  senderActualLocation: z.string().optional().describe("The sender's real city/area, e.g. 'Bangkok, Thailand'."),
  receiverActualLocation: z.string().optional().describe("The receiver's real city/area, e.g. 'Korat, Thailand'."),
  currentDateISO: z.string().describe('Current date in ISO format, e.g. 2026-03-10.'),
});

const AiDatePlannerOutputSchema = z.object({
  options: z.array(DateOptionSchema).length(3).describe('Exactly 3 date suggestions, ranked best to last.'),
  message: z.string().describe("Vera's warm intro message presenting the 3 options."),
});

export async function aiDatePlanner(
  input: z.infer<typeof AiDatePlannerInputSchema>
): Promise<z.infer<typeof AiDatePlannerOutputSchema>> {
  return aiDatePlannerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiDatePlannerPrompt',
  input: { schema: AiDatePlannerInputSchema },
  output: { schema: AiDatePlannerOutputSchema },
  prompt: `You are Vera, a romantic date planner AI. Your job is to suggest 3 perfect first date options that work well for BOTH people.

Current date: {{{currentDateISO}}}

Planning a date between {{{senderName}}} and {{{receiverName}}}.

{{{senderName}}}'s preferences:
- Favorite location type: "{{{senderLocationPref}}}"
- Best available time: "{{{senderTimePref}}}"
{{#if senderActualLocation}}- Lives in: {{{senderActualLocation}}}{{/if}}

{{{receiverName}}}'s preferences:
- Favorite location type: "{{{receiverLocationPref}}}"
- Best available time: "{{{receiverTimePref}}}"
{{#if receiverActualLocation}}- Lives in: {{{receiverActualLocation}}}{{/if}}

LOCATION STRATEGY — follow these rules in order:
1. If both people live in the SAME city/area → suggest places within that shared city.
2. If their location preferences are IDENTICAL (e.g. both said "café") → focus on that type of place.
3. If they live in DIFFERENT cities → suggest a place roughly in the MIDDLE between their cities (a city/area geographically between them), or if they are far apart, suggest a popular midpoint destination that is easy for both to reach.
4. Never suggest a place that is clearly only convenient for one person.

DATE VARIETY:
- Generate exactly 3 suggestions that each have a different vibe/style so they have real variety.
- Each option should vary in timing and/or location style.
- Pick specific upcoming dates/times within the next 7-10 days from the current date.

Rules:
- scheduledFor MUST be a valid ISO datetime string (e.g. "2026-03-14T10:00:00") that falls after currentDateISO.
- dateTime should be human-readable (e.g. "Saturday, March 14 at 10:00 AM").
- Make locations vivid and specific (e.g. "A sunlit rooftop garden café in Central Bangkok" not just "café").
- description should be 1-2 sentences of warm, romantic copy for each option.
- Write a warm 2-sentence intro message presenting the 3 options.`,
});

const aiDatePlannerFlow = ai.defineFlow(
  {
    name: 'aiDatePlannerFlow',
    inputSchema: AiDatePlannerInputSchema,
    outputSchema: AiDatePlannerOutputSchema,
  },
  async (input) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { output } = await prompt(input);
        return output!;
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || '');
        const isRetryable = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        if (!isRetryable) throw err;
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
    throw lastErr;
  }
);
