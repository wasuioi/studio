'use server';
/**
 * @fileOverview Vera: The Vibe-Check Matchmaker AI.
 * Conducts a natural personality interview and extracts a weighted matching profile.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiPersonalityInterviewInputSchema = z.object({
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    message: z.string(),
  })).describe('A history of previous chat messages.').optional().default([]),
  currentMessage: z.string().describe('The user\'s latest message.').nullable(),
  preferredLanguage: z.string().describe('The language the user prefers (e.g., "Thai", "English").').optional(),
});

const PersonalityWeightsSchema = z.object({
  career: z.number().min(1).max(5),
  lifestyle: z.number().min(1).max(5),
  emotionalIntelligence: z.number().min(1).max(5),
  humor: z.number().min(1).max(5),
  physicalActivity: z.number().min(1).max(5),
}).describe('Rank categories from 1-5 based on importance to the user.');

const AiPersonalityProfileSchema = z.object({
  user_persona: z.object({
    summary: z.string().describe('2-3 sentence description of who the user is.'),
    tags: z.array(z.string()).describe('Trait tags like Introvert, Ambitious, etc.'),
  }),
  ideal_partner: z.object({
    summary: z.string().describe('2-3 sentence description of what they want.'),
    tags: z.array(z.string()).describe('Trait tags like Kind, Stable, etc.'),
  }),
  weights: PersonalityWeightsSchema,
  readiness_score: z.number().min(1).max(10).describe('How clear are their requirements?'),
});

const AiPersonalityInterviewOutputSchema = z.object({
  response: z.string().describe('The AI\'s response to the user.'),
  personalityProfile: AiPersonalityProfileSchema.optional().describe('Structured profile if interview is complete.'),
  interviewComplete: z.boolean().describe('True if 5-8 exchanges have occurred and data is sufficient.'),
});

export async function aiPersonalityInterview(input: z.infer<typeof AiPersonalityInterviewInputSchema>): Promise<z.infer<typeof AiPersonalityInterviewOutputSchema>> {
  return aiPersonalityInterviewFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiPersonalityInterviewPrompt',
  input: { schema: AiPersonalityInterviewInputSchema },
  output: { schema: AiPersonalityInterviewOutputSchema },
  prompt: `You are Vera, a "Vibe-Check" Matchmaker AI. Your mission is to have a natural, engaging conversation to understand the user's soul and their romantic desires.

## Guidelines:
- **Don't be a form**: Do NOT ask "What is your hobby?". Instead, ask situational questions like "If you had a completely free Sunday, how would you spend it to feel recharged?"
- **Analyze Implicitly**: Observe energy levels. Emojis and exclamation marks mean "High Energy". Short, logical answers mean "Analytic".
- **The Pivot**: Once you understand the user (after ~3-4 exchanges), pivot to: "Now, imagine your perfect partner is standing right there. What is the first thing about their personality that makes you feel 'This is the one'?"
- **Threshold**: Once you have gathered enough info (usually 5-8 exchanges), signal completion by providing the structured personalityProfile.

## Language Instructions:
- User's Preferred Language: {{{preferredLanguage}}}
- ALWAYS respond in the user's preferred language.

## Extraction Requirements (JSON Output):
When 'interviewComplete' is true, you must provide:
1. **User Persona**: Their actual traits and communication style.
2. **Ideal Partner**: Specific traits and vibes they seek.
3. **Weights**: Rank Career, Lifestyle, EQ, Humor, and Physical Activity from 1-5 (5 being most important to the user).
4. **Readiness Score**: 1-10 based on how clear their requirements are.

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