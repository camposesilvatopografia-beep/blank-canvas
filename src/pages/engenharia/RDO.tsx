import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Eye,
  FileText,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  MessageCircle,
  Settings,
  Users,
  Trash2,
  Copy,
  ClipboardCopy,
  MailCheck,
  CalendarPlus,
  Send,
  Download,
  Cloud,
  Loader2,
  Mail,
  Droplets,
  Undo2,
} from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RDOFormModal } from '@/components/engenharia/RDOFormModal';
import { RDOViewModal } from '@/components/engenharia/RDOViewModal';
import { RDOObrasModal } from '@/components/engenharia/RDOObrasModal';
import { RDOAprovacoesPainel } from '@/components/engenharia/RDOAprovacoesPainel';
import { EmailLogsPanel } from '@/components/engenharia/EmailLogsPanel';
import { toast } from 'sonner';
import { uploadRdoPdf, generateRdoPdfBlob } from '@/hooks/useRdoPdfExport';

type RDOStatus = 'Rascunho' | 'Aguardando Aprovação' | 'Aprovado Parcialmente' | 'Aprovado' | 'Reprovado';

interface RDO {
  id: string;
  data: string;
  numero_rdo: string | null;
  status: RDOStatus;
  clima_manha: string;
  clima_tarde: string;
  observacoes: string | null;
  created_at: string;
  obra_id: string;
  aprovacao1_status: string;
  aprovacao2_status: string;
  aprovacao3_status: string;
  rdo_obras: {
    nome: string;
    cliente: string | null;
    aprovador1_nome: string | null;
    aprovador1_whatsapp: string | null;
    aprovador1_cargo: string | null;
    aprovador2_nome: string | null;
    aprovador2_whatsapp: string | null;
    aprovador2_cargo: string | null;
    aprovador3_nome: string | null;
    aprovador3_whatsapp: string | null;
    aprovador3_cargo: string | null;
  };
}

const statusConfig: Record<RDOStatus, { label: string; color: string; icon: React.ElementType }> = {
  'Rascunho': { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: FileText },
  'Aguardando Aprovação': { label: 'Aguardando', color: 'bg-yellow-500/15 text-yellow-600 border border-yellow-500/30', icon: Clock },
  'Aprovado Parcialmente': { label: 'Aprovado Parcialmente', color: 'bg-blue-500/15 text-blue-600 border border-blue-500/30', icon: Clock },
  'Aprovado': { label: 'Aprovado', color: 'bg-green-500/15 text-green-600 border border-green-500/30', icon: CheckCircle2 },
  'Reprovado': { label: 'Reprovado', color: 'bg-red-500/15 text-red-600 border border-red-500/30', icon: XCircle },
};

export default function RDO() {
  const { user } = useAuth();
  const { readSheet } = useGoogleSheets();
  const [rdos, setRdos] = useState<RDO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterObra, setFilterObra] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [obrasOpen, setObrasOpen] = useState(false);
  const [selectedRdo, setSelectedRdo] = useState<RDO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rdoToDelete, setRdoToDelete] = useState<RDO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [pendingApprovalRdoId, setPendingApprovalRdoId] = useState<string | null>(null);
  const [draftPreviewRdoId, setDraftPreviewRdoId] = useState<string | null>(null);
  const [batchAction, setBatchAction] = useState<string | null>(null); // 'send' | 'pdf' | 'cloud'

  // ── Ações em lote ────────────────────────────────────────────────────────
  const handleBatchSendAll = async () => {
    const rascunhos = filtered.filter(r => r.status === 'Rascunho');
    if (rascunhos.length === 0) { toast.info('Nenhum RDO em Rascunho para enviar'); return; }
    setBatchAction('send');

    let enviados = 0;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    for (const rdo of rascunhos) {
      // Atualizar status
      await supabase.from('rdos').update({ status: 'Aguardando Aprovação' }).eq('id', rdo.id);

      // Buscar tokens atualizados
      const { data: rdoAtual } = await supabase
        .from('rdos')
        .select('aprovacao1_token, aprovacao2_token, aprovacao3_token')
        .eq('id', rdo.id)
        .single();

      if (rdoAtual) {
        const obra = rdo.rdo_obras;
        const aprovadores = [
          { email: obra?.aprovador1_nome ? (obra as any).aprovador1_email : null, token: rdoAtual.aprovacao1_token },
          { email: obra?.aprovador2_nome ? (obra as any).aprovador2_email : null, token: rdoAtual.aprovacao2_token },
          { email: obra?.aprovador3_nome ? (obra as any).aprovador3_email : null, token: rdoAtual.aprovacao3_token },
        ].filter(a => a.email && a.token);

        for (const a of aprovadores) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/send-approval-otp?token=${a.token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            });
          } catch { /* ignore */ }
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      enviados++;
    }

    toast.success(`${enviados} RDO(s) enviados para aprovação!`);
    await fetchRdos();
    setBatchAction(null);
  };

  const handleBatchGeneratePdfs = async () => {
    if (filtered.length === 0) { toast.info('Nenhum RDO para gerar PDF'); return; }
    setBatchAction('pdf');

    let gerados = 0;
    for (const rdo of filtered) {
      try {
        // Buscar dados completos
        const [{ data: ef }, { data: eq }, { data: sv }, { data: ob }] = await Promise.all([
          supabase.from('rdo_efetivo').select('*').eq('rdo_id', rdo.id),
          supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdo.id),
          supabase.from('rdo_servicos').select('*').eq('rdo_id', rdo.id),
          supabase.from('rdo_obras').select('*').eq('id', rdo.obra_id).single(),
        ]);

        if (!ob) continue;

        // Buscar aprovadores de outras etapas se necessário
        const hasMissing = [1, 2, 3].some(n => !(ob as any)[`aprovador${n}_nome`]);
        if (hasMissing) {
          const { data: outrasObras } = await supabase
            .from('rdo_obras').select('*').eq('status', 'Ativo').neq('id', ob.id);
          if (outrasObras) {
            for (const n of [1, 2, 3]) {
              if (!(ob as any)[`aprovador${n}_nome`]) {
                const fonte = outrasObras.find(o => (o as any)[`aprovador${n}_nome`]);
                if (fonte) {
                  for (const campo of ['nome', 'email', 'whatsapp', 'cargo', 'cpf']) {
                    (ob as any)[`aprovador${n}_${campo}`] = (fonte as any)[`aprovador${n}_${campo}`];
                  }
                }
              }
            }
          }
        }

        const blob = await generateRdoPdfBlob({
          rdo, obra: ob, efetivo: ef || [], equipamentos: eq || [], servicos: sv || [], fotos: [],
        });

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dataFmt = format(new Date(rdo.data + 'T12:00:00'), 'yyyy-MM-dd');
        a.download = `RDO_${rdo.rdo_obras?.nome || 'etapa'}_${dataFmt}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        gerados++;
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error('Erro ao gerar PDF:', e);
      }
    }

    toast.success(`${gerados} PDF(s) gerados!`);
    setBatchAction(null);
  };

  const handleBatchUploadCloud = async () => {
    if (filtered.length === 0) { toast.info('Nenhum RDO para enviar à nuvem'); return; }
    setBatchAction('cloud');

    let salvos = 0;
    for (const rdo of filtered) {
      try {
        const [{ data: ef }, { data: eq }, { data: sv }, { data: ob }] = await Promise.all([
          supabase.from('rdo_efetivo').select('*').eq('rdo_id', rdo.id),
          supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdo.id),
          supabase.from('rdo_servicos').select('*').eq('rdo_id', rdo.id),
          supabase.from('rdo_obras').select('*').eq('id', rdo.obra_id).single(),
        ]);
        if (!ob) continue;

        const result = await uploadRdoPdf({
          rdo, obra: ob, efetivo: ef || [], equipamentos: eq || [], servicos: sv || [], fotos: [],
        });
        if (result) salvos++;
      } catch { /* ignore */ }
    }

    toast.success(`${salvos} PDF(s) salvos na nuvem!`);
    await fetchRdos();
    setBatchAction(null);
  };

  const handleBatchWhatsApp = async () => {
    const elegíveis = filtered.filter(r => r.status === 'Rascunho' || r.status === 'Aguardando Aprovação' || r.status === 'Aprovado Parcialmente');
    if (elegíveis.length === 0) { toast.info('Nenhum RDO para enviar via WhatsApp'); return; }
    setBatchAction('whatsapp');

    const { data: obrasAtivas } = await supabase.from('rdo_obras').select('*').eq('status', 'Ativo');
    const fallback: Record<number, any> = {};
    for (const n of [1, 2, 3]) {
      fallback[n] = obrasAtivas?.find((o: any) => o[`aprovador${n}_nome`] && o[`aprovador${n}_whatsapp`]) || null;
    }

    const prodUrl = 'https://apropriapp.lovable.app';
    const todasMensagens: string[] = [];

    for (const rdo of elegíveis) {
      if (rdo.status === 'Rascunho') {
        await supabase.from('rdos').update({ status: 'Aguardando Aprovação' }).eq('id', rdo.id);
      }

      const obra = rdo.rdo_obras;
      if (!obra) continue;

      const { data: rdoAtual } = await supabase
        .from('rdos')
        .select('aprovacao1_token, aprovacao2_token, aprovacao3_token, aprovacao1_status, aprovacao2_status, aprovacao3_status')
        .eq('id', rdo.id)
        .single();
      if (!rdoAtual) continue;

      const dataFmt = format(new Date(rdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

      for (const n of [1, 2, 3]) {
        const status = rdoAtual[`aprovacao${n}_status` as keyof typeof rdoAtual];
        if (status !== 'Pendente') continue;

        const nome = (obra as any)[`aprovador${n}_nome`] || fallback[n]?.[`aprovador${n}_nome`];
        const cargo = (obra as any)[`aprovador${n}_cargo`] || fallback[n]?.[`aprovador${n}_cargo`];
        const token = rdoAtual[`aprovacao${n}_token` as keyof typeof rdoAtual];

        if (!nome || !token) continue;
        const approvalUrl = `${prodUrl}/rdo/aprovar/${token}`;
        todasMensagens.push([
          `🏗️ *RDO - ${obra.nome}*`,
          `📅 ${dataFmt}${rdo.numero_rdo ? ` | Nº ${rdo.numero_rdo}` : ''}`,
          ``,
          `✍️ *${nome}${cargo ? ` (${cargo})` : ''}*, por favor revise e assine o RDO:`,
          ``,
          `👉 ${approvalUrl}`,
        ].join('\n'));
      }
    }

    if (todasMensagens.length === 0) {
      toast.info('Nenhum aprovador pendente encontrado');
    } else {
      const textoFinal = todasMensagens.join('\n\n─────────────\n\n');
      await navigator.clipboard.writeText(textoFinal);
      toast.success(`${todasMensagens.length} link(s) copiados! Cole no WhatsApp.`, { duration: 4000 });
    }

    await fetchRdos();
    setBatchAction(null);
  };

  const handleBatchEmailAll = async () => {
    const aguardando = filtered.filter(r => r.status === 'Aguardando Aprovação' || r.status === 'Aprovado Parcialmente');
    if (aguardando.length === 0) { toast.info('Nenhum RDO aguardando aprovação'); return; }
    setBatchAction('email');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: obrasAtivas } = await supabase.from('rdo_obras').select('*').eq('status', 'Ativo');
    const fallback: Record<number, any> = {};
    for (const n of [1, 2, 3]) {
      fallback[n] = obrasAtivas?.find((o: any) => o[`aprovador${n}_nome`] && o[`aprovador${n}_email`]) || null;
    }

    let enviados = 0;
    for (const rdo of aguardando) {
      const { data: rdoAtual } = await supabase
        .from('rdos')
        .select('aprovacao1_token, aprovacao2_token, aprovacao3_token, aprovacao1_status, aprovacao2_status, aprovacao3_status')
        .eq('id', rdo.id)
        .single();
      if (!rdoAtual) continue;

      const obra = rdo.rdo_obras;
      for (const n of [1, 2, 3]) {
        const status = rdoAtual[`aprovacao${n}_status` as keyof typeof rdoAtual];
        if (status !== 'Pendente') continue;

        const email = (obra as any)?.[`aprovador${n}_email`] || fallback[n]?.[`aprovador${n}_email`];
        const token = rdoAtual[`aprovacao${n}_token` as keyof typeof rdoAtual];
        if (!email || !token) continue;

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-approval-otp?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          });
          enviados++;
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    toast.success(`${enviados} e-mail(s) enviados!`);
    setBatchAction(null);
  };

  // ── Atualizar pluviometria em lote ─────────────────────────────────────
  const handleBatchUpdatePluviometria = async () => {
    setBatchAction('pluviometria');
    try {
      // 1. Ler planilha Pluviometria
      const sheetData = await readSheet('Pluviometria');
      if (!sheetData || sheetData.length <= 1) {
        toast.error('Planilha de Pluviometria vazia ou não encontrada');
        setBatchAction(null);
        return;
      }

      // Helper to parse date strings
      const parseDateStr = (raw: string): { dia: number; mes: number; ano: number } | null => {
        if (!raw) return null;
        let parts = raw.split('/');
        if (parts.length === 3) {
          const dia = parseInt(parts[0]);
          const mes = parseInt(parts[1]);
          let ano = parseInt(parts[2]);
          if (ano < 100) ano += 2000;
          if (dia && mes && ano) return { dia, mes, ano };
        }
        parts = raw.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          return { ano: parseInt(parts[0]), mes: parseInt(parts[1]), dia: parseInt(parts[2]) };
        }
        if (parts.length === 3 && parts[2].length === 4) {
          return { dia: parseInt(parts[0]), mes: parseInt(parts[1]), ano: parseInt(parts[2]) };
        }
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return { dia: d.getDate(), mes: d.getMonth() + 1, ano: d.getFullYear() };
        return null;
      };

      // Robust number parser for BR format
      const parseNum = (v: any): number => {
        if (v == null || v === '') return 0;
        const s = String(v).trim();
        if (s.includes('.') && s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        if (s.includes(',')) return parseFloat(s.replace(',', '.')) || 0;
        return parseFloat(s) || 0;
      };

      const pluvRows = sheetData.slice(1).map(r => ({
        parsed: parseDateStr((r[0] || '').toString().trim()),
        quantidade: parseNum(r[1]),
      }));

      // 2. Buscar todos os RDOs filtrados
      const rdosToUpdate = filtered;
      let atualizados = 0;

      for (const rdo of rdosToUpdate) {
        const rdoDate = new Date(rdo.data + 'T12:00:00');
        const rdoDia = rdoDate.getDate();
        const rdoMes = rdoDate.getMonth() + 1;
        const rdoAno = rdoDate.getFullYear();

        // Precipitação do dia
        const match = pluvRows.find(r => r.parsed && r.parsed.dia === rdoDia && r.parsed.mes === rdoMes && r.parsed.ano === rdoAno);
        const precipDia = match ? match.quantidade : 0;

        // Acumulado do mês
        let acumulado = 0;
        pluvRows.forEach(r => {
          if (r.parsed && r.parsed.mes === rdoMes && r.parsed.ano === rdoAno && r.parsed.dia <= rdoDia) {
            acumulado += r.quantidade;
          }
        });

        // Condição do tempo
        const condicao = precipDia <= 3 ? 'Bom' : precipDia <= 7 ? 'Instável' : 'Impraticável';

        await supabase.from('rdos').update({
          precipitacao_dia: precipDia,
          precipitacao_acumulada_mes: parseFloat(acumulado.toFixed(1)),
          condicao_tempo: condicao,
        }).eq('id', rdo.id);

        atualizados++;
      }

      toast.success(`Pluviometria atualizada em ${atualizados} RDO(s)!`);
      await fetchRdos();
    } catch (err) {
      console.error('Erro ao atualizar pluviometria:', err);
      toast.error('Erro ao atualizar pluviometria');
    }
    setBatchAction(null);
  };

  const fetchObras = async () => {
    const { data } = await supabase.from('rdo_obras').select('id, nome').eq('status', 'Ativo').order('nome');
    if (data) setObras(data);
  };

  const fetchRdos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rdos')
      .select(`*, rdo_obras(nome, cliente, aprovador1_nome, aprovador1_whatsapp, aprovador1_cargo, aprovador2_nome, aprovador2_whatsapp, aprovador2_cargo, aprovador3_nome, aprovador3_whatsapp, aprovador3_cargo)`)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) { toast.error('Erro ao carregar RDOs'); }
    else setRdos((data || []) as RDO[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRdos();
    fetchObras();
  }, []);

  const filtered = rdos.filter(r => {
    const matchSearch = !search ||
      r.rdo_obras?.nome?.toLowerCase().includes(search.toLowerCase()) ||
      (r.numero_rdo || '').toLowerCase().includes(search.toLowerCase());
    const matchObra = filterObra === 'all' || r.obra_id === filterObra;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchObra && matchStatus;
  });

  const handleView = (rdo: RDO) => {
    setSelectedRdo(rdo);
    setViewOpen(true);
  };

  const handleNew = () => {
    setSelectedRdo(null);
    setFormOpen(true);
  };

  const handleEdit = (rdo: RDO) => {
    setSelectedRdo(rdo);
    setFormOpen(true);
  };

  // Callback chamado pelo RDOFormModal quando o usuário clica "Enviar para Aprovação"
  // Salva o RDO como rascunho, fecha o form e abre a visualização com banner de confirmação
  const handleRequestSend = async (rdoId: string) => {
    await fetchRdos();
    setFormOpen(false);
    // Busca o RDO salvo para abrir na visualização
    const { data: rdoSalvo } = await supabase
      .from('rdos')
      .select(`*, rdo_obras(nome, cliente, aprovador1_nome, aprovador1_whatsapp, aprovador1_cargo, aprovador2_nome, aprovador2_whatsapp, aprovador2_cargo, aprovador3_nome, aprovador3_whatsapp, aprovador3_cargo)`)
      .eq('id', rdoId)
      .single();
    if (rdoSalvo) {
      setSelectedRdo(rdoSalvo as RDO);
      setPendingApprovalRdoId(rdoId);
      setViewOpen(true);
    }
  };

  // Callback chamado pelo RDOFormModal ao salvar rascunho — abre visualização com prévia PDF automática
  const handleDraftPreview = async (rdoId: string) => {
    await fetchRdos();
    setFormOpen(false);
    const { data: rdoSalvo } = await supabase
      .from('rdos')
      .select(`*, rdo_obras(nome, cliente, aprovador1_nome, aprovador1_whatsapp, aprovador1_cargo, aprovador2_nome, aprovador2_whatsapp, aprovador2_cargo, aprovador3_nome, aprovador3_whatsapp, aprovador3_cargo)`)
      .eq('id', rdoId)
      .single();
    if (rdoSalvo) {
      setSelectedRdo(rdoSalvo as RDO);
      setDraftPreviewRdoId(rdoId);
      setViewOpen(true);
    }
  };

  const handleDeleteClick = (rdo: RDO, e: React.MouseEvent) => {
    e.stopPropagation();
    setRdoToDelete(rdo);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rdoToDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('rdos').delete().eq('id', rdoToDelete.id);
    if (error) {
      toast.error('Erro ao excluir RDO');
    } else {
      toast.success('RDO excluído com sucesso');
      fetchRdos();
      setDeleteOpen(false);
      setRdoToDelete(null);
    }
    setDeleting(false);
  };

  const handleDuplicate = async (rdo: RDO, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    setDuplicating(rdo.id);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('rdos').insert({
      obra_id: rdo.obra_id,
      data: today,
      created_by: user.id,
      clima_manha: rdo.clima_manha,
      clima_tarde: rdo.clima_tarde,
      observacoes: rdo.observacoes,
      status: 'Rascunho',
    });
    if (error) {
      toast.error('Erro ao duplicar RDO');
    } else {
      toast.success('RDO duplicado como Rascunho!');
      fetchRdos();
    }
    setDuplicating(null);
  };

  /** Novo Dia: cria RDO com data de hoje copiando TODOS os dados (efetivo, equipamentos, serviços) e abre para edição */
  const handleNovoDia = async (rdo: RDO, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    setDuplicating(rdo.id);
    const today = new Date().toISOString().split('T')[0];

    // 1. Criar o novo RDO
    const { data: newRdo, error } = await supabase.from('rdos').insert({
      obra_id: rdo.obra_id,
      data: today,
      created_by: user.id,
      clima_manha: rdo.clima_manha,
      clima_tarde: rdo.clima_tarde,
      observacoes: rdo.observacoes,
      status: 'Rascunho',
      condicao_tempo: (rdo as any).condicao_tempo || 'Bom',
      comentarios_construtora: (rdo as any).comentarios_construtora || null,
      comentarios_gerenciadora: (rdo as any).comentarios_gerenciadora || null,
      comentarios_fiscalizacao: (rdo as any).comentarios_fiscalizacao || null,
    }).select('*').single();

    if (error || !newRdo) {
      toast.error('Erro ao criar novo dia');
      setDuplicating(null);
      return;
    }

    // 2. Copiar sub-registros em paralelo
    const [{ data: ef }, { data: eq }, { data: sv }] = await Promise.all([
      supabase.from('rdo_efetivo').select('funcao, quantidade, empresa, periodo').eq('rdo_id', rdo.id),
      supabase.from('rdo_equipamentos').select('equipamento, horas_trabalhadas, prefixo, status, observacao').eq('rdo_id', rdo.id),
      supabase.from('rdo_servicos').select('descricao, local_servico, unidade, quantidade_prevista, quantidade_executada').eq('rdo_id', rdo.id),
    ]);

    if (ef && ef.length > 0) {
      await supabase.from('rdo_efetivo').insert(
        ef.map((r: any) => ({ ...r, rdo_id: newRdo.id }))
      );
    }
    if (eq && eq.length > 0) {
      await supabase.from('rdo_equipamentos').insert(
        eq.map((r: any) => ({ ...r, rdo_id: newRdo.id }))
      );
    }
    if (sv && sv.length > 0) {
      await supabase.from('rdo_servicos').insert(
        sv.map((r: any) => ({ ...r, rdo_id: newRdo.id }))
      );
    }

    // 3. Recarregar lista e abrir o formulário para edição
    await fetchRdos();
    setDuplicating(null);

    // Buscar o RDO completo para abrir no form
    const { data: rdoCompleto } = await supabase
      .from('rdos')
      .select(`*, rdo_obras(nome, cliente, aprovador1_nome, aprovador1_whatsapp, aprovador1_cargo, aprovador2_nome, aprovador2_whatsapp, aprovador2_cargo, aprovador3_nome, aprovador3_whatsapp, aprovador3_cargo)`)
      .eq('id', newRdo.id)
      .single();

    if (rdoCompleto) {
      setSelectedRdo(rdoCompleto as RDO);
      setFormOpen(true);
      toast.success('Novo dia criado! Edite os dados e salve.');
    }
  };

  const handleWhatsApp = async (rdo: RDO) => {
    const obra = rdo.rdo_obras;
    if (!obra) return;

    if (rdo.status === 'Rascunho') {
      await supabase.from('rdos').update({ status: 'Aguardando Aprovação' }).eq('id', rdo.id);
    }

    const { data: rdoAtual } = await supabase
      .from('rdos')
      .select('aprovacao1_token, aprovacao2_token, aprovacao3_token, aprovacao1_status, aprovacao2_status, aprovacao3_status')
      .eq('id', rdo.id)
      .single();
    if (!rdoAtual) { toast.error('Erro ao buscar dados do RDO'); return; }

    const prodUrl = 'https://apropriapp.lovable.app';
    const dataFormatada = format(new Date(rdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

    const { data: obrasAtivas } = await supabase.from('rdo_obras').select('*').eq('status', 'Ativo');
    const fallback: Record<number, any> = {};
    for (const n of [1, 2, 3]) {
      fallback[n] = obrasAtivas?.find((o: any) => o[`aprovador${n}_nome`] && o[`aprovador${n}_whatsapp`]) || null;
    }

    const mensagens: string[] = [];
    for (const n of [1, 2, 3]) {
      const nome = (obra as any)[`aprovador${n}_nome`] || fallback[n]?.[`aprovador${n}_nome`];
      const cargo = (obra as any)[`aprovador${n}_cargo`] || fallback[n]?.[`aprovador${n}_cargo`];
      const token = rdoAtual[`aprovacao${n}_token` as keyof typeof rdoAtual];
      const status = rdoAtual[`aprovacao${n}_status` as keyof typeof rdoAtual];

      if (!nome || !token || status !== 'Pendente') continue;

      const approvalUrl = `${prodUrl}/rdo/aprovar/${token}`;
      mensagens.push([
        `🏗️ *RDO - ${obra.nome}*`,
        `📅 ${dataFormatada}${rdo.numero_rdo ? ` | Nº ${rdo.numero_rdo}` : ''}`,
        ``,
        `✍️ *${nome}${cargo ? ` (${cargo})` : ''}*, por favor revise e assine o RDO:`,
        ``,
        `👉 ${approvalUrl}`,
      ].join('\n'));
    }

    if (mensagens.length === 0) {
      toast.error('Nenhum aprovador pendente encontrado');
      return;
    }

    const textoFinal = mensagens.join('\n\n─────────────\n\n');
    await navigator.clipboard.writeText(textoFinal);
    toast.success('Mensagem copiada! Cole no WhatsApp para enviar.', { duration: 4000 });
    await fetchRdos();
  };

  const handleCopyApproverLink = async (rdo: RDO, aprovadorNum: number) => {
    const obra = rdo.rdo_obras;
    if (!obra) return;

    if (rdo.status === 'Rascunho') {
      await supabase.from('rdos').update({ status: 'Aguardando Aprovação' }).eq('id', rdo.id);
    }

    const { data: rdoAtual } = await supabase
      .from('rdos')
      .select(`aprovacao${aprovadorNum}_token, aprovacao${aprovadorNum}_status`)
      .eq('id', rdo.id)
      .single();
    if (!rdoAtual) { toast.error('Erro ao buscar dados'); return; }

    const token = (rdoAtual as any)[`aprovacao${aprovadorNum}_token`];
    const status = (rdoAtual as any)[`aprovacao${aprovadorNum}_status`];
    if (status !== 'Pendente') { toast.info(`Aprovador ${aprovadorNum} já respondeu`); return; }

    const { data: obrasAtivas } = await supabase.from('rdo_obras').select('*').eq('status', 'Ativo');
    const fallbackObra = obrasAtivas?.find((o: any) => o[`aprovador${aprovadorNum}_nome`]) || null;

    const nome = (obra as any)[`aprovador${aprovadorNum}_nome`] || fallbackObra?.[`aprovador${aprovadorNum}_nome`] || `Aprovador ${aprovadorNum}`;
    const cargo = (obra as any)[`aprovador${aprovadorNum}_cargo`] || fallbackObra?.[`aprovador${aprovadorNum}_cargo`] || '';
    const prodUrl = 'https://apropriapp.lovable.app';
    const dataFormatada = format(new Date(rdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    const approvalUrl = `${prodUrl}/rdo/aprovar/${token}`;

    const text = [
      `🏗️ *RDO - ${obra.nome}*`,
      `📅 ${dataFormatada}${rdo.numero_rdo ? ` | Nº ${rdo.numero_rdo}` : ''}`,
      ``,
      `✍️ *${nome}${cargo ? ` (${cargo})` : ''}*, por favor revise e assine o RDO:`,
      ``,
      `👉 ${approvalUrl}`,
    ].join('\n');

    await navigator.clipboard.writeText(text);
    toast.success(`Link do ${nome} copiado!`, { duration: 3000 });
    await fetchRdos();
  };

  const handleEmailIndividual = async (rdo: RDO) => {
    const obra = rdo.rdo_obras;
    if (!obra) return;

    // Promote Rascunho to Aguardando Aprovação
    if (rdo.status === 'Rascunho') {
      await supabase.from('rdos').update({ status: 'Aguardando Aprovação' }).eq('id', rdo.id);
    }

    const { data: rdoAtual } = await supabase
      .from('rdos')
      .select('aprovacao1_token, aprovacao2_token, aprovacao3_token, aprovacao1_status, aprovacao2_status, aprovacao3_status')
      .eq('id', rdo.id)
      .single();
    if (!rdoAtual) { toast.error('Erro ao buscar dados do RDO'); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Fallback
    const { data: obrasAtivas } = await supabase.from('rdo_obras').select('*').eq('status', 'Ativo');
    const fallback: Record<number, any> = {};
    for (const n of [1, 2, 3]) {
      fallback[n] = obrasAtivas?.find((o: any) => o[`aprovador${n}_nome`] && o[`aprovador${n}_email`]) || null;
    }

    let enviados = 0;
    for (const n of [1, 2, 3]) {
      const status = rdoAtual[`aprovacao${n}_status` as keyof typeof rdoAtual];
      if (status !== 'Pendente') continue;

      const email = (obra as any)?.[`aprovador${n}_email`] || fallback[n]?.[`aprovador${n}_email`];
      const token = rdoAtual[`aprovacao${n}_token` as keyof typeof rdoAtual];
      if (!email || !token) continue;

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-approval-otp?token=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        enviados++;
      } catch { /* ignore */ }
      await new Promise(r => setTimeout(r, 1500));
    }

    if (enviados === 0) toast.error('Nenhum aprovador pendente com e-mail cadastrado');
    else {
      toast.success(`${enviados} e-mail(s) enviado(s)!`);
      await fetchRdos();
    }
  };

  // Stats filtered by selected etapa
  const rdosForStats = filterObra === 'all' ? rdos : rdos.filter(r => r.obra_id === filterObra);
  const stats = {
    total: rdosForStats.length,
    rascunho: rdosForStats.filter(r => r.status === 'Rascunho').length,
    aguardando: rdosForStats.filter(r => r.status === 'Aguardando Aprovação').length,
    aprovados: rdosForStats.filter(r => r.status === 'Aprovado').length,
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">RDO — Relatório Diário de Obra</h1>
          <p className="text-xs text-muted-foreground">Registros diários com aprovação eletrônica</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setObrasOpen(true)} className="gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            Etapas
          </Button>
          <Button size="sm" onClick={handleNew} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Novo RDO
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rdos">
        <TabsList className="mb-3">
          <TabsTrigger value="rdos" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            RDOs
          </TabsTrigger>
          <TabsTrigger value="aprovacoes" className="gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5" />
            Aprovações
            {stats.aguardando > 0 && (
              <span className="ml-1 bg-yellow-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                {stats.aguardando}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="email-logs" className="gap-1.5 text-xs">
            <MailCheck className="w-3.5 h-3.5" />
            E-mails
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: RDOs ─────────────────────────────────────── */}
        <TabsContent value="rdos" className="space-y-3 mt-0">

      {/* Compact stats + Etapa tabs inline */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Etapa tabs */}
        <div className="flex gap-1.5 overflow-x-auto flex-1">
          <Button
            variant={filterObra === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterObra('all')}
            className="shrink-0 h-8 text-xs px-3"
          >
            Todas ({rdos.length})
          </Button>
          {obras.map(o => {
            const count = rdos.filter(r => r.obra_id === o.id).length;
            return (
              <Button
                key={o.id}
                variant={filterObra === o.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterObra(o.id)}
                className="shrink-0 h-8 text-xs px-3 gap-1"
              >
                {o.nome}
                <span className="text-[10px] opacity-70">{count}</span>
              </Button>
            );
          })}
        </div>
        {/* Compact inline stats */}
        <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
          <span title="Rascunhos">📝 {stats.rascunho}</span>
          <span title="Aguardando" className="text-yellow-600">⏳ {stats.aguardando}</span>
          <span title="Aprovados" className="text-green-600">✅ {stats.aprovados}</span>
        </div>
      </div>

      {/* Search + Status filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por obra ou nº..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusConfig).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Collapsible batch actions */}
      {filtered.length > 0 && (
        <details className="border rounded-lg bg-muted/20">
          <summary className="px-3 py-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
            ⚡ Ações em lote ({filtered.length} RDOs)
          </summary>
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            <Button variant="outline" size="sm" onClick={handleBatchSendAll} disabled={!!batchAction} className="gap-1 text-xs h-7 px-2">
              {batchAction === 'send' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Enviar Todos
            </Button>
            <Button variant="outline" size="sm" onClick={handleBatchGeneratePdfs} disabled={!!batchAction} className="gap-1 text-xs h-7 px-2">
              {batchAction === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              PDFs
            </Button>
            <Button variant="outline" size="sm" onClick={handleBatchUploadCloud} disabled={!!batchAction} className="gap-1 text-xs h-7 px-2">
              {batchAction === 'cloud' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
              Nuvem
            </Button>
            <Button variant="outline" size="sm" onClick={handleBatchWhatsApp} disabled={!!batchAction} className="gap-1 text-xs h-7 px-2 text-green-700">
              {batchAction === 'whatsapp' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageCircle className="w-3 h-3" />}
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={handleBatchEmailAll} disabled={!!batchAction} className="gap-1 text-xs h-7 px-2 text-blue-700">
              {batchAction === 'email' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              E-mail
            </Button>
            <Button variant="outline" size="sm" onClick={handleBatchUpdatePluviometria} disabled={!!batchAction} className="gap-1 text-xs h-7 px-2 text-cyan-700">
              {batchAction === 'pluviometria' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Droplets className="w-3 h-3" />}
              Pluviometria
            </Button>
          </div>
        </details>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium text-sm">Nenhum RDO encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(rdo => {
            const cfg = statusConfig[rdo.status] ?? statusConfig['Rascunho'];
            const StatusIcon = cfg.icon;
            const dataFormatada = format(new Date(rdo.data + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR });
            const aprovTotal = [rdo.aprovacao1_status, rdo.aprovacao2_status, rdo.aprovacao3_status].filter(s => s === 'Aprovado').length;
            const showActions = rdo.status === 'Rascunho' || rdo.status === 'Aguardando Aprovação' || rdo.status === 'Aprovado Parcialmente';

            return (
              <Card key={rdo.id} className="hover:shadow-sm transition-shadow cursor-pointer group" onClick={() => handleView(rdo)}>
                <CardContent className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    {/* Left: info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm truncate">{rdo.rdo_obras?.nome}</span>
                          {rdo.numero_rdo && <span className="text-[10px] text-muted-foreground">#{rdo.numero_rdo}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{dataFormatada}</span>
                          <span>☁️ {rdo.clima_manha}/{rdo.clima_tarde}</span>
                          {(rdo.status === 'Aguardando Aprovação' || rdo.status === 'Aprovado Parcialmente') && (
                            <span className="text-green-600">✅ {aprovTotal}/3</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Right: status + compact actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <Badge className={`${cfg.color} text-[10px] px-1.5 py-0.5 gap-0.5`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </Badge>
                      {showActions && (
                        <>
                          <Button variant="outline" size="sm" onClick={async () => { await supabase.from('rdos').update({ status: 'Rascunho' }).eq('id', rdo.id); toast.success('Revogado'); await fetchRdos(); }} className="h-6 w-6 p-0 text-orange-600 border-orange-500/30" title="Revogar">
                            <Undo2 className="w-3 h-3" />
                          </Button>
                          {[1, 2, 3].map(n => (
                            <Button key={n} variant="outline" size="sm" onClick={() => handleCopyApproverLink(rdo, n)} className="h-6 px-1.5 text-[10px] text-green-600 border-green-500/30 gap-0.5" title={`Link ${n}`}>
                              <ClipboardCopy className="w-2.5 h-2.5" />{n}
                            </Button>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => handleWhatsApp(rdo)} className="h-6 w-6 p-0 text-green-600 border-green-500/30" title="WhatsApp">
                            <MessageCircle className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEmailIndividual(rdo)} className="h-6 w-6 p-0 text-blue-600 border-blue-500/30" title="E-mail">
                            <Mail className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleView(rdo)} className="h-6 w-6 p-0"><Eye className="w-3.5 h-3.5" /></Button>
                      {rdo.status === 'Rascunho' && (
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(rdo)} className="h-6 w-6 p-0"><FileText className="w-3.5 h-3.5" /></Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={(e) => handleNovoDia(rdo, e)} disabled={duplicating === rdo.id} className="h-6 w-6 p-0 text-primary" title="Novo dia">
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => handleDuplicate(rdo, e)} disabled={duplicating === rdo.id} className="h-6 w-6 p-0" title="Duplicar">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => handleDeleteClick(rdo, e)} className="h-6 w-6 p-0 text-destructive" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        {/* ── Tab: Painel de Aprovações ──────────────────────── */}
        <TabsContent value="aprovacoes" className="mt-0">
          <RDOAprovacoesPainel filtroObra={filterObra} />
        </TabsContent>

        {/* ── Tab: Logs de Email ─────────────────────────────── */}
        <TabsContent value="email-logs" className="mt-0">
          <EmailLogsPanel />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <RDOFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        rdo={selectedRdo}
        obras={obras}
        onSaved={() => { fetchRdos(); setFormOpen(false); }}
        onRequestSend={handleRequestSend}
        onDraftPreview={handleDraftPreview}
      />
      <RDOViewModal
        open={viewOpen}
        onOpenChange={(v) => {
          setViewOpen(v);
          if (!v) { setPendingApprovalRdoId(null); setDraftPreviewRdoId(null); }
        }}
        rdo={selectedRdo}
        onEdit={() => { setViewOpen(false); setPendingApprovalRdoId(null); setDraftPreviewRdoId(null); handleEdit(selectedRdo!); }}
        onRefresh={fetchRdos}
        pendingApproval={pendingApprovalRdoId === selectedRdo?.id}
        autoPreview={draftPreviewRdoId === selectedRdo?.id}
      />
      <RDOObrasModal
        open={obrasOpen}
        onOpenChange={setObrasOpen}
        onSaved={fetchObras}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Excluir RDO"
        description={`Tem certeza que deseja excluir o RDO${rdoToDelete?.numero_rdo ? ` #${rdoToDelete.numero_rdo}` : ''} de ${rdoToDelete?.rdo_obras?.nome ?? ''}? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}

