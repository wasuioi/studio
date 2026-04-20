// src/lib/dev-tools/demo-invite.ts
// DEV-ONLY. Shared marker between the dev panel (which seeds the invite) and
// the /requests page (which auto-reseeds when the invite gets resolved).
// Value written: the demo sender's auth user id returned by devSeedFakeInvite.
// When the marker is absent the /requests page stays silent in production.

export const DEMO_INVITE_SENDER_KEY = 'dev:demoInviteSenderId';
