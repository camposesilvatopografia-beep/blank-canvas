import { useState } from 'react';
import { useAlmMovimentacoes, useAlmMateriais, useDeleteMovimentacao, AlmMovimentacao } from './useAlmData';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import AlmEditMovModal from './AlmEditMovModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

export default function AlmMovimentacoes() {
  const { data: movs = [] } = useAlmMovimentacoes();
  const { data: materiais = [] } = useAlmMateriais();
  const deleteMov = useDeleteMovimentacao();
  const matMap = Object.fromEntries(materiais.map(m => [m.id, m]));

  const [tipoFilter, setTipoFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [editMov, setEditMov] = useState<AlmMovimentacao | null>(null);
  const [deleteMov_, setDeleteMov] = useState<AlmMovimentacao | null>(null);

  const getFotoUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from('alm-fotos').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const filtered = movs.filter(m => {
    if (tipoFilter !== 'todos' && m.tipo !== tipoFilter) return false;
    if (search) {
      const mat = matMap[m.material_id];
      const text = `${mat?.nome || ''} ${m.responsavel || ''} ${m.equipe || ''} ${m.nota_fiscal || ''} ${m.fornecedor || ''}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const handleDelete = () => {
    if (!deleteMov_) return;
    deleteMov.mutate(deleteMov_.id, { onSuccess: () => setDeleteMov(null) });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="entrada">Entradas</SelectItem>
            <SelectItem value="saida">Saídas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#1d3557' }}>
              <TableHead className="text-white font-bold w-[60px]">Foto</TableHead>
              <TableHead className="text-white font-bold">Data</TableHead>
              <TableHead className="text-white font-bold">Material</TableHead>
              <TableHead className="text-white font-bold text-center">Tipo</TableHead>
              <TableHead className="text-white font-bold text-center">Qtd</TableHead>
              <TableHead className="text-white font-bold text-center">Saldo Após</TableHead>
              <TableHead className="text-white font-bold">Responsável</TableHead>
              <TableHead className="text-white font-bold text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma movimentação</TableCell></TableRow>
            ) : filtered.map((m, i) => {
              const fotoUrl = getFotoUrl(m.foto_path);
              return (
                <TableRow key={m.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                  <TableCell className="p-1">
                    {fotoUrl ? (
                      <img src={fotoUrl} alt="Foto" className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImg(fotoUrl)} />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Image className="w-4 h-4 text-muted-foreground" /></div>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(m.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                  <TableCell className="font-medium">{matMap[m.material_id]?.nome || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={m.tipo === 'entrada' ? 'default' : 'destructive'} className={m.tipo === 'entrada' ? 'bg-emerald-600' : ''}>
                      {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-center font-bold ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                  </TableCell>
                  <TableCell className="text-center">{m.saldo_apos}</TableCell>
                  <TableCell>{m.responsavel || m.equipe || '-'}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditMov(m)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteMov(m)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
