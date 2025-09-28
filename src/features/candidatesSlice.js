import { createSlice, nanoid } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

const REQUIRED_FIELDS = ['name', 'email', 'phone'];
const FIELD_LABELS = {
  name: 'full name',
  email: 'email address',
  phone: 'phone number'
};

const initialState = { list: [], pendingScores: [] };
const levels = [
  { level: 'Easy', seconds: 20 },
  { level: 'Easy', seconds: 20 },
  { level: 'Medium', seconds: 60 },
  { level: 'Medium', seconds: 60 },
  { level: 'Hard', seconds: 120 },
  { level: 'Hard', seconds: 120 }
];

const weights = { Easy: 1, Medium: 1.5, Hard: 2 };

const computeMissingFields = (candidate = {}) =>
  REQUIRED_FIELDS.filter((field) => {
    const value = candidate[field];
    if (value == null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
  });

const calculateWeightedScore = (answers = []) => {
  if (!answers.length) return null;
  const aggregate = answers.reduce(
    (acc, entry, index) => {
      const level = entry.level || levels[index]?.level || 'Easy';
      const numeric = entry.score?.numeric ?? 0;
      const weight = weights[level] || 1;
      acc.total += numeric * weight;
      acc.weight += weight;
      return acc;
    },
    { total: 0, weight: 0 }
  );
  if (aggregate.weight === 0) return 0;
  return +(aggregate.total / aggregate.weight).toFixed(1);
};

const normalizeTimer = (timer) => {
  if (!timer) return { total: 0, remaining: 0, startedAt: null };
  return {
    total: Number.isFinite(timer.total) ? timer.total : 0,
    remaining: Number.isFinite(timer.remaining) ? timer.remaining : 0,
    startedAt: typeof timer.startedAt === 'number' ? timer.startedAt : null
  };
};

const buildInitialChatLog = (candidate = {}, missing = []) => {
  const displayName = candidate?.name ? candidate.name.split(' ')[0] : 'there';
  const chat = [
    { sender: 'system', text: `Hi ${displayName}! I'm your AI interviewer for the Swipe full-stack role.` },
    { sender: 'system', text: "Thanks for uploading your resume. I'll tailor questions to your background." }
  ];
  if (missing.length) {
    const first = missing[0];
    chat.push({ sender: 'system', text: `Before we begin, could you share your ${FIELD_LABELS[first] || first}?` });
  } else {
    chat.push({ sender: 'system', text: "Great — I have your contact details. Let's begin the interview." });
  }
  return chat;
};

const determineStage = (session, candidate, missing) => {
  if (missing.length) return 'collecting';
  if (candidate.finished || (session.qIdx ?? -1) >= levels.length) return 'review';
  if ((session.qIdx ?? -1) >= 0) return 'interview';
  return 'ready';
};

const ensureSession = (candidate) => {
  if (!candidate) return null;
  if (!candidate.session) candidate.session = createInitialSession(candidate);
  const session = candidate.session;
  const missing = computeMissingFields(candidate);

  session.answers = Array.isArray(session.answers) ? session.answers : [];
  session.qIdx = typeof session.qIdx === 'number' ? session.qIdx : -1;
  session.timer = normalizeTimer(session.timer);
  session.infoQueue = Array.isArray(session.infoQueue)
    ? session.infoQueue.filter((field) => missing.includes(field))
    : [...missing];
  if (!session.infoQueue.length && missing.length) session.infoQueue = [...missing];
  session.infoQueue = [...new Set(session.infoQueue)];
  session.currentInfoField = session.infoQueue.length ? session.infoQueue[0] : null;
  if (!Array.isArray(session.chatLog) || !session.chatLog.length) {
    session.chatLog = buildInitialChatLog(candidate, session.infoQueue);
  }
  session.currentQuestion = session.currentQuestion || '';
  session.active = !!session.active;
  session.paused = !!session.paused;
  session.needsWelcome = !!session.needsWelcome;
  session.lastPausedAt = typeof session.lastPausedAt === 'number' ? session.lastPausedAt : null;
  session.stage = determineStage(session, candidate, missing);
  return session;
};

const createInitialSession = (partial = {}) => {
  const missing = computeMissingFields(partial);
  return {
    qIdx: -1,
    answers: [],
    active: false,
    paused: false,
    needsWelcome: false,
    currentQuestion: '',
    lastPausedAt: null,
    timer: { total: 0, remaining: 0, startedAt: null },
    chatLog: buildInitialChatLog(partial, missing),
    infoQueue: [...missing],
    currentInfoField: missing[0] || null,
    stage: missing.length ? 'collecting' : 'ready'
  };
};

const withTimer = (session, seconds, now) => {
  const startAt = typeof now === 'number' ? now : null;
  return {
    ...session,
    currentQuestion: session.currentQuestion || '',
    lastPausedAt: session.lastPausedAt || null,
    active: startAt !== null,
    paused: false,
    timer: {
      total: seconds,
      remaining: seconds,
      startedAt: startAt
    }
  };
};

const pauseTimer = (session, now) => {
  if (!session.timer) return session;
  const elapsed = session.timer.startedAt ? (now - session.timer.startedAt) / 1000 : 0;
  const remaining = Math.max(0, Math.round(session.timer.remaining - elapsed));
  return {
    ...session,
    currentQuestion: session.currentQuestion || '',
    lastPausedAt: now,
    active: false,
    paused: true,
    timer: {
      ...session.timer,
      remaining,
      startedAt: null
    }
  };
};

const resumeTimer = (session, now) => {
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
};

const slice = createSlice({
  name: 'candidates',
  initialState,
  reducers: {
    addCandidate: {
      prepare: (partial) => ({
        payload: {
          id: nanoid(),
          score: null,
          summary: '',
          finished: false,
          session: createInitialSession(partial),
          topicStats: {},
          ...partial
        }
      }),
      reducer: (state, { payload }) => {
        ensureSession(payload);
        state.list.push(payload);
      }
    },
    updateCandidate: (state, { payload }) => {
      const candidate = state.list.find((item) => item.id === payload.id);
      if (!candidate) return;
      Object.assign(candidate, payload.changes);
      ensureSession(candidate);
    },
    logMessage: (state, { payload: { id, sender, text } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate || !text) return;
      const session = ensureSession(candidate);
      session.chatLog.push({ sender, text });
    },
    captureInfo: (state, { payload: { id, field, value } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate || !field) return;
      const session = ensureSession(candidate);
      if (!session.infoQueue.includes(field)) return;
      const cleanValue = (value || '').trim();
      session.chatLog.push({ sender: 'candidate', text: cleanValue || '[No response provided]' });
      if (cleanValue) candidate[field] = cleanValue;
      const missing = computeMissingFields(candidate);
      session.infoQueue = [...missing];
      session.currentInfoField = session.infoQueue[0] || null;
      session.stage = determineStage(session, candidate, missing);
      const last = session.chatLog[session.chatLog.length - 1]?.text;
      if (!session.infoQueue.length) {
        const message = "Perfect — we have everything we need. Let’s begin the interview.";
        if (last !== message) session.chatLog.push({ sender: 'system', text: message });
      } else {
        const nextField = session.currentInfoField;
        const prompt = `Got it. Could you also share your ${FIELD_LABELS[nextField] || nextField}?`;
        if (last !== prompt) session.chatLog.push({ sender: 'system', text: prompt });
      }
    },
    startInterview: (state, { payload: { id, now } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate) return;
      const session = ensureSession(candidate);
      if (session.stage !== 'ready' || session.qIdx !== -1) return;
      if (computeMissingFields(candidate).length) return;
      session.stage = 'interview';
      const next = withTimer({ ...session, qIdx: 0 }, levels[0].seconds, typeof now === 'number' ? now : null);
      candidate.session = next;
    },
    setCurrentQuestion: (state, { payload: { id, question, appendLog = false, level, index } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate) return;
      const session = ensureSession(candidate);
      const effectiveIndex = typeof index === 'number' ? index : session.qIdx ?? 0;
      const currentIndex = session.qIdx ?? 0;
      const displayIdx = Math.min(effectiveIndex + 1, levels.length);
      const label = level || levels[effectiveIndex]?.level || levels[currentIndex]?.level || 'Question';

      if (typeof index === 'number' && index < currentIndex) {
        if (question) {
          const answered = session.answers[index];
          if (answered && (!answered.q || answered.q.length < question.length)) {
            answered.q = question;
          }
        }
      } else {
        session.currentQuestion = question || '';
      }

      if (appendLog && question) {
        const formatted = `Question ${displayIdx} (${label}): ${question}`;
        const existingIdx = session.chatLog.findIndex(
          (entry) => entry.sender === 'system' && entry.text.startsWith(`Question ${displayIdx} (`)
        );
        if (existingIdx >= 0) {
          session.chatLog[existingIdx].text = formatted;
        } else {
          session.chatLog.push({ sender: 'system', text: formatted });
        }
      }
    },
    recordAnswer: {
      prepare: ({ id, q, a, score, topic, now, auto = false }) => ({
        payload: { id, q, a, score, topic, now, auto }
      }),
      reducer: (state, { payload: { id, q, a, score, topic, now, auto } }) => {
        const candidate = state.list.find((item) => item.id === id);
        if (!candidate) return;
        const session = ensureSession(candidate);
        const currentIndex = session.answers.length;
        const plan = levels[currentIndex];
        if (!plan) return;
        const candidateText = (a || '').trim() || (auto ? '[No answer provided]' : '');
        session.chatLog.push({ sender: 'candidate', text: candidateText || '[No answer provided]' });
        session.answers.push({ q, a: candidateText, score, level: plan.level, topic });
        if (topic) {
          if (!candidate.topicStats[topic]) candidate.topicStats[topic] = { total: 0, count: 0 };
          candidate.topicStats[topic].total += score?.numeric || 0;
          candidate.topicStats[topic].count += 1;
        }
        session.currentQuestion = '';
        session.qIdx = session.answers.length;
        if (session.qIdx >= levels.length) {
          candidate.finished = true;
          session.stage = 'review';
          const finalScore = calculateWeightedScore(session.answers);
          if (finalScore != null) candidate.score = finalScore;
          session.needsWelcome = false;
          candidate.session = pauseTimer({ ...session, active: false, paused: false }, now ?? Date.now());
        } else {
          const nextSeconds = levels[session.qIdx].seconds;
          candidate.session = withTimer({ ...session }, nextSeconds, null);
        }
      }
    },
    setScoreSummary: (state, { payload: { id, score, summary } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate) return;
      ensureSession(candidate);
      if (score != null) candidate.score = score;
      candidate.summary = summary;
    },
    pauseSession: (state, { payload: { id, now, reason = 'manual' } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate) return;
      const session = ensureSession(candidate);
      const updated = pauseTimer(session, now);
      updated.needsWelcome = reason !== 'manual';
      candidate.session = updated;
    },
    resumeSession: (state, { payload: { id, now } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate) return;
      const session = ensureSession(candidate);
      const resumed = resumeTimer(session, now);
      resumed.needsWelcome = false;
      candidate.session = resumed;
    },
    finishSession: (state, { payload: { id, now } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate) return;
      const session = ensureSession(candidate);
      candidate.finished = true;
      session.stage = 'review';
      const finalScore = calculateWeightedScore(session.answers);
      if (finalScore != null) candidate.score = finalScore;
      const ended = pauseTimer({ ...session, active: false, paused: false, needsWelcome: false }, now ?? Date.now());
      ended.needsWelcome = false;
      candidate.session = ended;
    },
    attachScore: (state, { payload: { id, idx, score } }) => {
      const candidate = state.list.find((item) => item.id === id);
      if (!candidate) return;
      const session = ensureSession(candidate);
      if (session.answers[idx]) {
        session.answers[idx].score = score;
        state.pendingScores = state.pendingScores.filter((p) => !(p.id === id && p.idx === idx));
      }
    },
    clearHistory: (state) => {
      state.list = [];
      state.pendingScores = [];
    }
  },
  extraReducers: (builder) => {
    builder.addCase(REHYDRATE, (state, action) => {
      const payload = action?.payload?.candidates;
      if (!payload) return;
      const incomingList = Array.isArray(payload.list) ? payload.list : [];
      state.list = incomingList.map((candidate) => {
        const clone = { ...candidate, session: candidate.session ? { ...candidate.session } : undefined };
        if (clone.topicStats) clone.topicStats = { ...clone.topicStats };
        ensureSession(clone);
        return clone;
      });
      state.pendingScores = Array.isArray(payload.pendingScores) ? [...payload.pendingScores] : [];
    });
  }
});

export const questionPlan = levels;
export const {
  addCandidate,
  updateCandidate,
  logMessage,
  captureInfo,
  startInterview,
  setCurrentQuestion,
  recordAnswer,
  setScoreSummary,
  pauseSession,
  resumeSession,
  finishSession,
  attachScore,
  clearHistory
} = slice.actions;
export default slice.reducer;
