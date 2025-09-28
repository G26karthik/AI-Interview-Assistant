import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Input, Card, Typography, Space, Tag, Progress, Modal } from 'antd';
import { generateQuestion, scoreAnswer, summaryFromAI, streamQuestion, classifyTopic, AI_MODE } from '../api/groq.js';
import { questionPlan, startInterview, recordAnswer, setScoreSummary, updateCandidate, pauseSession, resumeSession, setCurrentQuestion } from '../features/candidatesSlice.js';
import useTimer from '../hooks/useTimer.js';
const { Text } = Typography;

export default function InterviewChat(){
  const candidates = useSelector(s=>s.candidates.list);
  const dispatch = useDispatch();
  // Only consider a candidate as 'current' if not finished and has been created
  const current = candidates.find(c=>!c.finished && c.session) || candidates[candidates.length-1];
  const question = current?.session.currentQuestion || '';
  const [answer,setAnswer] = useState('');
  const [locked,setLocked] = useState(false);
  const [fetching,setFetching] = useState(false);
  // Always require info before questions: if missing info, qIdx must be -1
  const needInfo = current && (!current.name || !current.email || !current.phone);
  // If info is missing but qIdx is not -1, forcibly reset qIdx to -1
  useEffect(()=>{
    if(current && needInfo && current.session && current.session.qIdx !== -1){
      dispatch({type:'candidates/updateCandidate', payload:{id:current.id, changes:{session:{...current.session, qIdx:-1}}}});
    }
  },[current, needInfo, dispatch]);
  // If info is filled and qIdx is -1, allow start
  const planItem = current && current.session.qIdx>=0 && current.session.qIdx < questionPlan.length ? questionPlan[current.session.qIdx] : null;
  const remain = useTimer(current?.session.timer, !!planItem && current?.session.active && !fetching && !locked, useCallback(()=>submit(true),[fetching,question,answer,current,locked]));
  const progressPct = current? (current.session.answers.length / questionPlan.length)*100 : 0;

  useEffect(()=>{ const load = async () => {
    if(!current || !current.session) return;
    if(needInfo) return; // never show questions before info
    if(AI_MODE === 'UNAVAILABLE') return;
    if(current.session.qIdx===-1){ dispatch(startInterview({id: current.id, now: null})); return; }
    if(current.session.qIdx < questionPlan.length){
      if(question) return;
      setFetching(true); setAnswer(''); setLocked(false);
      const paused = current.session.paused;
      let resumed = false;
      const startTimer = ()=>{
        if(resumed || paused || current.session.active) return;
        resumed = true;
        dispatch(resumeSession({id: current.id, now: Date.now()}));
      };
      let assembled='';
      const useStream = true;
      if(useStream){
        const ctx = buildContext(current);
        try { await streamQuestion(questionPlan[current.session.qIdx].level, 'Full Stack React/Node', token=>{ assembled += token; dispatch(setCurrentQuestion({id: current.id, question: assembled})); if(assembled.length>5) startTimer(); }, ctx); } catch(e){ console.warn('Stream failed', e); }
      }
      if(!assembled){
        const q = await generateQuestion(questionPlan[current.session.qIdx].level, 'Full Stack React/Node', buildContext(current));
        assembled = q;
        dispatch(setCurrentQuestion({id: current.id, question: assembled}));
        startTimer();
      }
      setFetching(false);
    } else if(!current.finished){ const summary = await summaryFromAI(current); dispatch(setScoreSummary({id:current.id, score: summary.score, summary: summary.summary})); }
  }; load(); },[current?.session.qIdx, current?.id, needInfo, dispatch]);

  async function submit(auto){
    if(!current || current.finished) return;
    if(current.session.qIdx >= questionPlan.length) return;
    if(!answer.trim() && !auto) return;
    setLocked(true); setFetching(true);
    const topic = classifyTopic(question);
    const scored = await scoreAnswer(question, answer||'[No answer]');
    dispatch(recordAnswer({id: current.id, q: question, a: answer||'', score: scored, topic, now: Date.now() }));
    setFetching(false);
    setAnswer('');
    dispatch(setCurrentQuestion({id: current.id, question: ''}));
    setLocked(false);
  }

  const saveMissing = (field,val)=> dispatch(updateCandidate({id: current.id, changes: {[field]: val}}));
  if(!current) return <Card><Text>No candidate yet. Upload a resume first.</Text></Card>;
  if(AI_MODE === 'UNAVAILABLE') return <Card><Text type="secondary">Waiting for AI configuration...</Text></Card>;

  return (
    <Space direction="vertical" style={{width:'100%'}}>
    {needInfo && <Card title="Complete your details" aria-label="complete-details">
      {['name','email','phone'].map(f=> !current[f] && <Input style={{marginBottom:8}} key={f} placeholder={f} aria-label={f} onBlur={e=>saveMissing(f,e.target.value)} />)}
      <Button type="primary" disabled={['name','email','phone'].some(f=>!current[f])} onClick={()=>dispatch(startInterview({id:current.id, now: null}))}>Start Interview</Button>
    </Card>}
    {!needInfo && current.session.qIdx>=0 && current.session.qIdx < questionPlan.length && (
      <Card aria-live="polite">
        <Space direction="vertical" style={{width:'100%'}}>
          <Text strong aria-label="question-number">{`Question ${current.session.qIdx+1}/${questionPlan.length}`}</Text>
          <Tag color="blue" aria-label="difficulty">{questionPlan[current.session.qIdx].level}</Tag>
          <Progress percent={Math.round(progressPct)} size="small" aria-label="progress" />
          <Card size="small" style={{background:'#fafafa'}} role="note">{question||'...'}</Card>
          <Space align="center" style={{justifyContent:'space-between'}}>
            <Text type="secondary" aria-live="assertive">Time remaining: {remain}s</Text>
            <Space>
              <Button onClick={()=>dispatch(pauseSession({id: current.id, now: Date.now()}))} disabled={!current.session.active}>Pause</Button>
              <Button type="default" onClick={()=>dispatch(resumeSession({id: current.id, now: Date.now()}))} disabled={current.session.active || !current.session.paused || remain===0}>Resume</Button>
            </Space>
          </Space>
          <Input.TextArea rows={4} value={answer} onChange={e=>setAnswer(e.target.value)} disabled={fetching || locked} aria-label="answer-input" />
          <Space>
            <Button type="primary" onClick={()=>submit(false)} disabled={fetching || locked || !answer.trim()}>Submit</Button>
          </Space>
        </Space>
      </Card>
    )}
    {current.finished && (
      <Card title="Interview Summary" role="region" aria-label="summary">
        <p><b>Weighted Score:</b> {current.score ?? 'Pending'}</p>
        <p>{current.summary}</p>
        <Button onClick={()=>Modal.info({title:'Answers', content: <div>{current.session.answers.map((a,i)=><p key={i}><b>Q{i+1}:</b> {a.q}<br/><b>Lvl:</b> {a.level}<br/><b>A:</b> {a.a||'[empty]'}<br/><b>Score:</b> {a.score.numeric} ({a.score.feedback})</p>)}</div>})}>Review Answers</Button>
      </Card>
    )}
    </Space>
  );
}

function buildContext(candidate){
  if(!candidate) return '';
  const resume = (candidate.resumeText||'').slice(0,2500);
  const recent = candidate.session.answers.slice(-2).map(a=>`PrevQ:${a.q.slice(0,70)} | Ans:${(a.a||'').slice(0,60)} | Score:${a.score?.numeric??'NA'}`).join('\n');
  return [resume, recent].filter(Boolean).join('\n');
}
