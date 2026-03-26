import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Droplets, Truck, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface PipaData {
  id: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  capacidade: string;
  placa: string;
  tipoLocal: string;
}

interface PipaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: {
    id: string;
    data: string;
    prefixo: string;
    descricao: string;
    empresa: string;
    motorista: string;
    capacidade: string;
    viagens: number;
    tipoLocal?: string;
    rowIndex?: number;
  } | null;
}

export function PipaModal({ open, onOpenChange, onSuccess, editData }: PipaModalProps) {
  const { appendSheet, writeSheet, readSheet, loading: sheetLoading } = useGoogleSheets();
  const { profile, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [veiculos, setVeiculos] = useState<PipaData[]>([]);
  const [selectedPipa, setSelectedPipa] = useState<PipaData | null>(null);
  
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    veiculo: '',
    tipoLocal: '',
    viagens: '1',
  });

  // Load veiculos on mount
  useEffect(() => {
    const loadData = async () => {
      const pipaData = await readSheet('Caminhao_Pipa');
      if (pipaData && pipaData.length > 1) {
        const headers = pipaData[0];
        const getIdx = (name: string) => headers.indexOf(name);
        
        // Try multiple possible header names for the local field
        const tipoLocalIdx = getIdx('Tipo_Local') >= 0 
          ? getIdx('Tipo_Local') 
          : getIdx('Local de Trabalho') >= 0 
            ? getIdx('Local de Trabalho') 
            : getIdx('Local_Trabalho') >= 0 
              ? getIdx('Local_Trabalho') 
              : -1;
        
        const pipasData = pipaData.slice(1)
          .filter(row => row[getIdx('Prefixo')])
          .map(row => ({
            id: row[getIdx('ID_Pipa')] || '',
            prefixo: row[getIdx('Prefixo')] || '',
            descricao: row[getIdx('Descricao')] || '',
            empresa: row[getIdx('Empresa')] || '',
            motorista: row[getIdx('Motorista')] || '',
            capacidade: row[getIdx('Capacidade')] || '',
            placa: row[getIdx('Placa')] || '',
            tipoLocal: tipoLocalIdx >= 0 ? (row[tipoLocalIdx] || '') : '',
          }));
        setVeiculos(pipasData);
      }
    };
    
    if (open) {
      loadData();
    }
  }, [open, readSheet]);

  // Handle edit mode
  useEffect(() => {
    if (editData) {
      const [day, month, year] = editData.data.split('/');
      
      // Try to find the tipoLocal from fleet data or editData
      const found = veiculos.find(v => v.prefixo === editData.prefixo);
      const tipoLocal = editData.tipoLocal || found?.tipoLocal || '';
      
      setFormData({
        data: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        veiculo: editData.prefixo,
        tipoLocal,
        viagens: String(editData.viagens || 1),
      });
      
      if (found) {
        setSelectedPipa(found);
      } else {
        setSelectedPipa({
          id: '',
          prefixo: editData.prefixo,
          descricao: editData.descricao,
          empresa: editData.empresa,
          motorista: editData.motorista,
          capacidade: editData.capacidade,
          placa: '',
          tipoLocal,
        });
      }
    } else {
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        veiculo: '',
        tipoLocal: '',
        viagens: '1',
      });
      setSelectedPipa(null);
    }
  }, [editData, veiculos]);

  const handlePipaChange = (prefixo: string) => {
    const found = veiculos.find(p => p.prefixo === prefixo);
    setSelectedPipa(found || null);
    
    // Auto-fill tipoLocal from fleet config
    setFormData(prev => ({ 
      ...prev, 
      veiculo: prefixo,
      tipoLocal: found?.tipoLocal || prev.tipoLocal,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';
      const viagens = isSalaTecnica ? formData.viagens : '1';

      const generateId = () => Math.random().toString(36).substring(2, 10);
      
      const pipaRow = [
        editData?.id || generateId(),     // A: ID_Pipa
        dataFormatada,                     // B: Data
        formData.veiculo,                  // C: Prefixo
        selectedPipa?.descricao || '',     // D: Descricao
        selectedPipa?.empresa || '',       // E: Empresa
        selectedPipa?.motorista || '',     // F: Motorista
        selectedPipa?.capacidade || '',    // G: Capacidade
        viagens,                           // H: N_Viagens
        formData.tipoLocal || '',          // I: Local de Trabalho
      ];

      let success: boolean;

      if (editData && editData.rowIndex !== undefined) {
        // Update existing row instead of appending a new one
        const rowNumber = editData.rowIndex + 1; // Convert 0-based data index to 1-based sheet row
        const range = `A${rowNumber}:I${rowNumber}`;
        success = await writeSheet('Apontamento_Pipa', range, [pipaRow]);
      } else {
        success = await appendSheet('Apontamento_Pipa', [pipaRow]);
      }

      if (!success) {
        throw new Error('Erro ao salvar apontamento');
      }

      toast({
        title: 'Sucesso!',
        description: editData ? 'Apontamento atualizado.' : 'Apontamento registrado.',
      });

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        veiculo: '',
        tipoLocal: '',
        viagens: '1',
      });
      setSelectedPipa(null);

    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar apontamento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" />
            {editData ? 'Editar Apontamento' : 'Novo Apontamento de Pipa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data */}
          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={formData.data}
              onChange={e => setFormData({ ...formData, data: e.target.value })}
              disabled={!isSalaTecnica}
            />
          </div>

          {/* Veículo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Veículo
            </Label>
            <Select value={formData.veiculo} onValueChange={handlePipaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent>
                {veiculos.map(v => (
                  <SelectItem key={v.prefixo} value={v.prefixo}>
                    {v.prefixo} - {v.motorista || v.empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPipa && (
              <div className="p-2 bg-muted rounded-lg text-xs space-y-1">
                <p><span className="text-muted-foreground">Motorista:</span> {selectedPipa.motorista || '-'}</p>
                <p><span className="text-muted-foreground">Capacidade:</span> {selectedPipa.capacidade || '-'} L</p>
                <p><span className="text-muted-foreground">Empresa:</span> {selectedPipa.empresa || '-'}</p>
              </div>
            )}
          </div>

          {/* Local de Trabalho (Produção/Recicladora) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Local de Trabalho
            </Label>
            <Select 
              value={formData.tipoLocal} 
              onValueChange={(value) => setFormData({ ...formData, tipoLocal: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o local" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Produção">Produção</SelectItem>
                <SelectItem value="Recicladora">Recicladora</SelectItem>
              </SelectContent>
            </Select>
            {formData.tipoLocal && selectedPipa?.tipoLocal && formData.tipoLocal !== selectedPipa.tipoLocal && (
              <p className="text-xs text-amber-600">
                ⚠ Local alterado manualmente (padrão da frota: {selectedPipa.tipoLocal})
              </p>
            )}
          </div>


          {/* Nº de Viagens */}
          {isSalaTecnica && (
            <div className="space-y-2">
              <Label>Nº de Viagens</Label>
              <Input
                type="number"
                min="1"
                value={formData.viagens}
                onChange={e => setFormData({ ...formData, viagens: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">* Campo visível apenas para Sala Técnica/Admin</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || sheetLoading || !formData.veiculo}
              className="flex-1"
            >
              {loading || sheetLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                editData ? 'Atualizar' : 'Registrar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}