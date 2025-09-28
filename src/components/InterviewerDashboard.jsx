import React, { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Table, Input, Tag, Modal, Button } from 'antd';
import { jsPDF } from 'jspdf';
import { clearHistory } from '../features/candidatesSlice';

export default function InterviewerDashboard(){
  const dispatch = useDispatch();
  const list = useSelector(s=>s.candidates.list);
  const [q,setQ]=useState('');
  const filtered = useMemo(()=> {
    const lower = q.toLowerCase();
    const scoped = list.filter(c=> (c.name||'').toLowerCase().includes(lower) || (c.email||'').toLowerCase().includes(lower));
    return scoped.sort((a,b)=>{
      const scoreA = typeof a.score==='number'? a.score : -Infinity;
      const scoreB = typeof b.score==='number'? b.score : -Infinity;
      if(scoreA === scoreB) return (a.name||'').localeCompare(b.name||'');
      return scoreB - scoreA;
    });
  },[list,q]);
  const exportPDF = (candidate) => {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text(candidate.name || 'Candidate', 10, 12);
    doc.setFontSize(10); doc.text(`Score: ${candidate.score ?? 'N/A'}`, 10, 20);
    let y=30;
    candidate.session.answers.forEach((a,i)=>{ if(y>270){ doc.addPage(); y=20; }
      doc.text(`Q${i+1} (${a.level}): ${a.q.slice(0,80)}`,10,y); y+=6; doc.text(`A: ${(a.a||'').slice(0,90)}`,10,y); y+=6; doc.text(`Score: ${a.score?.numeric??'-'} ${a.score?.feedback||''}`.slice(0,100),10,y); y+=8; });
    doc.save(`${candidate.name||'candidate'}-report.pdf`);
  };
  const columns = [
    {title:'Name', dataIndex:'name', sorter:(a,b)=> (a.name||'').localeCompare(b.name||'')},
    {
      title: 'Score',
      dataIndex: 'score',
      sorter: (a, b) => (a.score || 0) - (b.score || 0),
      render: (s) => (typeof s === 'number' ? s.toFixed(1) : <Tag>In Progress</Tag>)
    },
    {title:'Summary', dataIndex:'summary', ellipsis:true},
    {title:'Details', render:(_,r)=> <>
      <a style={{marginRight:8}} onClick={()=>Modal.info({
        width:720,
        title:r.name||'Candidate',
        content:<div>
          <section style={{marginBottom:12}}>
            <p><b>Email:</b> {r.email || '—'}</p>
            <p><b>Phone:</b> {r.phone || '—'}</p>
            <p><b>Summary:</b> {r.summary || 'Pending summary.'}</p>
            <p><b>Resume Preview:</b> {(r.resumeText||'').slice(0,400) || 'No resume text captured.'}</p>
          </section>
          <section>
            <h4>Interview Transcript</h4>
            {r.session.answers.map((a,i)=><div key={i} style={{marginBottom:10}}>
              <p><b>Q{i+1} ({a.level}):</b> {a.q}</p>
              <p><b>Answer:</b> {a.a||'[empty]'}</p>
              <p><b>Score:</b> {a.score?.numeric ?? '-'} {a.score?.feedback ? `(${a.score.feedback})` : ''}</p>
            </div>)}
          </section>
        </div>
      })}>View</a>
      <Button size="small" onClick={()=>exportPDF(r)}>PDF</Button>
    </>},
    {title:'Topics', render:(_,r)=> r.topicStats? Object.entries(r.topicStats).map(([t,v])=> <Tag key={t}>{t}:{(v.total/v.count).toFixed(1)}</Tag>) : null},
  ];
  return <div>
    <Input placeholder="Search by name" style={{marginBottom:12,maxWidth:300}} value={q} onChange={e=>setQ(e.target.value)} />
    <Button danger style={{marginBottom:12,marginLeft:12}} onClick={()=>dispatch(clearHistory())}>Clear All History</Button>
    <Table rowKey="id" dataSource={filtered} columns={columns} pagination={{pageSize:5}} size="small" />
  </div>;
}
