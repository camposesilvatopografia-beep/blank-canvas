import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, Search, Pencil, UserX, Loader2, Shield, Copy, Share2, Monitor, Trash2, Smartphone, Download, ExternalLink, ImageIcon, X, UserPlus, RefreshCw, Check, Send, Mail, ClipboardList, KeyRound, Link as LinkIcon, BarChart3 } from 'lucide-react';
import { AllowedEmailsSection } from '@/components/crud/AllowedEmailsSection';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { UsuarioModal } from '@/components/crud/UsuarioModal';
import { UserAccessModal } from '@/components/crud/UserAccessModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { useManagePermissions, ALL_MODULES } from '@/hooks/useModulePermissions';
import { useAppLogo } from '@/hooks/useAppLogo';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ResponsavelRDO {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  status: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  usuario?: string;
  tipo: string;
  status: string;
}

interface ModulePermissions {
  [key: string]: boolean;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeactivateDialogOpen, setBulkDeactivateDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Profile | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<ModulePermissions>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessModalUser, setAccessModalUser] = useState<Profile | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isAdmin, profile } = useAuth();
  const { getUserPermissions, setUserPermissions } = useManagePermissions();
  const { customLogo, setCustomLogo } = useAppLogo();

  const baseUrl = window.location.origin;
  const publishedUrl = 'https://apropriapp.lovable.app';
  const desktopUrl = `${baseUrl}/auth`;
  const mobileUrl = `${baseUrl}/mobile/auth`;
  const dashboardOnlyUrl = `${publishedUrl}/dashboard-only`;
  const pwaBuilderUrl = `https://www.pwabuilder.com/?site=${baseUrl}`;
  const installUrl = `${baseUrl}/install`;

  // ── Estados para Usuários RDO ──────────────────────────────────────────────
  const [rdoUsers, setRdoUsers] = useState<ResponsavelRDO[]>([]);
  const [rdoLoading, setRdoLoading] = useState(true);
  const [rdoAddOpen, setRdoAddOpen] = useState(false);
  const [rdoDeleteTarget, setRdoDeleteTarget] = useState<ResponsavelRDO | null>(null);
  const [rdoNome, setRdoNome] = useState('');
  const [rdoEmail, setRdoEmail] = useState('');
  const [rdoSaving, setRdoSaving] = useState(false);
  const [rdoMagicLink, setRdoMagicLink] = useState<string | null>(null);
  const [rdoCopied, setRdoCopied] = useState(false);

  useEffect(() => {
    loadUsuarios();
    loadRdoUsers();
  }, []);

  const loadRdoUsers = async () => {
    setRdoLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, nome, email, status, created_at')
      .eq('tipo', 'Responsavel RDO')
      .order('nome');
    setRdoUsers((data as ResponsavelRDO[]) || []);
    setRdoLoading(false);
  };

  const callRdoInvite = async (action: string, body: object) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/rdo-user-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na operação');
    return data;
  };

  const handleRdoAdd = async () => {
    if (!rdoNome.trim() || !rdoEmail.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Nome e e-mail são obrigatórios' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rdoEmail.trim())) {
      toast({ variant: 'destructive', title: 'Erro', description: 'E-mail inválido' });
      return;
    }
    setRdoSaving(true);
    try {
      const data = await callRdoInvite('invite', { nome: rdoNome.trim(), email: rdoEmail.trim().toLowerCase() });
      setRdoMagicLink(data.magicLink || null);
      toast({ title: 'Sucesso', description: `Responsável ${rdoNome} cadastrado! Link de acesso gerado.` });
      loadRdoUsers();
      setRdoNome('');
      setRdoEmail('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setRdoSaving(false);
    }
  };

  const handleRdoResend = async (user: ResponsavelRDO) => {
    try {
      const data = await callRdoInvite('resend', { email: user.email });
      setRdoMagicLink(data.magicLink || null);
      setRdoAddOpen(true);
      toast({ title: 'Sucesso', description: 'Novo link de acesso gerado!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    }
  };

  const handleRdoDelete = async () => {
    if (!rdoDeleteTarget) return;
    try {
      await callRdoInvite('delete', { userId: rdoDeleteTarget.user_id });
      toast({ title: 'Sucesso', description: 'Usuário removido com sucesso' });
      loadRdoUsers();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setRdoDeleteTarget(null);
    }
  };

  const copyRdoLink = () => {
    if (!rdoMagicLink) return;
    navigator.clipboard.writeText(rdoMagicLink);
    setRdoCopied(true);
    setTimeout(() => setRdoCopied(false), 2000);
    toast({ title: 'Link copiado!' });
  };

  const openRdoWhatsApp = () => {
    if (!rdoMagicLink) return;
    const text = encodeURIComponent(`Olá! Seu acesso ao portal RDO foi criado. Clique no link abaixo para entrar:\n\n${rdoMagicLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const loadUsuarios = async () => {
    try {
      // Load all admin/administrative users
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('tipo', ['Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização'])
        .order('nome');

      if (error) throw error;
      setUsuarios(data || []);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar usuários',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredUsuarios.map(u => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDeactivate = async () => {
    setSaving(true);
    try {
      const idsToDeactivate = Array.from(selectedIds);
      
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inativo' })
        .in('id', idsToDeactivate);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${idsToDeactivate.length} usuário(s) desativado(s)`,
      });
      setBulkDeactivateDialogOpen(false);
      setSelectedIds(new Set());
      loadUsuarios();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao desativar usuários',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    setSaving(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      const usersToDelete = usuarios.filter(u => idsToDelete.includes(u.id));
      
      // Delete roles first
      for (const user of usersToDelete) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.user_id);
      }

      // Delete profiles
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${idsToDelete.length} usuário(s) excluído(s)`,
      });
      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
      loadUsuarios();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao excluir usuários',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (data: { nome: string; email: string; usuario: string; tipo: string; status: string; password?: string; permissions: ModulePermissions }) => {
    setSaving(true);
    try {
      if (selectedUsuario) {
        // Check if email changed
        if (data.email !== selectedUsuario.email) {
          // Update email via edge function (requires admin privileges)
          const emailResponse = await supabase.functions.invoke('update-user-email', {
            body: {
              userId: selectedUsuario.user_id,
              newEmail: data.email,
            },
          });

          if (emailResponse.error) {
            throw new Error(emailResponse.error.message || 'Erro ao atualizar email');
          }
          if (emailResponse.data?.error) {
            throw new Error(emailResponse.data.error);
          }
        }

        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            nome: data.nome,
            email: data.email,
            usuario: data.usuario,
            tipo: data.tipo,
            status: data.status,
          })
          .eq('id', selectedUsuario.id);

        if (profileError) throw profileError;

        // Update role - ALL admin types get 'admin' role
        const adminTypes = ['Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização'];
        const newRole = adminTypes.includes(data.tipo) ? 'admin' : 'apontador';
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', selectedUsuario.user_id);

        if (roleError) throw roleError;

        // Update permissions
        await setUserPermissions(selectedUsuario.user_id, data.permissions);

        toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso' });
      } else {
        // Create new user via edge function (handles auth user + profile + role)
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) {
          throw new Error('Você precisa estar autenticado para criar usuários');
        }

        const response = await supabase.functions.invoke('create-user', {
          body: {
            nome: data.nome,
            usuario: data.usuario,
            email: data.email,
            password: data.password,
            tipo: data.tipo,
            status: data.status,
          },
        });

        if (response.error) {
          let errorMsg = response.error.message || 'Erro ao criar usuário';
          if (errorMsg.includes('email_exists') || errorMsg.includes('already been registered')) {
            errorMsg = `O email "${data.email}" já está cadastrado!`;
          }
          throw new Error(errorMsg);
        }

        if (response.data?.error) {
          let errorMsg = response.data.error;
          if (errorMsg.includes('email_exists') || errorMsg.includes('already been registered')) {
            errorMsg = `O email "${data.email}" já está cadastrado!`;
          }
          throw new Error(errorMsg);
        }

        // Set permissions for new user
        if (response.data?.user?.id) {
          await setUserPermissions(response.data.user.id, data.permissions);
        }

        toast({ title: 'Sucesso', description: 'Usuário criado com sucesso' });
      }
      setModalOpen(false);
      setSelectedUsuario(null);
      loadUsuarios();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao salvar usuário',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUsuario) return;
    setSaving(true);
    try {
      // Delete role first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUsuario.user_id);

      // Delete profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUsuario.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedUsuario(null);
      loadUsuarios();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao excluir usuário',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = async (usuario: Profile) => {
    setSelectedUsuario(usuario);
    setIsNew(false);
    // Load user permissions
    const perms = await getUserPermissions(usuario.user_id);
    setSelectedPermissions(perms);
    setModalOpen(true);
  };

  const openDeleteDialog = (usuario: Profile) => {
    setSelectedUsuario(usuario);
    setDeleteDialogOpen(true);
  };

  const openNewModal = () => {
    setSelectedUsuario(null);
    setIsNew(true);
    // Default all modules enabled for new user
    const defaultPerms: ModulePermissions = {};
    ALL_MODULES.forEach(m => defaultPerms[m] = true);
    setSelectedPermissions(defaultPerms);
    setModalOpen(true);
  };

  const filteredUsuarios = usuarios.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = filteredUsuarios.length > 0 && filteredUsuarios.every(u => selectedIds.has(u.id));
  const someSelected = selectedIds.size > 0;

  // Only main admin (Jean) or users with tipo='Administrador' can manage users
  const canManageUsers = profile?.email === 'jeanallbuquerque@gmail.com' || profile?.tipo === 'Administrador';
  
  if (!isAdmin || !canManageUsers) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="p-8 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            {!isAdmin 
              ? 'Apenas administradores podem acessar esta página.'
              : 'Apenas o Administrador Principal pode gerenciar usuários.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo Customizável */}
      <Card className="border-dashed border-2 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Logo do Sistema</h3>
                <p className="text-sm text-muted-foreground">Personalize a logo exibida no menu e nos relatórios</p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:ml-auto">
              {customLogo && (
                <img src={customLogo} alt="Logo atual" className="h-12 w-12 object-contain rounded border" />
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'A logo deve ter no máximo 2MB.' });
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    setCustomLogo(dataUrl);
                    toast({ title: 'Logo atualizada!', description: 'A logo foi aplicada ao sistema.' });
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
              <Button variant="outline" className="gap-2" onClick={() => logoInputRef.current?.click()}>
                <ImageIcon className="w-4 h-4" />
                {customLogo ? 'Trocar Logo' : 'Enviar Logo'}
              </Button>
              {customLogo && (
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                  onClick={() => { setCustomLogo(null); toast({ title: 'Logo removida', description: 'A logo padrão foi restaurada.' }); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Emails Autorizados ────────────────────────────────── */}
      <AllowedEmailsSection />

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="rdo" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Portal RDO</span>
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Links</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════ TAB: Usuários Administrativos ══════════ */}
        <TabsContent value="usuarios" className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Gestão de Usuários</h2>
                <p className="text-muted-foreground">Gerenciar acessos e permissões do sistema</p>
              </div>
            </div>
            <Button className="gap-2" onClick={openNewModal}>
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </div>

          {/* Search & Bulk Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {someSelected && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size} selecionado(s)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setBulkDeactivateDialogOpen(true)}
                    >
                      <UserX className="w-4 h-4" />
                      Desativar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </Button>
                  </div>
                )}
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsuarios.map((usuario) => (
                      <TableRow key={usuario.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(usuario.id)}
                            onCheckedChange={(checked) => handleSelectOne(usuario.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{usuario.nome}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {usuario.usuario || '-'}
                        </TableCell>
                        <TableCell className="text-primary">{usuario.email}</TableCell>
                        <TableCell>
                          <Badge variant={usuario.tipo === 'Administrador' ? 'default' : 'secondary'}>
                            {usuario.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={usuario.status === 'ativo' ? 'default' : 'outline'} className={usuario.status === 'ativo' ? 'bg-green-500' : ''}>
                            {usuario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gerenciar Permissões"
                            onClick={() => { setAccessModalUser(usuario); setAccessModalOpen(true); }}
                          >
                            <KeyRound className="w-4 h-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(usuario)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(usuario)}>
                            <UserX className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsuarios.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum usuário cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════ TAB: Portal RDO ══════════ */}
        <TabsContent value="rdo" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Usuários do Portal RDO</h2>
                <p className="text-muted-foreground text-sm">Responsáveis com acesso ao portal de visualização, assinatura e aprovação de RDOs</p>
              </div>
            </div>
            <Button className="gap-2" onClick={() => { setRdoAddOpen(true); setRdoMagicLink(null); }}>
              <UserPlus className="w-4 h-4" />
              Novo Responsável
            </Button>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium">Acesso por link mágico</p>
              <p className="mt-0.5 text-xs opacity-80">
                Cada responsável recebe um link único por e-mail ou WhatsApp. Ao clicar, acessa diretamente o portal sem precisar de senha.
              </p>
            </div>
          </div>

          {rdoLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando...
            </div>
          ) : rdoUsers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum responsável cadastrado</p>
                <p className="text-sm mt-1">Adicione o primeiro responsável clicando em "Novo Responsável".</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rdoUsers.map(user => (
                <Card key={user.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {user.nome.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{user.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          <Badge variant={user.status === 'ativo' ? 'default' : 'secondary'} className="text-xs mt-1">
                            {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRdoResend(user)}
                          title="Gerar novo link de acesso"
                          className="gap-1 text-xs"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRdoDeleteTarget(user)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════ TAB: Links ══════════ */}
        <TabsContent value="links" className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <LinkIcon className="w-8 h-8 text-primary" />
            <div>
              <h2 className="text-xl font-bold">Links de Acesso</h2>
              <p className="text-muted-foreground text-sm">Todos os links do sistema organizados por tipo de acesso</p>
            </div>
          </div>

          {/* Sistema Completo (Admin/Gestores) */}
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Sistema Completo (Admin / Gestores)</h3>
                  <p className="text-sm text-muted-foreground">Acesso completo: dashboard, relatórios, cadastros e configurações</p>
                </div>
              </div>
              <LinkRow label="Login Desktop" url={desktopUrl} toast={toast} />
            </CardContent>
          </Card>

          {/* Dashboard Exclusivo */}
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">Dashboard Exclusivo</h3>
                  <p className="text-sm text-muted-foreground">Acesso apenas à página de Dashboard, sem menu lateral ou outras funcionalidades</p>
                </div>
              </div>
              <LinkRow label="Dashboard" url={dashboardOnlyUrl} toast={toast} />
            </CardContent>
          </Card>

          {/* App de Campo (Apontadores) */}
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">App de Campo (Apontadores)</h3>
                  <p className="text-sm text-muted-foreground">App simplificado para apontamentos em campo</p>
                </div>
              </div>
              <div className="space-y-3">
                <LinkRow label="Login Mobile" url={mobileUrl} toast={toast} />
                <LinkRow label="Instalação" url={installUrl} toast={toast} />
              </div>
            </CardContent>
          </Card>

          {/* App Android */}
          <Card className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Download className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">App Android (APK)</h3>
                  <p className="text-sm text-muted-foreground">Gere um APK via PWABuilder</p>
                </div>
              </div>
              <LinkRow label="PWABuilder" url={pwaBuilderUrl} toast={toast} />
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Dica:</strong> No Android, os apontadores podem instalar o app diretamente pelo link. No iPhone, devem usar Safari → Compartilhar → "Adicionar à Tela de Início".
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <UserAccessModal
        open={accessModalOpen}
        onOpenChange={setAccessModalOpen}
        usuario={accessModalUser}
      />

      <UsuarioModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        usuario={selectedUsuario}
        loading={saving}
        isNew={isNew}
        initialPermissions={selectedPermissions}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Excluir Usuário"
        description={`Tem certeza que deseja excluir o usuário "${selectedUsuario?.nome}"? Isso removerá o acesso do usuário ao sistema.`}
      />

      <DeleteConfirmDialog
        open={bulkDeactivateDialogOpen}
        onOpenChange={setBulkDeactivateDialogOpen}
        onConfirm={handleBulkDeactivate}
        loading={saving}
        title="Desativar Usuários"
        description={`Tem certeza que deseja desativar ${selectedIds.size} usuário(s) selecionado(s)?`}
      />

      <DeleteConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        loading={saving}
        title="Excluir Usuários"
        description={`Tem certeza que deseja excluir permanentemente ${selectedIds.size} usuário(s) selecionado(s)? Esta ação não pode ser desfeita.`}
      />

      {/* ── Dialog: Adicionar Responsável RDO ──────────────────────────────── */}
      <Dialog open={rdoAddOpen} onOpenChange={(o) => { setRdoAddOpen(o); if (!o) { setRdoMagicLink(null); setRdoNome(''); setRdoEmail(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              {rdoMagicLink ? 'Link de Acesso Gerado' : 'Novo Responsável RDO'}
            </DialogTitle>
          </DialogHeader>

          {!rdoMagicLink ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={rdoNome}
                  onChange={e => setRdoNome(e.target.value)}
                  placeholder="Ex: João Silva"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={rdoEmail}
                  onChange={e => setRdoEmail(e.target.value)}
                  placeholder="responsavel@empresa.com"
                  onKeyDown={e => e.key === 'Enter' && handleRdoAdd()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRdoAddOpen(false)}>Cancelar</Button>
                <Button onClick={handleRdoAdd} disabled={rdoSaving} className="gap-2">
                  {rdoSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {rdoSaving ? 'Cadastrando...' : 'Cadastrar e Gerar Link'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-2 p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30">
                <Check className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  Responsável cadastrado! Envie o link para que ele acesse o portal RDO. O link expira em <strong>1 hora</strong>.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Link de acesso (válido por 1 hora)</Label>
                <div className="flex gap-2">
                  <Input value={rdoMagicLink} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" onClick={copyRdoLink}>
                    {rdoCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={openRdoWhatsApp} className="gap-2">
                  <Send className="w-4 h-4 text-green-600" />
                  WhatsApp
                </Button>
                <Button variant="outline" onClick={() => {
                  const subject = encodeURIComponent('Acesso ao Portal RDO');
                  const body = encodeURIComponent(`Olá!\n\nSeu acesso ao portal RDO foi criado. Clique no link abaixo para entrar:\n\n${rdoMagicLink}\n\nO link expira em 1 hora.`);
                  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                }} className="gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  E-mail
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setRdoAddOpen(false); setRdoMagicLink(null); setRdoNome(''); setRdoEmail(''); }} className="w-full">
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar remoção Responsável RDO ─────────────────────── */}
      <AlertDialog open={!!rdoDeleteTarget} onOpenChange={o => !o && setRdoDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover responsável RDO?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{rdoDeleteTarget?.nome}</strong> perderá o acesso ao portal RDO. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRdoDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Reusable link row with copy + open buttons */
function LinkRow({ label, url, toast }: { label: string; url: string; toast: any }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}:</span>
      <code className="flex-1 bg-muted px-3 py-2 rounded text-xs md:text-sm truncate">{url}</code>
      <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => {
        navigator.clipboard.writeText(url);
        toast({ title: 'Link copiado!' });
      }}>
        <Copy className="w-3.5 h-3.5" />
      </Button>
      <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => window.open(url, '_blank')}>
        <ExternalLink className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
