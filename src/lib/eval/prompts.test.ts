import { describe, it, expect } from 'vitest';
import { promptVariants, type PromptInput } from './prompts';

const fixture: PromptInput = {
  currentUser: {
    id: 'u1',
    name: 'Alex',
    persona: { summary: 'Thoughtful creative.', tags: ['creative', 'loyal'] },
    ideal_partner: { summary: 'Curious and kind.', tags: ['curious', 'kind'] },
    psychological_insights: {
      attachmentStyle: 'secure',
      coreValueVsSurfaceDesire: { core: 'being understood' },
      shadowSelf: { silentDealBreakers: ['dishonesty'], recurringNeeds: 'attunement' },
      behavioralInsights: 'Writes long messages.',
    },
    summary: 'Alex, 28.',
  },
  potentialMatches: [
    {
      id: 'c1',
      name: 'Sam',
      persona: { summary: 'Warm and grounded.', tags: ['curious', 'kind'] },
      ideal_partner: { summary: 'Creative type.', tags: ['creative', 'loyal'] },
      psychological_insights: { attachmentStyle: 'secure' },
      summary: 'Sam, 29.',
    },
  ],
};

describe('promptVariants', () => {
  it('default variant matches snapshot', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toMatchSnapshot();
  });

  it('default variant includes the reciprocity philosophy section', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Reciprocity First Philosophy');
    expect(rendered).toContain('finalScore = (reciprocityScore * 0.5) + (unidirectionalScore * 0.5)');
  });

  it('default variant interpolates user + candidate data', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Name: Alex');
    expect(rendered).toContain('ID: c1');
    expect(rendered).toContain('Name: Sam');
  });

  it('simplified variant matches snapshot', () => {
    const rendered = promptVariants.simplified(fixture);
    expect(rendered).toMatchSnapshot();
  });

  it('simplified variant is meaningfully shorter than default', () => {
    const def = promptVariants.default(fixture).length;
    const simple = promptVariants.simplified(fixture).length;
    expect(simple).toBeLessThan(def / 2);
  });
});
