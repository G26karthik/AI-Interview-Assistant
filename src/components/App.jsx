import { AI_MODE } from './api/groq.js';
import React from 'react';
import { Layout } from 'antd';

const { Header } = Layout;

const AppHeader = () => {
  return (
    <Header style={{color:'#fff', fontWeight:600, display:'flex', justifyContent:'space-between'}}>
      <span>AI Interview Assistant</span>
      <span style={{fontSize:12, background: AI_MODE==='LIVE'? '#52c41a':'#faad14', padding:'2px 8px', borderRadius:12}}>{AI_MODE==='LIVE'? 'Live AI':'Mock Mode'}</span>
    </Header>
  );
};

export default AppHeader;