import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SPREADSHEET_ID = '1BP-YmGfi9-kBnc_Gi0JpDHEaTm4_W7FpVRd6pqFhqdE';

interface UseGoogleSheetsReturn {
  loading: boolean;
  error: string | null;
  readSheet: (sheetName: string, range?: string) => Promise<any[][]>;
  writeSheet: (sheetName: string, range: string, values: any[][]) => Promise<boolean>;
  appendSheet: (sheetName: string, values: any[][]) => Promise<boolean>;
  deleteRow: (sheetName: string, rowIndex: number) => Promise<boolean>;
}

export const useGoogleSheets = (): UseGoogleSheetsReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isReadOnly } = useAuth();

  const blockIfReadOnly = (): boolean => {
    if (isReadOnly) {
      toast.error('Acesso somente leitura. Você não pode modificar dados.');
      return true;
    }
    return false;
  };

  const readSheet = useCallback(async (sheetName: string, range?: string): Promise<any[][]> => {
    setLoading(true);
    setError(null);

    try {
      const fullRange = range ? `${sheetName}!${range}` : sheetName;
      
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: {
          action: 'read',
          spreadsheetId: SPREADSHEET_ID,
          range: fullRange,
        },
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);

      return data.data || [];
    } catch (err: any) {
      const message = err.message || 'Erro ao ler planilha';
      setError(message);
      console.error('Error reading sheet:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const writeSheet = useCallback(async (sheetName: string, range: string, values: any[][]): Promise<boolean> => {
    if (blockIfReadOnly()) return false;
    setLoading(true);
    setError(null);

    try {
      const fullRange = `${sheetName}!${range}`;
      
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: {
          action: 'write',
          spreadsheetId: SPREADSHEET_ID,
          range: fullRange,
          values,
        },
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);

      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao escrever na planilha';
      setError(message);
      console.error('Error writing to sheet:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const appendSheet = useCallback(async (sheetName: string, values: any[][]): Promise<boolean> => {
    if (blockIfReadOnly()) return false;
    setLoading(true);
    setError(null);

    try {
      // Anchor at A2 (after headers) so Google Sheets append API always inserts below the header row
      const anchoredRange = `${sheetName}!A2`;
      
      console.log(`[appendSheet] Appending ${values.length} row(s) to ${anchoredRange}...`);
      console.log(`[appendSheet] Row data (first 5 cols):`, values[0]?.slice(0, 5));
      
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: {
          action: 'append',
          spreadsheetId: SPREADSHEET_ID,
          range: anchoredRange,
          values,
        },
      });

      if (fnError) {
        console.error('[appendSheet] Function invoke error:', fnError);
        throw new Error(typeof fnError === 'object' && fnError.message ? fnError.message : 'Erro na comunicação com o servidor');
      }
      
      if (!data) {
        console.error('[appendSheet] No data returned from function');
        throw new Error('Resposta vazia da função');
      }
      
      if (!data.success) {
        console.error('[appendSheet] Function returned error:', data.error);
        throw new Error(data.error || 'Erro desconhecido');
      }

      console.log(`[appendSheet] SUCCESS - appended to ${sheetName}`, data.updates);
      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao adicionar na planilha';
      setError(message);
      console.error('[appendSheet] FAILED:', message, err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRow = useCallback(async (sheetName: string, rowIndex: number): Promise<boolean> => {
    if (blockIfReadOnly()) return false;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: {
          action: 'deleteRow',
          spreadsheetId: SPREADSHEET_ID,
          range: '',
          sheetName,
          rowIndex,
        },
      });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Erro ao excluir registro');

      return true;
    } catch (err: any) {
      const message = err.message || 'Erro ao excluir registro da planilha';
      setError(message);
      console.error('Error deleting row:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, readSheet, writeSheet, appendSheet, deleteRow };
};
