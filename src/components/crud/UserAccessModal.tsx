import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, LayoutDashboard, Truck, Mountain, Droplets, FlaskConical, HardHat, Package, CheckCircle2, XCircle, Smartphone, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_MODULES, MODULE_LABELS } from '@/hooks/useModulePermissions';
import { ALL_SUBMENUS, MODULE_LABELS_SUBMENU, SUBMENU_MODULES } from '@/hooks/useSubmenuPermissions';

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  tipo: string;
}

interface UserAccessModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuario: Profile | null;
}

// Seções do sistema (sidebar desktop) agrupadas
const SYSTEM_SECTIONS = [
  {
    group: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-primary',
    bg: 'bg-primary/10',
    sections: [
      { key: 'dashboard', label: 'Dashboard Principal' },
    ],
  },
  {
    group: 'Operação',
    icon: Truck,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    sections: [
      { key: 'carga', label: 'Carga' },
      { key: 'lancamento', label: 'Lançamento' },
      { key: 'descarga', label: 'Descarga' },
      { key: 'pipas', label: 'Pipas' },
    ],
  },
  {
    group: 'Pedreira',
    icon: Mountain,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    sections: [
      { key: 'pedreira', label: 'Pedreira' },
    ],
  },
  {
    group: 'CAL',
    icon: FlaskConical,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    sections: [
      { key: 'cal', label: 'CAL' },
    ],
  },
  {
    group: 'Engenharia',
    icon: HardHat,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    sections: [
      { key: 'engenharia_rdo', label: 'RDO - Relatórios' },
      { key: 'engenharia_etapas', label: 'RDO - Etapas' },
      { key: 'engenharia_responsaveis', label: 'RDO - Responsáveis' },
    ],
  },
  {
    group: 'Relatórios',
    icon: Package,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    sections: [
      { key: 'relatorio_caminhoes', label: 'Produção Caminhões' },
      { key: 'relatorio_escavadeiras', label: 'Produção Escavadeiras' },
      { key: 'relatorio_pedreira', label: 'Produção Pedreira' },
      { key: 'relatorio_pipas', label: 'Produção Pipas' },
      { key: 'relatorio_divergencia', label: 'Divergência Carga/Descarga' },
      { key: 'relatorio_historico', label: 'Histórico Veículo' },
      { key: 'relatorio_frota', label: 'Frota' },
    ],
  },
  {
    group: 'Cadastros',
    icon: Shield,
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    sections: [
      { key: 'cadastro_equipamentos', label: 'Equipamentos' },
      { key: 'cadastro_locais', label: 'Locais' },
      { key: 'cadastro_materiais', label: 'Materiais' },
      { key: 'cadastro_fornecedores', label: 'Fornecedores' },
      { key: 'cadastro_obra', label: 'Obra' },
      { key: 'cadastro_apontadores', label: 'Apontadores' },
      { key: 'cadastro_usuarios', label: 'Usuários' },
    ],
  },
];

// Submenu groups for mobile
const SUBMENU_GROUPS = SUBMENU_MODULES.map(mod => ({
  module: mod,
  label: MODULE_LABELS_SUBMENU[mod],
  items: ALL_SUBMENUS.filter(s => s.module === mod),
}));

const SUBMENU_ICONS: Record<string, React.ElementType> = {
  apropriacao: Truck,
  pedreira: Mountain,
  pipas: Droplets,
  cal: FlaskConical,
};

type Permissions = Record<string, boolean>;

function getAllSectionKeys() {
  return SYSTEM_SECTIONS.flatMap(g => g.sections.map(s => s.key));
}

export function UserAccessModal({ open, onOpenChange, usuario }: UserAccessModalProps) {
  const [permissions, setPermissions] = useState<Permissions>({});
  const [submenuPerms, setSubmenuPerms] = useState<Permissions>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('menus');

  const isFullAdmin = usuario?.tipo === 'Administrador';

  const loadPermissions = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);

    // Load menu permissions
    const { data: menuData } = await supabase
      .from('user_permissions')
      .select('module, enabled')
      .eq('user_id', usuario.user_id);

    const perms: Permissions = {};
    getAllSectionKeys().forEach(k => (perms[k] = true));
    ALL_MODULES.forEach(m => (perms[m] = true));
    menuData?.forEach((p: { module: string; enabled: boolean }) => {
      perms[p.module] = p.enabled;
    });
    setPermissions(perms);

    // Load submenu permissions
    const { data: subData } = await supabase
      .from('user_submenu_permissions')
      .select('submenu_key, enabled')
      .eq('user_id', usuario.user_id);

    const sPerms: Permissions = {};
    ALL_SUBMENUS.forEach(s => (sPerms[s.key] = true));
    subData?.forEach((p: { submenu_key: string; enabled: boolean }) => {
      sPerms[p.submenu_key] = p.enabled;
    });
    setSubmenuPerms(sPerms);

    setLoading(false);
  }, [usuario]);

  useEffect(() => {
    if (open && usuario) {
      loadPermissions();
      setActiveTab('menus');
    }
  }, [open, usuario, loadPermissions]);

  const toggle = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSubmenu = (key: string) => {
    setSubmenuPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleGroup = (keys: string[], value: boolean) => {
    setPermissions(prev => {
      const next = { ...prev };
      keys.forEach(k => (next[k] = value));
      return next;
    });
  };

  const toggleSubmenuGroup = (keys: string[], value: boolean) => {
    setSubmenuPerms(prev => {
      const next = { ...prev };
      keys.forEach(k => (next[k] = value));
      return next;
    });
  };

  const handleSave = async () => {
    if (!usuario) return;
    setSaving(true);
    try {
      // Save menu permissions
      await supabase.from('user_permissions').delete().eq('user_id', usuario.user_id);
      const menuInsert = Object.entries(permissions)
        .filter(([_, v]) => !v)
        .map(([module, enabled]) => ({ user_id: usuario.user_id, module, enabled }));
      if (menuInsert.length > 0) {
        const { error } = await supabase.from('user_permissions').insert(menuInsert);
        if (error) throw error;
      }

      // Save submenu permissions
      await supabase.from('user_submenu_permissions').delete().eq('user_id', usuario.user_id);
      const subInsert = Object.entries(submenuPerms)
        .filter(([_, v]) => !v)
        .map(([submenu_key, enabled]) => ({ user_id: usuario.user_id, submenu_key, enabled }));
      if (subInsert.length > 0) {
        const { error } = await supabase.from('user_submenu_permissions').insert(subInsert);
        if (error) throw error;
      }

      toast.success(`Permissões de ${usuario.nome} salvas com sucesso!`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  const enableAll = () => {
    const all: Permissions = {};
    getAllSectionKeys().forEach(k => (all[k] = true));
    ALL_MODULES.forEach(m => (all[m] = true));
    setPermissions(all);
  };

  const disableAll = () => {
    const all: Permissions = {};
    getAllSectionKeys().forEach(k => (all[k] = false));
    ALL_MODULES.forEach(m => (all[m] = false));
    setPermissions(all);
  };

  const enableAllSubmenus = () => {
    const all: Permissions = {};
    ALL_SUBMENUS.forEach(s => (all[s.key] = true));
    setSubmenuPerms(all);
  };

  const disableAllSubmenus = () => {
    const all: Permissions = {};
    ALL_SUBMENUS.forEach(s => (all[s.key] = false));
    setSubmenuPerms(all);
  };

  const enabledCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = Object.keys(permissions).length;
  const subEnabledCount = Object.values(submenuPerms).filter(Boolean).length;
  const subTotalCount = Object.keys(submenuPerms).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Permissões de Acesso
            {usuario && (
              <Badge variant="outline" className="ml-1 font-normal text-xs">
                {usuario.nome}
              </Badge>
            )}
          </DialogTitle>
          {usuario && (
            <p className="text-sm text-muted-foreground">
              {usuario.email} · <span className="font-medium">{usuario.tipo}</span>
            </p>
          )}
        </DialogHeader>

        {isFullAdmin ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-semibold">Acesso Completo</p>
              <p className="text-sm text-muted-foreground">
                Administradores têm acesso irrestrito a todos os menus e funcionalidades.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="shrink-0 grid w-full grid-cols-2">
              <TabsTrigger value="menus" className="gap-1.5">
                <Monitor className="w-4 h-4" />
                Menus Desktop
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{enabledCount}/{totalCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="submenus" className="gap-1.5">
                <Smartphone className="w-4 h-4" />
                Submenus Mobile
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{subEnabledCount}/{subTotalCount}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Menus Desktop Tab */}
            <TabsContent value="menus" className="flex-1 flex flex-col overflow-hidden mt-3">
              <div className="shrink-0 flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2 border mb-3">
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{enabledCount}</span>/{totalCount} seções
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={enableAll} className="h-6 text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Tudo
                  </Button>
                  <Button variant="outline" size="sm" onClick={disableAll} className="h-6 text-[10px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                    <XCircle className="w-3 h-3" /> Nenhum
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {SYSTEM_SECTIONS.map(group => {
                  const keys = group.sections.map(s => s.key);
                  const allEnabled = keys.every(k => permissions[k] !== false);
                  const noneEnabled = keys.every(k => permissions[k] === false);
                  const Icon = group.icon;

                  return (
                    <div key={group.group} className="border rounded-xl overflow-hidden">
                      <div className={`flex items-center justify-between px-3 py-2 ${group.bg} border-b`}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${group.color}`} />
                          <span className={`font-semibold text-xs ${group.color}`}>{group.group}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {keys.filter(k => permissions[k] !== false).length}/{keys.length}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 text-green-700 hover:bg-green-100" onClick={() => toggleGroup(keys, true)} disabled={allEnabled}>
                            Todos
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 text-red-700 hover:bg-red-100" onClick={() => toggleGroup(keys, false)} disabled={noneEnabled}>
                            Nenhum
                          </Button>
                        </div>
                      </div>
                      <div className="divide-y">
                        {group.sections.map(section => (
                          <div key={section.key} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${permissions[section.key] !== false ? 'bg-green-500' : 'bg-red-400'}`} />
                              <span className="text-xs">{section.label}</span>
                            </div>
                            <Switch
                              checked={permissions[section.key] !== false}
                              onCheckedChange={() => toggle(section.key)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Submenus Mobile Tab */}
            <TabsContent value="submenus" className="flex-1 flex flex-col overflow-hidden mt-3">
              <div className="shrink-0 flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2 border mb-3">
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{subEnabledCount}</span>/{subTotalCount} submenus
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={enableAllSubmenus} className="h-6 text-[10px] gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Tudo
                  </Button>
                  <Button variant="outline" size="sm" onClick={disableAllSubmenus} className="h-6 text-[10px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                    <XCircle className="w-3 h-3" /> Nenhum
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {SUBMENU_GROUPS.map(group => {
                  const keys = group.items.map(s => s.key);
                  const allEnabled = keys.every(k => submenuPerms[k] !== false);
                  const noneEnabled = keys.every(k => submenuPerms[k] === false);
                  const Icon = SUBMENU_ICONS[group.module] || Package;

                  return (
                    <div key={group.module} className="border rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold text-xs">{group.label}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {keys.filter(k => submenuPerms[k] !== false).length}/{keys.length}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 text-green-700 hover:bg-green-100" onClick={() => toggleSubmenuGroup(keys, true)} disabled={allEnabled}>
                            Todos
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 text-red-700 hover:bg-red-100" onClick={() => toggleSubmenuGroup(keys, false)} disabled={noneEnabled}>
                            Nenhum
                          </Button>
                        </div>
                      </div>
                      <div className="divide-y">
                        {group.items.map(item => (
                          <div key={item.key} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${submenuPerms[item.key] !== false ? 'bg-green-500' : 'bg-red-400'}`} />
                              <span className="text-xs">{item.label}</span>
                            </div>
                            <Switch
                              checked={submenuPerms[item.key] !== false}
                              onCheckedChange={() => toggleSubmenu(item.key)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {!isFullAdmin && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Permissões'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}