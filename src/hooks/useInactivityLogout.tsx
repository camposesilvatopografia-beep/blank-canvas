import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

// Inactivity timeout disabled - users should stay logged in permanently
// Set to 24 hours as a safety fallback (effectively disabled for normal use)
const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000;

// Activity events to track
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function useInactivityLogout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Check if we're on a mobile route
  const isMobileRoute = location.pathname.startsWith('/mobile');

  const handleLogout = useCallback(async () => {
    // Only logout if on mobile routes
    if (isMobileRoute && user) {
      console.log('Inactivity logout triggered');
      await signOut();
      navigate('/mobile/auth');
    }
  }, [isMobileRoute, user, signOut, navigate]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only set timeout if user is logged in and on mobile route
    if (user && isMobileRoute) {
      timeoutRef.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, isMobileRoute, handleLogout]);

  useEffect(() => {
    // Only track activity on mobile routes
    if (!isMobileRoute || !user) {
      return;
    }

    // Set initial timer
    resetTimer();

    // Add event listeners for activity
    const handleActivity = () => {
      resetTimer();
    };

    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Check if the app was inactive while in background (for PWA)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
          handleLogout();
        } else {
          resetTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isMobileRoute, resetTimer, handleLogout]);

  return { resetTimer };
}
