
'use server';
/**
 * @fileOverview An AI agent that conducts a personality interview to build a structured matching profile.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiPersonalityInterviewInputSchema = z.object({
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    message: z.string(),
  })).describe('A history of previous chat messages.').optional().default([]),
  currentMessage: z.string().describe('The user\'s latest message.').nullable(),
});
export type AiPersonalityInterviewInput = z.infer<typeof AiPersonalityInterviewInputSchema>;

const AiPersonalityTraitsSchema = z.object({
  communicationStyle: z.string().describe('Direct, empathetic, witty, etc.'),
  introversionLevel: z.number().min(0).max(1).describe('0 for extreme extravert, 1 for extreme introvert.'),
  emotionalExpression: z.number().min(0).max(1).describe('How much they express emotions.'),
  lifestyle: z.string().describe('Active, social, homebody, career-focused, etc.'),
  relationshipIntent: z.string().describe('Casual, long-term, marriage, exploring, etc.'),
  values: z.array(z.string()).describe('Core values like honesty, growth, family, etc.'),
});

const AiPersonalityProfileSchema = z.object({
  traits: AiPersonalityTraitsSchema,
  summary: z.string().describe('A comprehensive summary of the user\'s personality.'),
});

const AiPersonalityInterviewOutputSchema = z.object({
  response: z.string().describe('The AI\'s response to the user.'),
  personalityProfile: AiPersonalityProfileSchema.optional().describe('Structured traits if interview is complete.'),
  interviewComplete: z.boolean().describe('True if enough info has been gathered.'),
});
export type AiPersonalityInterviewOutput = z.infer<typeof AiPersonalityInterviewOutputSchema>;

export async function aiPersonalityInterview(input: AiPersonalityInterviewInput): Promise<AiPersonalityInterviewOutput> {
  return aiPersonalityInterviewFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiPersonalityInterviewPrompt',
  input: { schema: AiPersonalityInterviewInputSchema },
  output: { schema: AiPersonalityInterviewOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  },
  prompt: `You are HarmonyAI, a sophisticated dating psychologist. Your goal is to interview the user to build a matching profile.

Ask questions one-by-one about:
1. Communication style and conflict resolution.
2. Values and relationship expectations.
3. Lifestyle and introversion/extraversion.

Mirror the user's tone. Once you have a clear picture of their communicationStyle, introversionLevel (0-1), emotionalExpression (0-1), lifestyle, relationshipIntent, and core values, set 'interviewComplete' to true and output the structured 'personalityProfile'.

Chat History:
{{#each chatHistory}}
  {{this.role}}: {{{this.message}}}
{{/each}}

User: {{{currentMessage}}}

AI Response:`,
});

const aiPersonalityInterviewFlow = ai.defineFlow(
  {
    name: 'aiPersonalityInterviewFlow',
    inputSchema: AiPersonalityInterviewInputSchema,
    outputSchema: AiPersonalityInterviewOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
