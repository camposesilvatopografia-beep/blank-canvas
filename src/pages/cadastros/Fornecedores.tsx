import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FornecedorModal } from '@/components/crud/FornecedorModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  status: string;
}

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFornecedores();
  }, []);

  const loadFornecedores = async () => {
    try {
      const { data, error } = await supabase
        .from('fornecedores_cal')
        .select('*')
        .order('nome');

      if (error) throw error;
      setFornecedores(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar fornecedores',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Omit<Fornecedor, 'id'>) => {
    setSaving(true);
    try {
      if (selectedFornecedor) {
        const { error } = await supabase
          .from('fornecedores_cal')
          .update(data)
          .eq('id', selectedFornecedor.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Fornecedor atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('fornecedores_cal')
          .insert(data);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Fornecedor criado com sucesso' });
      }
      setModalOpen(false);
      setSelectedFornecedor(null);
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
        .from('fornecedores_cal')
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

  const openEditModal = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    setModalOpen(true);
  };

  const openDeleteDialog = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    setDeleteDialogOpen(true);
  };

  const openNewModal = () => {
    setSelectedFornecedor(null);
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
          <Building2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Fornecedores de CAL</h1>
            <p className="text-muted-foreground">Cadastro de fornecedores</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openNewModal}>
          <Plus className="w-4 h-4" />
          Novo Fornecedor
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
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
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFornecedores.map((fornecedor) => (
                  <TableRow key={fornecedor.id}>
                    <TableCell className="font-medium">{fornecedor.nome}</TableCell>
                    <TableCell>{fornecedor.cnpj || '-'}</TableCell>
                    <TableCell>{fornecedor.contato || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={fornecedor.status === 'Ativo' ? 'default' : 'outline'} className={fornecedor.status === 'Ativo' ? 'bg-green-500' : ''}>
                        {fornecedor.status}
                      </Badge>
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

      <FornecedorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        fornecedor={selectedFornecedor}
        loading={saving}
      />

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
