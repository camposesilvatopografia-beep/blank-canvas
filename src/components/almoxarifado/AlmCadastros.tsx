import { useState } from 'react';
import { maskCPFCNPJ, maskPhone } from '@/utils/masks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, Building2, MapPin, Users, Phone, Mail } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

const fromTable = (t: string) => (supabase as any).from(t);

// ─── Generic CRUD hooks ───
function useCadastro<T extends { id: string }>(table: string, key: string) {
  const qc = useQueryClient();
  const query = useQuery<T[]>({
    queryKey: [key],
    queryFn: async () => {
      const { data, error } = await fromTable(table).select('*').order('nome');
      if (error) throw error;
      return data || [];
    },
  });
  const save = useMutation({
    mutationFn: async (item: Partial<T> & { id?: string }) => {
      if (item.id) {
        const { error } = await fromTable(table).update(item).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable(table).insert(item);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); toast.success('Salvo!'); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); toast.success('Excluído!'); },
    onError: (e: any) => toast.error(e.message),
  });
  return { ...query, save, remove };
}

// ─── Generic List Component ───
interface CadastroListProps {
  title: string;
  icon: React.ReactNode;
  items: any[];
  loading: boolean;
  columns: { key: string; label: string }[];
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}

function CadastroList({ title, icon, items, loading, columns, onAdd, onEdit, onDelete }: CadastroListProps) {
  const [search, setSearch] = useState('');
  const filtered = items.filter(i => i.nome?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={`Buscar ${title.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={onAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> Novo</Button>
      </div>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#1d3557' }}>
              {columns.map(c => <TableHead key={c.key} className="text-white font-bold">{c.label}</TableHead>)}
              <TableHead className="text-white font-bold text-center w-20">Status</TableHead>
              <TableHead className="text-white font-bold text-center w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>
            ) : filtered.map((item, i) => (
              <TableRow key={item.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                {columns.map(c => <TableCell key={c.key}>{item[c.key] || '—'}</TableCell>)}
                <TableCell className="text-center">
                  <Badge variant={item.status === 'Ativo' ? 'outline' : 'secondary'} className={item.status === 'Ativo' ? 'border-emerald-500 text-emerald-600' : ''}>
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    {item.telefone && (
                      <a href={`https://wa.me/55${item.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" title="WhatsApp"><Phone className="w-3.5 h-3.5" /></Button>
                      </a>
                    )}
                    {item.email && (
                      <a href={`mailto:${item.email}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" title="E-mail"><Mail className="w-3.5 h-3.5" /></Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Modal Fornecedor ───
function FornecedorModal({ open, onClose, item, onSave, saving }: { open: boolean; onClose: () => void; item: any; onSave: (d: any) => void; saving: boolean }) {
  const [form, setForm] = useState({ nome: '', cnpj: '', contato: '', telefone: '', email: '', observacoes: '', status: 'Ativo' });
  if (open && item && form.nome === '' && item.nome) {
    setForm({ nome: item.nome, cnpj: item.cnpj || '', contato: item.contato || '', telefone: item.telefone || '', email: item.email || '', observacoes: item.observacoes || '', status: item.status });
  }
  const handleSave = () => {
    if (!form.nome.trim()) return;
    onSave({ ...(item?.id ? { id: item.id } : {}), ...form });
  };
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setForm({ nome: '', cnpj: '', contato: '', telefone: '', email: '', observacoes: '', status: 'Ativo' }); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item?.id ? 'Editar' : 'Novo'} Fornecedor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
          <div><Label>CPF/CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: maskCPFCNPJ(e.target.value) }))} placeholder="000.000.000-00 ou 00.000.000/0000-00" maxLength={18} /></div>
          <div><Label>Contato</Label><Input value={form.contato} onChange={e => setForm(p => ({ ...p, contato: e.target.value }))} /></div>
          <div><Label>Telefone / WhatsApp</Label><Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: maskPhone(e.target.value) }))} placeholder="(99) 99999-9999" maxLength={15} /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Setor ───
function SetorModal({ open, onClose, item, onSave, saving }: { open: boolean; onClose: () => void; item: any; onSave: (d: any) => void; saving: boolean }) {
  const [form, setForm] = useState({ nome: '', responsavel: '', observacoes: '', status: 'Ativo' });
  if (open && item && form.nome === '' && item.nome) {
    setForm({ nome: item.nome, responsavel: item.responsavel || '', observacoes: item.observacoes || '', status: item.status });
  }
  const handleSave = () => {
    if (!form.nome.trim()) return;
    onSave({ ...(item?.id ? { id: item.id } : {}), ...form });
  };
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setForm({ nome: '', responsavel: '', observacoes: '', status: 'Ativo' }); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item?.id ? 'Editar' : 'Novo'} Setor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
          <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal Local de Uso ───
function LocalUsoModal({ open, onClose, item, onSave, saving }: { open: boolean; onClose: () => void; item: any; onSave: (d: any) => void; saving: boolean }) {
  const [form, setForm] = useState({ nome: '', descricao: '', status: 'Ativo' });
  if (open && item && form.nome === '' && item.nome) {
    setForm({ nome: item.nome, descricao: item.descricao || '', status: item.status });
  }
  const handleSave = () => {
    if (!form.nome.trim()) return;
    onSave({ ...(item?.id ? { id: item.id } : {}), ...form });
  };
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setForm({ nome: '', descricao: '', status: 'Ativo' }); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{item?.id ? 'Editar' : 'Novo'} Local de Uso</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></div>
          <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───
export default function AlmCadastros() {
  const fornecedores = useCadastro<any>('alm_fornecedores', 'alm_fornecedores');
  const setoresData = useCadastro<any>('alm_setores', 'alm_setores');
  const locais = useCadastro<any>('alm_locais_uso', 'alm_locais_uso');

  const [editFornecedor, setEditFornecedor] = useState<any>(null);
  const [showAddFornecedor, setShowAddFornecedor] = useState(false);
  const [deleteFornecedorId, setDeleteFornecedorId] = useState<string | null>(null);

  const [editSetor, setEditSetor] = useState<any>(null);
  const [showAddSetor, setShowAddSetor] = useState(false);
  const [deleteSetorId, setDeleteSetorId] = useState<string | null>(null);

  const [editLocal, setEditLocal] = useState<any>(null);
  const [showAddLocal, setShowAddLocal] = useState(false);
  const [deleteLocalId, setDeleteLocalId] = useState<string | null>(null);

  return (
    <Tabs defaultValue="fornecedores" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="fornecedores" className="gap-1"><Building2 className="w-4 h-4" /> Fornecedores</TabsTrigger>
        <TabsTrigger value="setores" className="gap-1"><Users className="w-4 h-4" /> Setores</TabsTrigger>
        <TabsTrigger value="locais" className="gap-1"><MapPin className="w-4 h-4" /> Locais de Uso</TabsTrigger>
      </TabsList>

      <TabsContent value="fornecedores">
        <CadastroList
          title="Fornecedores"
          icon={<Building2 />}
          items={fornecedores.data || []}
          loading={fornecedores.isLoading}
          columns={[{ key: 'nome', label: 'Nome' }, { key: 'cnpj', label: 'CNPJ' }, { key: 'telefone', label: 'Telefone' }, { key: 'email', label: 'E-mail' }]}
          onAdd={() => setShowAddFornecedor(true)}
          onEdit={setEditFornecedor}
          onDelete={setDeleteFornecedorId}
        />
        <FornecedorModal
          open={showAddFornecedor || !!editFornecedor}
          onClose={() => { setShowAddFornecedor(false); setEditFornecedor(null); }}
          item={editFornecedor}
          onSave={(d) => fornecedores.save.mutate(d, { onSuccess: () => { setShowAddFornecedor(false); setEditFornecedor(null); } })}
          saving={fornecedores.save.isPending}
        />
        <DeleteConfirmDialog
          open={!!deleteFornecedorId}
          onOpenChange={v => { if (!v) setDeleteFornecedorId(null); }}
          onConfirm={() => { if (deleteFornecedorId) { fornecedores.remove.mutate(deleteFornecedorId); setDeleteFornecedorId(null); } }}
          title="Excluir Fornecedor"
          description="Tem certeza que deseja excluir este fornecedor?"
        />
      </TabsContent>

      <TabsContent value="setores">
        <CadastroList
          title="Setores"
          icon={<Users />}
          items={setoresData.data || []}
          loading={setoresData.isLoading}
          columns={[{ key: 'nome', label: 'Nome' }, { key: 'responsavel', label: 'Responsável' }]}
          onAdd={() => setShowAddSetor(true)}
          onEdit={setEditSetor}
          onDelete={setDeleteSetorId}
        />
        <SetorModal
          open={showAddSetor || !!editSetor}
          onClose={() => { setShowAddSetor(false); setEditSetor(null); }}
          item={editSetor}
          onSave={(d) => setoresData.save.mutate(d, { onSuccess: () => { setShowAddSetor(false); setEditSetor(null); } })}
          saving={setoresData.save.isPending}
        />
        <DeleteConfirmDialog
          open={!!deleteSetorId}
          onOpenChange={v => { if (!v) setDeleteSetorId(null); }}
          onConfirm={() => { if (deleteSetorId) { setoresData.remove.mutate(deleteSetorId); setDeleteSetorId(null); } }}
          title="Excluir Setor"
          description="Tem certeza que deseja excluir este setor?"
        />
      </TabsContent>

      <TabsContent value="locais">
        <CadastroList
          title="Locais de Uso"
          icon={<MapPin />}
          items={locais.data || []}
          loading={locais.isLoading}
          columns={[{ key: 'nome', label: 'Nome' }, { key: 'descricao', label: 'Descrição' }]}
          onAdd={() => setShowAddLocal(true)}
          onEdit={setEditLocal}
          onDelete={setDeleteLocalId}
        />
        <LocalUsoModal
          open={showAddLocal || !!editLocal}
          onClose={() => { setShowAddLocal(false); setEditLocal(null); }}
          item={editLocal}
          onSave={(d) => locais.save.mutate(d, { onSuccess: () => { setShowAddLocal(false); setEditLocal(null); } })}
          saving={locais.save.isPending}
        />
        <DeleteConfirmDialog
          open={!!deleteLocalId}
          onOpenChange={v => { if (!v) setDeleteLocalId(null); }}
          onConfirm={() => { if (deleteLocalId) { locais.remove.mutate(deleteLocalId); setDeleteLocalId(null); } }}
          title="Excluir Local de Uso"
          description="Tem certeza que deseja excluir este local?"
        />
      </TabsContent>
    </Tabs>
  );
}
