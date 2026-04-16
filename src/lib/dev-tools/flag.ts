// src/lib/dev-tools/flag.ts
//
// DEV-ONLY. This whole folder (src/lib/dev-tools/) is scheduled for deletion
// before production rollout. See README.md in this folder.
//
// Two env vars gate dev tools:
//   NEXT_PUBLIC_ENABLE_DEV_TOOLS  — readable from browser; controls UI visibility
//   ENABLE_DEV_TOOLS              — server-only; gates Server Actions that mutate state
//
// isDevToolsEnabled() is safe to call from both client and server modules.
// In production neither variable is set, so it returns false everywhere.

export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';
}
