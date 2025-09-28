import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = { list: [], pendingScores: [] };
const levels = [
  { level: 'Easy', seconds: 20 },
  { level: 'Easy', seconds: 20 },
  { level: 'Medium', seconds: 60 },
  { level: 'Medium', seconds: 60 },
  { level: 'Hard', seconds: 120 },
  { level: 'Hard', seconds: 120 }
];

const createInitialSession = () => ({
  qIdx: -1,
  answers: [],
  active: false,
  paused: false,
  needsWelcome: false,
  currentQuestion: '',
  lastPausedAt: null,
  timer: { total: 0, remaining: 0, startedAt: null }
});

function withTimer(session, seconds, now) {
  const startAt = typeof now === 'number' ? now : null;
  return {
    ...session,
    currentQuestion: session.currentQuestion || '',
    needsWelcome: session.needsWelcome || false,
    lastPausedAt: session.lastPausedAt || null,
    active: startAt !== null,
    paused: false,
    timer: {
      total: seconds,
      remaining: seconds,
      startedAt: startAt
    },
  };
}

function pauseTimer(session, now) {
  if (!session.timer) return session;
  const remaining = Math.max(0, Math.round(session.timer.remaining - (session.timer.startedAt ? (now - session.timer.startedAt) / 1000 : 0)));
  return {
    ...session,
    currentQuestion: session.currentQuestion || '',
    needsWelcome: session.needsWelcome || false,
    lastPausedAt: now,
    active: false,
    paused: true,
    timer: {
      ...session.timer,
      remaining,
      startedAt: null
    }
  };
}

function resumeTimer(session, now) {
  if (!session.timer) return session;
  return {
    ...session,
    currentQuestion: session.currentQuestion || '',
    needsWelcome: false,
    lastPausedAt: session.lastPausedAt,
    active: true,
    paused: false,
    timer: {
      ...session.timer,
      startedAt: now
    }
  };
}

const slice = createSlice({
  name: 'candidates',
  initialState,
  reducers: {
    addCandidate: {
      prepare: (partial) => ({ payload: { id: nanoid(), score: null, summary: '', finished: false, session: createInitialSession(), topicStats: {}, ...partial } }),
      reducer: (state, { payload }) => { state.list.push(payload); }
    },
    updateCandidate: (state, { payload }) => {
      const c = state.list.find(x=>x.id===payload.id); if(c) Object.assign(c, payload.changes);
    },
    startInterview: (state, { payload: { id, now } }) => {
      const c = state.list.find(x => x.id === id);
      if (c && c.session.qIdx === -1) {
        const next = withTimer({ ...c.session, qIdx: 0 }, levels[0].seconds, typeof now === 'number' ? now : null);
        c.session = next;
      }
    },
    recordAnswer: {
      prepare: ({ id, q, a, score, topic, now }) => ({ payload: { id, q, a, score, topic, now } }),
      reducer: (state, { payload: { id, q, a, score, topic, now } }) => {
        const c = state.list.find(x => x.id === id);
        if (!c) return;
        const currentIndex = c.session.answers.length;
        const plan = levels[currentIndex];
        if (!plan) return;
        c.session.answers.push({ q, a, score, level: plan.level, topic });
        if (topic) {
          if (!c.topicStats[topic]) c.topicStats[topic] = { total: 0, count: 0 };
          c.topicStats[topic].total += (score?.numeric || 0);
          c.topicStats[topic].count += 1;
        }
        c.session.currentQuestion = '';
        c.session.qIdx = c.session.answers.length;
        if (c.session.qIdx >= levels.length) {
          c.finished = true;
          c.session.needsWelcome = false;
          c.session = pauseTimer({ ...c.session, active: false, paused: false }, now);
        } else {
          const nextSeconds = levels[c.session.qIdx].seconds;
          c.session = withTimer({ ...c.session }, nextSeconds, null);
        }
      }
    },
    setScoreSummary: (state, { payload: { id, score, summary } }) => {
      const c = state.list.find(x => x.id === id);
      if (c) {
        c.score = score;
        c.summary = summary;
      }
    },
    pauseSession: (state, { payload: { id, now, reason = 'manual' } }) => {
      const c = state.list.find(x => x.id === id);
      if (c) {
        const updated = pauseTimer(c.session, now);
        updated.needsWelcome = reason !== 'manual';
        c.session = updated;
      }
    },
    resumeSession: (state, { payload: { id, now } }) => {
      const c = state.list.find(x => x.id === id);
      if (c) {
        const resumed = resumeTimer(c.session, now);
        resumed.needsWelcome = false;
        c.session = resumed;
      }
    },
    finishSession: (state, { payload: { id, now } }) => {
      const c = state.list.find(x => x.id === id);
      if (c) {
        c.finished = true;
        const ended = pauseTimer({ ...c.session, active: false, paused: false, needsWelcome: false }, now);
        ended.needsWelcome = false;
        c.session = ended;
      }
    },
    attachScore: (state, { payload: { id, idx, score } }) => {
      const c = state.list.find(x => x.id === id);
      if (c && c.session.answers[idx]) {
        c.session.answers[idx].score = score;
        state.pendingScores = state.pendingScores.filter(p => !(p.id === id && p.idx === idx));
      }
    },
    clearHistory: (state) => {
      state.list = [];
      state.pendingScores = [];
    },
    setCurrentQuestion: (state, { payload: { id, question } }) => {
      const c = state.list.find(x => x.id === id);
      if (c) {
        c.session.currentQuestion = question;
      }
    }
  }
});

export const questionPlan = levels;
export const { addCandidate, updateCandidate, startInterview, recordAnswer, setScoreSummary, resumeSession, finishSession, pauseSession, attachScore, clearHistory, setCurrentQuestion } = slice.actions;
export default slice.reducer;
