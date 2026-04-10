import { NextRequest, NextResponse } from 'next/server';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { verifyAuth } from '@/lib/verify-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
  // 1. Identify the caller. The user id is taken from the authenticated
  //    session cookie ONLY — never from the request body — so a caller
  //    cannot mark a different user as verified.
  let userId: string;
  try {
    const user = await verifyAuth();
    userId = user.id;
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { idCardPhotoUri, selfiePhotoUri } = body;

    if (!idCardPhotoUri || !selfiePhotoUri) {
      return NextResponse.json({ error: 'Missing images' }, { status: 400 });
    }

    // 2. Run the AI check. The photos are only held in memory for this call
    //    and are intentionally NOT persisted to storage.
    const { output } = await verifyPrompt({ idCardPhotoUri, selfiePhotoUri });

    if (!output) {
      return NextResponse.json({ error: 'AI returned no output' }, { status: 500 });
    }

    // 3. Persist the verification outcome server-side using the service-role
    //    client (bypasses RLS). Column-level REVOKE in migration 007 prevents
    //    the browser client from writing these columns directly, so this
    //    route handler is now the only path that can set a user's
    //    identity_verified / verification_status.
    const status: 'verified' | 'rejected' = output.isMatch ? 'verified' : 'rejected';
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        verification_status: status,
        identity_verified: Boolean(output.isMatch),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[verify-identity] profile update failed', updateError);
      return NextResponse.json(
        { error: 'Failed to persist verification result' },
        { status: 500 }
      );
    }

    return NextResponse.json(output);
  } catch (err: unknown) {
    console.error('[verify-identity API error]', err);
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
