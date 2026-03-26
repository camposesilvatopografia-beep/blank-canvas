-- Part 5: Remaining Tables
CREATE TABLE IF NOT EXISTS public.pedidos_compra_pedreira (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  material TEXT NOT NULL,
  quantidade_pedido NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  pdf_path TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (fornecedor, material)
);

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'Suporte',
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_id uuid, recipient_name text, recipient_email text,
  conversation_type text DEFAULT 'support'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_type_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_type text NOT NULL,
    section text NOT NULL,
    can_view boolean DEFAULT true,
    can_edit boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.table_column_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    table_key text NOT NULL,
    column_key text NOT NULL,
    custom_label text,
    visible boolean DEFAULT true NOT NULL,
    column_order integer DEFAULT 0 NOT NULL,
    text_color text, bg_color text, font_family text, font_bold boolean DEFAULT false NOT NULL,
    font_size text, icon_name text, text_align text, font_italic boolean DEFAULT false NOT NULL,
    text_transform text, letter_spacing text, header_text_color text, header_bg_color text,
    header_font_family text, header_font_bold boolean NOT NULL DEFAULT true, header_font_size text,
    header_font_italic boolean NOT NULL DEFAULT false, header_text_align text, header_text_transform text,
    header_letter_spacing text, header_icon_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (table_key, column_key)
);

CREATE TABLE IF NOT EXISTS public.report_header_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key text NOT NULL UNIQUE,
  logo_visible boolean NOT NULL DEFAULT true,
  logo_height integer NOT NULL DEFAULT 60,
  header_padding_top integer NOT NULL DEFAULT 12,
  header_padding_bottom integer NOT NULL DEFAULT 12,
  header_padding_left integer NOT NULL DEFAULT 20,
  header_padding_right integer NOT NULL DEFAULT 20,
  title_font_size integer NOT NULL DEFAULT 18,
  subtitle_font_size integer NOT NULL DEFAULT 13,
  date_font_size integer NOT NULL DEFAULT 11,
  header_gap integer NOT NULL DEFAULT 16,
  stats_gap integer NOT NULL DEFAULT 12,
  stats_margin_bottom integer NOT NULL DEFAULT 16,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.table_conditional_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_key text NOT NULL,
  column_key text NOT NULL,
  match_value text NOT NULL,
  bg_color text NOT NULL DEFAULT '#3b82f6',
  text_color text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.obra_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    nome text DEFAULT ''::text NOT NULL,
    local text DEFAULT ''::text NOT NULL,
    logo_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.pedidos_compra_pedreira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_type_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_column_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_header_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_conditional_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_config ENABLE ROW LEVEL SECURITY;
