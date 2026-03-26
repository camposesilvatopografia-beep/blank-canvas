import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlmMateriais, useUpdateMovimentacao, AlmMovimentacao, useAlmFornecedores, useAlmLocaisUso, useAlmSetores } from './useAlmData';

interface Props {
  open: boolean;
  onClose: () => void;
  movimentacao: AlmMovimentacao | null;
}

export default function AlmEditMovModal({ open, onClose, movimentacao }: Props) {
  const { data: materiais = [] } = useAlmMateriais();
  const { data: fornecedores = [] } = useAlmFornecedores();
  const { data: locaisUso = [] } = useAlmLocaisUso();
  const { data: setores = [] } = useAlmSetores();
  const update = useUpdateMovimentacao();
  const ativos = materiais.filter(m => m.status === 'Ativo');
  const [matOpen, setMatOpen] = useState(false);

  const [form, setForm] = useState({
    data: '', material_id: '', quantidade: '', fornecedor: '', nota_fiscal: '',
    responsavel: '', observacoes: '', equipe: '', local_uso: '', preco_unitario: '', preco_total: '',
  });

  useEffect(() => {
    if (movimentacao) {
      setForm({
        data: movimentacao.data,
        material_id: movimentacao.material_id,
        quantidade: String(movimentacao.quantidade),
        fornecedor: movimentacao.fornecedor || '',
        nota_fiscal: movimentacao.nota_fiscal || '',
        responsavel: movimentacao.responsavel || '',
        observacoes: movimentacao.observacoes || '',
        equipe: movimentacao.equipe || '',
        local_uso: movimentacao.local_uso || '',
        preco_unitario: String((movimentacao as any).preco_unitario || 0),
        preco_total: String((movimentacao as any).preco_total || 0),
      });
    }
  }, [movimentacao]);

  const selectedMat = ativos.find(m => m.id === form.material_id);
  const isEntrada = movimentacao?.tipo === 'entrada';

  const handleSave = () => {
    if (!movimentacao || !form.material_id || !form.quantidade) return;
    update.mutate({
      id: movimentacao.id,
      data: form.data,
      material_id: form.material_id,
      quantidade: Number(form.quantidade),
      fornecedor: form.fornecedor || null,
      nota_fiscal: form.nota_fiscal || null,
      responsavel: form.responsavel || null,
      observacoes: form.observacoes || null,
      equipe: form.equipe || null,
      local_uso: form.local_uso || null,
      preco_unitario: Number(form.preco_unitario) || 0,
      preco_total: Number(form.preco_total) || 0,
      foto_path: movimentacao.foto_path,
      numero_requisicao: movimentacao.numero_requisicao,
      etapa_obra: movimentacao.etapa_obra,
      local_armazenamento: movimentacao.local_armazenamento,
      nf_foto_path: (movimentacao as any).nf_foto_path,
    } as any, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {isEntrada ? 'Entrada' : 'Saída'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Data *</Label>
            <Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
          </div>
          <div>
            <Label>Material *</Label>
            <Popover open={matOpen} onOpenChange={setMatOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {selectedMat ? `${selectedMat.codigo} - ${selectedMat.nome}` : 'Selecione'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar..." />
                  <CommandList>
                    <CommandEmpty>Nenhum material.</CommandEmpty>
                    <CommandGroup>
                      {ativos.map(m => (
                        <CommandItem key={m.id} value={`${m.codigo} ${m.nome}`} onSelect={() => { setForm(p => ({ ...p, material_id: m.id })); setMatOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", form.material_id === m.id ? "opacity-100" : "opacity-0")} />
                          {m.codigo} - {m.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Quantidade *</Label>
            <Input type="number" step="0.01" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} />
          </div>
          {isEntrada ? (
            <>
              <div>
                <Label>Fornecedor</Label>
                <Input list="edit-forn-list" value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} />
                <datalist id="edit-forn-list">{fornecedores.map(f => <option key={f} value={f} />)}</datalist>
              </div>
              <div>
                <Label>Nota Fiscal</Label>
                <Input value={form.nota_fiscal} onChange={e => setForm(p => ({ ...p, nota_fiscal: e.target.value }))} />
              </div>
              <div>
                <Label>Preço Unitário</Label>
                <Input type="number" step="0.01" value={form.preco_unitario} onChange={e => setForm(p => ({ ...p, preco_unitario: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Local de Uso</Label>
                <Input list="edit-local-list" value={form.local_uso} onChange={e => setForm(p => ({ ...p, local_uso: e.target.value }))} />
                <datalist id="edit-local-list">{locaisUso.map(l => <option key={l} value={l} />)}</datalist>
              </div>
              <div>
                <Label>Setor</Label>
                <Input list="edit-setor-list" value={form.equipe} onChange={e => setForm(p => ({ ...p, equipe: e.target.value }))} />
                <datalist id="edit-setor-list">{setores.map(s => <option key={s} value={s} />)}</datalist>
              </div>
            </>
          )}
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
          </div>
          <Button className="w-full" onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
