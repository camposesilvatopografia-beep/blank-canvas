import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Mountain, Plus, Search, Pencil, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface MaterialPedreira {
  id: string;
  nome: string;
  status: string;
}

export default function MateriaisPedreira() {
  const [materiais, setMateriais] = useState<MaterialPedreira[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialPedreira | null>(null);
  const [saving, setSaving] = useState(false);
  const [formNome, setFormNome] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadMateriais();
  }, []);

  const loadMateriais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('materiais_pedreira')
        .select('id, nome, status')
        .order('nome');

      if (error) throw error;
      setMateriais(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar materiais da pedreira',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formNome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'O nome do material é obrigatório',
      });
      return;
    }

    setSaving(true);
    try {
      if (selectedMaterial) {
        const { error } = await supabase
          .from('materiais_pedreira')
          .update({ nome: formNome.trim() })
          .eq('id', selectedMaterial.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Material atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('materiais_pedreira')
          .insert({ nome: formNome.trim() });

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Material criado com sucesso' });
      }
      setModalOpen(false);
      setSelectedMaterial(null);
      setFormNome('');
      loadMateriais();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao salvar material',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMaterial) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('materiais_pedreira')
        .delete()
        .eq('id', selectedMaterial.id);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Material excluído com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedMaterial(null);
      loadMateriais();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao excluir material',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (material: MaterialPedreira) => {
    setSelectedMaterial(material);
    setFormNome(material.nome);
    setModalOpen(true);
  };

  const openDeleteDialog = (material: MaterialPedreira) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  const openNewModal = () => {
    setSelectedMaterial(null);
    setFormNome('');
    setModalOpen(true);
  };

  const filteredMateriais = materiais.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mountain className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold">Materiais da Pedreira</h1>
            <p className="text-muted-foreground">Tipos de materiais para apontamento de pedreira</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadMateriais} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700" onClick={openNewModal}>
            <Plus className="w-4 h-4" />
            Novo Material
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Material</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="text-right w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMateriais.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.nome}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        material.status === 'Ativo' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {material.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(material)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(material)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMateriais.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhum material cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Material Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMaterial ? 'Editar Material' : 'Novo Material da Pedreira'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Material</Label>
              <Input
                id="nome"
                placeholder="Ex: Brita 0, Pedra 1, Areia Fina..."
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {selectedMaterial ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Excluir Material"
        description={`Tem certeza que deseja excluir o material "${selectedMaterial?.nome}"?`}
      />
    </div>
  );
}
