import { describe, expect, it } from 'vitest';
import {
  appendDecision,
  buildLearningMap,
  currentStage,
  evaluateStage,
  validateLessonAgainstMap,
} from '../learning-map';

const base = {
  id: 'map-test',
  goal: 'TRAVEL',
  targetLanguage: 'en',
  uiLanguage: 'fa',
  now: new Date('2026-10-01T00:00:00Z'),
};

describe('buildLearningMap', () => {
  it('is deterministic for the same input', () => {
    const a = buildLearningMap(base);
    const b = buildLearningMap(base);
    expect(a.stages.map((s) => s.id)).toEqual(b.stages.map((s) => s.id));
    expect(a.currentStageId).toBe(b.currentStageId);
  });

  it('builds prerequisites as a chain and marks only stage 1 as in progress', () => {
    const map = buildLearningMap(base);
    expect(map.stages.length).toBe(5);
    expect(map.stages[0]!.prerequisites).toEqual([]);
    expect(map.stages[1]!.prerequisites).toEqual([map.stages[0]!.id]);
    expect(map.stages.filter((s) => s.status === 'IN_PROGRESS')).toHaveLength(1);
  });

  it('uses a goal-specific final stage', () => {
    const travel = buildLearningMap(base);
    const business = buildLearningMap({ ...base, goal: 'BUSINESS' });
    expect(travel.stages.at(-1)!.id).toBe('travel_ready');
    expect(business.stages.at(-1)!.id).toBe('business_ready');
  });
});

describe('evaluateStage', () => {
  const map = buildLearningMap(base);
  const criteria = currentStage(map).criteria;

  it('advances when every criterion is met', () => {
    const res = evaluateStage(map, {
      accuracyPct: criteria.minAccuracy,
      masteredTerms: criteria.minMasteredTerms,
      weakTerms: criteria.maxWeakTerms,
    });
    expect(res.advanced).toBe(true);
    expect(res.map.stages[0]!.status).toBe('MASTERED');
    expect(res.map.currentStageId).toBe(res.map.stages[1]!.id);
    expect(res.map.history.at(-1)!.kind).toBe('STAGE_MASTERED');
  });

  it('does not advance when accuracy is below the bar', () => {
    const res = evaluateStage(map, {
      accuracyPct: criteria.minAccuracy - 1,
      masteredTerms: criteria.minMasteredTerms + 5,
      weakTerms: 0,
    });
    expect(res.advanced).toBe(false);
    expect(res.map.currentStageId).toBe(map.currentStageId);
  });

  it('flags NEEDS_WORK when far below the bar', () => {
    const res = evaluateStage(map, {
      accuracyPct: criteria.minAccuracy - 20,
      masteredTerms: 0,
      weakTerms: criteria.maxWeakTerms + 5,
    });
    expect(res.map.stages[0]!.status).toBe('NEEDS_WORK');
  });
});

describe('validateLessonAgainstMap', () => {
  const map = buildLearningMap(base);
  const mk = (terms: string[], linked: string[]) =>
    ({
      dayNumber: 1,
      title: 't',
      titleUi: 't',
      kind: 'PATTERN_DRILL',
      part1: {
        type: 'PATTERN_DRILL',
        items: terms.map((term) => ({
          term,
          meaning: `${term}-m`,
          example: `I use ${term}.`,
          pronunciation: '',
          speakText: term,
        })),
      },
      part2: {
        type: 'REAL_APPLICATION',
        scenario: 's',
        questions: linked.map((t, i) => ({
          id: `q${i}`,
          prompt: 'p',
          options: ['a', 'b', 'c'],
          correctIndex: 0,
          linkedTerm: t,
        })),
      },
    }) as never;

  it('passes when every linked term exists in part 1', () => {
    const res = validateLessonAgainstMap(mk(['a', 'b', 'c'], ['a', 'b']), map, 'c1');
    expect(res.ok).toBe(true);
  });

  it('reports OFF_MAP_TERM for unknown linked terms', () => {
    const res = validateLessonAgainstMap(mk(['a', 'b', 'c'], ['zzz']), map, 'c1');
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.rule === 'OFF_MAP_TERM')).toBe(true);
  });

  it('reports MIN_ITEMS when part 1 is too small', () => {
    const res = validateLessonAgainstMap(mk(['a'], []), map, 'c1');
    expect(res.violations.some((v) => v.rule === 'MIN_ITEMS')).toBe(true);
  });
});

describe('appendDecision', () => {
  it('caps the decision log at 200 and keeps the newest', () => {
    let map = buildLearningMap(base);
    for (let i = 0; i < 210; i += 1) {
      map = appendDecision(map, {
        scope: 'CONTENT',
        ruleId: `R${i}`,
        inputs: {},
        output: 'X',
        reason: 'r',
        confidence: 1,
      });
    }
    expect(map.decisions!.length).toBe(200);
    expect(map.decisions!.at(-1)!.ruleId).toBe('R209');
  });
});
