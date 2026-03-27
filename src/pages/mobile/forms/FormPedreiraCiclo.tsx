import { useState, useEffect, useCallback, useRef } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Mountain, Loader2, CheckCircle2, Truck as TruckIcon, Package, Clock, FileText, Scale, RefreshCw, Building, ClipboardList, Pencil, Trash2, Search, Factory, Weight, MapPin, Camera, Send, AlertTriangle, History, ImageIcon, Usb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { useFormFieldPermissions } from '@/components/mobile/FieldPermissionWrapper';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';
import QrCodeScanner from '@/components/mobile/QrCodeScanner';
import { useSubmenuPermissions } from '@/hooks/useSubmenuPermissions';
import { FinalizarCicloPendenteModal, PendingCycle } from '@/components/mobile/FinalizarCicloPendenteModal';
import { formatToneladaInput } from '@/utils/masks';

interface MaterialOption {
  id: string;
  nome: string;
}

interface FornecedorPedreiraOption {
  id: string;
  nome: string;
}

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

// Record found by OS search for Balança/Obra steps
interface FoundRecord {
  rowIndex: number;
  row: string[];
  headers: string[];
  status: string;
  ordem: string;
  prefixo: string;
  empresa: string;
  motorista: string;
  placa: string;
  descricao: string;
  fornecedor: string;
  horaSaidaBritador: string;
  horaBalanca: string;
  horaChegadaBalanca: string;
  material: string;
  pesoVazio: string;
  pesoFinal: string;
  pesoLiquido: string;
  tonelada: string;
  metroCubico: string;
}

type EtapaType = 'britador' | 'balanca' | 'obra';

export default function FormPedreira({ desktopMode = false }: { desktopMode?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, loading: sheetLoading, readSheet, writeSheet, deleteRow } = useGoogleSheets();
  const { isOnline, addPendingRecord, pendingCount, syncAllPending, isSyncing } = useOfflineSync();
  const { toast } = useToast();
  const { isFieldVisible, isFieldDisabled, loading: permissionsLoading, hasFullAccess } = useFormFieldPermissions('pedreira');
  const { hasSubmenuPermission, loading: submenuLoading } = useSubmenuPermissions();

  // Determine allowed etapas based on submenu permissions
  const etapaSubmenuMap: Record<EtapaType, string> = {
    britador: 'pedreira_ciclo_britador',
    balanca: 'pedreira_ciclo_balanca',
    obra: 'pedreira_ciclo_obra',
  };

  const allowedEtapas = (['britador', 'balanca', 'obra'] as EtapaType[]).filter(
    step => hasSubmenuPermission(etapaSubmenuMap[step])
  );

  const [loading, setLoading] = useState(false);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]);
  const [fornecedoresPedreira, setFornecedoresPedreira] = useState<FornecedorPedreiraOption[]>([]);
  const [caminhoes, setCaminhoes] = useState<CamReboqueData[]>([]);
  const [areiaExpressVeiculos, setAreiaExpressVeiculos] = useState<{ placa: string; motorista: string; pesoVazio: string; descricao: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  // Step selector - default to first allowed etapa
  const [etapa, setEtapa] = useState<EtapaType>('britador');

  // Auto-select first allowed etapa when permissions load
  useEffect(() => {
    if (!submenuLoading && allowedEtapas.length > 0 && !allowedEtapas.includes(etapa)) {
      setEtapa(allowedEtapas[0]);
    }
  }, [submenuLoading, allowedEtapas, etapa]);

  // Handle query params from PendenteCicloNotification (auto-select etapa + prefill search)
  const [pendingQueryHandled, setPendingQueryHandled] = useState(false);
  const [pendingAutoSearch, setPendingAutoSearch] = useState<{ etapa: EtapaType; term: string } | null>(null);

  useEffect(() => {
    if (pendingQueryHandled || submenuLoading) return;
    const etapaParam = searchParams.get('etapa') as EtapaType | null;
    const prefixoParam = searchParams.get('prefixo') || '';
    const osParam = searchParams.get('os') || '';

    if (etapaParam && (etapaParam === 'balanca' || etapaParam === 'obra')) {
      setEtapa(etapaParam);
      setSearchMode('digitar');
      if (etapaParam === 'balanca' && prefixoParam) {
        setSearchPrefixo(prefixoParam);
        setPendingAutoSearch({ etapa: etapaParam, term: prefixoParam });
      } else if (etapaParam === 'obra' && osParam) {
        setSearchOS(osParam);
        setPendingAutoSearch({ etapa: etapaParam, term: osParam });
      }
      setPendingQueryHandled(true);
    }
  }, [searchParams, submenuLoading, pendingQueryHandled]);

  // Auto-trigger search after query params are handled (for pending cycles from notification)
  useEffect(() => {
    if (!pendingAutoSearch) return;
    // Small delay to ensure state (etapa, searchPrefixo/OS) has settled
    const timer = setTimeout(() => {
      handleSearch();
      setPendingAutoSearch(null);
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoSearch]);

  // Balança sub-tab: 'britaPotiguar' (normal flow from Britador) or 'herval' (direct entry)
  const [balancaTab, setBalancaTab] = useState<'britaPotiguar' | 'herval'>('britaPotiguar');

  // Obra sub-tab: 'ciclo' (normal cycle flow) or 'carregamento' (direct delivery at obra)
  const [obraTab, setObraTab] = useState<'ciclo' | 'carregamento'>('ciclo');

  // Saved plates for carregamento direto (persisted in localStorage)
  const [savedPlates, setSavedPlates] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('pedreira_saved_plates');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Carregamento direto na Obra form
  const [formCarregamento, setFormCarregamento] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    placa: '',
    motorista: '',
    horaChegada: format(new Date(), 'HH:mm'),
    fornecedor: 'Areia Express',
    numeroPedido: '',
    quantidade: '',
    material: '',
    pesoVazio: '',
    pesoFinal: '',
  });
  const [customCarregamentoPesoVazio, setCustomCarregamentoPesoVazio] = useState('');
  const [plateFilter, setPlateFilter] = useState('');
  
  // Auto-advance refs for carregamento direto
  const carregFornecedorRef = useRef<HTMLDivElement>(null);
  const carregOsRef = useRef<HTMLDivElement>(null);
  const carregQtdRef = useRef<HTMLDivElement>(null);
  const carregHoraRef = useRef<HTMLDivElement>(null);
  const carregMaterialRef = useRef<HTMLDivElement>(null);
  const carregPesoRef = useRef<HTMLDivElement>(null);
  const carregSubmitRef = useRef<HTMLDivElement>(null);
  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  };

  // Diesel density constant (kg/L)
  const DIESEL_DENSITY = 0.832;
  const isDieselMaterial = (material: string, fornecedor: string) => {
    const combined = `${material} ${fornecedor}`.toLowerCase();
    return combined.includes('diesel') || combined.includes('óleo diesel') || combined.includes('oleo diesel');
  };
  const calculateLitros = (pesoLiquidoKg: number) => pesoLiquidoKg / DIESEL_DENSITY;
  
  // Two-step carregamento direto: pending records
  const [carregPendentes, setCarregPendentes] = useState<any[]>([]);
  const [selectedCarregPendente, setSelectedCarregPendente] = useState<any | null>(null);
  const [carregPesoSaida, setCarregPesoSaida] = useState('');
  const [carregHoraSaida, setCarregHoraSaida] = useState(format(new Date(), 'HH:mm'));
  const [carregStep, setCarregStep] = useState<'form' | 'pendentes'>('form');

  // Carregamento Direto OCR - Peso Chegada (Step 1)
  const [carregChegadaOcrLoading, setCarregChegadaOcrLoading] = useState(false);
  const [carregChegadaFotoFile, setCarregChegadaFotoFile] = useState<File | null>(null);
  const [carregChegadaFotoPreview, setCarregChegadaFotoPreview] = useState<string | null>(null);
  const carregChegadaOcrInputRef = useRef<HTMLInputElement>(null);

  // Carregamento Direto OCR - Peso Saída (Step 2)
  const [carregSaidaOcrLoading, setCarregSaidaOcrLoading] = useState(false);
  const [carregSaidaFotoFile, setCarregSaidaFotoFile] = useState<File | null>(null);
  const [carregSaidaFotoPreview, setCarregSaidaFotoPreview] = useState<string | null>(null);
  const carregSaidaOcrInputRef = useRef<HTMLInputElement>(null);

  const savePlate = (plate: string, motorista?: string) => {
    const upper = plate.toUpperCase().trim();
    if (!upper) return;
    const updated = [upper, ...savedPlates.filter(p => p !== upper)].slice(0, 50);
    setSavedPlates(updated);
    localStorage.setItem('pedreira_saved_plates', JSON.stringify(updated));
    // Save plate→motorista mapping
    if (motorista) {
      try {
        const stored = localStorage.getItem('pedreira_plate_motoristas');
        const map: Record<string, string> = stored ? JSON.parse(stored) : {};
        map[upper] = motorista;
        localStorage.setItem('pedreira_plate_motoristas', JSON.stringify(map));
      } catch { /* ignore */ }
    }
  };

  const getMotoristaByPlate = (plate: string): string => {
    try {
      const stored = localStorage.getItem('pedreira_plate_motoristas');
      if (!stored) return '';
      const map: Record<string, string> = JSON.parse(stored);
      return map[plate.toUpperCase().trim()] || '';
    } catch { return ''; }
  };

  // Herval direct entry form
  const [formHerval, setFormHerval] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    caminhao: '',
    horaChegada: format(new Date(), 'HH:mm'),
    horaSaida: '',
    numeroPedido: '',
    material: '',
    pesoVazio: '',
    pesoFinal: '',
  });
  const [selectedHervalCaminhao, setSelectedHervalCaminhao] = useState<CamReboqueData | null>(null);
  const [customHervalPesoVazio, setCustomHervalPesoVazio] = useState('');

  // Herval carregamento type: 'proprio' (uses obra fleet) or 'veiculo_herval' (Herval's own vehicles)
  const [hervalCarregTipo, setHervalCarregTipo] = useState<'proprio' | 'veiculo_herval'>('proprio');

  // Herval own vehicle form fields
  const [formHervalVeiculo, setFormHervalVeiculo] = useState({
    placa: '',
    motorista: '',
    descricao: '',
  });

  // Saved Herval vehicles (loaded from Google Sheets "Caminhões Herval")
  interface HervalVeiculo { placa: string; motorista: string; descricao: string; pesoVazio?: string }
  const [savedHervalVeiculos, setSavedHervalVeiculos] = useState<HervalVeiculo[]>([]);
  const [hervalVeiculoFilter, setHervalVeiculoFilter] = useState('');

  // Load Herval vehicles from Google Sheet
  useEffect(() => {
    const loadHervalVeiculos = async () => {
      try {
        const rows = await readSheet('Caminhões Herval');
        if (rows.length < 2) return;
        const headers = rows[0].map((h: string) => (h || '').toString().trim().toUpperCase().replace(/\s+/g, '_'));
        const iPlaca = headers.findIndex((h: string) => h.includes('PLACA'));
        const iDesc = headers.findIndex((h: string) => h.includes('DESCRI'));
        const iMotorista = headers.findIndex((h: string) => h.includes('MOTORISTA'));
        const iPeso = headers.findIndex((h: string) => h.includes('PESO'));
        const parsed: HervalVeiculo[] = rows.slice(1)
          .map((r: any[]) => {
            const placa = (r[iPlaca] || '').toString().trim();
            if (!placa) return null;
            return {
              placa,
              motorista: (r[iMotorista] || '').toString().trim(),
              descricao: (r[iDesc] || '').toString().trim(),
              pesoVazio: (r[iPeso] || '').toString().trim(),
            };
          })
          .filter(Boolean) as HervalVeiculo[];
        setSavedHervalVeiculos(parsed);
      } catch (err) {
        console.error('Erro ao carregar veículos Herval:', err);
      }
    };
    loadHervalVeiculos();
  }, [readSheet]);

  const getHervalMotoristaByPlate = (placa: string): HervalVeiculo | undefined => {
    return savedHervalVeiculos.find(v => v.placa.toUpperCase() === placa.toUpperCase().trim());
  };

  // Transit records for Balança and Obra
  const [transitRecords, setTransitRecords] = useState<{ prefixo: string; motorista: string; empresa: string; horaSaida: string; ordem: string; status: string }[]>([]);
  const [loadingTransit, setLoadingTransit] = useState(false);

  // Pending cycles (from previous days - Saiu_Britador or Pesado)
  const [pendingCycles, setPendingCycles] = useState<PendingCycle[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedPendingCycle, setSelectedPendingCycle] = useState<PendingCycle | null>(null);
  const [showFinalizarPendenteModal, setShowFinalizarPendenteModal] = useState(false);

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

  // Britador form data
  const [formBritador, setFormBritador] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    caminhao: '',
    horaSaida: format(new Date(), 'HH:mm'),
  });

  // Balança form data (after finding record by Prefixo)
  const [searchPrefixo, setSearchPrefixo] = useState('');
  const [searchOS, setSearchOS] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundRecord, setFoundRecord] = useState<FoundRecord | null>(null);
  const [searchMode, setSearchMode] = useState<'digitar' | 'lista' | 'qrcode'>('digitar');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [formBalanca, setFormBalanca] = useState({
    horaChegada: format(new Date(), 'HH:mm'),
    horaSaida: '',
    numeroPedido: '',
    fornecedor: '',
    material: '',
    pesoVazio: '',
    pesoFinal: '',
  });

  // Obra form data (after finding record by OS)
  const [formObra, setFormObra] = useState({
    horaChegada: format(new Date(), 'HH:mm'),
    pesoChegada: '',
    pesoVazio: '',
    ocrFotoFile: null as File | null,
  });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrFotoPreview, setOcrFotoPreview] = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // Balança Peso Vazio OCR
  const [pesoVazioOcrLoading, setPesoVazioOcrLoading] = useState(false);
  const [pesoVazioOcrFotoFile, setPesoVazioOcrFotoFile] = useState<File | null>(null);
  const [pesoVazioOcrFotoPreview, setPesoVazioOcrFotoPreview] = useState<string | null>(null);
  const pesoVazioOcrInputRef = useRef<HTMLInputElement>(null);

  // Balança photo (scale proof)
  const [balancaFotoFile, setBalancaFotoFile] = useState<File | null>(null);
  const [balancaFotoPreview, setBalancaFotoPreview] = useState<string | null>(null);
  const balancaFotoInputRef = useRef<HTMLInputElement>(null);
  const [hervalFotoFile, setHervalFotoFile] = useState<File | null>(null);
  const [hervalFotoPreview, setHervalFotoPreview] = useState<string | null>(null);
  const hervalFotoInputRef = useRef<HTMLInputElement>(null);
  const [hervalFotoFile2, setHervalFotoFile2] = useState<File | null>(null);
  const [hervalFotoPreview2, setHervalFotoPreview2] = useState<string | null>(null);
  const hervalFotoInputRef2 = useRef<HTMLInputElement>(null);

  // Transfer to Obra state
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [cancellingTransfer, setCancellingTransfer] = useState(false);
  const [showCancelTransferConfirm, setShowCancelTransferConfirm] = useState(false);

  // Transfer feature visibility toggle (persisted)
  const [transferEnabled, setTransferEnabled] = useState(() => {
    try {
      return localStorage.getItem('pedreira_transfer_enabled') === 'true';
    } catch { return false; }
  });
  const [showEnableTransferConfirm, setShowEnableTransferConfirm] = useState(false);

  // Auto-transfer toggle (persisted per day)
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [autoTransfer, setAutoTransfer] = useState(() => {
    const stored = localStorage.getItem('pedreira_auto_transfer');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.date === format(new Date(), 'yyyy-MM-dd') && parsed.enabled;
      } catch { return false; }
    }
    return false;
  });
  const [autoTransferring, setAutoTransferring] = useState(false);

  // Extra fields for transferred records (no balança weighing)
  // Two-step flow: Step 1 = material + pesoFinal (carregado). Step 2 = pesoVazio (after unloading)
  const [formObraExtra, setFormObraExtra] = useState({
    material: '',
    pesoVazio: '',
    pesoFinal: '',
    numeroPedido: '',
  });

  // Obra Step 2 vazio photo
  const [obraVazioFotoFile, setObraVazioFotoFile] = useState<File | null>(null);
  const [obraVazioFotoPreview, setObraVazioFotoPreview] = useState<string | null>(null);
  const obraVazioFotoInputRef = useRef<HTMLInputElement>(null);

  // Track if the found record is in "Pendente_Obra" state (step 2 = just needs peso vazio)
  const isPendenteObra = foundRecord?.status === 'Pendente_Obra';

  useEffect(() => {
    if (balancaFotoFile) {
      const url = URL.createObjectURL(balancaFotoFile);
      setBalancaFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBalancaFotoPreview(null);
    }
  }, [balancaFotoFile]);

  useEffect(() => {
    if (hervalFotoFile) {
      const url = URL.createObjectURL(hervalFotoFile);
      setHervalFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setHervalFotoPreview(null);
    }
  }, [hervalFotoFile]);

  useEffect(() => {
    if (hervalFotoFile2) {
      const url = URL.createObjectURL(hervalFotoFile2);
      setHervalFotoPreview2(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setHervalFotoPreview2(null);
    }
  }, [hervalFotoFile2]);

  useEffect(() => {
    if (formObra.ocrFotoFile) {
      const url = URL.createObjectURL(formObra.ocrFotoFile);
      setOcrFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOcrFotoPreview(null);
    }
  }, [formObra.ocrFotoFile]);

  useEffect(() => {
    if (pesoVazioOcrFotoFile) {
      const url = URL.createObjectURL(pesoVazioOcrFotoFile);
      setPesoVazioOcrFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPesoVazioOcrFotoPreview(null);
    }
  }, [pesoVazioOcrFotoFile]);

  useEffect(() => {
    if (carregChegadaFotoFile) {
      const url = URL.createObjectURL(carregChegadaFotoFile);
      setCarregChegadaFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCarregChegadaFotoPreview(null);
    }
  }, [carregChegadaFotoFile]);

  useEffect(() => {
    if (carregSaidaFotoFile) {
      const url = URL.createObjectURL(carregSaidaFotoFile);
      setCarregSaidaFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCarregSaidaFotoPreview(null);
    }
  }, [carregSaidaFotoFile]);

  useEffect(() => {
    if (obraVazioFotoFile) {
      const url = URL.createObjectURL(obraVazioFotoFile);
      setObraVazioFotoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setObraVazioFotoPreview(null);
    }
  }, [obraVazioFotoFile]);

  const [successDetails, setSuccessDetails] = useState<{ label: string; value: string }[]>([]);
  const [successTitle, setSuccessTitle] = useState('');
  const [successSubtitle, setSuccessSubtitle] = useState('');
  const [successImageUrl, setSuccessImageUrl] = useState<string | null>(null);

  // Load options + sheet headers
  useEffect(() => {
    const loadOptions = async () => {
      const { data: materiaisData } = await supabase
        .from('materiais_pedreira')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      if (materiaisData) setMateriais(materiaisData);

      const { data: fornecedoresData } = await supabase
        .from('fornecedores_pedreira')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      if (fornecedoresData) setFornecedoresPedreira(fornecedoresData);

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

      // Load Caminhões Areia Express
      const areiaData = await readSheet('Caminhões Areia Express');
      if (areiaData && areiaData.length > 1) {
        const aHeaders = areiaData[0].map((h: string) => (h || '').toString().trim().toUpperCase().replace(/\s+/g, '_'));
        const aIdx = (names: string[]) => aHeaders.findIndex((h: string) => names.some(name => h.includes(name)));
        const iPlaca = aIdx(['PLACA', 'VEICULO', 'EQUIPAMENTO', 'PREFIXO', 'ID']);
        const iMotorista = aIdx(['MOTORISTA', 'CONDUTOR', 'OPERADOR', 'NOME']);
        const iPeso = aIdx(['PESO', 'TARA', 'PESO_V', 'PV', 'PESO_VAZIO']);
        const iDesc = aIdx(['DESCRI', 'MODELO', 'TIPO', 'ESPECIFICA']);
        const veiculos = areiaData.slice(1)
          .filter((r: any[]) => r[iPlaca] && r[iPlaca].toString().trim())
          .map((r: any[]) => ({
            placa: (r[iPlaca] || '').toString().trim().toUpperCase(),
            motorista: (r[iMotorista] || '').toString().trim(),
            pesoVazio: (r[iPeso] || '').toString().trim(),
            descricao: (r[iDesc] || '').toString().trim(),
          }));
        setAreiaExpressVeiculos(veiculos);
      }
      const pedrData = await readSheet('Apontamento_Pedreira', 'A1:AZ1');
      if (pedrData && pedrData.length > 0) {
        setSheetHeaders(pedrData[0]);
        console.log('[PedreiraCiclo] Sheet headers:', pedrData[0]);
      }
    };
    loadOptions();
  }, [readSheet]);

  // Load transit records when switching tabs
  const loadTransitRecords = useCallback(async (targetStatus: string) => {
    setLoadingTransit(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) { setTransitRecords([]); return; }
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      
      const records: typeof transitRecords = [];
      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        const rawDate = row[fi('Data')] || '';
        const rowDate = rawDate.split('/').map(p => p.padStart(2, '0')).join('/');
        const status = row[fi('Status')] || '';
        // For Obra, load both 'Pesado' and 'Pendente_Obra' records
        const statusMatch = targetStatus === 'Pesado' 
          ? (status === 'Pesado' || status === 'Pendente_Obra')
          : status === targetStatus;
        if (rowDate === todayStr && statusMatch) {
          records.push({
            prefixo: row[fi('Prefixo_Eq')] || '',
            motorista: row[fi('Motorista')] || '',
            empresa: row[fi('Empresa_Eq')] || '',
            horaSaida: row[fi('Hora_Saida_Britador')] || '',
            ordem: row[fi('Ordem_Carregamento')] || '',
            status,
          });
        }
      }
      setTransitRecords(records);
    } catch (error) {
      console.error('Error loading transit:', error);
    } finally {
      setLoadingTransit(false);
    }
  }, [readSheet]);

  // Load pending cycles from previous days (status Saiu_Britador or Pesado, not today)
  const loadPendingCycles = useCallback(async () => {
    setLoadingPending(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) { setPendingCycles([]); return; }
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

      const pending: PendingCycle[] = [];
      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        const rawDate = (row[fi('Data')] || '').split('/').map((p: string) => p.padStart(2, '0')).join('/');
        const status = (row[fi('Status')] || '') as 'Saiu_Britador' | 'Pesado';
        // Only records from previous days (not today) with pending status
        if (rawDate !== todayStr && (status === 'Saiu_Britador' || status === 'Pesado')) {
          pending.push({
            rowIndex: i + 1,
            prefixo: row[fi('Prefixo_Eq')] || '',
            motorista: row[fi('Motorista')] || '',
            empresa: row[fi('Empresa_Eq')] || '',
            status,
            data: rawDate,
            ordem: row[fi('Ordem_Carregamento')] || '',
            horaSaida: row[fi('Hora_Saida_Britador')] || '',
            material: row[fi('Material')] || '',
            tonelada: row[fi('Tonelada')] || '',
          });
          if (pending.length >= 20) break; // limit to recent 20
        }
      }
      setPendingCycles(pending);
    } catch (error) {
      console.error('Error loading pending cycles:', error);
    } finally {
      setLoadingPending(false);
    }
  }, [readSheet]);

  // Reload transit when etapa changes; always load pending cycles
  useEffect(() => {
    if (etapa === 'balanca') {
      loadTransitRecords('Saiu_Britador');
    } else if (etapa === 'obra') {
      // Load both 'Pesado' (new arrivals) and 'Pendente_Obra' (awaiting peso vazio)
      loadTransitRecords('Pesado');
    }
    loadPendingCycles();
  }, [etapa, loadTransitRecords, loadPendingCycles]);

  // Cross-device sync: refresh data via polling (30s), storage events, and visibility change
  useEffect(() => {
    const refreshData = () => {
      if (etapa === 'balanca') {
        loadTransitRecords('Saiu_Britador');
      } else if (etapa === 'obra') {
        loadTransitRecords('Pesado');
      }
      loadPendingCycles();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pedreira_data_updated') {
        console.log('[PedreiraCiclo] Data updated signal received, refreshing...');
        refreshData();
        setFoundRecord(null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PedreiraCiclo] Tab visible, refreshing...');
        refreshData();
      }
    };

    // Poll every 30s for cross-device sync (desktop deletions/updates)
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('[PedreiraCiclo] Polling refresh...');
        refreshData();
      }
    }, 30_000);

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [etapa, loadTransitRecords, loadPendingCycles]);

  // Handle caminhao selection
  const handleCaminhaoChange = (prefixo: string) => {
    const found = caminhoes.find(c => c.prefixo === prefixo);
    setSelectedCaminhao(found || null);
    setFormBritador({ ...formBritador, caminhao: prefixo });
    if (found?.pesoVazio) {
      setCustomPesoVazio(found.pesoVazio);
    } else if (lastPesoVazio) {
      setCustomPesoVazio(lastPesoVazio);
    }
  };

  // ====== Numeric helpers ======
  const parseBRNumber = (value: string): number => {
    if (!value) return NaN;
    const cleaned = String(value).trim();
    if (cleaned.includes(',')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(cleaned);
  };

  const formatBankInput = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const value = parseInt(digits, 10);
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDecimalBR = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPesoForSheet = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return value;
    const num = parseInt(digits, 10);
    if (isNaN(num)) return value;
    return formatDecimalBR(num);
  };

  const parseBankDigits = (raw: string): number => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return NaN;
    return parseInt(digits, 10);
  };

  const calculateDerivedValues = (pesoFinalRaw: string, pesoVazioRaw: string) => {
    let pesoFinalNum: number;
    let pesoVazioNum: number;
    
    if (pesoFinalRaw.includes(',') || pesoFinalRaw.includes('.')) {
      pesoFinalNum = parseBRNumber(pesoFinalRaw);
    } else {
      pesoFinalNum = parseBankDigits(pesoFinalRaw);
    }
    
    if (pesoVazioRaw.includes(',') || pesoVazioRaw.includes('.')) {
      pesoVazioNum = parseBRNumber(pesoVazioRaw);
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
  
  const supabaseBackupPedreira = async (row: any[], headers: string[]) => {
    try {
      const fi = (name: string) => headers.indexOf(name);
      const getVal = (name: string) => {
        const idx = fi(name);
        return idx !== -1 ? row[idx] : '';
      };

      const dataStr = getVal('Data');
      const horaStr = getVal('Hora');
      const prefixo = getVal('Prefixo_Eq');
      const material = getVal('Material');
      const pesoFinal = getVal('Peso_Final');
      const tonelada = getVal('Tonelada');
      
      const fotoChegada = getVal('Foto do Peso Chegada Obra') || getVal('Foto_Peso_Chegada') || getVal('Foto Peso Chegada') || '';
      const fotoPesagem = getVal('Foto Pesagem Pedreira') || getVal('Foto_Pesagem_Pedreira') || '';

      const { error } = await supabase.from('movimentacoes_pedreira').upsert({
        external_id: getVal('ID'),
        data: dataStr ? format(new Date(dataStr.split('/').reverse().join('-')), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        hora: horaStr || format(new Date(), 'HH:mm:ss'),
        prefixo_caminhao: prefixo,
        empresa_caminhao: getVal('Empresa_Eq'),
        motorista: getVal('Motorista'),
        fornecedor: getVal('Fornecedor'),
        material: material,
        nota_fiscal: getVal('Ordem_Carregamento'),
        viagens: 1,
        volume: parseBRNumber(pesoFinal),
        volume_total: parseBRNumber(tonelada),
        usuario: effectiveName,
        foto_path: fotoChegada,
        nf_foto_path: fotoPesagem,
      }, { onConflict: 'external_id' });
      
      if (error) console.error('Supabase backup error (Pedreira Ciclo):', error);
    } catch (e) {
      console.error('Failed to insert in Supabase (Pedreira Ciclo):', e);
    }
  };

  // =================== SEARCH BY PREFIXO (Balança) or OS (Obra) ===================
  const handleSearchByPrefixo = async (prefixo: string) => {
    setSearching(true);
    setFoundRecord(null);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) {
        toast({ title: 'Nenhum registro encontrado', variant: 'destructive' });
        return;
      }
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);

      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        const rowPrefixo = (row[fi('Prefixo_Eq')] || '').trim();
        if (rowPrefixo.toLowerCase() !== prefixo.toLowerCase()) continue;
        
        const status = row[fi('Status')] || '';
        // Skip records that are not in 'Saiu_Britador' status — keep searching for pending ones
        if (status !== 'Saiu_Britador' && status !== '') {
          continue;
        }

        setFoundRecord({
          rowIndex: i + 1,
          row: [...row],
          headers,
          status,
          ordem: row[fi('Ordem_Carregamento')] || '',
          prefixo: row[fi('Prefixo_Eq')] || '',
          empresa: row[fi('Empresa_Eq')] || '',
          motorista: row[fi('Motorista')] || '',
          placa: row[fi('Placa')] || '',
          descricao: row[fi('Descricao_Eq')] || '',
          fornecedor: row[fi('Fornecedor')] || '',
          horaSaidaBritador: row[fi('Hora_Saida_Britador')] || '',
          horaBalanca: row[fi('Hora')] || '',
          horaChegadaBalanca: row[fi('Hora_Chegada_Balanca')] || '',
          material: row[fi('Material')] || '',
          pesoVazio: row[fi('Peso_Vazio')] || '',
          pesoFinal: row[fi('Peso_Final')] || '',
          pesoLiquido: row[fi('Peso_Liquido_Cubico')] || row[fi('Peso_Liquido')] || '',
          tonelada: row[fi('Tonelada')] || '',
          metroCubico: row[fi('Metro_Cubico')] || '',
        });

        setFormBalanca({
          horaChegada: format(new Date(), 'HH:mm'),
          horaSaida: '',
          numeroPedido: '',
          fornecedor: row[fi('Fornecedor')] || '',
          material: row[fi('Material')] || '',
          pesoVazio: '',
          pesoFinal: '',
        });
        const pvz = row[fi('Peso_Vazio')] || '';
        if (pvz) setCustomPesoVazio(pvz);

        toast({ title: '✅ Registro encontrado!' });
        return;
      }

      toast({ title: 'Veículo não encontrado', description: `Nenhum registro pendente para "${prefixo}"`, variant: 'destructive' });
    } catch (error: any) {
      toast({ title: 'Erro ao buscar', description: error.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    const searchTerm = etapa === 'balanca' ? searchPrefixo.trim() : searchOS.trim();
    if (!searchTerm) {
      toast({ title: etapa === 'balanca' ? 'Informe o prefixo do veículo' : 'Informe o nº da OS/Ordem', variant: 'destructive' });
      return;
    }
    setSearching(true);
    setFoundRecord(null);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) {
        toast({ title: 'Nenhum registro encontrado', variant: 'destructive' });
        return;
      }
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);

      // Search from bottom up for the most recent match
      // When coming from a pending cycle notification, also allow yesterday's records
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getDate().toString().padStart(2, '0')}/${(yesterday.getMonth() + 1).toString().padStart(2, '0')}/${yesterday.getFullYear()}`;
      // If came from pending cycle param, allow yesterday too
      const allowYesterday = pendingQueryHandled;

      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        
        // Balança searches by Prefixo, Obra searches by OS
        if (etapa === 'balanca') {
          const prefixo = (row[fi('Prefixo_Eq')] || '').trim();
          if (prefixo.toLowerCase() !== searchTerm.toLowerCase()) continue;
        } else {
          const ordem = (row[fi('Ordem_Carregamento')] || '').trim();
          if (ordem !== searchTerm) continue;
        }

        // Check date — allow today always; allow yesterday only when coming from pending notification
        const rawDate = (row[fi('Data')] || '').split('/').map((p: string) => p.padStart(2, '0')).join('/');
        if (rawDate !== todayStr && !(allowYesterday && rawDate === yesterdayStr)) continue;
        
        const status = row[fi('Status')] || '';
        const ordem = row[fi('Ordem_Carregamento')] || '';
          
        // For Balança, only allow records with status "Saiu_Britador"
        // For Obra, only allow records with status "Pesado"
        // IMPORTANT: use `continue` (not `return`) so we keep searching for other pending records
        if (etapa === 'balanca' && status !== 'Saiu_Britador') {
          if (!status) {
            // Legacy records without status - allow balança to fill
          } else {
            continue; // skip this record, keep searching for a 'Saiu_Britador' one
          }
        }
          
        if (etapa === 'obra' && status !== 'Pesado' && status !== 'Pendente_Obra') {
          continue; // skip this record, keep searching for a 'Pesado' or 'Pendente_Obra' one
        }

        setFoundRecord({
          rowIndex: i + 1,
          row: [...row],
          headers,
          status,
          ordem,
          prefixo: row[fi('Prefixo_Eq')] || '',
          empresa: row[fi('Empresa_Eq')] || '',
          motorista: row[fi('Motorista')] || '',
          placa: row[fi('Placa')] || '',
          descricao: row[fi('Descricao_Eq')] || '',
          fornecedor: row[fi('Fornecedor')] || '',
          horaSaidaBritador: row[fi('Hora_Saida_Britador')] || '',
          horaBalanca: row[fi('Hora')] || '',
          horaChegadaBalanca: row[fi('Hora_Chegada_Balanca')] || '',
          material: row[fi('Material')] || '',
          pesoVazio: row[fi('Peso_Vazio')] || '',
          pesoFinal: row[fi('Peso_Final')] || '',
          pesoLiquido: row[fi('Peso_Liquido_Cubico')] || row[fi('Peso_Liquido')] || '',
          tonelada: row[fi('Tonelada')] || '',
          metroCubico: row[fi('Metro_Cubico')] || '',
        });

        // Pre-fill balança form
        if (etapa === 'balanca') {
          setFormBalanca({
            horaChegada: format(new Date(), 'HH:mm'),
            horaSaida: '',
            numeroPedido: '',
            fornecedor: row[fi('Fornecedor')] || '',
            material: row[fi('Material')] || '',
            pesoVazio: '',
            pesoFinal: '',
          });
          const pvz = row[fi('Peso_Vazio')] || '';
          if (pvz) setCustomPesoVazio(pvz);
        }

        toast({ title: '✅ Registro encontrado!' });
        return;
      }

      toast({ title: etapa === 'balanca' ? 'Veículo não encontrado' : 'OS não encontrada', description: `Nenhum registro encontrado para "${searchTerm}"`, variant: 'destructive' });
    } catch (error: any) {
      toast({ title: 'Erro ao buscar', description: error.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  // =================== SUBMIT BRITADOR ===================
  const handleSubmitBritador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBritador.caminhao) {
      toast({ title: 'Selecione o veículo', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setSavedOffline(false);

    try {
      const dataAtual = isSalaTecnica ? formBritador.data : format(new Date(), 'yyyy-MM-dd');
      const dataFormatada = format(new Date(dataAtual + 'T12:00:00'), 'dd/MM/yyyy');
      const generateId = () => Math.random().toString(36).substring(2, 10);

      // Use header-based mapping to ensure correct column alignment
      // If headers haven't been loaded yet, read them now
      let headers = sheetHeaders;
      if (!headers || headers.length === 0) {
        const headerData = await readSheet('Apontamento_Pedreira', 'A1:AZ1');
        if (headerData && headerData.length > 0) {
          headers = headerData[0];
          setSheetHeaders(headers);
        }
      }

      // Build row based on headers
      const fi = (name: string) => {
        const idx = headers.indexOf(name);
        return idx;
      };

      // Create row with correct number of columns
      const colCount = headers.length;
      const pedreiraRow: string[] = new Array(colCount).fill('');

      // Map values to correct header positions
      // Fallback indices match actual sheet: A=ID(0),B=Data(1),C=Hora_Saida_Britador(2),
      // D=Hora_Chegada_Balanca(3),E=Hora_Saida_Balanca(4),F=Hora_Chegada_Obra(5),G=Hora(6),
      // H=Ordem_Carregamento(7),I=Fornecedor(8),J=Prefixo_Eq(9),K=Descricao_Eq(10),
      // L=Empresa_Eq(11),M=Motorista(12),N=Placa(13),O=Material(14),P=Peso_Vazio(15),
      // Q=Peso_Final(16),R=Peso_Liquido(17),S=Metro_Cubico(18),T=Densidade(19),
      // U=Tonelada(20),V=Usuario_Obra(21),W=Status(22)
      const setValue = (headerName: string, fallbackIdx: number, value: string) => {
        const idx = fi(headerName);
        if (idx !== -1) pedreiraRow[idx] = value;
        else pedreiraRow[fallbackIdx] = value;
      };

      setValue('ID', 0, generateId());
      setValue('Data', 1, dataFormatada);
      // Hora, Ordem left empty (filled by Balança)
      setValue('Fornecedor', 8, 'Brita Potiguar');
      setValue('Prefixo_Eq', 9, formBritador.caminhao);
      setValue('Descricao_Eq', 10, selectedCaminhao?.descricao || '');
      setValue('Empresa_Eq', 11, selectedCaminhao?.empresa || '');
      setValue('Motorista', 12, selectedCaminhao?.motorista || '');
      setValue('Placa', 13, selectedCaminhao?.placa || '');
      // Material, weights left empty (filled by Balança)
      const horaSaidaFinal = formBritador.horaSaida || format(new Date(), 'HH:mm');
      setValue('Hora_Saida_Britador', 2, horaSaidaFinal);
      // Usuario_Obra stores the current user based on the stage
      setValue('Usuario_Obra', 21, effectiveName);
      // Hora_Chegada_Obra left empty (filled by Obra)
      setValue('Status', 22, 'Saiu_Britador');

      console.log('[Britador] Headers:', headers);
      console.log('[Britador] Row mapped:', pedreiraRow);

      if (!isOnline) {
        addPendingRecord('pedreira', 'Apontamento_Pedreira', pedreiraRow, { formData: formBritador });
        setSavedOffline(true);
        playOfflineSound();
      } else {
        // Check if same truck already has an active row today (Saiu_Britador) to avoid duplicates
        let existingRowIndex = -1;
        try {
          const allData = await readSheet('Apontamento_Pedreira');
          if (allData && allData.length > 1) {
            const hdr = allData[0];
            const prefixoIdx = hdr.indexOf('Prefixo_Eq');
            const dataIdx = hdr.indexOf('Data');
            const statusHdrIdx = hdr.indexOf('Status');
            for (let r = 1; r < allData.length; r++) {
              const row = allData[r];
              if (
                (row[prefixoIdx] || '').trim() === formBritador.caminhao.trim() &&
                (row[dataIdx] || '').trim() === dataFormatada &&
                (row[statusHdrIdx] || '').trim() === 'Saiu_Britador'
              ) {
                existingRowIndex = r + 1; // 1-based sheet row
                break;
              }
            }
          }
        } catch (searchErr) {
          console.warn('[Britador] Could not search for existing row:', searchErr);
        }

        let success: boolean;
        if (existingRowIndex > 1) {
          console.log(`[Britador] Found existing row ${existingRowIndex} for ${formBritador.caminhao}, updating instead of appending`);
          success = await writeSheet('Apontamento_Pedreira', buildRowRange(existingRowIndex, pedreiraRow.length), [pedreiraRow]);
        } else {
          success = await appendSheet('Apontamento_Pedreira', [pedreiraRow]);
        }
        if (!success) throw new Error('Erro ao salvar');
        // Signal desktop tabs to refresh
        localStorage.setItem('pedreira_data_updated', Date.now().toString());
        playSuccessSound();
      }

      setSuccessTitle(savedOffline ? 'Salvo Localmente!' : 'Saída Registrada!');
      setSuccessSubtitle(`Caminhão ${formBritador.caminhao} saiu do britador.`);
      setSuccessDetails([
        { label: 'Etapa', value: '🏗️ Britador - Saída' },
        { label: 'Veículo', value: `${formBritador.caminhao}${selectedCaminhao?.motorista ? ` - ${selectedCaminhao.motorista}` : ''}` },
        { label: 'Hora Saída', value: horaSaidaFinal },
        { label: 'Status', value: 'Saiu do Britador' },
      ]);
      setSuccessImageUrl(null);
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // =================== SUBMIT BALANÇA ===================
  const handleSubmitBalanca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundRecord) return;
    if (!formBalanca.material || !formBalanca.pesoFinal) {
      toast({ title: 'Preencha material e peso final', variant: 'destructive' });
      return;
    }
    setLoading(true);

    try {
      const headers = foundRecord.headers;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...foundRecord.row];

      // Ensure row matches header length
      while (currentRow.length < headers.length) currentRow.push('');
      // Trim extra columns beyond headers
      if (currentRow.length > headers.length) currentRow.length = headers.length;

      // Update Balança fields
      currentRow[fi('Hora')] = formBalanca.horaChegada;
      currentRow[fi('Material')] = formBalanca.material;

      // Write Fornecedor - always Brita Potiguar for records coming from Britador
      const fornecedorIdx = fi('Fornecedor');
      if (fornecedorIdx !== -1) currentRow[fornecedorIdx] = 'Brita Potiguar';
      else currentRow[8] = 'Brita Potiguar'; // I
      
      // Write OS number (entered by Balança user)
      if (formBalanca.numeroPedido) {
        const ordemIdx = fi('Ordem_Carregamento');
        if (ordemIdx !== -1) currentRow[ordemIdx] = formBalanca.numeroPedido;
        else currentRow[7] = formBalanca.numeroPedido; // H
      }

      const effectivePesoVazio = customPesoVazio || foundRecord.pesoVazio;
      currentRow[fi('Peso_Vazio')] = effectivePesoVazio ? formatPesoForSheet(effectivePesoVazio) : '';
      currentRow[fi('Peso_Final')] = formatPesoForSheet(formBalanca.pesoFinal);

      // Calculate derived values
      const derived = calculateDerivedValues(formBalanca.pesoFinal, effectivePesoVazio || '0');
      if (fi('Peso_Liquido_Cubico') !== -1) currentRow[fi('Peso_Liquido_Cubico')] = derived.pesoLiquido;
      else if (fi('Peso_Liquido') !== -1) currentRow[fi('Peso_Liquido')] = derived.pesoLiquido;
      if (fi('Metro_Cubico') !== -1) currentRow[fi('Metro_Cubico')] = derived.metroCubico;
      if (fi('Densidade') !== -1) currentRow[fi('Densidade')] = derived.densidade;
      if (fi('Tonelada') !== -1) currentRow[fi('Tonelada')] = derived.tonelada;
      // Also write to Tonelada (ticket) column
      const ttIdx1 = fi('Tonelada (ticket)');
      if (ttIdx1 !== -1) currentRow[ttIdx1] = derived.tonelada;

      // Write Hora_Chegada_Balanca and Hora_Saida_Balanca
      const hcbIdx = fi('Hora_Chegada_Balanca');
      if (hcbIdx !== -1) currentRow[hcbIdx] = formBalanca.horaChegada;
      const hsbIdx = fi('Hora_Saida_Balanca');
      if (hsbIdx !== -1) currentRow[hsbIdx] = formBalanca.horaSaida || format(new Date(), 'HH:mm');

      // Update Usuario_Obra with current user
      const userObraIdx = fi('Usuario_Obra');
      if (userObraIdx !== -1) currentRow[userObraIdx] = effectiveName;
      else currentRow[21] = effectiveName; // V

      // Update status
      const statusIdx = fi('Status');
      if (statusIdx !== -1) currentRow[statusIdx] = 'Pesado';
      else currentRow[22] = 'Pesado'; // W

      // Upload Balança photo(s) if available
      if (balancaFotoFile) {
        try {
          const timestamp = Date.now();
          const ext = balancaFotoFile.name.split('.').pop() || 'jpg';
          const filePath = `balanca/${format(new Date(), 'yyyy-MM-dd')}/${foundRecord.ordem || foundRecord.prefixo}_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, balancaFotoFile, { upsert: true });
          if (!uploadError) {
            let fotoIdx = fi('Foto Pesagem Pedreira');
            if (fotoIdx === -1) fotoIdx = fi('Foto_Pesagem_Pedreira');
            if (fotoIdx !== -1) {
              const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
              currentRow[fotoIdx] = urlData.publicUrl;
            }
          }
        } catch (fotoErr) {
          console.error('Erro ao salvar foto balança:', fotoErr);
        }
      }


      // Upload Peso Vazio OCR photo if available
      if (pesoVazioOcrFotoFile) {
        try {
          const timestamp = Date.now() + 2;
          const ext = pesoVazioOcrFotoFile.name.split('.').pop() || 'jpg';
          const filePath = `balanca/${format(new Date(), 'yyyy-MM-dd')}/${foundRecord.ordem || foundRecord.prefixo}_pesovazio_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, pesoVazioOcrFotoFile, { upsert: true });
          if (!uploadError) {
            let fotoIdx = fi('Foto Peso Vazio Pedreira');
            if (fotoIdx === -1) fotoIdx = fi('Foto_Peso_Vazio_Pedreira');
            if (fotoIdx === -1) fotoIdx = fi('Foto Peso Vazio');
            if (fotoIdx === -1) fotoIdx = fi('Foto_Peso_Vazio');
            if (fotoIdx !== -1) {
              const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
              currentRow[fotoIdx] = urlData.publicUrl;
            }
          }
        } catch (fotoErr) {
          console.error('Erro ao salvar foto peso vazio:', fotoErr);
        }
      }

      if (effectivePesoVazio) {
        localStorage.setItem('lastPesoVazio', effectivePesoVazio);
        setLastPesoVazio(effectivePesoVazio);
      }

      const rowNum = foundRecord.rowIndex;
      const success = await writeSheet('Apontamento_Pedreira', buildRowRange(rowNum, currentRow.length), [currentRow]);
      if (!success) throw new Error('Erro ao atualizar');

      // Signal desktop tabs to refresh
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      playSuccessSound();
      setSuccessTitle('Pesagem Registrada!');
      setSuccessSubtitle(`OS: ${foundRecord.ordem} - ${foundRecord.prefixo} pesado com sucesso.`);
      setSuccessDetails([
        { label: 'Etapa', value: '⚖️ Balança - Pesagem' },
        { label: 'OS/Ordem', value: foundRecord.ordem },
        { label: 'Veículo', value: `${foundRecord.prefixo} - ${foundRecord.motorista}` },
        { label: 'Material', value: formBalanca.material },
        { label: 'Peso Final', value: `${formatPesoForSheet(formBalanca.pesoFinal)} kg` },
        { label: 'Peso Líquido', value: `${derived.pesoLiquido} kg` },
        { label: 'Tonelada', value: `${derived.tonelada} t` },
        { label: 'Status', value: 'Pesado' },
      ]);
      setSuccessImageUrl(balancaFotoPreview);
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // =================== TRANSFER TO OBRA (skip Balança) ===================

  const handleTransferToObra = async () => {
    if (!foundRecord) return;
    setTransferring(true);

    try {
      const headers = foundRecord.headers;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...foundRecord.row];

      // Ensure row matches header length
      while (currentRow.length < headers.length) currentRow.push('');
      if (currentRow.length > headers.length) currentRow.length = headers.length;

      // Set OS number if provided
      if (formBalanca.numeroPedido) {
        const ordemIdx = fi('Ordem_Carregamento');
        if (ordemIdx !== -1) currentRow[ordemIdx] = formBalanca.numeroPedido;
        else currentRow[7] = formBalanca.numeroPedido;
      }

      // Update status to "Pesado" so Obra stage can pick it up
      const statusIdx = fi('Status');
      if (statusIdx !== -1) currentRow[statusIdx] = 'Pesado';
      else currentRow[22] = 'Pesado';

      // Mark as transferred (no balança weighing)
      const hcbIdx = fi('Hora_Chegada_Balanca');
      if (hcbIdx !== -1) currentRow[hcbIdx] = 'Transferido';
      const hsbIdx = fi('Hora_Saida_Balanca');
      if (hsbIdx !== -1) currentRow[hsbIdx] = 'Transferido';

      const rowNum = foundRecord.rowIndex;
      const success = await writeSheet('Apontamento_Pedreira', buildRowRange(rowNum, currentRow.length), [currentRow]);
      if (!success) throw new Error('Erro ao transferir');

      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      playSuccessSound();
      setSuccessTitle('Transferido para Obra!');
      setSuccessSubtitle(`${foundRecord.prefixo} foi transferido diretamente para a etapa Obra.`);
      setSuccessDetails([
        { label: 'Etapa', value: '🔄 Transferido (Balança → Obra)' },
        { label: 'OS/Ordem', value: foundRecord.ordem || formBalanca.numeroPedido || '-' },
        { label: 'Veículo', value: `${foundRecord.prefixo} - ${foundRecord.motorista}` },
        { label: 'Motivo', value: 'Sem operador na Balança' },
        { label: 'Status', value: 'Pesado (aguardando Obra)' },
      ]);
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: 'Erro ao transferir', description: error.message, variant: 'destructive' });
    } finally {
      setTransferring(false);
      setShowTransferConfirm(false);
    }
  };

  // Toggle auto-transfer
  const toggleAutoTransfer = (enabled: boolean) => {
    setAutoTransfer(enabled);
    localStorage.setItem('pedreira_auto_transfer', JSON.stringify({ date: todayKey, enabled }));
    if (enabled) {
      toast({ title: '🔄 Transferência automática ativada', description: 'Todos os veículos serão transferidos direto para a Obra.' });
    } else {
      toast({ title: '⏸️ Transferência automática desativada' });
    }
  };

  // Toggle transfer feature visibility
  const handleToggleTransferEnabled = (enabled: boolean) => {
    if (enabled) {
      setShowEnableTransferConfirm(true);
    } else {
      setTransferEnabled(false);
      localStorage.setItem('pedreira_transfer_enabled', 'false');
      setAutoTransfer(false);
      localStorage.setItem('pedreira_auto_transfer', JSON.stringify({ date: todayKey, enabled: false }));
      toast({ title: '🚫 Transferência para Obra desabilitada', description: 'A opção não aparecerá mais no formulário.' });
    }
  };

  const confirmEnableTransfer = () => {
    setTransferEnabled(true);
    localStorage.setItem('pedreira_transfer_enabled', 'true');
    setShowEnableTransferConfirm(false);
    toast({ title: '✅ Transferência para Obra habilitada', description: 'Agora você pode transferir veículos direto para Obra.' });
  };

  // Cancel a transfer (revert record back to Saiu_Britador)
  const handleCancelTransfer = async () => {
    if (!foundRecord) return;
    setCancellingTransfer(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data) throw new Error('Erro ao ler planilha');
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...data[foundRecord.rowIndex]];

      const statusIdx = fi('Status');
      if (statusIdx !== -1) currentRow[statusIdx] = 'Saiu_Britador';
      const hcbIdx = fi('Hora_Chegada_Balanca');
      if (hcbIdx !== -1) currentRow[hcbIdx] = '';
      const hsbIdx = fi('Hora_Saida_Balanca');
      if (hsbIdx !== -1) currentRow[hsbIdx] = '';

      const rowNum = foundRecord.rowIndex;
      const success = await writeSheet('Apontamento_Pedreira', buildRowRange(rowNum, currentRow.length), [currentRow]);
      if (!success) throw new Error('Erro ao cancelar transferência');

      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      toast({ title: '↩️ Transferência cancelada', description: `${foundRecord.prefixo} voltou para a fila da Balança.` });
      setFoundRecord(null);
      setSearchPrefixo('');
      setSearchOS('');
      if (etapa === 'balanca') loadTransitRecords('Saiu_Britador');
    } catch (error: any) {
      toast({ title: 'Erro ao cancelar transferência', description: error.message, variant: 'destructive' });
    } finally {
      setCancellingTransfer(false);
      setShowCancelTransferConfirm(false);
    }
  };

  // Batch auto-transfer all transit records
  const handleBatchAutoTransfer = useCallback(async () => {
    if (!autoTransfer || autoTransferring) return;
    
    setAutoTransferring(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) return;
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      
      let transferCount = 0;
      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        const rawDate = (row[fi('Data')] || '').split('/').map((p: string) => p.padStart(2, '0')).join('/');
        const status = row[fi('Status')] || '';
        if (rawDate !== todayStr || status !== 'Saiu_Britador') continue;

        const currentRow = [...row];
        while (currentRow.length < headers.length) currentRow.push('');
        if (currentRow.length > headers.length) currentRow.length = headers.length;

        const statusIdx = fi('Status');
        if (statusIdx !== -1) currentRow[statusIdx] = 'Pesado';
        const hcbIdx = fi('Hora_Chegada_Balanca');
        if (hcbIdx !== -1) currentRow[hcbIdx] = 'Transferido';
        const hsbIdx = fi('Hora_Saida_Balanca');
        if (hsbIdx !== -1) currentRow[hsbIdx] = 'Transferido';

        const rowNum = i + 1;
        await writeSheet('Apontamento_Pedreira', buildRowRange(rowNum, currentRow.length), [currentRow]);
        transferCount++;
      }

      if (transferCount > 0) {
        playSuccessSound();
        toast({ title: `🔄 ${transferCount} veículo(s) transferido(s) automaticamente para Obra` });
        localStorage.setItem('pedreira_data_updated', Date.now().toString());
        // Reload transit to show empty list
        loadTransitRecords('Saiu_Britador');
      }
    } catch (error: any) {
      toast({ title: 'Erro na transferência automática', description: error.message, variant: 'destructive' });
    } finally {
      setAutoTransferring(false);
    }
  }, [autoTransfer, autoTransferring, readSheet, writeSheet, buildRowRange, playSuccessSound, toast, loadTransitRecords]);

  const handleSubmitHerval = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine vehicle info based on carregamento type
    const isVeiculoHerval = hervalCarregTipo === 'veiculo_herval';
    const veiculoId = isVeiculoHerval ? formHervalVeiculo.placa.toUpperCase().trim() : formHerval.caminhao;

    if (!veiculoId || !formHerval.material || !formHerval.pesoFinal) {
      toast({ title: 'Preencha veículo, material e peso final', variant: 'destructive' });
      return;
    }
    setLoading(true);

    try {
      const dataFormatada = format(new Date(formHerval.data + 'T12:00:00'), 'dd/MM/yyyy');
      const generateId = () => Math.random().toString(36).substring(2, 10);

      let headers = sheetHeaders;
      if (!headers || headers.length === 0) {
        const headerData = await readSheet('Apontamento_Pedreira', 'A1:AZ1');
        if (headerData && headerData.length > 0) {
          headers = headerData[0];
          setSheetHeaders(headers);
        }
      }

      const fi = (name: string) => headers.indexOf(name);
      const colCount = headers.length;
      const row: string[] = new Array(colCount).fill('');

      const sv = (headerName: string, fallbackIdx: number, value: string) => {
        const idx = fi(headerName);
        if (idx !== -1) row[idx] = value;
        else row[fallbackIdx] = value;
      };

      const cam = isVeiculoHerval ? null : selectedHervalCaminhao;
      const hervalVeiculoData = isVeiculoHerval ? getHervalMotoristaByPlate(formHervalVeiculo.placa) : null;
      const effectivePesoVazio = customHervalPesoVazio || hervalVeiculoData?.pesoVazio || cam?.pesoVazio || '';

      // Vehicle info depends on carregamento type
      const veiculoDescricao = isVeiculoHerval ? formHervalVeiculo.descricao : (cam?.descricao || '');
      const veiculoEmpresa = isVeiculoHerval ? 'Herval' : (cam?.empresa || '');
      const veiculoMotorista = isVeiculoHerval ? formHervalVeiculo.motorista : (cam?.motorista || '');
      const veiculoPlaca = isVeiculoHerval ? formHervalVeiculo.placa.toUpperCase().trim() : (cam?.placa || '');

      sv('ID', 0, generateId());
      sv('Data', 1, dataFormatada);
      sv('Hora', 6, formHerval.horaChegada);
      if (formHerval.numeroPedido) sv('Ordem_Carregamento', 7, formHerval.numeroPedido);
      sv('Fornecedor', 8, isVeiculoHerval ? 'Herval (Veíc. Herval)' : 'Herval');
      sv('Prefixo_Eq', 9, veiculoId);
      sv('Descricao_Eq', 10, veiculoDescricao);
      sv('Empresa_Eq', 11, veiculoEmpresa);
      sv('Motorista', 12, veiculoMotorista);
      sv('Placa', 13, veiculoPlaca);
      sv('Material', 14, formHerval.material);
      sv('Peso_Vazio', 15, effectivePesoVazio ? formatPesoForSheet(effectivePesoVazio) : '');
      sv('Peso_Final', 16, formatPesoForSheet(formHerval.pesoFinal));

      const derived = calculateDerivedValues(formHerval.pesoFinal, effectivePesoVazio || '0');
      if (fi('Peso_Liquido_Cubico') !== -1) row[fi('Peso_Liquido_Cubico')] = derived.pesoLiquido;
      else if (fi('Peso_Liquido') !== -1) row[fi('Peso_Liquido')] = derived.pesoLiquido;
      if (fi('Metro_Cubico') !== -1) row[fi('Metro_Cubico')] = derived.metroCubico;
      if (fi('Densidade') !== -1) row[fi('Densidade')] = derived.densidade;
      if (fi('Tonelada') !== -1) row[fi('Tonelada')] = derived.tonelada;
      const ttIdxH = fi('Tonelada (ticket)');
      if (ttIdxH !== -1) row[ttIdxH] = derived.tonelada;

      sv('Usuario_Obra', 21, effectiveName);

      const hcbIdx = fi('Hora_Chegada_Balanca');
      if (hcbIdx !== -1) row[hcbIdx] = formHerval.horaChegada;
      else row[3] = formHerval.horaChegada; // D
      const hsbIdx = fi('Hora_Saida_Balanca');
      if (hsbIdx !== -1) row[hsbIdx] = formHerval.horaSaida || format(new Date(), 'HH:mm');
      else row[4] = formHerval.horaSaida || format(new Date(), 'HH:mm'); // E

      sv('Status', 22, 'Pesado');

      // Upload Herval photo if available
      if (hervalFotoFile) {
        try {
          const timestamp = Date.now();
          const ext = hervalFotoFile.name.split('.').pop() || 'jpg';
          const filePath = `balanca/${format(new Date(), 'yyyy-MM-dd')}/herval_${formHerval.caminhao}_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, hervalFotoFile, { upsert: true });
          if (!uploadError) {
            let fotoIdx = fi('Foto Pesagem Pedreira');
            if (fotoIdx === -1) fotoIdx = fi('Foto_Pesagem_Pedreira');
            if (fotoIdx !== -1) {
              const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
              row[fotoIdx] = urlData.publicUrl;
            }
          }
        } catch (fotoErr) {
          console.error('Erro ao salvar foto balança herval:', fotoErr);
        }
      }

      // Upload Herval photo 2 if available (Caminhão Reboque)
      if (hervalFotoFile2) {
        try {
          const timestamp = Date.now();
          const ext = hervalFotoFile2.name.split('.').pop() || 'jpg';
          const filePath = `balanca/${format(new Date(), 'yyyy-MM-dd')}/herval2_${formHerval.caminhao}_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, hervalFotoFile2, { upsert: true });
          if (!uploadError) {
            let fotoIdx2 = fi('Foto Pesagem Pedreira 2');
            if (fotoIdx2 === -1) fotoIdx2 = fi('Foto_Pesagem_Pedreira_2');
            if (fotoIdx2 !== -1) {
              const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
              row[fotoIdx2] = urlData.publicUrl;
            }
          }
        } catch (fotoErr) {
          console.error('Erro ao salvar foto 2 balança herval:', fotoErr);
        }
      }

      if (effectivePesoVazio) {
        localStorage.setItem('lastPesoVazio', effectivePesoVazio);
        setLastPesoVazio(effectivePesoVazio);
      }

      // Check if same truck already has an active row today (Pesado/Herval) to avoid duplicates
      let existingHervalRow = -1;
      try {
        const allData = await readSheet('Apontamento_Pedreira');
        if (allData && allData.length > 1) {
          const hdr = allData[0];
          const pIdx = hdr.indexOf('Prefixo_Eq');
          const dIdx = hdr.indexOf('Data');
          const sIdx = hdr.indexOf('Status');
          for (let r = 1; r < allData.length; r++) {
            const rw = allData[r];
            if (
              (rw[pIdx] || '').trim() === veiculoId.trim() &&
              (rw[dIdx] || '').trim() === dataFormatada &&
              (rw[sIdx] || '').trim() === 'Pesado'
            ) {
              existingHervalRow = r + 1;
              break;
            }
          }
        }
      } catch (e) { console.warn('[Herval] Could not search for existing row:', e); }

      let success: boolean;
      if (existingHervalRow > 1) {
        console.log(`[Herval] Updating existing row ${existingHervalRow}`);
        success = await writeSheet('Apontamento_Pedreira', buildRowRange(existingHervalRow, row.length), [row]);
      } else {
        success = await appendSheet('Apontamento_Pedreira', [row]);
      }
      if (!success) throw new Error('Erro ao salvar');

      // Backup to Supabase
      await supabaseBackupPedreira(pedreiraRow, headers);

      // Backup to Supabase
      await supabaseBackupPedreira(row, headers);

      // Herval vehicles are now managed via the "Caminhões Herval" sheet cadastro

      // Signal desktop tabs to refresh
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      playSuccessSound();
      setSuccessTitle('Pesagem Herval Registrada!');
      setSuccessSubtitle(`${veiculoId} - Fornecedor Herval${isVeiculoHerval ? ' (Veíc. Herval)' : ''}`);
      setSuccessDetails([
        { label: 'Etapa', value: isVeiculoHerval ? '⚖️ Balança - Herval (Veíc. Herval)' : '⚖️ Balança - Herval (Próprio)' },
        { label: 'Veículo', value: `${veiculoId}${veiculoMotorista ? ` - ${veiculoMotorista}` : ''}` },
        { label: 'Fornecedor', value: isVeiculoHerval ? 'Herval (Veíc. Herval)' : 'Herval' },
        { label: 'Material', value: formHerval.material },
        { label: 'Peso Final', value: `${formatPesoForSheet(formHerval.pesoFinal)} kg` },
        { label: 'Peso Líquido', value: `${derived.pesoLiquido} kg` },
        { label: 'Tonelada', value: `${derived.tonelada} t` },
        { label: 'Status', value: 'Pesado' },
      ]);
      setSuccessImageUrl(hervalFotoPreview || hervalFotoPreview2);
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // =================== SUBMIT CARREGAMENTO DIRETO - SINGLE STEP (FINALIZADO) ===================
  const handleSubmitCarregamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCarregamento.placa || !formCarregamento.material || !formCarregamento.pesoFinal || !formCarregamento.quantidade) {
      toast({ title: 'Preencha placa, material, tonelada do ticket e peso carregado', variant: 'destructive' });
      return;
    }

    // Get peso vazio from cadastro
    const pesoVazioCadastro = customCarregamentoPesoVazio || formCarregamento.pesoVazio || '';
    if (!pesoVazioCadastro) {
      toast({ title: 'Veículo sem peso vazio cadastrado', description: 'Cadastre o peso vazio do veículo em Caminhões Areia Express.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const dataFormatada = format(new Date(formCarregamento.data + 'T12:00:00'), 'dd/MM/yyyy');
      const generateId = () => Math.random().toString(36).substring(2, 10);

      let headers = sheetHeaders;
      if (!headers || headers.length === 0) {
        const headerData = await readSheet('Apontamento_Pedreira', 'A1:AZ1');
        if (headerData && headerData.length > 0) {
          headers = headerData[0];
          setSheetHeaders(headers);
        }
      }

      const fi = (name: string) => headers.indexOf(name);
      const colCount = headers.length;
      const row: string[] = new Array(colCount).fill('');

      const sv = (headerName: string, fallbackIdx: number, value: string) => {
        const idx = fi(headerName);
        if (idx !== -1) row[idx] = value;
        else row[fallbackIdx] = value;
      };

      sv('ID', 0, generateId());
      sv('Data', 1, dataFormatada);
      sv('Hora', 6, formCarregamento.horaChegada);
      if (formCarregamento.numeroPedido) sv('Ordem_Carregamento', 7, formCarregamento.numeroPedido);

      const qtdDigits = formCarregamento.quantidade.replace(/[^0-9]/g, '');
      if (!qtdDigits) {
        throw new Error('Tonelada do ticket inválida');
      }
      const qtdNum = parseInt(qtdDigits, 10) / 100;
      const ttIdxC = fi('Tonelada (ticket)');
      if (ttIdxC !== -1) row[ttIdxC] = formatDecimalBR(qtdNum);
      else sv('Tonelada (ticket)', 21, formatDecimalBR(qtdNum));

      sv('Fornecedor', 8, formCarregamento.fornecedor || 'Areia Express');
      sv('Prefixo_Eq', 9, formCarregamento.placa);
      sv('Descricao_Eq', 10, 'Caminhão Basculante');
      sv('Empresa_Eq', 11, formCarregamento.fornecedor || 'Areia Express');
      sv('Motorista', 12, formCarregamento.motorista);
      sv('Placa', 13, formCarregamento.placa);
      sv('Material', 14, formCarregamento.material);
      sv('Peso_Final', 16, formatPesoForSheet(formCarregamento.pesoFinal));

      // Fill peso vazio from cadastro
      sv('Peso_Vazio', 15, formatPesoForSheet(pesoVazioCadastro));

      // Calculate derived values (Tonelada Calc Obra)
      const derived = calculateDerivedValues(formCarregamento.pesoFinal, pesoVazioCadastro);
      if (fi('Peso_Liquido_Cubico') !== -1) row[fi('Peso_Liquido_Cubico')] = derived.pesoLiquido;
      else if (fi('Peso_Liquido') !== -1) row[fi('Peso_Liquido')] = derived.pesoLiquido;
      if (fi('Metro_Cubico') !== -1) row[fi('Metro_Cubico')] = derived.metroCubico;
      if (fi('Densidade') !== -1) row[fi('Densidade')] = derived.densidade;
      if (fi('Tonelada') !== -1) row[fi('Tonelada')] = derived.tonelada;

      // Tonelada (Calc Obra) = calculated from peso carregado - peso vazio cadastro
      const tcIdxC = fi('Tonelada (Calc Obra)');
      if (tcIdxC !== -1 && derived.tonelada) row[tcIdxC] = derived.tonelada;

      // Diesel: calculate litros and save if column exists
      const isDiesel = isDieselMaterial(formCarregamento.material, formCarregamento.fornecedor);
      const litrosDiesel = isDiesel && derived.pesoLiquidoNum > 0 ? calculateLitros(derived.pesoLiquidoNum) : 0;
      if (isDiesel && litrosDiesel > 0) {
        const litrosIdx = fi('Litros');
        if (litrosIdx !== -1) row[litrosIdx] = formatDecimalBR(litrosDiesel);
        const densidadeDieselIdx = fi('Densidade_Diesel');
        if (densidadeDieselIdx !== -1) row[densidadeDieselIdx] = formatDecimalBR(DIESEL_DENSITY, 3);
      }

      const hoaIdx = fi('Hora_Chegada_Obra');
      if (hoaIdx !== -1) row[hoaIdx] = formCarregamento.horaChegada;

      sv('Usuario_Obra', 21, effectiveName);
      // Save directly as Finalizado — no more 2-step process
      sv('Status', 22, 'Finalizado');

      savePlate(formCarregamento.placa, formCarregamento.motorista);

      // Upload Carregamento Chegada OCR photo before appending row
      if (carregChegadaFotoFile) {
        try {
          const timestamp = Date.now();
          const ext = carregChegadaFotoFile.name.split('.').pop() || 'jpg';
          const filePath = `carregamento/${format(new Date(), 'yyyy-MM-dd')}/${formCarregamento.placa}_chegada_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, carregChegadaFotoFile, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
            let fotoIdx = fi('Foto do Peso Chegada Obra');
            if (fotoIdx === -1) fotoIdx = fi('Foto Peso Chegada Obra');
            if (fotoIdx === -1) fotoIdx = fi('Foto_Peso_Chegada');
            if (fotoIdx === -1) fotoIdx = fi('Foto Peso Chegada');
            if (fotoIdx === -1) fotoIdx = fi('Foto do Peso da Chegada');
            if (fotoIdx !== -1) row[fotoIdx] = urlData?.publicUrl || '';
          }
        } catch (e) { console.error('Upload foto chegada erro:', e); }
      }

      // Check if same truck already has a Carreg_Pendente row today to avoid duplicates
      let existingCarregRow = -1;
      try {
        const allData = await readSheet('Apontamento_Pedreira');
        if (allData && allData.length > 1) {
          const hdr = allData[0];
          const pIdx = hdr.indexOf('Placa');
          const dIdx = hdr.indexOf('Data');
          const sIdx = hdr.indexOf('Status');
          for (let r = 1; r < allData.length; r++) {
            const rw = allData[r];
            if (
              (rw[pIdx] || '').trim() === formCarregamento.placa.trim() &&
              (rw[dIdx] || '').trim() === dataFormatada &&
              (rw[sIdx] || '').trim() === 'Carreg_Pendente'
            ) {
              existingCarregRow = r + 1;
              break;
            }
          }
        }
      } catch (e) { console.warn('[Carregamento] Could not search for existing row:', e); }

      let carregSuccess: boolean;
      if (existingCarregRow > 1) {
        carregSuccess = await writeSheet('Apontamento_Pedreira', buildRowRange(existingCarregRow, row.length), [row]);
      } else {
        carregSuccess = await appendSheet('Apontamento_Pedreira', [row]);
      }
      if (!carregSuccess) throw new Error('Erro ao salvar');

      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      playSuccessSound();
      setSuccessTitle('Lançamento Finalizado!');
      setSuccessSubtitle(`Placa ${formCarregamento.placa} — Registro concluído`);
      setSuccessDetails([
        { label: 'Etapa', value: '🏢 Carreg. Direto - Finalizado' },
        { label: 'Placa', value: formCarregamento.placa },
        ...(formCarregamento.motorista ? [{ label: 'Motorista', value: formCarregamento.motorista }] : []),
        { label: 'Fornecedor', value: formCarregamento.fornecedor || 'Areia Express' },
        { label: 'Material', value: formCarregamento.material },
        ...(formCarregamento.quantidade ? [{ label: 'Ton. Ticket', value: formCarregamento.quantidade }] : []),
        { label: 'Peso Carregado', value: `${formatPesoForSheet(formCarregamento.pesoFinal)} kg` },
        { label: 'Peso Vazio (Cadastro)', value: `${formatPesoForSheet(pesoVazioCadastro)} kg` },
        { label: 'Ton. Calc Obra', value: `${derived.tonelada} t` },
        ...(isDiesel && litrosDiesel > 0 ? [{ label: '⛽ Total em Litros', value: `${formatDecimalBR(litrosDiesel)} L` }] : []),
        { label: 'Status', value: '✅ Finalizado' },
      ]);
      setCarregChegadaFotoFile(null);
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // =================== LOAD CARREGAMENTO PENDENTES ===================
  const loadCarregPendentes = useCallback(async () => {
    try {
      let headers = sheetHeaders;
      if (!headers || headers.length === 0) {
        const headerData = await readSheet('Apontamento_Pedreira', 'A1:AZ1');
        if (headerData && headerData.length > 0) {
          headers = headerData[0];
          setSheetHeaders(headers);
        }
      }
      const fi = (name: string) => headers.indexOf(name);
      const allData = await readSheet('Apontamento_Pedreira');
      if (!allData || allData.length < 2) { setCarregPendentes([]); return; }

      const pendentes: any[] = [];
      for (let i = 1; i < allData.length; i++) {
        const row = allData[i];
        const status = (row[fi('Status')] || row[22] || '').trim();
        if (status !== 'Carreg_Pendente') continue;
        pendentes.push({
          sheetRowIndex: i + 1, // 1-based sheet row
          originalRow: row,
          headers,
          placa: row[fi('Placa')] || row[fi('Prefixo_Eq')] || row[9] || '',
          fornecedor: row[fi('Fornecedor')] || row[8] || '',
          material: row[fi('Material')] || row[14] || '',
          pesoCarregado: row[fi('Peso_Final')] || row[16] || '',
          horaChegada: row[fi('Hora_Chegada_Obra')] || row[fi('Hora')] || row[6] || '',
          data: row[fi('Data')] || row[1] || '',
          numeroPedido: row[fi('Ordem_Carregamento')] || row[7] || '',
        });
      }
      setCarregPendentes(pendentes);
    } catch (err) {
      console.error('Erro ao carregar pendentes de carregamento:', err);
    }
  }, [sheetHeaders, readSheet]);

  // =================== SUBMIT CARREGAMENTO DIRETO - STEP 2 (SAÍDA / FINALIZAR) ===================
  const handleFinalizarCarregamento = async () => {
    if (!selectedCarregPendente || !carregPesoSaida) {
      toast({ title: 'Informe o peso de saída (vazio)', variant: 'destructive' });
      return;
    }
    setLoading(true);

    try {
      const rec = selectedCarregPendente;
      const headers = rec.headers;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...rec.originalRow];
      const colCount = headers.length;
      while (currentRow.length < colCount) currentRow.push('');

      const sv = (headerName: string, fallbackIdx: number, value: string) => {
        const idx = fi(headerName);
        if (idx !== -1) currentRow[idx] = value;
        else currentRow[fallbackIdx] = value;
      };

      // Fill peso vazio (saída) and recalculate
      sv('Peso_Vazio', 15, formatPesoForSheet(carregPesoSaida));

      const pesoFinalRaw = rec.pesoCarregado.replace(/[.,]/g, '');
      const derived = calculateDerivedValues(pesoFinalRaw || rec.pesoCarregado, carregPesoSaida);
      
      if (fi('Peso_Liquido_Cubico') !== -1) currentRow[fi('Peso_Liquido_Cubico')] = derived.pesoLiquido;
      else if (fi('Peso_Liquido') !== -1) currentRow[fi('Peso_Liquido')] = derived.pesoLiquido;
      if (fi('Metro_Cubico') !== -1) currentRow[fi('Metro_Cubico')] = derived.metroCubico;
      if (fi('Densidade') !== -1) currentRow[fi('Densidade')] = derived.densidade;
      if (fi('Tonelada') !== -1) currentRow[fi('Tonelada')] = derived.tonelada;
      
      const ttIdxF = fi('Tonelada (ticket)');
      const toneladaTicketRaw = ttIdxF !== -1 ? String(currentRow[ttIdxF] || '').trim() : '';
      if (!toneladaTicketRaw) {
        throw new Error('Tonelada (ticket) não encontrada neste lançamento. Reabra a chegada e informe o valor do ticket antes de finalizar.');
      }

      // Fill Tonelada (Calc Obra) = calculated from peso chegada - peso saída
      const tcIdxF = fi('Tonelada (Calc Obra)');
      if (tcIdxF !== -1 && derived.tonelada) currentRow[tcIdxF] = derived.tonelada;
      else if (derived.tonelada) currentRow[22] = derived.tonelada;

      // Set hora saída
      const hsIdx = fi('Hora_Saida_Balanca');
      if (hsIdx !== -1) currentRow[hsIdx] = carregHoraSaida;

      sv('Status', 22, 'Finalizado');

      // Save peso vazio for future
      if (carregPesoSaida) {
        localStorage.setItem('lastPesoVazio', carregPesoSaida);
        setLastPesoVazio(carregPesoSaida);
      }

      // Update the row in the sheet
      const colToLetter = (c: number) => {
        let letter = '';
        let n = c;
        while (n >= 0) {
          letter = String.fromCharCode((n % 26) + 65) + letter;
          n = Math.floor(n / 26) - 1;
        }
        return letter;
      };
      const lastCol = colToLetter(colCount - 1);
      const range = `Apontamento_Pedreira!A${rec.sheetRowIndex}:${lastCol}${rec.sheetRowIndex}`;
      const success = await writeSheet('Apontamento_Pedreira', `A${rec.sheetRowIndex}:${lastCol}${rec.sheetRowIndex}`, [currentRow]);
      if (!success) throw new Error('Erro ao finalizar');

      // Upload Carregamento Saída OCR photo if available
      if (carregSaidaFotoFile) {
        try {
          const timestamp = Date.now();
          const ext = carregSaidaFotoFile.name.split('.').pop() || 'jpg';
          const filePath = `carregamento/${format(new Date(), 'yyyy-MM-dd')}/${rec.placa}_saida_${timestamp}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, carregSaidaFotoFile, { upsert: true });
          if (!uploadError) {
            let fotoVazioIdx = fi('Foto do Peso Saida Obra');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto do Peso Saída Obra');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto Peso Vazio Pedreira');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto_Peso_Vazio_Pedreira');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto Peso Vazio');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto_Peso_Vazio');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto do Peso Vazio Obra');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto Peso Vazio Obra');
            if (fotoVazioIdx === -1) fotoVazioIdx = fi('Foto_Peso_Vazio_Obra');
            if (fotoVazioIdx !== -1) {
              const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
              currentRow[fotoVazioIdx] = urlData?.publicUrl || '';
              await writeSheet('Apontamento_Pedreira', `A${rec.sheetRowIndex}:${lastCol}${rec.sheetRowIndex}`, [currentRow]);
            }
            console.log('[CarregSaida] Photo uploaded');
          }
        } catch (e) { console.error('Upload foto saída erro:', e); }
      }

      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      playSuccessSound();
      setSuccessTitle('Carregamento Finalizado!');
      setSuccessSubtitle(`Placa ${rec.placa} — ${rec.fornecedor}`);
      setSuccessDetails([
        { label: 'Etapa', value: '🏢 Carreg. Direto - Finalizado' },
        { label: 'Placa', value: rec.placa },
        { label: 'Fornecedor', value: rec.fornecedor },
        { label: 'Material', value: rec.material },
        { label: 'Peso Carregado', value: `${rec.pesoCarregado} kg` },
        { label: 'Peso Vazio', value: `${formatPesoForSheet(carregPesoSaida)} kg` },
        { label: 'Peso Líquido', value: `${derived.pesoLiquido} kg` },
        { label: 'Tonelada', value: `${derived.tonelada} t` },
        { label: 'Status', value: 'Finalizado ✅' },
      ]);
      setSelectedCarregPendente(null);
      setCarregPesoSaida('');
      setCarregSaidaFotoFile(null);
      setSuccessImageUrl(carregSaidaFotoPreview);
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  const handleSubmitObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundRecord) return;
    setLoading(true);

    try {
      const headers = foundRecord.headers;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...foundRecord.row];

      console.log('[Obra] Headers count:', headers.length, 'Row count:', currentRow.length);

      while (currentRow.length < headers.length) currentRow.push('');
      if (currentRow.length > headers.length) currentRow.length = headers.length;

      // Check if this was a transferred record (no balança weighing)
      const isTransferred = (currentRow[fi('Hora_Chegada_Balanca')] || '') === 'Transferido';
      const isStep2 = foundRecord.status === 'Pendente_Obra';

      if (isTransferred && !isStep2) {
        // ===== STEP 1: Truck arrives loaded → save material + peso carregado, status = Pendente_Obra =====
        if (!formObraExtra.material || !formObraExtra.pesoFinal) {
          toast({ title: 'Preencha material e peso carregado', variant: 'destructive' });
          setLoading(false);
          return;
        }

        // Save material and peso final (carregado)
        currentRow[fi('Material')] = formObraExtra.material;
        currentRow[fi('Peso_Final')] = formatPesoForSheet(formObraExtra.pesoFinal);

        // Save OS number if provided
        if (formObraExtra.numeroPedido) {
          const ordemIdx = fi('Ordem_Carregamento');
          if (ordemIdx !== -1) currentRow[ordemIdx] = formObraExtra.numeroPedido;
          else currentRow[7] = formObraExtra.numeroPedido;
        }

        // Hora de chegada na obra
        const horaAtual = formObra.horaChegada;
        const horaObraIdx = fi('Hora_Chegada_Obra');
        if (horaObraIdx !== -1) currentRow[horaObraIdx] = horaAtual;

        // Peso de Chegada na Obra
        if (formObra.pesoChegada) {
          let pesoChegadaIdx = fi('Peso Chegada Obra');
          if (pesoChegadaIdx === -1) pesoChegadaIdx = fi('Peso da Chegada');
          if (pesoChegadaIdx === -1) pesoChegadaIdx = fi('Peso_Chegada_Obra');
          if (pesoChegadaIdx !== -1) currentRow[pesoChegadaIdx] = formatPesoForSheet(formObra.pesoChegada);

          // Calculate Tonelada (Calc Obra) = (pesoChegada - pesoVazio) / 1000
          const tcIdx = fi('Tonelada (Calc Obra)');
          if (tcIdx !== -1) {
            const pcNum = parseInt(formObra.pesoChegada, 10) / 100;
            const pvRaw = currentRow[fi('Peso_Vazio')] || '0';
            const pvNum = parseFloat(pvRaw.replace(/\./g, '').replace(',', '.')) || 0;
            if (pcNum > 0 && pvNum > 0) {
              const tonCalcObra = (pcNum - pvNum) / 1000;
              currentRow[tcIdx] = tonCalcObra.toFixed(2).replace('.', ',');
            }
          }
        }

        // Upload OCR photo if available
        if (formObra.ocrFotoFile) {
          try {
            const timestamp = Date.now();
            const ext = formObra.ocrFotoFile.name.split('.').pop() || 'jpg';
            const filePath = `${format(new Date(), 'yyyy-MM-dd')}/${foundRecord.ordem}_${foundRecord.prefixo}_${timestamp}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, formObra.ocrFotoFile, { upsert: true });
            if (!uploadError) {
              let fotoIdx = fi('Foto do Peso Chegada Obra');
              if (fotoIdx === -1) fotoIdx = fi('Foto_Peso_Chegada');
              if (fotoIdx === -1) fotoIdx = fi('Foto Peso Chegada');
              if (fotoIdx !== -1) {
                const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
                currentRow[fotoIdx] = urlData.publicUrl;
              }
            }
          } catch (fotoErr) {
            console.error('Erro ao salvar foto OCR:', fotoErr);
          }
        }

        // Update Usuario_Obra
        const userObraIdx = fi('Usuario_Obra');
        if (userObraIdx !== -1) currentRow[userObraIdx] = effectiveName;

        // Set status to Pendente_Obra (waiting for peso vazio after unloading)
        const statusIdx = fi('Status');
        if (statusIdx !== -1) currentRow[statusIdx] = 'Pendente_Obra';

        const rowNum = foundRecord.rowIndex;
        const range = buildRowRange(rowNum, currentRow.length);
        const success = await writeSheet('Apontamento_Pedreira', range, [currentRow]);
      if (!success) throw new Error('Erro ao salvar');

      // Backup to Supabase
      await supabaseBackupPedreira(currentRow, headers);

        localStorage.setItem('pedreira_data_updated', Date.now().toString());
        playSuccessSound();
        setSuccessTitle('Chegada Registrada!');
        setSuccessSubtitle(`${foundRecord.prefixo} — Aguardando descarga e pesagem vazio.`);
        setSuccessDetails([
          { label: 'Etapa', value: '🔄 Obra — Etapa 1 (Chegada)' },
          { label: 'Veículo', value: `${foundRecord.prefixo} - ${foundRecord.motorista}` },
          { label: 'OS/Ordem', value: formObraExtra.numeroPedido || foundRecord.ordem || '-' },
          { label: 'Material', value: formObraExtra.material },
          { label: 'Peso Carregado', value: `${formatPesoForSheet(formObraExtra.pesoFinal)} kg` },
          { label: 'Hora Chegada', value: horaAtual },
          { label: 'Status', value: '⏳ Pendente (aguardando peso vazio)' },
        ]);
        setSubmitted(true);

      } else if (isTransferred && isStep2) {
        // ===== STEP 2: Truck returns empty → fill peso vazio, calculate, finalize =====
        // Write peso vazio - use form field or fallback to ticket weight if missing
        let effectivePesoVazioStep2 = formObraExtra.pesoVazio;
        if (!effectivePesoVazioStep2) {
          effectivePesoVazioStep2 = (currentRow[fi('Peso_Vazio')] || '').replace(/\./g, '').replace(',', '.');
        }

        if (!effectivePesoVazioStep2) {
          toast({ title: 'Informe o peso vazio', description: 'Nenhum peso vazio encontrado no ticket ou local.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        currentRow[fi('Peso_Vazio')] = formatPesoForSheet(effectivePesoVazioStep2);

        // The peso final (carregado) is already saved from step 1
        const pesoFinalRaw = currentRow[fi('Peso_Final')] || '0';
        const derived = calculateDerivedValues(pesoFinalRaw, effectivePesoVazioStep2);
        if (fi('Peso_Liquido_Cubico') !== -1) currentRow[fi('Peso_Liquido_Cubico')] = derived.pesoLiquido;
        else if (fi('Peso_Liquido') !== -1) currentRow[fi('Peso_Liquido')] = derived.pesoLiquido;
        if (fi('Metro_Cubico') !== -1) currentRow[fi('Metro_Cubico')] = derived.metroCubico;
        if (fi('Densidade') !== -1) currentRow[fi('Densidade')] = derived.densidade;
        if (fi('Tonelada') !== -1) currentRow[fi('Tonelada')] = derived.tonelada;
        const ttIdxO = fi('Tonelada (ticket)');
        if (ttIdxO !== -1) currentRow[ttIdxO] = derived.tonelada;

        // Fill Tonelada (Calc Obra) with tonelada value on finalization
        const tcIdxO = fi('Tonelada (Calc Obra)');
        if (tcIdxO !== -1 && derived.tonelada) currentRow[tcIdxO] = derived.tonelada;

        // Save peso vazio for future suggestions
        localStorage.setItem('lastPesoVazio', formObraExtra.pesoVazio);
        setLastPesoVazio(formObraExtra.pesoVazio);

        // Update Usuario_Obra
        const userObraIdx = fi('Usuario_Obra');
        if (userObraIdx !== -1) currentRow[userObraIdx] = effectiveName;

        // Finalize
        const statusIdx = fi('Status');
        if (statusIdx !== -1) currentRow[statusIdx] = 'Finalizado';

        const rowNum = foundRecord.rowIndex;
        const range = buildRowRange(rowNum, currentRow.length);
        const success = await writeSheet('Apontamento_Pedreira', range, [currentRow]);
        if (!success) throw new Error('Erro ao salvar');

        // Upload Obra Step 2 vazio photo if available
        if (obraVazioFotoFile) {
          try {
            const timestamp = Date.now();
            const ext = obraVazioFotoFile.name.split('.').pop() || 'jpg';
            const filePath = `balanca/${format(new Date(), 'yyyy-MM-dd')}/${foundRecord.ordem || foundRecord.prefixo}_obravazio_${timestamp}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, obraVazioFotoFile, { upsert: true });
            if (!uploadError) {
              let fotoIdx = fi('Foto do Peso Saida Obra');
              if (fotoIdx === -1) fotoIdx = fi('Foto do Peso Saída Obra');
              if (fotoIdx === -1) fotoIdx = fi('Foto Peso Vazio Pedreira');
              if (fotoIdx === -1) fotoIdx = fi('Foto_Peso_Vazio_Pedreira');
              if (fotoIdx === -1) fotoIdx = fi('Foto Peso Vazio');
              if (fotoIdx === -1) fotoIdx = fi('Foto_Peso_Vazio');
              if (fotoIdx === -1) fotoIdx = fi('Foto do Peso Vazio Obra');
              if (fotoIdx === -1) fotoIdx = fi('Foto Peso Vazio Obra');
              if (fotoIdx !== -1) {
                const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
                currentRow[fotoIdx] = urlData?.publicUrl || '';
                await writeSheet('Apontamento_Pedreira', range, [currentRow]);
              }
            }
          } catch (fotoErr) {
            console.error('Erro ao salvar foto peso vazio obra:', fotoErr);
          }
        }

        localStorage.setItem('pedreira_data_updated', Date.now().toString());
        playSuccessSound();
        setSuccessTitle('Ciclo Finalizado!');
        setSuccessSubtitle(`${foundRecord.prefixo} — Peso vazio registrado.`);
        setSuccessDetails([
          { label: 'Etapa', value: '🔄 Obra — Etapa 2 (Finalização)' },
          { label: 'Veículo', value: `${foundRecord.prefixo} - ${foundRecord.motorista}` },
          { label: 'Material', value: foundRecord.material || currentRow[fi('Material')] || '-' },
          { label: 'Peso Carregado', value: `${currentRow[fi('Peso_Final')] || '-'} kg` },
          { label: 'Peso Vazio', value: `${formatPesoForSheet(formObraExtra.pesoVazio)} kg` },
          { label: 'Tonelada', value: `${derived.tonelada} t` },
        { label: 'Status', value: '✅ Finalizado' },
      ]);
      setSuccessImageUrl(carregChegadaFotoPreview);
      setSubmitted(true);

      } else {
        // ===== NORMAL FLOW (non-transferred) =====
        // Update Obra fields - usa hora do campo editável
        const horaAtual = formObra.horaChegada;
        const horaObraIdx = fi('Hora_Chegada_Obra');
        if (horaObraIdx !== -1) currentRow[horaObraIdx] = horaAtual;

        // Write Peso de Chegada na Obra
        if (formObra.pesoChegada) {
          let pesoChegadaIdx = fi('Peso Chegada Obra');
          if (pesoChegadaIdx === -1) pesoChegadaIdx = fi('Peso da Chegada');
          if (pesoChegadaIdx === -1) pesoChegadaIdx = fi('Peso_Chegada_Obra');
          if (pesoChegadaIdx !== -1) currentRow[pesoChegadaIdx] = formatPesoForSheet(formObra.pesoChegada);

          // Calculate Tonelada (Calc Obra) = (pesoChegada - pesoVazio) / 1000
          const tcIdx2 = fi('Tonelada (Calc Obra)');
          if (tcIdx2 !== -1) {
            const pcNum2 = parseInt(formObra.pesoChegada, 10) / 100;
            const pvRaw2 = formObra.pesoVazio || currentRow[fi('Peso_Vazio')] || '0';
            const pvNum2 = pvRaw2.includes(',') || pvRaw2.includes('.') ? parseBRNumber(pvRaw2) : parseBankDigits(pvRaw2);
            if (pcNum2 > 0 && pvNum2 > 0) {
              const tonCalcObra2 = (pcNum2 - pvNum2) / 1000;
              currentRow[tcIdx2] = tonCalcObra2.toFixed(2).replace('.', ',');
            }
          }
        }

        // Upload OCR photo if available
        if (formObra.ocrFotoFile && foundRecord.ordem) {
          try {
            const timestamp = Date.now();
            const ext = formObra.ocrFotoFile.name.split('.').pop() || 'jpg';
            const filePath = `${format(new Date(), 'yyyy-MM-dd')}/${foundRecord.ordem}_${foundRecord.prefixo}_${timestamp}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(filePath, formObra.ocrFotoFile, { upsert: true });
            if (!uploadError) {
              let fotoIdx = fi('Foto do Peso Chegada Obra');
              if (fotoIdx === -1) fotoIdx = fi('Foto_Peso_Chegada');
              if (fotoIdx === -1) fotoIdx = fi('Foto Peso Chegada');
              if (fotoIdx !== -1) {
                const { data: urlData } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(filePath);
                currentRow[fotoIdx] = urlData.publicUrl;
              }
            }
          } catch (fotoErr) {
            console.error('Erro ao salvar foto OCR:', fotoErr);
          }
        }

        // Update Usuario_Obra
        const userObraIdx = fi('Usuario_Obra');
        if (userObraIdx !== -1) currentRow[userObraIdx] = effectiveName;

        // Update status to Finalizado
        const statusIdx = fi('Status');
        if (statusIdx !== -1) currentRow[statusIdx] = 'Finalizado';

        // Fill Tonelada (Calc Obra) - calculate from Peso Chegada and Peso Vazio
        const tcIdxN = fi('Tonelada (Calc Obra)');
        if (tcIdxN !== -1 && !currentRow[tcIdxN]) {
          // Try to calculate from Peso Chegada Obra and Peso Vazio already in the row
          let pcIdx = fi('Peso Chegada Obra');
          if (pcIdx === -1) pcIdx = fi('Peso da Chegada');
          if (pcIdx === -1) pcIdx = fi('Peso_Chegada_Obra');
          const pcVal = pcIdx !== -1 ? currentRow[pcIdx] : '';
          const pvVal = currentRow[fi('Peso_Vazio')] || '';
          if (pcVal && pvVal) {
            const pcNum = parseBRNumber(pcVal);
            const pvNum = parseBRNumber(pvVal);
            if (!isNaN(pcNum) && !isNaN(pvNum) && pcNum > 0 && pvNum > 0) {
              const tonCalcObra = (pcNum - pvNum) / 1000;
              currentRow[tcIdxN] = formatDecimalBR(tonCalcObra);
            }
          }
          // Fallback: use Tonelada value
          if (!currentRow[tcIdxN]) {
            const tonVal = currentRow[fi('Tonelada (ticket)')] || currentRow[fi('Tonelada')] || '';
            if (tonVal) currentRow[tcIdxN] = tonVal;
          }
        }

        const rowNum = foundRecord.rowIndex;
        const range = buildRowRange(rowNum, currentRow.length);
        const success = await writeSheet('Apontamento_Pedreira', range, [currentRow]);
        if (!success) throw new Error('Erro ao atualizar');

        localStorage.setItem('pedreira_data_updated', Date.now().toString());
        playSuccessSound();
        setSuccessTitle('Entrega Confirmada!');
        setSuccessSubtitle(`OS: ${foundRecord.ordem} - Ciclo finalizado.`);
        const successDetailsList = [
          { label: 'Etapa', value: '🏢 Obra - Confirmação' },
          { label: 'OS/Ordem', value: foundRecord.ordem },
          { label: 'Veículo', value: `${foundRecord.prefixo} - ${foundRecord.motorista}` },
          { label: 'Material', value: foundRecord.material || '-' },
          { label: 'Tonelada', value: foundRecord.tonelada ? `${foundRecord.tonelada} t` : '-' },
          { label: 'Peso Chegada', value: formObra.pesoChegada ? `${formatPesoForSheet(formObra.pesoChegada)} kg` : '-' },
          { label: 'Hora Chegada', value: horaAtual },
          { label: 'Status', value: '✅ Finalizado' },
        ];
        setSuccessDetails(successDetailsList);
        setSuccessImageUrl(ocrFotoPreview);
        setSubmitted(true);
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // =================== NEW RECORD ===================
  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSelectedCaminhao(null);
    setCustomPesoVazio('');
    setFoundRecord(null);
    setSearchOS('');
    setSearchPrefixo('');
    setFormBritador({
      ...formBritador,
      caminhao: '',
      horaSaida: format(new Date(), 'HH:mm'),
    });
    setFormBalanca({
      horaChegada: format(new Date(), 'HH:mm'),
      horaSaida: '',
      numeroPedido: '',
      fornecedor: '',
      material: '',
      pesoVazio: '',
      pesoFinal: '',
    });
    setFormObra({ horaChegada: format(new Date(), 'HH:mm'), pesoChegada: '', pesoVazio: '', ocrFotoFile: null });
    setFormObraExtra({ material: '', pesoVazio: '', pesoFinal: '', numeroPedido: '' });
    setBalancaFotoFile(null);
    setObraVazioFotoFile(null);
    setSuccessImageUrl(null);
    setHervalFotoFile(null);
    setHervalFotoFile2(null);
    setFormHerval({
      data: format(new Date(), 'yyyy-MM-dd'),
      caminhao: '',
      horaChegada: format(new Date(), 'HH:mm'),
      horaSaida: '',
      numeroPedido: '',
      material: '',
      pesoVazio: '',
      pesoFinal: '',
    });
    setSelectedHervalCaminhao(null);
    setCustomHervalPesoVazio('');
    setHervalCarregTipo('proprio');
    setFormHervalVeiculo({ placa: '', motorista: '', descricao: '' });
    setHervalVeiculoFilter('');
    setFormCarregamento({
      data: format(new Date(), 'yyyy-MM-dd'),
      placa: '',
      motorista: '',
      horaChegada: format(new Date(), 'HH:mm'),
      fornecedor: '',
      numeroPedido: '',
      quantidade: '',
      material: '',
      pesoVazio: '',
      pesoFinal: '',
    });
    setCustomCarregamentoPesoVazio('');
    setPlateFilter('');
  };

  // =================== LOAD RECORDS ===================
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
        const rowUser = row[fi('Usuario_Obra')] || '';
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

  // =================== EDIT RECORD ===================
  const handleStartEdit = (record: PedreiraRecord) => {
    setEditingRecord(record);
    setEditForm({ pesoFinal: record.pesoFinal.replace(/\./g, ''), material: record.material });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < editingRecord.rowIndex) throw new Error('Registro não encontrado');
      const currentRow = [...data[editingRecord.rowIndex - 1]];
      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);

      const newPesoFinal = editForm.pesoFinal;
      if (fi('Material') !== -1) currentRow[fi('Material')] = editForm.material;
      if (fi('Peso_Final') !== -1) currentRow[fi('Peso_Final')] = formatPesoForSheet(newPesoFinal);

      const pesoVazio = currentRow[fi('Peso_Vazio')] || '0';
      const derived = calculateDerivedValues(newPesoFinal, pesoVazio);
      if (fi('Peso_Liquido') !== -1) currentRow[fi('Peso_Liquido')] = derived.pesoLiquido;
      if (fi('Metro_Cubico') !== -1) currentRow[fi('Metro_Cubico')] = derived.metroCubico;
      if (fi('Tonelada') !== -1) currentRow[fi('Tonelada')] = derived.tonelada;
      const ttIdxE = fi('Tonelada (ticket)');
      if (ttIdxE !== -1) currentRow[ttIdxE] = derived.tonelada;
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

  // =================== DELETE RECORD ===================
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
    let msg = `⛰️ *REGISTROS PEDREIRA CICLO - ${today}*\n\n👷 Apontador: ${userName}\n📊 Total: ${records.length} registro(s)\n`;
    records.forEach(r => { msg += `\n• ${r.caminhao} — ${r.material || 'Sem material'} • ${r.tonelada || '-'} ton`; });
    msg += `\n\n---\n_Enviado via ApropriAPP_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';

  // =================== SUCCESS SCREEN ===================
  if (submitted) {
    return (
      <SuccessScreen
        title={successTitle || (savedOffline ? 'Salvo Localmente!' : 'Registrado!')}
        subtitle={successSubtitle || 'Apontamento salvo com sucesso.'}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor="blue"
        imageUrl={successImageUrl || undefined}
      />
    );
  }

  // =================== ETAPA COLORS ===================
  const etapaConfig = {
    britador: { bg: 'bg-[#1d3557]', label: '🏗️ Britador', desc: 'Saída do caminhão' },
    balanca: { bg: 'bg-[#1d3557]', label: '⚖️ Balança', desc: 'Pesagem do caminhão' },
    obra: { bg: 'bg-[#1d3557]', label: '🏢 Obra', desc: 'Confirmação de entrega' },
  };

  const currentEtapa = etapaConfig[etapa];

  return (
    <div className={desktopMode ? '' : 'min-h-screen bg-white'}>
      {/* Header - hidden in desktop mode */}
      {!desktopMode && (
      <div className={`${currentEtapa.bg} p-5 sticky top-0 z-10 shadow-md`}>
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
                <h1 className="font-bold text-2xl text-white">Pedreira</h1>
                <p className="text-base text-white/80">{currentEtapa.label} — {currentEtapa.desc}</p>
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
      )}

      {/* Step Selector - only show allowed tabs */}
      <div className="flex gap-2 p-4 bg-gray-50 border-b">
        {allowedEtapas.map((step) => (
          <Button
            key={step}
            variant={etapa === step ? 'default' : 'outline'}
            className={`flex-1 h-14 text-base font-bold rounded-xl ${
              etapa === step ? 'bg-[#1d3557] hover:bg-[#162d4a] text-white' : 'border-[#1d3557] text-[#1d3557]'
            }`}
            onClick={() => { setEtapa(step); setFoundRecord(null); setSearchOS(''); }}
          >
            {etapaConfig[step].label}
          </Button>
        ))}
      </div>

      {/* Pending Records Banner (offline sync) */}
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

      {/* Yesterday Pending Cycle Banner */}
      {searchParams.get('etapa') && !foundRecord && (
        <div className="mx-5 mt-4 p-3 bg-orange-50 border border-orange-300 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">Ciclo Pendente de Ontem</p>
            <p className="text-xs text-orange-600">
              {searchParams.get('etapa') === 'balanca'
                ? `Busque o veículo "${searchParams.get('prefixo')}" para registrar a pesagem`
                : `Busque a OS "${searchParams.get('os')}" para confirmar a chegada na obra`
              }
            </p>
          </div>
        </div>
      )}

      {/* =================== PENDÊNCIAS (ciclos de dias anteriores) =================== */}
      {(pendingCycles.length > 0 || loadingPending) && (
        <div className="mx-5 mt-4">
          <Card className="bg-orange-50 border-2 border-orange-300 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-3">
              <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Ciclos Pendentes
                {pendingCycles.length > 0 && (
                  <Badge className="bg-orange-500 text-white text-sm px-2 py-0.5 ml-1">{pendingCycles.length}</Badge>
                )}
              </h3>
              <Button variant="ghost" size="sm" onClick={loadPendingCycles} disabled={loadingPending} className="h-9 w-9 p-0 text-orange-600 hover:bg-orange-100">
                <RefreshCw className={`w-4 h-4 ${loadingPending ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {loadingPending ? (
              <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
            ) : (
              <div className="space-y-2 px-4 pb-4 max-h-[50vh] overflow-y-auto">
                {pendingCycles.map((cycle, idx) => {
                  const canInteract = etapa === 'obra';
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 bg-white rounded-xl border-2 border-orange-200 transition-colors ${canInteract ? 'cursor-pointer hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100' : 'opacity-80'}`}
                      onClick={canInteract ? () => { setSelectedPendingCycle(cycle); setShowFinalizarPendenteModal(true); } : undefined}
                    >
                      <div>
                        <p className="font-bold text-base text-gray-900">{cycle.prefixo}</p>
                        <p className="text-sm text-gray-500">{cycle.motorista || '-'} • {cycle.empresa || '-'}</p>
                        <p className="text-xs text-orange-600 font-medium">📅 {cycle.data}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className={`text-xs mb-1 ${cycle.status === 'Saiu_Britador' ? 'bg-amber-500' : 'bg-blue-500'} text-white border-0`}>
                          {cycle.status === 'Saiu_Britador' ? '⚖️ Aguard. Balança' : '🏢 Aguard. Obra'}
                        </Badge>
                        {canInteract ? (
                          <p className="text-xs text-gray-500 mt-1">Toque p/ finalizar</p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">Somente visualização</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* =================== ETAPA: BRITADOR =================== */}
      {etapa === 'britador' && (
        <form onSubmit={handleSubmitBritador} className="p-5 space-y-5">


          {/* Veículo */}
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <TruckIcon className="w-7 h-7 text-[#1d3557]" />
              Veículo (Caminhão/Reboque)
            </Label>
            <Select value={formBritador.caminhao} onValueChange={handleCaminhaoChange}>
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200 max-h-[70vh] overflow-y-auto [&_[data-radix-select-viewport]]:max-h-[65vh] [&_[data-radix-select-viewport]]:overflow-y-auto">
                {[...caminhoes].sort((a, b) => a.prefixo.localeCompare(b.prefixo, undefined, { numeric: true })).map(cam => (
                  <SelectItem key={cam.prefixo} value={cam.prefixo} className="py-3 px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xl font-bold text-[#1d3557]">{cam.prefixo}</span>
                      <span className="text-sm text-gray-600">{cam.motorista || cam.descricao}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">{caminhoes.length} veículo(s) disponível(is)</p>
            {selectedCaminhao && (
              <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Motorista:</span>
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.motorista || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Empresa:</span>
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.empresa || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Placa:</span>
                  <span className="text-gray-900 font-semibold">{selectedCaminhao.placa || '-'}</span>
                </div>
              </div>
            )}
          </Card>



          {/* Hora de Saída - visível para todos, editável */}
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Clock className="w-7 h-7 text-[#1d3557]" />
              Hora de Saída do Britador
            </Label>
            <div className="flex gap-2">
              <Input
                type="time"
                value={formBritador.horaSaida}
                onChange={e => setFormBritador({ ...formBritador, horaSaida: e.target.value })}
                className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormBritador({ ...formBritador, horaSaida: format(new Date(), 'HH:mm') })}
                className="h-16 px-4 text-sm font-semibold border-2 border-[#1d3557]/20 text-[#1d3557] rounded-xl whitespace-nowrap"
              >
                Agora
              </Button>
            </div>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || sheetLoading || !formBritador.caminhao}
            className="w-full h-20 text-2xl font-bold bg-[#1d3557] hover:bg-[#162d4a] shadow-xl mt-4 rounded-2xl"
          >
            {loading || sheetLoading ? (
              <><Loader2 className="w-8 h-8 mr-3 animate-spin" /> Salvando...</>
            ) : (
              <><CheckCircle2 className="w-8 h-8 mr-3" /> Registrar Saída</>
            )}
          </Button>
        </form>
      )}

      {/* =================== ETAPA: BALANÇA =================== */}
      {etapa === 'balanca' && (
        <div className="p-5 space-y-5">
          {/* Tab selector: Brita Potiguar / Herval */}
          <div className="flex gap-2">
            <Button
              variant={balancaTab === 'britaPotiguar' ? 'default' : 'outline'}
              className={`flex-1 h-14 text-lg font-bold rounded-xl ${balancaTab === 'britaPotiguar' ? 'bg-[#1d3557] hover:bg-[#162d4a]' : 'border-[#1d3557] text-[#1d3557]'}`}
              onClick={() => { setBalancaTab('britaPotiguar'); setFoundRecord(null); }}
            >
              <Factory className="w-5 h-5 mr-2" /> Brita Potiguar
            </Button>
            <Button
              variant={balancaTab === 'herval' ? 'default' : 'outline'}
              className={`flex-1 h-14 text-lg font-bold rounded-xl ${balancaTab === 'herval' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-600 text-purple-600'}`}
              onClick={() => { setBalancaTab('herval'); setFoundRecord(null); }}
            >
              <Mountain className="w-5 h-5 mr-2" /> Herval
            </Button>
          </div>

          {/* ===== TAB: BRITA POTIGUAR (normal flow from Britador) ===== */}
          {balancaTab === 'britaPotiguar' && (
            <>
              {/* Transfer feature toggle */}
              {!foundRecord && (
                <Card className={`p-4 rounded-2xl shadow-sm border-2 ${transferEnabled ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Send className={`w-5 h-5 ${transferEnabled ? 'text-amber-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`font-bold text-base ${transferEnabled ? 'text-amber-800' : 'text-gray-700'}`}>Transferir p/ Obra</p>
                        <p className="text-xs text-gray-500">Habilitar opção de pular balança</p>
                      </div>
                    </div>
                    <Switch
                      checked={transferEnabled}
                      onCheckedChange={handleToggleTransferEnabled}
                    />
                  </div>

                  {/* Auto-transfer sub-toggle (only when transfer is enabled) */}
                  {transferEnabled && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <RefreshCw className={`w-4 h-4 ${autoTransfer ? 'text-amber-600' : 'text-gray-400'}`} />
                          <div>
                            <p className={`font-semibold text-sm ${autoTransfer ? 'text-amber-800' : 'text-gray-600'}`}>Transferência Automática</p>
                            <p className="text-xs text-gray-500">Envia todos direto p/ Obra</p>
                          </div>
                        </div>
                        <Switch
                          checked={autoTransfer}
                          onCheckedChange={toggleAutoTransfer}
                        />
                      </div>
                      {autoTransfer && transitRecords.length > 0 && (
                        <Button
                          type="button"
                          className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white font-bold"
                          disabled={autoTransferring}
                          onClick={handleBatchAutoTransfer}
                        >
                          {autoTransferring ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Transferindo...</>
                          ) : (
                            <><Send className="w-4 h-4 mr-2" /> Transferir {transitRecords.length} veículo(s) agora</>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* Enable transfer confirmation dialog */}
              <AlertDialog open={showEnableTransferConfirm} onOpenChange={setShowEnableTransferConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Habilitar Transferência para Obra?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ao habilitar, a opção de transferir veículos diretamente para a Obra (sem pesagem na Balança) ficará disponível. 
                      Use com cuidado para evitar erros no fluxo de pesagem.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmEnableTransfer}>
                      Habilitar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Transit panel - trucks coming from Britador */}
              {!foundRecord && (
                <Card className="bg-[#1d3557]/5 border-2 border-[#1d3557]/30 p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-[#1d3557] flex items-center gap-2">
                      <TruckIcon className="w-6 h-6" />
                      Em Trânsito para Balança
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500 text-white text-sm px-3 py-1">{transitRecords.length}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => loadTransitRecords('Saiu_Britador')} disabled={loadingTransit} className="h-10 w-10 p-0">
                        <RefreshCw className={`w-5 h-5 ${loadingTransit ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  {loadingTransit ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 animate-spin text-[#1d3557]" /></div>
                  ) : transitRecords.length === 0 ? (
                    <p className="text-base text-[#1d3557]/70 text-center py-6">Nenhum caminhão em trânsito</p>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                      {transitRecords.map((rec, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-300 shadow-sm"
                        >
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-amber-100 active:bg-amber-200 transition-colors rounded-xl -m-1 p-1"
                            onClick={() => {
                              setSearchPrefixo(rec.prefixo);
                              handleSearchByPrefixo(rec.prefixo);
                            }}
                          >
                            <div>
                              <p className="font-bold text-lg text-gray-900">{rec.prefixo}</p>
                              <p className="text-base text-gray-600">{rec.motorista}</p>
                              <p className="text-sm text-gray-400">{rec.empresa || '-'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold text-[#1d3557]">Saiu {rec.horaSaida}</p>
                              <Badge className="bg-primary text-primary-foreground text-sm font-bold mt-1 px-3 py-1 shadow-md animate-pulse">Toque p/ selecionar</Badge>
                            </div>
                          </div>
                          {transferEnabled && (
                            <button
                              type="button"
                              className="w-full mt-2 text-xs text-muted-foreground hover:text-amber-600 transition-colors flex items-center justify-center gap-1 py-1"
                              disabled={transferring}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setSearchPrefixo(rec.prefixo);
                                await handleSearchByPrefixo(rec.prefixo);
                                setShowTransferConfirm(true);
                              }}
                            >
                              <Send className="w-3 h-3" />
                              Transferir p/ Obra
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Busca manual por prefixo (fallback) */}
              {!foundRecord && (
                <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                  <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                    <Search className="w-7 h-7 text-[#1d3557]" />
                    Buscar por Prefixo
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      type="text"
                      placeholder="Digite o prefixo"
                      value={searchPrefixo}
                      onChange={e => setSearchPrefixo(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="bg-white border-2 border-[#1d3557]/30 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={searching}
                      className="h-16 px-6 bg-[#1d3557] hover:bg-[#162d4a] rounded-xl text-lg"
                    >
                      {searching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Found Record Info */}
              {foundRecord && (
                <form onSubmit={handleSubmitBalanca} className="space-y-5">
                  {/* Record summary */}
                  <Card className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold text-blue-800">Registro Encontrado</h3>
                      <Badge className="bg-blue-500 text-white text-base px-3 py-1">{foundRecord.prefixo}</Badge>
                    </div>
                    <div className="space-y-2 text-lg">
                      <div className="flex justify-between"><span className="text-gray-500">Veículo:</span><span className="font-semibold">{foundRecord.prefixo}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Motorista:</span><span className="font-semibold">{foundRecord.motorista || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Empresa:</span><span className="font-semibold">{foundRecord.empresa || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Fornecedor:</span><span className="font-semibold">{foundRecord.fornecedor || 'Brita Potiguar'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Saída Britador:</span><span className="font-semibold text-amber-600">{foundRecord.horaSaidaBritador || '-'}</span></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={() => { setFoundRecord(null); setSearchPrefixo(''); }}>
                        Buscar outro veículo
                      </Button>
                      {transferEnabled && (
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="border-amber-400 text-amber-700 hover:bg-amber-50"
                          onClick={() => setShowTransferConfirm(true)}
                          disabled={transferring}
                        >
                          {transferring ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                          Transferir p/ Obra
                        </Button>
                      )}
                    </div>
                  </Card>

                  {/* Transfer confirmation dialog */}
                  <AlertDialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Transferir para Obra?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O registro do veículo <strong>{foundRecord.prefixo}</strong> será enviado diretamente para a etapa Obra, sem pesagem na Balança. 
                          Use esta opção quando não houver operador na balança.
                          O peso será registrado apenas na chegada à obra.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTransferToObra} disabled={transferring}>
                          {transferring ? 'Transferindo...' : 'Confirmar Transferência'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Fornecedor - auto-filled as Brita Potiguar */}
                  <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Building className="w-7 h-7 text-blue-600" />
                      Fornecedor
                    </Label>
                    <Input
                      type="text"
                      value="Brita Potiguar"
                      disabled
                      className="bg-gray-100 border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium"
                    />
                    <p className="text-sm text-muted-foreground mt-2">Preenchido automaticamente (passou pelo Britador)</p>
                  </Card>

                  {/* Nº da OS / Ordem de Carregamento */}
                  <Card className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <FileText className="w-7 h-7 text-blue-600" />
                      Nº da OS / Ordem de Carregamento
                    </Label>
                    <Input
                      type="text"
                      placeholder="Ex: 12345"
                      value={formBalanca.numeroPedido}
                      onChange={e => setFormBalanca({ ...formBalanca, numeroPedido: e.target.value })}
                      className="bg-white border-2 border-blue-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
                    />
                    <p className="text-sm text-blue-700 mt-2 font-medium">
                      ⚠️ Este número será usado para localizar o registro na etapa da Obra
                    </p>
                  </Card>

                  {/* Hora Chegada Balança */}
                  <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Clock className="w-7 h-7 text-blue-600" />
                      Hora de Chegada na Balança
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={formBalanca.horaChegada}
                        onChange={e => setFormBalanca({ ...formBalanca, horaChegada: e.target.value })}
                        className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormBalanca({ ...formBalanca, horaChegada: format(new Date(), 'HH:mm') })}
                        className="h-16 px-4 text-sm font-semibold border-2 border-blue-200 text-blue-700 rounded-xl whitespace-nowrap"
                      >
                        Agora
                      </Button>
                    </div>
                  </Card>

                  {/* Hora Saída Balança */}
                  <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Clock className="w-7 h-7 text-blue-600" />
                      Hora de Saída da Balança
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={formBalanca.horaSaida}
                        onChange={e => setFormBalanca({ ...formBalanca, horaSaida: e.target.value })}
                        className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormBalanca({ ...formBalanca, horaSaida: format(new Date(), 'HH:mm') })}
                        className="h-16 px-4 text-sm font-semibold border-2 border-blue-200 text-blue-700 rounded-xl whitespace-nowrap"
                      >
                        Agora
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Se não informado, será preenchido automaticamente com a hora atual ao salvar
                    </p>
                  </Card>

                  {/* Material */}
                  <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Package className="w-7 h-7 text-blue-600" />
                      Tipo de Material
                    </Label>
                    <Select value={formBalanca.material} onValueChange={v => setFormBalanca({ ...formBalanca, material: v })}>
                      <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                        <SelectValue placeholder="Selecione o material" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-gray-200">
                        {materiais.map(mat => (
                          <SelectItem key={mat.id} value={mat.nome} className="text-lg py-3">{mat.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>

                  {/* Peso Vazio */}
                  <Card className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Scale className="w-7 h-7 text-blue-600" />
                      Peso Vazio (kg)
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder={lastPesoVazio ? `Último: ${lastPesoVazio}` : 'Digite apenas números'}
                      value={customPesoVazio}
                      onChange={e => setCustomPesoVazio(e.target.value.replace(/[^0-9]/g, ''))}
                      className="bg-white border-2 border-blue-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
                    />
                    {customPesoVazio ? (
                      <p className="text-sm text-blue-700 mt-2 font-medium">
                        Será salvo como: <strong>{formatPesoForSheet(customPesoVazio)} kg</strong>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2">
                        📸 Toque na câmera para ler da balança ou digite apenas números. Ex: 25960 = 25.960,00
                      </p>
                    )}
                  </Card>


                  {/* Peso Final */}
                  <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Scale className="w-7 h-7 text-blue-600" />
                      Peso Final (kg)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Digite apenas números"
                        value={formBalanca.pesoFinal}
                        onChange={e => setFormBalanca({ ...formBalanca, pesoFinal: e.target.value.replace(/[^0-9]/g, '') })}
                        className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                      />
                    </div>
                    {formBalanca.pesoFinal && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Será salvo como: <strong>{formatPesoForSheet(formBalanca.pesoFinal)} kg</strong>
                      </p>
                    )}
                  </Card>

                  {/* Foto da Balança */}
                  <Card className="bg-amber-50 border-2 border-amber-300 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Camera className="w-7 h-7 text-amber-600" />
                      Foto da Balança (contraprova)
                    </Label>
                    
                    <input
                      ref={balancaFotoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setBalancaFotoFile(file);
                      }}
                    />
                    {balancaFotoFile ? (
                      <div className="space-y-3">
                        <img
                          src={balancaFotoPreview || ''}
                          alt="Foto balança"
                          className="w-full max-h-48 object-contain rounded-xl border-2 border-amber-200"
                        />
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="flex-1 h-14 text-lg rounded-xl border-amber-300" onClick={() => {
                            if (balancaFotoInputRef.current) {
                              balancaFotoInputRef.current.value = '';
                              balancaFotoInputRef.current.setAttribute('capture', 'environment');
                              balancaFotoInputRef.current.click();
                            }
                          }}>
                            <Camera className="w-5 h-5 mr-2" /> Câmera
                          </Button>
                          <Button type="button" variant="outline" className="flex-1 h-14 text-lg rounded-xl border-amber-300" onClick={() => {
                            if (balancaFotoInputRef.current) {
                              balancaFotoInputRef.current.value = '';
                              balancaFotoInputRef.current.removeAttribute('capture');
                              balancaFotoInputRef.current.click();
                            }
                          }}>
                            <ImageIcon className="w-5 h-5 mr-2" /> Galeria
                          </Button>
                          <Button type="button" variant="outline" className="h-14 px-4 text-lg rounded-xl border-red-300 text-red-600" onClick={() => setBalancaFotoFile(null)}>
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1 h-16 text-lg rounded-xl border-2 border-amber-400 text-amber-700" onClick={() => {
                          if (balancaFotoInputRef.current) {
                            balancaFotoInputRef.current.value = '';
                            balancaFotoInputRef.current.setAttribute('capture', 'environment');
                            balancaFotoInputRef.current.click();
                          }
                        }}>
                          <Camera className="w-6 h-6 mr-2" /> Tirar Foto
                        </Button>
                        <Button type="button" variant="outline" className="flex-1 h-16 text-lg rounded-xl border-2 border-amber-400 text-amber-700" onClick={() => {
                          if (balancaFotoInputRef.current) {
                            balancaFotoInputRef.current.value = '';
                            balancaFotoInputRef.current.removeAttribute('capture');
                            balancaFotoInputRef.current.click();
                          }
                        }}>
                          <ImageIcon className="w-6 h-6 mr-2" /> Galeria
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground mt-2">
                      Opcional — serve como contraprova do peso registrado
                    </p>
                  </Card>

                  {/* Calculated Values */}
                  {formBalanca.pesoFinal && customPesoVazio && (
                    <Card className="bg-green-50 border-2 border-green-200 p-6 rounded-2xl shadow-sm">
                      <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                        <Scale className="w-7 h-7 text-green-600" />
                        Valores Calculados
                      </Label>
                      {(() => {
                        const derived = calculateDerivedValues(formBalanca.pesoFinal, customPesoVazio);
                        return (
                          <div className="grid grid-cols-2 gap-4 text-lg">
                            <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                              <span className="text-gray-500">Peso Líq:</span>
                              <span className="text-green-600 font-bold">{derived.pesoLiquido} kg</span>
                            </div>
                            <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                              <span className="text-gray-500">Tonelada:</span>
                              <span className="text-green-600 font-bold">{derived.tonelada} t</span>
                            </div>
                            <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                              <span className="text-gray-500">m³:</span>
                              <span className="text-green-600 font-bold">{derived.metroCubico}</span>
                            </div>
                            <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                              <span className="text-gray-500">Dens:</span>
                              <span className="text-green-600 font-bold">{derived.densidade}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </Card>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={loading || sheetLoading || !formBalanca.material || !formBalanca.pesoFinal}
                    className="w-full h-20 text-2xl font-bold bg-[#1d3557] hover:bg-[#162d4a] shadow-xl mt-4 rounded-2xl"
                  >
                    {loading || sheetLoading ? (
                      <><Loader2 className="w-8 h-8 mr-3 animate-spin" /> Salvando...</>
                    ) : (
                      <><CheckCircle2 className="w-8 h-8 mr-3" /> Registrar Pesagem</>
                    )}
                  </Button>
                </form>
              )}
            </>
          )}

          {/* ===== TAB: HERVAL (Direct entry - no Britador) ===== */}
          {balancaTab === 'herval' && (
            <form onSubmit={handleSubmitHerval} className="space-y-5">
              <Card className="bg-purple-50 border-2 border-purple-300 p-4 rounded-2xl shadow-sm">
                <p className="text-purple-800 font-semibold text-center">
                  🏔️ Entrada direta — Fornecedor Herval (sem passagem pelo Britador)
                </p>
              </Card>

              {/* Sub-tabs: Carregamento Próprio vs Veíc. Herval */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={hervalCarregTipo === 'proprio' ? 'default' : 'outline'}
                  className={`flex-1 h-12 text-base font-bold rounded-xl ${hervalCarregTipo === 'proprio' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-400 text-purple-700'}`}
                  onClick={() => { setHervalCarregTipo('proprio'); setFormHervalVeiculo({ placa: '', motorista: '', descricao: '' }); }}
                >
                  <TruckIcon className="w-4 h-4 mr-2" /> Carreg. Próprio
                </Button>
                <Button
                  type="button"
                  variant={hervalCarregTipo === 'veiculo_herval' ? 'default' : 'outline'}
                  className={`flex-1 h-12 text-base font-bold rounded-xl ${hervalCarregTipo === 'veiculo_herval' ? 'bg-amber-600 hover:bg-amber-700' : 'border-amber-400 text-amber-700'}`}
                  onClick={() => { setHervalCarregTipo('veiculo_herval'); setSelectedHervalCaminhao(null); setFormHerval({ ...formHerval, caminhao: '' }); }}
                >
                  <Mountain className="w-4 h-4 mr-2" /> Veíc. Herval
                </Button>
              </div>

              {/* Veículo - Carregamento Próprio (uses obra fleet) */}
              {hervalCarregTipo === 'proprio' && (
                <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                  <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                    <TruckIcon className="w-7 h-7 text-purple-600" />
                    Veículo (Frota Obra)
                  </Label>
                  <Select value={formHerval.caminhao} onValueChange={(prefixo) => {
                    const found = caminhoes.find(c => c.prefixo === prefixo);
                    setSelectedHervalCaminhao(found || null);
                    setFormHerval({ ...formHerval, caminhao: prefixo });
                    if (found?.pesoVazio) {
                      const rawDigits = found.pesoVazio.replace(/[^0-9]/g, '');
                      setCustomHervalPesoVazio(rawDigits || found.pesoVazio);
                    } else if (lastPesoVazio) {
                      setCustomHervalPesoVazio(lastPesoVazio);
                    }
                  }}>
                    <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                      <SelectValue placeholder="Selecione o veículo" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-2 border-gray-200 max-h-[70vh] overflow-y-auto [&_[data-radix-select-viewport]]:max-h-[65vh] [&_[data-radix-select-viewport]]:overflow-y-auto">
                      {caminhoes.map(cam => (
                        <SelectItem key={cam.prefixo} value={cam.prefixo} className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xl font-bold text-[#1d3557]">{cam.prefixo}</span>
                            <span className="text-sm text-gray-600">{cam.motorista || cam.descricao}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-2">{caminhoes.length} veículo(s) disponível(is)</p>
                  {selectedHervalCaminhao && (
                    <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-xl text-lg space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Motorista:</span>
                        <span className="text-gray-900 font-semibold">{selectedHervalCaminhao.motorista || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Empresa:</span>
                        <span className="text-gray-900 font-semibold">{selectedHervalCaminhao.empresa || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Placa:</span>
                        <span className="text-gray-900 font-semibold">{selectedHervalCaminhao.placa || '-'}</span>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Veículo - Veíc. Herval (manual input with saved vehicles) */}
              {hervalCarregTipo === 'veiculo_herval' && (
                <Card className="bg-amber-50 border-2 border-amber-300 p-6 rounded-2xl shadow-sm">
                  <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                    <Mountain className="w-7 h-7 text-amber-600" />
                    Veículo Herval
                  </Label>

                  {/* Saved vehicles quick select */}
                  {savedHervalVeiculos.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-amber-800 mb-2">Veículos salvos:</p>
                      {savedHervalVeiculos.length > 5 && (
                        <Input
                          type="text"
                          placeholder="Filtrar placa..."
                          value={hervalVeiculoFilter}
                          onChange={e => setHervalVeiculoFilter(e.target.value)}
                          className="mb-2 h-10 text-base rounded-xl border-amber-300"
                        />
                      )}
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {savedHervalVeiculos
                          .filter(v => !hervalVeiculoFilter || v.placa.includes(hervalVeiculoFilter.toUpperCase()))
                          .map(v => (
                            <Button
                              key={v.placa}
                              type="button"
                              variant={formHervalVeiculo.placa.toUpperCase() === v.placa ? 'default' : 'outline'}
                              className={`h-10 text-sm rounded-xl ${formHervalVeiculo.placa.toUpperCase() === v.placa ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border-amber-400 text-amber-800'}`}
                              onClick={() => {
                                setFormHervalVeiculo({ placa: v.placa, motorista: v.motorista, descricao: v.descricao });
                              }}
                            >
                              {v.placa} {v.motorista ? `- ${v.motorista}` : ''}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Manual vehicle input fields */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-base font-semibold text-gray-700 mb-1 block">Placa *</Label>
                      <Input
                        type="text"
                        placeholder="Ex: ABC-1234"
                        value={formHervalVeiculo.placa}
                        onChange={e => {
                          const upper = e.target.value.toUpperCase();
                          setFormHervalVeiculo({ ...formHervalVeiculo, placa: upper });
                          // Auto-fill from saved
                          const saved = getHervalMotoristaByPlate(upper);
                          if (saved && upper.length >= 7) {
                            setFormHervalVeiculo({ placa: upper, motorista: saved.motorista, descricao: saved.descricao });
                          }
                        }}
                        className="bg-white border-2 border-amber-400 text-gray-900 h-14 text-lg rounded-xl font-medium"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold text-gray-700 mb-1 block">Motorista</Label>
                      <Input
                        type="text"
                        placeholder="Nome do motorista"
                        value={formHervalVeiculo.motorista}
                        onChange={e => setFormHervalVeiculo({ ...formHervalVeiculo, motorista: e.target.value })}
                        className="bg-white border-2 border-gray-300 text-gray-900 h-14 text-lg rounded-xl font-medium"
                      />
                    </div>
                    <div>
                      <Label className="text-base font-semibold text-gray-700 mb-1 block">Descrição do Veículo</Label>
                      <Input
                        type="text"
                        placeholder="Ex: Caminhão Basculante"
                        value={formHervalVeiculo.descricao}
                        onChange={e => setFormHervalVeiculo({ ...formHervalVeiculo, descricao: e.target.value })}
                        className="bg-white border-2 border-gray-300 text-gray-900 h-14 text-lg rounded-xl font-medium"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 mt-3">
                    💾 Os dados do veículo serão salvos automaticamente para lançamentos futuros
                  </p>
                </Card>
              )}

              {/* Nº da OS */}
              <Card className="bg-purple-50 border-2 border-purple-300 p-6 rounded-2xl shadow-sm">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <FileText className="w-7 h-7 text-purple-600" />
                  Nº da OS / Ordem de Carregamento
                </Label>
                <Input
                  type="text"
                  placeholder="Ex: 12345"
                  value={formHerval.numeroPedido}
                  onChange={e => setFormHerval({ ...formHerval, numeroPedido: e.target.value })}
                  className="bg-white border-2 border-purple-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
                />
              </Card>

              {/* Hora Chegada */}
              <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <Clock className="w-7 h-7 text-purple-600" />
                  Hora de Chegada na Balança
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={formHerval.horaChegada}
                    onChange={e => setFormHerval({ ...formHerval, horaChegada: e.target.value })}
                    className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormHerval({ ...formHerval, horaChegada: format(new Date(), 'HH:mm') })}
                    className="h-16 px-4 text-sm font-semibold border-2 border-purple-200 text-purple-700 rounded-xl whitespace-nowrap"
                  >
                    Agora
                  </Button>
                </div>
              </Card>

              {/* Hora Saída */}
              <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <Clock className="w-7 h-7 text-purple-600" />
                  Hora de Saída da Balança
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={formHerval.horaSaida}
                    onChange={e => setFormHerval({ ...formHerval, horaSaida: e.target.value })}
                    className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormHerval({ ...formHerval, horaSaida: format(new Date(), 'HH:mm') })}
                    className="h-16 px-4 text-sm font-semibold border-2 border-purple-200 text-purple-700 rounded-xl whitespace-nowrap"
                  >
                    Agora
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Se não informado, será preenchido automaticamente com a hora atual
                </p>
              </Card>

              {/* Material */}
              <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <Package className="w-7 h-7 text-purple-600" />
                  Tipo de Material
                </Label>
                <Select value={formHerval.material} onValueChange={v => setFormHerval({ ...formHerval, material: v })}>
                  <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                    <SelectValue placeholder="Selecione o material" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-gray-200">
                    {materiais.map(mat => (
                      <SelectItem key={mat.id} value={mat.nome} className="text-lg py-3">{mat.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>

              {/* Peso Vazio */}
              <Card className="bg-purple-50 border-2 border-purple-300 p-6 rounded-2xl shadow-sm">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <Scale className="w-7 h-7 text-purple-600" />
                  Peso Vazio (kg)
                </Label>
                <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={lastPesoVazio ? `Último: ${lastPesoVazio}` : 'Digite apenas números'}
                  value={customHervalPesoVazio}
                  onChange={e => setCustomHervalPesoVazio(e.target.value.replace(/[^0-9]/g, ''))}
                  className="bg-white border-2 border-purple-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {customHervalPesoVazio
                    ? <>Será salvo como: <strong>{formatPesoForSheet(customHervalPesoVazio)} kg</strong></>
                    : 'Digite apenas números. Ex: 25960 = 25.960,00'
                  }
                </p>
              </Card>

              {/* Peso Final (Carregado) */}
              <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                  <Scale className="w-7 h-7 text-purple-600" />
                  Peso Final (Carregado) (kg)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Digite apenas números"
                    value={formHerval.pesoFinal}
                    onChange={e => setFormHerval({ ...formHerval, pesoFinal: e.target.value.replace(/[^0-9]/g, '') })}
                    className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (hervalFotoInputRef.current) {
                        hervalFotoInputRef.current.value = '';
                        hervalFotoInputRef.current.setAttribute('capture', 'environment');
                        hervalFotoInputRef.current.click();
                      }
                    }}
                    className="h-16 px-4 border-2 border-gray-300 text-purple-700 rounded-xl"
                  >
                    <Camera className="w-6 h-6" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (hervalFotoInputRef.current) {
                        hervalFotoInputRef.current.value = '';
                        hervalFotoInputRef.current.removeAttribute('capture');
                        hervalFotoInputRef.current.click();
                      }
                    }}
                    className="h-16 px-4 border-2 border-gray-300 text-purple-700 rounded-xl"
                  >
                    <ImageIcon className="w-6 h-6" />
                  </Button>
                </div>
                <input
                  ref={hervalFotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setHervalFotoFile(file);
                  }}
                />
                {hervalFotoPreview && (
                  <div className="mt-3 relative">
                    <img src={hervalFotoPreview} alt="Foto balança" className="w-full max-h-48 object-contain rounded-xl border-2 border-gray-300" />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button type="button" size="sm" variant="secondary" className="bg-white/90 text-purple-700 border border-gray-300 rounded-lg text-xs" onClick={() => {
                        if (hervalFotoInputRef.current) {
                          hervalFotoInputRef.current.value = '';
                          hervalFotoInputRef.current.setAttribute('capture', 'environment');
                          hervalFotoInputRef.current.click();
                        }
                      }}>
                        Trocar
                      </Button>
                      <Button type="button" size="sm" variant="destructive" className="rounded-lg text-xs" onClick={() => setHervalFotoFile(null)}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                )}
                {formHerval.pesoFinal && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Será salvo como: <strong>{formatPesoForSheet(formHerval.pesoFinal)} kg</strong>
                  </p>
                )}
              </Card>

              {/* Calculated Values */}
              {formHerval.pesoFinal && customHervalPesoVazio && (
                <Card className="bg-green-50 border-2 border-green-200 p-6 rounded-2xl shadow-sm">
                  <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                    <Scale className="w-7 h-7 text-green-600" />
                    Valores Calculados
                  </Label>
                  {(() => {
                    const derived = calculateDerivedValues(formHerval.pesoFinal, customHervalPesoVazio);
                    return (
                      <div className="grid grid-cols-2 gap-4 text-lg">
                        <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                          <span className="text-gray-500">Peso Líq:</span>
                          <span className="text-green-600 font-bold">{derived.pesoLiquido} kg</span>
                        </div>
                        <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                          <span className="text-gray-500">Tonelada:</span>
                          <span className="text-green-600 font-bold">{derived.tonelada} t</span>
                        </div>
                        <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                          <span className="text-gray-500">m³:</span>
                          <span className="text-green-600 font-bold">{derived.metroCubico}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                          <span className="text-gray-500">Dens:</span>
                          <span className="text-green-600 font-bold">{derived.densidade}</span>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || sheetLoading || 
                  (hervalCarregTipo === 'proprio' ? !formHerval.caminhao : !formHervalVeiculo.placa.trim()) || 
                  !formHerval.material || !formHerval.pesoFinal}
                className={`w-full h-20 text-2xl font-bold shadow-xl mt-4 rounded-2xl ${hervalCarregTipo === 'veiculo_herval' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-500 hover:bg-purple-600'}`}
              >
                {loading || sheetLoading ? (
                  <><Loader2 className="w-8 h-8 mr-3 animate-spin" /> Salvando...</>
                ) : (
                  <><CheckCircle2 className="w-8 h-8 mr-3" /> {hervalCarregTipo === 'veiculo_herval' ? 'Registrar Veíc. Herval' : 'Registrar Pesagem Herval'}</>
                )}
              </Button>
            </form>
          )}
        </div>
      )}

      {/* =================== ETAPA: OBRA =================== */}
      {etapa === 'obra' && (
        <div className="p-5 space-y-5">
          {/* Obra Sub-tabs */}
          <div className="flex gap-2">
            <Button
              variant={obraTab === 'ciclo' ? 'default' : 'outline'}
              className={`flex-1 h-12 text-sm font-bold rounded-xl ${
                obraTab === 'ciclo' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-300 text-blue-700'
              }`}
              onClick={() => { setObraTab('ciclo'); setFoundRecord(null); }}
            >
              <TruckIcon className="w-4 h-4 mr-1" />
              Ciclo Pedreira
            </Button>
            <Button
              variant={obraTab === 'carregamento' ? 'default' : 'outline'}
              className={`flex-1 h-12 text-sm font-bold rounded-xl ${
                obraTab === 'carregamento' ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-green-300 text-green-700'
              }`}
              onClick={() => { setObraTab('carregamento'); setFoundRecord(null); }}
            >
              <Package className="w-4 h-4 mr-1" />
              Carreg. Direto
            </Button>
          </div>

          {/* ===== SUB-TAB: CICLO (normal flow) ===== */}
          {obraTab === 'ciclo' && (<>
          {/* Transit panel - trucks heading to Obra */}
          {!foundRecord && (
            <Card className="bg-blue-50 border-2 border-blue-300 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                  <TruckIcon className="w-6 h-6" />
                  Em Trânsito para Obra
                </h3>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500 text-white text-sm px-3 py-1">{transitRecords.length}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => loadTransitRecords('Pesado')} disabled={loadingTransit} className="h-10 w-10 p-0">
                    <RefreshCw className={`w-5 h-5 ${loadingTransit ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              {loadingTransit ? (
                <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
              ) : transitRecords.length === 0 ? (
                <p className="text-base text-blue-600 text-center py-6">Nenhum caminhão em trânsito para obra</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {transitRecords.map((rec, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer hover:bg-opacity-80 active:bg-opacity-60 transition-colors shadow-sm ${
                        rec.status === 'Pendente_Obra' 
                          ? 'bg-orange-50 border-orange-400 hover:border-orange-500' 
                          : 'bg-amber-50 border-amber-300 hover:border-amber-400'
                      }`}
                      onClick={async () => {
                        if (rec.ordem) setSearchOS(rec.ordem);
                        setSearching(true);
                        setFoundRecord(null);
                        try {
                          const data = await readSheet('Apontamento_Pedreira');
                          if (!data || data.length < 2) return;
                          const headers = data[0];
                          const fi = (name: string) => headers.indexOf(name);
                          for (let i = data.length - 1; i >= 1; i--) {
                            const row = data[i];
                            const status = row[fi('Status')] || '';
                            if (status !== 'Pesado' && status !== 'Pendente_Obra') continue;
                            
                            if (rec.ordem) {
                              const ordem = (row[fi('Ordem_Carregamento')] || '').trim();
                              if (ordem !== rec.ordem) continue;
                            } else {
                              const prefixo = (row[fi('Prefixo_Eq')] || '').trim();
                              if (prefixo !== rec.prefixo) continue;
                            }
                            
                            setFoundRecord({
                              rowIndex: i + 1, row: [...row], headers, status,
                              ordem: row[fi('Ordem_Carregamento')] || '',
                              prefixo: row[fi('Prefixo_Eq')] || '', empresa: row[fi('Empresa_Eq')] || '',
                              motorista: row[fi('Motorista')] || '', placa: row[fi('Placa')] || '',
                              descricao: row[fi('Descricao_Eq')] || '', fornecedor: row[fi('Fornecedor')] || '',
                              horaSaidaBritador: row[fi('Hora_Saida_Britador')] || '',
                            horaBalanca: row[fi('Hora')] || '', material: row[fi('Material')] || '',
                            horaChegadaBalanca: row[fi('Hora_Chegada_Balanca')] || '',
                            pesoVazio: row[fi('Peso_Vazio')] || '', pesoFinal: row[fi('Peso_Final')] || '',
                            pesoLiquido: row[fi('Peso_Liquido_Cubico')] || row[fi('Peso_Liquido')] || '',
                            tonelada: row[fi('Tonelada')] || '', metroCubico: row[fi('Metro_Cubico')] || '',
                            });
                            setFormObra({ horaChegada: format(new Date(), 'HH:mm'), pesoChegada: '', pesoVazio: '', ocrFotoFile: null });
                            setFormObraExtra({ material: '', pesoVazio: '', pesoFinal: '', numeroPedido: '' });
                            toast({ title: '✅ Registro encontrado!' });
                            break;
                          }
                        } catch (error: any) {
                          toast({ title: 'Erro ao buscar', description: error.message, variant: 'destructive' });
                        } finally {
                          setSearching(false);
                        }
                      }}
                    >
                      <div>
                        <p className="font-bold text-lg text-gray-900">{rec.prefixo}</p>
                        <p className="text-base text-gray-600">{rec.motorista}</p>
                        <p className="text-sm text-gray-400">{rec.empresa || '-'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-green-600">OS: {rec.ordem || '-'}</p>
                        {rec.status === 'Pendente_Obra' ? (
                          <Badge className="bg-orange-500 text-white text-xs mt-1">⏳ Aguardando peso vazio</Badge>
                        ) : (
                          <Badge className="bg-blue-600 text-white text-xs mt-1">Toque p/ selecionar</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}


          {/* Found Record Info for Obra */}
          {foundRecord && (
            <form onSubmit={handleSubmitObra} className="space-y-5">
              {/* Record details */}
              <Card className={`p-6 rounded-2xl shadow-sm border-2 ${foundRecord.horaChegadaBalanca === 'Transferido' ? 'bg-amber-50 border-amber-400' : 'bg-green-50 border-green-300'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-xl font-bold ${foundRecord.horaChegadaBalanca === 'Transferido' ? 'text-amber-800' : 'text-green-800'}`}>Dados do Carregamento</h3>
                  <div className="flex items-center gap-2">
                    {foundRecord.horaChegadaBalanca === 'Transferido' && (
                      <Badge className="bg-amber-500 text-white text-xs px-2 py-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Transferido
                      </Badge>
                    )}
                    <Badge className={`text-white text-base px-3 py-1 ${foundRecord.horaChegadaBalanca === 'Transferido' ? 'bg-amber-600' : 'bg-green-500'}`}>OS: {foundRecord.ordem}</Badge>
                  </div>
                </div>
                {foundRecord.horaChegadaBalanca === 'Transferido' && (
                  <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-3 flex items-center gap-2 text-amber-800 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Sem pesagem na balança — preencha material e pesos abaixo.
                  </div>
                )}
                <div className="space-y-2 text-lg">
                  <div className="flex justify-between"><span className="text-gray-500">Veículo:</span><span className="font-semibold">{foundRecord.prefixo}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Motorista:</span><span className="font-semibold">{foundRecord.motorista || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Empresa:</span><span className="font-semibold">{foundRecord.empresa || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Fornecedor:</span><span className="font-semibold">{foundRecord.fornecedor || '-'}</span></div>
                  {foundRecord.horaChegadaBalanca !== 'Transferido' && (
                    <>
                      <div className="flex justify-between"><span className="text-gray-500">Material:</span><span className="font-semibold">{foundRecord.material || '-'}</span></div>
                      <div className="flex justify-between bg-green-100 -mx-4 px-4 py-3 rounded-lg">
                        <span className="text-gray-600 font-bold">Tonelada:</span>
                        <span className="text-green-700 font-bold text-xl">{foundRecord.tonelada || '-'} t</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between"><span className="text-gray-500">Saída Britador:</span><span className="font-semibold text-amber-600">{foundRecord.horaSaidaBritador || '-'}</span></div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Balança:</span>
                    <span className={`font-semibold ${foundRecord.horaChegadaBalanca === 'Transferido' ? 'text-amber-600 italic' : 'text-blue-600'}`}>
                      {foundRecord.horaChegadaBalanca === 'Transferido' ? '⚠️ Transferido (sem balança)' : (foundRecord.horaBalanca || '-')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => { setFoundRecord(null); setSearchOS(''); }}>
                    Buscar outra OS
                  </Button>
                  {foundRecord.horaChegadaBalanca === 'Transferido' && !isPendenteObra && (
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => setShowCancelTransferConfirm(true)}
                      disabled={cancellingTransfer}
                    >
                      {cancellingTransfer ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowLeft className="w-4 h-4 mr-1" />}
                      Cancelar Transferência
                    </Button>
                  )}
                </div>

                {/* Cancel transfer confirmation */}
                <AlertDialog open={showCancelTransferConfirm} onOpenChange={setShowCancelTransferConfirm}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar Transferência?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O veículo <strong>{foundRecord.prefixo}</strong> voltará para a fila da Balança com status "Saiu Britador". 
                        Isso desfaz a transferência direta para Obra.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Manter</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelTransfer} disabled={cancellingTransfer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {cancellingTransfer ? 'Cancelando...' : 'Cancelar Transferência'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Card>

              {/* Transferred record: two-step flow */}
              {foundRecord.horaChegadaBalanca === 'Transferido' && !isPendenteObra && (
                <>
                  {/* STEP 1: Material + Peso Carregado */}
                  <div className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">1</div>
                    <div>
                      <p className="font-bold text-amber-900 text-lg">Chegada do Caminhão</p>
                      <p className="text-amber-700 text-sm">Informe o material e o peso carregado. Após descarga, volte para informar o peso vazio.</p>
                    </div>
                  </div>

                  {/* Material */}
                  <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Package className="w-7 h-7 text-blue-600" />
                      Tipo de Material
                    </Label>
                    <Select value={formObraExtra.material} onValueChange={v => setFormObraExtra({ ...formObraExtra, material: v })}>
                      <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                        <SelectValue placeholder="Selecione o material" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-gray-200">
                        {materiais.map(mat => (
                          <SelectItem key={mat.id} value={mat.nome} className="text-lg py-3">{mat.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>

                  {/* Nº da OS / Ordem de Carregamento */}
                  <Card className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <FileText className="w-7 h-7 text-blue-600" />
                      Nº da OS / Ordem de Carregamento
                    </Label>
                    <Input
                      type="text"
                      placeholder="Ex: 12345"
                      value={formObraExtra.numeroPedido}
                      onChange={e => setFormObraExtra({ ...formObraExtra, numeroPedido: e.target.value })}
                      className="bg-white border-2 border-blue-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium"
                    />
                  </Card>
                  <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Scale className="w-7 h-7 text-blue-600" />
                      Peso Carregado (kg)
                    </Label>
                    <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Digite apenas números"
                      value={formObraExtra.pesoFinal}
                      onChange={e => setFormObraExtra({ ...formObraExtra, pesoFinal: e.target.value.replace(/[^0-9]/g, '') })}
                      className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                    />
                    </div>
                    {formObraExtra.pesoFinal && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Será salvo como: <strong>{formatPesoForSheet(formObraExtra.pesoFinal)} kg</strong>
                      </p>
                    )}
                  </Card>
                </>
              )}

              {/* STEP 2: Peso Vazio (after unloading) */}
              {foundRecord.horaChegadaBalanca === 'Transferido' && isPendenteObra && (
                <>
                  <div className="bg-green-100 border-2 border-green-400 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">2</div>
                    <div>
                      <p className="font-bold text-green-900 text-lg">Retorno — Peso Vazio</p>
                      <p className="text-green-700 text-sm">Caminhão descarregou e retornou. Informe o peso vazio para finalizar o ciclo.</p>
                    </div>
                  </div>

                  {/* Show existing data (read-only) */}
                  <Card className="bg-gray-50 border-2 border-gray-200 p-5 rounded-2xl shadow-sm">
                    <div className="space-y-2 text-lg">
                      <div className="flex justify-between"><span className="text-gray-500">Material:</span><span className="font-semibold">{foundRecord.material || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Peso Carregado:</span><span className="font-semibold">{foundRecord.pesoFinal || '-'} kg</span></div>
                    </div>
                  </Card>

                  {/* Peso Vazio */}
                  <Card className="bg-blue-50 border-2 border-blue-300 p-6 rounded-2xl shadow-sm">
                    <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                      <Scale className="w-7 h-7 text-blue-600" />
                      Peso Vazio (kg)
                    </Label>
                    <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder={lastPesoVazio ? `Último: ${lastPesoVazio}` : 'Digite apenas números'}
                      value={formObraExtra.pesoVazio}
                      onChange={e => setFormObraExtra({ ...formObraExtra, pesoVazio: e.target.value.replace(/[^0-9]/g, '') })}
                      className="bg-white border-2 border-blue-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                    />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {formObraExtra.pesoVazio
                        ? <>Será salvo como: <strong>{formatPesoForSheet(formObraExtra.pesoVazio)} kg</strong></>
                        : 'Digite apenas números. Ex: 25960 = 25.960,00'
                      }
                    </p>

                    {/* OCR Photo for peso vazio */}
                    <div className="mt-4">
                      <Label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center gap-2">
                        <Camera className="w-4 h-4" /> Foto Contraprova (Peso Vazio)
                      </Label>
                      <input
                        ref={obraVazioFotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setObraVazioFotoFile(file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 border-2 border-blue-300 text-blue-700 rounded-xl"
                        onClick={() => obraVazioFotoInputRef.current?.click()}
                      >
                        <Camera className="w-5 h-5 mr-2" /> {obraVazioFotoFile ? '📸 Foto capturada' : 'Tirar foto do peso vazio'}
                      </Button>
                      {obraVazioFotoPreview && (
                        <div className="mt-3 relative">
                          <img src={obraVazioFotoPreview} alt="Foto peso vazio" className="w-full max-h-48 object-contain rounded-xl border-2 border-blue-300" />
                          <Button type="button" size="sm" variant="destructive" className="absolute top-2 right-2 rounded-lg text-xs" onClick={() => setObraVazioFotoFile(null)}>
                            Excluir
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Calculated Values */}
                  {formObraExtra.pesoVazio && foundRecord.pesoFinal && (
                    <Card className="bg-green-50 border-2 border-green-200 p-6 rounded-2xl shadow-sm">
                      <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                        <Scale className="w-7 h-7 text-green-600" />
                        Valores Calculados
                      </Label>
                      {(() => {
                        // pesoFinal from sheet is already formatted (e.g. "45.320,00"), use parseBRNumber
                        const derived = calculateDerivedValues(foundRecord.pesoFinal, formObraExtra.pesoVazio);
                        return (
                          <div className="grid grid-cols-2 gap-4 text-lg">
                            <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                              <span className="text-gray-500">Peso Líq:</span>
                              <span className="text-green-600 font-bold">{derived.pesoLiquido} kg</span>
                            </div>
                            <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                              <span className="text-gray-500">Tonelada:</span>
                              <span className="text-green-600 font-bold">{derived.tonelada} t</span>
                            </div>
                          </div>
                        );
                      })()}
                    </Card>
                  )}
                </>
              )}

              {/* Hide hora/peso chegada fields for step 2 (already set in step 1) */}
              {!isPendenteObra && (
              <Card className="bg-white border-2 border-gray-200 p-5 rounded-2xl shadow-sm">
                <Label className="text-lg font-bold text-[#1d3557] flex items-center gap-2 mb-3">
                  <Clock className="w-6 h-6 text-[#1d3557]" />
                  Hora de Chegada na Obra
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={formObra.horaChegada}
                    onChange={e => setFormObra({ ...formObra, horaChegada: e.target.value })}
                    className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormObra({ ...formObra, horaChegada: format(new Date(), 'HH:mm') })}
                    className="h-16 px-4 text-sm font-semibold border-2 border-[#1d3557]/20 text-[#1d3557] rounded-xl whitespace-nowrap"
                  >
                    Agora
                  </Button>
                </div>
              </Card>
              )}

              {!isPendenteObra && (
              <Card className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-sm">
                <Label className="text-lg font-bold text-[#1d3557] flex items-center gap-2 mb-3">
                  <Weight className="w-6 h-6 text-amber-600" />
                  Peso de Chegada (kg)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Digite apenas números"
                    value={formObra.pesoChegada}
                    onChange={e => setFormObra({ ...formObra, pesoChegada: e.target.value.replace(/[^0-9]/g, '') })}
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
                    setFormObra(prev => ({ ...prev, ocrFotoFile: file }));
                    try {
                      const reader = new FileReader();
                      const base64 = await new Promise<string>((resolve) => {
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                      });
                      const response = await supabase.functions.invoke('ocr-peso', {
                        body: { imageBase64: base64 },
                      });
                      if (response.error) throw response.error;
                      const { value } = response.data;
                      if (value && value !== 'ERRO') {
                        const rawValue = String(parseInt(value, 10));
                        setFormObra(prev => ({ ...prev, pesoChegada: rawValue }));
                        toast({ title: '✅ Peso lido com sucesso!', description: `Valor: ${formatBankInput(rawValue)}` });
                      } else {
                        toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR não conseguiu ler, mas a foto foi capturada', variant: 'default' });
                      }
                    } catch (error: any) {
                      toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR indisponível, mas a foto foi capturada', variant: 'default' });
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
                        setFormObra(prev => ({ ...prev, ocrFotoFile: null }));
                      }}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                )}
                {formObra.pesoChegada ? (
                  <p className="text-sm text-amber-700 mt-2 font-medium">
                    Será salvo como: <strong>{formatPesoForSheet(formObra.pesoChegada)} kg</strong>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    📸 Toque na câmera para ler da balança ou digite apenas números. Ex: 4532000 = 45.320,00
                  </p>
                )}
              </Card>
              )}

              {!isPendenteObra && (
              <Card className="bg-blue-50 border-2 border-blue-300 p-5 rounded-2xl shadow-sm">
                <Label className="text-lg font-bold text-[#1d3557] flex items-center gap-2 mb-3">
                  <Scale className="w-6 h-6 text-blue-600" />
                  Peso Vazio na Obra (opcional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={foundRecord?.pesoVazio ? `Usar do ticket: ${foundRecord.pesoVazio}` : 'Digite apenas números'}
                    value={formObra.pesoVazio}
                    onChange={e => setFormObra({ ...formObra, pesoVazio: e.target.value.replace(/[^0-9]/g, '') })}
                    className="bg-white border-2 border-blue-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                  />
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  Se deixado em branco, o sistema usará o <strong>peso vazio do ticket</strong> para o cálculo.
                </p>
              </Card>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || sheetLoading}
                className="w-full h-20 text-2xl font-bold bg-[#1d3557] hover:bg-[#162d4a] shadow-xl mt-4 rounded-2xl"
              >
                {loading || sheetLoading ? (
                  <><Loader2 className="w-8 h-8 mr-3 animate-spin" /> {isPendenteObra ? 'Finalizando...' : 'Salvando...'}</>
                ) : isPendenteObra ? (
                  <><CheckCircle2 className="w-8 h-8 mr-3" /> Finalizar Ciclo (Peso Vazio)</>
                ) : foundRecord?.horaChegadaBalanca === 'Transferido' ? (
                  <><CheckCircle2 className="w-8 h-8 mr-3" /> Registrar Chegada</>
                ) : (
                  <><CheckCircle2 className="w-8 h-8 mr-3" /> Confirmar Entrega</>
                )}
              </Button>
            </form>
          )}
          </>)}

          {/* ===== SUB-TAB: CARREGAMENTO DIRETO ===== */}
          {obraTab === 'carregamento' && (
            <div className="space-y-5">
              {/* Info banner */}
              <div className="bg-green-100 border-2 border-green-400 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-green-900 text-lg">Carregamento Direto na Obra</p>
                  <p className="text-green-700 text-sm">Fornecedor entregando material diretamente.</p>
                </div>
              </div>

              {/* Toggle: Nova Chegada vs Pendentes */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={carregStep === 'form' ? 'default' : 'outline'}
                  className={`flex-1 h-14 text-lg font-bold rounded-xl ${carregStep === 'form' ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-2 border-green-300 text-green-700'}`}
                  onClick={() => { setCarregStep('form'); setSelectedCarregPendente(null); }}
                >
                  <TruckIcon className="w-5 h-5 mr-2" /> Nova Chegada
                </Button>
                <Button
                  type="button"
                  variant={carregStep === 'pendentes' ? 'default' : 'outline'}
                  className={`flex-1 h-14 text-lg font-bold rounded-xl relative ${carregStep === 'pendentes' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'border-2 border-amber-300 text-amber-700'}`}
                  onClick={() => { setCarregStep('pendentes'); loadCarregPendentes(); }}
                >
                  <Clock className="w-5 h-5 mr-2" /> Pendentes
                  {carregPendentes.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {carregPendentes.length}
                    </span>
                  )}
                </Button>
              </div>

              {/* ===== STEP 1: NOVA CHEGADA ===== */}
              {carregStep === 'form' && (
                <form onSubmit={handleSubmitCarregamento} className="space-y-3">
                  {/* Placa do Veículo */}
                  <Card className="bg-green-50 border border-green-300 p-3 rounded-xl shadow-sm">
                    <Label className="text-gray-800 text-sm font-bold mb-2 block flex items-center gap-2">
                      <TruckIcon className="w-4 h-4 text-green-600" />
                      Placa do Veículo
                    </Label>
                    <Input
                      type="text"
                      placeholder="Toque para ver a lista ou digite..."
                      value={formCarregamento.placa}
                      onFocus={() => setPlateFilter(formCarregamento.placa || ' ')}
                      onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setFormCarregamento({ ...formCarregamento, placa: val });
                        setPlateFilter(val || ' ');
                      }}
                      className="bg-white border border-green-400 text-gray-900 placeholder:text-gray-400 h-12 text-base rounded-lg font-medium uppercase"
                    />

                    {/* Dropdown list of vehicles */}
                    {plateFilter && (() => {
                      const filter = plateFilter.trim().toLowerCase();
                      const allVehicles = [
                        ...areiaExpressVeiculos.map(v => ({ ...v, source: 'areia' as const })),
                        ...savedPlates
                          .filter(p => !areiaExpressVeiculos.some(v => v.placa === p))
                          .map(p => ({ placa: p, motorista: getMotoristaByPlate(p), pesoVazio: '', descricao: '', source: 'recente' as const })),
                      ];
                      const filtered = filter
                        ? allVehicles.filter(v =>
                            v.placa.toLowerCase().includes(filter) ||
                            v.motorista.toLowerCase().includes(filter)
                          )
                        : allVehicles;
                      if (filtered.length === 0) return null;
                      return (
                        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-green-300 bg-white shadow-lg">
                          {filtered.map((v, idx) => (
                            <button
                              key={`${v.placa}-${idx}`}
                              type="button"
                              className="w-full flex items-center justify-between px-3 py-2 text-left border-b border-gray-100 last:border-b-0 active:bg-green-100 hover:bg-green-50 transition-colors"
                              onClick={() => {
                                setFormCarregamento({
                                  ...formCarregamento,
                                  placa: v.placa,
                                  motorista: v.motorista,
                                  pesoVazio: v.pesoVazio || '',
                                });
                                if (v.pesoVazio) setCustomCarregamentoPesoVazio(v.pesoVazio);
                                setPlateFilter('');
                                savePlate(v.placa, v.motorista);
                                scrollToRef(carregFornecedorRef);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-gray-900">{v.placa}</span>
                                <span className="text-xs text-gray-500">{v.motorista || 'Sem motorista'}{v.pesoVazio ? ` • Tara: ${v.pesoVazio}` : ''}</span>
                              </div>
                              {v.source === 'areia' && (
                                <span className="text-[9px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">Areia Express</span>
                              )}
                              {v.source === 'recente' && (
                                <span className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Recente</span>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Vehicle info inline: Motorista + Tara */}
                    {formCarregamento.placa && !plateFilter && (customCarregamentoPesoVazio || formCarregamento.pesoVazio || formCarregamento.motorista) && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-600 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        {formCarregamento.motorista && (
                          <span>👤 <strong>{formCarregamento.motorista}</strong></span>
                        )}
                        {(customCarregamentoPesoVazio || formCarregamento.pesoVazio) && (
                          <span className="ml-auto text-green-700 font-bold">
                            Tara: {(() => {
                              const pv = customCarregamentoPesoVazio || formCarregamento.pesoVazio;
                              const num = parseBRNumber(pv);
                              return !isNaN(num) ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : pv;
                            })()} kg
                          </span>
                        )}
                      </div>
                    )}
                    {formCarregamento.placa && !plateFilter && !(customCarregamentoPesoVazio || formCarregamento.pesoVazio) && (
                      <p className="mt-1 text-[11px] text-red-500 font-medium">⚠️ Sem peso vazio cadastrado</p>
                    )}
                  </Card>

                  {/* Fornecedor */}
                  <div ref={carregFornecedorRef}>
                  <Card className="bg-gray-50 border border-gray-200 p-3 rounded-xl shadow-sm">
                    <Label className="text-gray-800 text-sm font-bold mb-2 block flex items-center gap-2">
                      <Building className="w-4 h-4 text-green-600" />
                      Fornecedor
                    </Label>
                    <Select value={formCarregamento.fornecedor} onValueChange={v => {
                      setFormCarregamento({ ...formCarregamento, fornecedor: v });
                      scrollToRef(carregOsRef);
                    }}>
                      <SelectTrigger className="bg-white border border-gray-300 text-gray-900 h-12 text-base rounded-lg font-medium">
                        <SelectValue placeholder="Selecione o fornecedor" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="Areia Express" className="text-base py-2">Areia Express</SelectItem>
                        {fornecedoresPedreira.map(f => (
                          <SelectItem key={f.id} value={f.nome} className="text-base py-2">{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>
                  </div>

                  {/* Nº da OS */}
                  <div ref={carregOsRef}>
                  <Card className="bg-green-50 border border-green-300 p-3 rounded-xl shadow-sm">
                    <Label className="text-gray-800 text-sm font-bold mb-2 block flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      Nº da OS / Ordem de Carregamento
                    </Label>
                    <Input
                      type="text"
                      placeholder="Ex: 12345"
                      value={formCarregamento.numeroPedido}
                      onChange={e => {
                        setFormCarregamento({ ...formCarregamento, numeroPedido: e.target.value });
                      }}
                      onBlur={() => { if (formCarregamento.numeroPedido) scrollToRef(carregQtdRef); }}
                      className="bg-white border border-green-400 text-gray-900 placeholder:text-gray-400 h-12 text-base rounded-lg font-medium"
                    />
                  </Card>
                  </div>

                  {/* Quantidade (t) */}
                  <div ref={carregQtdRef}>
                  <Card className="bg-gray-50 border border-gray-200 p-3 rounded-xl shadow-sm">
                    <Label className="text-gray-800 text-sm font-bold mb-2 block flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-green-600" />
                      Quantidade (t)
                    </Label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={formCarregamento.quantidade}
                      onChange={e => {
                        setFormCarregamento({ ...formCarregamento, quantidade: formatToneladaInput(e.target.value) });
                      }}
                      onBlur={() => { if (formCarregamento.quantidade) scrollToRef(carregMaterialRef); }}
                      className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 h-12 text-base rounded-lg font-medium"
                    />
                    <p className="text-xs text-right text-gray-400 mt-1">
                      {formCarregamento.quantidade ? `Será salvo como: ${formCarregamento.quantidade} ton` : 'Ex: digite 2550 = 25,50 ton'}
                    </p>
                  </Card>
                  </div>

                  {/* Material */}
                  <div ref={carregMaterialRef}>
                  <Card className="bg-gray-50 border border-gray-200 p-3 rounded-xl shadow-sm">
                    <Label className="text-gray-800 text-sm font-bold mb-2 block flex items-center gap-2">
                      <Package className="w-4 h-4 text-green-600" />
                      Tipo de Material
                    </Label>
                    <Select value={formCarregamento.material} onValueChange={v => {
                      setFormCarregamento({ ...formCarregamento, material: v });
                      scrollToRef(carregPesoRef);
                    }}>
                      <SelectTrigger className="bg-white border border-gray-300 text-gray-900 h-12 text-base rounded-lg font-medium">
                        <SelectValue placeholder="Selecione o material" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        {materiais.map(mat => (
                          <SelectItem key={mat.id} value={mat.nome} className="text-base py-2">{mat.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>
                  </div>

                  {/* Peso Carregado (Chegada) */}
                  <div ref={carregPesoRef}>
                  <Card className="bg-green-50 border border-green-300 p-3 rounded-xl shadow-sm">
                    <Label className="text-gray-800 text-sm font-bold mb-2 block flex items-center gap-2">
                      <Scale className="w-4 h-4 text-green-600" />
                      Peso Carregado / Chegada (kg)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Digite apenas números"
                        value={formCarregamento.pesoFinal}
                        onChange={e => {
                          const digits = e.target.value.replace(/[^0-9]/g, '');
                          setFormCarregamento({ ...formCarregamento, pesoFinal: digits });
                        }}
                        onBlur={() => { if (formCarregamento.pesoFinal) scrollToRef(carregSubmitRef); }}
                        className="bg-white border border-green-400 text-gray-900 placeholder:text-gray-400 h-12 text-base rounded-lg font-medium flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (carregChegadaOcrInputRef.current) {
                            carregChegadaOcrInputRef.current.setAttribute('capture', 'environment');
                            carregChegadaOcrInputRef.current.click();
                          }
                        }}
                        disabled={carregChegadaOcrLoading}
                        className="h-16 px-4 border-2 border-green-400 text-green-700 rounded-xl"
                      >
                        {carregChegadaOcrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (carregChegadaOcrInputRef.current) {
                            carregChegadaOcrInputRef.current.removeAttribute('capture');
                            carregChegadaOcrInputRef.current.click();
                          }
                        }}
                        disabled={carregChegadaOcrLoading}
                        className="h-16 px-4 border-2 border-green-400 text-green-700 rounded-xl"
                      >
                        {carregChegadaOcrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                      </Button>
                    </div>
                    <input
                      ref={carregChegadaOcrInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setCarregChegadaOcrLoading(true);
                        // Always save the photo file regardless of OCR result
                        setCarregChegadaFotoFile(file);
                        const reader = new FileReader();
                        const base64 = await new Promise<string>((resolve) => {
                          reader.onload = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });
                        setCarregChegadaFotoPreview(base64);
                        try {
                          const response = await supabase.functions.invoke('ocr-peso', {
                            body: { imageBase64: base64 },
                          });
                          if (response.error) throw response.error;
                          const { value } = response.data;
                          if (value && value !== 'ERRO') {
                            const rawValue = String(parseInt(value, 10));
                            setFormCarregamento(f => ({ ...f, pesoFinal: rawValue }));
                            toast({ title: '✅ Peso lido com sucesso!', description: `Valor: ${formatBankInput(rawValue)}` });
                          } else {
                            toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR não conseguiu ler, mas a foto foi capturada', variant: 'default' });
                          }
                        } catch (error: any) {
                          toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR indisponível, mas a foto foi capturada', variant: 'default' });
                        } finally {
                          setCarregChegadaOcrLoading(false);
                          if (carregChegadaOcrInputRef.current) carregChegadaOcrInputRef.current.value = '';
                        }
                      }}
                    />
                    {carregChegadaFotoPreview && (
                      <div className="mt-3 relative">
                        <img src={carregChegadaFotoPreview} alt="Foto OCR Chegada" className="w-full max-h-48 object-contain rounded-xl border-2 border-green-300" />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button type="button" size="sm" variant="secondary" className="bg-white/90 text-green-700 border border-green-300 rounded-lg text-xs" onClick={() => {
                            if (carregChegadaOcrInputRef.current) {
                              carregChegadaOcrInputRef.current.setAttribute('capture', 'environment');
                              carregChegadaOcrInputRef.current.click();
                            }
                          }}>
                            Trocar
                          </Button>
                          <Button type="button" size="sm" variant="destructive" className="rounded-lg text-xs" onClick={() => {
                            setCarregChegadaFotoFile(null);
                          }}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                    )}
                    {formCarregamento.pesoFinal ? (
                      <p className="text-xs text-green-700 mt-1 font-medium">
                        Salvo como: <strong>{formatPesoForSheet(formCarregamento.pesoFinal)} kg</strong>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        📸 Câmera para ler ou digite números.
                      </p>
                    )}
                  </Card>
                  </div>

                  {/* Auto-calculated values */}
                  {formCarregamento.pesoFinal && (customCarregamentoPesoVazio || formCarregamento.pesoVazio) && (() => {
                    const pesoVazioRaw = customCarregamentoPesoVazio || formCarregamento.pesoVazio;
                    const derived = calculateDerivedValues(formCarregamento.pesoFinal, pesoVazioRaw);
                    const showDiesel = isDieselMaterial(formCarregamento.material, formCarregamento.fornecedor);
                    const litros = showDiesel && derived.pesoLiquidoNum > 0 ? calculateLitros(derived.pesoLiquidoNum) : 0;
                    return (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1 flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200 text-sm">
                            <span className="text-gray-500">P. Líquido:</span>
                            <span className="text-green-700 font-bold">{derived.pesoLiquido} kg</span>
                          </div>
                          <div className="flex-1 flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200 text-sm">
                            <span className="text-gray-500">Ton. Obra:</span>
                            <span className="text-green-700 font-bold">{derived.tonelada} t</span>
                          </div>
                        </div>
                        {showDiesel && litros > 0 && (
                          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border-2 border-amber-300 text-sm">
                            <span className="text-amber-800 font-bold flex items-center gap-1">⛽ Total em Litros:</span>
                            <span className="text-amber-900 font-extrabold text-lg">{formatDecimalBR(litros)} L</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Submit */}
                  <div ref={carregSubmitRef}>
                  <Button
                    type="submit"
                    disabled={loading || sheetLoading || !(customCarregamentoPesoVazio || formCarregamento.pesoVazio)}
                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-xl rounded-xl text-white"
                  >
                    {loading || sheetLoading ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Salvando...</>
                    ) : (
                      <><CheckCircle2 className="w-5 h-5 mr-2" /> Finalizar Lançamento</>
                    )}
                  </Button>
                  </div>
                </form>
              )}

              {/* ===== STEP 2: PENDENTES (SAÍDA) ===== */}
              {carregStep === 'pendentes' && (
                <div className="space-y-4">
                  {!selectedCarregPendente ? (
                    <>
                      {sheetLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mr-3" />
                          <span className="text-lg text-muted-foreground">Carregando pendentes...</span>
                        </div>
                      ) : carregPendentes.length === 0 ? (
                        <div className="text-center py-12">
                          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                          <p className="text-xl font-bold text-gray-700">Nenhum pendente</p>
                          <p className="text-muted-foreground mt-2">Todos os carregamentos foram finalizados.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">Selecione o veículo para informar o peso de saída:</p>
                          {carregPendentes.map((rec, idx) => (
                            <Card
                              key={idx}
                              className="bg-amber-50 border-2 border-amber-300 p-5 rounded-2xl shadow-sm cursor-pointer hover:border-amber-500 transition-colors"
                              onClick={() => {
                                setSelectedCarregPendente(rec);
                                setCarregPesoSaida('');
                                setCarregHoraSaida(format(new Date(), 'HH:mm'));
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xl font-bold text-gray-900">{rec.placa}</p>
                                  <p className="text-sm text-gray-600">{rec.fornecedor} — {rec.material}</p>
                                  <p className="text-xs text-muted-foreground mt-1">Chegou às {rec.horaChegada} • {rec.data}</p>
                                </div>
                                <div className="text-right">
                                  <Badge className="bg-amber-500 text-white text-sm font-bold px-3 py-1">
                                    ⏳ Pendente
                                  </Badge>
                                  <p className="text-sm text-gray-600 mt-1 font-semibold">{rec.pesoCarregado} kg</p>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </>
                      )}
                    </>
                  ) : (
                    /* Formulário de finalização (Step 2) */
                    <div className="space-y-5">
                      {/* Selected record info */}
                      <Card className="bg-amber-50 border-2 border-amber-400 p-5 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xl font-bold text-gray-900">Finalizando: {selectedCarregPendente.placa}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCarregPendente(null)}
                            className="text-gray-500"
                          >
                            ✕ Voltar
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-500">Fornecedor:</span> <strong>{selectedCarregPendente.fornecedor}</strong></div>
                          <div><span className="text-gray-500">Material:</span> <strong>{selectedCarregPendente.material}</strong></div>
                          <div><span className="text-gray-500">Peso Carregado:</span> <strong>{selectedCarregPendente.pesoCarregado} kg</strong></div>
                          <div><span className="text-gray-500">Chegada:</span> <strong>{selectedCarregPendente.horaChegada}</strong></div>
                        </div>
                      </Card>

                      {/* Hora Saída */}
                      <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
                        <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                          <Clock className="w-7 h-7 text-amber-600" />
                          Hora de Saída
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="time"
                            value={carregHoraSaida}
                            onChange={e => setCarregHoraSaida(e.target.value)}
                            className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCarregHoraSaida(format(new Date(), 'HH:mm'))}
                            className="h-16 px-4 text-sm font-semibold border-2 border-amber-200 text-amber-700 rounded-xl whitespace-nowrap"
                          >
                            Agora
                          </Button>
                        </div>
                      </Card>

                      {/* Peso Vazio (Saída) */}
                      <Card className="bg-amber-50 border-2 border-amber-300 p-6 rounded-2xl shadow-sm">
                        <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                          <Scale className="w-7 h-7 text-amber-600" />
                          Peso Vazio / Saída (kg)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder={lastPesoVazio ? `Último: ${lastPesoVazio}` : 'Digite apenas números'}
                            value={carregPesoSaida}
                            onChange={e => setCarregPesoSaida(e.target.value.replace(/[^0-9]/g, ''))}
                            className="bg-white border-2 border-amber-400 text-gray-900 placeholder:text-gray-400 h-16 text-xl rounded-xl font-medium flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (carregSaidaOcrInputRef.current) {
                                carregSaidaOcrInputRef.current.setAttribute('capture', 'environment');
                                carregSaidaOcrInputRef.current.click();
                              }
                            }}
                            disabled={carregSaidaOcrLoading}
                            className="h-16 px-4 border-2 border-amber-400 text-amber-700 rounded-xl"
                          >
                            {carregSaidaOcrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (carregSaidaOcrInputRef.current) {
                                carregSaidaOcrInputRef.current.removeAttribute('capture');
                                carregSaidaOcrInputRef.current.click();
                              }
                            }}
                            disabled={carregSaidaOcrLoading}
                            className="h-16 px-4 border-2 border-amber-400 text-amber-700 rounded-xl"
                          >
                            {carregSaidaOcrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                          </Button>
                        </div>
                        <input
                          ref={carregSaidaOcrInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCarregSaidaOcrLoading(true);
                            // Always save the photo file regardless of OCR result
                            setCarregSaidaFotoFile(file);
                            const reader = new FileReader();
                            const base64 = await new Promise<string>((resolve) => {
                              reader.onload = () => resolve(reader.result as string);
                              reader.readAsDataURL(file);
                            });
                            setCarregSaidaFotoPreview(base64);
                            try {
                              const response = await supabase.functions.invoke('ocr-peso', {
                                body: { imageBase64: base64 },
                              });
                              if (response.error) throw response.error;
                              const { value } = response.data;
                              if (value && value !== 'ERRO') {
                                const rawValue = String(parseInt(value, 10));
                                setCarregPesoSaida(rawValue);
                                toast({ title: '✅ Peso lido com sucesso!', description: `Valor: ${formatBankInput(rawValue)}` });
                              } else {
                                toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR não conseguiu ler, mas a foto foi capturada', variant: 'default' });
                              }
                            } catch (error: any) {
                              toast({ title: 'Foto salva! Digite o peso manualmente', description: 'OCR indisponível, mas a foto foi capturada', variant: 'default' });
                            } finally {
                              setCarregSaidaOcrLoading(false);
                              if (carregSaidaOcrInputRef.current) carregSaidaOcrInputRef.current.value = '';
                            }
                          }}
                        />
                        {carregSaidaFotoPreview && (
                          <div className="mt-3 relative">
                            <img src={carregSaidaFotoPreview} alt="Foto OCR Saída" className="w-full max-h-48 object-contain rounded-xl border-2 border-amber-300" />
                            <div className="absolute top-2 right-2 flex gap-2">
                              <Button type="button" size="sm" variant="secondary" className="bg-white/90 text-amber-700 border border-amber-300 rounded-lg text-xs" onClick={() => {
                                if (carregSaidaOcrInputRef.current) {
                                  carregSaidaOcrInputRef.current.setAttribute('capture', 'environment');
                                  carregSaidaOcrInputRef.current.click();
                                }
                              }}>
                                Trocar
                              </Button>
                              <Button type="button" size="sm" variant="destructive" className="rounded-lg text-xs" onClick={() => {
                                setCarregSaidaFotoFile(null);
                              }}>
                                Excluir
                              </Button>
                            </div>
                          </div>
                        )}
                        {carregPesoSaida ? (
                          <p className="text-sm text-amber-700 mt-2 font-medium">
                            Será salvo como: <strong>{formatPesoForSheet(carregPesoSaida)} kg</strong>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-2">
                            📸 Toque na câmera para ler da balança ou digite apenas números.
                          </p>
                        )}
                      </Card>

                      {/* Calculated Values Preview */}
                      {carregPesoSaida && (() => {
                        const pesoFinalRaw = selectedCarregPendente.pesoCarregado.replace(/[.,]/g, '');
                        const derived = calculateDerivedValues(pesoFinalRaw || '0', carregPesoSaida);
                        return (
                          <Card className="bg-green-50 border-2 border-green-200 p-6 rounded-2xl shadow-sm">
                            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
                              <Scale className="w-7 h-7 text-green-600" />
                              Valores Calculados
                            </Label>
                            <div className="grid grid-cols-2 gap-4 text-lg">
                              <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                                <span className="text-gray-500">Peso Líq:</span>
                                <span className="text-green-600 font-bold">{derived.pesoLiquido} kg</span>
                              </div>
                              <div className="flex justify-between p-4 bg-white rounded-xl border-2 border-gray-200">
                                <span className="text-gray-500">Tonelada:</span>
                                <span className="text-green-600 font-bold">{derived.tonelada} t</span>
                              </div>
                            </div>
                          </Card>
                        );
                      })()}

                      {/* Finalizar */}
                      <Button
                        type="button"
                        disabled={loading || sheetLoading || !carregPesoSaida}
                        onClick={handleFinalizarCarregamento}
                        className="w-full h-20 text-2xl font-bold bg-amber-500 hover:bg-amber-600 shadow-xl mt-4 rounded-2xl text-white"
                      >
                        {loading || sheetLoading ? (
                          <><Loader2 className="w-8 h-8 mr-3 animate-spin" /> Finalizando...</>
                        ) : (
                          <><CheckCircle2 className="w-8 h-8 mr-3" /> Finalizar (Peso de Saída)</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                      <p className="font-semibold text-base">{rec.caminhao} — {rec.material || 'Sem material'}</p>
                      <p className="text-sm text-muted-foreground">{rec.hora || 'Sem hora'} • {rec.motorista}</p>
                      <p className="text-sm text-muted-foreground">Peso Final: {rec.pesoFinal || '-'} • Líquido: {rec.pesoLiquido || '-'}</p>
                      <p className="text-sm font-medium text-amber-700">{rec.tonelada ? `${rec.tonelada} ton` : 'Aguardando pesagem'}</p>
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

      {/* =================== MODAL: Finalizar Ciclo Pendente =================== */}
      <FinalizarCicloPendenteModal
        open={showFinalizarPendenteModal}
        onOpenChange={(open) => {
          setShowFinalizarPendenteModal(open);
          if (!open) setSelectedPendingCycle(null);
        }}
        cycle={selectedPendingCycle}
        onSuccess={() => {
          loadPendingCycles();
          if (etapa === 'balanca') loadTransitRecords('Saiu_Britador');
          if (etapa === 'obra') loadTransitRecords('Pesado');
        }}
      />
    </div>
  );
}
