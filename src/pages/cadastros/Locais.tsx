import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LocalModal } from '@/components/crud/LocalModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

interface Local {
  id: string;
  tipo: string;
  nome: string;
  obra: string | null;
  status: string;
}

export default function Locais() {
  const [locais, setLocais] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocal, setSelectedLocal] = useState<Local | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLocais();
  }, []);

  const loadLocais = async () => {
    try {
      const { data, error } = await supabase
        .from('locais')
        .select('*')
        .order('nome');

      if (error) throw error;
      setLocais(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar locais',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: Omit<Local, 'id'>) => {
    setSaving(true);
    try {
      if (selectedLocal) {
        const { error } = await supabase
          .from('locais')
          .update(data)
          .eq('id', selectedLocal.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Local atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('locais')
          .insert(data);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Local criado com sucesso' });
      }
      setModalOpen(false);
      setSelectedLocal(null);
      loadLocais();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao salvar local',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLocal) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('locais')
        .delete()
        .eq('id', selectedLocal.id);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Local excluído com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedLocal(null);
      loadLocais();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao excluir local',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (local: Local) => {
    setSelectedLocal(local);
    setModalOpen(true);
  };

  const openDeleteDialog = (local: Local) => {
    setSelectedLocal(local);
    setDeleteDialogOpen(true);
  };

  const openNewModal = () => {
    setSelectedLocal(null);
    setModalOpen(true);
  };

  const filteredLocais = locais.filter(l =>
    l.nome.toLowerCase().includes(search.toLowerCase()) ||
    l.tipo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <MapPin className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cadastro de Locais</h1>
            <p className="text-muted-foreground">Locais de origem e destino</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openNewModal}>
          <Plus className="w-4 h-4" />
          Novo Local
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocais.map((local) => (
                  <TableRow key={local.id}>
                    <TableCell>
                      <Badge variant={local.tipo === 'Origem' ? 'default' : 'secondary'}>
                        {local.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{local.nome}</TableCell>
                    <TableCell className="text-primary">{local.obra || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={local.status === 'Ativo' ? 'default' : 'outline'} className={local.status === 'Ativo' ? 'bg-green-500' : ''}>
                        {local.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(local)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(local)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLocais.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum local cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LocalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        local={selectedLocal}
        loading={saving}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Excluir Local"
        description={`Tem certeza que deseja excluir o local "${selectedLocal?.nome}"?`}
      />
    </div>
  );
}
