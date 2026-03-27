import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Package, Plus, Search, Pencil, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MaterialModal } from '@/components/crud/MaterialModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

interface Material {
  id: string;
  nome: string;
}

export default function Materiais() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMateriais();
  }, []);

  const loadMateriais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('material')
        .select('id, nome')
        .order('nome');

      if (error) throw error;
      setMateriais(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar materiais',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: { nome: string }) => {
    setSaving(true);
    try {
      if (selectedMaterial) {
        const { error } = await supabase
          .from('materiais')
          .update({ nome: data.nome })
          .eq('id', selectedMaterial.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Material atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('materiais')
          .insert({ nome: data.nome });

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Material criado com sucesso' });
      }
      setModalOpen(false);
      setSelectedMaterial(null);
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
        .from('materiais')
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

  const openEditModal = (material: Material) => {
    setSelectedMaterial(material);
    setModalOpen(true);
  };

  const openDeleteDialog = (material: Material) => {
    setSelectedMaterial(material);
    setDeleteDialogOpen(true);
  };

  const openNewModal = () => {
    setSelectedMaterial(null);
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
          <Package className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cadastro de Materiais</h1>
            <p className="text-muted-foreground">Tipos de materiais</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadMateriais} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button className="gap-2" onClick={openNewModal}>
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
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Material</TableHead>
                  <TableHead className="text-right w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMateriais.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.nome}</TableCell>
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
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                      Nenhum material cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MaterialModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        material={selectedMaterial}
        loading={saving}
      />

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
