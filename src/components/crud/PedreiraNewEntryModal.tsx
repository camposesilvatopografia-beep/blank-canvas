import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Scale, Truck, Package, Clock, Building2, User, FileText, MapPin, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface MaterialOption { id: string; nome: string; }
interface FornecedorOption { id: string; nome: string; }
interface VehicleOption {
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  placa: string;
}

interface PedreiraNewEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  headers: string[];
}

// Bank-style formatting: digits only, auto decimal
const formatBankInput = (raw: string): string => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const bankToNumber = (raw: string): number => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

const bankToSheetValue = (raw: string): string => {
  const num = bankToNumber(raw);
  return num > 0 ? Math.round(num).toString() : '';
};

export function PedreiraNewEntryModal({ open, onOpenChange, onSuccess, headers }: PedreiraNewEntryModalProps) {
  const { appendSheet, readSheet, loading: sheetLoading } = useGoogleSheets();
  const { toast } = useToast();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleOpen, setVehicleOpen] = useState(false);

  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    hora: format(new Date(), 'HH:mm'),
    ordem: '',
    fornecedor: '',
    prefixo: '',
    descricao: '',
    empresa: '',
    motorista: '',
    placa: '',
    material: '',
    pesoVazio: '',    // digits only (bank style)
    pesoFinal: '',    // digits only
    pesoChegada: '',  // digits only
    local: '',
    apontador: '',
  });

  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      const [{ data: materiaisData }, { data: fornecedoresData }] = await Promise.all([
        supabase.from('materiais_pedreira').select('id, nome').eq('status', 'Ativo').order('nome'),
        supabase.from('fornecedores_pedreira').select('id, nome').eq('status', 'Ativo').order('nome'),
      ]);
      if (materiaisData) setMateriais(materiaisData);
      if (fornecedoresData) setFornecedores(fornecedoresData);

      // Load vehicles from Google Sheets (Basculantes + Reboques)
      try {
        const [camData, rebData] = await Promise.all([
          readSheet('Caminhao'),
          readSheet('Cam_reboque'),
        ]);
        let allVehicles: VehicleOption[] = [];

        if (camData && camData.length > 1) {
          const hdrs = camData[0];
          const getIdx = (n: string) => hdrs.indexOf(n);
          const parsed = camData.slice(1)
            .filter(row => row[getIdx('Prefixo_Cb')])
            .filter(row => {
              const status = row[getIdx('Status')] || 'Mobilizado';
              return status !== 'Desmobilizado';
            })
            .map(row => ({
              prefixo: row[getIdx('Prefixo_Cb')] || '',
              descricao: row[getIdx('Descricao_Cb')] || 'Caminhão Basculante',
              empresa: row[getIdx('Empresa_Cb')] || '',
              motorista: row[getIdx('Motorista')] || '',
              placa: row[getIdx('Placa')] || '',
            }));
          allVehicles = [...allVehicles, ...parsed];
        }

        if (rebData && rebData.length > 1) {
          const hdrs = rebData[0];
          const getIdx = (n: string) => hdrs.indexOf(n);
          const parsed = rebData.slice(1)
            .filter(row => row[getIdx('Prefixo')])
            .filter(row => {
              const status = row[getIdx('Status')] || 'Mobilizado';
              return status !== 'Desmobilizado';
            })
            .map(row => ({
              prefixo: row[getIdx('Prefixo')] || '',
              descricao: row[getIdx('Descricao')] || 'Caminhão Reboque',
              empresa: row[getIdx('Empresa')] || '',
              motorista: row[getIdx('Motorista')] || '',
              placa: row[getIdx('Placa')] || '',
            }));
          allVehicles = [...allVehicles, ...parsed];
        }

        allVehicles.sort((a, b) => a.prefixo.localeCompare(b.prefixo));
        setVehicles(allVehicles);
      } catch (e) {
        console.error('Erro ao carregar veículos:', e);
      }
    };

    loadData();

    setFormData({
      data: format(new Date(), 'yyyy-MM-dd'),
      hora: format(new Date(), 'HH:mm'),
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
      pesoChegada: '',
      local: '',
      apontador: profile?.nome || '',
    });
  }, [open, profile]);

  const handleVehicleSelect = (prefixo: string) => {
    const v = vehicles.find(v => v.prefixo === prefixo);
    if (v) {
      setFormData(prev => ({
        ...prev,
        prefixo: v.prefixo,
        descricao: v.descricao || 'Caminhão Basculante',
        empresa: v.empresa,
        motorista: v.motorista,
        placa: v.placa,
      }));
    }
    setVehicleOpen(false);
  };

  // Calculations using bank-style values
  const pesoFinalNum = bankToNumber(formData.pesoFinal);
  const pesoVazioNum = bankToNumber(formData.pesoVazio);
  const pesoLiquido = pesoFinalNum - pesoVazioNum;
  const tonelada = pesoLiquido / 1000;
  const metroCubico = tonelada / 1.52;
  const toneladaTicket = tonelada;

  const pesoChegadaNum = bankToNumber(formData.pesoChegada);
  const toneladaCalcObra = pesoChegadaNum > 0 && pesoVazioNum > 0
    ? (pesoChegadaNum - pesoVazioNum) / 1000
    : toneladaTicket;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.data || !formData.prefixo || !formData.material || !formData.pesoChegada) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha Data, Veículo, Material e Peso de Chegada.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const [year, month, day] = formData.data.split('-');
      const dataFormatada = `${day}/${month}/${year}`;
      const getIdx = (name: string) => headers.indexOf(name);
      const row = new Array(headers.length).fill('');

      if (getIdx('Data') !== -1) row[getIdx('Data')] = dataFormatada;
      if (getIdx('Hora') !== -1) row[getIdx('Hora')] = formData.hora;
      if (getIdx('Ordem_Carregamento') !== -1) row[getIdx('Ordem_Carregamento')] = formData.ordem;
      if (getIdx('Fornecedor') !== -1) row[getIdx('Fornecedor')] = formData.fornecedor;
      if (getIdx('Prefixo_Eq') !== -1) row[getIdx('Prefixo_Eq')] = formData.prefixo;
      if (getIdx('Descricao_Eq') !== -1) row[getIdx('Descricao_Eq')] = formData.descricao;
      if (getIdx('Empresa_Eq') !== -1) row[getIdx('Empresa_Eq')] = formData.empresa;
      if (getIdx('Motorista') !== -1) row[getIdx('Motorista')] = formData.motorista;
      if (getIdx('Placa') !== -1) row[getIdx('Placa')] = formData.placa;
      if (getIdx('Material') !== -1) row[getIdx('Material')] = formData.material;
      if (getIdx('Peso_Vazio') !== -1) row[getIdx('Peso_Vazio')] = bankToSheetValue(formData.pesoVazio);
      if (getIdx('Peso_Final') !== -1) row[getIdx('Peso_Final')] = bankToSheetValue(formData.pesoFinal);
      if (getIdx('Peso_Liquido_Cubico') !== -1) row[getIdx('Peso_Liquido_Cubico')] = pesoLiquido > 0 ? Math.round(pesoLiquido).toString() : '';
      if (getIdx('Metro_Cubico') !== -1) row[getIdx('Metro_Cubico')] = metroCubico > 0 ? metroCubico.toFixed(2).replace('.', ',') : '';
      if (getIdx('Densidade') !== -1) row[getIdx('Densidade')] = '1,52';
      if (getIdx('Tonelada') !== -1) row[getIdx('Tonelada')] = tonelada > 0 ? tonelada.toFixed(2).replace('.', ',') : '';

      const ticketIdx = getIdx('Tonelada (ticket)') !== -1 ? getIdx('Tonelada (ticket)') : getIdx('Tonelada_Ticket');
      if (ticketIdx !== -1) row[ticketIdx] = toneladaTicket > 0 ? toneladaTicket.toFixed(2).replace('.', ',') : '';

      const calcObraIdx = getIdx('Tonelada (Calc Obra)') !== -1 ? getIdx('Tonelada (Calc Obra)') : getIdx('Tonelada_Calc_Obra');
      if (calcObraIdx !== -1) row[calcObraIdx] = toneladaCalcObra > 0 ? toneladaCalcObra.toFixed(2).replace('.', ',') : '';

      if (formData.pesoChegada) {
        const chegadaIdx = getIdx('Peso Chegada Obra') !== -1 ? getIdx('Peso Chegada Obra') : getIdx('Peso da Chegada');
        if (chegadaIdx !== -1) row[chegadaIdx] = bankToSheetValue(formData.pesoChegada);
      }

      if (formData.local) {
        const localIdx = getIdx('Local') !== -1 ? getIdx('Local') : getIdx('Local_Descarga');
        if (localIdx !== -1) row[localIdx] = formData.local;
      }

      if (formData.apontador) {
        const apontIdx = getIdx('Apontador') !== -1 ? getIdx('Apontador') : getIdx('Nome_Apontador');
        if (apontIdx !== -1) row[apontIdx] = formData.apontador;
      }

      if (getIdx('Status') !== -1) row[getIdx('Status')] = 'Finalizado';
      if (getIdx('Origem') !== -1) row[getIdx('Origem')] = 'Sistema';

      const success = await appendSheet('Apontamento_Pedreira', [row]);
      if (!success) throw new Error('Erro ao salvar registro');

      toast({ title: 'Sucesso!', description: 'Lançamento registrado com sucesso.' });
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao salvar registro', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicle = vehicles.find(v => v.prefixo === formData.prefixo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-500" />
            Novo Lançamento de Pedreira
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Data *
              </Label>
              <Input type="date" value={formData.data} onChange={e => setFormData({ ...formData, data: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input type="time" value={formData.hora} onChange={e => setFormData({ ...formData, hora: e.target.value })} />
            </div>
          </div>

          {/* Ordem e Fornecedor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Nº Pedido/OC
              </Label>
              <Input value={formData.ordem} onChange={e => setFormData({ ...formData, ordem: e.target.value })} placeholder="Número do pedido" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Fornecedor
              </Label>
              <Select value={formData.fornecedor} onValueChange={v => setFormData({ ...formData, fornecedor: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map(f => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Veículo (searchable) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Truck className="w-4 h-4" /> Veículo *
            </Label>
            <Popover open={vehicleOpen} onOpenChange={setVehicleOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={vehicleOpen} className="w-full justify-between font-normal">
                  {formData.prefixo
                    ? `${formData.prefixo}${selectedVehicle ? ` — ${selectedVehicle.descricao}` : ''}`
                    : 'Pesquise ou selecione o veículo...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command className="border rounded-md">
                  <CommandInput placeholder="Buscar por prefixo..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {vehicles.map(v => (
                        <CommandItem
                          key={v.prefixo}
                          value={`${v.prefixo} ${v.descricao} ${v.empresa}`}
                          onSelect={() => handleVehicleSelect(v.prefixo)}
                          className="cursor-pointer"
                        >
                          <Check className={cn("mr-2 h-4 w-4", formData.prefixo === v.prefixo ? "opacity-100" : "opacity-0")} />
                          <span className="font-medium">{v.prefixo}</span>
                          <span className="mx-2 text-muted-foreground">—</span>
                          <span className="text-sm text-muted-foreground truncate">{v.descricao}</span>
                          {v.placa && <span className="ml-auto text-xs text-muted-foreground">{v.placa}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedVehicle && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2 mt-1">
                <span><strong>Descrição:</strong> {selectedVehicle.descricao}</span>
                <span><strong>Empresa:</strong> {selectedVehicle.empresa}</span>
                <span><strong>Motorista:</strong> {selectedVehicle.motorista}</span>
                <span><strong>Placa:</strong> {selectedVehicle.placa}</span>
              </div>
            )}
          </div>

          {/* Material */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Material *
            </Label>
            <Select value={formData.material} onValueChange={v => setFormData({ ...formData, material: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o material" /></SelectTrigger>
              <SelectContent>
                {materiais.map(mat => <SelectItem key={mat.id} value={mat.nome}>{mat.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Pesos - Bank Style */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scale className="w-4 h-4" /> Peso Vazio (kg)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={formatBankInput(formData.pesoVazio)}
                onChange={e => setFormData({ ...formData, pesoVazio: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="Digite apenas números"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scale className="w-4 h-4" /> Peso Final / Carregado (kg)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={formatBankInput(formData.pesoFinal)}
                onChange={e => setFormData({ ...formData, pesoFinal: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="Digite apenas números"
              />
            </div>
          </div>

          {/* Peso Chegada Obra */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Peso Chegada Obra (kg)
            </Label>
            <Input
              type="text"
              inputMode="numeric"
              value={formatBankInput(formData.pesoChegada)}
              onChange={e => setFormData({ ...formData, pesoChegada: e.target.value.replace(/[^0-9]/g, '') })}
              placeholder="Digite apenas números"
            />
          </div>

          {/* Apontador */}
          <div className="space-y-2">
            <Label>Apontador / Responsável</Label>
            <Input
              value={formData.apontador}
              onChange={e => setFormData({ ...formData, apontador: e.target.value })}
              placeholder="Nome do responsável"
            />
          </div>

          {/* Calculated Values */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg space-y-2">
            <p className="font-medium text-sm text-amber-700 dark:text-amber-400">Valores Calculados:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">P. Líquido:</span>
                <span className="font-bold ml-1">{pesoLiquido > 0 ? pesoLiquido.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tonelada:</span>
                <span className="font-bold ml-1">{tonelada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ton. Ticket:</span>
                <span className="font-bold ml-1">{toneladaTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ton. Calc Obra:</span>
                <span className="font-bold ml-1">{toneladaCalcObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || sheetLoading} className="flex-1 bg-amber-500 hover:bg-amber-600">
              {loading || sheetLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />Registrar Lançamento</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
