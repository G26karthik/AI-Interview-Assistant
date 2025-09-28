import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { attachScore } from '../features/candidatesSlice.js';
import { scoreAnswer, AI_MODE } from '../api/groq.js';

// Periodically attempts to score pending answers when online
export default function ScoreQueueWorker(){
  const dispatch = useDispatch();
  const candidates = useSelector(s=>s.candidates.list);
  const pending = useSelector(s=>s.candidates.pendingScores);

  useEffect(()=>{
    let timer;
    const process = async () => {
  if(!navigator.onLine) return; // wait until online
  if(AI_MODE === 'UNAVAILABLE') return; // suppress attempts without credentials
      for(const item of pending){
        const c = candidates.find(x=>x.id===item.id); if(!c) continue;
        const ans = c.session.answers[item.idx]; if(!ans || ans.score) continue;
        try {
          const newScore = await scoreAnswer(ans.q, ans.a||'[No answer]');
            dispatch(attachScore({id: c.id, idx: item.idx, score: newScore}));
        } catch(e){ /* leave in queue */ }
      }
    };
    timer = setInterval(process, 4000);
    window.addEventListener('online', process);
    process();
    return ()=>{ clearInterval(timer); window.removeEventListener('online', process); };
  },[pending,candidates,dispatch]);
  return null;
}
