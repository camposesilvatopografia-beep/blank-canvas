import { useState } from 'react';
import { useAlmMovimentacoes, useAlmMateriais, useDeleteMovimentacao, AlmMovimentacao } from './useAlmData';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Image, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AlmEntradaModal from './AlmEntradaModal';
import AlmEditMovModal from './AlmEditMovModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

export default function AlmEntradas() {
  const { data: movs = [] } = useAlmMovimentacoes();
  const { data: materiais = [] } = useAlmMateriais();
  const deleteMov = useDeleteMovimentacao();
  const [modalOpen, setModalOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [editMov, setEditMov] = useState<AlmMovimentacao | null>(null);
  const [deleteMov_, setDeleteMov] = useState<AlmMovimentacao | null>(null);

  const entradas = movs.filter(m => m.tipo === 'entrada');
  const matMap = Object.fromEntries(materiais.map(m => [m.id, m]));

  const getFotoUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from('alm-fotos').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const handleDelete = () => {
    if (!deleteMov_) return;
    deleteMov.mutate(deleteMov_.id, { onSuccess: () => setDeleteMov(null) });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nova Entrada</Button>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#1d3557' }}>
              <TableHead className="text-white font-bold w-[60px]">Foto</TableHead>
              <TableHead className="text-white font-bold">Data</TableHead>
              <TableHead className="text-white font-bold">Material</TableHead>
              <TableHead className="text-white font-bold text-center">Qtd</TableHead>
              <TableHead className="text-white font-bold">Fornecedor</TableHead>
              <TableHead className="text-white font-bold">NF</TableHead>
              <TableHead className="text-white font-bold">Responsável</TableHead>
              <TableHead className="text-white font-bold text-center">Saldo Após</TableHead>
              <TableHead className="text-white font-bold text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entradas.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma entrada registrada</TableCell></TableRow>
            ) : entradas.map((e, i) => {
              const fotoUrl = getFotoUrl(e.foto_path);
              return (
                <TableRow key={e.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                  <TableCell className="p-1">
                    {fotoUrl ? (
                      <img src={fotoUrl} alt="Foto" className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImg(fotoUrl)} />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Image className="w-4 h-4 text-muted-foreground" /></div>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(e.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell className="font-medium">{matMap[e.material_id]?.nome || '-'}</TableCell>
                  <TableCell className="text-center font-bold text-emerald-600">+{e.quantidade}</TableCell>
                  <TableCell>{e.fornecedor || '-'}</TableCell>
                  <TableCell>{e.nota_fiscal || '-'}</TableCell>
                  <TableCell>{e.responsavel || '-'}</TableCell>
                  <TableCell className="text-center">{e.saldo_apos}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditMov(e)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteMov(e)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <AlmEntradaModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <AlmEditMovModal open={!!editMov} onClose={() => setEditMov(null)} movimentacao={editMov} />
      <DeleteConfirmDialog open={!!deleteMov_} onOpenChange={v => !v && setDeleteMov(null)} onConfirm={handleDelete} loading={deleteMov.isPending} />
      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-lg p-2">
          {previewImg && <img src={previewImg} alt="Foto ampliada" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
