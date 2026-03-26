import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ObraConfig {
  nome: string;
  local: string;
  logo: string | null; // public URL or base64
}

const DEFAULT_CONFIG: ObraConfig = {
  nome: '',
  local: '',
  logo: null,
};

export function useObraConfig() {
  const [obraConfig, setObraConfigState] = useState<ObraConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);

  // Load from database on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('obra_config')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setConfigId(data.id);
          let logoUrl: string | null = null;
          if (data.logo_path) {
            const { data: urlData } = supabase.storage
              .from('obra-logos')
              .getPublicUrl(data.logo_path);
            logoUrl = urlData?.publicUrl || null;
          }
          setObraConfigState({
            nome: data.nome || '',
            local: data.local || '',
            logo: logoUrl,
          });
        } else {
          // Fallback: try localStorage for migration
          try {
            const stored = localStorage.getItem('apropriapp_obra_config');
            if (stored) {
              const parsed = JSON.parse(stored);
              setObraConfigState(parsed);
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
      setLoading(false);
    };
    loadConfig();
  }, []);

  const uploadLogo = useCallback(async (base64: string): Promise<string | null> => {
    try {
      // Convert base64 to blob
      const res = await fetch(base64);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'png';
      const fileName = `obra-logo-${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('obra-logos')
        .upload(fileName, blob, { upsert: true });

      if (error) {
        console.error('Logo upload error:', error);
        return null;
      }
      return fileName;
    } catch (e) {
      console.error('Logo upload error:', e);
      return null;
    }
  }, []);

  const setObraConfig = useCallback(async (config: ObraConfig) => {
    setObraConfigState(config);

    let logoPath: string | null = null;

    // If logo is base64, upload it
    if (config.logo && config.logo.startsWith('data:')) {
      logoPath = await uploadLogo(config.logo);
      if (logoPath) {
        const { data: urlData } = supabase.storage
          .from('obra-logos')
          .getPublicUrl(logoPath);
        setObraConfigState(prev => ({ ...prev, logo: urlData?.publicUrl || prev.logo }));
      }
    }

    const dbData = {
      nome: config.nome,
      local: config.local,
      logo_path: logoPath,
      updated_at: new Date().toISOString(),
    };

    if (configId) {
      // If removing logo, set logo_path to null; if keeping existing (URL), don't change
      const updateData: any = { nome: config.nome, local: config.local, updated_at: new Date().toISOString() };
      if (config.logo === null) {
        updateData.logo_path = null;
      } else if (logoPath) {
        updateData.logo_path = logoPath;
      }
      // else: keep existing logo_path

      await supabase.from('obra_config').update(updateData).eq('id', configId);
    } else {
      const { data } = await supabase.from('obra_config').insert(dbData).select('id').single();
      if (data) setConfigId(data.id);
    }

    // Also save to localStorage as fallback
    localStorage.setItem('apropriapp_obra_config', JSON.stringify(config));
  }, [configId, uploadLogo]);

  const updateObraConfig = useCallback((partial: Partial<ObraConfig>) => {
    setObraConfigState(prev => {
      const updated = { ...prev, ...partial };
      // Fire async save
      setObraConfig(updated);
      return updated;
    });
  }, [setObraConfig]);

  return { obraConfig, setObraConfig, updateObraConfig, loading };
}
