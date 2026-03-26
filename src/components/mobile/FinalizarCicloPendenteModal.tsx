import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, CheckCircle2, Scale, Building2, Truck, Usb, RefreshCw } from 'lucide-react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { format } from 'date-fns';

export interface PendingCycle {
  rowIndex: number;
  prefixo: string;
  motorista: string;
  empresa: string;
  status: 'Saiu_Britador' | 'Pesado';
  data: string;
  ordem: string;
  horaSaida: string;
  material: string;
  tonelada: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: PendingCycle | null;
  onSuccess?: () => void;
}

interface MaterialOption {
  id: string;
  nome: string;
}

export function FinalizarCicloPendenteModal({ open, onOpenChange, cycle, onSuccess }: Props) {
  const { readSheet, writeSheet } = useGoogleSheets();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { toast } = useToast();
  

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [materiais, setMateriais] = useState<MaterialOption[]>([]);
  const [foundRow, setFoundRow] = useState<{ row: string[]; headers: string[] } | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  // Balança form (when status === 'Saiu_Britador')
  const [formBalanca, setFormBalanca] = useState({
    horaChegada: format(new Date(), 'HH:mm'),
    numeroPedido: '',
    material: '',
    pesoVazio: '',
    pesoFinal: '',
  });

  // Obra form (when status === 'Pesado')
  const [formObra, setFormObra] = useState({
    horaChegada: format(new Date(), 'HH:mm'),
    material: '',
    numeroPedido: '',
    pesoVazio: '',
    pesoFinal: '',
    observacao: '',
  });

  // Load materiais on mount
  useEffect(() => {
    supabase
      .from('materiais_pedreira')
      .select('id, nome')
      .eq('status', 'Ativo')
      .order('nome')
      .then(({ data }) => { if (data) setMateriais(data); });
  }, []);

  // Load the actual row from the sheet when dialog opens
  useEffect(() => {
    if (!open || !cycle) return;
    setSuccess(false);
    setFoundRow(null);
    setFormBalanca({
      horaChegada: format(new Date(), 'HH:mm'),
      numeroPedido: cycle.ordem || '',
      material: cycle.material || '',
      pesoVazio: '',
      pesoFinal: '',
    });
    setFormObra({
      horaChegada: format(new Date(), 'HH:mm'),
      material: cycle.material || '',
      numeroPedido: cycle.ordem || '',
      pesoVazio: '',
      pesoFinal: '',
      observacao: '',
    });

    const loadRow = async () => {
      setLoadingRecord(true);
      try {
        const data = await readSheet('Apontamento_Pedreira');
        if (!data || data.length < 2) return;
        const headers = data[0];
        // rowIndex from the notification is 1-based (sheet row), data array is 0-based with header at [0]
        const rowArrayIdx = cycle.rowIndex - 1; // convert to 0-based (header is at [0], data starts at [1])
        if (rowArrayIdx >= 0 && rowArrayIdx < data.length) {
          const row = [...data[rowArrayIdx]];
          while (row.length < headers.length) row.push('');
          setFoundRow({ row, headers });
          // Pre-fill data from the record
          const fi = (name: string) => headers.indexOf(name);
          const pvz = data[rowArrayIdx][fi('Peso_Vazio')] || '';
          const pf = data[rowArrayIdx][fi('Peso_Final')] || '';
          const mat = data[rowArrayIdx][fi('Material')] || '';
          const ordem = data[rowArrayIdx][fi('Ordem_Carregamento')] || '';
          if (pvz) setFormBalanca(f => ({ ...f, pesoVazio: pvz }));
          // Pre-fill Obra form with existing record data
          setFormObra(f => ({
            ...f,
            pesoVazio: pvz || f.pesoVazio,
            pesoFinal: pf || f.pesoFinal,
            material: mat || f.material,
            numeroPedido: ordem || f.numeroPedido,
          }));
        }
      } catch (err) {
        console.error('Error loading row for pending cycle:', err);
      } finally {
        setLoadingRecord(false);
      }
    };
    loadRow();
  }, [open, cycle, readSheet]);

  const parseBRNumber = (value: string): number => {
    if (!value) return NaN;
    const cleaned = String(value).trim();
    if (cleaned.includes(',')) return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    return parseFloat(cleaned);
  };

  const formatDecimalBR = (num: number, decimals = 2) =>
    num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const formatBankInput = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const cents = parseInt(digits, 10);
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPesoForSheet = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return value;
    const num = parseInt(digits, 10) / 100;
    if (isNaN(num)) return value;
    return formatDecimalBR(num);
  };

  const parseBankDigits = (raw: string): number => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return NaN;
    return parseInt(digits, 10) / 100;
  };

  const calculateDerived = (pesoFinalRaw: string, pesoVazioRaw: string) => {
    let pesoFinalNum: number, pesoVazioNum: number;
    if (pesoFinalRaw.includes(',') || pesoFinalRaw.includes('.')) pesoFinalNum = parseBRNumber(pesoFinalRaw);
    else pesoFinalNum = parseBankDigits(pesoFinalRaw);
    if (pesoVazioRaw.includes(',') || pesoVazioRaw.includes('.')) pesoVazioNum = parseBRNumber(pesoVazioRaw);
    else pesoVazioNum = parseBankDigits(pesoVazioRaw);
    if (isNaN(pesoFinalNum) || isNaN(pesoVazioNum)) return null;
    const pesoLiquido = pesoFinalNum - pesoVazioNum;
    const tonelada = pesoLiquido / 1000;
    const densidade = 1.52;
    const metroCubico = tonelada / densidade;
    return { pesoLiquido: formatDecimalBR(pesoLiquido), metroCubico: formatDecimalBR(metroCubico), densidade: formatDecimalBR(densidade), tonelada: formatDecimalBR(tonelada) };
  };

  const handleSubmitBalanca = async () => {
    if (!cycle || !foundRow) return;
    if (!formBalanca.material || !formBalanca.pesoFinal) {
      toast({ title: 'Preencha material e peso final', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { headers, row } = foundRow;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...row];

      const effectivePesoVazio = formBalanca.pesoVazio || cycle.material;
      currentRow[fi('Hora')] = formBalanca.horaChegada;
      currentRow[fi('Material')] = formBalanca.material;

      if (formBalanca.numeroPedido) {
        const ordemIdx = fi('Ordem_Carregamento');
        if (ordemIdx !== -1) currentRow[ordemIdx] = formBalanca.numeroPedido;
      }

      if (formBalanca.pesoVazio) {
        currentRow[fi('Peso_Vazio')] = formatPesoForSheet(formBalanca.pesoVazio);
      }
      currentRow[fi('Peso_Final')] = formatPesoForSheet(formBalanca.pesoFinal);

      const derived = calculateDerived(formBalanca.pesoFinal, formBalanca.pesoVazio || '0');
      if (derived) {
        if (fi('Peso_Liquido_Cubico') !== -1) currentRow[fi('Peso_Liquido_Cubico')] = derived.pesoLiquido;
        else if (fi('Peso_Liquido') !== -1) currentRow[fi('Peso_Liquido')] = derived.pesoLiquido;
        if (fi('Metro_Cubico') !== -1) currentRow[fi('Metro_Cubico')] = derived.metroCubico;
        if (fi('Densidade') !== -1) currentRow[fi('Densidade')] = derived.densidade;
        if (fi('Tonelada') !== -1) currentRow[fi('Tonelada')] = derived.tonelada;
        const ttIdx = fi('Tonelada (ticket)');
        if (ttIdx !== -1) currentRow[ttIdx] = derived.tonelada;
      }

      const hcbIdx = fi('Hora_Chegada_Balanca');
      if (hcbIdx !== -1) currentRow[hcbIdx] = formBalanca.horaChegada;
      const hsbIdx = fi('Hora_Saida_Balanca');
      if (hsbIdx !== -1) currentRow[hsbIdx] = format(new Date(), 'HH:mm');

      const userObraIdx = fi('Usuario_Obra');
      if (userObraIdx !== -1) currentRow[userObraIdx] = effectiveName;

      const statusIdx = fi('Status');
      if (statusIdx !== -1) currentRow[statusIdx] = 'Pesado';

      const rowNum = cycle.rowIndex;
      const ok = await writeSheet('Apontamento_Pedreira', buildRowRange(rowNum, currentRow.length), [currentRow]);
      if (!ok) throw new Error('Erro ao salvar');

      setSuccess(true);
      toast({ title: '✅ Pesagem registrada com sucesso!' });
      // Signal other tabs/windows (desktop) to refresh their data
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitObra = async () => {
    if (!cycle || !foundRow) return;
    setLoading(true);
    try {
      const { headers, row } = foundRow;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...row];

      const horaObraIdx = fi('Hora_Chegada_Obra');
      if (horaObraIdx !== -1) currentRow[horaObraIdx] = formObra.horaChegada;
      else currentRow[5] = formObra.horaChegada;

      // Save material if provided
      if (formObra.material) {
        const matIdx = fi('Material');
        if (matIdx !== -1) currentRow[matIdx] = formObra.material;
      }

      // Save ordem/pedido if provided
      if (formObra.numeroPedido) {
        const ordemIdx = fi('Ordem_Carregamento');
        if (ordemIdx !== -1) currentRow[ordemIdx] = formObra.numeroPedido;
      }

      // Save weights if provided
      if (formObra.pesoVazio) {
        const pvIdx = fi('Peso_Vazio');
        if (pvIdx !== -1) currentRow[pvIdx] = formatPesoForSheet(formObra.pesoVazio);
      }
      if (formObra.pesoFinal) {
        const pfIdx = fi('Peso_Final');
        if (pfIdx !== -1) currentRow[pfIdx] = formatPesoForSheet(formObra.pesoFinal);
      }

      // Calculate derived values if both weights provided
      if (formObra.pesoFinal && formObra.pesoVazio) {
        const derived = calculateDerived(formObra.pesoFinal, formObra.pesoVazio);
        if (derived) {
          if (fi('Peso_Liquido_Cubico') !== -1) currentRow[fi('Peso_Liquido_Cubico')] = derived.pesoLiquido;
          else if (fi('Peso_Liquido') !== -1) currentRow[fi('Peso_Liquido')] = derived.pesoLiquido;
          if (fi('Metro_Cubico') !== -1) currentRow[fi('Metro_Cubico')] = derived.metroCubico;
          if (fi('Densidade') !== -1) currentRow[fi('Densidade')] = derived.densidade;
          if (fi('Tonelada') !== -1) currentRow[fi('Tonelada')] = derived.tonelada;
        }
      }

      // Save observacao if provided
      if (formObra.observacao) {
        const obsIdx = fi('Observacao');
        if (obsIdx !== -1) currentRow[obsIdx] = formObra.observacao;
      }

      // Fill Tonelada (ticket) if not already set
      const ttIdxObra = fi('Tonelada (ticket)');
      if (ttIdxObra !== -1 && !currentRow[ttIdxObra]) {
        const tonVal = currentRow[fi('Tonelada')] || '';
        if (tonVal) currentRow[ttIdxObra] = tonVal;
      }

      // Calculate and fill Tonelada (Calc Obra)
      const tcIdxObra = fi('Tonelada (Calc Obra)');
      if (tcIdxObra !== -1) {
        // Try to calculate from Peso Chegada Obra and Peso Vazio
        let pesoChegadaVal = '';
        let pcIdx = fi('Peso Chegada Obra');
        if (pcIdx === -1) pcIdx = fi('Peso da Chegada');
        if (pcIdx === -1) pcIdx = fi('Peso_Chegada_Obra');
        if (pcIdx !== -1) pesoChegadaVal = currentRow[pcIdx] || '';

        const pvVal = currentRow[fi('Peso_Vazio')] || '';
        if (pesoChegadaVal && pvVal) {
          const pcNum = parseBRNumber(pesoChegadaVal);
          const pvNum = parseBRNumber(pvVal);
          if (!isNaN(pcNum) && !isNaN(pvNum) && pcNum > 0 && pvNum > 0) {
            const tonCalcObra = (pcNum - pvNum) / 1000;
            currentRow[tcIdxObra] = formatDecimalBR(tonCalcObra);
          }
        }
        // Fallback: use Tonelada value if Calc Obra still empty
        if (!currentRow[tcIdxObra]) {
          const tonFallback = currentRow[fi('Tonelada (ticket)')] || currentRow[fi('Tonelada')] || '';
          if (tonFallback) currentRow[tcIdxObra] = tonFallback;
        }
      }

      const userObraIdx = fi('Usuario_Obra');
      if (userObraIdx !== -1) currentRow[userObraIdx] = effectiveName;

      const statusIdx = fi('Status');
      if (statusIdx !== -1) currentRow[statusIdx] = 'Finalizado';
      else currentRow[22] = 'Finalizado';

      const rowNum = cycle.rowIndex;
      const ok = await writeSheet('Apontamento_Pedreira', buildRowRange(rowNum, currentRow.length), [currentRow]);
      if (!ok) throw new Error('Erro ao salvar');

      setSuccess(true);
      toast({ title: '✅ Chegada na obra confirmada!' });
      // Signal other tabs/windows (desktop) to refresh their data
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isBalanca = cycle?.status === 'Saiu_Britador';

  const isFromPreviousDay = cycle ? (() => {
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    return cycle.data !== todayStr;
  })() : false;

  if (!cycle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBalanca
              ? <><Scale className="w-5 h-5 text-amber-500" /> Registrar Pesagem na Balança</>
              : <><Building2 className="w-5 h-5 text-blue-500" /> Confirmar Chegada na Obra</>
            }
          </DialogTitle>
        </DialogHeader>

        {/* Pending cycle banner */}
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${isFromPreviousDay ? 'bg-red-50 border border-red-300' : 'bg-orange-50 border border-orange-200'}`}>
          <AlertTriangle className={`w-4 h-4 shrink-0 ${isFromPreviousDay ? 'text-red-500' : 'text-orange-500'}`} />
          <span className={isFromPreviousDay ? 'text-red-700' : 'text-orange-700'}>
            Ciclo pendente do dia <strong>{cycle.data}</strong>
            {isFromPreviousDay && <span className="ml-1 font-bold">(dia anterior — informe a hora correta)</span>}
          </span>
        </div>

        {/* Cycle info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-muted-foreground text-xs mb-1">Veículo</div>
            <div className="font-semibold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary" />
              {cycle.prefixo}
            </div>
            {cycle.motorista && <div className="text-muted-foreground text-xs mt-0.5">{cycle.motorista}</div>}
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-muted-foreground text-xs mb-1">Status Atual</div>
            <Badge className={`text-xs ${isBalanca ? 'bg-amber-500' : 'bg-blue-500'} text-white border-0`}>
              {isBalanca ? '🏗️ Aguard. Balança' : '⚖️ Aguard. Obra'}
            </Badge>
          </div>
          {cycle.empresa && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-muted-foreground text-xs mb-1">Empresa</div>
              <div className="font-medium">{cycle.empresa}</div>
            </div>
          )}
          {cycle.ordem && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-muted-foreground text-xs mb-1">OS/Ordem</div>
              <div className="font-medium">{cycle.ordem}</div>
            </div>
          )}
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="font-semibold text-lg">
              {isBalanca ? 'Pesagem registrada!' : 'Chegada confirmada!'}
            </p>
            <Button onClick={() => { setSuccess(false); onOpenChange(false); }}>Fechar</Button>
          </div>
        ) : loadingRecord ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando registro...</span>
          </div>
        ) : isBalanca ? (
          /* ── BALANÇA FORM ── */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Hora de Chegada</Label>
                <Input
                  type="time"
                  value={formBalanca.horaChegada}
                  onChange={e => setFormBalanca(f => ({ ...f, horaChegada: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Nº Pedido / OS</Label>
                <Input
                  placeholder="Opcional"
                  value={formBalanca.numeroPedido}
                  onChange={e => setFormBalanca(f => ({ ...f, numeroPedido: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Material <span className="text-destructive">*</span></Label>
              <Select value={formBalanca.material} onValueChange={v => setFormBalanca(f => ({ ...f, material: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {materiais.map(m => (
                    <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Peso Vazio (kg)</Label>
                <div className="flex gap-1">
                  <Input
                    placeholder="0,00"
                    value={formBalanca.pesoVazio}
                    onChange={e => setFormBalanca(f => ({ ...f, pesoVazio: formatBankInput(e.target.value) }))}
                    inputMode="numeric"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Peso Final (kg) <span className="text-destructive">*</span></Label>
                <div className="flex gap-1">
                  <Input
                    placeholder="0,00"
                    value={formBalanca.pesoFinal}
                    onChange={e => setFormBalanca(f => ({ ...f, pesoFinal: formatBankInput(e.target.value) }))}
                    inputMode="numeric"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {formBalanca.pesoFinal && formBalanca.pesoVazio && (() => {
              const derived = calculateDerived(formBalanca.pesoFinal, formBalanca.pesoVazio);
              if (!derived) return null;
              return (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Peso Líq.:</span> <strong>{derived.pesoLiquido} kg</strong></div>
                    <div><span className="text-muted-foreground">Tonelada:</span> <strong>{derived.tonelada} t</strong></div>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
              <Button onClick={handleSubmitBalanca} disabled={loading || !formBalanca.material || !formBalanca.pesoFinal}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scale className="w-4 h-4 mr-2" />}
                Registrar Pesagem
              </Button>
            </div>
          </div>
        ) : (
          /* ── OBRA FORM ── */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Hora de Chegada na Obra</Label>
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={formObra.horaChegada}
                    onChange={e => setFormObra(f => ({ ...f, horaChegada: e.target.value }))}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormObra(f => ({ ...f, horaChegada: format(new Date(), 'HH:mm') }))}>
                    Agora
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nº Pedido / OS</Label>
                <Input
                  placeholder="Opcional"
                  value={formObra.numeroPedido}
                  onChange={e => setFormObra(f => ({ ...f, numeroPedido: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Material</Label>
              <Select value={formObra.material} onValueChange={v => setFormObra(f => ({ ...f, material: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {materiais.map(m => (
                    <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Peso Vazio (kg)</Label>
                <Input
                  placeholder="0,00"
                  value={formObra.pesoVazio}
                  onChange={e => setFormObra(f => ({ ...f, pesoVazio: formatBankInput(e.target.value) }))}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <Label>Peso Final (kg)</Label>
                <Input
                  placeholder="0,00"
                  value={formObra.pesoFinal}
                  onChange={e => setFormObra(f => ({ ...f, pesoFinal: formatBankInput(e.target.value) }))}
                  inputMode="numeric"
                />
              </div>
            </div>

            {formObra.pesoFinal && formObra.pesoVazio && (() => {
              const derived = calculateDerived(formObra.pesoFinal, formObra.pesoVazio);
              if (!derived) return null;
              return (
                <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Peso Líq.:</span> <strong>{derived.pesoLiquido} kg</strong></div>
                    <div><span className="text-muted-foreground">Tonelada:</span> <strong>{derived.tonelada} t</strong></div>
                  </div>
                </div>
              );
            })()}

            {/* Show existing data from the record if available */}
            {(cycle.material || cycle.tonelada) && !formObra.material && !formObra.pesoFinal && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm grid grid-cols-2 gap-2">
                {cycle.material && <div><span className="text-muted-foreground">Material atual:</span> <strong>{cycle.material}</strong></div>}
                {cycle.tonelada && <div><span className="text-muted-foreground">Tonelada:</span> <strong>{cycle.tonelada} t</strong></div>}
              </div>
            )}

            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea
                placeholder="Opcional"
                value={formObra.observacao}
                onChange={e => setFormObra(f => ({ ...f, observacao: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
              <Button onClick={handleSubmitObra} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
                Confirmar Chegada
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
