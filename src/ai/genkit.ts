import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyDBzZLbJk1DYBT-1__Z8h1ENNkf-P8tzlE', 
    }),
  ],
  // Use the standard model identifier to ensure compatibility and avoid 404 errors.
  model: 'googleai/gemini-2.5-flash',
});
