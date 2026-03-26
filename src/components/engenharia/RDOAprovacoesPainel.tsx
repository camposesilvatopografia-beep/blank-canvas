import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Building2,
  Calendar,
  MessageCircle,
  Wifi,
  Mail,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';

interface AprovacaoPainel {
  id: string;
  data: string;
  numero_rdo: string | null;
  status: string;
  obra_id: string;
  aprovacao1_status: string | null;
  aprovacao1_data: string | null;
  aprovacao1_observacao: string | null;
  aprovacao1_token: string | null;
  aprovacao2_status: string | null;
  aprovacao2_data: string | null;
  aprovacao2_observacao: string | null;
  aprovacao2_token: string | null;
  aprovacao3_status: string | null;
  aprovacao3_data: string | null;
  aprovacao3_observacao: string | null;
  aprovacao3_token: string | null;
  rdo_obras: {
    nome: string;
    cliente: string | null;
    aprovador1_nome: string | null;
    aprovador1_cargo: string | null;
    aprovador1_whatsapp: string | null;
    aprovador1_email: string | null;
    aprovador2_nome: string | null;
    aprovador2_cargo: string | null;
    aprovador2_whatsapp: string | null;
    aprovador2_email: string | null;
    aprovador3_nome: string | null;
    aprovador3_cargo: string | null;
    aprovador3_whatsapp: string | null;
    aprovador3_email: string | null;
  };
}

const slotStatus = (status: string | null) => {
  if (status === 'Aprovado') return { icon: CheckCircle2, dot: 'bg-green-500', text: 'text-green-700', label: 'Aprovado', ring: 'ring-green-500/30' };
  if (status === 'Reprovado') return { icon: XCircle, dot: 'bg-red-500', text: 'text-red-700', label: 'Reprovado', ring: 'ring-red-500/30' };
  return { icon: Clock, dot: 'bg-yellow-400', text: 'text-yellow-700', label: 'Pendente', ring: 'ring-yellow-400/30' };
};

const rdoStatusConfig: Record<string, { color: string; label: string }> = {
  'Rascunho': { color: 'bg-muted text-muted-foreground', label: 'Rascunho' },
  'Aguardando Aprovação': { color: 'bg-yellow-500/15 text-yellow-700 border border-yellow-500/30', label: 'Aguardando' },
  'Aprovado Parcialmente': { color: 'bg-blue-500/15 text-blue-700 border border-blue-500/30', label: 'Parc. Aprovado' },
  'Aprovado': { color: 'bg-green-500/15 text-green-700 border border-green-500/30', label: 'Aprovado' },
  'Reprovado': { color: 'bg-red-500/15 text-red-700 border border-red-500/30', label: 'Reprovado' },
};

function AprovadorSlot({
  nome,
  cargo,
  whatsapp,
  email,
  status,
  data,
  observacao,
  token,
  rdoData,
  rdoNumero,
  obraNome,
  slot,
}: {
  nome: string | null;
  cargo: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string | null;
  data: string | null;
  observacao: string | null;
  token: string | null;
  rdoData: string;
  rdoNumero: string | null;
  obraNome: string;
  slot: number;
}) {
  const [sendingEmail, setSendingEmail] = useState(false);

  if (!nome) return null;

  const cfg = slotStatus(status);
  const Icon = cfg.icon;

  const handleReenviarWhatsApp = () => {
    if (!whatsapp || !token) { toast.error('WhatsApp não cadastrado ou link expirado'); return; }
    const phone = whatsapp.replace(/\D/g, '');
    const dataFmt = format(new Date(rdoData + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    const approvalUrl = `${window.location.origin}/rdo/aprovar/${token}`;
    const text = [
      `🏗️ *RDO - ${obraNome}*`,
      `📅 ${dataFmt}${rdoNumero ? ` | Nº ${rdoNumero}` : ''}`,
      ``,
      `✍️ *${nome}${cargo ? ` (${cargo})` : ''}*, por favor revise e assine o RDO:`,
      ``,
      `👉 ${approvalUrl}`,
    ].join('\n');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleReenviarEmail = async () => {
    if (!token) { toast.error('Link de aprovação expirado'); return; }
    if (!email) { toast.error('E-mail do aprovador não cadastrado nesta etapa'); return; }
    setSendingEmail(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-approval-otp?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const body = await res.json();
      if (res.ok && body.success) {
        toast.success(`E-mail reenviado para ${body.maskedEmail}`);
      } else {
        toast.error(body.error || 'Erro ao reenviar e-mail');
      }
    } catch {
      toast.error('Falha ao reenviar e-mail');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 p-3 rounded-xl border bg-card ring-1 ${cfg.ring} transition-all`}>
      {/* Top row: avatar dot + name + status icon */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
              {nome.charAt(0).toUpperCase()}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${cfg.dot}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{nome}</p>
            {cargo && <p className="text-xs text-muted-foreground truncate">{cargo}</p>}
          </div>
        </div>
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.text}`} />
      </div>

      {/* Status label + date */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
        {data && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(data), 'dd/MM HH:mm', { locale: ptBR })}
          </span>
        )}
      </div>

      {/* Observation */}
      {observacao && (
        <div className="bg-muted/50 rounded-lg px-2 py-1.5">
          <p className="text-xs text-muted-foreground italic leading-snug">"{observacao}"</p>
        </div>
      )}

      {/* Reenviar buttons when pending and token still valid */}
      {status === 'Pendente' && token && (
        <div className="flex gap-1.5 mt-0.5">
          {whatsapp && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 flex-1 text-green-700 hover:bg-green-500/10 justify-center"
              onClick={handleReenviarWhatsApp}
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 flex-1 text-blue-700 hover:bg-blue-500/10 justify-center"
            onClick={handleReenviarEmail}
            disabled={sendingEmail}
          >
            <Mail className="w-3 h-3" />
            {sendingEmail ? 'Enviando...' : 'E-mail'}
          </Button>
        </div>
      )}
    </div>
  );
}

interface RDOAprovacoesPainelProps {
  filtroObra?: string;
}

export function RDOAprovacoesPainel({ filtroObra = 'all' }: RDOAprovacoesPainelProps) {
  const [rdos, setRdos] = useState<AprovacaoPainel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [isLive, setIsLive] = useState(true);
  // Keep a ref to detect status changes between realtime updates
  const prevRdosRef = useRef<Map<string, AprovacaoPainel>>(new Map());

  const fetchRdos = async () => {
    const query = supabase
      .from('rdos')
      .select(`
        id, data, numero_rdo, status, obra_id,
        aprovacao1_status, aprovacao1_data, aprovacao1_observacao, aprovacao1_token,
        aprovacao2_status, aprovacao2_data, aprovacao2_observacao, aprovacao2_token,
        aprovacao3_status, aprovacao3_data, aprovacao3_observacao, aprovacao3_token,
        rdo_obras(nome, cliente, aprovador1_nome, aprovador1_cargo, aprovador1_whatsapp, aprovador1_email,
          aprovador2_nome, aprovador2_cargo, aprovador2_whatsapp, aprovador2_email,
          aprovador3_nome, aprovador3_cargo, aprovador3_whatsapp, aprovador3_email)
      `)
      .not('status', 'eq', 'Rascunho')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (filtroObra !== 'all') query.eq('obra_id', filtroObra);

    const [rdosRes, obrasRes] = await Promise.all([
      query,
      supabase
        .from('rdo_obras')
        .select(`
          aprovador1_nome, aprovador1_cargo, aprovador1_whatsapp, aprovador1_email,
          aprovador2_nome, aprovador2_cargo, aprovador2_whatsapp, aprovador2_email,
          aprovador3_nome, aprovador3_cargo, aprovador3_whatsapp, aprovador3_email
        `)
        .eq('status', 'Ativo'),
    ]);

    const obrasAtivas = obrasRes.data || [];
    const rdosRaw = (rdosRes.data || []) as any[];

    const fallbackPorSlot: Record<number, any | null> = { 1: null, 2: null, 3: null };
    for (const n of [1, 2, 3] as const) {
      const fonte = obrasAtivas.find((obra: any) => obra[`aprovador${n}_nome`]);
      fallbackPorSlot[n] = fonte || null;
    }

    const rdosComAprovadores = rdosRaw.map((rdo) => {
      if (!rdo?.rdo_obras) return rdo;

      const obra = { ...rdo.rdo_obras } as any;
      for (const n of [1, 2, 3] as const) {
        if (!obra[`aprovador${n}_nome`] && fallbackPorSlot[n]) {
          for (const campo of ['nome', 'cargo', 'whatsapp', 'email']) {
            obra[`aprovador${n}_${campo}`] = fallbackPorSlot[n][`aprovador${n}_${campo}`] || null;
          }
        }
      }

      return { ...rdo, rdo_obras: obra };
    });

    setRdos(rdosComAprovadores as AprovacaoPainel[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRdos();

    // Realtime subscription
    const channel = supabase
      .channel('rdos-aprovacoes-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rdos' },
        (payload) => {
          const updated = payload.new as any;

          setRdos(prev => {
            const prevRdo = prev.find(r => r.id === updated.id);

            if (prevRdo) {
              // Check each approval slot for new signatures
              const slots = [1, 2, 3] as const;
              for (const n of slots) {
                const prevStatus = prevRdo[`aprovacao${n}_status`];
                const newStatus = updated[`aprovacao${n}_status`];

                if (prevStatus !== newStatus && (newStatus === 'Aprovado' || newStatus === 'Reprovado')) {
                  const nomeAprovador = prevRdo.rdo_obras?.[`aprovador${n}_nome`] ?? `Aprovador ${n}`;
                  const obraNome = prevRdo.rdo_obras?.nome ?? 'RDO';

                  if (newStatus === 'Aprovado') {
                    playSuccessSound();
                    toast.success(`✅ ${nomeAprovador} assinou o RDO`, {
                      description: obraNome,
                      duration: 8000,
                    });
                  } else {
                    playOfflineSound();
                    toast.error(`❌ ${nomeAprovador} reprovou o RDO`, {
                      description: obraNome,
                      duration: 8000,
                    });
                  }
                }
              }
            }

            return prev.map(r => r.id === updated.id ? { ...r, ...updated } : r);
          });
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [filtroObra]);

  const filtered = rdos.filter(r => {
    if (filterStatus === 'pendentes') return r.status === 'Aguardando Aprovação' || r.status === 'Aprovado Parcialmente';
    if (filterStatus === 'aprovados') return r.status === 'Aprovado';
    if (filterStatus === 'reprovados') return r.status === 'Reprovado';
    return true;
  });

  // Contadores de slots globais
  const totalSlots = rdos.flatMap(r => [
    r.rdo_obras?.aprovador1_nome ? r.aprovacao1_status : null,
    r.rdo_obras?.aprovador2_nome ? r.aprovacao2_status : null,
    r.rdo_obras?.aprovador3_nome ? r.aprovacao3_status : null,
  ]).filter(Boolean);
  const aprovados = totalSlots.filter(s => s === 'Aprovado').length;
  const pendentes = totalSlots.filter(s => s === 'Pendente').length;
  const reprovados = totalSlots.filter(s => s === 'Reprovado').length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho do painel */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Painel de Aprovações</h2>
          <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            isLive ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'
          }`}>
            <Wifi className="w-3 h-3" />
            {isLive ? 'Ao vivo' : 'Reconectando...'}
          </div>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">⏳ Pendentes</SelectItem>
            <SelectItem value="aprovados">✅ Aprovados</SelectItem>
            <SelectItem value="reprovados">❌ Reprovados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mini-stats de assinaturas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Assinados', value: aprovados, color: 'text-green-700', bg: 'bg-green-500/10' },
          { label: 'Pendentes', value: pendentes, color: 'text-yellow-700', bg: 'bg-yellow-500/10' },
          { label: 'Reprovados', value: reprovados, color: 'text-red-700', bg: 'bg-red-500/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista de RDOs com slots de aprovação */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p>Nenhum RDO neste filtro</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(rdo => {
            const obra = rdo.rdo_obras;
            const dataFmt = format(new Date(rdo.data + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR });
            const statusCfg = rdoStatusConfig[rdo.status] ?? rdoStatusConfig['Rascunho'];
            const aprovCount = [rdo.aprovacao1_status, rdo.aprovacao2_status, rdo.aprovacao3_status]
              .filter(s => s === 'Aprovado').length;
            const totalAprovadores = [obra?.aprovador1_nome, obra?.aprovador2_nome, obra?.aprovador3_nome]
              .filter(Boolean).length;

            return (
              <Card key={rdo.id} className="overflow-hidden">
                {/* RDO header */}
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">
                          {obra?.nome}
                          {rdo.numero_rdo && (
                            <span className="text-muted-foreground font-normal ml-1.5">#{rdo.numero_rdo}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {dataFmt}
                          {obra?.cliente && <span>· {obra.cliente}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Progress bar das assinaturas */}
                      {totalAprovadores > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <div className="flex gap-0.5">
                            {Array.from({ length: totalAprovadores }).map((_, i) => {
                              const s = [rdo.aprovacao1_status, rdo.aprovacao2_status, rdo.aprovacao3_status][i];
                              return (
                                <div
                                  key={i}
                                  className={`w-5 h-1.5 rounded-full ${
                                    s === 'Aprovado' ? 'bg-green-500' :
                                    s === 'Reprovado' ? 'bg-red-500' : 'bg-muted'
                                  }`}
                                />
                              );
                            })}
                          </div>
                          <span>{aprovCount}/{totalAprovadores}</span>
                        </div>
                      )}
                      <Badge className={`${statusCfg.color} text-xs`}>{statusCfg.label}</Badge>
                    </div>
                  </div>
                </CardHeader>

                {/* Slots dos aprovadores */}
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([1, 2, 3] as const).map(n => (
                      <AprovadorSlot
                        key={n}
                        slot={n}
                        nome={obra?.[`aprovador${n}_nome`] ?? null}
                        cargo={obra?.[`aprovador${n}_cargo`] ?? null}
                        whatsapp={obra?.[`aprovador${n}_whatsapp`] ?? null}
                        email={obra?.[`aprovador${n}_email`] ?? null}
                        status={rdo[`aprovacao${n}_status`] ?? 'Pendente'}
                        data={rdo[`aprovacao${n}_data`]}
                        observacao={rdo[`aprovacao${n}_observacao`]}
                        token={rdo[`aprovacao${n}_token`]}
                        rdoData={rdo.data}
                        rdoNumero={rdo.numero_rdo}
                        obraNome={obra?.nome ?? ''}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
