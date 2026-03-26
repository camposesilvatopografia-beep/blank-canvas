import { useAlmMateriais, useSaveMaterial, useDeleteMaterial, AlmMaterial } from './useAlmData';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Upload, Settings2, Plus, Pencil, Trash2, Filter } from 'lucide-react';
import { useState, useMemo } from 'react';
import AlmImportModal from './AlmImportModal';
import AlmMaterialModal from './AlmMaterialModal';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

/** Mapa de padronização de unidades */
const UNIDADE_MAP: Record<string, string> = {
  'un': 'un', 'und': 'un', 'unid': 'un', 'unidade': 'un', 'uni': 'un',
  'cx': 'cx', 'caixa': 'cx',
  'pct': 'pct', 'pacote': 'pct', 'pct.': 'pct',
  'kg': 'kg', 'kilo': 'kg', 'quilo': 'kg',
  'g': 'g', 'gr': 'g', 'grama': 'g',
  'l': 'L', 'lt': 'L', 'litro': 'L', 'lts': 'L',
  'm': 'm', 'metro': 'm', 'mt': 'm',
  'm²': 'm²', 'm2': 'm²',
  'm³': 'm³', 'm3': 'm³',
  'pç': 'pç', 'pc': 'pç', 'peca': 'pç', 'peça': 'pç',
  'rl': 'rl', 'rolo': 'rl',
  'sc': 'sc', 'saco': 'sc',
  'par': 'par',
  'jg': 'jg', 'jogo': 'jg',
  'vb': 'vb', 'verba': 'vb',
  'gl': 'gl', 'galão': 'gl', 'galao': 'gl',
  'tb': 'tb', 'tubo': 'tb',
  'fl': 'fl', 'folha': 'fl',
  'bd': 'bd', 'balde': 'bd',
  'lata': 'lata',
  'frasco': 'frasco',
};

function normalizeUnidade(u: string): string {
  const key = u.trim().toLowerCase().replace(/\./g, '');
  return UNIDADE_MAP[key] || u.trim();
}

const ALM_INV_COLUMNS: ColumnDefinition[] = [
  { key: 'codigo', defaultLabel: 'Código' },
  { key: 'material', defaultLabel: 'Material' },
  { key: 'unidade', defaultLabel: 'Unidade' },
  { key: 'estoque_atual', defaultLabel: 'Estoque Atual' },
  { key: 'estoque_minimo', defaultLabel: 'Mínimo' },
  { key: 'status', defaultLabel: 'Status' },
];

export default function AlmInventario() {
  const { data: materiais = [] } = useAlmMateriais();
  const saveMat = useSaveMaterial();
  const deleteMat = useDeleteMaterial();
  const [search, setSearch] = useState('');
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState('');
  const [editingMinId, setEditingMinId] = useState<string | null>(null);
  const [editingMinVal, setEditingMinVal] = useState('');
  const [catFilter, setCatFilter] = useState('__all__');
  const [importOpen, setImportOpen] = useState(false);
  const [editMat, setEditMat] = useState<AlmMaterial | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { configs, getLabel, isVisible, saveConfigs } = useColumnConfig('alm_inventario', ALM_INV_COLUMNS);
  const [showColConfig, setShowColConfig] = useState(false);

  const ativos = materiais.filter(m => m.status === 'Ativo');

  const categorias = useMemo(() => {
    const cats = ativos.map(m => m.categoria).filter((c): c is string => !!c && c.trim() !== '');
    return Array.from(new Set(cats)).sort();
  }, [ativos]);

  const filtered = ativos.filter(m => {
    const matchSearch = m.nome.toLowerCase().includes(search.toLowerCase()) || m.codigo.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === '__all__' || (catFilter === '__none__' ? !m.categoria : m.categoria === catFilter);
    return matchSearch && matchCat;
  });
  const visibleCount = ALM_INV_COLUMNS.filter(c => isVisible(c.key)).length + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas categorias</SelectItem>
              <SelectItem value="__none__">Sem categoria</SelectItem>
              {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {isMainAdmin && (
            <Button variant="ghost" size="icon" onClick={() => setShowColConfig(true)} title="Configurar colunas">
              <Settings2 className="w-4 h-4" />
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)} variant="default" size="sm">
            <Plus className="w-4 h-4 mr-1" /> Novo Material
          </Button>
          <Button onClick={() => setImportOpen(true)} variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-1" /> Importar
          </Button>
        </div>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#1d3557' }}>
              {isVisible('codigo') && <TableHead className="text-white font-bold">{getLabel('codigo')}</TableHead>}
              {isVisible('material') && <TableHead className="text-white font-bold">{getLabel('material')}</TableHead>}
              {isVisible('unidade') && <TableHead className="text-white font-bold text-center">{getLabel('unidade')}</TableHead>}
              {isVisible('estoque_atual') && <TableHead className="text-white font-bold text-center">{getLabel('estoque_atual')}</TableHead>}
              {isVisible('estoque_minimo') && <TableHead className="text-white font-bold text-center">{getLabel('estoque_minimo')}</TableHead>}
              {isVisible('status') && <TableHead className="text-white font-bold text-center">{getLabel('status')}</TableHead>}
              <TableHead className="text-white font-bold text-center w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">Todas as planilhas estão vazias, preciso importar os arquivos completos, com os lançamentos</TableCell></TableRow>
            ) : filtered.map((m, i) => {
              const baixo = m.estoque_atual <= m.estoque_minimo && m.estoque_minimo > 0;
              return (
                <TableRow key={m.id} className={`${i % 2 === 0 ? 'bg-background' : 'bg-muted/30'} ${baixo ? '!bg-red-50 dark:!bg-red-950/20' : ''}`}>
                  {isVisible('codigo') && <TableCell className="font-mono text-xs">{m.codigo}</TableCell>}
                  {isVisible('material') && <TableCell className="font-medium">{m.nome}</TableCell>}
                  {isVisible('unidade') && <TableCell className="text-center">{normalizeUnidade(m.unidade)}</TableCell>}
                  {isVisible('estoque_atual') && <TableCell className={`text-center font-bold text-lg ${baixo ? 'text-red-600' : 'text-emerald-600'}`}>
                    {editingStockId === m.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        autoFocus
                        className="w-20 mx-auto h-8 text-center font-bold"
                        value={editingStockVal}
                        onChange={e => setEditingStockVal(e.target.value)}
                        onBlur={() => {
                          const val = Number(editingStockVal);
                          if (!isNaN(val) && val !== m.estoque_atual) {
                            saveMat.mutate({ id: m.id, estoque_atual: val } as any);
                            toast.success(`Estoque atualizado para ${val}`);
                          }
                          setEditingStockId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingStockId(null);
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => { setEditingStockId(m.id); setEditingStockVal(String(m.estoque_atual)); }}
                        title="Clique para editar"
                      >
                        {m.estoque_atual}
                      </span>
                    )}
                  </TableCell>}
                  {isVisible('estoque_minimo') && <TableCell className="text-center">
                    {editingMinId === m.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        autoFocus
                        className="w-20 mx-auto h-8 text-center font-bold"
                        value={editingMinVal}
                        onChange={e => setEditingMinVal(e.target.value)}
                        onBlur={() => {
                          const val = Number(editingMinVal);
                          if (!isNaN(val) && val !== m.estoque_minimo) {
                            saveMat.mutate({ id: m.id, estoque_minimo: val } as any);
                          }
                          setEditingMinId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditingMinId(null);
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => { setEditingMinId(m.id); setEditingMinVal(String(m.estoque_minimo)); }}
                        title="Clique para editar"
                      >
                        {m.estoque_minimo}
                      </span>
                    )}
                  </TableCell>}
                  {isVisible('status') && <TableCell className="text-center">
                    {baixo ? <Badge variant="destructive">Estoque Baixo</Badge> : <Badge variant="outline" className="border-emerald-500 text-emerald-600">Normal</Badge>}
                  </TableCell>}
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditMat(m)} title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(m.id)} title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlmImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AlmMaterialModal open={showAdd || !!editMat} onClose={() => { setShowAdd(false); setEditMat(null); }} material={editMat} />
      <ColumnConfigModal
        open={showColConfig}
        onOpenChange={setShowColConfig}
        tableLabel="Almoxarifado — Inventário"
        defaultColumns={ALM_INV_COLUMNS}
        currentConfigs={configs}
        onSave={saveConfigs}
      />
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={v => { if (!v) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteMat.mutate(deleteId); setDeleteId(null); } }}
        title="Excluir Material"
        description="Tem certeza que deseja excluir este material? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
