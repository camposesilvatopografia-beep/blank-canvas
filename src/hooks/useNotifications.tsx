import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAlmMateriais } from '@/components/almoxarifado/useAlmData';

export interface RdoPendente {
  id: string;
  numero_rdo: string | null;
  data: string;
  obra_nome: string;
}

export interface LowStockItem {
  id: string;
  nome: string;
  estoque_atual: number;
  estoque_minimo: number;
  unidade: string;
}

export function useNotifications() {
  const [rdosPendentes, setRdosPendentes] = useState<RdoPendente[]>([]);
  const [rdosLoading, setRdosLoading] = useState(true);
  const { data: materiais = [] } = useAlmMateriais();

  const lowStockItems: LowStockItem[] = materiais
    .filter(m => m.status === 'Ativo' && m.estoque_minimo > 0 && m.estoque_atual <= m.estoque_minimo)
    .map(m => ({
      id: m.id,
      nome: m.nome,
      estoque_atual: m.estoque_atual,
      estoque_minimo: m.estoque_minimo,
      unidade: m.unidade,
    }));

  const fetchRdos = useCallback(async () => {
    const { data } = await supabase
      .from('rdos')
      .select('id, numero_rdo, data, status, obra_id, rdo_obras(nome)')
      .or('aprovacao1_status.eq.Pendente,aprovacao2_status.eq.Pendente,aprovacao3_status.eq.Pendente')
      .eq('status', 'Enviado')
      .order('data', { ascending: false })
      .limit(20);

    if (data) {
      setRdosPendentes(
        data.map((r: any) => ({
          id: r.id,
          numero_rdo: r.numero_rdo,
          data: r.data,
          obra_nome: r.rdo_obras?.nome || 'Obra',
        }))
      );
    }
    setRdosLoading(false);
  }, []);

  useEffect(() => {
    fetchRdos();

    const channel = supabase
      .channel('notifications-rdos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rdos' }, () => fetchRdos())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRdos]);

  const totalCount = rdosPendentes.length + lowStockItems.length;

  return {
    rdosPendentes,
    lowStockItems,
    totalCount,
    loading: rdosLoading,
  };
}
