
-- Function to delete a movement and reverse the stock change
CREATE OR REPLACE FUNCTION public.alm_excluir_movimentacao(p_mov_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
BEGIN
  SELECT * INTO v_mov FROM alm_movimentacoes WHERE id = p_mov_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;

  -- Reverse the stock change
  IF v_mov.tipo = 'entrada' THEN
    UPDATE alm_materiais SET estoque_atual = estoque_atual - v_mov.quantidade, updated_at = now() WHERE id = v_mov.material_id;
  ELSE
    UPDATE alm_materiais SET estoque_atual = estoque_atual + v_mov.quantidade, updated_at = now() WHERE id = v_mov.material_id;
  END IF;

  DELETE FROM alm_movimentacoes WHERE id = p_mov_id;
END;
$$;

-- Function to update a movement (reverse old, apply new)
CREATE OR REPLACE FUNCTION public.alm_atualizar_movimentacao(
  p_mov_id uuid,
  p_data date,
  p_material_id uuid,
  p_quantidade numeric,
  p_fornecedor text DEFAULT NULL,
  p_nota_fiscal text DEFAULT NULL,
  p_responsavel text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_preco_unitario numeric DEFAULT 0,
  p_preco_total numeric DEFAULT 0,
  p_foto_path text DEFAULT NULL,
  p_nf_foto_path text DEFAULT NULL,
  p_local_armazenamento text DEFAULT NULL,
  p_equipe text DEFAULT NULL,
  p_etapa_obra text DEFAULT NULL,
  p_local_uso text DEFAULT NULL,
  p_numero_requisicao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old RECORD;
  v_estoque_atual numeric;
  v_novo_saldo numeric;
BEGIN
  SELECT * INTO v_old FROM alm_movimentacoes WHERE id = p_mov_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;

  -- Reverse old movement on old material
  IF v_old.tipo = 'entrada' THEN
    UPDATE alm_materiais SET estoque_atual = estoque_atual - v_old.quantidade, updated_at = now() WHERE id = v_old.material_id;
  ELSE
    UPDATE alm_materiais SET estoque_atual = estoque_atual + v_old.quantidade, updated_at = now() WHERE id = v_old.material_id;
  END IF;

  -- Apply new movement on (possibly different) material
  SELECT estoque_atual INTO v_estoque_atual FROM alm_materiais WHERE id = p_material_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material não encontrado';
  END IF;

  IF v_old.tipo = 'entrada' THEN
    v_novo_saldo := v_estoque_atual + p_quantidade;
  ELSE
    IF p_quantidade > v_estoque_atual THEN
      RAISE EXCEPTION 'Saldo insuficiente. Estoque atual: %', v_estoque_atual;
    END IF;
    v_novo_saldo := v_estoque_atual - p_quantidade;
  END IF;

  UPDATE alm_materiais SET estoque_atual = v_novo_saldo, updated_at = now() WHERE id = p_material_id;

  UPDATE alm_movimentacoes SET
    data = p_data,
    material_id = p_material_id,
    quantidade = p_quantidade,
    saldo_apos = v_novo_saldo,
    fornecedor = p_fornecedor,
    nota_fiscal = p_nota_fiscal,
    responsavel = p_responsavel,
    observacoes = p_observacoes,
    preco_unitario = p_preco_unitario,
    preco_total = p_preco_total,
    foto_path = p_foto_path,
    nf_foto_path = p_nf_foto_path,
    local_armazenamento = p_local_armazenamento,
    equipe = p_equipe,
    etapa_obra = p_etapa_obra,
    local_uso = p_local_uso,
    numero_requisicao = p_numero_requisicao,
    updated_at = now()
  WHERE id = p_mov_id;

  RETURN jsonb_build_object('id', p_mov_id, 'saldo_apos', v_novo_saldo);
END;
$$;
