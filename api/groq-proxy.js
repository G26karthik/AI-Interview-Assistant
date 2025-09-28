// Vercel serverless function: /api/groq-proxy
export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const { path='chat', body } = req.query;
    const apiKey = process.env.GROQ_API_KEY;
    if(!apiKey) return res.status(500).json({error:'Missing GROQ_API_KEY'});
    const r = await fetch(`https://api.groq.com/openai/v1/${path}`, {
      method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` }, body: JSON.stringify(body)
    });
    res.status(r.status).send(await r.text());
  } catch(e){
    res.status(500).json({error: e.message});
  }
}
