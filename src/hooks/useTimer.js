import { useEffect, useRef, useState } from 'react';

function computeRemaining(timer){
  if(!timer) return 0;
  const base = typeof timer.remaining === 'number' ? timer.remaining : 0;
  const hasStart = typeof timer.startedAt === 'number';
  if(hasStart){
    const elapsed = (Date.now() - timer.startedAt) / 1000;
    return Math.max(0, Math.round(base - elapsed));
  }
  return Math.max(0, Math.round(base));
}

export default function useTimer(timer, active, onEnd){
  const [remain,setRemain] = useState(()=>computeRemaining(timer));
  const tickingRef = useRef(null);
  const didEndRef = useRef(false);

  useEffect(()=>{
    setRemain(computeRemaining(timer));
    didEndRef.current = false;
  },[timer?.remaining, timer?.startedAt, timer?.total]);

  useEffect(()=>{
    if(!active || typeof timer?.startedAt !== 'number'){
      if(tickingRef.current){ clearInterval(tickingRef.current); tickingRef.current=null; }
      return;
    }
    tickingRef.current = setInterval(()=>{
      setRemain(prev=>{
        const next = computeRemaining(timer);
        if(next <= 0 && !didEndRef.current){
          didEndRef.current = true;
          onEnd && onEnd();
        }
        return next;
      });
    },1000);
    return ()=>{ if(tickingRef.current) clearInterval(tickingRef.current); tickingRef.current=null; };
  },[active,onEnd,timer]);

  useEffect(()=>{
    const next = computeRemaining(timer);
    setRemain(next);
    if(next <=0 && active && typeof timer?.startedAt === 'number' && !didEndRef.current){
      didEndRef.current = true;
      onEnd && onEnd();
    }
  },[timer?.remaining, timer?.startedAt, active, onEnd]);

  return remain;
}
