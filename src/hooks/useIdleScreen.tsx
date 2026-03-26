import { useEffect, useRef, useState, useCallback } from 'react';

const IDLE_TIMEOUT = 1 * 60 * 1000; // 1 minute of inactivity
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function useIdleScreen() {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIdleRef = useRef(false);

  const startTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
    }, IDLE_TIMEOUT);
  }, []);

  const dismiss = useCallback(() => {
    isIdleRef.current = false;
    setIsIdle(false);
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    startTimer();

    const handleActivity = () => {
      // Only reset if not idle (idle screen handles its own dismiss)
      if (!isIdleRef.current) {
        startTimer();
      }
    };

    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [startTimer]);

  return { isIdle, dismiss };
}
