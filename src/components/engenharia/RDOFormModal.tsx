import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Send, Camera, X, RotateCcw, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────────────
interface MaoObraRow { funcao: string; quantidade: number; }
interface EquipRow { equipamento: string; quantidade: number; }
interface ServicoRow { descricao: string; local_servico: string; unidade: string; quantidade_prevista: number; quantidade_executada: number; }
interface FotoItem { id?: string; storage_path: string; legenda: string; previewUrl?: string; file?: File; toDelete?: boolean; }

// ── Funções de MO pré-definidas (baseadas no PDF) ──────────────────────────
const FUNCOES_MO = [
  'Almoxarife', 'Apontador', 'Aprendiz / Assist. Adm.', 'Aux. Laboratório',
  'Aux. Administrativo', 'Aux. Mecânica', 'Aux. Topografia', 'Borracheiro', 'Carpinteiro', 'Controlador Manut.',
  'Eletricista de Auto', 'Enc. Adm.', 'Enc. Terraplenagem', 'Enc. Laboratório',
  'Frentista', 'Greidista', 'Laboratorista', 'Lubrificador', 'Mecânico',
  'Nivelador N1', 'Pedreiro', 'Servente', 'Tec. Seg.', 'Topógrafo', 'Vigia',
  'Operadores', 'Motoristas', 'Engenheiro', 'Enc. Geral', 'Enc. Serv. Gerais', 'Enc. Mecânica',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

// ── Funções de MO Terceirizada pré-definidas ───────────────────────────────
const FUNCOES_MO_TERC = [
  'Caminhão Comboio', 'Caminhão Pipa', 'Engenheiro', 'Escavadeira Hidr.',
  'Lubrificador', 'Mecânico', 'Moto Bomba', 'Motorista',
  'Ônibus', 'Operador', 'Retro Escavadeira', 'Rolo Compactador',
  'Trator de Esteira', 'Trator de Pneu', 'Vigia',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

// ── Equipamentos pré-definidos (baseados no PDF) ───────────────────────────
const EQUIPAMENTOS = [
  'Veículos Leves', 'Caminhão Basculante', 'Motoniveladora', 'Escavadeira Hidráulica',
  'Rolo Compactador', 'Retroescavadeira', 'Caminhão Pipa', 'Trator de Pneu',
  'Trator de Esteira', 'Ônibus', 'Caminhão Comboio', 'Moto Bomba',
  'Plataforma Elevatória', 'Guindaste', 'Compactador de Solo', 'Vibrador de Concreto',
  'Betoneira', 'Bomba de Concreto', 'Caminhão Munck', 'Usina de Asfalto', 'Recicladora',
];

// ── Condições de tempo ─────────────────────────────────────────────────────
const CONDICOES_TEMPO = ['Bom', 'Instável', 'Impraticável'];

// ── Auto-classificação por precipitação ────────────────────────────────────
const getCondicaoByPrecipitacao = (mm: number): string => {
  if (mm <= 3) return 'Bom';
  if (mm <= 7) return 'Instável';
  return 'Impraticável';
};

const defaultMO = (): MaoObraRow[] => FUNCOES_MO.map(funcao => ({ funcao, quantidade: 0 }));
const defaultMOTerc = (): MaoObraRow[] => FUNCOES_MO_TERC.map(funcao => ({ funcao, quantidade: 0 }));
const defaultEquip = (): EquipRow[] => EQUIPAMENTOS.map(equipamento => ({ equipamento, quantidade: 0 }));

export function RDOFormModal({ open, onOpenChange, rdo, obras, onSaved, onRequestSend, onDraftPreview }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rdo: any;
  obras: { id: string; nome: string }[];
  onSaved: () => void;
  onRequestSend?: (rdoId: string) => void;
  onDraftPreview?: (rdoId: string) => void;
}) {
  const { user } = useAuth();
  const { readSheet } = useGoogleSheets();
  const isEdit = !!rdo?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campos gerais
  const [obraId, setObraId] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [numeroRdo, setNumeroRdo] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [terminoPrevisto, setTerminoPrevisto] = useState('');
  const [prazoContratual, setPrazoContratual] = useState('');
  // Clima
  const [climaManha, setClimaManha] = useState('Bom');
  const [climaTarde, setClimaTarde] = useState('Bom');
  const [tempManha, setTempManha] = useState('');
  const [tempTarde, setTempTarde] = useState('');
  const [precipitacao, setPrecipitacao] = useState('0');
  const [precipitacaoAcumuladaMes, setPrecipitacaoAcumuladaMes] = useState('0');
  const [condicaoTempo, setCondicaoTempo] = useState('Bom');
  const [prazoRestanteVigenciaManual, setPrazoRestanteVigenciaManual] = useState<string | null>(null);
  // Comentários
  const [comentariosConstrutora, setComentariosConstrutora] = useState('');
  const [comentariosGerenciadora, setComentariosGerenciadora] = useState('');
  const [comentariosFiscalizacao, setComentariosFiscalizacao] = useState('');
  // Sub-records
  const [maoObra, setMaoObra] = useState<MaoObraRow[]>(defaultMO());
  const [maoObraTerc, setMaoObraTerc] = useState<MaoObraRow[]>(defaultMOTerc());
  const [equipamentos, setEquipamentos] = useState<EquipRow[]>(defaultEquip());
  const [servicos, setServicos] = useState<ServicoRow[]>([{ descricao: '', local_servico: '', unidade: '', quantidade_prevista: 0, quantidade_executada: 0 }]);
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [saving, setSaving] = useState(false);
  // Seletor de obra para pré-preenchimento
  const [obraFonte, setObraFonte] = useState<string>('auto'); // 'auto' = último RDO, ou obra_id específica
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  // Dados da etapa/obra selecionada (pré-preenchimento automático)
  const [obraData, setObraData] = useState<any>(null);

  // ── Calcular prazos automaticamente baseado nos dados da etapa ────────────
  const prazosCalculados = useMemo(() => {
    if (!obraData) return null;
    // Usar meio-dia para evitar problemas de timezone com datas sem horário
    const safeParseDate = (d: string | null) => d ? new Date(d + 'T12:00:00') : null;
    const hoje = safeParseDate(data) || new Date();
    const dataInicioCont = safeParseDate(obraData.data_inicio_contrato);
    const dataPrazo = safeParseDate(obraData.data_prazo_contratual);
    const vigFinal = safeParseDate(obraData.vigencia_final);
    const novoPrazoContratual = safeParseDate(obraData.novo_prazo_contratual);
    const diasAditados = obraData.dias_aditados || 0;
    const diasParalisados = obraData.dias_paralisados || 0;
    const prazoContr = obraData.prazo_contratual_dias || null;

    const decorrido = dataInicioCont ? Math.max(0, differenceInDays(hoje, dataInicioCont)) : null;
    const restante = prazoContr != null && decorrido != null ? Math.max(0, prazoContr - decorrido) : null;
    
    // Prazo Restante de Vigência: usar novo_prazo_contratual se existir, senão vigencia_final
    const dataReferencia = novoPrazoContratual || vigFinal;
    const restanteVigencia = dataReferencia ? differenceInDays(dataReferencia, hoje) : null;

    const novoPrazo = dataPrazo && (diasAditados || diasParalisados)
      ? new Date(dataPrazo.getTime() + (diasAditados + diasParalisados) * 86400000)
      : novoPrazoContratual;

    return { decorrido, restante, restanteVigencia, prazoContr, diasAditados, diasParalisados, novoPrazo,
      dataInicioCont, dataPrazo, vigFinal };
  }, [obraData, data]);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && rdo?.id) {
      // EDITAR: preenche com dados do RDO existente
      setObraId(rdo.obra_id || '');
      setData(rdo.data || format(new Date(), 'yyyy-MM-dd'));
      setNumeroRdo(rdo.numero_rdo || '');
      setDataInicio(rdo.data_inicio || '');
      setTerminoPrevisto(rdo.termino_previsto || '');
      setPrazoContratual(rdo.prazo_contratual?.toString() || '');
      setClimaManha(rdo.clima_manha || 'Bom');
      setClimaTarde(rdo.clima_tarde || 'Bom');
      setTempManha(rdo.temperatura_manha?.toString() || '');
      setTempTarde(rdo.temperatura_tarde?.toString() || '');
      setPrecipitacao(rdo.precipitacao_dia?.toString() || '0');
      setPrecipitacaoAcumuladaMes(rdo.precipitacao_acumulada_mes?.toString() || '0');
      setCondicaoTempo(rdo.condicao_tempo || 'Bom');
      setPrazoRestanteVigenciaManual(rdo.prazo_restante_vigencia != null ? rdo.prazo_restante_vigencia.toString() : null);
      setComentariosConstrutora(rdo.comentarios_construtora || '');
      setComentariosGerenciadora(rdo.comentarios_gerenciadora || '');
      setComentariosFiscalizacao(rdo.comentarios_fiscalizacao || '');
      loadSubRecords(rdo.id);
    } else if (open && !rdo?.id) {
      // NOVO RDO: pré-preenche com dados do último RDO salvo
      preencherComUltimoRdo();
    }
  }, [open, rdo]);

  // ── Buscar dados da etapa ao mudar a obra ────────────────────────────────
  useEffect(() => {
    if (!obraId) { setObraData(null); return; }
    const loadObra = async () => {
      const { data: obra } = await supabase.from('rdo_obras').select('*').eq('id', obraId).single();
      if (!obra) return;
      // Sempre preencher aprovadores vazios com dados de outras etapas ativas
      const hasMissing = [1, 2, 3].some(n => !obra[`aprovador${n}_nome`]);
      if (hasMissing) {
        const { data: outrasObras } = await supabase
          .from('rdo_obras')
          .select('*')
          .eq('status', 'Ativo')
          .neq('id', obra.id);
        if (outrasObras && outrasObras.length > 0) {
          for (const n of [1, 2, 3]) {
            if (!obra[`aprovador${n}_nome`]) {
              const fonte = outrasObras.find(o => o[`aprovador${n}_nome`]);
              if (fonte) {
                for (const campo of ['nome', 'email', 'whatsapp', 'cargo', 'cpf']) {
                  (obra as any)[`aprovador${n}_${campo}`] = fonte[`aprovador${n}_${campo}`];
                }
              }
            }
          }
        }
      }
      setObraData(obra);
    };
    loadObra();
  }, [obraId]);

  // ── Buscar precipitação automaticamente da planilha Pluviometria ────────
  const fetchPluviometria = useCallback(async (rdoDate: string) => {
    if (!rdoDate) return;
    try {
      console.log('[Pluviometria] Buscando dados para data:', rdoDate);
      const sheetData = await readSheet('Pluviometria');
      if (!sheetData || sheetData.length <= 1) {
        console.log('[Pluviometria] Nenhum dado encontrado na planilha');
        setPrecipitacao('0');
        setPrecipitacaoAcumuladaMes('0');
        return;
      }

      // Helper to parse any date string into { dia, mes, ano }
      const parseDateStr = (raw: string): { dia: number; mes: number; ano: number } | null => {
        if (!raw) return null;
        // Try dd/MM/yyyy or d/M/yyyy
        let parts = raw.split('/');
        if (parts.length === 3) {
          const dia = parseInt(parts[0]);
          const mes = parseInt(parts[1]);
          let ano = parseInt(parts[2]);
          if (ano < 100) ano += 2000; // 2-digit year
          if (dia && mes && ano) return { dia, mes, ano };
        }
        // Try yyyy-MM-dd (ISO)
        parts = raw.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          const ano = parseInt(parts[0]);
          const mes = parseInt(parts[1]);
          const dia = parseInt(parts[2]);
          if (dia && mes && ano) return { dia, mes, ano };
        }
        // Try dd-MM-yyyy
        if (parts.length === 3 && parts[2].length === 4) {
          const dia = parseInt(parts[0]);
          const mes = parseInt(parts[1]);
          const ano = parseInt(parts[2]);
          if (dia && mes && ano) return { dia, mes, ano };
        }
        // Try Date.parse as last resort
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          return { dia: d.getDate(), mes: d.getMonth() + 1, ano: d.getFullYear() };
        }
        return null;
      };

      // Robust number parser for BR format (1.500,50) and standard (1500.50)
      const parseNum = (v: any): number => {
        if (v == null || v === '') return 0;
        const s = String(v).trim();
        // If has both dot and comma, treat dot as thousands sep and comma as decimal
        if (s.includes('.') && s.includes(',')) {
          return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        }
        // If has only comma, treat as decimal
        if (s.includes(',')) {
          return parseFloat(s.replace(',', '.')) || 0;
        }
        return parseFloat(s) || 0;
      };

      const rows = sheetData.slice(1).map(r => ({
        raw: (r[0] || '').toString().trim(),
        parsed: parseDateStr((r[0] || '').toString().trim()),
        quantidade: parseNum(r[1]),
      }));

      // Parse RDO date
      const rdoParsed = parseISO(rdoDate);
      const rdoDia = rdoParsed.getDate();
      const rdoMes = rdoParsed.getMonth() + 1;
      const rdoAno = rdoParsed.getFullYear();

      console.log('[Pluviometria] Buscando dia:', rdoDia, '/', rdoMes, '/', rdoAno, 'em', rows.length, 'registros');
      if (rows.length > 0) {
        console.log('[Pluviometria] Exemplos da planilha:', rows.slice(0, 3).map(r => ({ raw: r.raw, parsed: r.parsed })));
      }

      // Find exact day match using parsed dates
      const matchDia = rows.find(r => {
        if (!r.parsed) return false;
        return r.parsed.dia === rdoDia && r.parsed.mes === rdoMes && r.parsed.ano === rdoAno;
      });
      if (matchDia) {
        console.log('[Pluviometria] Match encontrado:', matchDia.quantidade, 'mm');
        setPrecipitacao(matchDia.quantidade.toString());
      } else {
        console.log('[Pluviometria] Sem registro para este dia');
        setPrecipitacao('0');
      }

      // Calculate monthly accumulated (same month/year, up to and including rdoDate)
      let acumulado = 0;
      rows.forEach(r => {
        if (r.parsed && r.parsed.mes === rdoMes && r.parsed.ano === rdoAno && r.parsed.dia <= rdoDia) {
          acumulado += r.quantidade;
        }
      });
      console.log('[Pluviometria] Acumulado do mês:', acumulado);
      setPrecipitacaoAcumuladaMes(acumulado.toFixed(1));
    } catch (err) {
      console.error('[Pluviometria] Erro ao buscar:', err);
    }
  }, [readSheet]);

  useEffect(() => {
    if (!data || !open) return;
    // Small delay to ensure state is settled after prefill
    const timer = setTimeout(() => fetchPluviometria(data), 300);
    return () => clearTimeout(timer);
  }, [data, open, fetchPluviometria]);

  // Auto-classificar condição do tempo baseado na precipitação
  useEffect(() => {
    const mm = parseFloat(precipitacao) || 0;
    setCondicaoTempo(getCondicaoByPrecipitacao(mm));
  }, [precipitacao]);

  // Busca o último RDO (filtrado por obra se especificado) e pré-preenche
  const preencherComUltimoRdo = async (obraIdFiltro?: string) => {
    setData(format(new Date(), 'yyyy-MM-dd'));
    setNumeroRdo('');
    setFotos([]);
    setServicos([{ descricao: '', local_servico: '', unidade: '', quantidade_prevista: 0, quantidade_executada: 0 }]);
    setLoadingPrefill(true);

    let query = supabase
      .from('rdos')
      .select('*')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (obraIdFiltro && obraIdFiltro !== 'auto') {
      query = query.eq('obra_id', obraIdFiltro);
    }

    const { data: ultimoRdo } = await query.single();
    setLoadingPrefill(false);

    if (ultimoRdo) {
      setObraId(ultimoRdo.obra_id || '');
      setDataInicio(ultimoRdo.data_inicio || '');
      setTerminoPrevisto(ultimoRdo.termino_previsto || '');
      setPrazoContratual(ultimoRdo.prazo_contratual?.toString() || '');
      setClimaManha(ultimoRdo.clima_manha || 'Bom');
      setClimaTarde(ultimoRdo.clima_tarde || 'Bom');
      setTempManha(ultimoRdo.temperatura_manha?.toString() || '');
      setTempTarde(ultimoRdo.temperatura_tarde?.toString() || '');
      // precipitação será preenchida automaticamente pela planilha Pluviometria via useEffect
      setCondicaoTempo(ultimoRdo.condicao_tempo || 'Bom');
      setComentariosConstrutora(ultimoRdo.comentarios_construtora || '');
      setComentariosGerenciadora(ultimoRdo.comentarios_gerenciadora || '');
      setComentariosFiscalizacao(ultimoRdo.comentarios_fiscalizacao || '');
      await loadSubRecords(ultimoRdo.id, true);
    } else {
      setObraId(obraIdFiltro && obraIdFiltro !== 'auto' ? obraIdFiltro : '');
      setDataInicio(''); setTerminoPrevisto(''); setPrazoContratual('');
      setClimaManha('Bom'); setClimaTarde('Bom'); setTempManha(''); setTempTarde('');
      setPrecipitacao('0'); setCondicaoTempo('Bom');
      setComentariosConstrutora(''); setComentariosGerenciadora(''); setComentariosFiscalizacao('');
      setMaoObra(defaultMO()); setMaoObraTerc(defaultMOTerc()); setEquipamentos(defaultEquip());
    }
  };

  const loadSubRecords = async (rdoId: string, skipFotos = false) => {
    const [{ data: ef }, { data: eq }, { data: sv }, { data: ft }] = await Promise.all([
      supabase.from('rdo_efetivo').select('*').eq('rdo_id', rdoId),
      supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdoId),
      supabase.from('rdo_servicos').select('*').eq('rdo_id', rdoId),
      supabase.from('rdo_fotos').select('*').eq('rdo_id', rdoId).order('created_at'),
    ]);

    // Rebuild MO grid from saved data — separar própria e terceirizada
    const moGrid = defaultMO();
    const moTercGrid = defaultMOTerc();
    if (ef && ef.length > 0) {
      ef.forEach((row: any) => {
        if (row.empresa === 'Terceirizada') {
          const idx = moTercGrid.findIndex(r => r.funcao === row.funcao);
          if (idx >= 0) moTercGrid[idx].quantidade = row.quantidade;
          else moTercGrid.push({ funcao: row.funcao, quantidade: row.quantidade });
        } else {
          const idx = moGrid.findIndex(r => r.funcao === row.funcao);
          if (idx >= 0) moGrid[idx].quantidade = row.quantidade;
          else moGrid.push({ funcao: row.funcao, quantidade: row.quantidade });
        }
      });
    }
    setMaoObra(moGrid);
    setMaoObraTerc(moTercGrid);

    // Rebuild Equip grid from saved data
    const eqGrid = defaultEquip();
    if (eq && eq.length > 0) {
      eq.forEach((row: any) => {
        const idx = eqGrid.findIndex(r => r.equipamento === row.equipamento);
        if (idx >= 0) eqGrid[idx].quantidade = row.horas_trabalhadas ?? row.quantidade ?? 0;
        else eqGrid.push({ equipamento: row.equipamento, quantidade: row.horas_trabalhadas ?? 0 });
      });
    }
    setEquipamentos(eqGrid);

    // Servicos — sempre carrega (inclusive no pré-preenchimento)
    if (sv && sv.length > 0) {
      setServicos(sv.map((s: any) => ({
        descricao: s.descricao || '',
        local_servico: s.local_servico || '',
        unidade: s.unidade || '',
        quantidade_prevista: s.quantidade_prevista || 0,
        quantidade_executada: s.quantidade_executada || 0,
      })));
    } else if (!skipFotos) {
      // Só reseta se for edição (não pré-preenchimento)
    }

    // Fotos — só carrega ao editar (não no pré-preenchimento)
    if (!skipFotos) {
      if (ft && ft.length > 0) {
        const fotosWithUrls = await Promise.all((ft as any[]).map(async (f: any) => {
          const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(f.storage_path, 3600);
          return { id: f.id, storage_path: f.storage_path, legenda: f.legenda || '', previewUrl: signed?.signedUrl };
        }));
        setFotos(fotosWithUrls);
      } else {
        setFotos([]);
      }
    }
  };

  // ── Foto handlers ───────────────────────────────────────────────────────
  const handleAddFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFotos(prev => [...prev, ...files.map(file => ({ storage_path: '', legenda: '', previewUrl: URL.createObjectURL(file), file }))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFoto = (i: number) => {
    setFotos(prev => {
      const f = prev[i];
      if (f.id) return prev.map((item, idx) => idx === i ? { ...item, toDelete: true } : item);
      if (f.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const updateLegenda = (i: number, val: string) => setFotos(prev => prev.map((f, idx) => idx === i ? { ...f, legenda: val } : f));

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (send = false) => {
    if (!obraId) { toast.error('Selecione uma etapa'); return; }
    if (!data) { toast.error('Informe a data'); return; }
    setSaving(true);

    const rdoPayload: any = {
      obra_id: obraId, data,
      numero_rdo: numeroRdo || null,
      data_inicio: obraData?.data_inicio_contrato || null,
      termino_previsto: obraData?.data_prazo_contratual || null,
      prazo_contratual: obraData?.prazo_contratual_dias || null,
      prazo_decorrido: prazosCalculados?.decorrido ?? null,
      prazo_restante: prazosCalculados?.restante ?? null,
      prazo_restante_vigencia: prazoRestanteVigenciaManual !== null ? parseInt(prazoRestanteVigenciaManual) || 0 : (prazosCalculados?.restanteVigencia ?? null),
      novo_prazo_contratual: prazosCalculados?.novoPrazo ? format(prazosCalculados.novoPrazo, 'yyyy-MM-dd') : null,
      clima_manha: climaManha, clima_tarde: climaTarde,
      temperatura_manha: tempManha ? parseFloat(tempManha) : null,
      temperatura_tarde: tempTarde ? parseFloat(tempTarde) : null,
      precipitacao_dia: parseFloat(precipitacao) || 0,
      precipitacao_acumulada_mes: parseFloat(precipitacaoAcumuladaMes) || 0,
      condicao_tempo: condicaoTempo,
      comentarios_construtora: comentariosConstrutora || null,
      comentarios_gerenciadora: comentariosGerenciadora || null,
      comentarios_fiscalizacao: comentariosFiscalizacao || null,
      observacoes: comentariosConstrutora || null, // backward compat
      status: 'Rascunho', // sempre salva como rascunho; o envio é confirmado na visualização
      created_by: user!.id,
    };

    let rdoId = rdo?.id;
    let err: any;

    if (isEdit) {
      const { error } = await supabase.from('rdos').update(rdoPayload).eq('id', rdoId);
      err = error;
    } else {
      const { data: newRdo, error } = await supabase.from('rdos').insert(rdoPayload).select().single();
      err = error;
      if (newRdo) rdoId = newRdo.id;
    }

    if (err) { toast.error('Erro ao salvar RDO'); setSaving(false); return; }

    await Promise.all([
      // Mão de obra: save própria + terceirizada
      (async () => {
        await supabase.from('rdo_efetivo').delete().eq('rdo_id', rdoId);
        const rowsPropria = maoObra.filter(r => r.quantidade > 0).map(r => ({
          rdo_id: rdoId, empresa: 'Própria', funcao: r.funcao, quantidade: r.quantidade, periodo: 'Dia Completo'
        }));
        const rowsTerc = maoObraTerc.filter(r => r.quantidade > 0).map(r => ({
          rdo_id: rdoId, empresa: 'Terceirizada', funcao: r.funcao, quantidade: r.quantidade, periodo: 'Dia Completo'
        }));
        const allRows = [...rowsPropria, ...rowsTerc];
        if (allRows.length > 0) await supabase.from('rdo_efetivo').insert(allRows);
      })(),
      // Equipamentos: save only rows with quantidade > 0
      (async () => {
        await supabase.from('rdo_equipamentos').delete().eq('rdo_id', rdoId);
        const rows = equipamentos.filter(r => r.quantidade > 0).map(r => ({
          rdo_id: rdoId, equipamento: r.equipamento, prefixo: null,
          horas_trabalhadas: r.quantidade, status: 'Operando', observacao: null
        }));
        if (rows.length > 0) await supabase.from('rdo_equipamentos').insert(rows);
      })(),
      // Serviços
      (async () => {
        await supabase.from('rdo_servicos').delete().eq('rdo_id', rdoId);
        const rows = servicos.filter(s => s.descricao).map(s => ({
          rdo_id: rdoId,
          descricao: s.descricao,
          local_servico: s.local_servico || null,
          unidade: s.unidade || null,
          quantidade_prevista: s.quantidade_prevista || null,
          quantidade_executada: s.quantidade_executada || null,
        }));
        if (rows.length > 0) await supabase.from('rdo_servicos').insert(rows);
      })(),
      // Fotos
      (async () => {
        const toDelete = fotos.filter(f => f.toDelete && f.id);
        for (const f of toDelete) {
          await supabase.storage.from('rdo-fotos').remove([f.storage_path]);
          await supabase.from('rdo_fotos').delete().eq('id', f.id!);
        }
        const toUpload = fotos.filter(f => !f.id && !f.toDelete && f.file);
        for (const f of toUpload) {
          const ext = f.file!.name.split('.').pop();
          const path = `${rdoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage.from('rdo-fotos').upload(path, f.file!);
          if (!upErr) await supabase.from('rdo_fotos').insert({ rdo_id: rdoId, storage_path: path, legenda: f.legenda || null });
        }
        const toUpdateLegend = fotos.filter(f => f.id && !f.toDelete);
        for (const f of toUpdateLegend) {
          await supabase.from('rdo_fotos').update({ legenda: f.legenda || null }).eq('id', f.id!);
        }
      })(),
    ]);

    // ── Sincronizar pluviometria com RDOs de outras etapas na mesma data ──
    try {
      const precipDia = parseFloat(precipitacao) || 0;
      const precipAcum = parseFloat(precipitacaoAcumuladaMes) || 0;
      const condTempo = condicaoTempo;

      // Buscar RDOs de outras etapas com a mesma data
      const { data: rdosMesmaData } = await supabase
        .from('rdos')
        .select('id')
        .eq('data', data)
        .neq('id', rdoId);

      if (rdosMesmaData && rdosMesmaData.length > 0) {
        const ids = rdosMesmaData.map(r => r.id);
        await supabase
          .from('rdos')
          .update({
            precipitacao_dia: precipDia,
            precipitacao_acumulada_mes: precipAcum,
            condicao_tempo: condTempo,
          })
          .in('id', ids);
        console.log(`[RDO Sync] Pluviometria sincronizada com ${ids.length} RDO(s) na data ${data}`);
      }
    } catch (syncErr) {
      console.error('[RDO Sync] Erro ao sincronizar pluviometria:', syncErr);
    }

    // ── Se "Enviar para Aprovação": salva como Rascunho e abre visualização para conferência ──
    if (send && rdoId && onRequestSend) {
      toast.success('RDO salvo! Confira os dados antes de disparar os envios.');
      onSaved();
      setSaving(false);
      onRequestSend(rdoId);
      return;
    }

    // ── Rascunho normal: salva e abre prévia do PDF ──
    toast.success('RDO salvo! Abrindo prévia...');
    onSaved();
    setSaving(false);
    if (rdoId && onDraftPreview) {
      onDraftPreview(rdoId);
    }
  };

  const updateMO = (i: number, val: number) => setMaoObra(prev => prev.map((r, idx) => idx === i ? { ...r, quantidade: val } : r));
  const updateMOTerc = (i: number, val: number) => setMaoObraTerc(prev => prev.map((r, idx) => idx === i ? { ...r, quantidade: val } : r));
  const updateEquip = (i: number, val: number) => setEquipamentos(prev => prev.map((r, idx) => idx === i ? { ...r, quantidade: val } : r));
  const updateServico = (i: number, field: keyof ServicoRow, val: any) => setServicos(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const visibleFotos = fotos.filter(f => !f.toDelete);
  const totalMO = maoObra.reduce((s, r) => s + (r.quantidade || 0), 0);
  const totalMOTerc = maoObraTerc.reduce((s, r) => s + (r.quantidade || 0), 0);
  const totalEquip = equipamentos.reduce((s, r) => s + (r.quantidade || 0), 0);

  // ── Split MO em 2 colunas como no PDF ──────────────────────────────────
  const half = Math.ceil(maoObra.length / 2);
  const moCol1 = maoObra.slice(0, half);
  const moCol2 = maoObra.slice(half);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
        <DialogTitle className="text-lg font-bold">
          {isEdit ? 'Editar RDO' : 'Novo Relatório Diário de Obra'}
        </DialogTitle>
        {/* Seletor de obra para pré-preenchimento — só aparece em novos RDOs */}
        {!isEdit && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">Pré-preencher com dados de:</span>
              <select
                value={obraFonte}
                onChange={e => {
                  setObraFonte(e.target.value);
                  preencherComUltimoRdo(e.target.value);
                }}
                className="text-xs h-7 rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0"
              >
                <option value="auto">Último RDO (qualquer etapa)</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              {loadingPrefill && <span className="text-xs text-muted-foreground animate-pulse">Carregando...</span>}
            </div>
            <button
              type="button"
              onClick={() => {
                // Busca especificamente o RDO do dia anterior (ontem)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                setLoadingPrefill(true);
                let q = supabase.from('rdos').select('*').eq('data', yesterdayStr).order('created_at', { ascending: false }).limit(1);
                if (obraFonte !== 'auto') q = q.eq('obra_id', obraFonte);
                q.single().then(({ data: rdoOntem }) => {
                  setLoadingPrefill(false);
                  if (rdoOntem) {
                    setObraId(rdoOntem.obra_id || '');
                    setDataInicio(rdoOntem.data_inicio || '');
                    setTerminoPrevisto(rdoOntem.termino_previsto || '');
                    setPrazoContratual(rdoOntem.prazo_contratual?.toString() || '');
                    setClimaManha(rdoOntem.clima_manha || 'Bom');
                    setClimaTarde(rdoOntem.clima_tarde || 'Bom');
                    setTempManha(rdoOntem.temperatura_manha?.toString() || '');
                    setTempTarde(rdoOntem.temperatura_tarde?.toString() || '');
                    setPrecipitacao(rdoOntem.precipitacao_dia?.toString() || '0');
                    setCondicaoTempo(rdoOntem.condicao_tempo || 'Bom');
                    setComentariosConstrutora(rdoOntem.comentarios_construtora || '');
                    setComentariosGerenciadora(rdoOntem.comentarios_gerenciadora || '');
                    setComentariosFiscalizacao(rdoOntem.comentarios_fiscalizacao || '');
                    loadSubRecords(rdoOntem.id, true);
                    toast.success(`Dados do dia anterior (${yesterdayStr.split('-').reverse().join('/')}) carregados!`);
                  } else {
                    toast.info('Nenhum RDO encontrado para o dia anterior.');
                  }
                });
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-md px-3 py-1.5 transition-colors w-full justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Repetir informações do dia anterior
            </button>
          </div>
        )}
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="mo">Mão de Obra</TabsTrigger>
            <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="comentarios" className="relative">
              Comentários
              {(comentariosConstrutora || comentariosGerenciadora || comentariosFiscalizacao) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger value="fotos" className="relative">
              Fotos
              {visibleFotos.length > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
                  {visibleFotos.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Geral ────────────────────────────────────────────── */}
          <TabsContent value="geral" className="space-y-4 pt-3">

            {/* Identificação */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Identificação</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Obra / Etapa *</Label>
                  <select
                    value={obraId}
                    onChange={e => setObraId(e.target.value)}
                    className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecione a obra</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Data do RDO *</Label>
                  <Input type="date" value={data} onChange={e => setData(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Nº do RDO</Label>
                  <Input value={numeroRdo} onChange={e => setNumeroRdo(e.target.value)} placeholder="Ex: 187" className="mt-1" />
                </div>
              </div>

              {/* Dados da etapa pré-preenchidos automaticamente */}
              {obraData && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Dados pré-preenchidos automaticamente da etapa cadastrada
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {obraData.contrato && (
                      <div>
                        <Label className="text-xs">Contrato</Label>
                        <Input readOnly value={obraData.contrato} className="mt-0.5 h-8 text-xs bg-muted/40 cursor-default" />
                      </div>
                    )}
                    {obraData.cliente && (
                      <div>
                        <Label className="text-xs">Cliente</Label>
                        <Input readOnly value={obraData.cliente} className="mt-0.5 h-8 text-xs bg-muted/40 cursor-default" />
                      </div>
                    )}
                    {obraData.responsavel && (
                      <div>
                        <Label className="text-xs">Responsável</Label>
                        <Input readOnly value={obraData.responsavel} className="mt-0.5 h-8 text-xs bg-muted/40 cursor-default" />
                      </div>
                    )}
                    {obraData.data_inicio_contrato && (
                      <div>
                        <Label className="text-xs">Início do Contrato</Label>
                        <Input readOnly value={format(parseISO(obraData.data_inicio_contrato), 'dd/MM/yyyy')} className="mt-0.5 h-8 text-xs bg-muted/40 cursor-default" />
                      </div>
                    )}
                    {obraData.data_prazo_contratual && (
                      <div>
                        <Label className="text-xs">Prazo Contratual</Label>
                        <Input readOnly value={format(parseISO(obraData.data_prazo_contratual), 'dd/MM/yyyy')} className="mt-0.5 h-8 text-xs bg-muted/40 cursor-default" />
                      </div>
                    )}
                    {obraData.vigencia_final && (
                      <div>
                        <Label className="text-xs">Vigência Final</Label>
                        <Input readOnly value={format(parseISO(obraData.vigencia_final), 'dd/MM/yyyy')} className="mt-0.5 h-8 text-xs bg-muted/40 cursor-default" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Prazos Calculados Automaticamente */}
            {prazosCalculados && (
              <div className="border rounded-lg p-4 space-y-3">
                <p className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Prazos — Calculados Automaticamente
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-muted/40 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Prazo Contratual</p>
                    <p className="text-xl font-bold text-foreground">{prazosCalculados.prazoContr ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">dias</p>
                  </div>
                  <div className="text-center p-3 bg-muted/40 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Decorrido</p>
                    <p className="text-xl font-bold text-blue-600">{prazosCalculados.decorrido ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">dias</p>
                  </div>
                  <div className={`text-center p-3 rounded-lg border ${(prazosCalculados.restante ?? 0) < 30 ? 'bg-red-50 border-red-200' : 'bg-muted/40'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Restante</p>
                    <p className={`text-xl font-bold ${(prazosCalculados.restante ?? 0) < 30 ? 'text-red-600' : 'text-green-600'}`}>
                      {prazosCalculados.restante ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">dias</p>
                  </div>
                  <div className={`text-center p-3 rounded-lg border ${((prazoRestanteVigenciaManual !== null ? parseInt(prazoRestanteVigenciaManual) : prazosCalculados.restanteVigencia) ?? 0) < 30 ? 'bg-red-50 border-red-200' : 'bg-muted/40'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Rest. Vigência</p>
                    <Input
                      type="number"
                      className="text-center text-xl font-bold h-auto py-0 border-dashed"
                      value={prazoRestanteVigenciaManual !== null ? prazoRestanteVigenciaManual : (prazosCalculados.restanteVigencia?.toString() ?? '')}
                      onChange={e => setPrazoRestanteVigenciaManual(e.target.value)}
                      onBlur={() => {
                        if (prazoRestanteVigenciaManual === '' || prazoRestanteVigenciaManual === prazosCalculados.restanteVigencia?.toString()) {
                          setPrazoRestanteVigenciaManual(null);
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">dias</p>
                  </div>
                </div>
                {(prazosCalculados.diasAditados > 0 || prazosCalculados.diasParalisados > 0) && (
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t">
                    {prazosCalculados.diasAditados > 0 && <span>+{prazosCalculados.diasAditados} dias aditados</span>}
                    {prazosCalculados.diasParalisados > 0 && <span>+{prazosCalculados.diasParalisados} dias paralisados</span>}
                    {prazosCalculados.novoPrazo && <span className="font-medium text-foreground">Novo prazo: {format(prazosCalculados.novoPrazo, 'dd/MM/yyyy')}</span>}
                  </div>
                )}
              </div>
            )}

            {/* Clima */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Condições Climáticas</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Clima Manhã</Label>
                  <select value={climaManha} onChange={e => setClimaManha(e.target.value)} className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {['Bom', 'Parcialmente Nublado', 'Nublado', 'Chuvoso'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input className="mt-1" type="number" value={tempManha} onChange={e => setTempManha(e.target.value)} placeholder="Temp. manhã (°C)" />
                </div>
                <div>
                  <Label className="text-xs">Clima Tarde</Label>
                  <select value={climaTarde} onChange={e => setClimaTarde(e.target.value)} className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {['Bom', 'Parcialmente Nublado', 'Nublado', 'Chuvoso'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input className="mt-1" type="number" value={tempTarde} onChange={e => setTempTarde(e.target.value)} placeholder="Temp. tarde (°C)" />
                </div>
                <div>
                  <Label className="text-xs">Precipitação do dia (mm)</Label>
                  <Input className="mt-1" type="number" step="0.1" value={precipitacao} onChange={e => setPrecipitacao(e.target.value)} placeholder="0" />
                  <Label className="text-xs mt-2 block flex items-center gap-1">
                    Precip. Acumulada no Mês (mm)
                    <span className="text-blue-500 font-normal">⟳ calculada automaticamente</span>
                  </Label>
                  <div className="relative">
                    <Input
                      className="mt-0.5 bg-blue-50 border-blue-300 focus-visible:ring-blue-400 pr-16"
                      type="number"
                      step="0.1"
                      value={precipitacaoAcumuladaMes}
                      onChange={e => setPrecipitacaoAcumuladaMes(e.target.value)}
                      placeholder="0"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-400 pointer-events-none mt-0.5">mm</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Soma dos RDOs desta obra no mês. Ajuste manualmente se necessário.
                  </p>
                  <div className="mt-2">
                    <Label className="text-xs">Condições Gerais</Label>
                    <div className="flex gap-2 mt-1">
                      {CONDICOES_TEMPO.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCondicaoTempo(c)}
                          className={`flex-1 text-xs py-1.5 px-2 rounded border transition-colors ${condicaoTempo === c ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-muted'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nota de acesso a comentários */}
            <div className="border border-dashed rounded-lg p-3 bg-muted/30 text-center text-sm text-muted-foreground">
              💬 Os comentários por papel estão na aba <span className="font-semibold text-foreground">Comentários</span>
            </div>
          </TabsContent>

          {/* ── Tab: Mão de Obra ─────────────────────────────────────── */}
          <TabsContent value="mo" className="pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Informe a quantidade de mão de obra <strong>própria</strong>. Itens com valor ficam destacados.</p>
              {(totalMO + totalMOTerc) > 0 && (
                <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">👷 {totalMO + totalMOTerc} pessoas</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0">
              {/* Coluna 1 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-1 mb-1 px-1">
                  <span>Função</span>
                  <span className="w-14 text-center">Qtd</span>
                </div>
                {moCol1.map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between py-1 px-1.5 rounded-md transition-colors ${
                      row.quantidade > 0
                        ? 'bg-primary/10 border border-primary/20'
                        : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                    }`}
                  >
                    <span className={`text-xs flex-1 ${row.quantidade > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{row.funcao}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateMO(i, Math.max(0, row.quantidade - 1))}
                        className="w-6 h-6 rounded bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center text-sm font-bold transition-colors"
                      >−</button>
                      <Input
                        type="number"
                        min={0}
                        value={row.quantidade || ''}
                        onChange={e => updateMO(i, parseInt(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                        className="w-12 h-7 text-xs text-center px-0.5 font-semibold"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => updateMO(i, row.quantidade + 1)}
                        className="w-6 h-6 rounded bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center text-sm font-bold transition-colors"
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Coluna 2 */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-1 mb-1 px-1">
                  <span>Função</span>
                  <span className="w-14 text-center">Qtd</span>
                </div>
                {moCol2.map((row, i) => {
                  const globalIdx = half + i;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between py-1 px-1.5 rounded-md transition-colors ${
                        row.quantidade > 0
                          ? 'bg-primary/10 border border-primary/20'
                          : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                      }`}
                    >
                      <span className={`text-xs flex-1 ${row.quantidade > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{row.funcao}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateMO(globalIdx, Math.max(0, row.quantidade - 1))}
                          className="w-6 h-6 rounded bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center text-sm font-bold transition-colors"
                        >−</button>
                        <Input
                          type="number"
                          min={0}
                          value={row.quantidade || ''}
                          onChange={e => updateMO(globalIdx, parseInt(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          className="w-12 h-7 text-xs text-center px-0.5 font-semibold"
                          placeholder="0"
                        />
                        <button
                          type="button"
                          onClick={() => updateMO(globalIdx, row.quantidade + 1)}
                          className="w-6 h-6 rounded bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center text-sm font-bold transition-colors"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 p-3 bg-primary/5 rounded-lg text-sm font-bold text-right border border-primary/20">
              TOTAL MÃO DE OBRA PRÓPRIA: {totalMO} pessoas
            </div>

            {/* ── Seção Terceirizada ──────────────────────────────── */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mão de Obra Terceirizada</p>
                {totalMOTerc > 0 && (
                  <span className="text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">🏗️ {totalMOTerc} terceirizados</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                {(() => {
                  const tercHalf = Math.ceil(maoObraTerc.length / 2);
                  const tercCol1 = maoObraTerc.slice(0, tercHalf);
                  const tercCol2 = maoObraTerc.slice(tercHalf);
                  return (
                    <>
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-1 mb-1 px-1">
                          <span>Função</span>
                          <span className="w-14 text-center">Qtd</span>
                        </div>
                        {tercCol1.map((row, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between py-1 px-1.5 rounded-md transition-colors ${
                              row.quantidade > 0
                                ? 'bg-orange-50 border border-orange-200'
                                : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                            }`}
                          >
                            <span className={`text-xs flex-1 ${row.quantidade > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{row.funcao}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => updateMOTerc(i, Math.max(0, row.quantidade - 1))}
                                className="w-6 h-6 rounded bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center text-sm font-bold transition-colors">−</button>
                              <Input type="number" min={0} value={row.quantidade || ''} onChange={e => updateMOTerc(i, parseInt(e.target.value) || 0)}
                                onFocus={e => e.target.select()} className="w-12 h-7 text-xs text-center px-0.5 font-semibold" placeholder="0" />
                              <button type="button" onClick={() => updateMOTerc(i, row.quantidade + 1)}
                                className="w-6 h-6 rounded bg-orange-200 hover:bg-orange-300 text-orange-700 flex items-center justify-center text-sm font-bold transition-colors">+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-1 mb-1 px-1">
                          <span>Função</span>
                          <span className="w-14 text-center">Qtd</span>
                        </div>
                        {tercCol2.map((row, i) => {
                          const globalIdx = tercHalf + i;
                          return (
                            <div
                              key={i}
                              className={`flex items-center justify-between py-1 px-1.5 rounded-md transition-colors ${
                                row.quantidade > 0
                                  ? 'bg-orange-50 border border-orange-200'
                                  : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                              }`}
                            >
                              <span className={`text-xs flex-1 ${row.quantidade > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{row.funcao}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => updateMOTerc(globalIdx, Math.max(0, row.quantidade - 1))}
                                  className="w-6 h-6 rounded bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center text-sm font-bold transition-colors">−</button>
                                <Input type="number" min={0} value={row.quantidade || ''} onChange={e => updateMOTerc(globalIdx, parseInt(e.target.value) || 0)}
                                  onFocus={e => e.target.select()} className="w-12 h-7 text-xs text-center px-0.5 font-semibold" placeholder="0" />
                                <button type="button" onClick={() => updateMOTerc(globalIdx, row.quantidade + 1)}
                                  className="w-6 h-6 rounded bg-orange-200 hover:bg-orange-300 text-orange-700 flex items-center justify-center text-sm font-bold transition-colors">+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="mt-3 p-3 bg-orange-50 rounded-lg text-sm font-bold text-right border border-orange-200">
                TOTAL TERCEIRIZADOS: {totalMOTerc} pessoas
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Equipamentos ────────────────────────────────────── */}
          <TabsContent value="equipamentos" className="pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Informe a quantidade de equipamentos utilizados no dia.</p>
              {totalEquip > 0 && (
                <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">🚜 {totalEquip} unidades</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0">
              {(() => {
                const eqHalf = Math.ceil(equipamentos.length / 2);
                const eqCol1 = equipamentos.slice(0, eqHalf);
                const eqCol2 = equipamentos.slice(eqHalf);
                return (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-1 mb-1 px-1">
                        <span>Equipamento</span>
                        <span className="w-14 text-center">Qtd</span>
                      </div>
                      {eqCol1.map((row, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between py-1 px-1.5 rounded-md transition-colors ${
                            row.quantidade > 0
                              ? 'bg-primary/10 border border-primary/20'
                              : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                          }`}
                        >
                          <span className={`text-xs flex-1 ${row.quantidade > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{row.equipamento}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateEquip(i, Math.max(0, row.quantidade - 1))}
                              className="w-6 h-6 rounded bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center text-sm font-bold transition-colors"
                            >−</button>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={row.quantidade || ''}
                              onChange={e => updateEquip(i, parseInt(e.target.value) || 0)}
                              onFocus={e => e.target.select()}
                              className="w-12 h-7 text-xs text-center px-0.5 font-semibold"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => updateEquip(i, row.quantidade + 1)}
                              className="w-6 h-6 rounded bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center text-sm font-bold transition-colors"
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b pb-1 mb-1 px-1">
                        <span>Equipamento</span>
                        <span className="w-14 text-center">Qtd</span>
                      </div>
                      {eqCol2.map((row, i) => {
                        const globalIdx = eqHalf + i;
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between py-1 px-1.5 rounded-md transition-colors ${
                              row.quantidade > 0
                                ? 'bg-primary/10 border border-primary/20'
                                : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
                            }`}
                          >
                            <span className={`text-xs flex-1 ${row.quantidade > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{row.equipamento}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => updateEquip(globalIdx, Math.max(0, row.quantidade - 1))}
                                className="w-6 h-6 rounded bg-muted hover:bg-muted-foreground/20 text-foreground flex items-center justify-center text-sm font-bold transition-colors"
                              >−</button>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={row.quantidade || ''}
                                onChange={e => updateEquip(globalIdx, parseInt(e.target.value) || 0)}
                                onFocus={e => e.target.select()}
                                className="w-12 h-7 text-xs text-center px-0.5 font-semibold"
                                placeholder="0"
                              />
                              <button
                                type="button"
                                onClick={() => updateEquip(globalIdx, row.quantidade + 1)}
                                className="w-6 h-6 rounded bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center text-sm font-bold transition-colors"
                              >+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="mt-3 p-3 bg-primary/5 rounded-lg text-sm font-bold text-right border border-primary/20">
              TOTAL EQUIPAMENTOS: {totalEquip} unidades
            </div>
          </TabsContent>

          {/* ── Tab: Serviços ────────────────────────────────────────── */}
          <TabsContent value="servicos" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">Serviços e atividades executadas no dia.</p>
            <div className="space-y-2">
              {servicos.map((row, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Textarea className="flex-1 min-h-[38px]" value={row.descricao} onChange={e => updateServico(i, 'descricao', e.target.value)} placeholder="Descrição do serviço executado" rows={2} />
                  <Button variant="ghost" size="icon" className="text-destructive shrink-0 mt-1" onClick={() => setServicos(prev => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setServicos(prev => [...prev, { descricao: '', local_servico: '', unidade: '', quantidade_prevista: 0, quantidade_executada: 0 }])}>
              <Plus className="w-4 h-4" /> Adicionar serviço
            </Button>
          </TabsContent>

          {/* ── Tab: Comentários ─────────────────────────────────────── */}
          <TabsContent value="comentarios" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Cada papel pode registrar seus comentários e observações independentemente.
            </p>

            {/* Construtora */}
            <div className="rounded-xl border-2 border-orange-200 bg-orange-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-orange-400" />
                <p className="font-semibold text-sm text-orange-800 uppercase tracking-wide">Construtora</p>
              </div>
              <Textarea
                value={comentariosConstrutora}
                onChange={e => setComentariosConstrutora(e.target.value)}
                placeholder="Comentários e observações da construtora..."
                rows={4}
                className="bg-white border-orange-200 focus-visible:ring-orange-400 resize-none"
              />
            </div>

            {/* Gerenciadora */}
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <p className="font-semibold text-sm text-blue-800 uppercase tracking-wide">Gerenciadora</p>
              </div>
              <Textarea
                value={comentariosGerenciadora}
                onChange={e => setComentariosGerenciadora(e.target.value)}
                placeholder="Comentários e observações da gerenciadora..."
                rows={4}
                className="bg-white border-blue-200 focus-visible:ring-blue-400 resize-none"
              />
            </div>

            {/* Fiscalização */}
            <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <p className="font-semibold text-sm text-green-800 uppercase tracking-wide">Fiscalização</p>
              </div>
              <Textarea
                value={comentariosFiscalizacao}
                onChange={e => setComentariosFiscalizacao(e.target.value)}
                placeholder="Comentários e observações da fiscalização..."
                rows={4}
                className="bg-white border-green-200 focus-visible:ring-green-500 resize-none"
              />
            </div>
          </TabsContent>

          {/* ── Tab: Fotos ───────────────────────────────────────────── */}
          <TabsContent value="fotos" className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Fotos do dia da obra (máx. 10MB por foto)</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-4 h-4" />
                Adicionar Fotos
              </Button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleAddFotos} />
            </div>
            {visibleFotos.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Clique para adicionar fotos da obra</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou WebP — máx. 10MB por foto</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {visibleFotos.map((foto, i) => {
                  const realIdx = fotos.indexOf(foto);
                  return (
                    <div key={i} className="border rounded-lg overflow-hidden bg-card">
                      <div className="relative aspect-video bg-muted">
                        <img src={foto.previewUrl} alt={foto.legenda || `Foto ${i + 1}`} className="w-full h-full object-cover" />
                        <button className="absolute top-1 right-1 bg-background/80 rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={() => removeFoto(realIdx)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {foto.file && <span className="absolute bottom-1 left-1 bg-background/70 text-xs px-1.5 py-0.5 rounded">Novo</span>}
                      </div>
                      <div className="p-2">
                        <Input value={foto.legenda} onChange={e => updateLegenda(realIdx, e.target.value)} placeholder="Legenda (opcional)" className="text-xs h-7" />
                      </div>
                    </div>
                  );
                })}
                <div className="border-2 border-dashed border-border rounded-lg aspect-video flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <Plus className="w-8 h-8 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Adicionar</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="flex-1 gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 gap-2">
            <Send className="w-4 h-4" />
            {saving ? 'Enviando...' : 'Enviar para Aprovação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
