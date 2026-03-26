
CREATE OR REPLACE FUNCTION public.alm_registrar_movimentacao(
  p_tipo text,
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
SET search_path = public
AS $$
DECLARE
  v_estoque_atual numeric;
  v_novo_saldo numeric;
  v_mov_id uuid;
BEGIN
  -- Get current stock with row lock
  SELECT estoque_atual INTO v_estoque_atual
  FROM alm_materiais
  WHERE id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material não encontrado';
  END IF;

  -- Validate sufficient stock for exits
  IF p_tipo = 'saida' AND p_quantidade > v_estoque_atual THEN
    RAISE EXCEPTION 'Saldo insuficiente. Estoque atual: %', v_estoque_atual;
  END IF;

  -- Calculate new balance
  IF p_tipo = 'entrada' THEN
    v_novo_saldo := v_estoque_atual + p_quantidade;
  ELSE
    v_novo_saldo := v_estoque_atual - p_quantidade;
  END IF;

  -- Insert movement
  INSERT INTO alm_movimentacoes (
    tipo, data, material_id, quantidade, saldo_apos,
    fornecedor, nota_fiscal, responsavel, observacoes,
    preco_unitario, preco_total, foto_path, nf_foto_path,
    local_armazenamento, equipe, etapa_obra, local_uso, numero_requisicao,
    created_by
  ) VALUES (
    p_tipo, p_data, p_material_id, p_quantidade, v_novo_saldo,
    p_fornecedor, p_nota_fiscal, p_responsavel, p_observacoes,
    p_preco_unitario, p_preco_total, p_foto_path, p_nf_foto_path,
    p_local_armazenamento, p_equipe, p_etapa_obra, p_local_uso, p_numero_requisicao,
    auth.uid()
  ) RETURNING id INTO v_mov_id;

  -- Update material stock
  UPDATE alm_materiais
  SET estoque_atual = v_novo_saldo, updated_at = now()
  WHERE id = p_material_id;

  RETURN jsonb_build_object('id', v_mov_id, 'saldo_apos', v_novo_saldo);
END;
$$;
