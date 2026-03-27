import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, Search, Pencil, UserX, Loader2, Shield, Copy, Share2, Smartphone, Settings, Key, MapPin, Eye, Edit3, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { useManagePermissions, ALL_MODULES, MODULE_LABELS, ModuleName } from '@/hooks/useModulePermissions';
import { useManageLocalPermissions } from '@/hooks/useLocalPermissions';
import { useManageFieldPermissions, MODULE_FIELDS, FieldPermissionsMap } from '@/hooks/useFieldPermissions';
import { useManageEquipmentPermissions, EquipmentType } from '@/hooks/useEquipmentPermissions';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useManageSubmenuPermissions, ALL_SUBMENUS, SUBMENU_MODULES, MODULE_LABELS_SUBMENU } from '@/hooks/useSubmenuPermissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface LocalPermission {
  local_id: string;
  local_nome: string;
  enabled: boolean;
}

interface AllFieldPermissions {
  [module: string]: FieldPermissionsMap;
}

interface EquipmentPermissionUI {
  prefixo: string;
  enabled: boolean;
}

export default function Apontadores() {
  const [apontadores, setApontadores] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedApontador, setSelectedApontador] = useState<Profile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modulePermissions, setModulePermissions] = useState<ModulePermissions>({});
  const [localPermissions, setLocalPermissions] = useState<LocalPermission[]>([]);
  const [fieldPermissions, setFieldPermissions] = useState<AllFieldPermissions>({});
  const [escavadeiraPermissions, setEscavadeiraPermissions] = useState<EquipmentPermissionUI[]>([]);
  const [caminhaoPermissions, setCaminhaoPermissions] = useState<EquipmentPermissionUI[]>([]);
  const [submenuPermissions, setSubmenuPermissions] = useState<{ [key: string]: boolean }>({});
  const [allEscavadeiras, setAllEscavadeiras] = useState<string[]>([]);
  const [allCaminhoes, setAllCaminhoes] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();
  const { isAdmin, profile } = useAuth();
  const { getUserPermissions, setUserPermissions } = useManagePermissions();
  const { getUserLocalPermissions, setUserLocalPermissions } = useManageLocalPermissions();
  const { getUserFieldPermissions, setUserFieldPermissions } = useManageFieldPermissions();
  const { getUserEquipmentPermissions, setUserEquipmentPermissions } = useManageEquipmentPermissions();
  const { readSheet } = useGoogleSheets();
  const { getUserSubmenuPermissions, setUserSubmenuPermissions } = useManageSubmenuPermissions();

  // Form state for new/edit apontador
  const [formData, setFormData] = useState({
    nome: '',
    usuario: '',
    password: '',
    status: 'ativo',
  });

  const appUrl = window.location.origin + '/mobile';

  useEffect(() => {
    loadApontadores();
  }, []);

  const loadApontadores = async () => {
    try {
      // Load only field workers: Apontador, Supervisor, Encarregado
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('tipo', ['Apontador', 'Supervisor', 'Encarregado'])
        .order('nome');

      if (error) throw error;
      setApontadores(data || []);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar apontadores',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedApontador) {
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            nome: formData.nome,
            usuario: formData.usuario.toLowerCase().trim(),
            status: formData.status,
          })
          .eq('id', selectedApontador.id);

        if (profileError) throw profileError;

        toast({ title: 'Sucesso', description: 'Apontador atualizado com sucesso' });
      } else {
        // Create new user via edge function
        const { data: sessionData } = await supabase.auth.getSession();
        
        const response = await supabase.functions.invoke('create-user', {
          body: {
            nome: formData.nome,
            usuario: formData.usuario.toLowerCase().trim(),
            password: formData.password,
            tipo: 'Apontador',
            status: formData.status,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Erro ao criar usuário');
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }

        toast({ title: 'Sucesso', description: 'Apontador criado com sucesso' });
      }
      setModalOpen(false);
      setSelectedApontador(null);
      resetForm();
      loadApontadores();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao salvar apontador',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedApontador) return;
    setSaving(true);
    try {
      // Update status to inactive instead of deleting
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inativo' })
        .eq('id', selectedApontador.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Apontador desativado com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedApontador(null);
      loadApontadores();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao desativar apontador',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDeactivate = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`Confirma desativar ${ids.length} apontador(es) selecionado(s)?`)) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inativo' })
        .in('id', ids);

      if (error) throw error;

      toast({ title: 'Sucesso', description: `${ids.length} apontador(es) desativado(s)` });
      setSelectedIds(new Set());
      loadApontadores();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao desativar apontadores',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`ATENÇÃO: Esta ação é PERMANENTE!\n\nConfirma EXCLUIR definitivamente ${ids.length} apontador(es) selecionado(s)?`)) {
      return;
    }

    setSaving(true);
    try {
      // Get user_ids for the selected profiles
      const selectedProfiles = apontadores.filter(a => ids.includes(a.id));
      const userIds = selectedProfiles.map(p => p.user_id);

      // Delete user roles first
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Delete user permissions
      await supabase
        .from('user_permissions')
        .delete()
        .in('user_id', userIds);

      // Delete user location permissions
      await supabase
        .from('user_location_permissions')
        .delete()
        .in('user_id', userIds);

      // Delete user field permissions
      await supabase
        .from('user_field_permissions')
        .delete()
        .in('user_id', userIds);

      // Delete profiles
      const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .in('id', ids);

      if (profilesError) throw profilesError;

      toast({ title: 'Sucesso', description: `${ids.length} apontador(es) excluído(s) permanentemente` });
      setSelectedIds(new Set());
      loadApontadores();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao excluir apontadores',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      usuario: '',
      password: '',
      status: 'ativo',
    });
  };

  const openEditModal = (apontador: Profile) => {
    setSelectedApontador(apontador);
    setFormData({
      nome: apontador.nome,
      usuario: apontador.usuario || '',
      password: '',
      status: apontador.status,
    });
    setIsNew(false);
    setModalOpen(true);
  };

  const openPermissionsModal = async (apontador: Profile) => {
    setSelectedApontador(apontador);
    setPermissionsLoading(true);
    setPermissionsModalOpen(true);
    
    try {
      // Load module permissions from Supabase
      const modPerms = await getUserPermissions(apontador.user_id);
      setModulePermissions(modPerms);
      
      // Load local permissions from Supabase
      const locPerms = await getUserLocalPermissions(apontador.user_id);
      setLocalPermissions(locPerms);
      
      // Load field permissions for each module
      const fieldPerms: AllFieldPermissions = {};
      for (const module of ALL_MODULES) {
        fieldPerms[module] = await getUserFieldPermissions(apontador.user_id, module);
      }
      setFieldPermissions(fieldPerms);
      
      // Load equipment from Google Sheets
      const equipData = await readSheet('Equipamentos');
      const caminhaoData = await readSheet('Caminhao');
      
      // Parse escavadeiras
      if (equipData && equipData.length > 1) {
        const headers = equipData[0];
        const prefixIdx = headers.findIndex((h: string) => h?.toLowerCase().includes('prefixo'));
        const escavadeiraPrefixes = equipData.slice(1)
          .map((row: any[]) => row[prefixIdx >= 0 ? prefixIdx : 0])
          .filter(Boolean) as string[];
        setAllEscavadeiras(escavadeiraPrefixes);
        
        // Get current permissions for escavadeiras
        const escavPerms = await getUserEquipmentPermissions(apontador.user_id, 'escavadeira', escavadeiraPrefixes);
        setEscavadeiraPermissions(escavPerms);
      }
      
      // Parse caminhoes
      if (caminhaoData && caminhaoData.length > 1) {
        const headers = caminhaoData[0];
        const prefixIdx = headers.findIndex((h: string) => h?.toLowerCase().includes('prefixo'));
        const caminhaoPrefixes = caminhaoData.slice(1)
          .map((row: any[]) => row[prefixIdx >= 0 ? prefixIdx : 0])
          .filter(Boolean) as string[];
        setAllCaminhoes(caminhaoPrefixes);
        
        // Get current permissions for caminhoes
        const camPerms = await getUserEquipmentPermissions(apontador.user_id, 'caminhao', caminhaoPrefixes);
        setCaminhaoPermissions(camPerms);
      }
      
      // Load submenu permissions
      const subPerms = await getUserSubmenuPermissions(apontador.user_id);
      setSubmenuPermissions(subPerms);
    } catch (error) {
      console.error('Error loading permissions:', error);
      const defaultModPerms: ModulePermissions = {};
      ALL_MODULES.forEach(m => defaultModPerms[m] = true);
      setModulePermissions(defaultModPerms);
      setLocalPermissions([]);
      setFieldPermissions({});
      setEscavadeiraPermissions([]);
      setCaminhaoPermissions([]);
      const defSub: { [key: string]: boolean } = {};
      ALL_SUBMENUS.forEach(s => defSub[s.key] = true);
      setSubmenuPermissions(defSub);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedApontador) return;
    setSaving(true);
    
    try {
      // Save module permissions
      const moduleSuccess = await setUserPermissions(selectedApontador.user_id, modulePermissions);
      
      // Save local permissions
      const localPermsMap: { [key: string]: boolean } = {};
      localPermissions.forEach(lp => {
        localPermsMap[lp.local_id] = lp.enabled;
      });
      const localSuccess = await setUserLocalPermissions(selectedApontador.user_id, localPermsMap);
      
      // Save field permissions for each module
      let fieldSuccess = true;
      for (const module of ALL_MODULES) {
        if (fieldPermissions[module]) {
          const success = await setUserFieldPermissions(
            selectedApontador.user_id, 
            module, 
            fieldPermissions[module]
          );
          if (!success) fieldSuccess = false;
        }
      }
      
      // Save equipment permissions
      const escavPermsMap: { [key: string]: boolean } = {};
      escavadeiraPermissions.forEach(ep => {
        escavPermsMap[ep.prefixo] = ep.enabled;
      });
      const escavSuccess = await setUserEquipmentPermissions(selectedApontador.user_id, 'escavadeira', escavPermsMap);
      
      const camPermsMap: { [key: string]: boolean } = {};
      caminhaoPermissions.forEach(cp => {
        camPermsMap[cp.prefixo] = cp.enabled;
      });
      const camSuccess = await setUserEquipmentPermissions(selectedApontador.user_id, 'caminhao', camPermsMap);
      
      // Save submenu permissions
      const submenuSuccess = await setUserSubmenuPermissions(selectedApontador.user_id, submenuPermissions);
      
      if (moduleSuccess && localSuccess && fieldSuccess && escavSuccess && camSuccess && submenuSuccess) {
        toast({ title: 'Sucesso', description: 'Permissões salvas com sucesso' });
        setPermissionsModalOpen(false);
      } else {
        throw new Error('Erro ao salvar permissões');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao salvar permissões',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldPermission = (module: string, fieldName: string, type: 'visible' | 'editable') => {
    setFieldPermissions(prev => {
      const modulePerms = prev[module] || {};
      const fieldPerm = modulePerms[fieldName] || { visible: true, editable: true };
      
      return {
        ...prev,
        [module]: {
          ...modulePerms,
          [fieldName]: {
            ...fieldPerm,
            [type]: !fieldPerm[type],
            // If making invisible, also make not editable
            ...(type === 'visible' && fieldPerm[type] ? { editable: false } : {}),
          },
        },
      };
    });
  };

  const openPasswordModal = (apontador: Profile) => {
    setSelectedApontador(apontador);
    setNewPassword('');
    setPasswordModalOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedApontador || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
      });
      return;
    }
    
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('update-password', {
        body: {
          user_id: selectedApontador.user_id,
          new_password: newPassword,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao alterar senha');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso' });
      setPasswordModalOpen(false);
      setNewPassword('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao alterar senha',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (apontador: Profile) => {
    if (!confirm(`Resetar a senha de "${apontador.nome}" para a senha padrão do sistema (apropriapp@2024)?`)) {
      return;
    }

    setSaving(true);
    try {
      const response = await supabase.functions.invoke('update-password', {
        body: {
          user_id: apontador.user_id,
          new_password: 'apropriapp@2024',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao resetar senha');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      console.log(`[RESET SENHA] Sucesso: ${apontador.nome} (${apontador.usuario || apontador.email})`);
      toast({
        title: 'Sucesso',
        description: `Senha de "${apontador.nome}" resetada para: apropriapp@2024`,
      });
    } catch (error: any) {
      console.error(`[RESET SENHA] Erro: ${apontador.nome} - ${error.message}`);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao resetar senha',
      });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (apontador: Profile) => {
    setSelectedApontador(apontador);
    setDeleteDialogOpen(true);
  };

  const openNewModal = () => {
    setSelectedApontador(null);
    resetForm();
    setIsNew(true);
    setModalOpen(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(appUrl);
    toast({ title: 'Link copiado!', description: 'Compartilhe com os apontadores.' });
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ApropriAPP - App Mobile',
          text: 'Instale o ApropriAPP para apontamento em campo',
          url: appUrl,
        });
      } catch (err) {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const resetAllPasswords = async () => {
    if (!confirm('Confirma resetar as senhas de todos os apontadores para a senha padrão do sistema?')) {
      return;
    }
    
    setSaving(true);
    try {
      const response = await supabase.functions.invoke('reset-apontadores-passwords', {
        body: {},
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao resetar senhas');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Sucesso',
        description: response.data?.message || 'Senhas resetadas com sucesso',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao resetar senhas',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredApontadores = apontadores.filter(a =>
    a.nome.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase())
  );

  // Only main admin (Jean) or users with tipo='Administrador' can manage apontadores
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
              : 'Apenas o Administrador Principal pode gerenciar apontadores.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cadastro de Apontadores</h1>
            <p className="text-muted-foreground">Cadastrar e gerenciar usuários do campo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2" onClick={openNewModal}>
            <Plus className="w-4 h-4" />
            Novo Apontador
          </Button>
          {selectedIds.size > 0 && (
            <>
              <Button variant="outline" className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50" onClick={handleBulkDeactivate} disabled={saving}>
                <UserX className="w-4 h-4" />
                Desativar ({selectedIds.size})
              </Button>
              <Button variant="destructive" className="gap-2" onClick={handleBulkDelete} disabled={saving}>
                <Trash2 className="w-4 h-4" />
                Excluir ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Share App Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Link do App Mobile</h3>
                <p className="text-sm text-muted-foreground">Compartilhe com os apontadores para instalação</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={appUrl}
                readOnly
                className="max-w-xs bg-background"
              />
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button onClick={shareLink} className="gap-2">
                <Share2 className="w-4 h-4" />
                Compartilhar
              </Button>
              <Button 
                onClick={resetAllPasswords} 
                variant="outline"
                className="gap-2 ml-4 border-amber-500 text-amber-600 hover:bg-amber-50"
                disabled={saving}
              >
                <Key className="w-4 h-4" />
                Resetar Todas as Senhas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredApontadores.length > 0 && selectedIds.size === filteredApontadores.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(filteredApontadores.map(a => a.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApontadores.map((apontador) => (
                  <TableRow key={apontador.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(apontador.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(apontador.id);
                            else next.delete(apontador.id);
                            return next;
                          });
                        }}
                        aria-label={`Selecionar ${apontador.nome}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{apontador.nome}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {apontador.usuario || '-'}
                    </TableCell>
                    <TableCell className="text-primary">{apontador.email}</TableCell>
                    <TableCell>
                      <Badge variant={apontador.status === 'ativo' ? 'default' : 'outline'} className={apontador.status === 'ativo' ? 'bg-green-500' : ''}>
                        {apontador.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openPermissionsModal(apontador)} title="Permissões">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openPasswordModal(apontador)} title="Alterar Senha">
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleResetPassword(apontador)} 
                        title="Resetar Senha (padrão)"
                        disabled={saving}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(apontador)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(apontador)} title="Desativar">
                        <UserX className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredApontadores.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum apontador cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New/Edit Apontador Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? 'Novo Apontador' : 'Editar Apontador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                onBlur={() => {
                  if (!formData.usuario && formData.nome) {
                    const generated = formData.nome
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/\s+/g, '.')
                      .replace(/[^a-z0-9.]/g, '');
                    setFormData(prev => ({ ...prev, usuario: generated }));
                  }
                }}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuario">Usuário (login)</Label>
              <Input
                id="usuario"
                value={formData.usuario}
                onChange={(e) => setFormData({ ...formData, usuario: e.target.value.toLowerCase().replace(/\s/g, '') })}
                placeholder="nome.sobrenome"
              />
              <p className="text-xs text-muted-foreground">
                Este será o login para acessar o app mobile
              </p>
            </div>
            {isNew && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
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
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isNew ? 'Cadastrar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={permissionsModalOpen} onOpenChange={setPermissionsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permissões de Acesso - {selectedApontador?.nome}
            </DialogTitle>
          </DialogHeader>
          
          {permissionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="modules" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="modules">Módulos</TabsTrigger>
                <TabsTrigger value="submenus">Submenus</TabsTrigger>
                <TabsTrigger value="locais">Locais</TabsTrigger>
                <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
                <TabsTrigger value="campos">Campos</TabsTrigger>
              </TabsList>
              
              <TabsContent value="modules" className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Configure os módulos que <strong>{selectedApontador?.nome}</strong> pode acessar:
                </p>
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    {ALL_MODULES.map((module) => (
                      <div key={module} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <span className="text-primary text-sm">
                              {module === 'carga' && '📦'}
                              {module === 'lancamento' && '📤'}
                              {module === 'pedreira' && '⛰️'}
                              {module === 'pipas' && '💧'}
                              {module === 'cal' && '🧪'}
                            </span>
                          </div>
                          <span className="font-medium">{MODULE_LABELS[module]}</span>
                        </div>
                        <Checkbox
                          checked={modulePermissions[module] !== false}
                          onCheckedChange={(checked) => 
                            setModulePermissions({ ...modulePermissions, [module]: !!checked })
                          }
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Submenus Tab */}
              <TabsContent value="submenus" className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Configure os submenus que <strong>{selectedApontador?.nome}</strong> pode ver no mobile:
                </p>
                <div className="space-y-4">
                    {SUBMENU_MODULES.map(mod => {
                      const moduleSubmenus = ALL_SUBMENUS.filter(s => s.module === mod);
                      const allEnabled = moduleSubmenus.every(s => submenuPermissions[s.key] !== false);
                      return (
                        <Card key={mod}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-base">{MODULE_LABELS_SUBMENU[mod]}</h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => {
                                  const newPerms = { ...submenuPermissions };
                                  moduleSubmenus.forEach(s => newPerms[s.key] = !allEnabled);
                                  setSubmenuPermissions(newPerms);
                                }}
                              >
                                {allEnabled ? 'Desmarcar todos' : 'Marcar todos'}
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {moduleSubmenus.map(sub => (
                                <div key={sub.key} className="flex items-center justify-between">
                                  <span className="text-sm">{sub.label}</span>
                                  <Checkbox
                                    checked={submenuPermissions[sub.key] !== false}
                                    onCheckedChange={(checked) =>
                                      setSubmenuPermissions({ ...submenuPermissions, [sub.key]: !!checked })
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </TabsContent>
              
              <TabsContent value="locais" className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Configure os locais que <strong>{selectedApontador?.nome}</strong> pode apontar:
                </p>
                <Card>
                  <ScrollArea className="h-[300px]">
                    <CardContent className="pt-4 space-y-3">
                      {localPermissions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          Nenhum local cadastrado
                        </p>
                      ) : (
                        localPermissions.map((lp) => (
                          <div key={lp.local_id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{lp.local_nome}</span>
                            </div>
                            <Checkbox
                              checked={lp.enabled}
                              onCheckedChange={(checked) => {
                                const updated = localPermissions.map(p => 
                                  p.local_id === lp.local_id ? { ...p, enabled: !!checked } : p
                                );
                                setLocalPermissions(updated);
                              }}
                            />
                          </div>
                        ))
                      )}
                    </CardContent>
                  </ScrollArea>
                </Card>
              </TabsContent>
              
              <TabsContent value="equipamentos" className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Configure quais equipamentos <strong>{selectedApontador?.nome}</strong> pode utilizar:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Escavadeiras */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        🚜 Escavadeiras
                      </CardTitle>
                    </CardHeader>
                    <ScrollArea className="h-[200px]">
                      <CardContent className="pt-2 space-y-2">
                        {escavadeiraPermissions.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4 text-sm">
                            Nenhuma escavadeira cadastrada
                          </p>
                        ) : (
                          escavadeiraPermissions.map((ep) => (
                            <div key={ep.prefixo} className="flex items-center justify-between">
                              <span className="text-sm">{ep.prefixo}</span>
                              <Checkbox
                                checked={ep.enabled}
                                onCheckedChange={(checked) => {
                                  const updated = escavadeiraPermissions.map(p => 
                                    p.prefixo === ep.prefixo ? { ...p, enabled: !!checked } : p
                                  );
                                  setEscavadeiraPermissions(updated);
                                }}
                              />
                            </div>
                          ))
                        )}
                      </CardContent>
                    </ScrollArea>
                  </Card>
                  
                  {/* Caminhões */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        🚛 Caminhões
                      </CardTitle>
                    </CardHeader>
                    <ScrollArea className="h-[200px]">
                      <CardContent className="pt-2 space-y-2">
                        {caminhaoPermissions.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4 text-sm">
                            Nenhum caminhão cadastrado
                          </p>
                        ) : (
                          caminhaoPermissions.map((cp) => (
                            <div key={cp.prefixo} className="flex items-center justify-between">
                              <span className="text-sm">{cp.prefixo}</span>
                              <Checkbox
                                checked={cp.enabled}
                                onCheckedChange={(checked) => {
                                  const updated = caminhaoPermissions.map(p => 
                                    p.prefixo === cp.prefixo ? { ...p, enabled: !!checked } : p
                                  );
                                  setCaminhaoPermissions(updated);
                                }}
                              />
                            </div>
                          ))
                        )}
                      </CardContent>
                    </ScrollArea>
                  </Card>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  ℹ️ Desmarque os equipamentos que este apontador NÃO deve utilizar. Por padrão, todos os equipamentos estão habilitados.
                </p>
              </TabsContent>
              <TabsContent value="campos" className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Configure quais campos são <strong>visíveis</strong> e <strong>editáveis</strong> para cada módulo:
                </p>
                <ScrollArea className="h-[400px] pr-4">
                  <Accordion type="multiple" className="w-full">
                    {ALL_MODULES.map((module) => {
                      const fields = MODULE_FIELDS[module] || [];
                      const modulePerms = fieldPermissions[module] || {};
                      
                      return (
                        <AccordionItem key={module} value={module}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">
                                {module === 'carga' && '📦'}
                                {module === 'lancamento' && '📤'}
                                {module === 'pedreira' && '⛰️'}
                                {module === 'pipas' && '💧'}
                                {module === 'cal' && '🧪'}
                              </span>
                              <span className="font-medium">{MODULE_LABELS[module]}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Card className="mt-2">
                              <CardContent className="pt-4">
                                <div className="grid grid-cols-[1fr,80px,80px] gap-2 mb-2 text-xs text-muted-foreground font-medium">
                                  <span>Campo</span>
                                  <span className="text-center flex items-center justify-center gap-1">
                                    <Eye className="w-3 h-3" /> Visível
                                  </span>
                                  <span className="text-center flex items-center justify-center gap-1">
                                    <Edit3 className="w-3 h-3" /> Editável
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {fields.map((field) => {
                                    const perm = modulePerms[field.name] || { visible: true, editable: true };
                                    return (
                                      <div key={field.name} className="grid grid-cols-[1fr,80px,80px] gap-2 items-center py-1 border-b border-border/50">
                                        <span className="text-sm">{field.label}</span>
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={perm.visible}
                                            onCheckedChange={() => toggleFieldPermission(module, field.name, 'visible')}
                                          />
                                        </div>
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={perm.editable}
                                            disabled={!perm.visible}
                                            onCheckedChange={() => toggleFieldPermission(module, field.name, 'editable')}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={savePermissions} disabled={saving || permissionsLoading}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Alterar Senha
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Defina uma nova senha para <strong>{selectedApontador?.nome}</strong>:
            </p>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={saving || !newPassword}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Desativar Apontador"
        description={`Tem certeza que deseja desativar o apontador "${selectedApontador?.nome}"?`}
      />
    </div>
  );
}
