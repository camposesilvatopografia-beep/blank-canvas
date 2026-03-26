import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReportHeaderConfig {
  logo_visible: boolean;
  logo_height: number;
  header_padding_top: number;
  header_padding_bottom: number;
  header_padding_left: number;
  header_padding_right: number;
  title_font_size: number;
  subtitle_font_size: number;
  date_font_size: number;
  header_gap: number;
  stats_gap: number;
  stats_margin_bottom: number;
}

const DEFAULTS: ReportHeaderConfig = {
  logo_visible: true,
  logo_height: 60,
  header_padding_top: 12,
  header_padding_bottom: 12,
  header_padding_left: 20,
  header_padding_right: 20,
  title_font_size: 18,
  subtitle_font_size: 13,
  date_font_size: 11,
  header_gap: 16,
  stats_gap: 12,
  stats_margin_bottom: 16,
};

export function useReportHeaderConfig(reportKey: string) {
  const [config, setConfig] = useState<ReportHeaderConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('report_header_configs')
        .select('*')
        .eq('report_key', reportKey)
        .maybeSingle();

      if (!error && data) {
        setConfig({
          logo_visible: data.logo_visible ?? DEFAULTS.logo_visible,
          logo_height: data.logo_height ?? DEFAULTS.logo_height,
          header_padding_top: data.header_padding_top ?? DEFAULTS.header_padding_top,
          header_padding_bottom: data.header_padding_bottom ?? DEFAULTS.header_padding_bottom,
          header_padding_left: data.header_padding_left ?? DEFAULTS.header_padding_left,
          header_padding_right: data.header_padding_right ?? DEFAULTS.header_padding_right,
          title_font_size: data.title_font_size ?? DEFAULTS.title_font_size,
          subtitle_font_size: data.subtitle_font_size ?? DEFAULTS.subtitle_font_size,
          date_font_size: data.date_font_size ?? DEFAULTS.date_font_size,
          header_gap: data.header_gap ?? DEFAULTS.header_gap,
          stats_gap: data.stats_gap ?? DEFAULTS.stats_gap,
          stats_margin_bottom: data.stats_margin_bottom ?? DEFAULTS.stats_margin_bottom,
        });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [reportKey]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (newConfig: ReportHeaderConfig) => {
    setConfig(newConfig);
    await (supabase as any)
      .from('report_header_configs')
      .upsert({
        report_key: reportKey,
        ...newConfig,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'report_key' });
  }, [reportKey]);

  /** Generate inline CSS string for PDF/print headers */
  const getHeaderCss = useCallback(() => {
    const c = config;
    return {
      headerPadding: `${c.header_padding_top}px ${c.header_padding_right}px ${c.header_padding_bottom}px ${c.header_padding_left}px`,
      headerGap: `${c.header_gap}px`,
      logoHeight: `${c.logo_height}px`,
      titleFontSize: `${c.title_font_size}px`,
      subtitleFontSize: `${c.subtitle_font_size}px`,
      dateFontSize: `${c.date_font_size}px`,
      statsGap: `${c.stats_gap}px`,
      statsMarginBottom: `${c.stats_margin_bottom}px`,
      logoVisible: c.logo_visible,
    };
  }, [config]);

  return { config, loading, save, getHeaderCss, defaults: DEFAULTS };
}
