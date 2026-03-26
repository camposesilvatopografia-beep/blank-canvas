import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlmMateriais, useSaveMovimentacao, AlmMovimentacao, useAlmLocaisUso, useAlmSetores } from './useAlmData';
import { format } from 'date-fns';
import AlmMaterialModal from './AlmMaterialModal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (mov: Partial<AlmMovimentacao> & { materialNome?: string; materialUnidade?: string }) => void;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function AlmSaidaModal({ open, onClose, onSuccess }: Props) {
  const { data: materiais = [] } = useAlmMateriais();
  const { data: locaisUso = [] } = useAlmLocaisUso();
  const { data: setores = [] } = useAlmSetores();
  const save = useSaveMovimentacao();
  const ativos = materiais.filter(m => m.status === 'Ativo');
  const [matOpen, setMatOpen] = useState(false);
  const [showNewMat, setShowNewMat] = useState(false);
  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'), material_id: '', quantidade: '',
    equipe: '', local_uso: '', responsavel: '', observacoes: '',
  });

  const [lastSaida, setLastSaida] = useState<any>(null);
  const [askPrint, setAskPrint] = useState(false);

  const qtyRef = useRef<HTMLInputElement>(null);
  const localRef = useRef<HTMLInputElement>(null);
  const setorRef = useRef<HTMLInputElement>(null);
  const respRef = useRef<HTMLInputElement>(null);
  const obsRef = useRef<HTMLTextAreaElement>(null);

  const selectedMat = ativos.find(m => m.id === form.material_id);

  const locaisNorm = useMemo(() => {
    const arr = locaisUso.map(l => normalizeName(l));
    return Array.from(new Set(arr)).sort();
  }, [locaisUso]);

  const setoresNorm = useMemo(() => {
    const arr = setores.map(s => normalizeName(s));
    return Array.from(new Set(arr)).sort();
  }, [setores]);

  const handleSave = () => {
    if (!form.material_id || !form.quantidade) return;
    const reqNum = `REQ-${Date.now().toString(36).toUpperCase()}`;
    const movData: Partial<AlmMovimentacao> = {
      tipo: 'saida', data: form.data, material_id: form.material_id,
      quantidade: Number(form.quantidade),
      equipe: form.equipe.trim() ? normalizeName(form.equipe) : null,
      local_uso: form.local_uso.trim() ? normalizeName(form.local_uso) : null,
      responsavel: form.responsavel || null, observacoes: form.observacoes || null,
      numero_requisicao: reqNum,
    };
    save.mutate(movData, {
      onSuccess: () => {
        const successData = { ...movData, materialNome: selectedMat?.nome, materialUnidade: selectedMat?.unidade };
        setForm({ data: format(new Date(), 'yyyy-MM-dd'), material_id: '', quantidade: '', equipe: '', local_uso: '', responsavel: '', observacoes: '' });
        setLastSaida(successData);
        setAskPrint(true);
        onClose();
      },
    });
  };

  const handleSelectMaterial = (id: string) => {
    setForm(p => ({ ...p, material_id: id }));
    setMatOpen(false);
    setTimeout(() => qtyRef.current?.focus(), 100);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Saída de Estoque</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => {
                setForm(p => ({ ...p, data: e.target.value }));
                if (e.target.value) setTimeout(() => setMatOpen(true), 100);
              }} />
            </div>
            <div>
              <Label>Material *</Label>
              <Popover open={matOpen} onOpenChange={setMatOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={matOpen} className="w-full justify-between font-normal">
                    {selectedMat ? `${selectedMat.codigo} - ${selectedMat.nome} (saldo: ${selectedMat.estoque_atual})` : 'Selecione o material'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar material..." />
                    <CommandList>
                      <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
                      <CommandGroup>
                        {ativos.map(m => (
                          <CommandItem key={m.id} value={`${m.codigo} ${m.nome}`} onSelect={() => handleSelectMaterial(m.id)}>
                            <Check className={cn("mr-2 h-4 w-4", form.material_id === m.id ? "opacity-100" : "opacity-0")} />
                            {m.codigo} - {m.nome} (saldo: {m.estoque_atual})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setMatOpen(false); setShowNewMat(true); }} className="text-primary font-medium">
                          <Plus className="mr-2 h-4 w-4" /> Cadastrar novo material
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {selectedMat && <p className="text-xs text-muted-foreground">Saldo disponível: <strong>{selectedMat.estoque_atual} {selectedMat.unidade}</strong></p>}
            <div>
              <Label>Quantidade *</Label>
              <Input ref={qtyRef} type="number" step="0.01" value={form.quantidade}
                onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && form.quantidade) { e.preventDefault(); localRef.current?.focus(); } }}
              />
            </div>
            <div>
              <Label>Local de Uso</Label>
              <Input
                ref={localRef}
                list="alm-locais-uso-list"
                value={form.local_uso}
                onChange={e => setForm(p => ({ ...p, local_uso: e.target.value }))}
                onBlur={e => { if (e.target.value.trim()) setForm(p => ({ ...p, local_uso: normalizeName(e.target.value) })); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setorRef.current?.focus(); } }}
                placeholder="Digite ou selecione (cadastra automaticamente)"
              />
              <datalist id="alm-locais-uso-list">{locaisNorm.map(l => <option key={l} value={l} />)}</datalist>
            </div>
            <div>
              <Label>Setor</Label>
              <Input
                ref={setorRef}
                list="alm-setores-list"
                value={form.equipe}
                onChange={e => setForm(p => ({ ...p, equipe: e.target.value }))}
                onBlur={e => { if (e.target.value.trim()) setForm(p => ({ ...p, equipe: normalizeName(e.target.value) })); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); respRef.current?.focus(); } }}
                placeholder="Digite ou selecione (cadastra automaticamente)"
              />
              <datalist id="alm-setores-list">{setoresNorm.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div>
              <Label>Responsável pela Retirada</Label>
              <Input ref={respRef} value={form.responsavel}
                onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); obsRef.current?.focus(); } }}
              />
            </div>
            <div><Label>Observações</Label><Textarea ref={obsRef} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSave} disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Registrar Saída'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={askPrint} onOpenChange={v => { if (!v) setAskPrint(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Printer className="w-5 h-5" /> Saída registrada!</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja imprimir a requisição de material?</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAskPrint(false)}>Não</Button>
            <Button onClick={() => { setAskPrint(false); onSuccess?.(lastSaida); }}>
              <Printer className="w-4 h-4 mr-1" /> Sim, Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlmMaterialModal open={showNewMat} onClose={() => setShowNewMat(false)} />
    </>
  );
}
