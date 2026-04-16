// src/lib/dev-tools/fixtures/tester-profile.ts
// DEV-ONLY. Static profile seed used by devForceStage() when jumping stages.
// Only fields that actually exist on the profiles table — see
// src/lib/database.types.ts. Demographics are folded into the personality
// summary in tester-personality.ts instead of separate columns.

export const TESTER_PROFILE = {
  display_name: 'Alex Tester',
  location: 'Bangkok',
  profile_completed: true,
} as const;
