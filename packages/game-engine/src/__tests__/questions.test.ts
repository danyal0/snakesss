import { describe, it, expect } from 'vitest';
import {
  parseQuizQuestionJson,
  parseQuestionQualityJson,
  meetsQualityThreshold,
} from '../questions';

describe('parseQuizQuestionJson', () => {
  it('parses valid question JSON', () => {
    const q = parseQuizQuestionJson(
      '{"text":"Which year?","options":["1998","1999","2000"],"correctIndex":1}'
    );
    expect(q).not.toBeNull();
    expect(q!.text).toBe('Which year?');
    expect(q!.correctIndex).toBe(1);
    expect(q!.id).toMatch(/^q_/);
  });

  it('rejects invalid shapes', () => {
    expect(parseQuizQuestionJson('{"text":"x","options":["a"],"correctIndex":0}')).toBeNull();
    expect(parseQuizQuestionJson('not json')).toBeNull();
  });
});

describe('parseQuestionQualityJson', () => {
  it('parses valid rating JSON', () => {
    const r = parseQuestionQualityJson(
      '{"overallScore":8,"closeAnswersScore":9,"passes":true,"reason":"tough distractors"}'
    );
    expect(r).toEqual({
      overallScore: 8,
      closeAnswersScore: 9,
      passes: true,
      reason: 'tough distractors',
    });
  });

  it('clamps scores to 1-10', () => {
    const r = parseQuestionQualityJson(
      '{"overallScore":15,"closeAnswersScore":0,"passes":false}'
    );
    expect(r!.overallScore).toBe(10);
    expect(r!.closeAnswersScore).toBe(1);
  });
});

describe('meetsQualityThreshold', () => {
  it('requires passes flag and minimum scores', () => {
    expect(
      meetsQualityThreshold({
        overallScore: 8,
        closeAnswersScore: 8,
        passes: true,
      })
    ).toBe(true);

    expect(
      meetsQualityThreshold({
        overallScore: 8,
        closeAnswersScore: 8,
        passes: false,
      })
    ).toBe(false);

    expect(
      meetsQualityThreshold({
        overallScore: 6,
        closeAnswersScore: 9,
        passes: true,
      })
    ).toBe(false);
  });
});
