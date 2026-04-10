import { NextRequest, NextResponse } from 'next/server';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';

export const maxDuration = 30;

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })],
  model: 'googleai/gemini-2.5-flash',
});

const InputSchema = z.object({
  idCardPhotoUri: z.string(),
  selfiePhotoUri: z.string(),
});

const OutputSchema = z.object({
  isMatch: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  reason: z.string(),
  extractedName: z.string().optional(),
});

const verifyPrompt = ai.definePrompt({
  name: 'verifyIdentityApiPrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
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
1. Does Image 1 appear to be a legitimate government-issued ID document?
2. Does Image 2 appear to be a real photo of a person?
3. Based on visual appearance, do the person in Image 1 and Image 2 appear to be the same individual?

Return isMatch (true/false), confidenceScore (0–1), and a clear reason.`,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idCardPhotoUri, selfiePhotoUri } = body;

    if (!idCardPhotoUri || !selfiePhotoUri) {
      return NextResponse.json({ error: 'Missing images' }, { status: 400 });
    }

    const { output } = await verifyPrompt({ idCardPhotoUri, selfiePhotoUri });

    if (!output) {
      return NextResponse.json({ error: 'AI returned no output' }, { status: 500 });
    }

    return NextResponse.json(output);
  } catch (err: any) {
    console.error('[verify-identity API error]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Verification failed' },
      { status: 500 }
    );
  }
}
