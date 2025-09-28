import reducer, {
  addCandidate,
  startInterview,
  recordAnswer,
  pauseSession,
  resumeSession,
  captureInfo,
  questionPlan
} from '../features/candidatesSlice.js';
import { describe, it, expect, beforeEach } from 'vitest';

let baseState;

beforeEach(() => {
  baseState = reducer(undefined, { type: '@@INIT' });
});

describe('candidatesSlice', () => {
  it('adds candidate with missing info queued', () => {
    const state = reducer(baseState, addCandidate({ name: 'A' }));
    expect(state.list.length).toBe(1);
    const session = state.list[0].session;
    expect(session.stage).toBe('collecting');
    expect(session.infoQueue).toContain('email');
  });

  it('captures contact info and moves to ready stage', () => {
    let state = reducer(baseState, addCandidate({ name: 'B' }));
    const id = state.list[0].id;
    const queue = [...state.list[0].session.infoQueue];
    queue.forEach((field, idx) => {
      state = reducer(state, captureInfo({ id, field, value: `value-${idx}` }));
      expect(state.list[0][field]).toBe(`value-${idx}`);
    });
    expect(state.list[0].session.stage).toBe('ready');
  });

  it('startInterview sets first question index', () => {
    let state = reducer(baseState, addCandidate({ name: 'C', email: 'c@example.com', phone: '123' }));
    const id = state.list[0].id;
    state = reducer(state, startInterview({ id, now: null }));
    expect(state.list[0].session.qIdx).toBe(0);
    expect(state.list[0].session.stage).toBe('interview');
  });

  it('recordAnswer advances index and finishes at plan length', () => {
    let state = reducer(baseState, addCandidate({ name: 'D', email: 'd@example.com', phone: '123' }));
    const id = state.list[0].id;
    state = reducer(state, startInterview({ id, now: null }));
    state = reducer(
      state,
      recordAnswer({ id, q: 'Q1', a: 'Ans', score: { numeric: 5, feedback: 'ok' }, topic: 'General', now: Date.now() })
    );
    expect(state.list[0].session.answers.length).toBe(1);
    expect(state.list[0].session.qIdx).toBe(1);
    for (let i = 1; i < questionPlan.length; i++) {
      state = reducer(
        state,
        recordAnswer({ id, q: 'Q', a: 'A', score: { numeric: 10, feedback: 'great' }, topic: 'General', now: Date.now() })
      );
    }
    expect(state.list[0].finished).toBe(true);
    expect(state.list[0].score).not.toBeNull();
  });

  it('pause/resume toggles active state', () => {
    let state = reducer(baseState, addCandidate({ name: 'E', email: 'e@example.com', phone: '123' }));
    const id = state.list[0].id;
    state = reducer(state, startInterview({ id, now: null }));
    state = reducer(state, resumeSession({ id, now: Date.now() }));
    expect(state.list[0].session.active).toBe(true);
    state = reducer(state, pauseSession({ id, now: Date.now(), reason: 'system' }));
    expect(state.list[0].session.active).toBe(false);
    expect(state.list[0].session.needsWelcome).toBe(true);
    state = reducer(state, resumeSession({ id, now: Date.now() }));
    expect(state.list[0].session.active).toBe(true);
    expect(state.list[0].session.needsWelcome).toBe(false);
  });

  it('rehydrates legacy session data safely', () => {
    const legacy = {
      candidates: {
        list: [
          {
            id: 'legacy-1',
            name: 'Legacy User',
            email: 'legacy@example.com',
            phone: '123',
            session: { qIdx: 2, answers: [{ q: 'Old', a: 'Ans', score: { numeric: 7 } }] }
          }
        ],
        pendingScores: []
      }
    };
    const hydrated = reducer(undefined, { type: 'persist/REHYDRATE', payload: legacy });
    const session = hydrated.list[0].session;
    expect(Array.isArray(session.chatLog)).toBe(true);
    expect(session.stage).toBe('interview');
    expect(session.currentInfoField).toBeNull();
    expect(session.timer).toBeDefined();
  });
});
