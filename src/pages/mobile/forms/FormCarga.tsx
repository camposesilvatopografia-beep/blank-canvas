import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { supabase } from '@/integrations/supabase/client';
import { useEquipmentPermissions } from '@/hooks/useEquipmentPermissions';
import { useLocalPermissions } from '@/hooks/useLocalPermissions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Upload, Loader2, CheckCircle2, MapPin, Truck as TruckIcon, Package, WifiOff, Cloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { useFormFieldPermissions } from '@/components/mobile/FieldPermissionWrapper';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';

interface LocalOption {
  id: string;
  nome: string;
  tipo: string;
}

interface MaterialOption {
  id: string;
  nome: string;
}

interface EquipamentoData {
  prefixo: string;
  descricao: string;
  operador: string;
  marca: string;
  potencia: string;
  empresa: string;
  encarregado: string;
}

interface CaminhaoData {
  prefixo: string;
  descricao: string;
  motorista: string;
  marca: string;
  potencia: string;
  volume: string;
  empresa: string;
  encarregado: string;
}

export default function FormCarga() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, readSheet, loading: sheetLoading } = useGoogleSheets();
  const { isOnline, pendingCount, isSyncing, addPendingRecord, syncAllPending } = useOfflineSync();
  const { 
    getCachedLocaisOrigem, 
    getCachedLocaisDestino, 
    getCachedMateriais, 
    getCachedEquipamentos, 
    getCachedCaminhoes,
    isLoading: cacheLoading,
    refreshCache,
    cache
  } = useOfflineCache();
  const { toast } = useToast();
  const { isFieldVisible, isFieldDisabled, loading: permissionsLoading, hasFullAccess } = useFormFieldPermissions('carga');
  const { filterEscavadeiras, filterCaminhoes, loading: equipPermLoading } = useEquipmentPermissions();
  const { hasLocalPermission, loading: localPermLoading } = useLocalPermissions();

  // Force cache refresh if cache is empty (new user/device)
  useEffect(() => {
    if (!cache && navigator.onLine && !cacheLoading) {
      refreshCache();
    }
  }, [cache, cacheLoading, refreshCache]);

  const [loading, setLoading] = useState(false);
  const [addLancamento, setAddLancamento] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [cargaHeaders, setCargaHeaders] = useState<string[]>([]);
  const [descargaHeaders, setDescargaHeaders] = useState<string[]>([]);

  // Selected equipment data for auto-fill
  const [selectedEscavadeira, setSelectedEscavadeira] = useState<EquipamentoData | null>(null);
  const [selectedCaminhao, setSelectedCaminhao] = useState<CaminhaoData | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    local: '',
    estaca: '',
    escavadeira: '',
    caminhao: '',
    material: '',
    viagens: '1',
    localLancamento: '',
  });

  // Use cached data directly - instant loading! + filter by local permissions
  const locaisOrigem = useMemo(() => {
    const cached = getCachedLocaisOrigem();
    return (cached.map(l => ({ ...l, tipo: 'Origem' })) as LocalOption[])
      .filter(l => hasLocalPermission(l.id));
  }, [getCachedLocaisOrigem, hasLocalPermission]);

  const locaisDestino = useMemo(() => {
    const cached = getCachedLocaisDestino();
    return (cached.map(l => ({ ...l, tipo: 'Destino' })) as LocalOption[])
      .filter(l => hasLocalPermission(l.id));
  }, [getCachedLocaisDestino, hasLocalPermission]);

  const materiais = useMemo(() => {
    return getCachedMateriais() as MaterialOption[];
  }, [getCachedMateriais]);

  const escavadeiras = useMemo(() => {
    const cached = getCachedEquipamentos();
    const all = cached
      .filter((e: any) => e.Prefixo_Eq)
      // Filter out desmobilizado equipment
      .filter((e: any) => {
        const status = (e.Status || '').toLowerCase().trim();
        return status !== 'desmobilizado';
      })
      .map((row: any) => ({
        prefixo: row.Prefixo_Eq || '',
        descricao: row.Descricao_Eq || '',
        operador: row.Operador || '',
        marca: row.Marca || '',
        potencia: row.Potencia || '',
        empresa: row.Empresa_Eq || '',
        encarregado: row.Encarregado_Eq || '',
      })) as EquipamentoData[];
    // Apply permission filter
    return filterEscavadeiras(all);
  }, [getCachedEquipamentos, filterEscavadeiras]);

  const caminhoes = useMemo(() => {
    const cached = getCachedCaminhoes();
    const all = cached
      .filter((c: any) => c.Prefixo_Cb)
      // Filter out desmobilizado trucks
      .filter((c: any) => {
        const status = (c.Status || '').toLowerCase().trim();
        return status !== 'desmobilizado';
      })
      .map((row: any) => ({
        prefixo: row.Prefixo_Cb || '',
        descricao: row.Descricao_Cb || '',
        motorista: row.Motorista || '',
        marca: row.Marca || '',
        potencia: row.Potencia || '',
        volume: row.Volume || '',
        empresa: row.Empresa_Cb || '',
        encarregado: row.Encarregado_Cb || '',
      })) as CaminhaoData[];
    // Apply permission filter
    return filterCaminhoes(all);
  }, [getCachedCaminhoes, filterCaminhoes]);

  // Load last used location from localStorage (cached) - wait for permissions to finish loading
  useEffect(() => {
    if (localPermLoading) return; // Wait until permissions are loaded
    const lastLocal = localStorage.getItem('apropriapp_last_local_carga');
    if (lastLocal && locaisOrigem.some(l => l.nome === lastLocal)) {
      setFormData(prev => ({ ...prev, local: lastLocal }));
    }
  }, [locaisOrigem, localPermLoading]);

  // Load sheet headers for dynamic column mapping
  useEffect(() => {
    const loadHeaders = async () => {
      try {
        const [cargaData, descargaData] = await Promise.all([
          appendSheet ? readSheet('Carga', '1:1') : Promise.resolve([]),
          appendSheet ? readSheet('Descarga', '1:1') : Promise.resolve([]),
        ]);
        if (cargaData && cargaData.length > 0) {
          setCargaHeaders(cargaData[0]);
          localStorage.setItem('apropriapp_carga_headers', JSON.stringify(cargaData[0]));
        }
        if (descargaData && descargaData.length > 0) {
          setDescargaHeaders(descargaData[0]);
          localStorage.setItem('apropriapp_descarga_headers', JSON.stringify(descargaData[0]));
        }
      } catch {
        // Fallback: load from cache
        const cachedCarga = localStorage.getItem('apropriapp_carga_headers');
        const cachedDescarga = localStorage.getItem('apropriapp_descarga_headers');
        if (cachedCarga) setCargaHeaders(JSON.parse(cachedCarga));
        if (cachedDescarga) setDescargaHeaders(JSON.parse(cachedDescarga));
      }
    };
    loadHeaders();
  }, []);

  // Handle escavadeira selection - auto-fill related fields
  const handleEscavadeiraChange = (prefixo: string) => {
    setFormData({ ...formData, escavadeira: prefixo });
    const found = escavadeiras.find(e => e.prefixo === prefixo);
    setSelectedEscavadeira(found || null);
  };

  // Handle caminhao selection - auto-fill related fields
  const handleCaminhaoChange = (prefixo: string) => {
    setFormData({ ...formData, caminhao: prefixo });
    const found = caminhoes.find(c => c.prefixo === prefixo);
    setSelectedCaminhao(found || null);
  };

  // Helper: build row dynamically based on sheet headers
  const buildCargaRow = (headers: string[], data: {
    id: string; dataFormatada: string; hora: string;
    escavadeira: string; caminhao: string; local: string;
    estaca: string; material: string; viagens: string;
    volumeTotal: number;
  }) => {
    const getIdx = (name: string) => headers.indexOf(name);
    const row = new Array(headers.length).fill('');
    
    // Map values to correct header positions
    if (getIdx('ID') !== -1) row[getIdx('ID')] = data.id;
    if (getIdx('Data') !== -1) row[getIdx('Data')] = data.dataFormatada;
    if (getIdx('Hora_Carga') !== -1) row[getIdx('Hora_Carga')] = data.hora;
    if (getIdx('Prefixo_Eq') !== -1) row[getIdx('Prefixo_Eq')] = data.escavadeira;
    if (getIdx('Potencia') !== -1) row[getIdx('Potencia')] = selectedEscavadeira?.potencia || '';
    if (getIdx('Descricao_Eq') !== -1) row[getIdx('Descricao_Eq')] = selectedEscavadeira?.descricao || '';
    if (getIdx('Empresa_Eq') !== -1) row[getIdx('Empresa_Eq')] = selectedEscavadeira?.empresa || '';
    if (getIdx('Operador') !== -1) row[getIdx('Operador')] = selectedEscavadeira?.operador || '';
    if (getIdx('Prefixo_Cb') !== -1) row[getIdx('Prefixo_Cb')] = data.caminhao;
    if (getIdx('Descricao_Cb') !== -1) row[getIdx('Descricao_Cb')] = selectedCaminhao?.descricao || '';
    if (getIdx('Empresa_Cb') !== -1) row[getIdx('Empresa_Cb')] = selectedCaminhao?.empresa || '';
    if (getIdx('Motorista') !== -1) row[getIdx('Motorista')] = selectedCaminhao?.motorista || '';
    if (getIdx('Volume') !== -1) row[getIdx('Volume')] = selectedCaminhao?.volume || '';
    // Try both viagens column names
    if (getIdx('I_Viagens') !== -1) row[getIdx('I_Viagens')] = data.viagens;
    else if (getIdx('N_Viagens') !== -1) row[getIdx('N_Viagens')] = data.viagens;
    if (getIdx('Volume_Total') !== -1) row[getIdx('Volume_Total')] = data.volumeTotal.toString().replace('.', ',');
    if (getIdx('Local_da_Obra') !== -1) row[getIdx('Local_da_Obra')] = data.local;
    if (getIdx('Estaca') !== -1) row[getIdx('Estaca')] = data.estaca;
    if (getIdx('Material') !== -1) row[getIdx('Material')] = data.material;
    if (getIdx('Usuario') !== -1) row[getIdx('Usuario')] = effectiveName || 'Apontador';
    if (getIdx('Encarregado_Eq') !== -1) row[getIdx('Encarregado_Eq')] = selectedEscavadeira?.encarregado || '';
    
    return row;
  };

  const buildDescargaRow = (headers: string[], data: {
    id: string; dataFormatada: string; hora: string;
    caminhao: string; local: string; estaca: string;
    material: string; viagens: string; volumeTotal: number;
  }) => {
    const getIdx = (name: string) => headers.indexOf(name);
    const row = new Array(headers.length).fill('');
    
    if (getIdx('ID') !== -1) row[getIdx('ID')] = data.id;
    if (getIdx('Data') !== -1) row[getIdx('Data')] = data.dataFormatada;
    if (getIdx('Hora') !== -1) row[getIdx('Hora')] = data.hora;
    if (getIdx('Prefixo_Cb') !== -1) row[getIdx('Prefixo_Cb')] = data.caminhao;
    if (getIdx('Descricao_Cb') !== -1) row[getIdx('Descricao_Cb')] = selectedCaminhao?.descricao || '';
    if (getIdx('Empresa_Cb') !== -1) row[getIdx('Empresa_Cb')] = selectedCaminhao?.empresa || '';
    if (getIdx('Motorista') !== -1) row[getIdx('Motorista')] = selectedCaminhao?.motorista || '';
    if (getIdx('Volume') !== -1) row[getIdx('Volume')] = selectedCaminhao?.volume || '';
    if (getIdx('N_Viagens') !== -1) row[getIdx('N_Viagens')] = data.viagens;
    else if (getIdx('I_Viagens') !== -1) row[getIdx('I_Viagens')] = data.viagens;
    if (getIdx('Volume_Total') !== -1) row[getIdx('Volume_Total')] = data.volumeTotal.toString().replace('.', ',');
    if (getIdx('Local_da_Obra') !== -1) row[getIdx('Local_da_Obra')] = data.local;
    if (getIdx('Estaca') !== -1) row[getIdx('Estaca')] = data.estaca;
    if (getIdx('Material') !== -1) row[getIdx('Material')] = data.material;
    if (getIdx('Usuario') !== -1) row[getIdx('Usuario')] = effectiveName || 'Apontador';
    if (getIdx('Encarregado') !== -1) row[getIdx('Encarregado')] = selectedCaminhao?.encarregado || '';
    if (getIdx('Encarregado_Cb') !== -1) row[getIdx('Encarregado_Cb')] = selectedCaminhao?.encarregado || '';
    
    return row;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[FormCarga] handleSubmit called', { isOnline, formData: { local: formData.local, escavadeira: formData.escavadeira, caminhao: formData.caminhao, material: formData.material } });
    setLoading(true);
    setSavedOffline(false);

    try {
      const now = new Date();
      const hora = format(now, 'HH:mm:ss');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const generateId = () => Math.random().toString(36).substring(2, 10);
      
      // Calculate Volume_Total = Volume × N_Viagens
      const volumeUnitario = parseFloat(selectedCaminhao?.volume || '0');
      const numViagens = parseInt(isSalaTecnica ? formData.viagens : '1') || 1;
      const volumeTotal = volumeUnitario * numViagens;
      const viagens = isSalaTecnica ? formData.viagens : '1';
      
      // Build row dynamically based on actual sheet headers
      const cargaRow = cargaHeaders.length > 0 
        ? buildCargaRow(cargaHeaders, {
            id: generateId(), dataFormatada, hora,
            escavadeira: formData.escavadeira, caminhao: formData.caminhao,
            local: formData.local, estaca: formData.estaca || '',
            material: formData.material, viagens, volumeTotal,
          })
        : buildCargaRowFallback(generateId(), dataFormatada, hora, viagens, volumeTotal);

      // Check if offline
      if (!isOnline) {
        addPendingRecord('carga', 'Carga', cargaRow, { ...formData, dataFormatada, hora });

        if (addLancamento && formData.localLancamento) {
          const descargaRow = descargaHeaders.length > 0
            ? buildDescargaRow(descargaHeaders, {
                id: generateId(), dataFormatada, hora,
                caminhao: formData.caminhao, local: formData.localLancamento,
                estaca: formData.estaca || '', material: formData.material,
                viagens, volumeTotal,
              })
            : buildDescargaRowFallback(generateId(), dataFormatada, hora, viagens, volumeTotal);
          addPendingRecord('lancamento', 'Descarga', descargaRow, { ...formData, localLancamento: formData.localLancamento });
        }

        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        return;
      }

      // Online - save directly
      console.log('[FormCarga] Sending carga data (dynamic mapping), row length:', cargaRow.length);
      const successCarga = await appendSheet('Carga', [cargaRow]);
      
      // Backup to Supabase
      if (successCarga) {
        supabase.from('apontamentos_carga').insert({
          data: formData.data,
          hora,
          prefixo_escavadeira: formData.escavadeira,
          descricao_escavadeira: selectedEscavadeira?.descricao,
          empresa_escavadeira: selectedEscavadeira?.empresa,
          operador: selectedEscavadeira?.operador,
          prefixo_caminhao: formData.caminhao,
          descricao_caminhao: selectedCaminhao?.descricao,
          empresa_caminhao: selectedCaminhao?.empresa,
          motorista: selectedCaminhao?.motorista,
          volume_total: volumeTotal,
          viagens: parseInt(viagens),
          local: formData.local,
          estaca: formData.estaca,
          material: formData.material,
          status: 'Sincronizado'
        }).then(({ error }) => {
          if (error) console.error('Supabase backup error (Carga):', error);
        });
      }

      if (!successCarga) {
        addPendingRecord('carga', 'Carga', cargaRow, { ...formData, dataFormatada, hora });
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        return;
      }

      // If addLancamento is enabled, save to Descarga sheet too
      if (addLancamento && formData.localLancamento) {
        const descargaRow = descargaHeaders.length > 0
          ? buildDescargaRow(descargaHeaders, {
              id: generateId(), dataFormatada, hora,
              caminhao: formData.caminhao, local: formData.localLancamento,
              estaca: formData.estaca || '', material: formData.material,
              viagens, volumeTotal,
            })
          : buildDescargaRowFallback(generateId(), dataFormatada, hora, viagens, volumeTotal);

        const successDescarga = await appendSheet('Descarga', [descargaRow]);
        
        // Backup to Supabase (Descarga)
        if (successDescarga) {
          supabase.from('apontamentos_descarga').insert({
            data: formData.data,
            hora,
            prefixo_caminhao: formData.caminhao,
            descricao_caminhao: selectedCaminhao?.descricao,
            empresa_caminhao: selectedCaminhao?.empresa,
            motorista: selectedCaminhao?.motorista,
            volume_total: volumeTotal,
            viagens: parseInt(viagens),
            local: formData.localLancamento,
            estaca: formData.estaca,
            material: formData.material,
          }).then(({ error }) => {
            if (error) console.error('Supabase backup error (Descarga from Carga):', error);
          });
        }

        if (!successDescarga) {
          addPendingRecord('lancamento', 'Descarga', descargaRow, { ...formData, localLancamento: formData.localLancamento });
        }
      }

      setSubmitted(true);
      playSuccessSound();
      // Save last used local
      localStorage.setItem('apropriapp_last_local_carga', formData.local);
      toast({
        title: '✅ Sucesso!',
        description: 'Apontamento registrado e sincronizado.',
      });

    } catch (error: any) {
      console.error('Form submission error:', error);
      
      const now = new Date();
      const hora = format(now, 'HH:mm:ss');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const generateIdFallback = () => Math.random().toString(36).substring(2, 10);
      const volumeUnitarioFallback = parseFloat(selectedCaminhao?.volume || '0');
      const numViagensFallback = parseInt(isSalaTecnica ? formData.viagens : '1') || 1;
      const volumeTotalFallback = volumeUnitarioFallback * numViagensFallback;
      const viagens = isSalaTecnica ? formData.viagens : '1';
      
      const cargaRow = cargaHeaders.length > 0
        ? buildCargaRow(cargaHeaders, {
            id: generateIdFallback(), dataFormatada, hora,
            escavadeira: formData.escavadeira, caminhao: formData.caminhao,
            local: formData.local, estaca: formData.estaca || '',
            material: formData.material, viagens, volumeTotal: volumeTotalFallback,
          })
        : buildCargaRowFallback(generateIdFallback(), dataFormatada, hora, viagens, volumeTotalFallback);
      
      addPendingRecord('carga', 'Carga', cargaRow, formData);
      setSavedOffline(true);
      setSubmitted(true);
      playOfflineSound();
      
    } finally {
      setLoading(false);
    }
  };

  // Fallback row builders (hardcoded positions) for when headers aren't available
  const buildCargaRowFallback = (id: string, dataFormatada: string, hora: string, viagens: string, volumeTotal: number) => [
    id, dataFormatada, hora,
    formData.escavadeira, selectedEscavadeira?.potencia || '', selectedEscavadeira?.descricao || '',
    selectedEscavadeira?.empresa || '', selectedEscavadeira?.operador || '',
    formData.caminhao, selectedCaminhao?.descricao || '', selectedCaminhao?.empresa || '',
    selectedCaminhao?.motorista || '', selectedCaminhao?.volume || '',
    viagens, volumeTotal.toString().replace('.', ','),
    formData.local, formData.estaca || '', formData.material,
    effectiveName || 'Apontador', selectedEscavadeira?.encarregado || '', '',
  ];

  const buildDescargaRowFallback = (id: string, dataFormatada: string, hora: string, viagens: string, volumeTotal: number) => [
    id, dataFormatada, hora,
    formData.caminhao, selectedCaminhao?.empresa || '', selectedCaminhao?.motorista || '',
    selectedCaminhao?.volume || '', viagens, volumeTotal.toString().replace('.', ','),
    formData.localLancamento, formData.estaca || '', formData.material,
    effectiveName || 'Apontador', selectedCaminhao?.encarregado || '', '',
  ];

  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSelectedEscavadeira(null);
    setSelectedCaminhao(null);
    setFormData({
      ...formData,
      estaca: '',
      escavadeira: '',
      caminhao: '',
      material: '',
      viagens: '1',
      localLancamento: '',
    });
    setAddLancamento(false);
  };

  const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';

  if (submitted) {
    const successDetails = [
      { label: 'Local', value: formData.local },
      { label: 'Escavadeira', value: `${formData.escavadeira}${selectedEscavadeira?.potencia ? ` (${selectedEscavadeira.potencia})` : ''}` },
      { label: 'Caminhão', value: `${formData.caminhao}${selectedCaminhao?.motorista ? ` - ${selectedCaminhao.motorista}` : ''}` },
      { label: 'Material', value: formData.material },
      ...(addLancamento && formData.localLancamento ? [{ label: 'Lançamento', value: formData.localLancamento }] : []),
      ...(savedOffline ? [{ label: 'Status', value: '💾 Salvo localmente (sincronizará quando online)' }] : []),
    ];

    return (
      <SuccessScreen
        title={savedOffline ? "Salvo Localmente!" : "Apontamento Registrado!"}
        subtitle={savedOffline ? "Será sincronizado quando a conexão voltar." : "A carga foi registrada e sincronizada."}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor={savedOffline ? "amber" : "blue"}
      />
    );
  }

  if (cacheLoading && escavadeiras.length === 0 && caminhoes.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground font-medium">Carregando dados...</p>
      </div>
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
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Upload className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-2xl text-white">Apontar Carga</h1>
                <p className="text-base text-white/80">Apropriação de Carga</p>
              </div>
            </div>
          </div>
          {/* Offline Indicator */}
          <OfflineIndicator 
            isOnline={isOnline} 
            pendingCount={pendingCount} 
            isSyncing={isSyncing}
          />
        </div>
      </div>

      {/* Pending Records Banner */}
      {pendingCount > 0 && isOnline && (
        <div className="mx-5 mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-6 h-6 text-amber-600" />
            <span className="text-lg font-semibold text-amber-800">{pendingCount} registro(s) pendente(s)</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => syncAllPending()}
            disabled={isSyncing}
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 h-12 px-4 text-base font-semibold"
          >
            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sincronizar'}
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

        {/* Local */}
        {isFieldVisible('local') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <MapPin className="w-7 h-7 text-blue-600" />
              Local
            </Label>
            <Select 
              value={formData.local} 
              onValueChange={v => setFormData({ ...formData, local: v })}
              disabled={isFieldDisabled('local')}
            >
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o local de origem" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {locaisOrigem.map(local => (
                  <SelectItem key={local.id} value={local.nome} className="text-lg py-3">
                    {local.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        )}

        {/* Escavadeira (Equipamento) */}
        {isFieldVisible('equipamento') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <TruckIcon className="w-7 h-7 text-blue-600" />
              Escavadeira
            </Label>
            <Select 
              value={formData.escavadeira} 
              onValueChange={handleEscavadeiraChange}
              disabled={isFieldDisabled('equipamento')}
            >
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione a escavadeira" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {escavadeiras.map(esc => (
                  <SelectItem key={esc.prefixo} value={esc.prefixo} className="text-lg py-3">
                    {esc.prefixo} {esc.potencia ? `(${esc.potencia})` : ''} - {esc.empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEscavadeira && (
              <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl space-y-2">
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Potência:</span> <span className="font-semibold">{selectedEscavadeira.potencia || '-'}</span></p>
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Operador:</span> <span className="font-semibold">{selectedEscavadeira.operador || '-'}</span></p>
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Empresa:</span> <span className="font-semibold">{selectedEscavadeira.empresa || '-'}</span></p>
              </div>
            )}
          </Card>
        )}

        {/* Caminhão (Veículo) */}
        {isFieldVisible('veiculo') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <TruckIcon className="w-7 h-7 text-blue-600" />
              Caminhão
            </Label>
            <Select 
              value={formData.caminhao} 
              onValueChange={handleCaminhaoChange}
              disabled={isFieldDisabled('veiculo')}
            >
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o caminhão" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {caminhoes.map(cam => (
                  <SelectItem key={cam.prefixo} value={cam.prefixo} className="text-lg py-3">
                    {cam.prefixo} - {cam.motorista || cam.empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCaminhao && (
              <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl space-y-2">
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Motorista:</span> <span className="font-semibold">{selectedCaminhao.motorista || '-'}</span></p>
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Volume:</span> <span className="font-semibold">{selectedCaminhao.volume || '-'} m³</span></p>
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Empresa:</span> <span className="font-semibold">{selectedCaminhao.empresa || '-'}</span></p>
              </div>
            )}
          </Card>
        )}

        {/* Tipo de Material */}
        {isFieldVisible('material') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <Package className="w-7 h-7 text-blue-600" />
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

        {/* Nº de Viagens - Only for Admin/Sala Técnica OR if visible for user */}
        {(isSalaTecnica || isFieldVisible('viagens')) && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block">Nº de Viagens</Label>
            <Input
              type="number"
              min="1"
              value={formData.viagens}
              onChange={e => setFormData({ ...formData, viagens: e.target.value })}
              disabled={!isSalaTecnica && isFieldDisabled('viagens')}
              className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium"
            />
            {!isSalaTecnica && (
              <p className="text-base text-gray-500 mt-2 font-medium">* Campo controlado por permissões</p>
            )}
          </Card>
        )}

        {/* Add Lançamento Toggle */}
        <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-800 text-xl font-bold">Adicionar Lançamento</Label>
              <p className="text-base text-gray-500 mt-1">Registrar descarga no mesmo apontamento</p>
            </div>
            <Switch
              checked={addLancamento}
              onCheckedChange={setAddLancamento}
              className="scale-150"
            />
          </div>
        </Card>

        {/* Local de Lançamento - Conditional */}
        {addLancamento && (
          <Card className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl shadow-sm animate-in slide-in-from-top-2">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <MapPin className="w-7 h-7 text-blue-600" />
              Local de Lançamento
            </Label>
            <Select value={formData.localLancamento} onValueChange={v => setFormData({ ...formData, localLancamento: v })}>
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o local de destino" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {locaisDestino.map(local => (
                  <SelectItem key={local.id} value={local.nome} className="text-lg py-3">
                    {local.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || sheetLoading || !formData.local || !formData.escavadeira || !formData.caminhao || !formData.material}
          className="w-full h-20 text-2xl font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-xl mt-4"
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
    </div>
  );
}
