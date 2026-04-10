import type { EvalProfile, PromptVariant } from './types';

// Input shape mirrors FindMatchesInputSchema from src/ai/flows/find-matches-flow.ts
// (without the Zod wrapper — just plain types).
export interface PromptInput {
  currentUser: EvalProfile;
  potentialMatches: EvalProfile[];
}

// Registry: variant name → function that produces the full prompt string.
export const promptVariants: Record<PromptVariant, (input: PromptInput) => string> = {
  default: buildDefaultPrompt,
  simplified: buildSimplifiedPrompt,
};

// Port of the current find-matches-flow.ts prompt from Handlebars to template literals.
// IMPORTANT: keep the content identical to the Genkit prompt — this is the baseline.
// If you intentionally update this variant, re-run the snapshot test and update it.
function buildDefaultPrompt({ currentUser, potentialMatches }: PromptInput): string {
  const cuTags = currentUser.persona.tags.join(', ');
  const cuIdealTags = currentUser.ideal_partner.tags.join(', ');

  const cuInsightsBlock = (() => {
    const pi = currentUser.psychological_insights;
    if (!pi) return '';
    return `
  Attachment Style: ${pi.attachmentStyle ?? ''}
  Core Need: ${pi.coreValueVsSurfaceDesire?.core ?? ''}
  Silent Deal-Breakers: ${(pi.shadowSelf?.silentDealBreakers ?? []).join(', ')}
  Recurring Needs: ${pi.shadowSelf?.recurringNeeds ?? ''}
  Behavioral Insights: ${pi.behavioralInsights ?? ''}
`;
  })();

  const matchesSection = potentialMatches.map(m => {
    const mTags = m.persona.tags.join(', ');
    const mIdealTags = m.ideal_partner.tags.join(', ');
    const mInsights = (() => {
      const pi = m.psychological_insights;
      if (!pi) return '';
      return `
  Attachment Style: ${pi.attachmentStyle ?? ''}
  Core Need: ${pi.coreValueVsSurfaceDesire?.core ?? ''}
  Silent Deal-Breakers: ${(pi.shadowSelf?.silentDealBreakers ?? []).join(', ')}
`;
    })();

    return `---
ID: ${m.id}
Name: ${m.name}
Persona: ${m.persona.summary}
Tags: ${mTags}
Ideal Partner: ${m.ideal_partner.summary}
Ideal Partner Tags: ${mIdealTags}${mInsights}
Summary: ${m.summary}`;
  }).join('\n');

  return `You are a high-end Relationship Psychologist and Matching Specialist for TrueVibe.
Your task is to calculate compatibility scores (0-100) between a User and Potential Matches.

## CRITICAL: Reciprocity First Philosophy
The most fulfilling matches are MUTUAL. A match where the user finds them fulfilling but they wouldn't find the user fulfilling leads to rejection, frustration, and wasted time.
You MUST calculate BOTH directions:
1. How fulfilled the user would feel with this match (unidirectional)
2. How likely the match would also feel fulfilled by the user (reciprocity) — check if the user's persona matches the match's ideal_partner profile

## Explicit Scoring Rubric (Use This!)

### Attachment Style Compatibility Matrix (+25 points max)
| User \\ Match | Secure | Anxious | Avoidant |
|--------------|--------|---------|----------|
| Secure       | +25    | +20     | +10      |
| Anxious      | +20    | +15     | -20      |
| Avoidant     | +10    | -20     | +20      |

### Core Value Alignment (+20 points max)
- Match addresses user's CORE need (not just surface want): +20
- Partial alignment: +10
- No alignment: 0

### Ideal Partner Fit (+20 points max)
- User's persona matches match's ideal_partner: +20
- 2-3 tag overlap: +12
- 1 tag overlap: +5
- No overlap: 0

### Shadow Self Check (+10 points max)
- Match addresses user's recurring needs: +10
- No conflict but no alignment: +3
- Match triggers silent deal-breaker: **FAIL** (score = 0, explain in failReason)

### Vibe/Communication (+5 points max)
- Behavioral insights align: +5

## Deal-Breaker Fail-Fast Rules (Score = 0)
If ANY of these are true, the match is automatically disqualified:
1. Match's persona triggers user's silent deal-breakers (from shadowSelf.silentDealBreakers)
2. User's persona contains match's explicit deal-breakers (check each match's ideal_partner)
3. Attachment style conflict: Anxious + Avoidant pairing

## Reciprocity Calculation
For each potential match, also evaluate:
"Would {match.name} find ${currentUser.name} fulfilling?"
- Check if currentUser's persona matches the potential match's ideal_partner
- Check if currentUser's psychological profile is compatible with what the match likely needs

## Final Score Formula
finalScore = (reciprocityScore * 0.5) + (unidirectionalScore * 0.5)
Rationale: A match where BOTH people feel fulfilled is 50% more valuable than one-way fulfillment.

## Current User Profile:
Name: ${currentUser.name}
Persona: ${currentUser.persona.summary}
Tags: ${cuTags}

## User's Ideal Partner:
Desire: ${currentUser.ideal_partner.summary}
Ideal Tags: ${cuIdealTags}

## User's Psychological Insights:${cuInsightsBlock}

## Potential Matches:
${matchesSection}

For EACH potential match, calculate:
1. unidirectionalScore: How fulfilled the user would be (0-100)
2. reciprocityScore: How likely the match would also be fulfilled by the user (0-100)
3. finalScore: Weighted average
4. failReason: If score = 0, explain which deal-breaker triggered
5. reason: 2-3 sentence explanation

Rank ALL matches by finalScore (highest first). Even matches with score 0 should be listed with failReason.

You MUST return valid JSON matching this exact schema (no markdown, no code fences):
{
  "matches": [
    {
      "targetUserId": "string",
      "unidirectionalScore": number,
      "reciprocityScore": number,
      "finalScore": number,
      "failReason": "string (optional)",
      "reason": "string"
    }
  ]
}`;
}

// Short variant — baseline to compare prompt engineering impact.
function buildSimplifiedPrompt({ currentUser, potentialMatches }: PromptInput): string {
  const matchesList = potentialMatches.map(m =>
    `- ${m.id}: ${m.name} — ${m.persona.summary}. Wants: ${m.ideal_partner.summary}`
  ).join('\n');

  return `Score dating compatibility 0-100 for each candidate vs the user.

User: ${currentUser.name}. ${currentUser.persona.summary}
Wants: ${currentUser.ideal_partner.summary}

Candidates:
${matchesList}

Return JSON: {"matches":[{"targetUserId":"id","unidirectionalScore":N,"reciprocityScore":N,"finalScore":N,"reason":"text"}]}`;
}
