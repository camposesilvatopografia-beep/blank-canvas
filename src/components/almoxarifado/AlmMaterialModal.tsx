import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSaveMaterial, useAlmMateriais, AlmMaterial } from './useAlmData';

const UNIDADES = ['un', 'kg', 'g', 'm', 'm²', 'm³', 'l', 'pç', 'cx', 'sc', 'rl', 'vb', 'par', 'jg'];
const CATEGORIAS_PADRAO = ['Construção', 'Elétrica', 'Hidráulica', 'Ferramentas', 'EPI', 'Pintura', 'Escritório', 'Outros'];
const CUSTOM_VALUE = '__nova_categoria__';

interface Props {
  open: boolean;
  onClose: () => void;
  material?: AlmMaterial | null;
}

export default function AlmMaterialModal({ open, onClose, material }: Props) {
  const save = useSaveMaterial();
  const { data: materiais = [] } = useAlmMateriais();
  const [form, setForm] = useState({
    codigo: '', nome: '', categoria: '', unidade: 'un', estoque_minimo: '0', observacoes: '', status: 'Ativo',
  });
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [customCat, setCustomCat] = useState('');

  const allCategorias = useMemo(() => {
    const fromDb = materiais.map(m => m.categoria).filter((c): c is string => !!c && c.trim() !== '');
    const merged = new Set([...CATEGORIAS_PADRAO, ...fromDb]);
    return Array.from(merged).sort();
  }, [materiais]);

  const nextCodigo = useMemo(() => {
    const nums = materiais
      .map(m => { const match = m.codigo.match(/^(\d+)$/); return match ? parseInt(match[1], 10) : 0; })
      .filter(n => n > 0);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return String(max + 1).padStart(4, '0');
  }, [materiais]);

  useEffect(() => {
    setShowCustomCat(false);
    setCustomCat('');
    if (material) {
      setForm({
        codigo: material.codigo, nome: material.nome, categoria: material.categoria || '',
        unidade: material.unidade, estoque_minimo: String(material.estoque_minimo),
        observacoes: material.observacoes || '', status: material.status,
      });
    } else {
      setForm({ codigo: nextCodigo, nome: '', categoria: '', unidade: 'un', estoque_minimo: '0', observacoes: '', status: 'Ativo' });
    }
  }, [material, open, nextCodigo]);

  const duplicateCodigo = useMemo(() => {
    if (!form.codigo.trim()) return false;
    return materiais.some(m => m.codigo.toLowerCase() === form.codigo.trim().toLowerCase() && m.id !== material?.id);
  }, [form.codigo, materiais, material]);

  const duplicateNome = useMemo(() => {
    if (!form.nome.trim()) return false;
    return materiais.some(m => m.nome.toLowerCase() === form.nome.trim().toLowerCase() && m.id !== material?.id);
  }, [form.nome, materiais, material]);

  const handleSave = () => {
    if (!form.codigo || !form.nome) return;
    if (duplicateCodigo) { return; }
    if (duplicateNome) { return; }
    save.mutate({
      ...(material?.id ? { id: material.id } : {}),
      codigo: form.codigo.trim(), nome: form.nome.trim(), categoria: form.categoria || null,
      unidade: form.unidade, estoque_minimo: Number(form.estoque_minimo),
      observacoes: form.observacoes || null, status: form.status,
    }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{material ? 'Editar Material' : 'Novo Material'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Código *</Label>
            <Input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className={duplicateCodigo ? 'border-red-500' : ''} />
            {duplicateCodigo && <p className="text-xs text-red-500 mt-1">Já existe um material com este código.</p>}
          </div>
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} className={duplicateNome ? 'border-red-500' : ''} />
            {duplicateNome && <p className="text-xs text-red-500 mt-1">Já existe um material com este nome.</p>}
          </div>
          <div><Label>Categoria</Label>
            {showCustomCat ? (
              <div className="flex gap-2">
                <Input placeholder="Nome da nova categoria" value={customCat} onChange={e => setCustomCat(e.target.value)} autoFocus />
                <Button type="button" size="sm" onClick={() => { if (customCat.trim()) { setForm(p => ({ ...p, categoria: customCat.trim() })); setShowCustomCat(false); } }}>OK</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCustomCat(false)}>Cancelar</Button>
              </div>
            ) : (
              <Select value={form.categoria} onValueChange={v => { if (v === CUSTOM_VALUE) { setShowCustomCat(true); } else { setForm(p => ({ ...p, categoria: v })); } }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {allCategorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value={CUSTOM_VALUE} className="text-primary font-medium">+ Nova Categoria</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div><Label>Unidade</Label>
            <Select value={form.unidade} onValueChange={v => setForm(p => ({ ...p, unidade: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Estoque Mínimo</Label><Input type="number" value={form.estoque_minimo} onChange={e => setForm(p => ({ ...p, estoque_minimo: e.target.value }))} /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
          <Button className="w-full" onClick={handleSave} disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
