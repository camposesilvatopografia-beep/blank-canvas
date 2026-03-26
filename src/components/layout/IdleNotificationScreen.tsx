import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useIdleDashboardData } from '@/hooks/useIdleDashboardData';
import { motion } from 'framer-motion';
import { AlertTriangle, ClipboardCheck, Package, Clock, X, Truck, Mountain, Droplets, FlaskConical, Fuel } from 'lucide-react';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { useAppLogo } from '@/hooks/useAppLogo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IdleNotificationScreenProps {
  onDismiss: () => void;
}

export const IdleNotificationScreen = ({ onDismiss }: IdleNotificationScreenProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { rdosPendentes, lowStockItems, totalCount } = useNotifications();
  const { customLogo } = useAppLogo();
  const dash = useIdleDashboardData();

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const dashCards = [
    { icon: Truck, label: 'Carga', color: 'emerald', values: [`${dash.carga.viagens} viagens`, `${dash.carga.volume.toLocaleString('pt-BR')} m³`], show: dash.carga.viagens > 0 },
    { icon: Mountain, label: 'Pedreira', color: 'amber', values: [`${dash.pedreira.viagens} viagens`, `${dash.pedreira.toneladas.toLocaleString('pt-BR')} ton`], show: dash.pedreira.viagens > 0 },
    { icon: Droplets, label: 'Pipas', color: 'cyan', values: [`${dash.pipas.viagens} viagens`, `${dash.pipas.veiculos} veículos`], show: dash.pipas.viagens > 0 },
    { icon: FlaskConical, label: 'Cal', color: 'violet', values: [`${dash.cal.entradas} entradas`, `${dash.cal.saidas} saídas`], show: dash.cal.entradas > 0 || dash.cal.saidas > 0 },
    { icon: Fuel, label: 'Abastecimento', color: 'rose', values: [`${dash.abastecimento.litros.toLocaleString('pt-BR')} L`, `${dash.abastecimento.veiculos} veículos`], show: dash.abastecimento.litros > 0 },
  ];

  const visibleCards = dashCards.filter(c => c.show);

  const colorMap: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    violet: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
    rose: { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  };

  return (
    <motion.div
      data-idle-screen
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, hsl(215 50% 10%), hsl(215 60% 15%), hsl(220 50% 12%))',
      }}
      onClick={onDismiss}
    >
      <motion.button
        onClick={onDismiss}
        className="absolute top-6 right-6 text-white/40 hover:text-white/80 transition-colors"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <X className="w-6 h-6" />
      </motion.button>

      {/* Clock */}
      <motion.div
        className="flex flex-col items-center mb-6"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <img src={customLogo || logoApropriapp} alt="Logo" className="w-14 h-14 object-contain rounded-xl mb-3 opacity-80" />
        <div className="text-white/90 text-5xl md:text-7xl font-light tracking-wider tabular-nums">
          {format(currentTime, 'HH:mm')}
        </div>
        <div className="text-white/50 text-lg md:text-xl mt-1 capitalize">
          {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </div>
      </motion.div>

      {totalCount > 0 && (
        <motion.div
          className="mb-4 flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 text-sm font-medium">
            {totalCount} {totalCount === 1 ? 'alerta ativo' : 'alertas ativos'}
          </span>
        </motion.div>
      )}

      <div className="w-full max-w-4xl px-6 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Dashboard Summary Cards */}
        {!dash.loading && visibleCards.length > 0 && (
          <motion.div
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-white/70 text-sm font-semibold">📊 Resumo do dia — {dash.date}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {visibleCards.map((card, i) => {
                const colors = colorMap[card.color];
                return (
                  <motion.div
                    key={card.label}
                    className="rounded-xl bg-white/5 p-3 flex flex-col items-center gap-2"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                  >
                    <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <card.icon className={`w-4.5 h-4.5 ${colors.text}`} />
                    </div>
                    <span className="text-white/80 text-xs font-semibold">{card.label}</span>
                    {card.values.map((v, j) => (
                      <span key={j} className="text-white/50 text-[11px] leading-tight text-center">{v}</span>
                    ))}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* RDOs Pendentes */}
        {rdosPendentes.length > 0 && (
          <motion.div
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white/90 font-semibold text-base">RDOs Pendentes de Aprovação</h3>
                <p className="text-white/40 text-sm">{rdosPendentes.length} relatório{rdosPendentes.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="space-y-2">
              {rdosPendentes.slice(0, 5).map((rdo, i) => (
                <motion.div
                  key={rdo.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-white/70 text-sm">
                      {rdo.numero_rdo ? `RDO #${rdo.numero_rdo}` : 'RDO'} — {rdo.obra_nome}
                    </span>
                  </div>
                  <span className="text-white/40 text-xs">
                    {format(new Date(rdo.data + 'T12:00:00'), 'dd/MM/yyyy')}
                  </span>
                </motion.div>
              ))}
              {rdosPendentes.length > 5 && (
                <p className="text-white/30 text-xs text-center pt-1">+{rdosPendentes.length - 5} mais</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Estoque Baixo */}
        {lowStockItems.length > 0 && (
          <motion.div
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white/90 font-semibold text-base">Estoque Baixo — Almoxarifado</h3>
                <p className="text-white/40 text-sm">{lowStockItems.length} ite{lowStockItems.length > 1 ? 'ns' : 'm'} abaixo do mínimo</p>
              </div>
            </div>
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map((item, i) => (
                <motion.div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <span className="text-white/70 text-sm">{item.nome}</span>
                  <span className="text-amber-400/80 text-xs font-medium">
                    {item.estoque_atual} / {item.estoque_minimo} {item.unidade}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {totalCount === 0 && !dash.loading && visibleCards.length === 0 && (
          <motion.div className="text-center py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck className="w-8 h-8 text-green-400/60" />
            </div>
            <p className="text-white/50 text-lg">Nenhum alerta pendente</p>
            <p className="text-white/30 text-sm mt-1">Tudo em dia!</p>
          </motion.div>
        )}
      </div>

      <motion.p
        className="absolute bottom-8 text-white/20 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        Toque em qualquer lugar para voltar
      </motion.p>
    </motion.div>
  );
};
