import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConditionalFormatRule {
  id?: string;
  table_key: string;
  column_key: string;
  match_value: string;
  bg_color: string;
  text_color: string | null;
}

export function useConditionalFormat(tableKey: string) {
  const [rules, setRules] = useState<ConditionalFormatRule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRules = useCallback(async () => {
    const { data } = await supabase
      .from('table_conditional_formats')
      .select('*')
      .eq('table_key', tableKey);
    if (data) {
      setRules(data.map((d: any) => ({
        id: d.id,
        table_key: d.table_key,
        column_key: d.column_key,
        match_value: d.match_value,
        bg_color: d.bg_color,
        text_color: d.text_color,
      })));
    }
    setLoading(false);
  }, [tableKey]);

  useEffect(() => { loadRules(); }, [loadRules]);

  /** Get cell style based on conditional formatting rules */
  const getCellConditionalStyle = useCallback((columnKey: string, cellValue: string | null | undefined): React.CSSProperties => {
    if (!cellValue) return {};
    const normalizedValue = cellValue.trim().toLowerCase();
    const rule = rules.find(r =>
      r.column_key === columnKey &&
      r.match_value.trim().toLowerCase() === normalizedValue
    );
    if (!rule) return {};
    const style: React.CSSProperties = { backgroundColor: rule.bg_color };
    if (rule.text_color) style.color = rule.text_color;
    return style;
  }, [rules]);

  const saveRules = useCallback(async (newRules: ConditionalFormatRule[]) => {
    // Delete all existing rules for this table
    await supabase.from('table_conditional_formats').delete().eq('table_key', tableKey);
    // Insert new rules
    if (newRules.length > 0) {
      await supabase.from('table_conditional_formats').insert(
        newRules.map(r => ({
          table_key: tableKey,
          column_key: r.column_key,
          match_value: r.match_value,
          bg_color: r.bg_color,
          text_color: r.text_color,
          updated_at: new Date().toISOString(),
        }))
      );
    }
    setRules(newRules);
  }, [tableKey]);

  return { rules, loading, getCellConditionalStyle, saveRules, reload: loadRules };
}
