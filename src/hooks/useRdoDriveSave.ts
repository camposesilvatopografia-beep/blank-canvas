import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateRdoPdfBlob } from '@/hooks/useRdoPdfExport';

interface SaveToDriveParams {
  rdo: any;
  obra: any;
  efetivo: any[];
  equipamentos: any[];
  servicos: any[];
  fotos: { signedUrl: string; legenda: string }[];
  assinaturas?: Record<string, string>;
}

/**
 * Hook para salvar/atualizar o PDF do RDO no Google Drive.
 * Gera o PDF localmente, converte para base64 e envia para a edge function.
 * Cada chamada verifica se o arquivo já existe no Drive e faz update ou create.
 */
export function useRdoDriveSave() {
  const saveToDrive = useCallback(async (params: SaveToDriveParams): Promise<{ driveLink: string | null; error: string | null }> => {
    const { rdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas } = params;

    try {
      // 1. Gerar o blob do PDF
      const blob = await generateRdoPdfBlob({ rdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas });

      // 2. Converter para base64
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const pdf_base64 = btoa(binary);

      // 3. Chamar a edge function
      const { data, error } = await supabase.functions.invoke('rdo-save-drive', {
        body: {
          rdo_id: rdo.id,
          pdf_base64,
          numero_rdo: rdo.numero_rdo,
          obra_nome: obra?.nome,
          rdo_data: rdo.data, // ex: "2025-02-20"
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao salvar no Drive');

      console.log(`[RDO Drive] ${data.updated ? 'Atualizado' : 'Criado'}: ${data.fileName}`);
      return { driveLink: data.driveLink, error: null };

    } catch (err: any) {
      const msg = err?.message || 'Erro ao salvar PDF no Drive';
      console.error('[RDO Drive] Erro:', msg);
      return { driveLink: null, error: msg };
    }
  }, []);

  return { saveToDrive };
}
