import { useState } from 'react';
import { useAlmMovimentacoes, useAlmMateriais, useDeleteMovimentacao, AlmMovimentacao } from './useAlmData';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Printer, Settings2, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AlmSaidaModal from './AlmSaidaModal';
import AlmRequisicaoPrint from './AlmRequisicaoPrint';
import AlmEditMovModal from './AlmEditMovModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';

const ALM_SAIDAS_COLUMNS: ColumnDefinition[] = [
  { key: 'data', defaultLabel: 'Data' },
  { key: 'material', defaultLabel: 'Material' },
  { key: 'quantidade', defaultLabel: 'Qtd' },
  { key: 'equipe', defaultLabel: 'Equipe' },
  { key: 'etapa', defaultLabel: 'Etapa' },
  { key: 'requisicao', defaultLabel: 'Requisição' },
  { key: 'saldo_apos', defaultLabel: 'Saldo Após' },
  { key: 'acoes', defaultLabel: 'Ações' },
];

export default function AlmSaidas() {
  const { data: movs = [] } = useAlmMovimentacoes();
  const { data: materiais = [] } = useAlmMateriais();
  const deleteMov = useDeleteMovimentacao();
  const [modalOpen, setModalOpen] = useState(false);
  const [reqData, setReqData] = useState<any>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [editMov, setEditMov] = useState<AlmMovimentacao | null>(null);
  const [deleteMov_, setDeleteMov] = useState<AlmMovimentacao | null>(null);
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { configs, getLabel, isVisible, saveConfigs } = useColumnConfig('alm_saidas', ALM_SAIDAS_COLUMNS);
  const [showColConfig, setShowColConfig] = useState(false);

  const saidas = movs.filter(m => m.tipo === 'saida');
  const matMap = Object.fromEntries(materiais.map(m => [m.id, m]));
  const visibleCount = ALM_SAIDAS_COLUMNS.filter(c => isVisible(c.key)).length;

  const handleSaidaSuccess = (data: any) => {
    setReqData(data);
    setPrintOpen(true);
  };

  const handleReprint = (s: AlmMovimentacao) => {
    const mat = matMap[s.material_id];
    setReqData({ ...s, materialNome: mat?.nome, materialUnidade: mat?.unidade });
    setPrintOpen(true);
  };

  const handleDelete = () => {
    if (!deleteMov_) return;
    deleteMov.mutate(deleteMov_.id, { onSuccess: () => setDeleteMov(null) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {isMainAdmin && (
          <Button variant="ghost" size="icon" onClick={() => setShowColConfig(true)} title="Configurar colunas">
            <Settings2 className="w-4 h-4" />
          </Button>
        )}
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nova Saída</Button>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#1d3557' }}>
              {isVisible('data') && <TableHead className="text-white font-bold">{getLabel('data')}</TableHead>}
              {isVisible('material') && <TableHead className="text-white font-bold">{getLabel('material')}</TableHead>}
              {isVisible('quantidade') && <TableHead className="text-white font-bold text-center">{getLabel('quantidade')}</TableHead>}
              {isVisible('equipe') && <TableHead className="text-white font-bold">{getLabel('equipe')}</TableHead>}
              {isVisible('etapa') && <TableHead className="text-white font-bold">{getLabel('etapa')}</TableHead>}
              {isVisible('requisicao') && <TableHead className="text-white font-bold">{getLabel('requisicao')}</TableHead>}
              {isVisible('saldo_apos') && <TableHead className="text-white font-bold text-center">{getLabel('saldo_apos')}</TableHead>}
              {isVisible('acoes') && <TableHead className="text-white font-bold text-center">{getLabel('acoes')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {saidas.length === 0 ? (
              <TableRow><TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">Nenhuma saída registrada</TableCell></TableRow>
            ) : saidas.map((s, i) => (
              <TableRow key={s.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                {isVisible('data') && <TableCell>{format(new Date(s.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>}
                {isVisible('material') && <TableCell className="font-medium">{matMap[s.material_id]?.nome || '-'}</TableCell>}
                {isVisible('quantidade') && <TableCell className="text-center font-bold text-red-600">-{s.quantidade}</TableCell>}
                {isVisible('equipe') && <TableCell>{s.equipe || '-'}</TableCell>}
                {isVisible('etapa') && <TableCell>{s.etapa_obra || '-'}</TableCell>}
                {isVisible('requisicao') && <TableCell className="font-mono text-xs">{s.numero_requisicao || '-'}</TableCell>}
                {isVisible('saldo_apos') && <TableCell className="text-center">{s.saldo_apos}</TableCell>}
                {isVisible('acoes') && <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleReprint(s)} title="Imprimir"><Printer className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditMov(s)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteMov(s)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <AlmSaidaModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleSaidaSuccess} />
      <AlmRequisicaoPrint open={printOpen} onClose={() => setPrintOpen(false)} data={reqData} />
      <AlmEditMovModal open={!!editMov} onClose={() => setEditMov(null)} movimentacao={editMov} />
      <DeleteConfirmDialog open={!!deleteMov_} onOpenChange={v => !v && setDeleteMov(null)} onConfirm={handleDelete} loading={deleteMov.isPending} />
      <ColumnConfigModal
        open={showColConfig}
        onOpenChange={setShowColConfig}
        tableLabel="Almoxarifado — Saídas"
        defaultColumns={ALM_SAIDAS_COLUMNS}
        currentConfigs={configs}
        onSave={saveConfigs}
      />
    </div>
  );
}
