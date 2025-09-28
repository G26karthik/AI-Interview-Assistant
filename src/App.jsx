import React, { useEffect, useRef, useState } from 'react';
import { Layout, Tabs, Modal, Button, Alert, Switch, Tooltip, Grid } from 'antd';
import { BulbOutlined, BulbFilled } from '@ant-design/icons';
import logoUrl from './assets/logo.svg';
import ResumeUploader from './components/ResumeUploader.jsx';
import InterviewChat from './components/InterviewChat.jsx';
import InterviewerDashboard from './components/InterviewerDashboard.jsx';
import { useSelector, useDispatch } from 'react-redux';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScoreQueueWorker from './components/ScoreQueueWorker.jsx';
import { AI_MODE } from './api/groq.js';
import { pauseSession, resumeSession, finishSession } from './features/candidatesSlice.js';
import WelcomeBackModal from './components/WelcomeBackModal.jsx';

const { Header, Content } = Layout;

export default function App(){
  const list = useSelector(s=>s.candidates.list);
  const dispatch = useDispatch();
  const welcomeCandidate = list.find(c=>!c.finished && c.session && c.session.needsWelcome);
  const [showResume,setShowResume] = useState(false);
  const [welcome,setWelcome] = useState(false);
  const [resumeId,setResumeId] = useState(null);
  const [dark,setDark] = useState(()=> localStorage.getItem('theme') !== 'light');
  const screens = Grid.useBreakpoint();
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

  useEffect(()=>{
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('theme', dark? 'dark':'light');
  },[dark]);

  const compact = !screens.md; // below md collapse tab labels maybe later

  return <Layout style={{minHeight:'100vh'}} data-theme={dark? 'dark':'light'}>
    <Header className="header-blur" style={{display:'flex',alignItems:'center',gap:compact?12:20,padding:compact? '0 16px':'0 32px',height:64}}>
      <div style={{flex:1,display:'flex',alignItems:'center',gap:14}}>
        <div className="pill-badge" aria-label={AI_MODE==='LIVE'? 'Live AI Mode':'Mock AI Mode'}>
          <span style={{width:10,height:10,borderRadius:'50%',background: AI_MODE==='LIVE'? '#4ade80':'#fbbf24',boxShadow:`0 0 0 4px ${AI_MODE==='LIVE'? 'rgba(74,222,128,0.25)':'rgba(251,191,36,0.25)'}`}} />
          {AI_MODE==='LIVE'? 'Live AI':'Mock'}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src={logoUrl} alt="App Logo" width={28} height={28} style={{display:'block'}} />
          <h1 style={{margin:0,fontSize:18,fontWeight:600,letterSpacing:.5}} className="brand-gradient">AI Interview Assistant</h1>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <Tooltip title={dark? 'Switch to Light':'Switch to Dark'}>
          <Button size="small" type="text" aria-label="toggle theme" onClick={()=>setDark(d=>!d)} icon={dark? <BulbFilled style={{color:'#facc15'}} />:<BulbOutlined style={{color:'#e2e8f0'}} />} />
        </Tooltip>
        <Tooltip title="Show/Hide Resume Uploader">
          <Switch
            onChange={()=>setShowResume(s=>!s)}
            checked={showResume}
            checkedChildren="Resume"
            unCheckedChildren="Resume"
            style={{background:'#303744'}}
          />
        </Tooltip>
      </div>
    </Header>
    <Content className="app-shell fade-in">
      <ErrorBoundary>
        <ScoreQueueWorker />
        {AI_MODE==='UNAVAILABLE' && <Alert type="error" showIcon style={{marginBottom:16}} message="AI unavailable: set VITE_GROQ_API_KEY or configure proxy before interviews can start." />}
        <Tabs
          size={compact? 'small':'large'}
          tabBarGutter={compact? 8:32}
          items={[
            { key:'i1', label: compact? 'Candidate':'Interviewee', children:<div>{showResume && <ResumeUploader />}<InterviewChat /><Button style={{marginTop:16}} onClick={()=>setShowResume(s=>!s)}>{showResume? 'Hide Resume Uploader':'Upload Another Resume'}</Button></div>},
            { key:'i2', label: compact? 'Admin':'Interviewer', children:<InterviewerDashboard />}
          ]}
        />
      </ErrorBoundary>
      <WelcomeBackModal
        visible={welcome && !!resumeTarget}
        candidate={resumeTarget}
        onResume={() => { if(resumeTarget) dispatch(resumeSession({id: resumeTarget.id, now: Date.now()})); setWelcome(false); }}
        onDiscard={() => { if(resumeTarget) dispatch(finishSession({id: resumeTarget.id, now: Date.now()})); setWelcome(false); }}
        onClose={() => setWelcome(false)}
      />
    </Content>
  </Layout>;
}
