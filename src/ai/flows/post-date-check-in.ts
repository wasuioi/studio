'use server';
/**
 * @fileOverview Vera's post-date check-in flow.
 *
 * Generates one warm reply at a time given the conversation so far,
 * the user's pill choice (if any), and the basic match metadata.
 *
 * The actual prompt template lives in
 * `@/ai/prompts/post-date-check-in-prompt` so it can be edited
 * without touching the flow wiring. State lives in the
 * `date_feedback` row, not in this flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { POST_DATE_CHECK_IN_PROMPT } from '@/ai/prompts/post-date-check-in-prompt';

const TurnSchema = z.object({
  role: z.enum(['vera', 'user']),
  text: z.string(),
});

const PostDateCheckInInputSchema = z.object({
  pillChoice: z.enum(['positive', 'neutral', 'negative', 'dismissed']).nullable().optional(),
  conversation: z.array(TurnSchema).describe('All turns so far, oldest first.'),
  match: z.object({
    name: z.string().min(1),
  }),
  dateMeta: z.object({
    suggestedDateTime: z.string().nullable().optional(),
    suggestedLocation: z.string().nullable().optional(),
  }),
  preferredLanguage: z.string().describe('"Thai" or "English"').default('English'),
});

const PostDateCheckInOutputSchema = z.object({
  response: z.string().describe("Vera's next reply."),
  isClosingTurn: z.boolean().describe('True when Vera is producing a warm closer; the server action will flip the row to completed.'),
});

export async function postDateCheckIn(
  input: z.infer<typeof PostDateCheckInInputSchema>,
): Promise<z.infer<typeof PostDateCheckInOutputSchema>> {
  return postDateCheckInFlow(input);
}

const prompt = ai.definePrompt({
  name: 'postDateCheckInPrompt',
  input: { schema: PostDateCheckInInputSchema },
  output: { schema: PostDateCheckInOutputSchema },
  prompt: POST_DATE_CHECK_IN_PROMPT,
});

const postDateCheckInFlow = ai.defineFlow(
  {
    name: 'postDateCheckInFlow',
    inputSchema: PostDateCheckInInputSchema,
    outputSchema: PostDateCheckInOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  },
);
