import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MenuConfig {
  menu_key: string;
  custom_label: string | null;
  menu_order: number;
  visible: boolean;
}

export function useSidebarMenuConfig() {
  const [configs, setConfigs] = useState<MenuConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('sidebar_menu_configs')
        .select('*')
        .order('menu_order', { ascending: true });

      if (!error && data) {
        setConfigs(data.map((d: any) => ({
          menu_key: d.menu_key,
          custom_label: d.custom_label,
          menu_order: d.menu_order,
          visible: d.visible,
        })));
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getLabel = useCallback((menuKey: string, defaultLabel: string): string => {
    const cfg = configs.find(c => c.menu_key === menuKey);
    return cfg?.custom_label || defaultLabel;
  }, [configs]);

  const isVisible = useCallback((menuKey: string): boolean => {
    const cfg = configs.find(c => c.menu_key === menuKey);
    return cfg?.visible ?? true;
  }, [configs]);

  const getOrder = useCallback((menuKey: string, defaultOrder: number): number => {
    const cfg = configs.find(c => c.menu_key === menuKey);
    return cfg?.menu_order ?? defaultOrder;
  }, [configs]);

  const saveConfigs = useCallback(async (newConfigs: MenuConfig[]) => {
    setConfigs(newConfigs);
    for (const cfg of newConfigs) {
      await (supabase as any)
        .from('sidebar_menu_configs')
        .upsert({
          menu_key: cfg.menu_key,
          custom_label: cfg.custom_label,
          menu_order: cfg.menu_order,
          visible: cfg.visible,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'menu_key' });
    }
  }, []);

  return { configs, loading, getLabel, isVisible, getOrder, saveConfigs, reload: load };
}
