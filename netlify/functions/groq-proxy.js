import fetch from 'node-fetch';
export async function handler(event){
  if(event.httpMethod !== 'POST') return { statusCode:405, body: 'Method Not Allowed' };
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if(!apiKey) return { statusCode:500, body:'Missing GROQ_API_KEY' };
    const body = JSON.parse(event.body||'{}');
    const path = body.path || 'chat/completions';
    const r = await fetch(`https://api.groq.com/openai/v1/${path}`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`}, body: JSON.stringify(body.payload) });
    const text = await r.text();
    return { statusCode: r.status, body: text };
  } catch(e){
    return { statusCode:500, body: e.message };
  }
}
