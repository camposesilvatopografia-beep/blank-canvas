
-- =============================================
-- MATERIAIS (carga)
-- =============================================
CREATE TABLE public.materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage materiais" ON public.materiais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- LOCAIS
-- =============================================
CREATE TABLE public.locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'Local',
  nome TEXT NOT NULL,
  obra TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage locais" ON public.locais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EMPRESAS
-- =============================================
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage empresas" ON public.empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- FORNECEDORES_CAL
-- =============================================
CREATE TABLE public.fornecedores_cal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores_cal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage fornecedores_cal" ON public.fornecedores_cal FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- FORNECEDORES_PEDREIRA
-- =============================================
CREATE TABLE public.fornecedores_pedreira (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores_pedreira ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage fornecedores_pedreira" ON public.fornecedores_pedreira FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- MATERIAIS_PEDREIRA
-- =============================================
CREATE TABLE public.materiais_pedreira (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.materiais_pedreira ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage materiais_pedreira" ON public.materiais_pedreira FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- APONTAMENTOS_CARGA
-- =============================================
CREATE TABLE public.apontamentos_carga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  hora TIME,
  prefixo_escavadeira VARCHAR,
  descricao_escavadeira VARCHAR,
  empresa_escavadeira VARCHAR,
  operador VARCHAR,
  prefixo_caminhao VARCHAR,
  descricao_caminhao VARCHAR,
  empresa_caminhao VARCHAR,
  motorista VARCHAR,
  local VARCHAR,
  estaca VARCHAR,
  material VARCHAR,
  quantidade NUMERIC,
  viagens INTEGER DEFAULT 1,
  volume_total NUMERIC,
  status VARCHAR DEFAULT 'ativo',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.apontamentos_carga ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage apontamentos_carga" ON public.apontamentos_carga FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- USER_PERMISSIONS
-- =============================================
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user_permissions" ON public.user_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own permissions" ON public.user_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- USER_SUBMENU_PERMISSIONS
-- =============================================
CREATE TABLE public.user_submenu_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submenu_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, submenu_key)
);
ALTER TABLE public.user_submenu_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user_submenu_permissions" ON public.user_submenu_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own submenu_permissions" ON public.user_submenu_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- ADMIN_TYPE_PERMISSIONS
-- =============================================
CREATE TABLE public.admin_type_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL,
  section TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_type, section)
);
ALTER TABLE public.admin_type_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage admin_type_permissions" ON public.admin_type_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view admin_type_permissions" ON public.admin_type_permissions FOR SELECT TO authenticated USING (true);

-- =============================================
-- USER_EQUIPMENT_PERMISSIONS
-- =============================================
CREATE TABLE public.user_equipment_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_prefixo TEXT NOT NULL,
  equipment_type TEXT NOT NULL DEFAULT 'escavadeira',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, equipment_prefixo, equipment_type)
);
ALTER TABLE public.user_equipment_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user_equipment_permissions" ON public.user_equipment_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own equipment_permissions" ON public.user_equipment_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- USER_FIELD_PERMISSIONS
-- =============================================
CREATE TABLE public.user_field_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  field_name TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  editable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module, field_name)
);
ALTER TABLE public.user_field_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user_field_permissions" ON public.user_field_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own field_permissions" ON public.user_field_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- USER_LOCATION_PERMISSIONS
-- =============================================
CREATE TABLE public.user_location_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_id)
);
ALTER TABLE public.user_location_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user_location_permissions" ON public.user_location_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own location_permissions" ON public.user_location_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- RDO_OBRAS (etapas de obra)
-- =============================================
CREATE TABLE public.rdo_obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contrato TEXT,
  cliente TEXT,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  data_inicio_contrato TEXT,
  data_prazo_contratual TEXT,
  prazo_contratual_dias INTEGER,
  licenca_canteiro TEXT,
  aprovador1_nome TEXT, aprovador1_email TEXT, aprovador1_whatsapp TEXT, aprovador1_cargo TEXT, aprovador1_cpf TEXT,
  aprovador2_nome TEXT, aprovador2_email TEXT, aprovador2_whatsapp TEXT, aprovador2_cargo TEXT, aprovador2_cpf TEXT,
  aprovador3_nome TEXT, aprovador3_email TEXT, aprovador3_whatsapp TEXT, aprovador3_cargo TEXT, aprovador3_cpf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rdo_obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage rdo_obras" ON public.rdo_obras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- RDOS
-- =============================================
CREATE TABLE public.rdos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.rdo_obras(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  numero_rdo TEXT,
  data_inicio TEXT,
  termino_previsto TEXT,
  prazo_contratual INTEGER,
  prazo_decorrido INTEGER,
  prazo_restante INTEGER,
  prazo_restante_vigencia INTEGER,
  novo_prazo_contratual TEXT,
  clima_manha TEXT DEFAULT 'Bom',
  clima_tarde TEXT DEFAULT 'Bom',
  temperatura_manha NUMERIC,
  temperatura_tarde NUMERIC,
  precipitacao_dia NUMERIC DEFAULT 0,
  precipitacao_acumulada_mes NUMERIC DEFAULT 0,
  condicao_tempo TEXT DEFAULT 'Bom',
  comentarios_construtora TEXT,
  comentarios_gerenciadora TEXT,
  comentarios_fiscalizacao TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'Rascunho',
  created_by UUID,
  aprovacao1_token TEXT,
  aprovacao1_status TEXT,
  aprovacao1_data TIMESTAMPTZ,
  aprovacao2_token TEXT,
  aprovacao2_status TEXT,
  aprovacao2_data TIMESTAMPTZ,
  aprovacao3_token TEXT,
  aprovacao3_status TEXT,
  aprovacao3_data TIMESTAMPTZ,
  pdf_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage rdos" ON public.rdos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- RDO_EFETIVO
-- =============================================
CREATE TABLE public.rdo_efetivo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  empresa TEXT,
  funcao TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  periodo TEXT DEFAULT 'Dia Completo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rdo_efetivo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage rdo_efetivo" ON public.rdo_efetivo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- RDO_EQUIPAMENTOS
-- =============================================
CREATE TABLE public.rdo_equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  equipamento TEXT NOT NULL,
  prefixo TEXT,
  horas_trabalhadas NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Operando',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rdo_equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage rdo_equipamentos" ON public.rdo_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- RDO_SERVICOS
-- =============================================
CREATE TABLE public.rdo_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  percentual NUMERIC DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rdo_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage rdo_servicos" ON public.rdo_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- RDO_FOTOS
-- =============================================
CREATE TABLE public.rdo_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  legenda TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rdo_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage rdo_fotos" ON public.rdo_fotos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- RDO_EMAIL_LOGS
-- =============================================
CREATE TABLE public.rdo_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id UUID REFERENCES public.rdos(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  subject TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rdo_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view rdo_email_logs" ON public.rdo_email_logs FOR SELECT TO authenticated USING (true);

-- =============================================
-- OBRA_CONFIG
-- =============================================
CREATE TABLE public.obra_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  local TEXT,
  logo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.obra_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage obra_config" ON public.obra_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- TABLE_COLUMN_CONFIGS
-- =============================================
CREATE TABLE public.table_column_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_key TEXT NOT NULL,
  column_key TEXT NOT NULL,
  custom_label TEXT,
  visible BOOLEAN NOT NULL DEFAULT true,
  column_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_key, column_key)
);
ALTER TABLE public.table_column_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage table_column_configs" ON public.table_column_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- TABLE_CONDITIONAL_FORMATS
-- =============================================
CREATE TABLE public.table_conditional_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_key TEXT NOT NULL,
  column_key TEXT NOT NULL,
  match_value TEXT,
  bg_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.table_conditional_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage table_conditional_formats" ON public.table_conditional_formats FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- SIDEBAR_MENU_CONFIGS
-- =============================================
CREATE TABLE public.sidebar_menu_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key TEXT NOT NULL UNIQUE,
  custom_label TEXT,
  menu_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sidebar_menu_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage sidebar_menu_configs" ON public.sidebar_menu_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- REPORT_HEADER_CONFIGS
-- =============================================
CREATE TABLE public.report_header_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key TEXT NOT NULL UNIQUE,
  show_logo BOOLEAN DEFAULT true,
  show_obra_name BOOLEAN DEFAULT true,
  show_date BOOLEAN DEFAULT true,
  show_filters BOOLEAN DEFAULT true,
  custom_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.report_header_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage report_header_configs" ON public.report_header_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- PAGE_LAYOUT_CONFIGS
-- =============================================
CREATE TABLE public.page_layout_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL,
  block_key TEXT NOT NULL,
  block_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_key, block_key)
);
ALTER TABLE public.page_layout_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage page_layout_configs" ON public.page_layout_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- PEDIDOS_COMPRA_PEDREIRA
-- =============================================
CREATE TABLE public.pedidos_compra_pedreira (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor TEXT,
  material TEXT,
  quantidade_pedido NUMERIC,
  data_pedido DATE,
  status TEXT DEFAULT 'Pendente',
  pdf_path TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos_compra_pedreira ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage pedidos_compra_pedreira" ON public.pedidos_compra_pedreira FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- PEDREIRA_FRETE_MATERIAIS
-- =============================================
CREATE TABLE public.pedreira_frete_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL,
  preco_frete NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pedreira_frete_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage pedreira_frete_materiais" ON public.pedreira_frete_materiais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- EVOLUCAO_OBRA_EXECUCOES
-- =============================================
CREATE TABLE public.evolucao_obra_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estaca_inicio TEXT NOT NULL,
  estaca_fim TEXT,
  faixa TEXT NOT NULL,
  camada TEXT NOT NULL,
  camada_numero INTEGER NOT NULL DEFAULT 1,
  data DATE NOT NULL,
  area_executada NUMERIC DEFAULT 0,
  volume_executado NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.evolucao_obra_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage evolucao_obra_execucoes" ON public.evolucao_obra_execucoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- SUPPORT_CONVERSATIONS
-- =============================================
CREATE TABLE public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  subject TEXT,
  status TEXT DEFAULT 'open',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON public.support_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all conversations" ON public.support_conversations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- SUPPORT_MESSAGES
-- =============================================
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT,
  content TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage support_messages" ON public.support_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- ALM_MATERIAIS (almoxarifado)
-- =============================================
CREATE TABLE public.alm_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT NOT NULL DEFAULT 'UN',
  estoque_minimo NUMERIC NOT NULL DEFAULT 0,
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  foto_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alm_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage alm_materiais" ON public.alm_materiais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- ALM_MOVIMENTACOES
-- =============================================
CREATE TABLE public.alm_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'entrada',
  data DATE NOT NULL,
  material_id UUID NOT NULL REFERENCES public.alm_materiais(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  saldo_apos NUMERIC NOT NULL DEFAULT 0,
  fornecedor TEXT,
  nota_fiscal TEXT,
  responsavel TEXT,
  local_armazenamento TEXT,
  equipe TEXT,
  etapa_obra TEXT,
  local_uso TEXT,
  numero_requisicao TEXT,
  observacoes TEXT,
  preco_unitario NUMERIC DEFAULT 0,
  preco_total NUMERIC DEFAULT 0,
  foto_path TEXT,
  nf_foto_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alm_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage alm_movimentacoes" ON public.alm_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- ALM_FORNECEDORES
-- =============================================
CREATE TABLE public.alm_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alm_fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage alm_fornecedores" ON public.alm_fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- ALM_LOCAIS_USO
-- =============================================
CREATE TABLE public.alm_locais_uso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alm_locais_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage alm_locais_uso" ON public.alm_locais_uso FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- ALM_SETORES
-- =============================================
CREATE TABLE public.alm_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alm_setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage alm_setores" ON public.alm_setores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- ALM RPCs (registrar, excluir, atualizar movimentações)
-- =============================================
CREATE OR REPLACE FUNCTION public.alm_registrar_movimentacao(
  p_tipo TEXT, p_data DATE, p_material_id UUID, p_quantidade NUMERIC,
  p_fornecedor TEXT DEFAULT NULL, p_nota_fiscal TEXT DEFAULT NULL,
  p_responsavel TEXT DEFAULT NULL, p_observacoes TEXT DEFAULT NULL,
  p_preco_unitario NUMERIC DEFAULT 0, p_preco_total NUMERIC DEFAULT 0,
  p_foto_path TEXT DEFAULT NULL, p_nf_foto_path TEXT DEFAULT NULL,
  p_local_armazenamento TEXT DEFAULT NULL, p_equipe TEXT DEFAULT NULL,
  p_etapa_obra TEXT DEFAULT NULL, p_local_uso TEXT DEFAULT NULL,
  p_numero_requisicao TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_saldo NUMERIC;
  v_mov_id UUID;
BEGIN
  SELECT estoque_atual INTO v_saldo FROM alm_materiais WHERE id = p_material_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material não encontrado'; END IF;

  IF p_tipo = 'entrada' THEN
    v_saldo := v_saldo + p_quantidade;
  ELSE
    IF v_saldo < p_quantidade THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
    v_saldo := v_saldo - p_quantidade;
  END IF;

  UPDATE alm_materiais SET estoque_atual = v_saldo, updated_at = now() WHERE id = p_material_id;

  INSERT INTO alm_movimentacoes (tipo, data, material_id, quantidade, saldo_apos, fornecedor, nota_fiscal,
    responsavel, observacoes, preco_unitario, preco_total, foto_path, nf_foto_path,
    local_armazenamento, equipe, etapa_obra, local_uso, numero_requisicao)
  VALUES (p_tipo, p_data, p_material_id, p_quantidade, v_saldo, p_fornecedor, p_nota_fiscal,
    p_responsavel, p_observacoes, p_preco_unitario, p_preco_total, p_foto_path, p_nf_foto_path,
    p_local_armazenamento, p_equipe, p_etapa_obra, p_local_uso, p_numero_requisicao)
  RETURNING id INTO v_mov_id;

  RETURN v_mov_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.alm_excluir_movimentacao(p_mov_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mov RECORD;
BEGIN
  SELECT * INTO v_mov FROM alm_movimentacoes WHERE id = p_mov_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  IF v_mov.tipo = 'entrada' THEN
    UPDATE alm_materiais SET estoque_atual = estoque_atual - v_mov.quantidade, updated_at = now() WHERE id = v_mov.material_id;
  ELSE
    UPDATE alm_materiais SET estoque_atual = estoque_atual + v_mov.quantidade, updated_at = now() WHERE id = v_mov.material_id;
  END IF;

  DELETE FROM alm_movimentacoes WHERE id = p_mov_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.alm_atualizar_movimentacao(
  p_mov_id UUID, p_data DATE, p_material_id UUID, p_quantidade NUMERIC,
  p_fornecedor TEXT DEFAULT NULL, p_nota_fiscal TEXT DEFAULT NULL,
  p_responsavel TEXT DEFAULT NULL, p_observacoes TEXT DEFAULT NULL,
  p_preco_unitario NUMERIC DEFAULT 0, p_preco_total NUMERIC DEFAULT 0,
  p_foto_path TEXT DEFAULT NULL, p_nf_foto_path TEXT DEFAULT NULL,
  p_local_armazenamento TEXT DEFAULT NULL, p_equipe TEXT DEFAULT NULL,
  p_etapa_obra TEXT DEFAULT NULL, p_local_uso TEXT DEFAULT NULL,
  p_numero_requisicao TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old RECORD;
  v_saldo NUMERIC;
BEGIN
  SELECT * INTO v_old FROM alm_movimentacoes WHERE id = p_mov_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  -- Reverse old movement
  IF v_old.tipo = 'entrada' THEN
    UPDATE alm_materiais SET estoque_atual = estoque_atual - v_old.quantidade WHERE id = v_old.material_id;
  ELSE
    UPDATE alm_materiais SET estoque_atual = estoque_atual + v_old.quantidade WHERE id = v_old.material_id;
  END IF;

  -- Apply new movement
  SELECT estoque_atual INTO v_saldo FROM alm_materiais WHERE id = p_material_id FOR UPDATE;
  IF v_old.tipo = 'entrada' THEN
    v_saldo := v_saldo + p_quantidade;
  ELSE
    IF v_saldo < p_quantidade THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
    v_saldo := v_saldo - p_quantidade;
  END IF;

  UPDATE alm_materiais SET estoque_atual = v_saldo, updated_at = now() WHERE id = p_material_id;

  UPDATE alm_movimentacoes SET
    data = p_data, material_id = p_material_id, quantidade = p_quantidade, saldo_apos = v_saldo,
    fornecedor = p_fornecedor, nota_fiscal = p_nota_fiscal, responsavel = p_responsavel,
    observacoes = p_observacoes, preco_unitario = p_preco_unitario, preco_total = p_preco_total,
    foto_path = p_foto_path, nf_foto_path = p_nf_foto_path,
    local_armazenamento = p_local_armazenamento, equipe = p_equipe,
    etapa_obra = p_etapa_obra, local_uso = p_local_uso,
    numero_requisicao = p_numero_requisicao, updated_at = now()
  WHERE id = p_mov_id;

  RETURN p_mov_id;
END;
$$;

-- =============================================
-- AVATARS (storage bucket placeholder table for references)
-- =============================================
CREATE TABLE public.avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own avatars" ON public.avatars FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
