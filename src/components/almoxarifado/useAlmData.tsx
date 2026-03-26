import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// AlmMaterial interface defined after AlmMovimentacao

export interface AlmMovimentacao {
  id: string;
  tipo: string;
  data: string;
  material_id: string;
  quantidade: number;
  saldo_apos: number;
  fornecedor: string | null;
  nota_fiscal: string | null;
  responsavel: string | null;
  local_armazenamento: string | null;
  equipe: string | null;
  etapa_obra: string | null;
  local_uso: string | null;
  numero_requisicao: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  foto_path: string | null;
}

export interface AlmMaterial {
  id: string;
  codigo: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  estoque_minimo: number;
  estoque_atual: number;
  observacoes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  foto_path: string | null;
}

const fromTable = (table: string) => (supabase as any).from(table);

export function useAlmMateriais() {
  return useQuery<AlmMaterial[]>({
    queryKey: ['alm_materiais'],
    queryFn: async () => {
      const { data, error } = await fromTable('alm_materiais').select('*').order('nome');
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export function useAlmMovimentacoes() {
  return useQuery<AlmMovimentacao[]>({
    queryKey: ['alm_movimentacoes'],
    queryFn: async () => {
      const { data, error } = await fromTable('alm_movimentacoes').select('*').order('data', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export function useAlmFornecedores() {
  return useQuery<string[]>({
    queryKey: ['alm_fornecedores_list'],
    queryFn: async () => {
      const { data, error } = await fromTable('alm_fornecedores')
        .select('nome')
        .eq('status', 'Ativo')
        .order('nome');
      if (error) throw error;
      return (data || []).map((d: any) => String(d.nome));
    },
  });
}

export function useAlmLocaisUso() {
  return useQuery<string[]>({
    queryKey: ['alm_locais_uso_list'],
    queryFn: async () => {
      const { data, error } = await fromTable('alm_locais_uso')
        .select('nome')
        .eq('status', 'Ativo')
        .order('nome');
      if (error) throw error;
      return (data || []).map((d: any) => String(d.nome));
    },
  });
}

export function useAlmSetores() {
  return useQuery<string[]>({
    queryKey: ['alm_setores_list'],
    queryFn: async () => {
      const { data, error } = await fromTable('alm_setores')
        .select('nome')
        .eq('status', 'Ativo')
        .order('nome');
      if (error) throw error;
      return (data || []).map((d: any) => String(d.nome));
    },
  });
}

export function useSaveMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mat: Partial<AlmMaterial> & { id?: string }) => {
      if (mat.id) {
        const { error } = await fromTable('alm_materiais').update(mat).eq('id', mat.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable('alm_materiais').insert(mat);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alm_materiais'] }); toast.success('Material salvo!'); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alm_materiais').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alm_materiais'] });
      await qc.refetchQueries({ queryKey: ['alm_materiais'], type: 'all' });
      toast.success('Material excluído!');
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + e.message),
  });
}

export function useBulkDeleteMateriais() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('alm_materiais').delete().in('id', ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alm_materiais'] });
      await qc.refetchQueries({ queryKey: ['alm_materiais'], type: 'all' });
      toast.success('Materiais excluídos com sucesso!');
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + e.message),
  });
}

export function useSaveMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mov: Partial<AlmMovimentacao> & { preco_unitario?: number; preco_total?: number; nf_foto_path?: string | null }) => {
      const { data, error } = await supabase.rpc('alm_registrar_movimentacao', {
        p_tipo: mov.tipo || 'entrada',
        p_data: mov.data || new Date().toISOString().split('T')[0],
        p_material_id: mov.material_id!,
        p_quantidade: Number(mov.quantidade),
        p_fornecedor: mov.fornecedor || null,
        p_nota_fiscal: mov.nota_fiscal || null,
        p_responsavel: mov.responsavel || null,
        p_observacoes: mov.observacoes || null,
        p_preco_unitario: Number(mov.preco_unitario) || 0,
        p_preco_total: Number(mov.preco_total) || 0,
        p_foto_path: mov.foto_path || null,
        p_nf_foto_path: (mov as any).nf_foto_path || null,
        p_local_armazenamento: mov.local_armazenamento || null,
        p_equipe: mov.equipe || null,
        p_etapa_obra: mov.etapa_obra || null,
        p_local_uso: mov.local_uso || null,
        p_numero_requisicao: mov.numero_requisicao || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alm_materiais'] });
      await qc.invalidateQueries({ queryKey: ['alm_movimentacoes'] });
      await qc.refetchQueries({ queryKey: ['alm_materiais'], type: 'all' });
      await qc.refetchQueries({ queryKey: ['alm_movimentacoes'], type: 'all' });
      toast.success('Movimentação registrada!');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (movId: string) => {
      const { error } = await supabase.rpc('alm_excluir_movimentacao', { p_mov_id: movId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alm_materiais'] });
      await qc.invalidateQueries({ queryKey: ['alm_movimentacoes'] });
      await qc.refetchQueries({ queryKey: ['alm_materiais'], type: 'all' });
      await qc.refetchQueries({ queryKey: ['alm_movimentacoes'], type: 'all' });
      toast.success('Movimentação excluída!');
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mov: Partial<AlmMovimentacao> & { id: string; preco_unitario?: number; preco_total?: number; nf_foto_path?: string | null }) => {
      const { data, error } = await supabase.rpc('alm_atualizar_movimentacao', {
        p_mov_id: mov.id,
        p_data: mov.data || new Date().toISOString().split('T')[0],
        p_material_id: mov.material_id!,
        p_quantidade: Number(mov.quantidade),
        p_fornecedor: mov.fornecedor || null,
        p_nota_fiscal: mov.nota_fiscal || null,
        p_responsavel: mov.responsavel || null,
        p_observacoes: mov.observacoes || null,
        p_preco_unitario: Number(mov.preco_unitario) || 0,
        p_preco_total: Number(mov.preco_total) || 0,
        p_foto_path: mov.foto_path || null,
        p_nf_foto_path: (mov as any).nf_foto_path || null,
        p_local_armazenamento: mov.local_armazenamento || null,
        p_equipe: mov.equipe || null,
        p_etapa_obra: mov.etapa_obra || null,
        p_local_uso: mov.local_uso || null,
        p_numero_requisicao: mov.numero_requisicao || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alm_materiais'] });
      await qc.invalidateQueries({ queryKey: ['alm_movimentacoes'] });
      await qc.refetchQueries({ queryKey: ['alm_materiais'], type: 'all' });
      await qc.refetchQueries({ queryKey: ['alm_movimentacoes'], type: 'all' });
      toast.success('Movimentação atualizada!');
    },
    onError: (e: any) => toast.error(e.message),
  });
}
