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
  datingPreferences: z.array(z.string()).describe('A list of the user\'s dating preferences (e.g., "long-term relationship", "casual dating", "adventure seeker").'),
  values: z.array(z.string()).describe('A list of the user\'s core values (e.g., "honesty", "family", "ambition", "creativity").'),
  communicationStyle: z.string().describe('A description of the user\'s communication style (e.g., "direct", "empathetic", "playful", "reserved").'),
  summary: z.string().describe('A comprehensive summary of the user\'s personality based on the interview.'),
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
  prompt: `You are an AI personality bot named HarmonyAI. Your goal is to conduct an interview with the user to understand their dating preferences, values, and communication style. You need to gather enough information to create a comprehensive personality profile.

Guide the conversation naturally, asking one question at a time. If the user's current message contains an answer to a previous question, acknowledge it and then ask a follow-up question to delve deeper or move on to a new area.

Once you believe you have enough information to fill out the full personality profile (datingPreferences, values, communicationStyle, and a general summary), set 'interviewComplete' to true and provide the complete 'personalityProfile' object. Otherwise, set 'interviewComplete' to false and continue the conversation.

Maintain a friendly, engaging, and empathetic tone throughout the interview.

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
    const messages = input.chatHistory.map(m => ({ role: m.role, message: m.message }));
    if (input.currentMessage) {
        messages.push({ role: 'user', message: input.currentMessage });
    }

    // If it's the very first message and no chat history, provide an initial greeting
    if (messages.length === 0 && input.currentMessage === null) {
      return {
        response: "Hello! I'm HarmonyAI, your personal guide to finding compatible connections. To help me understand you better, let's start with a few questions. What are you looking for in a dating partner or relationship?",
        interviewComplete: false,
      };
    }

    const { output } = await prompt(input);
    return output!;
  }
);
