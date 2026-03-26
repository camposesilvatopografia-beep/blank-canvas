import { useEffect, useRef } from 'react';
import { useAlmMateriais } from './useAlmData';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export default function AlmLowStockNotifier() {
  const { data: materiais = [] } = useAlmMateriais();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (materiais.length === 0) return;

    const lowStock = materiais.filter(
      m => m.status === 'Ativo' && m.estoque_minimo > 0 && m.estoque_atual <= m.estoque_minimo
    );

    lowStock.forEach(m => {
      if (!notifiedRef.current.has(m.id)) {
        notifiedRef.current.add(m.id);
        toast.warning(`Estoque baixo: ${m.nome}`, {
          description: `Saldo: ${m.estoque_atual} ${m.unidade} (mín: ${m.estoque_minimo})`,
          duration: 8000,
          icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
        });
      }
    });

    // Remove from notified if stock is replenished
    notifiedRef.current.forEach(id => {
      const mat = materiais.find(m => m.id === id);
      if (mat && (mat.estoque_atual > mat.estoque_minimo || mat.estoque_minimo === 0)) {
        notifiedRef.current.delete(id);
      }
    });
  }, [materiais]);

  return null;
}
