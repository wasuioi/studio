// src/lib/dev-tools/fixtures/tester-profile.ts
// DEV-ONLY. Static profile seed used by devForceStage() when jumping stages.

export const TESTER_PROFILE = {
  display_name: 'Alex Tester',
  age: 28,
  location: 'Bangkok',
  gender: 'Non-binary',
  photo_url: 'https://picsum.photos/seed/alex-tester/400/400',
  profile_completed: true,
} as const;
