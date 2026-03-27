import { useState, useEffect } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mountain, Scale, Truck, Package, Clock, Building2, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface MaterialOption {
  id: string;
  nome: string;
}

interface PedreiraEditData {
  rowIndex: number;
  data: string;
  hora: string;
  ordem: string;
  fornecedor: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  placa: string;
  material: string;
  pesoVazio: number;
  pesoFinal: number;
  pesoLiquido: number;
  tonelada: number;
  toneladaTicket?: number;
  toneladaCalcObra?: number;
  pesoChegada: number;
  pesoVazioObra?: number;
  originalRow?: any[];
}

interface PedreiraEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData: PedreiraEditData | null;
  headers: string[];
}

export function PedreiraEditModal({ open, onOpenChange, onSuccess, editData, headers }: PedreiraEditModalProps) {
  const { writeSheet, loading: sheetLoading } = useGoogleSheets();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]);
  
  const [formData, setFormData] = useState({
    data: '',
    hora: '',
    ordem: '',
    fornecedor: '',
    prefixo: '',
    descricao: '',
    empresa: '',
    motorista: '',
    placa: '',
    material: '',
    pesoVazio: '',
    pesoFinal: '',
    toneladaTicket: '',
    pesoChegada: '',
    pesoVazioObra: '',
  });

  // Load materials
  useEffect(() => {
    const loadMaterials = async () => {
      const { data: materiaisData } = await supabase
        .from('materiais_pedreira')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      
      if (materiaisData) setMateriais(materiaisData);
    };
    
    if (open) loadMaterials();
  }, [open]);

  // Set form data when editing - preserve all original values
  useEffect(() => {
    if (editData && open) {
      // Parse the date from DD/MM/YYYY to YYYY-MM-DD for the input
      let formattedDate = '';
      if (editData.data) {
        const parts = editData.data.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Format peso values - keep original numbers, format for display
      const formatPeso = (value: number) => {
        if (!value || value === 0) return '';
        return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      };

      // Get tonelada ticket from original row
      const normalize = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '');
      const normalizedHdrs = headers.map(normalize);
      const findIdx = (name: string) => {
        const exact = headers.indexOf(name);
        if (exact !== -1) return exact;
        return normalizedHdrs.indexOf(normalize(name));
      };
      const ttIdx = findIdx('Tonelada (ticket)');
      const ttVal = ttIdx !== -1 && editData.originalRow ? String(editData.originalRow[ttIdx] || '') : '';

      setFormData({
        data: formattedDate,
        hora: editData.hora || '',
        ordem: editData.ordem || '',
        fornecedor: editData.fornecedor || '',
        prefixo: editData.prefixo || '',
        descricao: editData.descricao || '',
        empresa: editData.empresa || '',
        motorista: editData.motorista || '',
        placa: editData.placa || '',
        material: editData.material || '',
        pesoVazio: formatPeso(editData.pesoVazio),
        pesoFinal: formatPeso(editData.pesoFinal),
        toneladaTicket: ttVal,
        pesoChegada: formatPeso(editData.pesoChegada),
        pesoVazioObra: formatPeso(editData.pesoVazioObra || 0),
      });
    }
  }, [editData, open]);

  // Calculate derived values
  const calculateDerivedValues = () => {
    const pesoFinalNum = parseFloat(formData.pesoFinal.replace(/\./g, '').replace(',', '.') || '0');
    const pesoVazioNum = parseFloat(formData.pesoVazio.replace(/\./g, '').replace(',', '.') || '0');
    const pesoChegadaNum = parseFloat(formData.pesoChegada.replace(/\./g, '').replace(',', '.') || '0');
    const pesoVazioObraNum = parseFloat(formData.pesoVazioObra.replace(/\./g, '').replace(',', '.') || '0');
    
    if (isNaN(pesoFinalNum) || isNaN(pesoVazioNum)) {
      return { pesoLiquido: 0, tonelada: 0, metroCubico: 0, toneladaCalcObra: 0 };
    }
    
    const pesoLiquido = pesoFinalNum - pesoVazioNum;
    const tonelada = pesoLiquido / 1000;
    const metroCubico = tonelada / 1.52;
    
    // Tonelada Calc Obra: pesoChegada - (pesoVazioObra se informado, senão pesoVazio)
    const pesoVazioEfetivoObra = (pesoVazioObraNum && pesoVazioObraNum > 0) ? pesoVazioObraNum : pesoVazioNum;
    const toneladaCalcObra = (pesoChegadaNum > 0 && pesoVazioEfetivoObra > 0)
      ? (pesoChegadaNum - pesoVazioEfetivoObra) / 1000
      : tonelada;
    
    return { pesoLiquido, tonelada, metroCubico, toneladaCalcObra };
  };

  const derived = calculateDerivedValues();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;
    
    setLoading(true);

    try {
      // Format date back to DD/MM/YYYY
      const dateParts = formData.data.split('-');
      const dataFormatada = dateParts.length === 3 
        ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
        : editData.data; // Keep original if parsing fails
        
      const normalize = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '');
      const normalizedHdrs = headers.map(normalize);
      const getIdx = (name: string) => {
        const exact = headers.indexOf(name);
        if (exact !== -1) return exact;
        return normalizedHdrs.indexOf(normalize(name));
      };
      
      // Build the row preserving all original data
      const row = editData.originalRow
        ? [...editData.originalRow]
        : new Array(headers.length).fill('');
      
      row[getIdx('Data')] = dataFormatada;
      row[getIdx('Hora')] = formData.hora;
      row[getIdx('Ordem_Carregamento')] = formData.ordem;
      row[getIdx('Fornecedor')] = formData.fornecedor;
      row[getIdx('Prefixo_Eq')] = formData.prefixo;
      row[getIdx('Descricao_Eq')] = formData.descricao;
      row[getIdx('Empresa_Eq')] = formData.empresa;
      row[getIdx('Motorista')] = formData.motorista;
      row[getIdx('Placa')] = formData.placa;
      row[getIdx('Material')] = formData.material;
      row[getIdx('Peso_Vazio')] = formData.pesoVazio.replace(/\./g, '');
      row[getIdx('Peso_Final')] = formData.pesoFinal.replace(/\./g, '');
      row[getIdx('Peso_Liquido_Cubico')] = derived.pesoLiquido.toFixed(0);
      row[getIdx('Metro_Cubico')] = derived.metroCubico.toFixed(2).replace('.', ',');
      row[getIdx('Densidade')] = '1,52';
      row[getIdx('Tonelada')] = derived.tonelada.toFixed(2).replace('.', ',');

      // Write Tonelada Ticket
      const ttIdx = getIdx('Tonelada (ticket)');
      if (ttIdx === -1) {
        const ttIdx2 = getIdx('Tonelada_Ticket');
        if (ttIdx2 !== -1 && formData.toneladaTicket) {
          row[ttIdx2] = formData.toneladaTicket;
        }
      } else if (formData.toneladaTicket) {
        row[ttIdx] = formData.toneladaTicket;
      }

      // Write Tonelada Calc Obra
      const tcoIdx = getIdx('Tonelada (Calc Obra)');
      const tcoIdx2 = tcoIdx !== -1 ? tcoIdx : getIdx('Tonelada_Calc_Obra');
      if (tcoIdx2 !== -1) {
        row[tcoIdx2] = derived.toneladaCalcObra.toFixed(2).replace('.', ',');
      }

      // Write Peso Chegada
      const pcIdx = getIdx('Peso Chegada Obra');
      const pcIdx2 = pcIdx !== -1 ? pcIdx : getIdx('Peso da Chegada');
      if (pcIdx2 !== -1 && formData.pesoChegada) {
        row[pcIdx2] = formData.pesoChegada.replace(/\./g, '');
      }

      // Write Peso Vazio Obra
      const pvoIdx = getIdx('Peso Vazio Obra');
      if (pvoIdx !== -1 && formData.pesoVazioObra) {
        row[pvoIdx] = formData.pesoVazioObra.replace(/\./g, '');
      }

      const success = await writeSheet('Apontamento_Pedreira', buildRowRange(editData.rowIndex, headers.length), [row]);

      if (!success) {
        throw new Error('Erro ao atualizar registro');
      }

      toast({
        title: 'Sucesso!',
        description: 'Registro atualizado com sucesso.',
      });

      onSuccess();
      onOpenChange(false);

    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar registro',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-amber-500" />
            Editar Registro de Pedreira
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Data
              </Label>
              <Input
                type="date"
                value={formData.data}
                onChange={e => setFormData({ ...formData, data: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Hora</Label>
              <Input
                type="time"
                value={formData.hora}
                onChange={e => setFormData({ ...formData, hora: e.target.value })}
              />
            </div>
          </div>

          {/* Ordem e Prefixo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Nº Pedido/OC
              </Label>
              <Input
                value={formData.ordem}
                onChange={e => setFormData({ ...formData, ordem: e.target.value })}
                placeholder="Número do pedido"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Prefixo
              </Label>
              <Input
                value={formData.prefixo}
                onChange={e => setFormData({ ...formData, prefixo: e.target.value })}
                placeholder="Ex: CAM-01"
              />
            </div>
          </div>

          {/* Empresa e Motorista */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Empresa
              </Label>
              <Input
                value={formData.empresa}
                onChange={e => setFormData({ ...formData, empresa: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Motorista
              </Label>
              <Input
                value={formData.motorista}
                onChange={e => setFormData({ ...formData, motorista: e.target.value })}
                placeholder="Nome do motorista"
              />
            </div>
          </div>

          {/* Placa e Descrição */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Placa</Label>
              <Input
                value={formData.placa}
                onChange={e => setFormData({ ...formData, placa: e.target.value })}
                placeholder="Ex: ABC-1234"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição Equipamento</Label>
              <Input
                value={formData.descricao}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do equipamento"
              />
            </div>
          </div>

          {/* Material */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Material
            </Label>
            <Select 
              value={formData.material || undefined} 
              onValueChange={(value) => setFormData({ ...formData, material: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o material" />
              </SelectTrigger>
              <SelectContent>
                {/* Add current material first if not in list */}
                {formData.material && !materiais.find(m => m.nome === formData.material) && (
                  <SelectItem key="current" value={formData.material}>
                    {formData.material}
                  </SelectItem>
                )}
                {materiais.map(mat => (
                  <SelectItem key={mat.id} value={mat.nome}>
                    {mat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tonelada Ticket */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Tonelada Ticket (t)
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              value={formData.toneladaTicket}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                if (raw === '') {
                  setFormData({ ...formData, toneladaTicket: '' });
                  return;
                }
                const num = parseInt(raw, 10);
                const formatted = (num / 100).toFixed(2).replace('.', ',');
                setFormData({ ...formData, toneladaTicket: formatted });
              }}
              placeholder="0,00"
            />
          </div>

          {/* Pesos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Peso Vazio (kg)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={formData.pesoVazio}
                onChange={e => setFormData({ ...formData, pesoVazio: e.target.value })}
                placeholder="Ex: 15000"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Peso Final (kg)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={formData.pesoFinal}
                onChange={e => setFormData({ ...formData, pesoFinal: e.target.value })}
                placeholder="Ex: 45000"
              />
            </div>
          </div>

          {/* Calculated Values */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg space-y-2">
            <p className="font-medium text-sm text-amber-700 dark:text-amber-400">Valores Calculados:</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Peso Líquido:</span>
                <span className="font-bold ml-2">{derived.pesoLiquido.toLocaleString('pt-BR')} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tonelada:</span>
                <span className="font-bold ml-2">{derived.tonelada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</span>
              </div>
              <div>
                <span className="text-muted-foreground">m³:</span>
                <span className="font-bold ml-2">{derived.metroCubico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Original values info */}
          {editData && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <p><strong>Linha:</strong> {editData.rowIndex} | <strong>Data Original:</strong> {editData.data}</p>
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
              disabled={loading || sheetLoading}
              className="flex-1 bg-amber-500 hover:bg-amber-600"
            >
              {loading || sheetLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
