import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, AtSign, Package, Eye, EyeOff, CheckCircle2, XCircle, Users } from 'lucide-react';
import { ALL_MODULES, MODULE_LABELS, ModuleName } from '@/hooks/useModulePermissions';
import { supabase } from '@/integrations/supabase/client';

interface Usuario {
  id?: string;
  user_id?: string;
  nome: string;
  email: string;
  usuario?: string;
  tipo: string;
  status: string;
}

interface ModulePermissions {
  [key: string]: boolean;
}

interface UsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { 
    nome: string; 
    email: string; 
    usuario: string; 
    tipo: string; 
    status: string; 
    password?: string;
    permissions: ModulePermissions;
  }) => Promise<void>;
  usuario?: Usuario | null;
  loading?: boolean;
  isNew?: boolean;
  initialPermissions?: ModulePermissions;
}

interface ExistingUser {
  usuario: string;
  nome: string;
  tipo: string;
  email: string;
}

export function UsuarioModal({ 
  open, 
  onOpenChange, 
  onSave, 
  usuario, 
  loading = false, 
  isNew = false,
  initialPermissions 
}: UsuarioModalProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tipo, setTipo] = useState('Administrador');
  const [status, setStatus] = useState('ativo');
  const [permissions, setPermissions] = useState<ModulePermissions>({});
  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);
  const [showExistingUsers, setShowExistingUsers] = useState(false);

  // Load existing users when modal opens
  useEffect(() => {
    if (open && isNew) {
      loadExistingUsers();
    }
  }, [open, isNew]);

  const loadExistingUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('usuario, nome, tipo, email')
      .in('tipo', ['Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização'])
      .order('nome');
    
    if (data) {
      setExistingUsers(data as ExistingUser[]);
    }
  };

  // Check if email already exists
  const emailExists = useMemo(() => {
    if (!email || !isNew) return false;
    return existingUsers.some(u => u.email?.toLowerCase() === email.toLowerCase());
  }, [email, existingUsers, isNew]);

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome);
      setEmail(usuario.email || '');
      setUsername(usuario.usuario || '');
      setTipo(usuario.tipo);
      setStatus(usuario.status);
      setPassword('');
    } else {
      setNome('');
      setEmail('');
      setUsername('');
      setTipo('Administrador');
      setStatus('ativo');
      setPassword('');
    }
    setShowPassword(false);
  }, [usuario, open]);

  // Load initial permissions when editing
  useEffect(() => {
    if (initialPermissions) {
      setPermissions(initialPermissions);
    } else {
      // Default all modules to enabled
      const defaultPerms: ModulePermissions = {};
      ALL_MODULES.forEach(m => defaultPerms[m] = true);
      setPermissions(defaultPerms);
    }
  }, [initialPermissions, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate username from email if not provided
    const finalUsername = username || email.split('@')[0];
    
    await onSave({ 
      nome, 
      email, 
      usuario: finalUsername, 
      tipo, 
      status, 
      password: isNew ? password : undefined,
      permissions,
    });
  };


  const togglePermission = (module: ModuleName) => {
    setPermissions(prev => ({
      ...prev,
      [module]: !prev[module],
    }));
  };

  // Full access types (redirected to /dashboard)
  const isFullAccess = ['Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização'].includes(tipo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {usuario ? 'Editar Usuário' : 'Novo Usuário'}
            </div>
            {isNew && existingUsers.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowExistingUsers(!showExistingUsers)}
                className="text-xs gap-1"
              >
                <Users className="w-4 h-4" />
                {existingUsers.length} existentes
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Lista de usuários existentes (colapsável) */}
        {showExistingUsers && isNew && (
          <div className="p-3 bg-muted/50 rounded-lg border max-h-40 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">Usuários administrativos cadastrados:</p>
            <div className="flex flex-wrap gap-1.5">
              {existingUsers.map((u) => (
                <Badge key={u.usuario} variant="secondary" className="text-xs">
                  {u.usuario}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do usuário"
              required
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1">
              <AtSign className="w-3 h-3" />
              Email *
            </Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                placeholder="usuario@empresa.com"
                required
                disabled={loading}
                className={emailExists ? 'border-destructive pr-10' : email && !emailExists ? 'border-green-500 pr-10' : ''}
              />
              {isNew && email && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {emailExists ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                </div>
              )}
            </div>
            
            {/* Feedback de validação */}
            {isNew && email && (
              emailExists ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  ❌ Este email já está cadastrado!
                </p>
              ) : (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  ✅ Email disponível
                </p>
              )
            )}
            
            <p className="text-xs text-muted-foreground">
              O usuário fará login com este email e senha
            </p>
          </div>

          {/* Usuário (opcional - display name) */}
          <div className="space-y-2">
            <Label htmlFor="username">Usuário (opcional)</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => {
                let value = e.target.value.toLowerCase().replace(/\s/g, '');
                value = value.replace(/[^a-z0-9.]/g, '');
                setUsername(value);
              }}
              placeholder="Gerado automaticamente do email"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Se não informado, será gerado a partir do email
            </p>
          </div>

          {/* Senha (apenas para novo usuário) */}
          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Tipo / Permissão */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo / Permissão *</Label>
            <Select value={tipo} onValueChange={setTipo} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Administrador">Administrador</SelectItem>
                <SelectItem value="Sala Técnica">Sala Técnica</SelectItem>
                <SelectItem value="Gerencia">Gerência</SelectItem>
                <SelectItem value="Engenharia">Engenharia</SelectItem>
                <SelectItem value="Almoxarifado">Almoxarifado</SelectItem>
                <SelectItem value="Qualidade">Qualidade</SelectItem>
                <SelectItem value="Visualização">Visualização (Somente Leitura)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tipo === 'Visualização' 
                ? 'Acesso somente leitura — não poderá criar, editar ou excluir dados'
                : 'Todos os tipos administrativos têm acesso ao painel completo'}
            </p>
          </div>

          {/* Module Permissions */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Permissões de Módulos
            </Label>
            
            {isFullAccess ? (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">
                  {tipo} tem acesso completo a todos os módulos.
                </p>
              </div>
            ) : (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                {ALL_MODULES.map((module) => (
                  <div key={module} className="flex items-center justify-between py-1">
                    <Label htmlFor={`perm-${module}`} className="text-sm font-normal cursor-pointer">
                      {MODULE_LABELS[module]}
                    </Label>
                    <Switch
                      id={`perm-${module}`}
                      checked={permissions[module] !== false}
                      onCheckedChange={() => togglePermission(module)}
                      disabled={loading}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Desabilite módulos para restringir acesso no app mobile
                </p>
              </div>
            )}
          </div>

          {/* Status (apenas para edição) */}
          {!isNew && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !nome || !email || (isNew && password.length < 6) || (isNew && emailExists)}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}