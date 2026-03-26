-- Part 7: Function & Column Fixes
ALTER TABLE public.user_field_permissions 
ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS editable BOOLEAN DEFAULT true;

ALTER TABLE public.user_location_permissions 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

-- Almoxarifado Functions
CREATE OR REPLACE FUNCTION public.alm_registrar_movimentacao(
  p_tipo text, p_data date, p_material_id uuid, p_quantidade numeric,
  p_fornecedor text DEFAULT NULL, p_nota_fiscal text DEFAULT NULL,
  p_responsavel text DEFAULT NULL, p_observacoes text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT 0, p_preco_total numeric DEFAULT 0,
  p_foto_path text DEFAULT NULL, p_nf_foto_path text DEFAULT NULL,
  p_local_armazenamento text DEFAULT NULL, p_equipe text DEFAULT NULL,
  p_etapa_obra text DEFAULT NULL, p_local_uso text DEFAULT NULL,
  p_numero_requisicao text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estoque_atual numeric; v_novo_saldo numeric; v_mov_id uuid;
BEGIN
  SELECT estoque_atual INTO v_estoque_atual FROM alm_materiais WHERE id = p_material_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material não encontrado'; END IF;
  IF p_tipo = 'entrada' THEN v_novo_saldo := v_estoque_atual + p_quantidade;
  ELSE v_novo_saldo := v_estoque_atual - p_quantidade; END IF;
  INSERT INTO alm_movimentacoes (tipo, data, material_id, quantidade, saldo_apos, fornecedor, nota_fiscal, responsavel, observacoes, preco_unitario, preco_total, foto_path, nf_foto_path, local_armazenamento, equipe, etapa_obra, local_uso, numero_requisicao, created_by)
  VALUES (p_tipo, p_data, p_material_id, p_quantidade, v_novo_saldo, p_fornecedor, p_nota_fiscal, p_responsavel, p_observacoes, p_preco_unitario, p_preco_total, p_foto_path, p_nf_foto_path, p_local_armazenamento, p_equipe, p_etapa_obra, p_local_uso, p_numero_requisicao, auth.uid()) RETURNING id INTO v_mov_id;
  UPDATE alm_materiais SET estoque_atual = v_novo_saldo, updated_at = now() WHERE id = p_material_id;
  RETURN jsonb_build_object('id', v_mov_id, 'saldo_apos', v_novo_saldo);
END; $$;

CREATE OR REPLACE FUNCTION public.alm_excluir_movimentacao(p_mov_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mov RECORD;
BEGIN
  SELECT * INTO v_mov FROM alm_movimentacoes WHERE id = p_mov_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
  IF v_mov.tipo = 'entrada' THEN UPDATE alm_materiais SET estoque_atual = estoque_atual - v_mov.quantidade WHERE id = v_mov.material_id;
  ELSE UPDATE alm_materiais SET estoque_atual = estoque_atual + v_mov.quantidade WHERE id = v_mov.material_id; END IF;
  DELETE FROM alm_movimentacoes WHERE id = p_mov_id;
END; $$;

CREATE OR REPLACE FUNCTION public.alm_atualizar_movimentacao(
  p_mov_id uuid, p_data date, p_material_id uuid, p_quantidade numeric,
  p_fornecedor text DEFAULT NULL, p_nota_fiscal text DEFAULT NULL,
  p_responsavel text DEFAULT NULL, p_observacoes text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT 0, p_preco_total numeric DEFAULT 0,
  p_foto_path text DEFAULT NULL, p_nf_foto_path text DEFAULT NULL,
  p_local_armazenamento text DEFAULT NULL, p_equipe text DEFAULT NULL,
  p_etapa_obra text DEFAULT NULL, p_local_uso text DEFAULT NULL,
  p_numero_requisicao text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old RECORD; v_estoque_atual numeric; v_novo_saldo numeric;
BEGIN
  SELECT * INTO v_old FROM alm_movimentacoes WHERE id = p_mov_id FOR UPDATE;
  IF v_old.tipo = 'entrada' THEN UPDATE alm_materiais SET estoque_atual = estoque_atual - v_old.quantidade WHERE id = v_old.material_id;
  ELSE UPDATE alm_materiais SET estoque_atual = estoque_atual + v_old.quantidade WHERE id = v_old.material_id; END IF;
  SELECT estoque_atual INTO v_estoque_atual FROM alm_materiais WHERE id = p_material_id FOR UPDATE;
  IF v_old.tipo = 'entrada' THEN v_novo_saldo := v_estoque_atual + p_quantidade;
  ELSE v_novo_saldo := v_estoque_atual - p_quantidade; END IF;
  UPDATE alm_materiais SET estoque_atual = v_novo_saldo, updated_at = now() WHERE id = p_material_id;
  UPDATE alm_movimentacoes SET data = p_data, material_id = p_material_id, quantidade = p_quantidade, saldo_apos = v_novo_saldo, fornecedor = p_fornecedor, nota_fiscal = p_nota_fiscal, responsavel = p_responsavel, observacoes = p_observacoes, preco_unitario = p_preco_unitario, preco_total = p_preco_total, foto_path = p_foto_path, nf_foto_path = p_nf_foto_path, local_armazenamento = p_local_armazenamento, equipe = p_equipe, etapa_obra = p_etapa_obra, local_uso = p_local_uso, numero_requisicao = p_numero_requisicao, updated_at = now() WHERE id = p_mov_id;
  RETURN jsonb_build_object('id', p_mov_id, 'saldo_apos', v_novo_saldo);
END; $$;
