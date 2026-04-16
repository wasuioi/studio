// src/lib/feature-gates.ts
//
// Pure function that decides whether a given stage unlocks a given feature.
// Stages are internal — UI code should use canUse() to render/hide features
// and must never surface the number itself to members.

export type Feature =
  | 'browse_matches'
  | 'view_profile_page'
  | 'send_date_invite'
  | 'accept_date_invite'
  | 'veras_instinct';

const REQUIRED_STAGE: Record<Feature, number> = {
  browse_matches: 1,
  view_profile_page: 1,
  send_date_invite: 2,
  accept_date_invite: 2,
  veras_instinct: 3,
};

export function canUse(feature: Feature, stage: number | null | undefined): boolean {
  if (stage === null || stage === undefined) return false;
  return stage >= REQUIRED_STAGE[feature];
}
