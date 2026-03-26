import { useState, useEffect, useMemo, useCallback } from 'react';
import { maskPlaca } from '@/utils/masks';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Truck, Search, Plus, Pencil, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

const SHEET_NAME = 'Caminhões Herval';

interface CaminhaoRow {
  placa: string;
  descricao: string;
  empresa: string;
  motorista: string;
  pesoVazio: string;
  rowIndex: number;
}

interface ColMap {
  placa: number; descricao: number; empresa: number; motorista: number; pesoVazio: number;
}

export default function CaminhoesHerval() {
  const { readSheet, writeSheet, appendSheet, deleteRow: deleteSheetRow } = useGoogleSheets();
  const [data, setData] = useState<CaminhaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPeso, setFilterPeso] = useState<'todos' | 'com' | 'sem'>('todos');
  const [cols, setCols] = useState<ColMap | null>(null);
  const [editItem, setEditItem] = useState<CaminhaoRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ placa: '', descricao: '', empresa: '', motorista: '', pesoVazio: '' });
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CaminhaoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await readSheet(SHEET_NAME);
      if (rows.length < 2) { setData([]); return; }
      const headers = rows[0].map((h: string) => (h || '').toString().trim().toUpperCase().replace(/\s+/g, '_'));
      const idx = (name: string) => {
        const i = headers.findIndex((h: string) => h.includes(name));
        return i >= 0 ? i : -1;
      };
      const colMap: ColMap = {
        placa: idx('PLACA'),
        descricao: idx('DESCRI'),
        empresa: idx('EMPRESA'),
        motorista: idx('MOTORISTA'),
        pesoVazio: idx('PESO'),
      };
      setCols(colMap);

      const parsed: CaminhaoRow[] = rows.slice(1)
        .map((r: any[], i: number) => {
          if (!r.some((c: any) => c && c.toString().trim())) return null;
          return {
            placa: (r[colMap.placa] || '').toString().trim(),
            descricao: (r[colMap.descricao] || '').toString().trim(),
            empresa: (r[colMap.empresa] || '').toString().trim(),
            motorista: (r[colMap.motorista] || '').toString().trim(),
            pesoVazio: (r[colMap.pesoVazio] || '').toString().trim(),
            rowIndex: i + 1,
          };
        })
        .filter(Boolean) as CaminhaoRow[];
      parsed.sort((a, b) => a.placa.localeCompare(b.placa));
      setData(parsed);
    } catch (err) {
      console.error('Erro ao carregar Caminhões Herval:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [readSheet]);

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    let result = data;
    if (filterPeso === 'com') result = result.filter(d => d.pesoVazio);
    else if (filterPeso === 'sem') result = result.filter(d => !d.pesoVazio);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(d =>
        d.placa.toLowerCase().includes(s) ||
        d.motorista.toLowerCase().includes(s) ||
        d.empresa.toLowerCase().includes(s) ||
        d.descricao.toLowerCase().includes(s)
      );
    }
    return result;
  }, [data, search, filterPeso]);

  const semPeso = useMemo(() => data.filter(d => !d.pesoVazio), [data]);
  const comPeso = useMemo(() => data.filter(d => d.pesoVazio), [data]);

  const openNew = () => {
    setForm({ placa: '', descricao: 'Caminhão Basculante', empresa: 'Herval', motorista: '', pesoVazio: '' });
    setIsNew(true);
    setEditItem({} as CaminhaoRow);
  };

  const openEdit = (item: CaminhaoRow) => {
    setForm({ placa: item.placa, descricao: item.descricao, empresa: item.empresa, motorista: item.motorista, pesoVazio: item.pesoVazio });
    setIsNew(false);
    setEditItem(item);
  };

  const handleSave = useCallback(async () => {
    if (!form.placa.trim()) { toast.error('Placa é obrigatória'); return; }
    const placaNorm = form.placa.trim().toUpperCase();
    const duplicada = data.some(d => d.placa.toUpperCase() === placaNorm && (!editItem?.rowIndex || d.rowIndex !== editItem.rowIndex));
    if (duplicada) { toast.error(`Placa ${placaNorm} já cadastrada!`); return; }
    setSaving(true);
    try {
      if (isNew) {
        const rowValues = [
          [form.placa, form.descricao, form.empresa, form.motorista, form.pesoVazio]
        ];
        const ok = await appendSheet(SHEET_NAME, rowValues);
        if (!ok) throw new Error('Falha ao adicionar');
        toast.success(`Caminhão ${form.placa} adicionado`);
      } else if (editItem && cols) {
        const row = editItem.rowIndex + 1;
        const colLetter = (idx: number) => idx >= 0 ? String.fromCharCode(65 + idx) : null;
        const fieldMap: { key: keyof typeof form; colIdx: number }[] = [
          { key: 'placa', colIdx: cols.placa },
          { key: 'descricao', colIdx: cols.descricao },
          { key: 'empresa', colIdx: cols.empresa },
          { key: 'motorista', colIdx: cols.motorista },
          { key: 'pesoVazio', colIdx: cols.pesoVazio },
        ];
        for (const { key, colIdx } of fieldMap) {
          if (colIdx < 0) continue;
          const letter = colLetter(colIdx);
          if (letter) {
            const ok = await writeSheet(SHEET_NAME, `${letter}${row}`, [[form[key]]]);
            if (!ok) throw new Error(`Falha ao gravar ${key}`);
          }
        }
        toast.success(`Caminhão ${form.placa} atualizado`);
      }
      setEditItem(null);
      await loadData();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [form, isNew, editItem, cols, writeSheet, appendSheet, loadData, data]);

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const ok = await deleteSheetRow(SHEET_NAME, deleteItem.rowIndex);
      if (!ok) throw new Error('Falha ao excluir');
      toast.success(`Caminhão ${deleteItem.placa} excluído`);
      setDeleteItem(null);
      await loadData();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast.error('Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }, [deleteItem, deleteSheetRow, loadData]);

  if (loading) return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/20">
            <Truck className="w-7 h-7 text-teal-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Caminhões Herval</h1>
            <p className="text-sm text-muted-foreground">{data.length} caminhões cadastrados</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2 bg-teal-500 hover:bg-teal-600 text-white">
          <Plus className="w-4 h-4" /> Novo Caminhão
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-all border-2 ${filterPeso === 'todos' ? 'border-teal-600 shadow-md' : 'border-border hover:border-teal-500/40'} bg-teal-600/5`}
          onClick={() => setFilterPeso('todos')}
        >
          <CardContent className="pt-4 pb-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-teal-600/10">
              <Truck className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Cadastrados</p>
              <p className="text-3xl font-bold text-teal-600">{data.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all border-2 ${filterPeso === 'com' ? 'border-emerald-500 shadow-md' : 'border-border hover:border-emerald-400/40'} bg-emerald-500/5`}
          onClick={() => setFilterPeso(filterPeso === 'com' ? 'todos' : 'com')}
        >
          <CardContent className="pt-4 pb-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Com Peso Vazio</p>
              <p className="text-3xl font-bold text-emerald-600">{comPeso.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all border-2 ${filterPeso === 'sem' ? 'border-red-500 shadow-md' : 'border-border hover:border-red-400/40'} bg-red-500/5`}
          onClick={() => setFilterPeso(filterPeso === 'sem' ? 'todos' : 'sem')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-500/10">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Sem Peso Vazio</p>
                <p className="text-3xl font-bold text-red-600">{semPeso.length}</p>
              </div>
            </div>
            {semPeso.length > 0 && (
              <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800 space-y-1 max-h-24 overflow-y-auto">
                {semPeso.map(v => (
                  <div key={v.rowIndex} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-red-700 dark:text-red-400">{v.placa}</span>
                    <span className="text-muted-foreground truncate ml-2">{v.motorista || 'Sem motorista'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, motorista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {filterPeso !== 'todos' && (
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1 px-3 py-1.5 text-xs"
            onClick={() => setFilterPeso('todos')}
          >
            {filterPeso === 'com' ? '✅ Com Peso' : '⚠️ Sem Peso'} ✕
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Exibindo {filtered.length} de {data.length}
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-teal-600/5">
                  <TableHead className="text-xs font-bold w-12 text-center">#</TableHead>
                  <TableHead className="text-xs font-bold">Placa</TableHead>
                  <TableHead className="text-xs font-bold">Motorista</TableHead>
                  <TableHead className="text-xs font-bold text-right">Peso Vazio</TableHead>
                  <TableHead className="text-xs font-bold text-center w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {search ? 'Nenhum resultado encontrado' : 'Nenhum caminhão cadastrado'}
                    </TableCell>
                  </TableRow>
                ) : filtered.map((item, idx) => (
                  <TableRow key={item.rowIndex} className={`h-10 ${idx % 2 === 0 ? '' : 'bg-muted/30'}`}>
                    <TableCell className="text-xs text-center text-muted-foreground font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs font-bold">{item.placa}</TableCell>
                    <TableCell className="text-xs">{item.motorista || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell className="text-xs text-right">
                      {item.pesoVazio ? (
                        <span className="font-medium">{item.pesoVazio}</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-300 px-1.5">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteItem(item)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit / New Modal */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Novo Caminhão Herval' : `Editar — ${form.placa}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <Input value={form.placa} onChange={e => { const v = maskPlaca(e.target.value); setForm(p => ({ ...p, placa: v })); }} disabled={saving} placeholder="Ex: QYG-5J16" maxLength={8} className={(() => { const p = form.placa.trim().toUpperCase(); const dup = p.length >= 3 && data.some(d => d.placa.toUpperCase() === p && (!editItem?.rowIndex || d.rowIndex !== editItem.rowIndex)); return dup ? 'border-destructive' : ''; })()}  />
              {(() => {
                const p = form.placa.trim().toUpperCase();
                const match = p.length >= 3 ? data.find(d => d.placa.toUpperCase() === p && (!editItem?.rowIndex || d.rowIndex !== editItem.rowIndex)) : null;
                return match ? (
                  <p className="text-xs text-destructive flex items-center gap-1">⚠️ Placa já cadastrada — Motorista: {match.motorista || 'N/A'}</p>
                ) : null;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motorista</Label>
                <Input value={form.motorista} onChange={e => setForm(p => ({ ...p, motorista: e.target.value }))} disabled={saving} placeholder="Nome do motorista" />
              </div>
              <div className="space-y-2">
                <Label>Peso Vazio (kg)</Label>
                <Input
                  value={form.pesoVazio ? Number(form.pesoVazio.replace(/\D/g, '')).toLocaleString('pt-BR') : ''}
                  onChange={e => setForm(p => ({ ...p, pesoVazio: e.target.value.replace(/\D/g, '') }))}
                  disabled={saving}
                  placeholder="Ex: 15000"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.placa.trim()}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => { if (!o) setDeleteItem(null); }}
        onConfirm={handleDelete}
        title="Excluir Caminhão"
        description={`Tem certeza que deseja excluir o caminhão "${deleteItem?.placa}" (${deleteItem?.motorista})? Esta ação não pode ser desfeita.`}
        loading={deleting}
      />
    </div>
  );
}
