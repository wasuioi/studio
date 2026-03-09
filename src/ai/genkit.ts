import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyASCaMlvhT3TsW2UEDeQxb45qR44WP_2ZM', 
    }),
  ],
  // Use the standard model identifier to ensure compatibility and avoid 404 errors.
  model: 'googleai/gemini-2.5-flash',
});
