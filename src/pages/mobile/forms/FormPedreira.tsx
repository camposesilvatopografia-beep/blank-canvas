import { useState, useEffect, useCallback, useRef } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { parseNumeric } from '@/utils/masks';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mountain, Loader2, CheckCircle2, Truck as TruckIcon, Package, Clock, FileText, Scale, RefreshCw, Building, ClipboardList, Pencil, Trash2, Send, Weight, Camera, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { useFormFieldPermissions } from '@/components/mobile/FieldPermissionWrapper';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';

interface MaterialOption {
  id: string;
  nome: string;
}

interface EmpresaOption {
  id: string;
  nome: string;
}

interface FornecedorPedreiraOption {
  id: string;
  nome: string;
}

// Interface for Cam_reboque data - based on user's spreadsheet
interface CamReboqueData {
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  modelo: string;
  placa: string;
  pesoVazio: string;
}

interface PedreiraRecord {
  rowIndex: number;
  id: string;
  data: string;
  hora: string;
  caminhao: string;
  motorista: string;
  material: string;
  pesoFinal: string;
  pesoVazio: string;
  pesoLiquido: string;
  tonelada: string;
}

export default function FormPedreira() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, loading: sheetLoading, readSheet, writeSheet, deleteRow } = useGoogleSheets();
  const { isOnline, addPendingRecord, pendingCount, syncAllPending, isSyncing } = useOfflineSync();
  const { toast } = useToast();
  const { isFieldVisible, isFieldDisabled, loading: permissionsLoading, hasFullAccess } = useFormFieldPermissions('pedreira');

  const [loading, setLoading] = useState(false);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]);
  const [fornecedoresPedreira, setFornecedoresPedreira] = useState<FornecedorPedreiraOption[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [caminhoes, setCaminhoes] = useState<CamReboqueData[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);

  // Records view state
  const [showRecords, setShowRecords] = useState(false);
  const [records, setRecords] = useState<PedreiraRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PedreiraRecord | null>(null);
  const [editForm, setEditForm] = useState({ pesoFinal: '', material: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<PedreiraRecord | null>(null);

  // Selected equipment data for auto-fill
  const [selectedCaminhao, setSelectedCaminhao] = useState<CamReboqueData | null>(null);
  
  // State for custom peso vazio override
  const [customPesoVazio, setCustomPesoVazio] = useState('');
  
  // Last used peso vazio from localStorage
  const [lastPesoVazio, setLastPesoVazio] = useState(() => {
    return localStorage.getItem('lastPesoVazio') || '';
  });

  // Form data
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    caminhao: '',
    horaCarregamento: format(new Date(), 'HH:mm'),
    numeroPedido: '',
    fornecedor: '',
    pesoFinal: '',
    material: '',
    pesoChegada: '',
  });

  // OCR state (Peso Chegada photo)
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrFotoPreview, setOcrFotoPreview] = useState<string | null>(null);
  const [ocrFotoFile, setOcrFotoFile] = useState<File | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // Peso Final photo state
  const [pesoFinalFotoPreview, setPesoFinalFotoPreview] = useState<string | null>(null);
  const [pesoFinalFotoFile, setPesoFinalFotoFile] = useState<File | null>(null);
  const pesoFinalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pesoFinalFotoFile) {
      const url = URL.createObjectURL(pesoFinalFotoFile);
      setPesoFinalFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPesoFinalFotoPreview(null);
    }
  }, [pesoFinalFotoFile]);

  useEffect(() => {
    if (ocrFotoFile) {
      const url = URL.createObjectURL(ocrFotoFile);
      setOcrFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOcrFotoPreview(null);
    }
  }, [ocrFotoFile]);

  useEffect(() => {
    const loadOptions = async () => {
      // Load materiais from Supabase - using materiais_pedreira table
      const { data: materiaisData } = await supabase
        .from('materiais_pedreira')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      
      if (materiaisData) setMateriais(materiaisData);

      // Load fornecedores pedreira from Supabase
      const { data: fornecedoresData } = await supabase
        .from('fornecedores_pedreira')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      
      if (fornecedoresData) setFornecedoresPedreira(fornecedoresData);

      // Load empresas from Supabase
      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      
      if (empresasData) setEmpresas(empresasData);

      // Load caminhões from Google Sheets - Cam_reboque tab
      const camData = await readSheet('Cam_reboque');
      if (camData && camData.length > 1) {
        const headers = camData[0];
        const getIdx = (name: string) => {
          let idx = headers.indexOf(name);
          if (idx !== -1) return idx;
          idx = headers.findIndex((h: string) => h?.toLowerCase() === name.toLowerCase());
          return idx;
        };
        
        const caminhoesData = camData.slice(1)
          .filter(row => row[getIdx('Prefixo')])
          .map(row => ({
            prefixo: row[getIdx('Prefixo')] || '',
            descricao: row[getIdx('Descricao')] || '',
            empresa: row[getIdx('Empresa')] || '',
            motorista: row[getIdx('Motorista')] || '',
            modelo: row[getIdx('Modelo')] || '',
            placa: row[getIdx('Placa')] || '',
            pesoVazio: row[getIdx('Peso_Vazio')] || '',
          }));
        setCaminhoes(caminhoesData);
      }

      // Load headers for Apontamento_Pedreira
      const pedrData = await readSheet('Apontamento_Pedreira', 'A1:AZ1');
      if (pedrData && pedrData.length > 0) {
        setSheetHeaders(pedrData[0]);
      }
    };

    loadOptions();
  }, [readSheet]);

  // Handle caminhao selection - auto-fill related fields
  const handleCaminhaoChange = (prefixo: string) => {
    const found = caminhoes.find(c => c.prefixo === prefixo);
    setSelectedCaminhao(found || null);
    setFormData({ 
      ...formData, 
      caminhao: prefixo,
    });
    // If vehicle has pesoVazio, use it; otherwise suggest last used
    if (found?.pesoVazio) {
      setCustomPesoVazio(found.pesoVazio);
    } else if (lastPesoVazio) {
      setCustomPesoVazio(lastPesoVazio);
    }
  };

  // Get effective peso vazio (custom or from vehicle)
  const getEffectivePesoVazio = () => {
    return customPesoVazio || selectedCaminhao?.pesoVazio || '';
  };


  // Weight formatting: raw kg digits → formatted with thousands separator (32500 → 32.500,00)
  const formatBankInput = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const value = parseInt(digits, 10);
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format integer with dot as thousands separator
  const formatIntBR = (num: number): string => {
    return Math.round(num).toLocaleString('pt-BR');
  };

  // Format decimal with comma as decimal separator
  const formatDecimalBR = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // Format peso for sheet from raw digit string
  const formatPesoForSheet = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return value;
    const num = parseInt(digits, 10);
    if (isNaN(num)) return value;
    return formatDecimalBR(num);
  };

  // Parse raw digits to number (direct kg value)
  const parseBankDigits = (raw: string): number => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return NaN;
    return parseInt(digits, 10);
  };

  // Helper function to calculate derived values from raw digit strings (bank-style)
  const calculateDerivedValues = (pesoFinalRaw: string, pesoVazioRaw: string) => {
    let pesoFinalNum: number;
    let pesoVazioNum: number;
    
    if (pesoFinalRaw.includes(',') || pesoFinalRaw.includes('.')) {
      pesoFinalNum = parseNumeric(pesoFinalRaw);
    } else {
      pesoFinalNum = parseBankDigits(pesoFinalRaw);
    }
    
    if (pesoVazioRaw.includes(',') || pesoVazioRaw.includes('.')) {
      pesoVazioNum = parseNumeric(pesoVazioRaw);
    } else {

      pesoVazioNum = parseBankDigits(pesoVazioRaw);
    }
    
    if (isNaN(pesoFinalNum) || isNaN(pesoVazioNum)) {
      return { pesoLiquido: '', metroCubico: '', densidade: '', tonelada: '', pesoLiquidoNum: 0, toneladaNum: 0 };
    }
    
    const pesoLiquido = pesoFinalNum - pesoVazioNum;
    const tonelada = pesoLiquido / 1000;
    const densidade = 1.52;
    const metroCubico = tonelada / densidade;
    
    return {
      pesoLiquido: formatDecimalBR(pesoLiquido),
      metroCubico: formatDecimalBR(metroCubico),
      densidade: formatDecimalBR(densidade),
      tonelada: formatDecimalBR(tonelada),
      pesoLiquidoNum: pesoLiquido,
      toneladaNum: tonelada,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedOffline(false);

    let fotoPesoFinalUrl = '';
    let fotoChegadaUrl = '';
    try {
      const now = new Date();
      const hora = format(now, 'HH:mm:ss');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');

      // Get effective peso vazio
      const effectivePesoVazio = getEffectivePesoVazio();
      
      // Save last peso vazio for future suggestions
      if (effectivePesoVazio) {
        localStorage.setItem('lastPesoVazio', effectivePesoVazio);
        setLastPesoVazio(effectivePesoVazio);
      }

      // Calculate all derived values automatically
      const derived = calculateDerivedValues(
        formData.pesoFinal || '0',
        effectivePesoVazio || '0'
      );


      // Photo upload logic
      if (pesoFinalFotoFile) {
        try {
          const timestamp = Date.now();
          const ext = pesoFinalFotoFile.name.split('.').pop() || 'jpg';
          const filePath = `balanca/${format(new Date(), 'yyyy-MM-dd')}/${formData.caminhao}_final_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, pesoFinalFotoFile, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
            fotoPesoFinalUrl = urlData.publicUrl;
          }
        } catch (e) { console.error('Upload foto peso final erro:', e); }
      }

      if (ocrFotoFile) {
        try {
          const timestamp = Date.now();
          const ext = ocrFotoFile.name.split('.').pop() || 'jpg';
          const filePath = `chegada/${format(new Date(), 'yyyy-MM-dd')}/${formData.caminhao}_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, ocrFotoFile, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
            fotoChegadaUrl = urlData.publicUrl;
          }
        } catch (e) { console.error('Upload foto erro:', e); }
      }

      const generateId = () => Math.random().toString(36).substring(2, 10);
      
      let headers = sheetHeaders;
      if (!headers || headers.length === 0) {
        const hData = await readSheet('Apontamento_Pedreira', 'A1:AZ1');
        if (hData && hData.length > 0) headers = hData[0];
      }

      const fi = (name: string) => headers.indexOf(name);
      const colCount = headers.length > 0 ? headers.length : 23;
      const pedreiraRow: string[] = new Array(colCount).fill('');

      const sv = (name: string, fallbackIdx: number, value: string) => {
        const idx = fi(name);
        if (idx !== -1) pedreiraRow[idx] = value;
        else if (fallbackIdx < colCount) pedreiraRow[fallbackIdx] = value;
      };

      sv('ID', 0, generateId());
      sv('Data', 1, dataFormatada);
      sv('Hora', 2, formData.horaCarregamento);
      sv('Ordem_Carregamento', 3, formData.numeroPedido || '');
      sv('Fornecedor', 4, formData.fornecedor || '');
      sv('Prefixo_Eq', 5, formData.caminhao);
      sv('Descricao_Eq', 6, selectedCaminhao?.descricao || 'Caminhão Reboque');
      sv('Empresa_Eq', 7, selectedCaminhao?.empresa || '');
      sv('Motorista', 8, selectedCaminhao?.motorista || '');
      sv('Placa', 9, selectedCaminhao?.placa || '');
      sv('Material', 10, formData.material);
      sv('Peso_Vazio', 11, formatPesoForSheet(effectivePesoVazio));
      sv('Peso_Final', 12, formatPesoForSheet(formData.pesoFinal));
      sv('Peso_Liquido', 13, derived.pesoLiquido || '');
      sv('Metro_Cubico', 14, derived.metroCubico || '');
      sv('Densidade', 15, derived.densidade || '');
      sv('Tonelada', 16, derived.tonelada || '');
      sv('Usuario', 17, effectiveName || '');
      sv('Hora_Chegada_Obra', 18, format(new Date(), 'HH:mm'));
      sv('Peso_Chegada_Obra', 19, formatPesoForSheet(formData.pesoChegada));
      sv('Status', 20, 'Finalizado');
      
      // Photos
      const fotoChegadaIdx = fi('Foto do Peso Chegada Obra') !== -1 ? fi('Foto do Peso Chegada Obra') : (fi('Foto') !== -1 ? fi('Foto') : 21);
      if (fotoChegadaIdx !== -1 && fotoChegadaIdx < colCount) pedreiraRow[fotoChegadaIdx] = fotoChegadaUrl;
      
      const fotoPesagemIdx = fi('Foto Pesagem Pedreira') !== -1 ? fi('Foto Pesagem Pedreira') : (fi('Foto_Pesagem_Pedreira') !== -1 ? fi('Foto_Pesagem_Pedreira') : 22);
      if (fotoPesagemIdx !== -1 && fotoPesagemIdx < colCount) pedreiraRow[fotoPesagemIdx] = fotoPesoFinalUrl;

      const supabaseBackup = async () => {
        try {
          const { error } = await supabase.from('movimentacoes_pedreira').insert({
            data: formData.data,
            hora: formData.horaCarregamento,
            prefixo_caminhao: formData.caminhao,
            empresa_caminhao: selectedCaminhao?.empresa,
            motorista: selectedCaminhao?.motorista,
            fornecedor: formData.fornecedor,
            material: formData.material,
            nota_fiscal: formData.numeroPedido,
            viagens: 1,
            volume: parseNumeric(formData.pesoFinal),
            volume_total: derived.toneladaNum,
            usuario: effectiveName,
            foto_path: fotoChegadaUrl,
            nf_foto_path: fotoPesoFinalUrl,
          });
          if (error) console.error('Supabase backup error (Pedreira):', error);
        } catch (e) {
          console.error('Failed to insert in Supabase (Pedreira):', e);
        }
      };

      if (!isOnline) {
        addPendingRecord('pedreira', 'Apontamento_Pedreira', pedreiraRow, { ...formData });
        await supabaseBackup();
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        toast({ title: 'Salvo Localmente', description: 'Será sincronizado quando a conexão voltar.' });
        setLoading(false);
        return;
      }

      const success = await appendSheet('Apontamento_Pedreira', [pedreiraRow]);

      // Backup regardless of sheet success
      await supabaseBackup();

      if (!success) {
        addPendingRecord('pedreira', 'Apontamento_Pedreira', pedreiraRow, { ...formData });
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
        description: 'Apontamento de pedreira registrado com sucesso.',
      });
    } catch (error: any) {
      console.error('Pedreira submission error:', error);
      // Fallback
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const derived = calculateDerivedValues(formData.pesoFinal || '0', getEffectivePesoVazio() || '0');
      
      let headers = sheetHeaders;
      const fi = (name: string) => headers.indexOf(name);
      const colCount = headers.length > 0 ? headers.length : 23;
      const pedreiraRowFallback: string[] = new Array(colCount).fill('');

      const sv = (name: string, fallbackIdx: number, value: string) => {
        const idx = fi(name);
        if (idx !== -1) pedreiraRowFallback[idx] = value;
        else if (fallbackIdx < colCount) pedreiraRowFallback[fallbackIdx] = value;
      };

      sv('ID', 0, Math.random().toString(36).substring(2, 10));
      sv('Data', 1, dataFormatada);
      sv('Hora', 2, formData.horaCarregamento);
      sv('Ordem_Carregamento', 3, formData.numeroPedido || '');
      sv('Fornecedor', 4, formData.fornecedor || '');
      sv('Prefixo_Eq', 5, formData.caminhao);
      sv('Descricao_Eq', 6, selectedCaminhao?.descricao || '');
      sv('Empresa_Eq', 7, selectedCaminhao?.empresa || '');
      sv('Motorista', 8, selectedCaminhao?.motorista || '');
      sv('Placa', 9, selectedCaminhao?.placa || '');
      sv('Material', 10, formData.material);
      sv('Peso_Vazio', 11, formatPesoForSheet(getEffectivePesoVazio()));
      sv('Peso_Final', 12, formatPesoForSheet(formData.pesoFinal));
      sv('Peso_Liquido', 13, derived.pesoLiquido);
      sv('Metro_Cubico', 14, derived.metroCubico);
      sv('Densidade', 15, derived.densidade);
      sv('Tonelada', 16, derived.tonelada);
      sv('Usuario', 17, effectiveName || '');
      sv('Hora_Chegada_Obra', 18, format(new Date(), 'HH:mm'));
      sv('Peso_Chegada_Obra', 19, formatPesoForSheet(formData.pesoChegada));
      sv('Status', 20, 'Finalizado');
      
      const fotoChegadaIdx = fi('Foto do Peso Chegada Obra') !== -1 ? fi('Foto do Peso Chegada Obra') : (fi('Foto') !== -1 ? fi('Foto') : 21);
      if (fotoChegadaIdx !== -1 && fotoChegadaIdx < colCount) pedreiraRowFallback[fotoChegadaIdx] = fotoChegadaUrl;
      
      const fotoPesagemIdx = fi('Foto Pesagem Pedreira') !== -1 ? fi('Foto Pesagem Pedreira') : (fi('Foto_Pesagem_Pedreira') !== -1 ? fi('Foto_Pesagem_Pedreira') : 22);
      if (fotoPesagemIdx !== -1 && fotoPesagemIdx < colCount) pedreiraRowFallback[fotoPesagemIdx] = fotoPesoFinalUrl;

      addPendingRecord('pedreira', 'Apontamento_Pedreira', pedreiraRowFallback, { ...formData });
      setSavedOffline(true);
      setSubmitted(true);
      playOfflineSound();
    } finally {
      setLoading(false);
    }
  };


  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSelectedCaminhao(null);
    setCustomPesoVazio('');
    setFormData({
      ...formData,
      caminhao: '',
      horaCarregamento: format(new Date(), 'HH:mm'),
      numeroPedido: '',
      fornecedor: '',
      pesoFinal: '',
      material: '',
      pesoChegada: '',
    });
  };

  // ===================== LOAD RECORDS =====================
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) { setRecords([]); return; }
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      const userName = effectiveName;
      const parsed: PedreiraRecord[] = [];
      data.slice(1).forEach((row, idx) => {
        const rawDate = row[fi('Data')] || '';
        const rowDate = rawDate.split('/').map(p => p.padStart(2, '0')).join('/');
        const rowUser = row[fi('Usuario')] || '';
        if (rowDate === todayStr && (!userName || rowUser === userName)) {
          parsed.push({
            rowIndex: idx + 2,
            id: row[fi('ID')] || row[0] || '',
            data: rowDate,
            hora: row[fi('Hora')] || '',
            caminhao: row[fi('Prefixo_Eq')] || '',
            motorista: row[fi('Motorista')] || '',
            material: row[fi('Material')] || '',
            pesoFinal: row[fi('Peso_Final')] || '',
            pesoVazio: row[fi('Peso_Vazio')] || '',
            pesoLiquido: row[fi('Peso_Liquido')] || '',
            tonelada: row[fi('Tonelada')] || '',
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

  // Cross-device sync: polling (30s), storage events, and visibility change
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pedreira_data_updated' && showRecords) {
        console.log('[FormPedreira] Data updated signal received, refreshing records...');
        loadRecords();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && showRecords) {
        console.log('[FormPedreira] Tab visible, refreshing records...');
        loadRecords();
      }
    };

    // Poll every 30s for cross-device sync (desktop deletions/updates)
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && showRecords) {
        console.log('[FormPedreira] Polling refresh...');
        loadRecords();
      }
    }, 30_000);

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showRecords, loadRecords]);

  // ===================== EDIT RECORD =====================
  const handleStartEdit = (record: PedreiraRecord) => {
    setEditingRecord(record);
    setEditForm({ pesoFinal: record.pesoFinal.replace(/\./g, ''), material: record.material });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      // Read current row to preserve all columns
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < editingRecord.rowIndex) throw new Error('Registro não encontrado');
      const currentRow = [...data[editingRecord.rowIndex - 1]];
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);

      // Update editable fields
      const newPesoFinal = editForm.pesoFinal;
      if (fi('Material') !== -1) currentRow[fi('Material')] = editForm.material;
      if (fi('Peso_Final') !== -1) currentRow[fi('Peso_Final')] = formatPesoForSheet(newPesoFinal);

      // Recalculate derived values
      const pesoVazio = currentRow[fi('Peso_Vazio')] || '0';
      const derived = calculateDerivedValues(newPesoFinal, pesoVazio);
      if (fi('Peso_Liquido') !== -1) currentRow[fi('Peso_Liquido')] = derived.pesoLiquido;
      if (fi('Metro_Cubico') !== -1) currentRow[fi('Metro_Cubico')] = derived.metroCubico;
      if (fi('Tonelada') !== -1) currentRow[fi('Tonelada')] = derived.tonelada;
      if (fi('Densidade') !== -1) currentRow[fi('Densidade')] = derived.densidade;

      const rowNum = editingRecord.rowIndex;
      const success = await writeSheet('Apontamento_Pedreira', buildRowRange(rowNum, currentRow.length), [currentRow]);
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
  const confirmDeleteRecord = (record: PedreiraRecord) => setRecordToDelete(record);
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    setDeletingId(recordToDelete.id);
    setRecordToDelete(null);
    try {
      const success = await deleteRow('Apontamento_Pedreira', recordToDelete.rowIndex);
      if (success) {
        toast({ title: '🗑️ Registro excluído!' });
        // Signal other tabs (desktop/other mobile tabs) to refresh
        localStorage.setItem('pedreira_data_updated', Date.now().toString());
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
    let msg = `⛰️ *REGISTROS PEDREIRA - ${today}*\n\n👷 Apontador: ${userName}\n📊 Total: ${records.length} registro(s)\n`;
    records.forEach(r => { msg += `\n• ${r.caminhao} — ${r.material} • ${r.tonelada || '-'} ton`; });
    msg += `\n\n---\n_Enviado via ApropriAPP_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';

  if (submitted) {
    const derived = calculateDerivedValues(formData.pesoFinal || '0', selectedCaminhao?.pesoVazio || '0');
    const successDetails = [
      { label: 'Veículo', value: `${formData.caminhao}${selectedCaminhao?.motorista ? ` - ${selectedCaminhao.motorista}` : ''}` },
      { label: 'Placa', value: selectedCaminhao?.placa || '-' },
      { label: 'Empresa', value: selectedCaminhao?.empresa || '-' },
      { label: 'Material', value: formData.material },
      { label: 'Peso Final', value: formData.pesoFinal ? `${formatPesoForSheet(formData.pesoFinal)} kg` : '-' },
      { label: 'Peso Líquido', value: derived.pesoLiquido ? `${derived.pesoLiquido} kg` : '-' },
      { label: 'Tonelada', value: derived.tonelada ? `${derived.tonelada} t` : '-' },
      { label: 'Peso Chegada', value: formData.pesoChegada ? `${formatPesoForSheet(formData.pesoChegada)} kg` : '-' },
    ];

    return (
      <SuccessScreen
        title={savedOffline ? "Salvo Localmente!" : "Carregamento Registrado!"}
        subtitle={savedOffline ? "Será sincronizado quando a conexão voltar." : "O apontamento de pedreira foi salvo."}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor={savedOffline ? "amber" : "amber"}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-amber-500 p-5 sticky top-0 z-10 shadow-md">
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
                <Mountain className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-2xl text-white">Apontar Carregamento</h1>
                <p className="text-base text-white/80">Pedreira</p>
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

        {/* Veículo (Caminhão/Reboque) */}
        {isFieldVisible('veiculo') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <TruckIcon className="w-7 h-7 text-amber-600" />
              Veículo (Caminhão/Reboque)
            </Label>
            <Select 
              value={formData.caminhao} 
              onValueChange={handleCaminhaoChange}
              disabled={isFieldDisabled('veiculo')}
            >
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {caminhoes.map(cam => (
                  <SelectItem key={cam.prefixo} value={cam.prefixo} className="text-lg py-3">
                    {cam.prefixo} - {cam.motorista || cam.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Auto-filled vehicle info */}
            {selectedCaminhao && (
              <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Descrição:</span> 
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.descricao || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Motorista:</span> 
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.motorista || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Empresa:</span> 
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.empresa || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Modelo:</span> 
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.modelo || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Placa:</span> 
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.placa || '-'}</span>
                </div>
                <div className="flex justify-between bg-amber-100 -mx-4 px-4 py-3 rounded-lg mt-2">
                  <span className="text-gray-600 font-bold text-xl">Peso Vazio (Cadastro):</span> 
                  <span className="text-amber-700 font-bold text-2xl">{selectedCaminhao.pesoVazio || '-'} kg</span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Peso Vazio Manual */}
        {isFieldVisible('peso_vazio') && selectedCaminhao && (
          <Card className="bg-amber-50 border-2 border-amber-300 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Scale className="w-7 h-7 text-amber-600" />
              Peso Vazio (kg)
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder={lastPesoVazio ? `Último: ${lastPesoVazio}` : 'Digite apenas números'}
              value={customPesoVazio}
              onChange={e => setCustomPesoVazio(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={isFieldDisabled('peso_vazio')}
              className="bg-white border-2 border-amber-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {customPesoVazio 
                ? <>Será salvo como: <strong>{formatPesoForSheet(customPesoVazio)} kg</strong></>
                : lastPesoVazio 
                  ? `Sugestão do último registro: ${formatPesoForSheet(lastPesoVazio)} kg`
                  : 'Digite apenas números. Ex: 25960 = 25.960,00'
              }
            </p>
          </Card>
        )}

        {/* Hora de Carregamento */}
        {isFieldVisible('hora') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Clock className="w-7 h-7 text-amber-600" />
              Hora de Carregamento
            </Label>
            <div className="flex gap-2">
              <Input
                type="time"
                value={formData.horaCarregamento}
                onChange={e => setFormData({ ...formData, horaCarregamento: e.target.value })}
                disabled={isFieldDisabled('hora')}
                className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ ...formData, horaCarregamento: format(new Date(), 'HH:mm') })}
                className="h-16 px-4 text-sm font-semibold border-2 border-amber-200 text-amber-700 rounded-xl whitespace-nowrap"
              >
                Agora
              </Button>
            </div>
          </Card>
        )}

        {/* Fornecedor */}
        <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
          <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
            <Building className="w-7 h-7 text-amber-600" />
            Fornecedor
          </Label>
          <Select 
            value={formData.fornecedor} 
            onValueChange={v => setFormData({ ...formData, fornecedor: v })}
          >
            <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
              <SelectValue placeholder="Selecione o fornecedor" />
            </SelectTrigger>
            <SelectContent className="bg-white border-2 border-gray-200">
              {fornecedoresPedreira.map(f => (
                <SelectItem key={f.id} value={f.nome} className="text-lg py-3">
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Número do Pedido */}
        {isFieldVisible('numero_pedido') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <FileText className="w-7 h-7 text-amber-600" />
              Nº do Pedido / Ordem de Carregamento
            </Label>
            <Input
              type="text"
              placeholder="Ex: 12345"
              value={formData.numeroPedido}
              onChange={e => setFormData({ ...formData, numeroPedido: e.target.value })}
              disabled={isFieldDisabled('numero_pedido')}
              className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
            />
          </Card>
        )}

        {/* Tipo de Material */}
        {isFieldVisible('material') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Package className="w-7 h-7 text-amber-600" />
              Tipo de Material
            </Label>
            <Select 
              value={formData.material} 
              onValueChange={v => setFormData({ ...formData, material: v })}
              disabled={isFieldDisabled('material')}
            >
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o material" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {materiais.map(mat => (
                  <SelectItem key={mat.id} value={mat.nome} className="text-lg py-3">
                    {mat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        )}

        {/* Peso Final */}
        {isFieldVisible('peso_bruto') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Scale className="w-7 h-7 text-amber-600" />
              Peso Final (kg)
            </Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Digite apenas números"
                value={formData.pesoFinal}
                onChange={e => setFormData({ ...formData, pesoFinal: e.target.value.replace(/[^0-9]/g, '') })}
                disabled={isFieldDisabled('peso_bruto')}
                className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (pesoFinalInputRef.current) {
                    pesoFinalInputRef.current.setAttribute('capture', 'environment');
                    pesoFinalInputRef.current.click();
                  }
                }}
                className="h-16 px-4 border-2 border-gray-300 text-amber-700 rounded-xl"
              >
                <Camera className="w-6 h-6" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (pesoFinalInputRef.current) {
                    pesoFinalInputRef.current.removeAttribute('capture');
                    pesoFinalInputRef.current.click();
                  }
                }}
                className="h-16 px-4 border-2 border-gray-300 text-amber-700 rounded-xl"
              >
                <ImageIcon className="w-6 h-6" />
              </Button>
            </div>
            <input
              ref={pesoFinalInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                setPesoFinalFotoFile(file);
                toast({ title: '📸 Foto capturada!' });
                if (pesoFinalInputRef.current) pesoFinalInputRef.current.value = '';
              }}
            />
            {pesoFinalFotoPreview && (
              <div className="mt-3 relative">
                <img src={pesoFinalFotoPreview} alt="Foto Peso Final" className="w-full max-h-48 object-contain rounded-xl border-2 border-gray-300" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button type="button" size="sm" variant="secondary" className="bg-white/90 text-amber-700 border border-gray-300 rounded-lg text-xs" onClick={() => {
                    if (pesoFinalInputRef.current) {
                      pesoFinalInputRef.current.setAttribute('capture', 'environment');
                      pesoFinalInputRef.current.click();
                    }
                  }}>
                    Trocar
                  </Button>
                  <Button type="button" size="sm" variant="destructive" className="rounded-lg text-xs" onClick={() => {
                    setPesoFinalFotoPreview(null);
                    setPesoFinalFotoFile(null);
                  }}>
                    Excluir
                  </Button>
                </div>
              </div>
            )}
            {formData.pesoFinal && (
              <p className="text-sm text-muted-foreground mt-2">
                Será salvo como: <strong>{formatPesoForSheet(formData.pesoFinal)} kg</strong> — Ex: 91540 = 91.540,00
              </p>
            )}
            {/* Show calculated peso líquido */}
            {formData.pesoFinal && getEffectivePesoVazio() && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl flex justify-between items-center">
                <span className="text-lg text-gray-600 font-medium">Peso Líquido Calculado:</span>
                <span className="text-green-600 font-bold text-2xl">
                  {(() => {
                    const derived = calculateDerivedValues(formData.pesoFinal, getEffectivePesoVazio());
                    return derived.pesoLiquido || '-';
                  })()}
                  {' '}kg
                </span>
              </div>
            )}
          </Card>
        )}

        {/* Calculated Values Display (read-only) */}
        {formData.pesoFinal && getEffectivePesoVazio() && (
          <Card className="bg-green-50 border-2 border-green-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Scale className="w-7 h-7 text-green-600" />
              Valores Calculados Automaticamente
            </Label>
            {(() => {
              const derived = calculateDerivedValues(formData.pesoFinal, getEffectivePesoVazio());
              return (
                <div className="grid grid-cols-2 gap-4 text-lg">
                  <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                    <span className="text-gray-500">Peso Líquido:</span>
                    <span className="text-green-600 font-bold">{derived.pesoLiquido} kg</span>
                  </div>
                  <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                    <span className="text-gray-500">Tonelada:</span>
                    <span className="text-green-600 font-bold">{derived.tonelada} t</span>
                  </div>
                  <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                    <span className="text-gray-500">Metro Cúbico:</span>
                    <span className="text-green-600 font-bold">{derived.metroCubico} m³</span>
                  </div>
                  <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                    <span className="text-gray-500">Densidade:</span>
                    <span className="text-green-600 font-bold">{derived.densidade}</span>
                  </div>
                </div>
              );
            })()}
          </Card>
        )}

        {/* Peso de Chegada na Obra */}
        <Card className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-sm">
          <Label className="text-lg font-bold text-[#1d3557] flex items-center gap-2 mb-3">
            <Weight className="w-6 h-6 text-amber-600" />
            Peso de Chegada na Obra (kg)
          </Label>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Digite apenas números"
              value={formData.pesoChegada}
              onChange={e => setFormData({ ...formData, pesoChegada: e.target.value.replace(/[^0-9]/g, '') })}
              className="bg-white border-2 border-amber-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (ocrInputRef.current) {
                  ocrInputRef.current.setAttribute('capture', 'environment');
                  ocrInputRef.current.click();
                }
              }}
              disabled={ocrLoading}
              className="h-16 px-4 border-2 border-amber-400 text-amber-700 rounded-xl"
            >
              {ocrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (ocrInputRef.current) {
                  ocrInputRef.current.removeAttribute('capture');
                  ocrInputRef.current.click();
                }
              }}
              disabled={ocrLoading}
              className="h-16 px-4 border-2 border-amber-400 text-amber-700 rounded-xl"
            >
              {ocrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
            </Button>
          </div>
          <input
            ref={ocrInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setOcrLoading(true);
              // Always save the photo file regardless of OCR result
              try {
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                  reader.onload = () => resolve(reader.result as string);
                  reader.readAsDataURL(file);
                });
                    setOcrFotoFile(file);
                const response = await supabase.functions.invoke('ocr-peso', {
                  body: { imageBase64: base64 },
                });
                if (response.error) throw response.error;
                const { value } = response.data;
                if (value && value !== 'ERRO') {
                   // OCR returns kg inteiros (ex: 33220 para 33.220 kg)
                   // Raw value is used directly now (no * 100)
                   const rawValue = String(parseInt(value, 10));
                   setFormData(prev => ({ ...prev, pesoChegada: rawValue }));
                   toast({ title: '✅ Peso lido com sucesso!', description: `Valor: ${formatBankInput(rawValue)}` });
                } else {
                  toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR não conseguiu ler, mas a foto foi capturada' });
                }
              } catch (error: any) {
                toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR indisponível, mas a foto foi capturada' });
              } finally {
                setOcrLoading(false);
                if (ocrInputRef.current) ocrInputRef.current.value = '';
              }
            }}
          />
          {ocrFotoPreview && (
            <div className="mt-3 relative">
              <img src={ocrFotoPreview} alt="Foto OCR" className="w-full max-h-48 object-contain rounded-xl border-2 border-amber-300" />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button type="button" size="sm" variant="secondary" className="bg-white/90 text-amber-700 border border-amber-300 rounded-lg text-xs" onClick={() => {
                  if (ocrInputRef.current) {
                    ocrInputRef.current.setAttribute('capture', 'environment');
                    ocrInputRef.current.click();
                  }
                }}>
                  Trocar
                </Button>
                <Button type="button" size="sm" variant="destructive" className="rounded-lg text-xs" onClick={() => {
                  setOcrFotoPreview(null);
                  setOcrFotoFile(null);
                }}>
                  Excluir
                </Button>
              </div>
            </div>
          )}
          {formData.pesoChegada ? (
            <p className="text-sm text-amber-700 mt-2 font-medium">
              Será salvo como: <strong>{formatPesoForSheet(formData.pesoChegada)} kg</strong>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              📸 Toque na câmera para ler da balança ou digite apenas números. Ex: 45320 = 45.320,00
            </p>
          )}
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || sheetLoading || !formData.caminhao || !formData.material}
          className="w-full h-20 text-2xl font-bold bg-amber-500 hover:bg-amber-600 shadow-xl mt-4 rounded-2xl"
        >
          {loading || sheetLoading ? (
            <>
              <Loader2 className="w-8 h-8 mr-3 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-8 h-8 mr-3" />
              Registrar Apontamento
            </>
          )}
        </Button>
      </form>

      {/* =================== MODAL: Meus Registros =================== */}
      <Dialog open={showRecords} onOpenChange={setShowRecords}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-600" />
              Meus Registros de Hoje
              {records.length > 0 && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 ml-auto">{records.length}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {loadingRecords ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado hoje.</p>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => (
                <Card key={rec.id} className="p-4 border-2 border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-base">{rec.caminhao} — {rec.material}</p>
                      <p className="text-sm text-muted-foreground">{rec.hora} • {rec.motorista}</p>
                      <p className="text-sm text-muted-foreground">Peso Final: {rec.pesoFinal} • Líquido: {rec.pesoLiquido}</p>
                      <p className="text-sm font-medium text-amber-700">{rec.tonelada} ton</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" onClick={() => handleStartEdit(rec)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => confirmDeleteRecord(rec)} disabled={deletingId === rec.id}>
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
              <Button variant="outline" className="flex-1 text-amber-700 border-amber-200 hover:bg-amber-50" onClick={generateWhatsAppRecords}>
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
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteRecord}>Excluir</AlertDialogAction>
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
                <p><span className="text-muted-foreground">Veículo:</span> {editingRecord.caminhao}</p>
                <p><span className="text-muted-foreground">Data:</span> {editingRecord.data} — {editingRecord.hora}</p>
                <p><span className="text-muted-foreground">Motorista:</span> {editingRecord.motorista}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Material</Label>
                <Select value={editForm.material} onValueChange={v => setEditForm({ ...editForm, material: v })}>
                  <SelectTrigger className="h-14 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {materiais.map(m => (
                      <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Peso Final (kg)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editForm.pesoFinal}
                  onChange={e => setEditForm({ ...editForm, pesoFinal: e.target.value.replace(/[^0-9]/g, '') })}
                  className="h-14 text-lg"
                />
                {editForm.pesoFinal && (
                  <p className="text-sm text-amber-600 font-medium">
                    Será salvo como: {formatPesoForSheet(editForm.pesoFinal)} kg
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingRecord(null)}>Cancelar</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSaveEdit} disabled={savingEdit || !editForm.pesoFinal}>
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
