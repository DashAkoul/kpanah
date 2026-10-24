import { describe, expect, it } from 'vitest';
import { buildLearningMap, reviseLearningMap } from '../learning-map';

const base = {
  id: 'map-1',
  goal: 'TRAVEL',
  targetLanguage: 'en',
  uiLanguage: 'fa',
  now: new Date('2026-10-01T00:00:00Z'),
};

describe('reviseLearningMap', () => {
  it('bumps the version and keeps the map id and creation date', () => {
    const map = buildLearningMap(base);
    const revised = reviseLearningMap(
      map,
      { goal: 'BUSINESS', targetLanguage: 'en', uiLanguage: 'fa', reason: 'goal changed' },
      new Date('2026-10-05T00:00:00Z')
    );
    expect(revised.id).toBe(map.id);
    expect(revised.version).toBe(map.version + 1);
    expect(revised.createdAt).toBe(map.createdAt);
  });

  it('rebuilds the stage chain for the new goal', () => {
    const map = buildLearningMap(base);
    const revised = reviseLearningMap(
      map,
      { goal: 'BUSINESS', targetLanguage: 'en', uiLanguage: 'fa', reason: 'goal changed' },
      new Date('2026-10-05T00:00:00Z')
    );
    expect(revised.stages.at(-1)!.id).toBe('business_ready');
    expect(map.stages.at(-1)!.id).toBe('travel_ready');
  });

  it('records a REVISED entry and preserves calibration/decisions', () => {
    const map = {
      ...buildLearningMap(base),
      calibration: {
        takenAt: '2026-10-02T00:00:00Z',
        scorePct: 80,
        answers: 10,
        selfReported: 'A2',
        estimated: 'B1',
        mismatch: false,
        confidence: 0.8,
      },
    };
    const revised = reviseLearningMap(
      map,
      { goal: 'DAILY', targetLanguage: 'en', uiLanguage: 'fa', reason: 'goal changed' },
      new Date('2026-10-06T00:00:00Z')
    );
    expect(revised.history.at(-1)!.kind).toBe('REVISED');
    expect(revised.calibration?.scorePct).toBe(80);
  });
});
