import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BlockConfig {
  block_key: string;
  block_order: number;
  visible: boolean;
}

export interface BlockDefinition {
  key: string;
  defaultLabel: string;
  icon?: string;
}

export function usePageLayout(pageKey: string, defaultBlocks: BlockDefinition[]) {
  const [configs, setConfigs] = useState<BlockConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConfigs = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('page_layout_configs')
        .select('*')
        .eq('page_key', pageKey);

      if (!error && data) {
        setConfigs(data.map((d: any) => ({
          block_key: d.block_key,
          block_order: d.block_order,
          visible: d.visible,
        })));
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [pageKey]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const isBlockVisible = useCallback((blockKey: string): boolean => {
    const cfg = configs.find(c => c.block_key === blockKey);
    return cfg?.visible ?? true;
  }, [configs]);

  const getOrderedBlocks = useCallback((): BlockDefinition[] => {
    const visible = defaultBlocks.filter(b => isBlockVisible(b.key));
    return visible.sort((a, b) => {
      const orderA = configs.find(c => c.block_key === a.key)?.block_order ?? defaultBlocks.indexOf(a);
      const orderB = configs.find(c => c.block_key === b.key)?.block_order ?? defaultBlocks.indexOf(b);
      return orderA - orderB;
    });
  }, [defaultBlocks, configs, isBlockVisible]);

  const saveConfigs = useCallback(async (newConfigs: BlockConfig[]) => {
    setConfigs(newConfigs);
    for (const cfg of newConfigs) {
      await (supabase as any)
        .from('page_layout_configs')
        .upsert({
          page_key: pageKey,
          block_key: cfg.block_key,
          block_order: cfg.block_order,
          visible: cfg.visible,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'page_key,block_key' });
    }
  }, [pageKey]);

  return { configs, loading, isBlockVisible, getOrderedBlocks, saveConfigs, reload: loadConfigs };
}
