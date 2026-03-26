import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, CheckCircle2, XCircle, RefreshCw, Search, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface EmailLog {
  id: string;
  rdo_id: string;
  obra_nome: string | null;
  aprovador_num: number;
  email: string;
  status: string;
  error_message: string | null;
  resend_id: string | null;
  sent_at: string;
}

const APROVADOR_LABELS = ['', 'Aprovador 1', 'Aprovador 2', 'Aprovador 3'];
const APROVADOR_COLORS = ['', 'bg-blue-500', 'bg-purple-500', 'bg-emerald-500'];

function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  return user.slice(0, 2) + '***@' + domain;
}

interface ResendButtonProps {
  rdoId: string;
  aprovadorNum: number;
  email: string;
  onSuccess: () => void;
}

function ResendButton({ rdoId, aprovadorNum, email, onSuccess }: ResendButtonProps) {
  const [sending, setSending] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      // Buscar o token do aprovador para este RDO
      const colToken = `aprovacao${aprovadorNum}_token` as any;
      const { data: rdoData } = await supabase
        .from('rdos')
        .select(colToken)
        .eq('id', rdoId)
        .single();

      const token = rdoData?.[colToken];
      if (!token) {
        toast.error('Token de aprovação não encontrado. O RDO pode não estar no status correto.');
        setSending(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-approval-otp?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        toast.success(`E-mail reenviado para ${body.maskedEmail || maskEmail(email)}`);
        onSuccess();
      } else {
        toast.error(body.error || 'Erro ao reenviar e-mail');
      }
    } catch (e) {
      toast.error('Falha ao reenviar e-mail');
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs gap-1 text-blue-700 border-blue-500/30 hover:bg-blue-500/10"
      onClick={handleResend}
      disabled={sending}
    >
      <Send className="w-3 h-3" />
      {sending ? 'Enviando...' : 'Reenviar'}
    </Button>
  );
}

export function EmailLogsPanel() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('rdo_email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    setLogs((data || []) as EmailLog[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(log => {
    const matchStatus = filterStatus === 'all' || log.status === filterStatus;
    const matchSearch =
      !search ||
      log.email.toLowerCase().includes(search.toLowerCase()) ||
      (log.obra_nome || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Logs de Emails Enviados</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchLogs} className="gap-1.5 text-xs h-8">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </div>

        {/* Mini-stats */}
        <div className="flex gap-3 mt-1">
          <div className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-700 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {successCount} enviados
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-red-500/10 text-red-700 px-2.5 py-1 rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            {errorCount} erros
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mt-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por email ou obra..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">✅ Enviados</SelectItem>
              <SelectItem value="error">❌ Com erro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando logs...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>Nenhum log encontrado</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(log => {
              const isExpanded = expandedId === log.id;
              const isSuccess = log.status === 'success';
              const aprovadorColor = APROVADOR_COLORS[log.aprovador_num] || 'bg-gray-500';
              const aprovadorLabel = APROVADOR_LABELS[log.aprovador_num] || `Aprovador ${log.aprovador_num}`;

              return (
                <div key={log.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div
                    className="flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    {/* Ícone status */}
                    <div className="shrink-0">
                      {isSuccess
                        ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                        : <XCircle className="w-4 h-4 text-red-500" />
                      }
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{maskEmail(log.email)}</span>
                        <Badge
                          className={`text-[10px] px-1.5 py-0 h-4 text-white shrink-0 ${aprovadorColor}`}
                        >
                          {aprovadorLabel}
                        </Badge>
                      </div>
                      {log.obra_nome && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{log.obra_nome}</p>
                      )}
                    </div>

                    {/* Reenviar (erros) + Data/hora + expand */}
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      {!isSuccess && (
                        <ResendButton
                          rdoId={log.rdo_id}
                          aprovadorNum={log.aprovador_num}
                          email={log.email}
                          onSuccess={fetchLogs}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      }
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <div>
                          <p className="text-muted-foreground">Email</p>
                          <p className="font-mono text-xs">{log.email}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <span className={`font-semibold ${isSuccess ? 'text-green-700' : 'text-red-600'}`}>
                            {isSuccess ? 'Entregue ao Resend' : 'Falha no envio'}
                          </span>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Data/hora</p>
                          <p>{format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
                        </div>
                        {log.resend_id && (
                          <div>
                            <p className="text-muted-foreground">ID Resend</p>
                            <p className="font-mono text-[10px] break-all">{log.resend_id}</p>
                          </div>
                        )}
                        {log.obra_nome && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Etapa/Obra</p>
                            <p>{log.obra_nome}</p>
                          </div>
                        )}
                        {log.error_message && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground mb-1">Mensagem de erro</p>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 font-mono text-[10px] text-red-700 break-all">
                              {log.error_message}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Botão de reenvio também nos detalhes expandidos de QUALQUER log */}
                      <div className="flex justify-end pt-1">
                        <ResendButton
                          rdoId={log.rdo_id}
                          aprovadorNum={log.aprovador_num}
                          email={log.email}
                          onSuccess={fetchLogs}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
