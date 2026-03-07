import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: 'AIzaSyAAmmDPjXdM3rGKbD2qa0NBbEyf7p-z-VQ',
    }),
  ],
  model: 'gemini-1.5-flash',
});
