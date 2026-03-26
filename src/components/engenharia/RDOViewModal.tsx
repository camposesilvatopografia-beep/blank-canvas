import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, MessageCircle, Download, CheckCircle2, XCircle, Clock, Send, Wifi, Cloud, CloudDownload, Eye, X, AlertTriangle, Mail } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { uploadRdoPdf, generateRdoPdfBlob, getRdoPdfSignedUrl } from '@/hooks/useRdoPdfExport';
import { useRdoDriveSave } from '@/hooks/useRdoDriveSave';


interface RDOViewModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rdo: any;
  onEdit: () => void;
  onRefresh: () => void;
  pendingApproval?: boolean; // quando true, mostra banner de confirmação antes de disparar envios
  autoPreview?: boolean; // quando true, gera a prévia PDF automaticamente ao abrir
}

const apStatus = (s: string) => {
  if (s === 'Aprovado') return { icon: CheckCircle2, color: 'text-green-600', label: 'Aprovado' };
  if (s === 'Reprovado') return { icon: XCircle, color: 'text-red-600', label: 'Reprovado' };
  return { icon: Clock, color: 'text-yellow-600', label: 'Pendente' };
};

export function RDOViewModal({ open, onOpenChange, rdo, onEdit, onRefresh, pendingApproval = false, autoPreview = false }: RDOViewModalProps) {
  const { saveToDrive } = useRdoDriveSave();
  const [efetivo, setEfetivo] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [obra, setObra] = useState<any>(null);
  const [fotos, setFotos] = useState<{ storage_path: string; legenda: string; signedUrl: string }[]>([]);
  const [assinaturas, setAssinaturas] = useState<Record<string, string>>({});
  const [rdoLive, setRdoLive] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [downloadingCloud, setDownloadingCloud] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const channelRef = useRef<any>(null);
  const autoPreviewTriggered = useRef(false);
  // Sincroniza rdoLive com prop rdo quando abre
  useEffect(() => {
    if (open && rdo) {
      setRdoLive(rdo);
      setConfirmingSend(pendingApproval); // ativa modo de confirmação se veio do form
      if (autoPreview) {
        autoPreviewTriggered.current = false; // reset para trigger quando obra carregar
      }
    }
    if (!open) {
      autoPreviewTriggered.current = false;
    }
  }, [open, rdo, pendingApproval, autoPreview]);

  // Auto-preview: gera PDF automaticamente quando abrir com autoPreview e obra já carregou
  useEffect(() => {
    if (open && autoPreview && obra && rdo && !autoPreviewTriggered.current && !pdfPreviewUrl) {
      autoPreviewTriggered.current = true;
      const timer = setTimeout(async () => {
        try {
          setGeneratingPreview(true);
          const currentRdo = rdoLive || rdo;
          const blob = await generateRdoPdfBlob({ rdo: currentRdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas });
          setPdfPreviewUrl(URL.createObjectURL(blob));
        } catch {
          // silencioso
        } finally {
          setGeneratingPreview(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [open, autoPreview, obra, rdo, efetivo, equipamentos]);

  // Realtime: escuta mudanças no RDO aberto
  useEffect(() => {
    if (!open || !rdo?.id) { setIsLive(false); return; }

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase
      .channel(`rdo-view-${rdo.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rdos', filter: `id=eq.${rdo.id}` },
        (payload) => {
          const updated = payload.new as any;
          setRdoLive(prev => {
            const merged = { ...prev, ...updated };

            // Após assinatura, recarrega as URLs de assinatura e regenera o PDF na nuvem
            if (obra) {
              setTimeout(async () => {
                try {
                  // Recarregar URLs assinadas das novas assinaturas
                  const assMap: Record<string, string> = {};
                  for (const n of [1, 2, 3]) {
                    const path = merged[`assinatura${n}_path`];
                    if (path) {
                      const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(path, 3600);
                      if (signed?.signedUrl) assMap[`assinatura${n}_url`] = signed.signedUrl;
                    }
                  }
                  setAssinaturas(assMap);

                  if (merged.pdf_path) {
                    await uploadRdoPdf({
                      rdo: merged,
                      obra,
                      efetivo,
                      equipamentos,
                      servicos,
                      fotos,
                      assinaturas: assMap,
                    });
                    toast.info('📄 PDF atualizado na nuvem com nova assinatura', { duration: 4000 });
                  }
                } catch { /* silencioso */ }
              }, 1000);
            }

            return merged;
          });
          onRefresh();

          // Notificação de assinatura
          const slots = [1, 2, 3] as const;
          for (const n of slots) {
            const prevStatus = rdo[`aprovacao${n}_status`];
            const newStatus = updated[`aprovacao${n}_status`];
            if (prevStatus !== newStatus && newStatus === 'Aprovado') {
              toast.success(`✅ ${obra?.[`aprovador${n}_nome`] || `Aprovador ${n}`} assinou!`, { duration: 6000 });
            } else if (prevStatus !== newStatus && newStatus === 'Reprovado') {
              toast.error(`❌ ${obra?.[`aprovador${n}_nome`] || `Aprovador ${n}`} reprovou`, { duration: 6000 });
            }
          }
        }
      )
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'));

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); setIsLive(false); };
  }, [open, rdo?.id]);

  useEffect(() => {
    if (open && rdo?.id) {
      loadData();
    }
  }, [open, rdo]);

  const loadData = async () => {
    if (!rdo?.id) return;
    const [{ data: ef }, { data: eq }, { data: sv }, { data: ob }, { data: ft }] = await Promise.all([
      supabase.from('rdo_efetivo').select('*').eq('rdo_id', rdo.id),
      supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdo.id),
      supabase.from('rdo_servicos').select('*').eq('rdo_id', rdo.id),
      supabase.from('rdo_obras').select('*').eq('id', rdo.obra_id).single(),
      supabase.from('rdo_fotos').select('*').eq('rdo_id', rdo.id).order('created_at'),
    ]);
    setEfetivo(ef || []);
    setEquipamentos(eq || []);
    setServicos(sv || []);

    // Sempre preencher aprovadores vazios com dados de outras etapas ativas
    let obraFinal = ob ? { ...ob } : ob;
    if (ob) {
      const hasMissing = [1, 2, 3].some(n => !ob[`aprovador${n}_nome`]);
      if (hasMissing) {
        const { data: outrasObras } = await supabase
          .from('rdo_obras')
          .select('*')
          .eq('status', 'Ativo')
          .neq('id', ob.id);
        if (outrasObras && outrasObras.length > 0) {
          for (const n of [1, 2, 3]) {
            if (!obraFinal[`aprovador${n}_nome`]) {
              // Buscar este slot de qualquer outra etapa que o tenha
              const fonte = outrasObras.find(o => o[`aprovador${n}_nome`]);
              if (fonte) {
                for (const campo of ['nome', 'email', 'whatsapp', 'cargo', 'cpf']) {
                  obraFinal[`aprovador${n}_${campo}`] = fonte[`aprovador${n}_${campo}`];
                }
              }
            }
          }
        }
      }
    }
    setObra(obraFinal);
    if (ft && ft.length > 0) {
      const fotosWithUrls = await Promise.all((ft as any[]).map(async (f: any) => {
        const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(f.storage_path, 3600);
        return { storage_path: f.storage_path, legenda: f.legenda || '', signedUrl: signed?.signedUrl || '' };
      }));
      setFotos(fotosWithUrls);
    } else {
      setFotos([]);
    }

    // Carregar URLs assinadas das assinaturas (paths vindos do rdoLive ou rdo)
    const rdoRef = rdo;
    const assMap: Record<string, string> = {};
    for (const n of [1, 2, 3]) {
      const path = rdoRef[`assinatura${n}_path`];
      if (path) {
        const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(path, 3600);
        if (signed?.signedUrl) assMap[`assinatura${n}_url`] = signed.signedUrl;
      }
    }
    setAssinaturas(assMap);
  };

  // ── Prazos calculados dinamicamente com base na data de HOJE ──────────
  const prazosHoje = useMemo(() => {
    if (!obra) return null;
    const safeDate = (d: string | null) => d ? new Date(d + 'T12:00:00') : null;
    const hoje = new Date();
    const dataInicioCont = safeDate(obra.data_inicio_contrato);
    const dataPrazo = safeDate(obra.data_prazo_contratual);
    const dataPub = safeDate(obra.data_publicacao);
    const vigFinal = safeDate(obra.vigencia_final);
    const diasAditados = obra.dias_aditados || 0;
    const diasParalisados = obra.dias_paralisados || 0;
    const prazoContr = obra.prazo_contratual_dias || null;

    const decorrido = dataInicioCont ? Math.max(0, differenceInDays(hoje, dataInicioCont)) : null;
    const restante = prazoContr != null && decorrido != null ? Math.max(0, prazoContr - decorrido) : null;
    const restanteVigencia = vigFinal ? differenceInDays(vigFinal, hoje) : null;
    const novoPrazo = dataPrazo && (diasAditados || diasParalisados)
      ? new Date(dataPrazo.getTime() + (diasAditados + diasParalisados) * 86400000)
      : null;

    return { decorrido, restante, restanteVigencia, novoPrazo, prazoContr, diasAditados, diasParalisados, dataInicioCont, dataPub, vigFinal };
  }, [obra]);

  const handleSendWhatsApp = (aprovadorNum: 1 | 2 | 3) => {
    if (!obra) return;
    const nome = obra[`aprovador${aprovadorNum}_nome`];
    const whatsapp = obra[`aprovador${aprovadorNum}_whatsapp`]?.replace(/\D/g, '');
    const cargo = obra[`aprovador${aprovadorNum}_cargo`];

    if (!whatsapp) { toast.error('WhatsApp do aprovador não cadastrado'); return; }

    const dataFormatada = format(new Date(rdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    const token = rdo[`aprovacao${aprovadorNum}_token`];
    const approvalUrl = `${window.location.origin}/rdo/aprovar/${token}`;

    const totalPessoas = efetivo.reduce((s: number, e: any) => s + (e.quantidade || 0), 0);
    const text = [
      `🏗️ *RDO - ${obra.nome}*`,
      `📅 ${dataFormatada}${rdo.numero_rdo ? ` | Nº ${rdo.numero_rdo}` : ''}`,
      ``,
      `☁️ *Clima:* ${rdo.clima_manha} (manhã) / ${rdo.clima_tarde} (tarde)`,
      totalPessoas > 0 ? `👷 *Efetivo:* ${totalPessoas} pessoas` : '',
      equipamentos.length > 0 ? `🚜 *Equipamentos:* ${equipamentos.length} unidade(s)` : '',
      servicos.length > 0 ? `🔧 *Serviços:* ${servicos.length} atividade(s)` : '',
      rdo.observacoes ? `📝 *Obs:* ${rdo.observacoes}` : '',
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `✍️ *${nome}${cargo ? ` (${cargo})` : ''}*, por favor acesse o link abaixo para revisar e assinar este RDO:`,
      ``,
      `👉 ${approvalUrl}`,
    ].filter(l => l !== undefined && l !== '').join('\n');

    window.open(`https://wa.me/55${whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Envia o link de aprovação para TODOS os aprovadores via WhatsApp de uma vez
  const handleSendAllApprovers = async () => {
    if (!obra) { toast.error('Dados da etapa não carregados'); return; }
    const currentRdo = rdoLive || rdo;

    const aprovadores = [1, 2, 3].map(n => ({
      n,
      nome: obra[`aprovador${n}_nome`],
      whatsapp: obra[`aprovador${n}_whatsapp`]?.replace(/\D/g, ''),
      cargo: obra[`aprovador${n}_cargo`],
      token: currentRdo[`aprovacao${n}_token`],
      status: currentRdo[`aprovacao${n}_status`],
    })).filter(a => a.nome && a.whatsapp);

    if (aprovadores.length === 0) {
      toast.error('Nenhum aprovador com WhatsApp cadastrado nesta etapa');
      return;
    }

    setSending(true);

    // Atualiza status do RDO para "Aguardando Aprovação" se ainda estiver como Rascunho
    if (currentRdo.status === 'Rascunho') {
      const { error } = await supabase.from('rdos').update({ status: 'Aguardando Aprovação' }).eq('id', currentRdo.id);
      if (error) { toast.error('Erro ao atualizar status'); setSending(false); return; }
      setRdoLive(prev => ({ ...(prev || currentRdo), status: 'Aguardando Aprovação' }));
      onRefresh();
    }

    // Gera e sobe o PDF para a nuvem automaticamente ao enviar para assinaturas
    toast.info('Gerando e salvando PDF...', { id: 'pdf-upload' });
    const rdoParaPdf = { ...(rdoLive || currentRdo), status: 'Aguardando Aprovação' };
    const [pdfPathAll, driveAll] = await Promise.all([
      uploadRdoPdf({ rdo: rdoParaPdf, obra, efetivo, equipamentos, servicos, fotos, assinaturas }),
      saveToDrive({ rdo: rdoParaPdf, obra, efetivo, equipamentos, servicos, fotos, assinaturas }),
    ]);
    if (pdfPathAll) setRdoLive((prev: any) => ({ ...(prev || currentRdo), pdf_path: pdfPathAll }));
    toast.success(driveAll.driveLink ? 'PDF salvo no sistema e no Drive! ☁️' : 'PDF salvo! ☁️', { id: 'pdf-upload' });

    const dataFmt = format(new Date(currentRdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    const totalEnviados: string[] = [];

    for (const ap of aprovadores) {
      if (!ap.token) continue;
      const approvalUrl = `${window.location.origin}/rdo/aprovar/${ap.token}`;
      const text = [
        `🏗️ *RDO - ${obra.nome}*`,
        `📅 ${dataFmt}${currentRdo.numero_rdo ? ` | Nº ${currentRdo.numero_rdo}` : ''}`,
        ``,
        `✍️ *${ap.nome}${ap.cargo ? ` (${ap.cargo})` : ''}*, por favor revise e assine o RDO:`,
        ``,
        `👉 ${approvalUrl}`,
      ].join('\n');
      window.open(`https://wa.me/55${ap.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
      totalEnviados.push(ap.nome);
      await new Promise(r => setTimeout(r, 800));
    }

    setSending(false);
    if (totalEnviados.length > 0) {
      toast.success(`Links enviados para: ${totalEnviados.join(', ')}`);
    } else {
      toast.info('Todos os aprovadores já assinaram ou os links expiraram');
    }
  };

  /** Confirma envio após conferência: muda status para Aguardando e dispara emails */
  const handleConfirmAndSend = async () => {
    if (!obra) { toast.error('Dados da etapa não carregados'); return; }
    const currentRdo = rdoLive || rdo;
    setSending(true);

    // 1. Atualiza status para "Aguardando Aprovação"
    const { error } = await supabase.from('rdos').update({ status: 'Aguardando Aprovação' }).eq('id', currentRdo.id);
    if (error) { toast.error('Erro ao atualizar status'); setSending(false); return; }
    setRdoLive((prev: any) => ({ ...(prev || currentRdo), status: 'Aguardando Aprovação' }));
    onRefresh();

    // 2. Buscar tokens atualizados do banco
    const { data: rdoAtual } = await supabase
      .from('rdos')
      .select('aprovacao1_token, aprovacao2_token, aprovacao3_token')
      .eq('id', currentRdo.id)
      .single();

    // 3. Disparar emails SEQUENCIALMENTE (evitar rate limit entre aprovadores diferentes do mesmo RDO)
    if (rdoAtual) {
      const aprovadoresComEmail = [
        { nome: obra.aprovador1_nome, email: obra.aprovador1_email, token: rdoAtual.aprovacao1_token },
        { nome: obra.aprovador2_nome, email: obra.aprovador2_email, token: rdoAtual.aprovacao2_token },
        { nome: obra.aprovador3_nome, email: obra.aprovador3_email, token: rdoAtual.aprovacao3_token },
      ].filter(a => a.nome && a.email && a.token);

      if (aprovadoresComEmail.length > 0) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        let enviados = 0;
        const erros: string[] = [];

        // Envia um por vez com 1.5s de intervalo para garantir que a edge function processe
        for (const a of aprovadoresComEmail) {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/send-approval-otp?token=${a.token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            });
            const body = await res.json().catch(() => ({}));
            if (res.ok && body.success) {
              enviados++;
            } else if (res.status !== 429) {
              erros.push(a.nome || 'Aprovador');
              console.error(`Erro ao enviar email para ${a.nome}:`, body);
            }
          } catch (e) {
            erros.push(a.nome || 'Aprovador');
            console.error('Exceção ao enviar email:', e);
          }
          // Aguarda 1.5s entre cada envio
          if (aprovadoresComEmail.indexOf(a) < aprovadoresComEmail.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        if (enviados > 0) {
          toast.success(`✅ RDO enviado para aprovação! E-mails disparados para ${enviados} aprovador(es).`);
        }
        if (erros.length > 0) {
          toast.error(`Falha ao enviar para: ${erros.join(', ')}. Reenvie pelo Painel de Aprovações.`);
        }
        if (enviados === 0 && erros.length === 0) {
          toast.success('RDO enviado para aprovação!');
          toast.warning('Configure e-mails dos aprovadores na etapa para envio automático.');
        }
      } else {
        toast.success('RDO enviado para aprovação!');
        toast.warning('Configure e-mails dos aprovadores na etapa para envio automático.');
      }
    }

    // 4. Gerar e subir PDF para a nuvem (storage + Google Drive)
    toast.info('Gerando PDF...', { id: 'pdf-send' });
    const rdoParaPdf = { ...(rdoLive || currentRdo), status: 'Aguardando Aprovação' };
    const [pdfPath, driveResult] = await Promise.all([
      uploadRdoPdf({ rdo: rdoParaPdf, obra, efetivo, equipamentos, servicos, fotos, assinaturas }),
      saveToDrive({ rdo: rdoParaPdf, obra, efetivo, equipamentos, servicos, fotos, assinaturas }),
    ]);
    if (pdfPath) {
      setRdoLive((prev: any) => ({ ...(prev || currentRdo), pdf_path: pdfPath }));
    }
    if (driveResult.driveLink) {
      toast.success('PDF salvo no sistema e no Google Drive! ☁️', { id: 'pdf-send' });
    } else {
      toast.success('PDF salvo no sistema! ☁️', { id: 'pdf-send' });
    }

    // 5. Recarrega a lista de RDOs para o histórico aparecer atualizado
    setConfirmingSend(false);
    setSending(false);
    onRefresh();
  };

  /** Gera PDF localmente e faz download direto */
  const handleExportPDF = async () => {
    if (!rdo || !obra) return;
    try {
      toast.info('Gerando PDF...');
      const currentRdo = rdoLive || rdo;
      const blob = await generateRdoPdfBlob({ rdo: currentRdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas });
      const dataFmt = format(new Date(currentRdo.data + 'T12:00:00'), 'yyyy-MM-dd');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RDO_${obra.nome}_${dataFmt}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF baixado!');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  /** Gera PDF e abre pré-visualização em iframe */
  const handlePreviewPDF = async () => {
    if (!rdo || !obra) return;
    setGeneratingPreview(true);
    try {
      const currentRdo = rdoLive || rdo;
      const blob = await generateRdoPdfBlob({ rdo: currentRdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas });
      // Revoga URL anterior se existir
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(blob));
    } catch {
      toast.error('Erro ao gerar prévia do PDF');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleClosePreview = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
  };

  /** Envia PDF para a nuvem (storage + Google Drive) — atualiza o arquivo existente */
  const handleUploadPdfToCloud = async () => {
    if (!rdo || !obra) return;
    setUploadingPdf(true);
    toast.info('Salvando PDF na nuvem...', { id: 'pdf-cloud' });
    const currentRdo = rdoLive || rdo;

    const [path, driveResult] = await Promise.all([
      uploadRdoPdf({ rdo: currentRdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas }),
      saveToDrive({ rdo: currentRdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas }),
    ]);

    if (path) {
      setRdoLive((prev: any) => ({ ...(prev || currentRdo), pdf_path: path }));
      onRefresh();
    }

    if (driveResult.driveLink) {
      toast.success('PDF salvo no sistema e no Google Drive! ☁️', { id: 'pdf-cloud' });
    } else if (path) {
      toast.success('PDF salvo na nuvem! ☁️', { id: 'pdf-cloud' });
      if (driveResult.error) console.error('[Drive]', driveResult.error);
    } else {
      toast.error('Erro ao salvar PDF na nuvem', { id: 'pdf-cloud' });
    }
    setUploadingPdf(false);
  };

  /** Baixa o PDF da nuvem (URL assinada) */
  const handleDownloadCloud = async () => {
    const currentRdo = rdoLive || rdo;
    const pdfPath = currentRdo?.pdf_path;
    if (!pdfPath) { toast.error('Nenhum PDF salvo na nuvem para este RDO'); return; }
    setDownloadingCloud(true);
    const signedUrl = await getRdoPdfSignedUrl(pdfPath);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    } else {
      toast.error('Erro ao obter link de download');
    }
    setDownloadingCloud(false);
  };

  if (!rdo) return null;
  const dataFormatada = rdo.data ? format(new Date(rdo.data + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';
  const totalPessoas = efetivo.reduce((s, e) => s + (e.quantidade || 0), 0);
  const totalEquipamentos = equipamentos.reduce((s, e) => s + (e.horas_trabalhadas || 0), 0);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {obra?.nome || 'Carregando...'}
            {rdo.numero_rdo && <span className="text-muted-foreground font-normal ml-2">#{rdo.numero_rdo}</span>}
          </DialogTitle>
          <p className="text-sm font-semibold text-primary capitalize">{dataFormatada}</p>
        </DialogHeader>

        {/* Banner de confirmação de envio — aparece quando vem direto do formulário */}
        {confirmingSend && (
          <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">Confira os dados antes de enviar para aprovação</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                  Revise as informações abaixo. Quando estiver tudo correto, clique em <strong>"Confirmar e Enviar"</strong> para disparar os e-mails e WhatsApp aos aprovadores.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => { setConfirmingSend(false); onEdit(); }}
                disabled={sending}
              >
                <Pencil className="w-3.5 h-3.5" />
                Voltar e Editar
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleConfirmAndSend}
                disabled={sending}
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Enviando...' : 'Confirmar e Enviar'}
              </Button>
            </div>
          </div>
        )}

        {/* Dados Contratuais */}
        {obra && (obra.data_inicio_contrato || obra.prazo_contratual_dias || obra.data_publicacao) && (
          <div className="space-y-2">
            {/* Linha 1: Publicação, Vigência Inicial, Vigência Final */}
            {(obra.data_publicacao || obra.vigencia_inicial || obra.vigencia_final) && (
              <div className="grid grid-cols-3 gap-3 border rounded-lg p-3 bg-muted/20">
                {obra.data_publicacao && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Data da Publicação</p>
                    <p className="text-sm font-semibold">{format(new Date(obra.data_publicacao + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                  </div>
                )}
                {obra.vigencia_inicial && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Vigência Inicial</p>
                    <p className="text-sm font-semibold">{format(new Date(obra.vigencia_inicial + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                  </div>
                )}
                {obra.vigencia_final && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Vigência Final</p>
                    <p className="text-sm font-semibold">{format(new Date(obra.vigencia_final + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Linha 2: Data da OS, Prazo Contratual, Prazo Inicial Contratual */}
            <div className="grid grid-cols-3 gap-3 border rounded-lg p-3 bg-muted/20">
              {obra.data_inicio_contrato && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Data da OS</p>
                  <p className="text-sm font-semibold">{format(new Date(obra.data_inicio_contrato + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                </div>
              )}
              {obra.prazo_contratual_dias && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Prazo Contratual (dias)</p>
                  <p className="text-sm font-semibold">{obra.prazo_contratual_dias}</p>
                </div>
              )}
              {obra.data_prazo_contratual && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Prazo Inicial Contratual</p>
                  <p className="text-sm font-semibold">{format(new Date(obra.data_prazo_contratual + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                </div>
              )}
            </div>

            {/* Linha 3: Aditivos e Paralisações */}
            {(prazosHoje?.diasAditados || prazosHoje?.diasParalisados || prazosHoje?.novoPrazo) && (
              <div className="grid grid-cols-3 gap-3 border rounded-lg p-3 bg-amber-500/10">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Dias Aditados</p>
                  <p className="text-sm font-semibold">{prazosHoje?.diasAditados || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Dias Paralisados</p>
                  <p className="text-sm font-semibold">{prazosHoje?.diasParalisados || 0}</p>
                </div>
                {prazosHoje?.novoPrazo && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Novo Prazo Contratual</p>
                    <p className="text-sm font-semibold">{format(prazosHoje.novoPrazo, 'dd/MM/yyyy')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Linha 4: Prazos dinâmicos (atualizados diariamente) */}
            {prazosHoje && (prazosHoje.decorrido !== null || prazosHoje.restante !== null || prazosHoje.restanteVigencia !== null) && (
              <div className="grid grid-cols-3 gap-3 border rounded-lg p-3 bg-primary/5">
                {prazosHoje.decorrido !== null && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Prazo Decorrido</p>
                    <p className="text-sm font-bold">{prazosHoje.decorrido} dias</p>
                  </div>
                )}
                {prazosHoje.restante !== null && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Prazo Restante</p>
                    <p className={`text-sm font-bold ${prazosHoje.restante <= 30 ? 'text-destructive' : ''}`}>{prazosHoje.restante} dias</p>
                  </div>
                )}
                {prazosHoje.restanteVigencia !== null && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Prazo Restante Vigência</p>
                    <p className={`text-sm font-bold ${prazosHoje.restanteVigencia <= 30 ? 'text-destructive' : ''}`}>{prazosHoje.restanteVigencia} dias</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Clima */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Manhã</p>
            <p className="font-semibold text-sm">{rdo.clima_manha}</p>
            {rdo.temperatura_manha && <p className="text-xs text-muted-foreground">{rdo.temperatura_manha}°C</p>}
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Tarde</p>
            <p className="font-semibold text-sm">{rdo.clima_tarde}</p>
            {rdo.temperatura_tarde && <p className="text-xs text-muted-foreground">{rdo.temperatura_tarde}°C</p>}
          </div>
        </div>

        {/* Pluviometria + Condição */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[hsl(210,70%,32%)] rounded-lg p-3 text-center">
            <p className="text-[10px] font-bold text-blue-200 mb-1">PRECIPITAÇÃO DO DIA</p>
            <p className="font-bold text-sm text-white">{rdo.precipitacao_dia ?? 0} mm</p>
          </div>
          <div className="bg-[hsl(160,72%,27%)] rounded-lg p-3 text-center">
            <p className="text-[10px] font-bold text-emerald-200 mb-1">ACUMULADA NO MÊS</p>
            <p className="font-bold text-sm text-white">{rdo.precipitacao_acumulada_mes ?? 0} mm</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${
            rdo.condicao_tempo === 'Impraticável' ? 'bg-red-700' : 
            rdo.condicao_tempo === 'Instável' ? 'bg-amber-600' : 'bg-emerald-700'
          }`}>
            <p className="text-[10px] font-bold text-white/70 mb-1">CONDIÇÃO DO TEMPO</p>
            <p className="font-bold text-sm text-white">{rdo.condicao_tempo || 'Bom'}</p>
          </div>
        </div>

        {/* Mão de Obra */}
        {efetivo.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">👷 Mão de Obra — Total: {totalPessoas} pessoas</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {efetivo.map((e, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-border/50 py-0.5">
                  <span className="text-xs text-muted-foreground">{e.funcao}</span>
                  <span className="font-medium text-xs">{e.quantidade}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equipamentos */}
        {equipamentos.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">🚜 Equipamentos — Total: {totalEquipamentos} unidades</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {equipamentos.map((e, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-border/50 py-0.5">
                  <span className="text-xs text-muted-foreground">{e.equipamento}{e.prefixo ? ` (${e.prefixo})` : ''}</span>
                  <span className="font-medium text-xs">{e.horas_trabalhadas}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Serviços */}
        {servicos.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">🔧 Serviços Executados</h4>
            <div className="space-y-1">
              {servicos.map((s, i) => (
                <div key={i} className="text-sm border-b pb-1">
                  <p className="font-medium">{s.descricao}</p>
                  <p className="text-muted-foreground text-xs">{s.local_servico ? `Local: ${s.local_servico} · ` : ''}{s.quantidade_executada ? `Exec: ${s.quantidade_executada} ${s.unidade || ''}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comentários */}
        {(rdo.comentarios_construtora || rdo.comentarios_gerenciadora || rdo.comentarios_fiscalizacao) && (
          <div className="space-y-2">
            {rdo.comentarios_construtora && (
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">Comentários da Construtora</p>
                <p className="text-sm">{rdo.comentarios_construtora}</p>
              </div>
            )}
            {rdo.comentarios_gerenciadora && (
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">Comentários da Gerenciadora</p>
                <p className="text-sm">{rdo.comentarios_gerenciadora}</p>
              </div>
            )}
            {rdo.comentarios_fiscalizacao && (
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">Comentários da Fiscalização</p>
                <p className="text-sm">{rdo.comentarios_fiscalizacao}</p>
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        {fotos.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">📷 Fotos da Obra ({fotos.length})</h4>
            <div className="grid grid-cols-2 gap-2">
              {fotos.map((f, i) => (
                <div key={i} className="rounded-lg overflow-hidden border">
                  <img
                    src={f.signedUrl}
                    alt={f.legenda || `Foto ${i + 1}`}
                    className="w-full aspect-video object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {f.legenda && (
                    <p className="text-xs text-muted-foreground px-2 py-1 bg-muted/30">{f.legenda}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Aprovações — atualizado em tempo real */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">✍️ Aprovações</h4>
              {/* Indicador de conexão realtime */}
              <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                isLive ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'
              }`}>
                <Wifi className="w-3 h-3" />
                {isLive ? 'Ao vivo' : 'Conectando...'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[1, 2, 3].map(n => {
              const nome = obra?.[`aprovador${n}_nome`];
              const cargo = obra?.[`aprovador${n}_cargo`];
              const liveRdo = rdoLive || rdo;
              const status = liveRdo[`aprovacao${n}_status`] || 'Pendente';
              const cfg = apStatus(status);
              const StatusIcon = cfg.icon;
              const obsAprovador = liveRdo[`aprovacao${n}_observacao`];
              const dataAss = liveRdo[`aprovacao${n}_data`];
              const labels = ['Construtora', 'Gerenciadora', 'Fiscalização'];
              return (
                <div key={n} className="rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{labels[n - 1]}</p>
                        <p className="text-sm font-medium">{nome || <span className="text-muted-foreground italic text-xs">Não cadastrado</span>}</p>
                        {cargo && <p className="text-xs text-muted-foreground">{cargo}</p>}
                        {dataAss && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(dataAss), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      {liveRdo[`aprovacao${n}_token`] && liveRdo.status !== 'Aprovado' && (
                        <Button variant="outline" size="sm" className="gap-1 text-primary" onClick={() => handleSendWhatsApp(n as 1 | 2 | 3)}>
                          <MessageCircle className="w-3.5 h-3.5" />
                          Reenviar
                        </Button>
                      )}
                    </div>
                  </div>
                  {obsAprovador && (
                    <div className="bg-muted/40 px-3 py-2 border-t">
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">💬 Comentário do aprovador:</p>
                      <p className="text-sm italic">"{obsAprovador}"</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {/* Botão principal: Enviar para Assinaturas */}
          {(rdoLive || rdo)?.status !== 'Aprovado' && (rdoLive || rdo)?.status !== 'Reprovado' && (
            <Button
              onClick={handleSendAllApprovers}
              disabled={sending || uploadingPdf}
              className="w-full gap-2 h-11 text-base"
            >
              <Send className="w-4 h-4" />
              {sending
                ? 'Salvando PDF e abrindo WhatsApp...'
                : (rdoLive || rdo)?.status === 'Rascunho'
                ? 'Enviar para Assinaturas via WhatsApp'
                : 'Reenviar Links de Assinatura'}
            </Button>
          )}

          {/* Linha PDF na nuvem */}
          <div className="flex gap-2">
            {/* Baixar PDF da nuvem (quando já existe) */}
            {(rdoLive || rdo)?.pdf_path ? (
              <Button
                variant="outline"
                onClick={handleDownloadCloud}
                disabled={downloadingCloud}
                className="gap-2 flex-1 text-primary border-primary/30 hover:bg-primary/5"
              >
                <CloudDownload className="w-4 h-4" />
                {downloadingCloud ? 'Obtendo link...' : 'Baixar PDF da Nuvem'}
              </Button>
            ) : null}

            {/* Atualizar PDF na nuvem manualmente */}
            <Button
              variant="outline"
              onClick={handleUploadPdfToCloud}
              disabled={uploadingPdf}
              className="gap-2 flex-1"
            >
              <Cloud className="w-4 h-4" />
              {uploadingPdf ? 'Salvando...' : (rdoLive || rdo)?.pdf_path ? 'Atualizar PDF na Nuvem' : 'Salvar PDF na Nuvem'}
            </Button>
          </div>

          {/* Linha de ações secundárias */}
          <div className="flex gap-2">
            {(rdoLive || rdo)?.status === 'Rascunho' && (
              <Button variant="outline" onClick={onEdit} className="gap-2 flex-1">
                <Pencil className="w-4 h-4" /> Editar
              </Button>
            )}
            <Button variant="outline" onClick={handleExportPDF} className="gap-2 flex-1">
              <Download className="w-4 h-4" /> Baixar PDF
            </Button>
            <Button
              variant="outline"
              onClick={handlePreviewPDF}
              disabled={generatingPreview}
              className="gap-2 flex-1 text-primary border-primary/30 hover:bg-primary/5"
            >
              <Eye className="w-4 h-4" />
              {generatingPreview ? 'Gerando...' : 'Prévia PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Modal de pré-visualização do PDF (fullscreen) ─────────────────── */}
    {!!pdfPreviewUrl && (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 shadow-sm">
          <h2 className="text-base font-semibold truncate">
            Pré-visualização do PDF — {obra?.nome}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Baixar
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClosePreview}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <iframe
          src={pdfPreviewUrl}
          className="flex-1 w-full border-0"
          title="Prévia do RDO em PDF"
        />
      </div>
    )}
    </>
  );
}

