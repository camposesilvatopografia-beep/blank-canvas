import { useState, useMemo } from 'react';
import { useAlmMateriais, useDeleteMaterial, useBulkDeleteMateriais, AlmMaterial } from './useAlmData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Settings2, Trash } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import AlmMaterialModal from './AlmMaterialModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';
import { useAlmMovimentacoes } from './useAlmData';

const ALM_MAT_COLUMNS: ColumnDefinition[] = [
  { key: 'codigo', defaultLabel: 'Código' },
  { key: 'nome', defaultLabel: 'Nome' },
  { key: 'categoria', defaultLabel: 'Categoria' },
  { key: 'unidade', defaultLabel: 'Unidade' },
  { key: 'estoque_atual', defaultLabel: 'Estoque Atual' },
  { key: 'estoque_minimo', defaultLabel: 'Mínimo' },
  { key: 'status', defaultLabel: 'Status' },
  { key: 'acoes', defaultLabel: 'Ações' },
];

export default function AlmMateriais() {
  const { data: materiais = [], isLoading } = useAlmMateriais();
  const { data: movs = [] } = useAlmMovimentacoes();
  const deleteMat = useDeleteMaterial();
  const bulkDelete = useBulkDeleteMateriais();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AlmMaterial | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { configs, getLabel, isVisible, saveConfigs } = useColumnConfig('alm_materiais', ALM_MAT_COLUMNS);
  const [showColConfig, setShowColConfig] = useState(false);

  // Materiais sem movimentações e com estoque 0
  const materiaisSemUso = useMemo(() => {
    const matIdsComMov = new Set(movs.map(m => m.material_id));
    return materiais.filter(m => m.estoque_atual === 0 && !matIdsComMov.has(m.id));
  }, [materiais, movs]);

  const filtered = materiais.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const visibleCount = ALM_MAT_COLUMNS.filter(c => isVisible(c.key)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          {isMainAdmin && (
            <Button variant="ghost" size="icon" onClick={() => setShowColConfig(true)} title="Configurar colunas">
              <Settings2 className="w-4 h-4" />
            </Button>
          )}
          {materiaisSemUso.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDelete(true)}>
              <Trash className="w-4 h-4 mr-1" /> Limpar sem uso ({materiaisSemUso.length})
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Novo Material</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#1d3557' }}>
              {isVisible('codigo') && <TableHead className="text-white font-bold">{getLabel('codigo')}</TableHead>}
              {isVisible('nome') && <TableHead className="text-white font-bold">{getLabel('nome')}</TableHead>}
              {isVisible('categoria') && <TableHead className="text-white font-bold">{getLabel('categoria')}</TableHead>}
              {isVisible('unidade') && <TableHead className="text-white font-bold text-center">{getLabel('unidade')}</TableHead>}
              {isVisible('estoque_atual') && <TableHead className="text-white font-bold text-center">{getLabel('estoque_atual')}</TableHead>}
              {isVisible('estoque_minimo') && <TableHead className="text-white font-bold text-center">{getLabel('estoque_minimo')}</TableHead>}
              {isVisible('status') && <TableHead className="text-white font-bold text-center">{getLabel('status')}</TableHead>}
              {isVisible('acoes') && <TableHead className="text-white font-bold text-center">{getLabel('acoes')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">Nenhum material cadastrado</TableCell></TableRow>
            ) : filtered.map((m, i) => {
              const baixo = m.estoque_atual <= m.estoque_minimo && m.estoque_minimo > 0;
              return (
                <TableRow key={m.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                  {isVisible('codigo') && <TableCell className="font-mono text-xs">{m.codigo}</TableCell>}
                  {isVisible('nome') && <TableCell className="font-medium">{m.nome}</TableCell>}
                  {isVisible('categoria') && <TableCell>{m.categoria || '-'}</TableCell>}
                  {isVisible('unidade') && <TableCell className="text-center">{m.unidade}</TableCell>}
                  {isVisible('estoque_atual') && <TableCell className={`text-center font-bold ${baixo ? 'text-red-600' : ''}`}>{m.estoque_atual}</TableCell>}
                  {isVisible('estoque_minimo') && <TableCell className="text-center">{m.estoque_minimo}</TableCell>}
                  {isVisible('status') && <TableCell className="text-center">
                    {baixo ? <Badge variant="destructive">Estoque Baixo</Badge> : <Badge variant="outline" className="border-emerald-500 text-emerald-600">{m.status}</Badge>}
                  </TableCell>}
                  {isVisible('acoes') && <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setModalOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlmMaterialModal open={modalOpen} onClose={() => setModalOpen(false)} material={editing} />
      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        onConfirm={() => { if (deleting) deleteMat.mutate(deleting); setDeleting(null); }}
        title="Excluir Material"
        description="Tem certeza que deseja excluir este material? Todas as movimentações associadas serão removidas."
      />
      <DeleteConfirmDialog
        open={showBulkDelete}
        onOpenChange={() => setShowBulkDelete(false)}
        onConfirm={() => {
          const ids = materiaisSemUso.map(m => m.id);
          if (ids.length > 0) bulkDelete.mutate(ids);
          setShowBulkDelete(false);
        }}
        title="Limpar Materiais Sem Uso"
        description={`Tem certeza que deseja excluir ${materiaisSemUso.length} materiais com estoque zerado e sem movimentações?`}
      />
      <ColumnConfigModal
        open={showColConfig}
        onOpenChange={setShowColConfig}
        tableLabel="Almoxarifado — Materiais"
        defaultColumns={ALM_MAT_COLUMNS}
        currentConfigs={configs}
        onSave={saveConfigs}
      />
    </div>
  );
}
