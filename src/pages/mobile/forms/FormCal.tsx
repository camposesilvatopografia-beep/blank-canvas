import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FlaskConical, Loader2, CheckCircle2, ArrowDownCircle, ArrowUpCircle, FileText, DollarSign, Package, RefreshCw, Truck, Building, ClipboardList, Pencil, Trash2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { useFormFieldPermissions } from '@/components/mobile/FieldPermissionWrapper';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';
import { formatBankNumberInput, formatToneladaInput } from '@/utils/masks';
import { MapPin } from 'lucide-react';

interface FornecedorOption {
  id: string;
  nome: string;
}

interface EquipamentoData {
  prefixo: string;
  descricao: string;
  empresa: string;
  operador: string;
}

interface CalRecord {
  rowIndex: number;
  id: string;
  data: string;
  hora: string;
  tipo: string;
  fornecedor: string;
  prefixoEq: string;
  unidade: string;
  quantidade: string;
  notaFiscal: string;
  valor: string;
}


export default function FormCal() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, loading: sheetLoading, readSheet, writeSheet, deleteRow } = useGoogleSheets();
  const { isOnline, addPendingRecord, pendingCount, syncAllPending, isSyncing } = useOfflineSync();
  const { toast } = useToast();
  const { isFieldVisible, isFieldDisabled, loading: permissionsLoading, hasFullAccess } = useFormFieldPermissions('cal');

  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoData[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  // Records view state
  const [showRecords, setShowRecords] = useState(false);
  const [records, setRecords] = useState<CalRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CalRecord | null>(null);
  const [editForm, setEditForm] = useState({ quantidade: '', notaFiscal: '', valor: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CalRecord | null>(null);

  const [selectedEquipamento, setSelectedEquipamento] = useState<EquipamentoData | null>(null);


  const defaultFornecedor = 'Cal Trevo';
  const defaultPrefixoEq = 'Caminhão Distribuidor';

  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    tipo: '',
    quantidade: '',
    notaFiscal: '',
    valor: '',
    fornecedor: defaultFornecedor,
    prefixoEq: defaultPrefixoEq,
    unidade: 'Tonelada',
  });

  // Quantity (toneladas): user types only numbers, system places comma automatically
  // Ex: 2530 -> 25,30
  const formatQuantityInput = (raw: string): string => formatToneladaInput(raw);

  const formatQuantityDisplay = (val: string): string => val || '';

  // Bank-style for monetary values only (valor R$)
  const formatCurrencyInput = (raw: string): string => formatBankNumberInput(raw, 2, 12);

  // Parse the formatted value (with comma) back to a number
  const parseNumeric = (val: string): number => {
    if (!val) return 0;
    return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
  };

  // Format for saving to sheet
  const formatForSheet = (val: string): string => {
    if (!val) return '0,00';
    return val;
  };

  const calculateDerivedValues = () => {
    const quantidade = parseNumeric(formData.quantidade);
    const valor = parseNumeric(formData.valor);
    
    if (quantidade > 0) {
      const precoUnitario = valor > 0 ? valor / quantidade : 0;
      return {
        precoUnitario: precoUnitario.toFixed(2).replace('.', ','),
        valorTotal: valor.toFixed(2).replace('.', ','),
        toneladas: quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }),
      };
    }
    return null;
  };

  // Load options
  useEffect(() => {
    const loadOptions = async () => {
      const { data: fornecedoresData } = await supabase
        .from('fornecedores_cal')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      
      if (fornecedoresData) setFornecedores(fornecedoresData);

      const eqData = await readSheet('Equipamentos');
      if (eqData && eqData.length > 1) {
        const headers = eqData[0];
        const getIdx = (name: string) => {
          let idx = headers.indexOf(name);
          if (idx !== -1) return idx;
          idx = headers.findIndex((h: string) => h?.toLowerCase() === name.toLowerCase());
          return idx;
        };
        
        const equipamentosData = eqData.slice(1)
          .filter(row => row[getIdx('Prefixo')])
          .map(row => ({
            prefixo: row[getIdx('Prefixo')] || '',
            descricao: row[getIdx('Descricao')] || '',
            empresa: row[getIdx('Empresa')] || '',
            operador: row[getIdx('Operador')] || '',
          }));
        setEquipamentos(equipamentosData);
      }
    };

    loadOptions();
  }, [readSheet]);


  const handleEquipamentoChange = (prefixo: string) => {
    const found = equipamentos.find(eq => eq.prefixo === prefixo);
    setSelectedEquipamento(found || null);
    setFormData({ ...formData, prefixoEq: prefixo });
  };

  // ===================== LOAD RECORDS =====================
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const data = await readSheet('Mov_Cal');
      if (!data || data.length < 2) {
        setRecords([]);
        return;
      }

      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);
      
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      const userName = effectiveName;

      const parsed: CalRecord[] = [];
      data.slice(1).forEach((row, idx) => {
        const rawDate = row[fi('Data')] || '';
        const rowDate = rawDate.split('/').map(p => p.padStart(2, '0')).join('/');
        const rowUser = row[fi('Usuario')] || '';
        
        // Filter: today + current user (if user column exists and user is not admin)
        const dateMatch = rowDate === todayStr;
        const userIdx = fi('Usuario');
        const userMatch = userIdx === -1 || !userName || rowUser === userName;
        
        if (dateMatch && userMatch) {
          parsed.push({
            rowIndex: idx + 1, // 0-based data row + 1 for header
            id: row[fi('IdCAL')] || row[0] || '',
            data: rowDate,
            hora: row[fi('Hora')] || '',
            tipo: row[fi('Tipo')] || '',
            fornecedor: row[fi('Fornecedor')] || '',
            prefixoEq: row[fi('Prefixo_Eq')] || '',
            unidade: row[fi('Und')] || '',
            quantidade: row[fi('Qtd')] || '',
            notaFiscal: row[fi('NF')] || '',
            valor: row[fi('Valor')] || '',
          });
        }
      });

      setRecords(parsed);
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoadingRecords(false);
    }
  }, [readSheet, effectiveName]);

  // ===================== EDIT RECORD =====================
  const handleStartEdit = (record: CalRecord) => {
    setShowRecords(false);
    setTimeout(() => {
      setEditingRecord(record);
      setEditForm({
        quantidade: record.quantidade.replace('.', '').replace(',', ''),
        notaFiscal: record.notaFiscal,
        valor: record.valor.replace('.', '').replace(',', ''),
      });
    }, 200);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      const qtdFormatted = formatForSheet(editForm.quantidade);
      const valorFormatted = editingRecord.tipo === 'Entrada' ? 'R$ ' + editForm.valor : '';

      // Update only columns N (Und), O (Qtd), P (NF), Q (Valor) for simple edits
      const updatedValues = [
        editingRecord.unidade,   // N: Und
        qtdFormatted,            // O: Qtd
        editingRecord.tipo === 'Entrada' ? editForm.notaFiscal : '', // P: NF
        valorFormatted,          // Q: Valor
      ];

      const rowNum = editingRecord.rowIndex + 1; // 1-based for sheets
      const success = await writeSheet('Mov_Cal', `N${rowNum}:Q${rowNum}`, [updatedValues]);

      if (success) {
        toast({ title: '✅ Registro atualizado!' });
        setEditingRecord(null);
        loadRecords();
      } else {
        throw new Error('Falha ao atualizar');
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  // ===================== DELETE RECORD =====================
  const confirmDelete = (record: CalRecord) => setRecordToDelete(record);
  const handleDelete = async () => {
    if (!recordToDelete) return;
    setDeletingId(recordToDelete.id);
    setRecordToDelete(null);
    try {
      const success = await deleteRow('Mov_Cal', recordToDelete.rowIndex);
      if (success) {
        toast({ title: '🗑️ Registro excluído!' });
        loadRecords();
      } else {
        throw new Error('Falha ao excluir');
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const generateWhatsAppRecords = () => {
    const today = format(new Date(), 'dd/MM/yyyy');
    const userName = effectiveName || 'Usuário';
    const totalEntrada = records.filter(r => r.tipo === 'Entrada').reduce((sum, r) => sum + (parseFloat(String(r.quantidade).replace(',', '.')) || 0), 0);
    const totalSaida = records.filter(r => r.tipo !== 'Entrada').reduce((sum, r) => sum + (parseFloat(String(r.quantidade).replace(',', '.')) || 0), 0);
    let msg = `🧪 *REGISTROS CAL - ${today}*\n\n👷 Apontador: ${userName}\n📊 Total: ${records.length} registro(s)\n`;
    if (totalEntrada > 0) msg += `📥 Entradas: ${totalEntrada.toLocaleString('pt-BR')} ton\n`;
    if (totalSaida > 0) msg += `📤 Saídas: ${totalSaida.toLocaleString('pt-BR')} ton\n`;
    msg += `\n---\n_Enviado via ApropriAPP_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ===================== SUBMIT =====================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedOffline(false);

    try {
      const now = new Date();
      const hora = format(now, 'HH:mm:ss');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');

      const generateId = () => Math.random().toString(36).substring(2, 10);
      
      const quantidadeFormatted = formatForSheet(formData.quantidade);
      const valorFormatted = formatForSheet(formData.valor);
      
      const userName = effectiveName;
      const calRow = [
        generateId(),                                      // A: IdCAL
        dataFormatada,                                     // B: Data
        formData.tipo === 'Saída' ? 'Saida' : formData.tipo, // C: Tipo
        hora,                                              // D: Hora
        '',                                                // E: Veiculo
        '',                                                // F: Peso de Chegada
        '',                                                // G: Peso Vazio
        '',                                                // H: Qtd Balança Obra
        '',                                                // I: (reservado)
        '',                                                // J: Foto Peso Chegada
        '',                                                // K: Foto Peso Saida
        '',                                                // L: Foto Ticket
        defaultFornecedor,                                 // M: Fornecedor
        defaultPrefixoEq,                                  // N: Prefixo_Eq
        formData.unidade,                                  // O: Und
        quantidadeFormatted,                               // P: Qtd
        formData.tipo === 'Entrada' ? formData.notaFiscal : '', // Q: NF
        formData.tipo === 'Entrada' ? 'R$ ' + formData.valor : '', // R: Valor
        'Cebolão',                                         // S: Local
        userName || '',                                    // T: Usuario
      ];

      const supabaseBackup = async () => {
        try {
          const { error } = await supabase.from('movimentacoes_cal').insert({
            data: formData.data,
            hora,
            prefixo_caminhao: defaultPrefixoEq,
            fornecedor: defaultFornecedor,
            nota_fiscal: formData.tipo === 'Entrada' ? formData.notaFiscal : '',
            quantidade: parseNumeric(formData.quantidade),
            local: 'Cebolão',
            usuario: effectiveName,
          });
          if (error) console.error('Supabase backup error (Cal):', error);
        } catch (e) {
          console.error('Failed to insert in Supabase (Cal):', e);
        }
      };

      if (!isOnline) {
        addPendingRecord('cal', 'Mov_Cal', calRow, { ...formData });
        await supabaseBackup();
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        toast({ title: 'Salvo Localmente', description: 'Será sincronizado quando a conexão voltar.' });
        setLoading(false);
        return;
      }

      console.log('[FormCal] Calling appendSheet...');
      const success = await appendSheet('Mov_Cal', [calRow]);
      
      // Backup to Supabase
      await supabaseBackup();

      if (!success) {
        addPendingRecord('cal', 'Mov_Cal', calRow, { ...formData });
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        toast({ title: 'Salvo Localmente', description: 'Falha na planilha. Registro salvo offline e Supabase.' });
        return;
      }

      setSubmitted(true);
      playSuccessSound();
      toast({
        title: 'Sucesso!',
        description: 'Movimento de CAL registrado na planilha e Supabase.',
      });

    } catch (error: any) {
      console.error('Cal submission error:', error);
      const now = new Date();
      const hora = format(now, 'HH:mm:ss');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const generateIdFallback = () => Math.random().toString(36).substring(2, 10);
      
      const calRowOffline = [
        generateIdFallback(),                              // A
        dataFormatada,                                     // B
        formData.tipo === 'Saída' ? 'Saida' : formData.tipo, // C
        hora,                                              // D
        '', '', '', '', '', '', '', '',
        defaultFornecedor,
        defaultPrefixoEq,
        formData.unidade,
        formatForSheet(formData.quantidade),
        formData.tipo === 'Entrada' ? formData.notaFiscal : '',
        formData.tipo === 'Entrada' ? 'R$ ' + formData.valor : '',
        'Cebolão',
        effectiveName || '',
      ];

      addPendingRecord('cal', 'Mov_Cal', calRowOffline, { ...formData });
      setSavedOffline(true);
      setSubmitted(true);
      playOfflineSound();
      toast({
        title: 'Salvo Localmente',
        description: 'Erro na conexão. Será sincronizado depois.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSelectedEquipamento(null);
    setFormData({
      ...formData,
      tipo: '',
      quantidade: '',
      notaFiscal: '',
      valor: '',
      fornecedor: '',
      prefixoEq: '',
      unidade: 'Tonelada',
    });
  };

  useEffect(() => {
    if (formData.tipo === 'Entrada') {
      if (fornecedores.length > 0 && !formData.fornecedor) {
        setFormData(prev => ({ ...prev, fornecedor: fornecedores[0].nome }));
      }
      if (equipamentos.length > 0 && !formData.prefixoEq) {
        const eq = equipamentos[0];
        setFormData(prev => ({ ...prev, prefixoEq: eq.prefixo }));
        setSelectedEquipamento(eq);
      }
    }
  }, [formData.tipo, fornecedores, equipamentos]);

  const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';
  const isEntrada = formData.tipo === 'Entrada';

  if (submitted) {
    const derived = calculateDerivedValues();
    const qtdNum = parseNumeric(formData.quantidade);
    const successDetails = [
      { label: 'Tipo', value: formData.tipo },
      { label: 'Quantidade', value: `${qtdNum.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} toneladas` },
      ...(formData.prefixoEq ? [{ label: 'Equipamento', value: `${formData.prefixoEq}${selectedEquipamento?.operador ? ` - ${selectedEquipamento.operador}` : ''}` }] : []),
      ...(formData.tipo === 'Entrada' && formData.fornecedor ? [{ label: 'Fornecedor', value: formData.fornecedor }] : []),
      ...(formData.tipo === 'Entrada' && formData.notaFiscal ? [{ label: 'Nota Fiscal', value: formData.notaFiscal }] : []),
      ...(formData.tipo === 'Entrada' && derived?.precoUnitario && parseFloat(derived.precoUnitario.replace(',', '.')) > 0 ? [{ label: 'Preço/tonelada', value: `R$ ${derived.precoUnitario}` }] : []),
    ];

    return (
      <SuccessScreen
        title={savedOffline ? "Salvo Localmente!" : "Movimento Registrado!"}
        subtitle={savedOffline ? "Será sincronizado quando a conexão voltar." : `${formData.tipo} de CAL registrada com sucesso.`}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor={savedOffline ? "amber" : "purple"}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-emerald-500 p-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(getApontadorHomeRoute())}
              className="text-white hover:text-white hover:bg-white/20 w-14 h-14"
            >
              <ArrowLeft className="w-8 h-8" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg">
                <FlaskConical className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-2xl text-white">Registrar Movimento</h1>
                <p className="text-base text-white/80">CAL</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowRecords(true); loadRecords(); }}
              className="text-white hover:text-white hover:bg-white/20 w-12 h-12"
              title="Ver meus registros"
            >
              <ClipboardList className="w-6 h-6" />
            </Button>
            <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />
          </div>
        </div>
      </div>

      {/* Pending Records Banner */}
      {pendingCount > 0 && isOnline && (
        <div className="mx-5 mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between">
          <span className="text-lg font-semibold text-amber-800">
            {pendingCount} registro(s) pendente(s)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={syncAllPending}
            disabled={isSyncing}
            className="text-amber-700 hover:bg-amber-100 h-12 px-4 text-base font-semibold"
          >
            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
            Sincronizar
          </Button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Data */}
        {isFieldVisible('data') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block">Data</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={formData.data}
                onChange={e => setFormData({ ...formData, data: e.target.value })}
                disabled={isFieldDisabled('data')}
                className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ ...formData, data: format(new Date(), 'yyyy-MM-dd') })}
                className="h-16 px-4 text-sm font-semibold border-2 border-[#1d3557]/20 text-[#1d3557] rounded-xl whitespace-nowrap"
              >
                Hoje
              </Button>
            </div>
          </Card>
        )}

        {/* Tipo */}
        {isFieldVisible('tipo') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block">Tipo de Movimento</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => !isFieldDisabled('tipo') && setFormData({ ...formData, tipo: 'Entrada' })}
                disabled={isFieldDisabled('tipo')}
                className={`p-6 rounded-2xl flex flex-col items-center gap-3 transition-all ${
                  formData.tipo === 'Entrada'
                    ? 'bg-green-100 border-3 border-green-500 shadow-lg'
                    : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                } ${isFieldDisabled('tipo') ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ArrowDownCircle className={`w-14 h-14 ${formData.tipo === 'Entrada' ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={`text-xl font-bold ${formData.tipo === 'Entrada' ? 'text-green-600' : 'text-gray-600'}`}>
                  Entrada
                </span>
              </button>
              <button
                type="button"
                onClick={() => !isFieldDisabled('tipo') && setFormData({ ...formData, tipo: 'Saída', notaFiscal: '', valor: '', fornecedor: '' })}
                disabled={isFieldDisabled('tipo')}
                className={`p-6 rounded-2xl flex flex-col items-center gap-3 transition-all ${
                  formData.tipo === 'Saída'
                    ? 'bg-red-100 border-3 border-red-500 shadow-lg'
                    : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                } ${isFieldDisabled('tipo') ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ArrowUpCircle className={`w-14 h-14 ${formData.tipo === 'Saída' ? 'text-red-500' : 'text-gray-400'}`} />
                <span className={`text-xl font-bold ${formData.tipo === 'Saída' ? 'text-red-600' : 'text-gray-600'}`}>
                  Saída
                </span>
              </button>
            </div>
          </Card>
        )}


        {/* Quantidade em Toneladas */}
        {formData.tipo && isFieldVisible('quantidade') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Package className="w-7 h-7 text-emerald-600" />
              Quantidade (Toneladas)
            </Label>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="0,00"
              value={formData.quantidade}
              onChange={e => {
                const value = formatQuantityInput(e.target.value);
                setFormData({ ...formData, quantidade: value });
              }}
              disabled={isFieldDisabled('quantidade')}
              className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Digite apenas números (ex: 2530 = 25,30 toneladas)
              {formData.quantidade && (
                <span className="block mt-1 font-semibold text-emerald-600">
                  Será salvo como: {formatQuantityDisplay(formData.quantidade)} ton
                </span>
              )}
            </p>
          </Card>
        )}

        {/* Campos adicionais apenas para Entrada */}
        {isEntrada && (
          <>
            {isFieldVisible('nota_fiscal') && (
              <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm animate-in slide-in-from-top-2">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <FileText className="w-7 h-7 text-emerald-600" />
                  Nota Fiscal
                </Label>
                <Input
                  type="text"
                  placeholder="Ex: NF-12345"
                  value={formData.notaFiscal}
                  onChange={e => setFormData({ ...formData, notaFiscal: e.target.value })}
                  disabled={isFieldDisabled('nota_fiscal')}
                  className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
                />
              </Card>
            )}

            {isFieldVisible('valor') && (
              <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm animate-in slide-in-from-top-2">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <DollarSign className="w-7 h-7 text-emerald-600" />
                  Valor Total (R$)
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 1500"
                  value={formData.valor}
                  onChange={e => {
                    const value = formatCurrencyInput(e.target.value);
                    setFormData({ ...formData, valor: value });
                  }}
                  disabled={isFieldDisabled('valor')}
                  className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Digite apenas números
                  {formData.valor && (
                    <span className="block mt-1 font-semibold text-emerald-600">
                      Será salvo como: R$ {formData.valor}
                    </span>
                  )}
                </p>
              </Card>
            )}
          </>
        )}

        {/* Resumo Entrada */}
        {formData.tipo === 'Entrada' && formData.quantidade && (
          <Card className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <DollarSign className="w-7 h-7 text-emerald-600" />
              Resumo da Entrada
            </Label>
            {(() => {
              const derived = calculateDerivedValues();
              if (!derived) return null;
              const hasValor = parseNumeric(formData.valor) > 0;
              return (
                <div className="grid grid-cols-2 gap-4 text-lg">
                  <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                    <span className="text-gray-500">Quantidade:</span>
                    <span className="text-emerald-600 font-bold">{derived.toneladas} ton</span>
                  </div>
                  {hasValor && (
                    <>
                      <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                        <span className="text-gray-500">Valor Total:</span>
                        <span className="text-emerald-600 font-bold">R$ {derived.valorTotal}</span>
                      </div>
                      <div className="col-span-2 flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                        <span className="text-gray-500">Preço por tonelada:</span>
                        <span className="text-green-600 font-bold text-xl">R$ {derived.precoUnitario}/t</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </Card>
        )}

        {/* Resumo Saída */}
        {formData.tipo === 'Saída' && formData.quantidade && (
          <Card className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Package className="w-7 h-7 text-red-600" />
              Resumo da Saída
            </Label>
            <div className="p-4 bg-white rounded-xl border-2 border-gray-200">
              <div className="flex justify-between text-lg">
                <span className="text-gray-500">Quantidade:</span>
                <span className="text-red-600 font-bold">{formatQuantityDisplay(formData.quantidade)} toneladas</span>
              </div>
            </div>
          </Card>
        )}

        <Button
          type="submit"
          disabled={loading || sheetLoading || !formData.tipo || !formData.quantidade}
          className="w-full h-20 text-2xl font-bold bg-emerald-500 hover:bg-emerald-600 shadow-xl mt-4 rounded-2xl"
        >
          {loading || sheetLoading ? (
            <>
              <Loader2 className="w-8 h-8 mr-3 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-8 h-8 mr-3" />
              Registrar Movimento
            </>
          )}
        </Button>
      </form>

      {/* =================== MODAL: Meus Registros =================== */}
      <Dialog open={showRecords} onOpenChange={setShowRecords}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              Meus Registros de Hoje
              {records.length > 0 && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 ml-auto">{records.length}</Badge>}
            </DialogTitle>
          </DialogHeader>

          {loadingRecords ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado hoje.</p>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => (
                <Card 
                  key={rec.id} 
                  className="p-4 border-2 border-gray-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors active:bg-blue-50"
                  onClick={() => handleStartEdit(rec)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {rec.tipo === 'Entrada' ? (
                        <ArrowDownCircle className="w-5 h-5 text-green-600 shrink-0" />
                      ) : (
                        <ArrowUpCircle className="w-5 h-5 text-red-600 shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-base">
                          {rec.tipo} — {rec.quantidade} {rec.unidade || 'ton'}
                        </p>
                        <p className="text-sm text-muted-foreground">{rec.hora}</p>
                        {rec.notaFiscal && <p className="text-xs text-muted-foreground">NF: {rec.notaFiscal}</p>}
                        {rec.valor && <p className="text-xs text-muted-foreground">Valor: R$ {rec.valor}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); confirmDelete(rec); }}
                        disabled={deletingId === rec.id}
                      >
                        {deletingId === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={loadRecords} disabled={loadingRecords}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingRecords ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {records.length > 0 && (
              <Button variant="outline" className="flex-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={generateWhatsAppRecords}>
                <Send className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* =================== MODAL: Editar Registro =================== */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Editar Registro
            </DialogTitle>
          </DialogHeader>

          {editingRecord && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl text-sm">
                <p><span className="text-muted-foreground">Tipo:</span> {editingRecord.tipo}</p>
                <p><span className="text-muted-foreground">Data:</span> {editingRecord.data}</p>
                <p><span className="text-muted-foreground">Hora:</span> {editingRecord.hora}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">Quantidade (Toneladas)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editForm.quantidade}
                  onChange={e => setEditForm({ ...editForm, quantidade: formatQuantityInput(e.target.value) })}
                  className="h-14 text-lg"
                />
                {editForm.quantidade && (
                  <p className="text-sm text-emerald-600 font-medium">
                    Será salvo como: {formatQuantityDisplay(editForm.quantidade)} ton
                  </p>
                )}
              </div>

              {editingRecord.tipo === 'Entrada' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Nota Fiscal</Label>
                    <Input
                      value={editForm.notaFiscal}
                      onChange={e => setEditForm({ ...editForm, notaFiscal: e.target.value })}
                      className="h-14 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Valor (R$)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={editForm.valor}
                      onChange={e => setEditForm({ ...editForm, valor: formatCurrencyInput(e.target.value) })}
                      className="h-14 text-lg"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingRecord(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editForm.quantidade}
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
