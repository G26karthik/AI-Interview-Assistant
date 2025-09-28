import React from 'react';
import { Modal, Button, Typography } from 'antd';
const { Paragraph, Text } = Typography;

/*
  WelcomeBackModal
  Props:
    visible: boolean
    candidate: candidate object (or null)
    onResume: fn()
    onDiscard: fn()
    onClose: fn()
*/
export default function WelcomeBackModal({ visible, candidate, onResume, onDiscard, onClose }){
  const secondsRemaining = candidate?.session?.timer?.remaining ?? null;
  const questionIndex = candidate?.session?.qIdx ?? -1;
  const progress = questionIndex >= 0 ? `${questionIndex}/6 questions answered` : 'Not started';
  return (
    <Modal
      open={visible}
      title="Welcome Back"
      onCancel={onClose}
      footer={[
        <Button key="discard" danger onClick={onDiscard}>Discard</Button>,
        <Button key="resume" type="primary" onClick={onResume}>Resume Interview</Button>
      ]}
    >
      <Paragraph>
        {candidate?.name ? <Text strong>{candidate.name}</Text> : 'Candidate'}, you left an interview in progress.
      </Paragraph>
      <Paragraph style={{marginBottom:8}}>
        <Text type="secondary">Progress:</Text> {progress}
      </Paragraph>
      {secondsRemaining != null && (
        <Paragraph style={{marginBottom:0}}>
          <Text type="secondary">Time left on last question:</Text> {secondsRemaining}s
        </Paragraph>
      )}
      <Paragraph style={{marginTop:16}}>
        Choose Resume to continue exactly where you paused, or Discard to end and review current results.
      </Paragraph>
    </Modal>
  );
}
