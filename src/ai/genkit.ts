import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyAAmmDPjXdM3rGKbD2qa0NBbEyf7p-z-VQ', 
    }),
  ],
  // Use the standard model name without the '-latest' suffix to avoid 404 errors in some regions/versions
  model: 'googleai/gemini-1.5-flash', 
});
