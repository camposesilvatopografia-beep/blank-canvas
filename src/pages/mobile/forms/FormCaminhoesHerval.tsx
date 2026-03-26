import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { maskPlaca } from '@/utils/masks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Truck, Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function FormCaminhoesHerval() {
  const navigate = useNavigate();
  const { readSheet, writeSheet, appendSheet, deleteRow: deleteSheetRow } = useGoogleSheets();
  const { isOnline, pendingCount } = useOfflineSync();

  const [data, setData] = useState<CaminhaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
      setData(parsed);
    } catch (err) {
      console.error('Erro ao carregar:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [readSheet]);

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter(d =>
      d.placa.toLowerCase().includes(s) ||
      d.motorista.toLowerCase().includes(s) ||
      d.empresa.toLowerCase().includes(s)
    );
  }, [data, search]);

  const openNew = () => {
    setForm({ placa: '', descricao: 'Caminhão Basculante', empresa: 'Herval', motorista: '', pesoVazio: '' });
    setIsNew(true);
    setEditItem({} as CaminhaoRow);
  };

  const openEdit = (item: CaminhaoRow) => {
    setForm({ placa: item.placa, descricao: item.descricao || 'Caminhão Basculante', empresa: item.empresa || 'Herval', motorista: item.motorista, pesoVazio: item.pesoVazio.replace(/\D/g, '') });
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
        const rowValues = [[form.placa, form.descricao, form.empresa, form.motorista, form.pesoVazio]];
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

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(getApontadorHomeRoute())}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Truck className="w-5 h-5" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Caminhões Herval</h1>
            <p className="text-xs opacity-80">{data.length} cadastrados</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" /> Novo
        </Button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar placa, motorista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* List */}
      <div className="px-3 pb-6 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            {search ? 'Nenhum resultado encontrado' : 'Nenhum caminhão cadastrado'}
          </div>
        ) : (
          filtered.map(item => (
            <Card key={item.rowIndex} className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 shrink-0">
                <Truck className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">{item.placa}</span>
                  {item.pesoVazio && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.pesoVazio} kg</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.motorista || 'Sem motorista'}</p>
                <p className="text-[10px] text-muted-foreground/70 truncate">{item.empresa} • {item.descricao}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteItem(item)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Edit / New Modal */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Novo Caminhão Herval' : `Editar — ${form.placa}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <Input
                value={form.placa}
                onChange={e => setForm(p => ({ ...p, placa: maskPlaca(e.target.value) }))}
                disabled={saving}
                placeholder="Ex: QYG-5J16"
                maxLength={8}
                className={`text-lg font-mono font-bold ${(() => { const p = form.placa.trim().toUpperCase(); return p.length >= 3 && data.some(d => d.placa.toUpperCase() === p && (!editItem?.rowIndex || d.rowIndex !== editItem.rowIndex)) ? 'border-destructive' : ''; })()}`}
              />
              {(() => {
                const p = form.placa.trim().toUpperCase();
                const match = p.length >= 3 ? data.find(d => d.placa.toUpperCase() === p && (!editItem?.rowIndex || d.rowIndex !== editItem.rowIndex)) : null;
                return match ? (
                  <p className="text-xs text-destructive flex items-center gap-1">⚠️ Placa já cadastrada — Motorista: {match.motorista || 'N/A'}</p>
                ) : null;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Motorista</Label>
                <Input value={form.motorista} onChange={e => setForm(p => ({ ...p, motorista: e.target.value }))} disabled={saving} placeholder="Nome" />
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
          <DialogFooter className="gap-2">
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
        description={`Excluir "${deleteItem?.placa}" (${deleteItem?.motorista})? Esta ação não pode ser desfeita.`}
        loading={deleting}
      />
    </div>
  );
}
