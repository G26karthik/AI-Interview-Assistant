import React, { useState } from 'react';
import { Upload, Button, message, Space, Alert } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { InboxOutlined } from '@ant-design/icons';
import { parsePDF, parseDOCX, extractFields } from '../utils/resumeParser.js';
import { useDispatch } from 'react-redux';
import { addCandidate, updateCandidate } from '../features/candidatesSlice.js';

export default function ResumeUploader(){
  const [loading,setLoading] = useState(false);
  const dispatch = useDispatch();

  const beforeUpload = async (file) => {
    const isOk = file.type === 'application/pdf' || file.name.endsWith('.docx');
    if(!isOk){ message.error('Upload PDF or DOCX'); return Upload.LIST_IGNORE; }
    setLoading(true);
    try {
      const text = file.type==='application/pdf'? await parsePDF(file) : await parseDOCX(file);
      const fields = extractFields(text);
      const candidate = { ...fields, resumeText: text };
      dispatch(addCandidate(candidate));
      message.success('Resume processed');
    } catch(e){ console.error(e); message.error('Parse failed'); }
    setLoading(false);
    return false; // prevent auto
  };

  return <Space direction="vertical" style={{width:'100%'}}>
    <Upload.Dragger multiple={false} beforeUpload={beforeUpload} showUploadList={false} disabled={loading}>
      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
      <p className="ant-upload-text">Click or drag resume (PDF/DOCX)</p>
      <p style={{fontSize:12, color:'#666'}}>We parse text only locally; keep file under ~2MB for best results.</p>
    </Upload.Dragger>
  {loading && <span style={{display:'flex',alignItems:'center',gap:6,fontSize:13}}><LoadingOutlined spin /> Parsing resume...</span>}
    <Alert type="info" showIcon message="After upload: complete any missing fields then press Start Interview in the details card." />
  </Space>;
}
