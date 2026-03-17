'use server';
/**
 * @fileOverview An AI agent that verifies a user's identity by comparing an ID card and a selfie.
 *
 * - verifyIdentity - A function that handles the identity verification process.
 * - VerifyIdentityInput - The input type for the verifyIdentity function.
 * - VerifyIdentityOutput - The return type for the verifyIdentity function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const VerifyIdentityInputSchema = z.object({
  idCardPhotoUri: z
    .string()
    .describe(
      "A photo of the user's ID card, as a data URI that must include a MIME type and use Base64 encoding."
    ),
  selfiePhotoUri: z
    .string()
    .describe(
      "A live selfie of the user, as a data URI that must include a MIME type and use Base64 encoding."
    ),
});
export type VerifyIdentityInput = z.infer<typeof VerifyIdentityInputSchema>;

const VerifyIdentityOutputSchema = z.object({
  isMatch: z.boolean().describe('Whether or not the face in the selfie matches the face on the ID card.'),
  confidenceScore: z.number().min(0).max(1).describe('A confidence score for the match (0 to 1).'),
  reason: z.string().describe('The reasoning behind the verification result.'),
  extractedName: z.string().optional().describe('The name extracted from the ID card, if visible.'),
});
export type VerifyIdentityOutput = z.infer<typeof VerifyIdentityOutputSchema>;

export async function verifyIdentity(input: VerifyIdentityInput): Promise<VerifyIdentityOutput> {
  return verifyIdentityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'verifyIdentityPrompt',
  input: { schema: VerifyIdentityInputSchema },
  output: { schema: VerifyIdentityOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  },
  prompt: `You are an identity document verification assistant. You will review two images submitted by a user during an account verification process.

Image 1 - Government-issued ID document (Passport, Driver's License, or National ID):
{{media url=idCardPhotoUri}}

Image 2 - User selfie taken at time of submission:
{{media url=selfiePhotoUri}}

Please assess the following:
1. Does Image 1 appear to be a legitimate government-issued ID document? (Is text readable? Does it have document features like a photo, name, and official markings?)
2. Does Image 2 appear to be a real photo of a person (not a photo of a photo, not an illustration)?
3. Based on visual appearance, do the person in Image 1 and Image 2 appear to be the same individual?

Return your assessment with isMatch (true/false), a confidenceScore (0–1), and a clear reason.`,
});

const verifyIdentityFlow = ai.defineFlow(
  {
    name: 'verifyIdentityFlow',
    inputSchema: VerifyIdentityInputSchema,
    outputSchema: VerifyIdentityOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
