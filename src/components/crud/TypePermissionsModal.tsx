import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Eye, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  useManageTypePermissions, 
  ADMIN_SECTIONS, 
  ADMIN_USER_TYPES,
  TypePermissions,
  AdminUserType
} from '@/hooks/useAdminPermissions';

interface TypePermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TypePermissionsModal({ open, onOpenChange }: TypePermissionsModalProps) {
  const { toast } = useToast();
  const { getTypePermissions, setTypePermissions, loading } = useManageTypePermissions();
  
  const [selectedType, setSelectedType] = useState<AdminUserType>('Gerencia');
  const [permissions, setPermissions] = useState<TypePermissions>({});
  const [loadingPerms, setLoadingPerms] = useState(false);

  // Load permissions when type changes
  useEffect(() => {
    const load = async () => {
      setLoadingPerms(true);
      const perms = await getTypePermissions(selectedType);
      setPermissions(perms);
      setLoadingPerms(false);
    };
    
    if (open) {
      load();
    }
  }, [selectedType, open, getTypePermissions]);

  const handleToggleView = (section: string) => {
    setPermissions(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        can_view: !prev[section]?.can_view,
        // If disabling view, also disable edit
        can_edit: !prev[section]?.can_view ? prev[section]?.can_edit : false,
      },
    }));
  };

  const handleToggleEdit = (section: string) => {
    setPermissions(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        can_edit: !prev[section]?.can_edit,
        // If enabling edit, also enable view
        can_view: !prev[section]?.can_edit ? true : prev[section]?.can_view,
      },
    }));
  };

  const handleSave = async () => {
    const success = await setTypePermissions(selectedType, permissions);
    if (success) {
      toast({
        title: 'Permissões salvas',
        description: `Permissões de ${selectedType} atualizadas com sucesso.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar as permissões.',
      });
    }
  };

  // Types that can be edited (not Administrador or Sala Técnica which always have full access)
  const editableTypes = ADMIN_USER_TYPES.filter(t => !['Administrador', 'Sala Técnica'].includes(t));

  const getTypeDescription = (type: AdminUserType): string => {
    switch (type) {
      case 'Gerencia':
        return 'Acesso completo a todas as seções do sistema';
      case 'Engenharia':
        return 'Visualização de relatórios e dados operacionais';
      case 'Almoxarifado':
        return 'Gestão de materiais, estoque e controle de CAL';
      case 'Qualidade':
        return 'Controle de qualidade e acompanhamento operacional';
      default:
        return 'Acesso personalizado';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Permissões por Tipo de Usuário
          </DialogTitle>
          <DialogDescription>
            Configure quais seções cada tipo de usuário pode visualizar e editar.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as AdminUserType)} className="flex flex-col min-h-0 flex-1">
          <TabsList className="flex w-full overflow-x-auto shrink-0">
            {editableTypes.map(type => (
              <TabsTrigger key={type} value={type} className="text-sm flex-1 min-w-[80px]">
                {type}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="overflow-y-auto flex-1 min-h-0 mt-4">
            {editableTypes.map(type => (
              <TabsContent key={type} value={type} className="space-y-3 mt-0">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {getTypeDescription(type)}
                  </p>
                </div>

                {loadingPerms ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr,80px,80px] gap-2 px-3 py-2 bg-muted/30 rounded-lg text-sm font-medium">
                      <span>Seção</span>
                      <span className="text-center flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3" /> Ver
                      </span>
                      <span className="text-center flex items-center justify-center gap-1">
                        <Pencil className="w-3 h-3" /> Editar
                      </span>
                    </div>

                    {ADMIN_SECTIONS.map(section => (
                      <div 
                        key={section.key} 
                        className="grid grid-cols-[1fr,80px,80px] gap-2 items-center px-3 py-2 border rounded-lg"
                      >
                        <Label className="font-normal">{section.label}</Label>
                        <div className="flex justify-center">
                          <Switch
                            checked={permissions[section.key]?.can_view ?? false}
                            onCheckedChange={() => handleToggleView(section.key)}
                            disabled={loading}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Switch
                            checked={permissions[section.key]?.can_edit ?? false}
                            onCheckedChange={() => handleToggleEdit(section.key)}
                            disabled={loading || !permissions[section.key]?.can_view}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </div>
        </Tabs>

        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">Nota</Badge>
          <span>
            Administrador e Sala Técnica sempre têm acesso completo e não podem ser modificados.
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Fechar
          </Button>
          <Button onClick={handleSave} disabled={loading || loadingPerms}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Permissões'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
