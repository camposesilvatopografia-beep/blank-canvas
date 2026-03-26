import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useConditionalFormat } from './useConditionalFormat';

export interface ColumnConfig {
  column_key: string;
  custom_label: string | null;
  visible: boolean;
  column_order: number;
  // Body cell styles
  text_color: string | null;
  bg_color: string | null;
  font_family: string | null;
  font_bold: boolean;
  font_size: string | null;
  icon_name: string | null;
  text_align: string | null;
  font_italic: boolean;
  text_transform: string | null;
  letter_spacing: string | null;
  // Header styles
  header_text_color: string | null;
  header_bg_color: string | null;
  header_font_family: string | null;
  header_font_bold: boolean;
  header_font_size: string | null;
  header_icon_name: string | null;
  header_text_align: string | null;
  header_font_italic: boolean;
  header_text_transform: string | null;
  header_letter_spacing: string | null;
}

export interface ColumnDefinition {
  key: string;
  defaultLabel: string;
}

const DEFAULT_CONFIG: Omit<ColumnConfig, 'column_key' | 'column_order'> = {
  custom_label: null,
  visible: true,
  text_color: null,
  bg_color: null,
  font_family: null,
  font_bold: false,
  font_size: null,
  icon_name: null,
  text_align: null,
  font_italic: false,
  text_transform: null,
  letter_spacing: null,
  header_text_color: null,
  header_bg_color: null,
  header_font_family: null,
  header_font_bold: true,
  header_font_size: null,
  header_icon_name: null,
  header_text_align: null,
  header_font_italic: false,
  header_text_transform: null,
  header_letter_spacing: null,
};

export function useColumnConfig(tableKey: string, defaultColumns: ColumnDefinition[]) {
  const [configs, setConfigs] = useState<ColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { getCellConditionalStyle, rules: conditionalRules, saveRules: saveConditionalRules } = useConditionalFormat(tableKey);

  const loadConfigs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('table_column_configs')
        .select('*')
        .eq('table_key', tableKey);

      if (!error && data) {
        setConfigs(data.map((d: any) => ({
          column_key: d.column_key,
          custom_label: d.custom_label,
          visible: d.visible,
          column_order: d.column_order,
          text_color: d.text_color ?? null,
          bg_color: d.bg_color ?? null,
          font_family: d.font_family ?? null,
          font_bold: d.font_bold ?? false,
          font_size: d.font_size ?? null,
          icon_name: d.icon_name ?? null,
          text_align: d.text_align ?? null,
          font_italic: d.font_italic ?? false,
          text_transform: d.text_transform ?? null,
          letter_spacing: d.letter_spacing ?? null,
          header_text_color: d.header_text_color ?? null,
          header_bg_color: d.header_bg_color ?? null,
          header_font_family: d.header_font_family ?? null,
          header_font_bold: d.header_font_bold ?? true,
          header_font_size: d.header_font_size ?? null,
          header_icon_name: d.header_icon_name ?? null,
          header_text_align: d.header_text_align ?? null,
          header_font_italic: d.header_font_italic ?? false,
          header_text_transform: d.header_text_transform ?? null,
          header_letter_spacing: d.header_letter_spacing ?? null,
        })));
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [tableKey]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const getLabel = useCallback((columnKey: string): string => {
    const cfg = configs.find(c => c.column_key === columnKey);
    if (cfg?.custom_label) return cfg.custom_label;
    const def = defaultColumns.find(d => d.key === columnKey);
    return def?.defaultLabel || columnKey;
  }, [configs, defaultColumns]);

  const isVisible = useCallback((columnKey: string): boolean => {
    const cfg = configs.find(c => c.column_key === columnKey);
    return cfg?.visible ?? true;
  }, [configs]);

  const getVisibleColumns = useCallback((): ColumnDefinition[] => {
    const visible = defaultColumns.filter(col => isVisible(col.key));
    return visible.sort((a, b) => {
      const orderA = configs.find(c => c.column_key === a.key)?.column_order ?? defaultColumns.indexOf(a);
      const orderB = configs.find(c => c.column_key === b.key)?.column_order ?? defaultColumns.indexOf(b);
      return orderA - orderB;
    });
  }, [defaultColumns, configs, isVisible]);

  const getConfig = useCallback((columnKey: string): ColumnConfig | undefined => {
    return configs.find(c => c.column_key === columnKey);
  }, [configs]);

  /** Style for body cells, with optional conditional formatting based on cell value */
  const getStyle = useCallback((columnKey: string, cellValue?: string | null): React.CSSProperties => {
    const cfg = configs.find(c => c.column_key === columnKey);
    const style: React.CSSProperties = {};
    if (cfg) {
      if (cfg.text_color) style.color = cfg.text_color;
      if (cfg.bg_color) style.backgroundColor = cfg.bg_color;
      if (cfg.font_family) style.fontFamily = cfg.font_family;
      if (cfg.font_bold) style.fontWeight = 'bold';
      if (cfg.font_italic) style.fontStyle = 'italic';
      if (cfg.font_size) style.fontSize = cfg.font_size;
      if (cfg.text_align) style.textAlign = cfg.text_align as any;
      if (cfg.text_transform) style.textTransform = cfg.text_transform as any;
      if (cfg.letter_spacing) style.letterSpacing = cfg.letter_spacing;
    }
    // Apply conditional formatting (overrides base style)
    if (cellValue !== undefined) {
      const condStyle = getCellConditionalStyle(columnKey, cellValue);
      Object.assign(style, condStyle);
    }
    return style;
  }, [configs, getCellConditionalStyle]);

  /** Style for header cells */
  const getHeaderStyle = useCallback((columnKey: string): React.CSSProperties => {
    const cfg = configs.find(c => c.column_key === columnKey);
    if (!cfg) return {};
    const style: React.CSSProperties = {};
    if (cfg.header_text_color) style.color = cfg.header_text_color;
    if (cfg.header_bg_color) style.backgroundColor = cfg.header_bg_color;
    if (cfg.header_font_family) style.fontFamily = cfg.header_font_family;
    if (cfg.header_font_bold) style.fontWeight = 'bold';
    if (cfg.header_font_italic) style.fontStyle = 'italic';
    if (cfg.header_font_size) style.fontSize = cfg.header_font_size;
    if (cfg.header_text_align) style.textAlign = cfg.header_text_align as any;
    if (cfg.header_text_transform) style.textTransform = cfg.header_text_transform as any;
    if (cfg.header_letter_spacing) style.letterSpacing = cfg.header_letter_spacing;
    return style;
  }, [configs]);

  const getIconName = useCallback((columnKey: string): string | null => {
    const cfg = configs.find(c => c.column_key === columnKey);
    return cfg?.icon_name ?? null;
  }, [configs]);

  const getHeaderIconName = useCallback((columnKey: string): string | null => {
    const cfg = configs.find(c => c.column_key === columnKey);
    return cfg?.header_icon_name ?? null;
  }, [configs]);

  const saveConfigs = useCallback(async (newConfigs: ColumnConfig[]) => {
    setConfigs(newConfigs);
    for (const cfg of newConfigs) {
      await supabase
        .from('table_column_configs')
        .upsert({
          table_key: tableKey,
          column_key: cfg.column_key,
          custom_label: cfg.custom_label,
          visible: cfg.visible,
          column_order: cfg.column_order,
          text_color: cfg.text_color,
          bg_color: cfg.bg_color,
          font_family: cfg.font_family,
          font_bold: cfg.font_bold,
          font_size: cfg.font_size,
          icon_name: cfg.icon_name,
          text_align: cfg.text_align,
          font_italic: cfg.font_italic,
          text_transform: cfg.text_transform,
          letter_spacing: cfg.letter_spacing,
          header_text_color: cfg.header_text_color,
          header_bg_color: cfg.header_bg_color,
          header_font_family: cfg.header_font_family,
          header_font_bold: cfg.header_font_bold,
          header_font_size: cfg.header_font_size,
          header_icon_name: cfg.header_icon_name,
          header_text_align: cfg.header_text_align,
          header_font_italic: cfg.header_font_italic,
          header_text_transform: cfg.header_text_transform,
          header_letter_spacing: cfg.header_letter_spacing,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'table_key,column_key' });
    }
  }, [tableKey]);

  return { configs, loading, getLabel, isVisible, getVisibleColumns, getStyle, getHeaderStyle, getIconName, getHeaderIconName, getConfig, saveConfigs, reload: loadConfigs, conditionalRules, saveConditionalRules, getCellConditionalStyle };
}
