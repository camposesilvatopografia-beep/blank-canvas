import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { AlertTriangle, X, ChevronRight, Factory, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PendingCycle } from '@/components/mobile/FinalizarCicloPendenteModal';
export type { PendingCycle };

export interface PendenteCicloRef {
  /** Remove um ciclo da lista local por rowIndex (após finalização bem-sucedida) */
  removeCycle: (rowIndex: number) => void;
  /** Recarrega os pendentes do servidor */
  reload: () => void;
}

interface Props {
  /** Se true, ao clicar navega para o FormPedreiraCiclo (mobile). Se false, exibe info apenas. */
  navigateOnClick?: boolean;
  /** Rota de destino para o clique no desktop */
  desktopRoute?: string;
  /** Callback para uso dentro do form */
  onSelectCycle?: (cycle: PendingCycle) => void;
  /** Modo de exibição: 'mobile' (compacto, full-width) ou 'desktop' (card inline) */
  variant?: 'mobile' | 'desktop';
}

export const PendenteCicloNotification = forwardRef<PendenteCicloRef, Props>(function PendenteCicloNotification({
  navigateOnClick = true,
  desktopRoute,
  onSelectCycle,
  variant = 'mobile',
}, ref) {
  const { readSheet } = useGoogleSheets();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingCycle[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) return;

      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);
      const yesterday = getYesterdayStr();

      const found: PendingCycle[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowDate = (row[fi('Data')] || '').split('/').map((p: string) => p.padStart(2, '0')).join('/');
        const status = row[fi('Status')] || '';

        if (rowDate === yesterday && (status === 'Saiu_Britador' || status === 'Pesado')) {
          found.push({
            rowIndex: i + 1,
            prefixo: row[fi('Prefixo_Eq')] || '',
            motorista: row[fi('Motorista')] || '',
            empresa: row[fi('Empresa_Eq')] || '',
            status: status as 'Saiu_Britador' | 'Pesado',
            data: rowDate,
            ordem: row[fi('Ordem_Carregamento')] || '',
            horaSaida: row[fi('Hora_Saida_Britador')] || '',
            material: row[fi('Material')] || '',
            tonelada: row[fi('Tonelada')] || '',
          });
        }
      }
      setPending(found);
    } catch (err) {
      console.error('Error loading pending cycles:', err);
    } finally {
      setLoading(false);
    }
  }, [readSheet]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    removeCycle: (rowIndex: number) => {
      setPending(prev => prev.filter(c => c.rowIndex !== rowIndex));
    },
    reload: loadPending,
  }), [loadPending]);

  if (dismissed || pending.length === 0 || loading) return null;

  const handleCycleClick = (cycle: PendingCycle) => {
    if (onSelectCycle) {
      onSelectCycle(cycle);
    } else if (navigateOnClick) {
      if (desktopRoute) {
        navigate(desktopRoute);
      } else {
        const etapa = cycle.status === 'Saiu_Britador' ? 'balanca' : 'obra';
        navigate(`/mobile/pedreira-ciclo?etapa=${etapa}&prefixo=${encodeURIComponent(cycle.prefixo)}&os=${encodeURIComponent(cycle.ordem)}`);
      }
    }
  };

  const yesterday = getYesterdayStr();

  if (variant === 'desktop') {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-orange-500">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white" />
            <span className="text-white font-semibold text-sm">
              {pending.length} ciclo{pending.length > 1 ? 's' : ''} pendente{pending.length > 1 ? 's' : ''} do dia anterior — {yesterday}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid de cards para desktop */}
        <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pending.map((cycle, idx) => {
            const isTransit = cycle.status === 'Saiu_Britador';
            return (
              <button
                key={idx}
                className="flex items-center gap-3 p-3 rounded-lg bg-white border border-orange-100 hover:border-orange-300 hover:shadow-sm transition-all text-left"
                onClick={() => handleCycleClick(cycle)}
                title={isTransit ? 'Registrar pesagem na balança' : 'Confirmar chegada na obra'}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isTransit ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  {isTransit
                    ? <Factory className="w-4 h-4 text-amber-600" />
                    : <Scale className="w-4 h-4 text-blue-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{cycle.prefixo}</span>
                    {cycle.motorista && (
                      <span className="text-xs text-gray-400 truncate">{cycle.motorista}</span>
                    )}
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 h-4 mt-0.5 ${isTransit ? 'bg-amber-500' : 'bg-blue-500'} text-white border-0`}>
                    {isTransit ? '🏗️ Aguard. Balança' : '⚖️ Aguard. Obra'}
                  </Badge>
                  {cycle.ordem && (
                    <div className="text-[10px] text-gray-400 mt-0.5">OS: {cycle.ordem}</div>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-orange-100 bg-orange-50">
          <p className="text-xs text-orange-700">
            Clique em um veículo para acessar o Acompanhamento e finalizar o ciclo pendente.
          </p>
        </div>
      </div>
    );
  }

  // Mobile variant (original)
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-orange-300 bg-orange-50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-orange-500">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-white" />
          <span className="text-white font-semibold text-sm">
            {pending.length} ciclo{pending.length > 1 ? 's' : ''} pendente{pending.length > 1 ? 's' : ''} — {yesterday}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Fechar notificação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-orange-100">
        {pending.map((cycle, idx) => {
          const isTransit = cycle.status === 'Saiu_Britador';
          return (
            <button
              key={idx}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-100 active:bg-orange-200 transition-colors text-left"
              onClick={() => handleCycleClick(cycle)}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isTransit ? 'bg-amber-100' : 'bg-blue-100'}`}>
                {isTransit
                  ? <Factory className="w-4 h-4 text-amber-600" />
                  : <Scale className="w-4 h-4 text-blue-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 truncate">{cycle.prefixo}</span>
                  {cycle.motorista && (
                    <span className="text-xs text-gray-500 truncate">— {cycle.motorista}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`text-[10px] px-1.5 py-0 h-4 ${isTransit ? 'bg-amber-500' : 'bg-blue-500'} text-white border-0`}>
                    {isTransit ? '🏗️ Aguard. Balança' : '⚖️ Aguard. Obra'}
                  </Badge>
                  {cycle.ordem && (
                    <span className="text-[10px] text-gray-400">OS: {cycle.ordem}</span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-orange-400 shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-orange-50 border-t border-orange-100">
        <p className="text-[11px] text-orange-700 text-center">
          Toque em um item para finalizar o ciclo pendente
        </p>
      </div>
    </div>
  );
});
