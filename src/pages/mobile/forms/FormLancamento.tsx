import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ClipboardList, Loader2, CheckCircle2, MapPin, Truck as TruckIcon, Package, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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

export default function FormLancamento() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, readSheet, loading: sheetLoading } = useGoogleSheets();
  const { isOnline, addPendingRecord, pendingCount, syncAllPending, isSyncing } = useOfflineSync();
  const { 
    getCachedLocaisDestino, 
    getCachedMateriais, 
    getCachedCaminhoes,
    isLoading: cacheLoading,
  } = useOfflineCache();
  const { toast } = useToast();
  const { isFieldVisible, isFieldDisabled, loading: permissionsLoading, hasFullAccess } = useFormFieldPermissions('lancamento');

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [descargaHeaders, setDescargaHeaders] = useState<string[]>([]);

  // Selected equipment data for auto-fill
  const [selectedCaminhao, setSelectedCaminhao] = useState<CaminhaoData | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    local: '',
    estaca: '',
    caminhao: '',
    material: '',
    viagens: '1',
  });

  // Use cached data directly - instant loading!
  const locais = useMemo(() => {
    const cached = getCachedLocaisDestino();
    return cached.map(l => ({ ...l, tipo: 'Destino' })) as LocalOption[];
  }, [getCachedLocaisDestino]);

  const materiais = useMemo(() => {
    return getCachedMateriais() as MaterialOption[];
  }, [getCachedMateriais]);

  const caminhoes = useMemo(() => {
    const cached = getCachedCaminhoes();
    return cached.filter((c: any) => c.Prefixo_Cb).map((row: any) => ({
      prefixo: row.Prefixo_Cb || '',
      descricao: row.Descricao_Cb || '',
      motorista: row.Motorista || '',
      marca: row.Marca || '',
      potencia: row.Potencia || '',
      volume: row.Volume || '',
      empresa: row.Empresa_Cb || '',
      encarregado: row.Encarregado_Cb || '',
    })) as CaminhaoData[];
  }, [getCachedCaminhoes]);

  // Load last used location from localStorage (cached)
  useEffect(() => {
    const lastLocal = localStorage.getItem('apropriapp_last_local_lancamento');
    if (lastLocal && locais.some(l => l.nome === lastLocal)) {
      setFormData(prev => ({ ...prev, local: lastLocal }));
    }
  }, [locais]);

  // Load sheet headers for dynamic column mapping
  useEffect(() => {
    const loadHeaders = async () => {
      try {
        const data = await readSheet('Descarga', '1:1');
        if (data && data.length > 0) {
          setDescargaHeaders(data[0]);
          localStorage.setItem('apropriapp_descarga_headers', JSON.stringify(data[0]));
        }
      } catch {
        const cached = localStorage.getItem('apropriapp_descarga_headers');
        if (cached) setDescargaHeaders(JSON.parse(cached));
      }
    };
    loadHeaders();
  }, []);

  // Handle caminhao selection - auto-fill related fields
  const handleCaminhaoChange = (prefixo: string) => {
    setFormData({ ...formData, caminhao: prefixo });
    const found = caminhoes.find(c => c.prefixo === prefixo);
    setSelectedCaminhao(found || null);
  };

  // Build row dynamically based on sheet headers
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

  const buildDescargaRowFallback = (id: string, dataFormatada: string, hora: string, viagens: string, volumeTotal: number) => [
    id, dataFormatada, hora,
    formData.caminhao, selectedCaminhao?.empresa || '', selectedCaminhao?.motorista || '',
    selectedCaminhao?.volume || '', viagens, volumeTotal.toString().replace('.', ','),
    formData.local, formData.estaca || '', formData.material,
    effectiveName || 'Apontador', selectedCaminhao?.encarregado || '', '',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[FormLancamento] handleSubmit called', { isOnline, formData: { local: formData.local, caminhao: formData.caminhao, material: formData.material } });
    setLoading(true);
    setSavedOffline(false);

    try {
      const now = new Date();
      const hora = format(now, 'HH:mm');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';
      const viagens = isSalaTecnica ? formData.viagens : '1';
      const generateId = () => Math.random().toString(36).substring(2, 10);
      const volumeUnitario = parseFloat(selectedCaminhao?.volume || '0');
      const numViagens = parseInt(viagens) || 1;
      const volumeTotal = volumeUnitario * numViagens;

      const descargaRow = descargaHeaders.length > 0
        ? buildDescargaRow(descargaHeaders, {
            id: generateId(), dataFormatada, hora,
            caminhao: formData.caminhao, local: formData.local,
            estaca: formData.estaca || '', material: formData.material,
            viagens, volumeTotal,
          })
        : buildDescargaRowFallback(generateId(), dataFormatada, hora, viagens, volumeTotal);

      if (!isOnline) {
        addPendingRecord('lancamento', 'Descarga', descargaRow, { formData });
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        toast({ title: 'Salvo Localmente', description: 'Será sincronizado quando a conexão voltar.' });
        setLoading(false);
        return;
      }

      console.log('[FormLancamento] Sending descarga data, row length:', descargaRow.length);
      const success = await appendSheet('Descarga', [descargaRow]);
      
      // Backup to Supabase
      if (success) {
        supabase.from('apontamentos_descarga').insert({
          data: formData.data,
          hora,
          prefixo_caminhao: formData.caminhao,
          descricao_caminhao: selectedCaminhao?.descricao,
          empresa_caminhao: selectedCaminhao?.empresa,
          motorista: selectedCaminhao?.motorista,
          volume_total: volumeTotal,
          viagens: parseInt(viagens),
          local: formData.local,
          estaca: formData.estaca,
          material: formData.material,
        }).then(({ error }) => {
          if (error) console.error('Supabase backup error (Descarga):', error);
        });
      }

      console.log('[FormLancamento] appendSheet result:', success);
      if (!success) throw new Error('Erro ao salvar lançamento');

      setSubmitted(true);
      playSuccessSound();
      localStorage.setItem('apropriapp_last_local_lancamento', formData.local);
      toast({ title: 'Sucesso!', description: 'Lançamento registrado com sucesso.' });

    } catch (error: any) {
      const now = new Date();
      const hora = format(now, 'HH:mm');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';
      const viagens = isSalaTecnica ? formData.viagens : '1';
      const generateIdFallback = () => Math.random().toString(36).substring(2, 10);
      const volumeUnitarioFallback = parseFloat(selectedCaminhao?.volume || '0');
      const numViagensFallback = parseInt(viagens) || 1;
      const volumeTotalFallback = volumeUnitarioFallback * numViagensFallback;

      const descargaRow = descargaHeaders.length > 0
        ? buildDescargaRow(descargaHeaders, {
            id: generateIdFallback(), dataFormatada, hora,
            caminhao: formData.caminhao, local: formData.local,
            estaca: formData.estaca || '', material: formData.material,
            viagens, volumeTotal: volumeTotalFallback,
          })
        : buildDescargaRowFallback(generateIdFallback(), dataFormatada, hora, viagens, volumeTotalFallback);

      addPendingRecord('lancamento', 'Descarga', descargaRow, { formData });
      setSavedOffline(true);
      setSubmitted(true);
      playOfflineSound();
      toast({ title: 'Salvo Localmente', description: 'Erro na conexão. Será sincronizado depois.' });
    } finally {
      setLoading(false);
    }
  };

  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSelectedCaminhao(null);
    setFormData({
      ...formData,
      estaca: '',
      caminhao: '',
      material: '',
      viagens: '1',
    });
  };

  const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';

  if (submitted) {
    const successDetails = [
      { label: 'Local', value: formData.local },
      { label: 'Caminhão', value: `${formData.caminhao}${selectedCaminhao?.motorista ? ` - ${selectedCaminhao.motorista}` : ''}` },
      { label: 'Material', value: formData.material },
    ];

    return (
      <SuccessScreen
        title={savedOffline ? "Salvo Localmente!" : "Lançamento Registrado!"}
        subtitle={savedOffline ? "Será sincronizado quando a conexão voltar." : "A descarga foi registrada e sincronizada."}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor={savedOffline ? "amber" : "blue"}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-blue-500 p-5 sticky top-0 z-10 shadow-md">
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
                <ClipboardList className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-2xl text-white">Lançamento</h1>
                <p className="text-base text-white/80">Registro de Descarga</p>
              </div>
            </div>
          </div>
          <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />
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
                <SelectValue placeholder="Selecione o local de destino" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {locais.map(local => (
                  <SelectItem key={local.id} value={local.nome} className="text-lg py-3">
                    {local.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {/* Nº de Viagens - Only for Admin/Sala Técnica OR if visible */}
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
          </Card>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || sheetLoading || !formData.local || !formData.caminhao || !formData.material}
          className="w-full h-20 text-2xl font-bold bg-blue-600 hover:bg-blue-700 shadow-xl mt-4 rounded-2xl"
        >
          {loading || sheetLoading ? (
            <>
              <Loader2 className="w-8 h-8 mr-3 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-8 h-8 mr-3" />
              Registrar Lançamento
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
