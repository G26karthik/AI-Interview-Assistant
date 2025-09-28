// Clean implementation
const API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_Q = 'llama-3.1-8b-instant';
const MODEL_SCORE = 'llama-3.1-8b-instant';
const USE_PROXY = !!import.meta.env.VITE_USE_PROXY;
const PROXY_ENDPOINT = '/api/groq-proxy';

export const AI_MODE = (USE_PROXY || API_KEY) ? 'LIVE' : 'UNAVAILABLE';
export const weights = { Easy: 1, Medium: 1.5, Hard: 2 };

const LEVEL_BRIEF = {
  Easy: 'Ask for a hands-on explanation of fundamentals or a small improvement to something they have shipped.',
  Medium: 'Pose a realistic scenario that stretches their recent project experience and requires trade-off thinking.',
  Hard: 'Dig into system design or deep debugging that stresses scalability, reliability, or performance in a real production context.'
};

function ensureAvailable(){
  if(AI_MODE === 'UNAVAILABLE') throw new Error('AI unavailable: configure VITE_GROQ_API_KEY or VITE_USE_PROXY');
}

function buildQuestionPrompt(level, role, context='') {
  const ctx = context ? `Candidate Resume:\n${context}\n---` : '';
  const tone = LEVEL_BRIEF[level] || LEVEL_BRIEF.Medium;
  return `You are a principal engineer conducting a real-time interview for a ${role} candidate. Speak exactly as you would in a live conversation.\n${ctx}\nCraft one follow-up question that:\n- explicitly references the candidate's actual work history or tech stack;\n- matches the ${level} difficulty (${tone});\n- avoids stock phrases like "Design a scalable system" unless you anchor it to something they shipped;\n- fits in one or two sentences and sounds natural ("Can you walk me through...", "How would you handle...").\nDo not add numbering, preambles, or quotes. Respond with the question only.`;
}

async function groqChat(messages, { model = MODEL_Q, temperature = 0.4, max_tokens = 256, stream=false } = {}, retries = 2){
  ensureAvailable();
  const body = { model, messages, temperature, max_tokens, stream };
  const url = USE_PROXY ? PROXY_ENDPOINT : BASE_URL;
  const headers = { 'Content-Type':'application/json' };
  if(!USE_PROXY) headers.Authorization = `Bearer ${API_KEY}`;
  for(let attempt=0; attempt<=retries; attempt++){
    try {
      const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body) });
      if(!res.ok) throw new Error('HTTP '+res.status);
      if(stream) return res.body;
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if(!content) throw new Error('Empty response');
      return content;
    } catch(e){ if(attempt===retries) throw e; await new Promise(r=>setTimeout(r,(attempt+1)*500)); }
  }
}

export async function generateQuestion(level, role='Full Stack React/Node', context='') {
  try {
    const prompt = buildQuestionPrompt(level, role, context);
    const content = await groqChat([{role:'user', content: prompt}]);
    return content.replace(/^[\d\-\)\.\s]+/, '').slice(0,300);
  } catch(e){ console.warn('Question generation failed', e); throw e; }
}

export async function streamQuestion(level, role='Full Stack React/Node', onToken, context='') {
  const prompt = buildQuestionPrompt(level, role, context);
  const messages = [{role:'user', content: prompt}];
  const stream = await groqChat(messages, { model: MODEL_Q, stream:true, temperature:0.35, max_tokens: 180 });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer='';
  while(true){
    const {done, value} = await reader.read(); if(done) break; buffer += decoder.decode(value,{stream:true});
    const lines = buffer.split(/\n/);
    buffer = lines.pop();
    for(const line of lines){
      if(line.startsWith('data: ')){
        const payload = line.slice(6).trim(); if(payload==='[DONE]') return;
        try { const json = JSON.parse(payload); const delta = json.choices?.[0]?.delta?.content; if(delta) onToken(delta); } catch(_e){}
      }
    }
  }
}

export async function scoreAnswer(question, answer){
  try {
    const sys = 'You are a strict technical interviewer. Respond ONLY with JSON {"numeric":0-10,"feedback":"short critique"}.';
    const user = `Question: ${question}\nAnswer: ${answer}`;
    const raw = await groqChat([{role:'system',content:sys},{role:'user',content:user}], { model: MODEL_SCORE, max_tokens: 200, temperature:0.15 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if(jsonMatch){ const parsed = JSON.parse(jsonMatch[0]); if(typeof parsed.numeric==='number') return parsed; }
    throw new Error('Parse failure');
  } catch(e){ console.warn('Score evaluation failed', e); return { numeric:0, feedback:'Scoring failed – please refine answer or retry.' }; }
}

function inferLevelFromIndex(i){ return i<2? 'Easy' : i<4? 'Medium':'Hard'; }

export async function summaryFromAI(candidate){
  const answers = candidate.session.answers;
  const weightedSum = answers.reduce((s,a,i)=> s + (a.score?.numeric||0) * (weights[a.level|| inferLevelFromIndex(i)]||1),0);
  const totalWeights = answers.reduce((s,a,i)=> s + (weights[a.level|| inferLevelFromIndex(i)]||1),0) || 1;
  const weighted = +(weightedSum / totalWeights).toFixed(1);
  try {
    const sys = 'You are a senior technical interviewer. Write a detailed, actionable summary for the candidate. Your summary MUST include: (1) a clear statement of strengths, (2) at least one specific area for improvement, and (3) a concrete suggestion for next steps or learning. Be direct, professional, and avoid generic praise.';
    const compressed = answers.map((a,i)=>`Q${i+1}(${a.level||inferLevelFromIndex(i)}):${a.q.slice(0,60)}|Ans:${(a.a||'').slice(0,80)}|Score:${a.score?.numeric}`).join(' \n');
    const user = `Role: ${candidate.role||'Full Stack'}\nWeightedScore:${weighted}\nData:\n${compressed}`;
    const content = await groqChat([{role:'system',content:sys},{role:'user',content:user}], { max_tokens: 320, temperature:0.35 });
    return { score: weighted, summary: content.slice(0,800) };
  } catch(e){ console.warn('Summary generation failed', e); return { score: weighted, summary: `Candidate achieved weighted score ${weighted}.` }; }
}

export function classifyTopic(question){
  const q = question.toLowerCase();
  if(/hook|state|jsx|component/.test(q)) return 'React';
  if(/express|middleware|jwt|api|endpoint|rest/.test(q)) return 'API';
  if(/scal|performance|cache|caching|optimiz/.test(q)) return 'Performance';
  if(/websocket|real-time|realtime/.test(q)) return 'RealTime';
  if(/database|index|schema|query/.test(q)) return 'Database';
  return 'General';
}
