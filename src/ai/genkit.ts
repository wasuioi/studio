import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyAAmmDPjXdM3rGKbD2qa0NBbEyf7p-z-VQ',
    }),
  ],
  // Using the imported model object is the most reliable way to reference it in Genkit 1.x
  model: gemini15Flash, 
});
