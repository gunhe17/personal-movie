import { useState, useRef, useCallback, useEffect } from 'react';
import { formatTime } from './utils';

interface UseTimerReturn {
  /** 경과 시간 (초) */
  elapsed: number;
  /** 포맷된 시간 "HH:MM:SS" */
  formatted: string;
  /** 타이머 시작 (initialSeconds부터 시작) */
  start: (initialSeconds?: number) => void;
  /** 타이머 일시정지 */
  pause: () => void;
  /** 타이머 재개 */
  resume: () => void;
  /** 타이머 정지 + 초기화 */
  stop: () => void;
  /** 실행 중 여부 */
  isRunning: boolean;
}

export function useTimer(): UseTimerReturn {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const current = accumulatedRef.current + (now - startTimeRef.current) / 1000;
    setElapsed(current);
  }, []);

  const start = useCallback((initialSeconds = 0) => {
    clearTimer();
    accumulatedRef.current = initialSeconds;
    startTimeRef.current = Date.now();
    setElapsed(initialSeconds);
    setIsRunning(true);
    intervalRef.current = setInterval(tick, 200);
  }, [clearTimer, tick]);

  const pause = useCallback(() => {
    if (!isRunning) return;
    clearTimer();
    accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    setIsRunning(false);
  }, [isRunning, clearTimer]);

  const resume = useCallback(() => {
    if (isRunning) return;
    startTimeRef.current = Date.now();
    setIsRunning(true);
    intervalRef.current = setInterval(tick, 200);
  }, [isRunning, tick]);

  const stop = useCallback(() => {
    clearTimer();
    accumulatedRef.current = 0;
    setIsRunning(false);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const formatted = formatTime(elapsed);

  return { elapsed, formatted, start, pause, resume, stop, isRunning };
}

