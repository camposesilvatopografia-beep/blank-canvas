import { useState, useEffect } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mountain, Scale, Truck, Package, Clock, Building2, User, FileText, MapPin, ImageIcon, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizePhotoUrl } from '@/utils/photoUrl';

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
  fotoChegada?: string;
  fotoPesagem?: string;
  fotoVazio?: string;
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
      const formatPeso = (value: any) => {
        if (value === undefined || value === null || value === '' || value === 0) return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
        if (isNaN(num)) return '';
        return num.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      };

      // Helper to find column index by name
      const normalize = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '');
      const normalizedHdrs = headers.map(normalize);
      const findIdx = (name: string) => {
        const exact = headers.indexOf(name);
        if (exact !== -1) return exact;
        return normalizedHdrs.indexOf(normalize(name));
      };

      // Get values from original row if possible
      const getRowVal = (name: string) => {
        const idx = findIdx(name);
        return idx !== -1 && editData.originalRow ? String(editData.originalRow[idx] || '') : '';
      };

      const ttVal = getRowVal('Tonelada (ticket)') || getRowVal('Tonelada_Ticket');
      
      const pcValRaw = getRowVal('Peso Chegada Obra') || getRowVal('Peso da Chegada');
      const pcVal = pcValRaw ? parseFloat(pcValRaw.replace(/\./g, '').replace(',', '.')) : 0;
      
      const pvoValRaw = getRowVal('Peso Vazio Obra');
      const pvoVal = pvoValRaw ? parseFloat(pvoValRaw.replace(/\./g, '').replace(',', '.')) : 0;

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
        pesoChegada: formatPeso(pcVal || editData.pesoChegada || 0),
        pesoVazioObra: formatPeso(pvoVal || editData.pesoVazioObra || 0),
      });
    }
  }, [editData, open, headers]);

  // Calculate derived values
  const calculateDerivedValues = () => {
    const parse = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.') || '0');
    const pesoFinalNum = parse(formData.pesoFinal);
    const pesoVazioNum = parse(formData.pesoVazio);
    const pesoChegadaNum = parse(formData.pesoChegada);
    const pesoVazioObraNum = parse(formData.pesoVazioObra);
    
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
    
    if (!formData.pesoChegada) {
      toast({ title: 'Peso de Chegada Ausente', description: 'Por favor, informe o Peso de Chegada para garantir os cálculos corretos.', variant: 'destructive' });
      // We don't block edit for now, but we warn. 
      // Actually, user wants to "garanta que isso nao ira mais acontecer". 
      // So I'll block it.
      setLoading(false);
      return;
    }
    
    setLoading(true);

    try {
      // Format date back to DD/MM/YYYY
      const dateParts = formData.data.split('-');
      const dataFormatada = dateParts.length === 3 
        ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
        : editData.data;
        
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
      
      const setCol = (name: string, val: string) => {
        const idx = getIdx(name);
        if (idx !== -1) row[idx] = val;
      };

      setCol('Data', dataFormatada);
      setCol('Hora', formData.hora);
      setCol('Ordem_Carregamento', formData.ordem);
      setCol('Fornecedor', formData.fornecedor);
      setCol('Prefixo_Eq', formData.prefixo);
      setCol('Descricao_Eq', formData.descricao);
      setCol('Empresa_Eq', formData.empresa);
      setCol('Motorista', formData.motorista);
      setCol('Placa', formData.placa);
      setCol('Material', formData.material);
      setCol('Peso_Vazio', formData.pesoVazio.replace(/\./g, ''));
      setCol('Peso_Final', formData.pesoFinal.replace(/\./g, ''));
      setCol('Peso_Liquido_Cubico', derived.pesoLiquido.toFixed(0));
      setCol('Metro_Cubico', derived.metroCubico.toFixed(2).replace('.', ','));
      setCol('Densidade', '1,52');
      setCol('Tonelada', derived.tonelada.toFixed(2).replace('.', ','));

      // Write Tonelada Ticket
      const ttIdx = getIdx('Tonelada (ticket)') !== -1 ? getIdx('Tonelada (ticket)') : getIdx('Tonelada_Ticket');
      if (ttIdx !== -1 && formData.toneladaTicket) {
        row[ttIdx] = formData.toneladaTicket;
      }

      // Write Tonelada Calc Obra
      const tcoIdx = getIdx('Tonelada (Calc Obra)') !== -1 ? getIdx('Tonelada (Calc Obra)') : getIdx('Tonelada_Calc_Obra');
      if (tcoIdx !== -1) {
        row[tcoIdx] = derived.toneladaCalcObra.toFixed(2).replace('.', ',');
      }

      // Write Peso Chegada
      const pcIdx = getIdx('Peso Chegada Obra') !== -1 ? getIdx('Peso Chegada Obra') : getIdx('Peso da Chegada');
      if (pcIdx !== -1 && formData.pesoChegada) {
        row[pcIdx] = formData.pesoChegada.replace(/\./g, '');
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Data
              </Label>
              <Input type="date" value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input type="time" value={formData.hora} onChange={e => setFormData({ ...formData, hora: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Nº Pedido/OC
              </Label>
              <Input value={formData.ordem} onChange={e => setFormData({ ...formData, ordem: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" /> Prefixo
              </Label>
              <Input value={formData.prefixo} onChange={e => setFormData({ ...formData, prefixo: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Empresa
              </Label>
              <Input value={formData.empresa} onChange={e => setFormData({ ...formData, empresa: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" /> Motorista
              </Label>
              <Input value={formData.motorista} onChange={e => setFormData({ ...formData, motorista: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Placa</Label>
              <Input value={formData.placa} onChange={e => setFormData({ ...formData, placa: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição Equipamento</Label>
              <Input value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Package className="w-4 h-4" /> Material</Label>
            <Select value={formData.material || undefined} onValueChange={(v) => setFormData({ ...formData, material: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o material" /></SelectTrigger>
              <SelectContent>
                {formData.material && !materiais.find(m => m.nome === formData.material) && (
                  <SelectItem key="current" value={formData.material}>{formData.material}</SelectItem>
                )}
                {materiais.map(mat => <SelectItem key={mat.id} value={mat.nome}>{mat.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Scale className="w-4 h-4" /> Tonelada Ticket (t)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={formData.toneladaTicket}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                if (raw === '') { setFormData({ ...formData, toneladaTicket: '' }); return; }
                const formatted = (parseInt(raw, 10) / 100).toFixed(2).replace('.', ',');
                setFormData({ ...formData, toneladaTicket: formatted });
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Scale className="w-4 h-4" /> Peso Vazio (kg)</Label>
              <Input value={formData.pesoVazio} onChange={e => setFormData({ ...formData, pesoVazio: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Scale className="w-4 h-4" /> Peso Final (kg)</Label>
              <Input value={formData.pesoFinal} onChange={e => setFormData({ ...formData, pesoFinal: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Peso Chegada Obra (kg)</Label>
              <Input value={formData.pesoChegada} onChange={e => setFormData({ ...formData, pesoChegada: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Peso Vazio Saída Obra (kg)</Label>
              <Input value={formData.pesoVazioObra} onChange={e => setFormData({ ...formData, pesoVazioObra: e.target.value })} />
            </div>
          </div>

          <div className="p-4 bg-primary/10 rounded-lg space-y-2">
            <p className="font-medium text-sm text-primary">Valores Calculados:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Peso Líq. Origem:</span>
                <p className="font-bold">{derived.pesoLiquido.toLocaleString('pt-BR')} kg</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ton. Origem:</span>
                <p className="font-bold">{derived.tonelada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</p>
              </div>
              <div>
                <span className="text-muted-foreground text-blue-600 font-semibold">Ton. Calc Obra:</span>
                <p className="font-bold text-blue-600">{derived.toneladaCalcObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</p>
              </div>
              <div>
                <span className="text-muted-foreground">Volume (m³):</span>
                <p className="font-bold">{derived.metroCubico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={loading || sheetLoading} className="flex-1 bg-amber-500 hover:bg-amber-600">
              {loading || sheetLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
