import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Pencil, Trash2, Loader2, Mail, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

interface AllowedEmail {
  id: string;
  email: string;
  nome: string | null;
  tipo: string;
  status: string;
  created_at: string;
}

const TIPOS = [
  'Administrador',
  'Sala Técnica',
  'Gerencia',
  'Engenharia',
  'Almoxarifado',
  'Qualidade',
  'Apontador',
  'Supervisor',
  'Encarregado',
];

export function AllowedEmailsSection() {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<AllowedEmail | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState('Apontador');
  const [formStatus, setFormStatus] = useState('ativo');

  const { toast } = useToast();

  useEffect(() => { loadEmails(); }, []);

  const loadEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('allowed_emails')
      .select('*')
      .order('nome');
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar emails' });
    }
    setEmails(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setSelected(null);
    setFormEmail('');
    setFormNome('');
    setFormTipo('Apontador');
    setFormStatus('ativo');
    setModalOpen(true);
  };

  const openEdit = (item: AllowedEmail) => {
    setSelected(item);
    setFormEmail(item.email);
    setFormNome(item.nome || '');
    setFormTipo(item.tipo);
    setFormStatus(item.status);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formEmail.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Email é obrigatório' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Email inválido' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        email: formEmail.trim().toLowerCase(),
        nome: formNome.trim() || null,
        tipo: formTipo,
        status: formStatus,
      };

      if (selected) {
        const { error } = await supabase
          .from('allowed_emails')
          .update(payload)
          .eq('id', selected.id);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Email atualizado' });
      } else {
        const { error } = await supabase
          .from('allowed_emails')
          .insert(payload);
        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            throw new Error('Este email já está cadastrado');
          }
          throw error;
        }
        toast({ title: 'Sucesso', description: 'Email adicionado' });
      }

      setModalOpen(false);
      loadEmails();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('id', selected.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Email removido' });
      setDeleteOpen(false);
      setSelected(null);
      loadEmails();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao excluir' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = emails.filter(e =>
    (e.email?.toLowerCase().includes(search.toLowerCase())) ||
    (e.nome?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Emails Autorizados</h2>
            <p className="text-muted-foreground text-sm">
              Apenas emails cadastrados aqui podem acessar o sistema via Google
            </p>
          </div>
        </div>
        <Button className="gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Adicionar Email
        </Button>
      </div>

      {/* Search & Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email ou nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-primary">{item.email}</TableCell>
                    <TableCell>{item.nome || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={item.tipo === 'Administrador' ? 'default' : 'secondary'}>
                        {item.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'ativo' ? 'default' : 'outline'}
                        className={item.status === 'ativo' ? 'bg-green-500' : ''}
                      >
                        {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive"
                        onClick={() => { setSelected(item); setDeleteOpen(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum email cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected ? 'Editar Email' : 'Adicionar Email Autorizado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formNome}
                onChange={e => setFormNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo / Perfil</Label>
              <Select value={formTipo} onValueChange={setFormTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Remover Email"
        description={`Remover "${selected?.email}" da lista de emails autorizados? O usuário não poderá mais acessar o sistema.`}
      />
    </>
  );
}
