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
  prompt: `You are an expert identity verification specialist. Your task is to compare two images: 
1. An ID card (Passport, Driver's License, or National ID).
2. A live selfie of the person who provided the ID.

Your goal is to determine if the person in the selfie is the same person shown on the ID card.

Guidelines:
- Analyze facial features (eyes, nose, mouth, face shape) meticulously.
- Account for differences in lighting, angles, and potential aging if the ID is old.
- Check if the ID card looks like a legitimate government document.
- If the faces do not match, or if the ID card appears fraudulent or unreadable, set isMatch to false.

ID Card Photo: {{media url=idCardPhotoUri}}
Selfie Photo: {{media url=selfiePhotoUri}}

Provide a detailed reason for your decision.`,
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
