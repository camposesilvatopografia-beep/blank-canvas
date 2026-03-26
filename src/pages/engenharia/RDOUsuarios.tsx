import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  UserPlus, Trash2, RefreshCw, Copy, Check, Mail, User, Send, Shield,
} from 'lucide-react';
import { toast } from 'sonner';

interface ResponsavelUser {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  status: string;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function RDOUsuarios() {
  const { session } = useAuth();
  const [users, setUsers] = useState<ResponsavelUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResponsavelUser | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, nome, email, status, created_at')
      .eq('tipo', 'Responsavel RDO')
      .order('nome');
    if (data) setUsers(data as ResponsavelUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const callInvite = async (action: string, body: object) => {
    const token = session?.access_token;
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

  const handleAdd = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('E-mail inválido');
      return;
    }
    setSaving(true);
    try {
      const data = await callInvite('invite', { nome: nome.trim(), email: email.trim().toLowerCase() });
      setMagicLink(data.magicLink || null);
      toast.success(`Responsável ${nome} cadastrado! Link de acesso gerado.`);
      fetchUsers();
      setNome('');
      setEmail('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async (user: ResponsavelUser) => {
    try {
      const data = await callInvite('resend', { email: user.email });
      setMagicLink(data.magicLink || null);
      setAddOpen(true);
      toast.success('Novo link de acesso gerado!');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await callInvite('delete', { userId: deleteTarget.user_id });
      toast.success('Usuário removido com sucesso');
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const copyLink = () => {
    if (!magicLink) return;
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copiado!');
  };

  const openWhatsApp = () => {
    if (!magicLink) return;
    const text = encodeURIComponent(`Olá! Seu acesso ao portal RDO foi criado. Clique no link abaixo para entrar:\n\n${magicLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const openEmail = (user: ResponsavelUser) => {
    if (!magicLink) return;
    const subject = encodeURIComponent('Acesso ao Portal RDO');
    const body = encodeURIComponent(`Olá ${user.nome},\n\nSeu acesso ao portal RDO foi criado. Clique no link abaixo para entrar:\n\n${magicLink}\n\nO link expira em 1 hora.\n\nAtenciosamente.`);
    window.open(`mailto:${user.email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários do Portal RDO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Responsáveis com acesso ao portal de visualização, assinatura e aprovação de RDOs.
          </p>
        </div>
        <Button onClick={() => { setAddOpen(true); setMagicLink(null); }} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Responsável
        </Button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Shield className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">Acesso por link mágico</p>
          <p className="mt-0.5 text-xs opacity-80">
            Cada responsável recebe um link único por e-mail ou WhatsApp. Ao clicar, acessa diretamente o portal sem precisar de senha. No portal, pode ver todos os RDOs, adicionar observações, assinar e aprovar/reprovar.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum responsável cadastrado</p>
          <p className="text-sm mt-1">Adicione o primeiro responsável clicando em "Novo Responsável".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {user.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{user.nome}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={user.status === 'ativo' ? 'default' : 'secondary'} className="text-xs">
                      {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResend(user)}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Novo Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(user)}
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
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

      {/* Add / Magic Link Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setMagicLink(null); setNome(''); setEmail(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{magicLink ? 'Link de Acesso Gerado' : 'Novo Responsável RDO'}</DialogTitle>
          </DialogHeader>

          {!magicLink ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: João Silva"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="responsavel@empresa.com"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                <Button onClick={handleAdd} disabled={saving} className="gap-2">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {saving ? 'Cadastrando...' : 'Cadastrar e Gerar Link'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-lg">
                <Check className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  Responsável cadastrado! Envie o link abaixo para que ele acesse o portal RDO. O link expira em <strong>1 hora</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Link de acesso (válido por 1 hora)</Label>
                <div className="flex gap-2">
                  <Input value={magicLink} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={openWhatsApp} className="gap-2">
                  <Send className="w-4 h-4 text-green-600" />
                  WhatsApp
                </Button>
                <Button variant="outline" onClick={() => openEmail({ nome, email } as ResponsavelUser)} className="gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  E-mail
                </Button>
              </div>

              <DialogFooter>
                <Button onClick={() => { setAddOpen(false); setMagicLink(null); setNome(''); setEmail(''); }} className="w-full">
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover responsável?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.nome}</strong> perderá o acesso ao portal RDO. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
