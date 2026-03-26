import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

/**
 * Hook that provides read-only state and a guard function.
 * Usage:
 *   const { isReadOnly, guardAction } = useReadOnly();
 *   <Button onClick={() => guardAction(() => setModalOpen(true))} disabled={isReadOnly}>
 * 
 * Or simply check isReadOnly to disable buttons.
 */
export function useReadOnly() {
  const { isReadOnly } = useAuth();
  const { toast } = useToast();

  const guardAction = useCallback(
    (action: () => void) => {
      if (isReadOnly) {
        toast({
          variant: 'destructive',
          title: 'Acesso somente leitura',
          description: 'Seu perfil é de Visualização. Você não pode criar, editar ou excluir dados.',
        });
        return;
      }
      action();
    },
    [isReadOnly, toast]
  );

  return { isReadOnly, guardAction };
}
