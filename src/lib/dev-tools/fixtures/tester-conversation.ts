// src/lib/dev-tools/fixtures/tester-conversation.ts
// DEV-ONLY. Fake bot_chats.messages payload so the /bot page feels populated
// after devSeedDemoProfile. Matches the ChatMessage shape used in src/app/bot/page.tsx.

export interface FixtureMessage {
  role: 'user' | 'model';
  message: string;
  timestamp: string;
}

const base = new Date('2026-04-16T09:00:00Z').getTime();
const at = (offsetSec: number) => new Date(base + offsetSec * 1000).toISOString();

export const TESTER_CONVERSATION: FixtureMessage[] = [
  { role: 'model', message: "Hi! I'm Vera. Ready to begin our vibe check?", timestamp: at(0) },
  { role: 'user', message: "Hey Vera — yep, let's do it.", timestamp: at(30) },
  { role: 'model', message: "Awesome. What's your name and how old are you?", timestamp: at(40) },
  { role: 'user', message: "I'm Alex, 28, live in Bangkok.", timestamp: at(80) },
  { role: 'model', message: "Nice to meet you Alex. What kind of relationship are you hoping for?", timestamp: at(95) },
  { role: 'user', message: "Something serious but not rushed. I want a real partner.", timestamp: at(140) },
  { role: 'model', message: "That makes sense. Any absolute deal-breakers for you?", timestamp: at(160) },
  { role: 'user', message: "Dishonesty, and someone who never puts effort into small gestures.", timestamp: at(210) },
  { role: 'model', message: "Got it. Can you share a photo of yourself so I can get your profile ready?", timestamp: at(230) },
  { role: 'user', message: "[uploaded photo]", timestamp: at(260) },
  { role: 'model', message: "Thanks! I've got enough to set up your profile. Let's keep chatting.", timestamp: at(275) },
];
