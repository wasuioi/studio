import { describe, it, expect } from 'vitest';
import { promptVariants, promptInputFromRow, type PromptInput } from './prompts';
import type { EvalRow } from './types';

const fixture: PromptInput = {
  profileA: 'Alex, 28. Quiet writer and climber. Secure attachment. Values depth.',
  profileB: 'Sam, 29. Warm therapist, emotionally present. Secure attachment.',
};

describe('promptVariants', () => {
  it('default variant matches snapshot', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toMatchSnapshot();
  });

  it('default variant includes both profiles', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Alex, 28');
    expect(rendered).toContain('Sam, 29');
  });

  it('default variant includes the JSON schema instruction', () => {
    const rendered = promptVariants.default(fixture);
    expect(rendered).toContain('Return STRICT JSON');
    expect(rendered).toContain('"score":');
    expect(rendered).toContain('"reasoning":');
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

describe('promptInputFromRow', () => {
  it('extracts profileA and profileB from an EvalRow', () => {
    const row: EvalRow = {
      id: 'r1',
      label: 'test',
      profileA: 'A text',
      profileB: 'B text',
      expected: { score: 50, reasoning: 'test' },
      tags: [],
    };
    const input = promptInputFromRow(row);
    expect(input).toEqual({ profileA: 'A text', profileB: 'B text' });
  });
});
