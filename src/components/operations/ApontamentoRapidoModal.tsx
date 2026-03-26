import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Loader2, MapPin, Truck, Package, CheckCircle2, Plus } from 'lucide-react';

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

interface ApontamentoRapidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ApontamentoRapidoModal({ open, onOpenChange, onSuccess }: ApontamentoRapidoModalProps) {
  const { profile } = useAuth();
  const { appendSheet, loading: sheetLoading, readSheet } = useGoogleSheets();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [locaisOrigem, setLocaisOrigem] = useState<LocalOption[]>([]);
  const [locaisDestino, setLocaisDestino] = useState<LocalOption[]>([]);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]);
  const [escavadeiras, setEscavadeiras] = useState<EquipamentoData[]>([]);
  const [caminhoes, setCaminhoes] = useState<CaminhaoData[]>([]);
  const [addLancamento, setAddLancamento] = useState(false);

  const [selectedEscavadeira, setSelectedEscavadeira] = useState<EquipamentoData | null>(null);
  const [selectedCaminhao, setSelectedCaminhao] = useState<CaminhaoData | null>(null);

  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    local: '',
    escavadeira: '',
    caminhao: '',
    material: '',
    viagens: '1',
    localLancamento: '',
  });

  // Load options when modal opens
  useEffect(() => {
    if (open) {
      loadOptions();
    }
  }, [open]);

  const loadOptions = async () => {
    // Load locais de Origem from Supabase
    const { data: origemData } = await supabase
      .from('locais')
      .select('id, nome, tipo')
      .eq('status', 'Ativo')
      .eq('tipo', 'Origem')
      .order('nome');
    
    if (origemData) setLocaisOrigem(origemData);

    // Load locais de Destino from Supabase
    const { data: destinoData } = await supabase
      .from('locais')
      .select('id, nome, tipo')
      .eq('status', 'Ativo')
      .eq('tipo', 'Destino')
      .order('nome');
    
    if (destinoData) setLocaisDestino(destinoData);

    // Load materiais from Supabase
    const { data: materiaisData } = await supabase
      .from('materiais')
      .select('id, nome')
      .eq('status', 'Ativo')
      .order('nome');
    
    if (materiaisData) setMateriais(materiaisData);

    // Load escavadeiras from Google Sheets
    const escData = await readSheet('Equipamentos');
    if (escData && escData.length > 1) {
      const headers = escData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      
      const equipamentos = escData.slice(1)
        .filter(row => row[getIdx('Prefixo_Eq')])
        .map(row => ({
          prefixo: row[getIdx('Prefixo_Eq')] || '',
          descricao: row[getIdx('Descricao_Eq')] || '',
          operador: row[getIdx('Operador')] || '',
          marca: row[getIdx('Marca')] || '',
          potencia: row[getIdx('Potencia')] || '',
          empresa: row[getIdx('Empresa_Eq')] || '',
          encarregado: row[getIdx('Encarregado_Eq')] || '',
        }));
      setEscavadeiras(equipamentos);
    }

    // Load caminhões from Google Sheets
    const camData = await readSheet('Caminhao');
    if (camData && camData.length > 1) {
      const headers = camData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      
      const caminhoesData = camData.slice(1)
        .filter(row => row[getIdx('Prefixo_Cb')])
        .map(row => ({
          prefixo: row[getIdx('Prefixo_Cb')] || '',
          descricao: row[getIdx('Descricao_Cb')] || '',
          motorista: row[getIdx('Motorista')] || '',
          marca: row[getIdx('Marca')] || '',
          potencia: row[getIdx('Potencia')] || '',
          volume: row[getIdx('Volume')] || '',
          empresa: row[getIdx('Empresa_Cb')] || '',
          encarregado: row[getIdx('Encarregado_Cb')] || '',
        }));
      setCaminhoes(caminhoesData);
    }
  };

  const handleEscavadeiraChange = (prefixo: string) => {
    setFormData({ ...formData, escavadeira: prefixo });
    const found = escavadeiras.find(e => e.prefixo === prefixo);
    setSelectedEscavadeira(found || null);
  };

  const handleCaminhaoChange = (prefixo: string) => {
    setFormData({ ...formData, caminhao: prefixo });
    const found = caminhoes.find(c => c.prefixo === prefixo);
    setSelectedCaminhao(found || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const now = new Date();
      const hora = format(now, 'HH:mm:ss');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      
      const generateId = () => Math.random().toString(36).substring(2, 10);
      const volume = parseFloat(selectedCaminhao?.volume || '0') || 0;
      const viagens = parseInt(formData.viagens) || 1;
      const volumeTotal = volume * viagens;
      
      const cargaRow = [
        generateId(),
        dataFormatada,
        hora,
        formData.escavadeira,
        selectedEscavadeira?.potencia || '',
        selectedEscavadeira?.descricao || '',
        selectedEscavadeira?.empresa || '',
        selectedEscavadeira?.operador || '',
        formData.caminhao,
        selectedCaminhao?.descricao || '',
        selectedCaminhao?.empresa || '',
        selectedCaminhao?.motorista || '',
        selectedCaminhao?.volume || '',
        formData.viagens,
        volumeTotal.toString().replace('.', ','), // Volume_Total = Volume × Viagens
        formData.local,
        '',
        formData.material,
        profile?.nome || 'Sistema',
        selectedEscavadeira?.encarregado || '',
        '',
        addLancamento ? 'SIM' : 'NAO',
        formData.localLancamento || '',
      ];

      const successCarga = await appendSheet('Carga', [cargaRow]);

      if (!successCarga) {
        throw new Error('Falha ao salvar carga');
      }

      // If addLancamento is enabled, save to Descarga sheet too
      if (addLancamento && formData.localLancamento) {
        const descargaVolumeTotal = volume * viagens;
        const descargaRow = [
          generateId(),
          dataFormatada,
          hora,
          formData.caminhao,
          selectedCaminhao?.empresa || '',
          selectedCaminhao?.motorista || '',
          selectedCaminhao?.volume || '',
          formData.viagens,
          descargaVolumeTotal.toString().replace('.', ','), // Volume_Total = Volume × Viagens
          formData.localLancamento,
          '',
          formData.material,
          profile?.nome || 'Sistema',
          selectedCaminhao?.encarregado || '',
          '',
        ];

        await appendSheet('Descarga', [descargaRow]);
      }

      toast({
        title: '✅ Apontamento Registrado!',
        description: `${formData.viagens} viagem(s) adicionada(s) com sucesso.`,
      });

      // Reset form
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        local: '',
        escavadeira: '',
        caminhao: '',
        material: '',
        viagens: '1',
        localLancamento: '',
      });
      setSelectedEscavadeira(null);
      setSelectedCaminhao(null);
      setAddLancamento(false);

      onSuccess();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Form submission error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar o apontamento.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.local && formData.escavadeira && formData.caminhao && formData.material;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="w-6 h-6 text-primary" />
            Apontamento Rápido de Carga
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Row 1: Data e Viagens */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-semibold text-base">📅 Data</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={e => setFormData({ ...formData, data: e.target.value })}
                className="h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-base">🔢 Nº de Viagens</Label>
              <Input
                type="number"
                min="1"
                value={formData.viagens}
                onChange={e => setFormData({ ...formData, viagens: e.target.value })}
                className="h-12 text-lg font-semibold text-center"
              />
            </div>
          </div>

          {/* Row 2: Local e Material */}
          <div className="grid grid-cols-2 gap-6">
            {/* Local de Origem */}
            <div className="space-y-2">
              <Label className="font-semibold text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Local de Origem
              </Label>
              <Select 
                value={formData.local} 
                onValueChange={v => setFormData({ ...formData, local: v })}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {locaisOrigem.map(local => (
                    <SelectItem key={local.id} value={local.nome}>
                      {local.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Material */}
            <div className="space-y-2">
              <Label className="font-semibold text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Material
              </Label>
              <Select 
                value={formData.material} 
                onValueChange={v => setFormData({ ...formData, material: v })}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {materiais.map(mat => (
                    <SelectItem key={mat.id} value={mat.nome}>
                      {mat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Escavadeira e Caminhão */}
          <div className="grid grid-cols-2 gap-6">
            {/* Escavadeira */}
            <div className="space-y-2">
              <Label className="font-semibold text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-600" />
                Escavadeira
              </Label>
              <Select 
                value={formData.escavadeira} 
                onValueChange={handleEscavadeiraChange}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione a escavadeira" />
                </SelectTrigger>
                <SelectContent>
                  {escavadeiras.map(esc => (
                    <SelectItem key={esc.prefixo} value={esc.prefixo}>
                      {esc.prefixo} {esc.potencia ? `(${esc.potencia})` : ''} - {esc.empresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEscavadeira && (
                <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded">
                  👷 Operador: <strong>{selectedEscavadeira.operador || '-'}</strong>
                </p>
              )}
            </div>

            {/* Caminhão */}
            <div className="space-y-2">
              <Label className="font-semibold text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Caminhão
              </Label>
              <Select 
                value={formData.caminhao} 
                onValueChange={handleCaminhaoChange}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione o caminhão" />
                </SelectTrigger>
                <SelectContent>
                  {caminhoes.map(cam => (
                    <SelectItem key={cam.prefixo} value={cam.prefixo}>
                      {cam.prefixo} - {cam.motorista || cam.empresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCaminhao && (
                <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded">
                  🚛 {selectedCaminhao.motorista || '-'} • <strong>{selectedCaminhao.volume || '-'} m³</strong>
                </p>
              )}
            </div>
          </div>

          {/* Add Lançamento Toggle */}
          <div className={`flex items-center justify-between p-4 rounded-xl border-2 shadow-md transition-all duration-200 ${
            addLancamento 
              ? 'bg-slate-900 border-slate-700 dark:bg-slate-800 dark:border-slate-600' 
              : 'bg-gradient-to-r from-slate-100 to-slate-200 border-slate-300 dark:from-slate-900 dark:to-slate-800 dark:border-slate-700'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-md transition-colors ${
                addLancamento 
                  ? 'bg-emerald-500' 
                  : 'bg-slate-600 dark:bg-slate-500'
              }`}>
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <Label className={`font-bold text-lg transition-colors ${
                  addLancamento 
                    ? 'text-white' 
                    : 'text-slate-900 dark:text-slate-100'
                }`}>
                  Adicionar Lançamento
                </Label>
                <p className={`text-sm font-medium transition-colors ${
                  addLancamento 
                    ? 'text-slate-300' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  Registrar descarga automaticamente junto com a carga
                </p>
              </div>
            </div>
            <Switch
              checked={addLancamento}
              onCheckedChange={setAddLancamento}
              className="scale-150 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-400"
            />
          </div>

          {/* Local de Lançamento */}
          {addLancamento && (
            <div className="space-y-2 animate-in slide-in-from-top-2 p-4 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-950 dark:to-green-950 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-sm">
              <Label className="font-bold text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Local de Lançamento (Destino)
              </Label>
              <Select 
                value={formData.localLancamento} 
                onValueChange={v => setFormData({ ...formData, localLancamento: v })}
              >
                <SelectTrigger className="h-12 text-base bg-white dark:bg-background border-2 border-emerald-300 dark:border-emerald-600">
                  <SelectValue placeholder="Selecione o destino" />
                </SelectTrigger>
                <SelectContent>
                  {locaisDestino.map(local => (
                    <SelectItem key={local.id} value={local.nome}>
                      {local.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 text-base"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || sheetLoading || !isFormValid}
              className="flex-1 h-12 text-base bg-primary hover:bg-primary/90"
            >
              {loading || sheetLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Registrar Apontamento
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
