import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface ApontamentoLancamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ApontamentoLancamentoModal({ open, onOpenChange, onSuccess }: ApontamentoLancamentoModalProps) {
  const { profile } = useAuth();
  const { appendSheet, loading: sheetLoading, readSheet } = useGoogleSheets();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]);
  const [caminhoes, setCaminhoes] = useState<CaminhaoData[]>([]);

  const [selectedCaminhao, setSelectedCaminhao] = useState<CaminhaoData | null>(null);

  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    local: '',
    caminhao: '',
    material: '',
    viagens: '1',
  });

  // Load options when modal opens
  useEffect(() => {
    if (open) {
      loadOptions();
    }
  }, [open]);

  const loadOptions = async () => {
    // Load locais de Destino from Supabase (Lançamento = Descarga = Destino)
    const { data: locaisData } = await supabase
      .from('locais')
      .select('id, nome, tipo')
      .eq('status', 'Ativo')
      .eq('tipo', 'Destino')
      .order('nome');
    
    if (locaisData) setLocais(locaisData);

    // Load materiais from Supabase
    const { data: materiaisData } = await supabase
      .from('material')
      .select('id, nome')
      .eq('status', 'Ativo')
      .order('nome');
    
    if (materiaisData) setMateriais(materiaisData);

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
      const volumeUnitario = parseFloat(selectedCaminhao?.volume || '0');
      const numViagens = parseInt(formData.viagens) || 1;
      const volumeTotal = volumeUnitario * numViagens;

      // Descarga sheet: A:ID, B:Data, C:Hora, D:Prefixo_Cb, E:Empresa_Cb, F:Motorista, G:Volume, 
      // H:N_Viagens, I:Volume_Total, J:Local_da_Obra, K:Estaca, L:Material, M:Usuario, N:Encarregado, O:Observacao
      const descargaRow = [
        generateId(),
        dataFormatada,
        hora,
        formData.caminhao,
        selectedCaminhao?.empresa || '',
        selectedCaminhao?.motorista || '',
        selectedCaminhao?.volume || '',
        formData.viagens,
        volumeTotal.toString(),
        formData.local,
        '',
        formData.material,
        profile?.nome || 'Sistema',
        selectedCaminhao?.encarregado || '',
        '',
      ];

      // Backup to Supabase
      const supabaseBackup = async () => {
        try {
          await supabase.from('apontamentos_descarga').insert({
            data: formData.data,
            hora,
            prefixo_caminhao: formData.caminhao,
            descricao_caminhao: selectedCaminhao?.descricao,
            empresa_caminhao: selectedCaminhao?.empresa,
            motorista: selectedCaminhao?.motorista,
            volume: volumeUnitario,
            volume_total: volumeTotal,
            viagens: numViagens,
            local: formData.local,
            material: formData.material,
            usuario: profile?.nome || 'Sistema',
            encarregado: selectedCaminhao?.encarregado,
          });
        } catch (e) {
          console.error('Supabase backup error:', e);
        }
      };

      // Always backup to Supabase
      await supabaseBackup();

      const success = await appendSheet('Descarga', [descargaRow]);

      if (!success) {
        toast({
          title: 'Aviso',
          description: 'Salvo no banco de dados, mas houve erro ao sincronizar com a planilha.',
          variant: 'default',
        });
      } else {
        toast({
          title: '✅ Lançamento Registrado!',
          description: `${formData.viagens} viagem(s) adicionada(s) com sucesso na planilha e banco de dados.`,
        });
      }

      // Reset form
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        local: '',
        caminhao: '',
        material: '',
        viagens: '1',
      });
      setSelectedCaminhao(null);

      onSuccess();
      onOpenChange(false);

    } catch (error: any) {
      console.error('Form submission error:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar o lançamento.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.local && formData.caminhao && formData.material;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="w-6 h-6 text-primary" />
            Apontamento de Descarga
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
            {/* Local de Destino */}
            <div className="space-y-2">
              <Label className="font-semibold text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Local de Destino
              </Label>
              <Select 
                value={formData.local} 
                onValueChange={v => setFormData({ ...formData, local: v })}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {locais.map(local => (
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
                <Package className="w-5 h-5 text-orange-600" />
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

          {/* Row 3: Caminhão (full width) */}
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
              <div className="flex gap-4 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
                <span>🚛 <strong>{selectedCaminhao.motorista || '-'}</strong></span>
                <span>📦 Volume: <strong>{selectedCaminhao.volume || '-'} m³</strong></span>
                <span>🏢 {selectedCaminhao.empresa}</span>
              </div>
            )}
          </div>

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
                  Registrar Lançamento
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
