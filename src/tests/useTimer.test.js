import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTimer from '../hooks/useTimer.js';

describe('useTimer', ()=>{
  it('counts down and calls onEnd once active with start timestamp', async ()=>{
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onEnd = vi.fn();
    const now = Date.now();
    const { result, rerender } = renderHook(({timer, active})=> useTimer(timer, active, onEnd), {
      initialProps: {
        active: true,
        timer: { remaining: 3, startedAt: now, total: 3 }
      }
    });
    expect(result.current).toBe(3);
  await act(async ()=>{ await vi.advanceTimersByTimeAsync(1000); });
  expect(Date.now()).toBe(1000);
    expect(result.current).toBe(2);
    await act(async ()=>{ await vi.advanceTimersByTimeAsync(2000); });
    expect(onEnd).toHaveBeenCalledTimes(1);

    // Pause scenario (no startedAt)
    rerender({ active: false, timer: { remaining: 5, startedAt: null, total:5 } });
    await act(async ()=>{ await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current).toBe(5);

    vi.useRealTimers();
  });
});
