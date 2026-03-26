import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShieldCheck, Clock, User, Briefcase, CreditCard, Hash } from 'lucide-react';

interface CarimboDigitalProps {
  nome: string;
  cargo?: string | null;
  cpf?: string | null;
  dataHora: Date | string;
  status?: 'Aprovado' | 'Reprovado';
  slotNum?: 1 | 2 | 3;
  rdoId?: string;
  compact?: boolean;
}

function formatCPF(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function maskCPF(cpf: string) {
  const formatted = formatCPF(cpf);
  // Mask middle digits: 123.***.**3-12
  return formatted.replace(/(\d{3})\.\d{3}\.\d{3}/, '$1.***.***');
}

function generateVerificationCode(nome: string, dataHora: string, rdoId?: string) {
  // Deterministic short hash for display — not cryptographic
  const str = `${nome}|${dataHora}|${rdoId || ''}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

const SLOT_COLORS = {
  1: { border: 'border-blue-500', bg: 'bg-blue-500/8', header: 'bg-blue-600', badge: 'bg-blue-500/10 text-blue-700', icon: 'text-blue-600' },
  2: { border: 'border-purple-500', bg: 'bg-purple-500/8', header: 'bg-purple-600', badge: 'bg-purple-500/10 text-purple-700', icon: 'text-purple-600' },
  3: { border: 'border-emerald-500', bg: 'bg-emerald-500/8', header: 'bg-emerald-600', badge: 'bg-emerald-500/10 text-emerald-700', icon: 'text-emerald-600' },
};

const STATUS_STYLES = {
  Aprovado: { border: 'border-emerald-500', bg: 'bg-emerald-500/5', header: 'bg-emerald-600', label: 'APROVADO', icon: '✔' },
  Reprovado: { border: 'border-red-500', bg: 'bg-red-500/5', header: 'bg-red-600', label: 'REPROVADO', icon: '✖' },
};

export function CarimboDigital({
  nome,
  cargo,
  cpf,
  dataHora,
  status = 'Aprovado',
  slotNum = 1,
  rdoId,
  compact = false,
}: CarimboDigitalProps) {
  const dt = typeof dataHora === 'string' ? new Date(dataHora) : dataHora;
  const dataFormatada = format(dt, "dd/MM/yyyy", { locale: ptBR });
  const horaFormatada = format(dt, "HH:mm:ss", { locale: ptBR });
  const dtISO = dt.toISOString();
  const verCode = generateVerificationCode(nome, dtISO, rdoId);

  const slotCfg = SLOT_COLORS[slotNum] || SLOT_COLORS[1];
  const statusCfg = STATUS_STYLES[status] || STATUS_STYLES.Aprovado;

  if (compact) {
    return (
      <div className={`rounded-lg border ${statusCfg.border} ${statusCfg.bg} px-3 py-2 font-mono`}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Assinado Eletronicamente
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong>{nome}</strong>
          {cargo ? ` · ${cargo}` : ''}
          {cpf ? ` · CPF: ${maskCPF(cpf)}` : ''}
          {' · '}{dataFormatada} às {horaFormatada}
        </p>
        <p className="text-[9px] text-muted-foreground/70 mt-0.5">
          Código de verificação: <span className="font-mono tracking-widest">{verCode}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 ${statusCfg.border} overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className={`${statusCfg.header} px-4 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-white" />
          <span className="text-white font-bold text-xs tracking-wider uppercase">
            Assinatura Eletrônica {statusCfg.icon}
          </span>
        </div>
        <span className="text-white/80 text-[10px] font-mono">{verCode}</span>
      </div>

      {/* Body */}
      <div className={`${statusCfg.bg} px-4 py-3 space-y-2.5`}>

        {/* Linha 1: Nome */}
        <div className="flex items-start gap-2.5">
          <div className={`w-7 h-7 rounded-full ${slotCfg.header} flex items-center justify-center shrink-0`}>
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Responsável</p>
            <p className="text-sm font-bold leading-tight">{nome}</p>
          </div>
        </div>

        {/* Grade: Cargo + CPF */}
        <div className="grid grid-cols-2 gap-2">
          {cargo && (
            <div className="flex items-start gap-1.5">
              <Briefcase className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${slotCfg.icon}`} />
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cargo / Função</p>
                <p className="text-xs font-semibold leading-tight">{cargo}</p>
              </div>
            </div>
          )}
          {cpf && (
            <div className="flex items-start gap-1.5">
              <CreditCard className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${slotCfg.icon}`} />
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">CPF</p>
                <p className="text-xs font-semibold font-mono leading-tight">{maskCPF(cpf)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Linha: Data e Hora */}
        <div className="flex items-start gap-1.5">
          <Clock className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${slotCfg.icon}`} />
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Data e hora da assinatura</p>
            <p className="text-xs font-semibold">
              {dataFormatada} às {horaFormatada}{' '}
              <span className="text-muted-foreground font-normal">(Horário de Brasília)</span>
            </p>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-dashed border-muted-foreground/20" />

        {/* Rodapé do carimbo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground font-mono">
              Verificação: <strong className="tracking-widest">{verCode}</strong>
            </span>
          </div>
          <div className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold ${slotCfg.badge}`}>
            <ShieldCheck className="w-2.5 h-2.5" />
            {statusCfg.label}
          </div>
        </div>

        {/* Declaração legal */}
        <p className="text-[9px] text-muted-foreground italic leading-relaxed border-t pt-2">
          Esta assinatura eletrônica tem validade jurídica conforme a Lei nº 14.063/2020 e MP 2.200-2/2001.
          O signatário declara ter lido e analisado o documento antes de assinar.
        </p>
      </div>
    </div>
  );
}
