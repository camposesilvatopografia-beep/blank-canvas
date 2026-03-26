
ALTER TABLE public.table_column_configs
  ADD COLUMN IF NOT EXISTS header_text_color text,
  ADD COLUMN IF NOT EXISTS header_bg_color text,
  ADD COLUMN IF NOT EXISTS header_font_family text,
  ADD COLUMN IF NOT EXISTS header_font_bold boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS header_font_size text,
  ADD COLUMN IF NOT EXISTS header_font_italic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS header_text_align text,
  ADD COLUMN IF NOT EXISTS header_text_transform text,
  ADD COLUMN IF NOT EXISTS header_letter_spacing text,
  ADD COLUMN IF NOT EXISTS header_icon_name text;
