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

interface FornecedorPedreira {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  status: string;
}

export default function FornecedoresPedreira() {
  const [fornecedores, setFornecedores] = useState<FornecedorPedreira[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<FornecedorPedreira | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ nome: '', cnpj: '', contato: '' });
  const { toast } = useToast();

  useEffect(() => {
    loadFornecedores();
  }, []);

  const loadFornecedores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fornecedores_pedreira')
        .select('id, nome, cnpj, contato, status')
        .order('nome');

      if (error) throw error;
      setFornecedores(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar fornecedores da pedreira',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'O nome do fornecedor é obrigatório',
      });
      return;
    }

    setSaving(true);
    try {
      if (selectedFornecedor) {
        const { error } = await supabase
          .from('fornecedores_pedreira')
          .update({ 
            nome: formData.nome.trim(),
            cnpj: formData.cnpj.trim() || null,
            contato: formData.contato.trim() || null,
          })
          .eq('id', selectedFornecedor.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Fornecedor atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('fornecedores_pedreira')
          .insert({ 
            nome: formData.nome.trim(),
            cnpj: formData.cnpj.trim() || null,
            contato: formData.contato.trim() || null,
          });

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Fornecedor criado com sucesso' });
      }
      setModalOpen(false);
      setSelectedFornecedor(null);
      setFormData({ nome: '', cnpj: '', contato: '' });
      loadFornecedores();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao salvar fornecedor',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFornecedor) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('fornecedores_pedreira')
        .delete()
        .eq('id', selectedFornecedor.id);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Fornecedor excluído com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedFornecedor(null);
      loadFornecedores();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao excluir fornecedor',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (fornecedor: FornecedorPedreira) => {
    setSelectedFornecedor(fornecedor);
    setFormData({ 
      nome: fornecedor.nome, 
      cnpj: fornecedor.cnpj || '', 
      contato: fornecedor.contato || '' 
    });
    setModalOpen(true);
  };

  const openDeleteDialog = (fornecedor: FornecedorPedreira) => {
    setSelectedFornecedor(fornecedor);
    setDeleteDialogOpen(true);
  };

  const openNewModal = () => {
    setSelectedFornecedor(null);
    setFormData({ nome: '', cnpj: '', contato: '' });
    setModalOpen(true);
  };

  const filteredFornecedores = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mountain className="w-8 h-8 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold">Fornecedores da Pedreira</h1>
            <p className="text-muted-foreground">Fornecedores de material para apontamento de pedreira</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadFornecedores} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button className="gap-2 bg-amber-600 hover:bg-amber-700" onClick={openNewModal}>
            <Plus className="w-4 h-4" />
            Novo Fornecedor
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedor..."
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
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="text-right w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFornecedores.map((fornecedor) => (
                  <TableRow key={fornecedor.id}>
                    <TableCell className="font-medium">{fornecedor.nome}</TableCell>
                    <TableCell>{fornecedor.cnpj || '-'}</TableCell>
                    <TableCell>{fornecedor.contato || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        fornecedor.status === 'Ativo' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {fornecedor.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(fornecedor)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(fornecedor)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredFornecedores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum fornecedor cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor da Pedreira'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Fornecedor *</Label>
              <Input
                id="nome"
                placeholder="Ex: Brita Potiguar, Herval..."
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contato">Contato</Label>
              <Input
                id="contato"
                placeholder="Telefone ou email"
                value={formData.contato}
                onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {selectedFornecedor ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Excluir Fornecedor"
        description={`Tem certeza que deseja excluir o fornecedor "${selectedFornecedor?.nome}"?`}
      />
    </div>
  );
}
