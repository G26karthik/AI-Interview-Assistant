import reducer, { addCandidate, startInterview, recordAnswer, pauseSession, resumeSession, questionPlan } from '../features/candidatesSlice.js';
import { describe, it, expect } from 'vitest';

const baseState = { list: [] };

describe('candidatesSlice', ()=>{
  it('adds candidate', ()=>{
    const state = reducer(baseState, addCandidate({ name:'A' }));
    expect(state.list.length).toBe(1);
    expect(state.list[0].name).toBe('A');
  });
  it('starts interview sets qIdx 0', ()=>{
    let state = reducer(baseState, addCandidate({ name:'B' }));
    const id = state.list[0].id;
    state = reducer(state, startInterview({id, now: null}));
    expect(state.list[0].session.qIdx).toBe(0);
    expect(state.list[0].session.active).toBe(false);
  });
  it('records answer advances index', ()=>{
    let state = reducer(baseState, addCandidate({ name:'C' }));
    const id = state.list[0].id; state = reducer(state, startInterview({id, now: null}));
    state = reducer(state, recordAnswer({id, q:'Q1', a:'Ans', score:{numeric:5, feedback:'ok'}, now: Date.now()}));
    expect(state.list[0].session.answers.length).toBe(1);
    expect(state.list[0].session.qIdx).toBe(1);
  });
  it('pause/resume toggles active', ()=>{
    let state = reducer(baseState, addCandidate({ name:'D' }));
    const id = state.list[0].id; state = reducer(state, startInterview({id, now: null}));
    state = reducer(state, resumeSession({id, now: Date.now()}));
    expect(state.list[0].session.active).toBe(true);
    state = reducer(state, pauseSession({id, now: Date.now(), reason:'system'}));
    expect(state.list[0].session.active).toBe(false);
    expect(state.list[0].session.needsWelcome).toBe(true);
    state = reducer(state, resumeSession({id, now: Date.now()}));
    expect(state.list[0].session.active).toBe(true);
    expect(state.list[0].session.needsWelcome).toBe(false);
  });
  it('finishes after plan length', ()=>{
    let state = reducer(baseState, addCandidate({ name:'E' }));
    const id = state.list[0].id; state = reducer(state, startInterview({id, now: null}));
    for(let i=0;i<questionPlan.length;i++) state = reducer(state, recordAnswer({id,q:'Q',a:'A',score:{numeric:10,feedback:'x'}, now: Date.now()}));
    expect(state.list[0].finished).toBe(true);
  });
});
