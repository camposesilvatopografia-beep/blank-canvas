import { useState, useEffect, useCallback } from 'react';

const LOGO_STORAGE_KEY = 'apropriapp_custom_logo';

export function useAppLogo() {
  const [customLogo, setCustomLogoState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(LOGO_STORAGE_KEY);
    setCustomLogoState(stored || null);
    setLoading(false);
  }, []);

  const setCustomLogo = useCallback((dataUrl: string | null) => {
    if (dataUrl) {
      localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(LOGO_STORAGE_KEY);
    }
    setCustomLogoState(dataUrl);
  }, []);

  return { customLogo, setCustomLogo, loading };
}
