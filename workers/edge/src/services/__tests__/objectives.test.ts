import { describe, expect, it } from 'vitest';
import { buildLearningMap, currentStage, evaluateObjectives } from '../learning-map';

const base = {
  id: 'map-obj',
  goal: 'DAILY',
  targetLanguage: 'en',
  uiLanguage: 'fa',
  now: new Date('2026-10-01T00:00:00Z'),
};

describe('stage objectives', () => {
  it('defines measurable objectives for every stage', () => {
    const map = buildLearningMap(base);
    for (const stage of map.stages) {
      expect(stage.objectives?.length ?? 0).toBeGreaterThanOrEqual(2);
      for (const obj of stage.objectives ?? []) {
        expect(obj.minSamples).toBeGreaterThan(0);
        expect(obj.minAccuracy).toBeGreaterThan(0);
      }
    }
  });

  it('marks an objective UNKNOWN when there are too few samples (does not block)', () => {
    const map = buildLearningMap(base);
    const res = evaluateObjectives(map, { VOCABULARY: { correct: 1, total: 2 } });
    const stageId = currentStage(map).id;
    const rows = res.status[stageId]!;
    expect(rows.some((r) => r.passed === null)).toBe(true);
    expect(res.failedAny).toBe(false);
  });

  it('fails an objective when accuracy is below its own bar', () => {
    const map = buildLearningMap(base);
    const res = evaluateObjectives(map, {
      VOCABULARY: { correct: 2, total: 10 },
      GRAMMAR: { correct: 10, total: 10 },
    });
    const stageId = currentStage(map).id;
    const vocab = res.status[stageId]!.find((r) => r.id === 'f_vocab')!;
    expect(vocab.passed).toBe(false);
    expect(res.failedAny).toBe(true);
  });

  it('passes when accuracy and samples are enough', () => {
    const map = buildLearningMap(base);
    const res = evaluateObjectives(map, {
      VOCABULARY: { correct: 9, total: 10 },
      GRAMMAR: { correct: 5, total: 5 },
    });
    expect(res.failedAny).toBe(false);
  });
});
