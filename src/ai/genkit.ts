import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyBE8V8g7GUr5hnt-sfvrFl-zxN_asLSnr0', 
    }),
  ],
  // Use the standard model identifier to ensure compatibility and avoid 404 errors.
  model: 'googleai/gemini-2.5-flash',
});
