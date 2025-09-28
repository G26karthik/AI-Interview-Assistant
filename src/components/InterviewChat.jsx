import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Input, Card, Typography, Space, Tag, Progress, List, Modal, Alert } from 'antd';
import { generateQuestion, scoreAnswer, summaryFromAI, streamQuestion, classifyTopic, AI_MODE } from '../api/groq.js';
import {
  questionPlan,
  startInterview,
  recordAnswer,
  setScoreSummary,
  resumeSession,
  captureInfo,
  logMessage,
  setCurrentQuestion
} from '../features/candidatesSlice.js';
import useTimer from '../hooks/useTimer.js';

const { Text, Paragraph } = Typography;
const FIELD_PLACEHOLDERS = {
  name: 'Enter your full name',
  email: 'Enter your best email address',
  phone: 'Enter a phone number for follow-up'
};

export default function InterviewChat() {
  const candidates = useSelector((s) => s.candidates.list);
  const dispatch = useDispatch();
  const current = candidates.find((c) => !c.finished && c.session) || candidates[candidates.length - 1];
  const [answer, setAnswer] = useState('');
  const [infoValue, setInfoValue] = useState('');
  const [locked, setLocked] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const question = current?.session.currentQuestion || '';
  const stage = current?.session.stage || 'collecting';
  const questionIndex = current?.session.qIdx ?? -1;
  const candidateId = current?.id;
  const planItem = questionIndex >= 0 && questionIndex < questionPlan.length ? questionPlan[questionIndex] : null;
  const timerEnabled = stage === 'interview' && current?.session.active && !locked && !streaming;
  const submitRef = useRef(() => {});
  const timer = useTimer(current?.session.timer, timerEnabled, useCallback(() => submitRef.current?.(true), []));
  const progressPct = useMemo(() => {
    if (!current) return 0;
    return (current.session.answers.length / questionPlan.length) * 100;
  }, [current]);

  useEffect(() => {
    if (!current) return;
    if (current.session.stage === 'collecting') return;
    if (current.session.stage === 'ready' && current.session.qIdx === -1) {
      dispatch(startInterview({ id: current.id, now: null }));
    }
  }, [current?.session.stage, current?.session.qIdx, current?.id, dispatch]);

  useEffect(() => {
    if (!candidateId || AI_MODE === 'UNAVAILABLE') return;
    const stageNow = current?.session.stage;
    if (stageNow !== 'interview') return;
    const index = current?.session.qIdx ?? -1;
    if (index < 0 || index >= questionPlan.length) return;
    const activeQuestion = current?.session.currentQuestion;
    if (activeQuestion) return;

    let alive = true;
    const snapshot = current;
    const startTimerRef = { started: false };

    const loadQuestion = async () => {
      if (!alive) return;
      setStreaming(true);
      setFetching(true);
      setAnswer('');
      let assembled = '';
      let streamingReleased = false;
      const ctx = buildContext(snapshot);
      const level = questionPlan[index].level;
      const maybeStartTimer = () => {
        if (startTimerRef.started || snapshot.session.active) return;
        startTimerRef.started = true;
        dispatch(resumeSession({ id: snapshot.id, now: Date.now() }));
      };

      let finalLogged = false;
      try {
        await streamQuestion(level, 'Full Stack React/Node', (token) => {
          assembled += token;
          if (alive && !streamingReleased && assembled.trim().length > 0) {
            setFetching(false);
            streamingReleased = true;
          }
          dispatch(setCurrentQuestion({ id: snapshot.id, question: assembled, appendLog: false, level, index }));
          if (assembled.length > 12) maybeStartTimer();
        }, ctx);
      } catch (e) {
        console.warn('Stream failed', e);
      }

      if (!assembled) {
        try {
          const fallback = await generateQuestion(level, 'Full Stack React/Node', ctx);
          assembled = fallback;
          dispatch(setCurrentQuestion({ id: snapshot.id, question: assembled, appendLog: true, level, index }));
          finalLogged = true;
        } catch (err) {
          console.error('Question generation failed', err);
          dispatch(
            logMessage({
              id: snapshot.id,
              sender: 'system',
              text: 'I had trouble generating the next question. Please retry in a moment.'
            })
          );
        }
      }

      if (assembled && !finalLogged) {
        dispatch(setCurrentQuestion({ id: snapshot.id, question: assembled, appendLog: true, level, index }));
      }

      if (alive) {
        if (!streamingReleased) {
          setFetching(false);
        }
        setStreaming(false);
      }
    };

    loadQuestion();
    return () => {
      alive = false;
      setStreaming(false);
      setFetching(false);
    };
  }, [candidateId, current?.session.stage, current?.session.qIdx, dispatch]);

  const submit = useCallback(
    async (auto = false) => {
      const active = current;
      if (!active || active.finished) return;
      if (streaming) return;
      if (active.session.qIdx < 0 || active.session.qIdx >= questionPlan.length) return;
      const prompt = active.session.currentQuestion || question;
      if (!prompt) return;

      setLocked(true);
      setFetching(true);
      let topic = 'General';
      try {
        topic = classifyTopic(prompt);
      } catch (e) {
        console.warn('Topic classification failed', e);
      }
      let scored;
      try {
        scored = await scoreAnswer(prompt, answer || '');
      } catch (e) {
        console.warn('Scoring failed', e);
        scored = { numeric: 0, feedback: 'Scoring unavailable.' };
      }

      dispatch(
        recordAnswer({
          id: active.id,
          q: prompt,
          a: answer || '',
          score: scored,
          topic,
          now: Date.now(),
          auto
        })
      );
      setAnswer('');
      setLocked(false);
      setFetching(false);
      dispatch(setCurrentQuestion({ id: active.id, question: '' }));
    },
    [current, answer, dispatch, question, streaming]
  );

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    if (!current) return;
    setInfoValue('');
  }, [current?.session.currentInfoField, current?.id]);

  useEffect(() => {
    if (!current || !current.finished) return;
    if (current.summary) return;
    const run = async () => {
      const summary = await summaryFromAI(current);
      dispatch(setScoreSummary({ id: current.id, score: summary.score, summary: summary.summary }));
      dispatch(
        logMessage({
          id: current.id,
          sender: 'system',
          text: `Interview complete. Weighted score: ${summary.score}. Check the dashboard for full notes.`
        })
      );
    };
    run();
  }, [current, dispatch]);

  const handleInfoSubmit = useCallback(() => {
    if (!current) return;
    const field = current.session.currentInfoField;
    if (!field) return;
    if (!infoValue.trim()) return;
    dispatch(captureInfo({ id: current.id, field, value: infoValue }));
    setInfoValue('');
  }, [current, infoValue, dispatch]);

  const showSummaryModal = useCallback(() => {
    if (!current) return;
    Modal.info({
      title: 'Interview transcript',
      width: 720,
      content: (
        <div>
          {current.session.answers.map((a, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <Paragraph strong>{`Q${i + 1} (${a.level})`}</Paragraph>
              <Paragraph>{a.q}</Paragraph>
              <Paragraph italic>{a.a || '[No answer provided]'}</Paragraph>
              <Paragraph type="secondary">Score: {a.score?.numeric ?? '—'} · {a.score?.feedback}</Paragraph>
            </div>
          ))}
        </div>
      )
    });
  }, [current]);

  if (!current) {
    return (
      <Card>
        <Text>No candidate yet. Upload a resume first.</Text>
      </Card>
    );
  }

  if (AI_MODE === 'UNAVAILABLE') {
    return (
      <Card>
        <Text type="secondary">Waiting for AI configuration...</Text>
      </Card>
    );
  }

  const contactComplete = REQUIRED_FIELDS.every((field) => current[field]);
  const weightDisplay = Number.isFinite(current?.score) ? current.score.toFixed(1) : 'Pending';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card aria-live="polite" title="Interview assistant">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 8 }}>
            <List
              dataSource={current.session.chatLog}
              renderItem={(item, idx) => (
                <List.Item
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: item.sender === 'candidate' ? 'flex-end' : 'flex-start',
                    border: 'none',
                    padding: '4px 0'
                  }}
                >
                  <span
                    style={{
                      background: item.sender === 'candidate' ? '#e6f7ff' : '#f5f5f5',
                      borderRadius: 8,
                      padding: '6px 10px',
                      maxWidth: '75%',
                      lineHeight: 1.5
                    }}
                  >
                    <Text strong>{item.sender === 'candidate' ? 'You' : 'Swipe AI'}:</Text>{' '}
                    <span>{item.text}</span>
                  </span>
                </List.Item>
              )}
            />
          </div>

          {stage === 'collecting' && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="Quick check"
                description="I pulled most details from your resume. I just need the items below before we start."
              />
              <Input
                placeholder={FIELD_PLACEHOLDERS[current.session.currentInfoField] || 'Type here'}
                value={infoValue}
                onChange={(e) => setInfoValue(e.target.value)}
                onPressEnter={handleInfoSubmit}
                aria-label={current.session.currentInfoField}
                autoFocus
              />
              <Button type="primary" onClick={handleInfoSubmit} disabled={!infoValue.trim()}>
                Send
              </Button>
            </Space>
          )}

          {stage === 'interview' && planItem && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space align="baseline" split={<Text type="secondary">·</Text>}>
                <Text strong>{`Question ${questionIndex + 1}/${questionPlan.length}`}</Text>
                <Tag color="blue">{planItem.level}</Tag>
              </Space>
              <Progress percent={Math.round(progressPct)} size="small" aria-label="progress" />
              <Card size="small" style={{ background: '#fafafa' }} role="note">
                {question || 'Generating question...'}
              </Card>
              <Text type="secondary" aria-live="assertive">
                Time remaining: {timer}s
              </Text>
              <Input.TextArea
                rows={4}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={locked}
                aria-label="answer-input"
              />
              <Button
                type="primary"
                onClick={() => submit(false)}
                disabled={locked || streaming || !question?.trim()}
              >
                Submit answer
              </Button>
            </Space>
          )}
        </Space>
      </Card>

      {contactComplete && (
        <Card title="Contact details on file">
          <Space wrap>
            <Tag>{current.name}</Tag>
            <Tag>{current.email}</Tag>
            <Tag>{current.phone}</Tag>
          </Space>
        </Card>
      )}

      {current.finished && (
        <Card title="Interview summary" role="region" aria-label="summary">
          <Paragraph>
            <Text strong>Weighted score:</Text> {weightDisplay}
          </Paragraph>
          <Paragraph>{current.summary || 'Summary is being prepared...'}</Paragraph>
          <Button onClick={showSummaryModal}>Review answers</Button>
        </Card>
      )}
    </Space>
  );
}

const REQUIRED_FIELDS = ['name', 'email', 'phone'];

function buildContext(candidate) {
  if (!candidate) return '';
  const resume = candidate.resumeText || '';
  const recent = candidate.session.answers
    .slice(-2)
    .map(
      (a, i) =>
        `PrevQ${i + 1}: ${a.q.slice(0, 80)} | Ans: ${(a.a || '').slice(0, 80)} | Score: ${a.score?.numeric ?? 'NA'}`
    )
    .join('\n');
  return [resume, recent].filter(Boolean).join('\n');
}
