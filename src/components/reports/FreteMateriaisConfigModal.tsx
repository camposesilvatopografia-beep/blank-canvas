import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Save, Loader2, Plus, Trash2 } from 'lucide-react';

const FRETE_KEY_SEPARATOR = '|||';

const normalizeToken = (value: string) => value.trim().toLowerCase();

const buildStorageMaterialKey = (material: string, fornecedor?: string) => {
  const materialValue = material.trim();
  const fornecedorValue = (fornecedor || '').trim();
  return fornecedorValue ? `${materialValue}${FRETE_KEY_SEPARATOR}${fornecedorValue}` : materialValue;
};

const parseStorageMaterialKey = (storedMaterial: string) => {
  const value = (storedMaterial || '').trim();
  const separatorIndex = value.indexOf(FRETE_KEY_SEPARATOR);
  if (separatorIndex === -1) {
    return { material: value, fornecedor: '' };
  }

  return {
    material: value.slice(0, separatorIndex).trim(),
    fornecedor: value.slice(separatorIndex + FRETE_KEY_SEPARATOR.length).trim(),
  };
};

const buildLookupKey = (material: string, fornecedor?: string) => {
  const materialToken = normalizeToken(material);
  const fornecedorToken = normalizeToken(fornecedor || '');
  return `${materialToken}${FRETE_KEY_SEPARATOR}${fornecedorToken}`;
};

export interface FreteMateriaisConfig {
  material: string;
  preco_frete: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableMaterials: string[];
  availableSuppliers?: string[];
  onSaved?: () => void;
}

export function useFreteMateriaisConfig() {
  const [config, setConfig] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pedreira_frete_materiais' as any).select('material, preco_frete');
    const map = new Map<string, number>();
    (data || []).forEach((r: any) => {
      const parsed = parseStorageMaterialKey(r.material || '');
      map.set(buildLookupKey(parsed.material, parsed.fornecedor), Number(r.preco_frete) || 0);
    });
    setConfig(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getFreteForMaterial = useCallback((material: string, fornecedor?: string): number => {
    const specificKey = buildLookupKey(material, fornecedor);
    if (fornecedor && config.has(specificKey)) {
      return config.get(specificKey) || 0;
    }

    const genericKey = buildLookupKey(material, '');
    return config.get(genericKey) || 0;
  }, [config]);

  return { config, loading, reload: load, getFreteForMaterial };
}

export function FreteMateriaisConfigModal({ open, onOpenChange, availableMaterials, availableSuppliers = [], onSaved }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<{ material: string; fornecedor: string; preco_frete: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [newMaterial, setNewMaterial] = useState('');
  const [newFornecedor, setNewFornecedor] = useState('');

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    const { data } = await supabase.from('pedreira_frete_materiais' as any).select('*').order('material');
    const existing = (data || []).map((r: any) => {
      const parsed = parseStorageMaterialKey(r.material || '');
      return {
        material: parsed.material,
        fornecedor: parsed.fornecedor,
        preco_frete: String(r.preco_frete || 0),
      };
    });

    // Add missing generic materials from available list
    const existingGenericMats = new Set(
      existing
        .filter((r: any) => !r.fornecedor)
        .map((r: any) => normalizeToken(r.material))
    );

    const missing = availableMaterials
      .filter(m => m && !existingGenericMats.has(normalizeToken(m)))
      .map(m => ({ material: m, fornecedor: '', preco_frete: '0' }));

    setRows(
      [...existing, ...missing].sort((a, b) =>
        a.material.localeCompare(b.material) || (a.fornecedor || '').localeCompare(b.fornecedor || '')
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all then insert
      await (supabase as any).from('pedreira_frete_materiais').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const records = rows
        .filter(r => r.material.trim())
        .map(r => ({
          material: buildStorageMaterialKey(r.material, r.fornecedor),
          preco_frete: parseFloat(r.preco_frete.replace(',', '.')) || 0,
        }));
      if (records.length > 0) {
        const { error } = await (supabase as any).from('pedreira_frete_materiais').insert(records);
        if (error) throw error;
      }
      toast({ title: 'Preços de frete salvos com sucesso!' });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const addRow = () => {
    if (!newMaterial.trim()) return;
    const material = newMaterial.trim();
    const fornecedor = newFornecedor.trim();

    const exists = rows.some(
      r => normalizeToken(r.material) === normalizeToken(material) && normalizeToken(r.fornecedor || '') === normalizeToken(fornecedor)
    );
    if (exists) {
      toast({ title: 'Configuração já existe na lista', variant: 'destructive' });
      return;
    }

    setRows(prev =>
      [...prev, { material, fornecedor, preco_frete: '0' }].sort((a, b) =>
        a.material.localeCompare(b.material) || (a.fornecedor || '').localeCompare(b.fornecedor || '')
      )
    );

    setNewMaterial('');
    setNewFornecedor('');
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePrice = (idx: number, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, preco_frete: value.replace(/[^\d.,]/g, '') } : r));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Preço de Frete por Material
          </DialogTitle>
          <DialogDescription>Configure o valor do frete (R$/tonelada) para cada material</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Novo material..."
              value={newMaterial}
              onChange={e => setNewMaterial(e.target.value)}
              className="text-sm"
              onKeyDown={e => e.key === 'Enter' && addRow()}
            />
            <Input
              placeholder="Fornecedor (opcional)"
              value={newFornecedor}
              onChange={e => setNewFornecedor(e.target.value)}
              list="frete-fornecedores-list"
              className="text-sm"
              onKeyDown={e => e.key === 'Enter' && addRow()}
            />
            <datalist id="frete-fornecedores-list">
              {availableSuppliers.map((supplier) => (
                <option key={supplier} value={supplier} />
              ))}
            </datalist>
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-4 h-4" /></Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Material</TableHead>
                <TableHead className="text-xs">Fornecedor</TableHead>
                <TableHead className="text-xs text-right w-32">R$/ton</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.material}-${r.fornecedor}-${i}`}>
                  <TableCell className="py-1.5 text-xs font-medium">{r.material}</TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground">{r.fornecedor || 'Padrão (todos)'}</TableCell>
                  <TableCell className="py-1.5">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                      <Input
                        value={r.preco_frete}
                        onChange={e => updatePrice(i, e.target.value)}
                        className="h-7 text-xs pl-8 text-right"
                        inputMode="decimal"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(i)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-xs">
                    Nenhum material configurado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
