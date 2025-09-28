import React, { useEffect, useRef, useState } from 'react';
import { Layout, Tabs, Modal, Button, Alert } from 'antd';
import ResumeUploader from './components/ResumeUploader.jsx';
import InterviewChat from './components/InterviewChat.jsx';
import InterviewerDashboard from './components/InterviewerDashboard.jsx';
import { useSelector, useDispatch } from 'react-redux';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScoreQueueWorker from './components/ScoreQueueWorker.jsx';
import { AI_MODE } from './api/groq.js';
import { pauseSession, resumeSession } from './features/candidatesSlice.js';

const { Header, Content } = Layout;

export default function App(){
  const list = useSelector(s=>s.candidates.list);
  const dispatch = useDispatch();
  const welcomeCandidate = list.find(c=>!c.finished && c.session && c.session.needsWelcome);
  const [showResume,setShowResume] = useState(false);
  const [welcome,setWelcome] = useState(false);
  const [resumeId,setResumeId] = useState(null);
  const shownWelcomeTokens = useRef(new Set());

  const welcomeToken = welcomeCandidate && welcomeCandidate.session.lastPausedAt
    ? `${welcomeCandidate.id}:${welcomeCandidate.session.lastPausedAt}`
    : null;

  useEffect(()=>{
    if(welcomeToken && !shownWelcomeTokens.current.has(welcomeToken)){
      shownWelcomeTokens.current.add(welcomeToken);
      setResumeId(welcomeCandidate.id);
      setWelcome(true);
    }
  },[welcomeCandidate, welcomeToken]);

  useEffect(()=>{
    const handler = () => {
      const now = Date.now();
      list.filter(c=>!c.finished && c.session && c.session.active).forEach(c=>{
        dispatch(pauseSession({id: c.id, now, reason: 'system'}));
      });
    };
    window.addEventListener('beforeunload', handler);
    return ()=> window.removeEventListener('beforeunload', handler);
  },[list, dispatch]);

  const resumeTarget = resumeId ? list.find(c=>c.id===resumeId) : welcomeCandidate;

  return <Layout style={{minHeight:'100vh'}}>
    <Header style={{color:'#fff', fontWeight:600}}>AI Interview Assistant</Header>
    <Content style={{padding:24}}>
      <ErrorBoundary>
        <ScoreQueueWorker />
        {AI_MODE==='UNAVAILABLE' && <Alert type="error" showIcon style={{marginBottom:16}} message="AI unavailable: set VITE_GROQ_API_KEY or configure proxy before interviews can start." />}
        <Tabs items={[
          { key:'i1', label:'Interviewee', children:<div>{showResume && <ResumeUploader />}<InterviewChat /><Button style={{marginTop:16}} onClick={()=>setShowResume(s=>!s)}>{showResume? 'Hide Resume Uploader':'Upload Another Resume'}</Button></div>},
          { key:'i2', label:'Interviewer', children:<InterviewerDashboard />}
        ]} />
      </ErrorBoundary>
      <Modal open={welcome && !!resumeTarget} onCancel={()=>setWelcome(false)} onOk={()=>{
        if(resumeTarget) dispatch(resumeSession({id: resumeTarget.id, now: Date.now()}));
        setWelcome(false);
      }} title="Welcome Back" okText="Resume" cancelText="Later">
        You have an unfinished interview. You can continue where you left off.
      </Modal>
    </Content>
  </Layout>;
}
