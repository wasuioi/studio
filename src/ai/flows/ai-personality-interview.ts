
'use server';
/**
 * @fileOverview An AI agent that conducts a personality interview to build a user profile.
 *
 * - aiPersonalityInterview - A function that handles the AI personality interview process.
 * - AiPersonalityInterviewInput - The input type for the aiPersonalityInterview function.
 * - AiPersonalityInterviewOutput - The return type for the aiPersonalityInterview function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiPersonalityInterviewInputSchema = z.object({
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    message: z.string(),
  })).describe('A history of previous chat messages between the user and the AI, used for context.').optional().default([]),
  currentMessage: z.string().describe('The user\'s latest message in the interview.').nullable(),
});
export type AiPersonalityInterviewInput = z.infer<typeof AiPersonalityInterviewInputSchema>;

const AiPersonalityProfileSchema = z.object({
  datingPreferences: z.array(z.string()).describe('A list of the user\'s dating preferences.'),
  values: z.array(z.string()).describe('A list of the user\'s core values.'),
  communicationStyle: z.string().describe('A description of the user\'s communication style.'),
  summary: z.string().describe('A comprehensive summary of the user\'s personality based on the interview.'),
  personalityType: z.string().optional().describe('AI-derived primary personality type.'),
  keyTraits: z.array(z.string()).optional().describe('Key personality traits identified.'),
});

const AiPersonalityInterviewOutputSchema = z.object({
  response: z.string().describe('The AI\'s conversational response to the user.'),
  personalityProfile: AiPersonalityProfileSchema.optional().describe('The extracted personality profile, if enough information has been gathered.'),
  interviewComplete: z.boolean().describe('Indicates if the AI has gathered enough information to complete the personality profile.'),
});
export type AiPersonalityInterviewOutput = z.infer<typeof AiPersonalityInterviewOutputSchema>;

export async function aiPersonalityInterview(input: AiPersonalityInterviewInput): Promise<AiPersonalityInterviewOutput> {
  return aiPersonalityInterviewFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiPersonalityInterviewPrompt',
  input: { schema: AiPersonalityInterviewInputSchema },
  output: { schema: AiPersonalityInterviewOutputSchema },
  prompt: `You are an AI personality bot named HarmonyAI. Your goal is to conduct an interview with the user to understand their dating preferences, values, and communication style.

IMPORTANT: Mirror the user's communication style, vocabulary, and emotional tone. If the user is brief and direct, you should be brief and direct. If the user is expressive and verbose, you should match that energy. Your primary objective is to make the user feel heard and understood through mirroring.

Guide the conversation naturally, asking one question at a time. Once you believe you have enough information to fill out the full personality profile (datingPreferences, values, communicationStyle, personalityType, keyTraits, and a summary), set 'interviewComplete' to true and provide the complete 'personalityProfile' object. Otherwise, set 'interviewComplete' to false and continue the conversation.

Chat History:
{{#each chatHistory}}
  {{this.role}}: {{{this.message}}}
{{/each}}

User: {{{currentMessage}}}

AI (Your next response and profile update):`,
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
