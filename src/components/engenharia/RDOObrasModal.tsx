import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Building2, X, Check, Trash2, Users, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

interface Obra {
  id: string;
  nome: string;
  contrato: string | null;
  cliente: string | null;
  responsavel: string | null;
  status: string;
  aprovador1_nome: string | null;
  aprovador1_email: string | null;
  aprovador1_whatsapp: string | null;
  aprovador1_cargo: string | null;
  aprovador1_cpf: string | null;
  aprovador2_nome: string | null;
  aprovador2_email: string | null;
  aprovador2_whatsapp: string | null;
  aprovador2_cargo: string | null;
  aprovador2_cpf: string | null;
  aprovador3_nome: string | null;
  aprovador3_email: string | null;
  aprovador3_whatsapp: string | null;
  aprovador3_cargo: string | null;
  aprovador3_cpf: string | null;
}

interface AprovadorData {
  nome: string; email: string; whatsapp: string; cargo: string; cpf: string;
}

const emptyAprovador = (): AprovadorData => ({ nome: '', email: '', whatsapp: '', cargo: '', cpf: '' });

const emptyObra: Partial<Obra> = {
  nome: '', contrato: '', cliente: '', responsavel: '', status: 'Ativo',
};

const formatCpfCnpj = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

export function RDOObrasModal({ open, onOpenChange, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [obras, setObras] = useState<Obra[]>([]);
  const [editing, setEditing] = useState<Partial<Obra> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [obraToDelete, setObraToDelete] = useState<Obra | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Aprovadores unificados
  const [aprovadores, setAprovadores] = useState<AprovadorData[]>([emptyAprovador(), emptyAprovador(), emptyAprovador()]);
  const [savingAprovadores, setSavingAprovadores] = useState(false);
  const [showAprovadores, setShowAprovadores] = useState(false);

  const fetchObras = async () => {
    const { data } = await supabase.from('rdo_obras').select('*').order('nome');
    if (data) {
      setObras(data as Obra[]);
      // Carregar aprovadores da primeira etapa que os tenha
      const fonte = (data as Obra[]).find(o => o.aprovador1_nome || o.aprovador2_nome || o.aprovador3_nome);
      if (fonte) {
        setAprovadores([1, 2, 3].map(n => ({
          nome: (fonte as any)[`aprovador${n}_nome`] || '',
          email: (fonte as any)[`aprovador${n}_email`] || '',
          whatsapp: (fonte as any)[`aprovador${n}_whatsapp`] || '',
          cargo: (fonte as any)[`aprovador${n}_cargo`] || '',
          cpf: (fonte as any)[`aprovador${n}_cpf`] || '',
        })));
      }
    }
  };

  useEffect(() => { if (open) fetchObras(); }, [open]);

  const handleSaveAprovadores = async () => {
    setSavingAprovadores(true);
    const toNull = (v: string) => v.trim() || null;
    const payload: Record<string, any> = {};
    for (let n = 1; n <= 3; n++) {
      const ap = aprovadores[n - 1];
      payload[`aprovador${n}_nome`] = toNull(ap.nome);
      payload[`aprovador${n}_email`] = toNull(ap.email);
      payload[`aprovador${n}_whatsapp`] = toNull(ap.whatsapp);
      payload[`aprovador${n}_cargo`] = toNull(ap.cargo);
      payload[`aprovador${n}_cpf`] = toNull(ap.cpf);
    }

    // Atualizar TODAS as etapas com os mesmos aprovadores
    const { error } = await supabase.from('rdo_obras').update(payload).neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      toast.error('Erro ao salvar aprovadores');
      console.error(error);
    } else {
      toast.success('Aprovadores atualizados em todas as etapas!');
      fetchObras();
      onSaved();
    }
    setSavingAprovadores(false);
  };

  const handleSave = async () => {
    if (!editing?.nome) { toast.error('Nome da etapa é obrigatório'); return; }
    setSaving(true);

    const toNull = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : null);
    const payload: Record<string, any> = {
      nome: editing.nome,
      contrato: toNull(editing.contrato),
      cliente: toNull(editing.cliente),
      responsavel: toNull(editing.responsavel),
      status: editing.status || 'Ativo',
    };

    // Para nova etapa, copiar os aprovadores unificados
    if (!editing.id) {
      for (let n = 1; n <= 3; n++) {
        const ap = aprovadores[n - 1];
        payload[`aprovador${n}_nome`] = ap.nome.trim() || null;
        payload[`aprovador${n}_email`] = ap.email.trim() || null;
        payload[`aprovador${n}_whatsapp`] = ap.whatsapp.trim() || null;
        payload[`aprovador${n}_cargo`] = ap.cargo.trim() || null;
        payload[`aprovador${n}_cpf`] = ap.cpf.trim() || null;
      }
    }

    let err;
    if (editing.id) {
      const { error } = await supabase.from('rdo_obras').update(payload).eq('id', editing.id);
      err = error;
    } else {
      const { error } = await supabase.from('rdo_obras').insert(payload as any);
      err = error;
    }

    if (err) { toast.error('Erro ao salvar etapa'); console.error(err); }
    else { toast.success('Etapa salva com sucesso!'); setEditing(null); fetchObras(); onSaved(); }
    setSaving(false);
  };

  const handleDeleteClick = (obra: Obra) => {
    setObraToDelete(obra);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!obraToDelete) return;
    setDeleting(true);
    const { error } = await supabase.from('rdo_obras').delete().eq('id', obraToDelete.id);
    if (error) toast.error('Erro ao remover etapa');
    else { toast.success('Etapa removida'); fetchObras(); onSaved(); }
    setDeleting(false);
    setDeleteOpen(false);
    setObraToDelete(null);
  };

  const updateAprovador = (index: number, field: keyof AprovadorData, value: string) => {
    setAprovadores(prev => prev.map((ap, i) => i === index ? { ...ap, [field]: value } : ap));
  };

  const labels = ['Construtora', 'Gerenciadora', 'Fiscalização'];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Gerenciar Etapas
          </DialogTitle>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-3">
            {/* Seção de Aprovadores Unificados */}
            <div className="border rounded-lg bg-muted/30">
              <button
                onClick={() => setShowAprovadores(!showAprovadores)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Aprovadores (todas as etapas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {aprovadores.filter(a => a.nome).map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{a.nome.split(' ')[0]}</Badge>
                    ))}
                  </div>
                  {showAprovadores ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showAprovadores && (
                <div className="px-3 pb-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Os mesmos aprovadores serão utilizados em todas as etapas para assinaturas dos RDOs.
                  </p>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="border rounded-lg p-3 space-y-2 bg-card">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {labels[i]}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={aprovadores[i].nome}
                          onChange={e => updateAprovador(i, 'nome', e.target.value)}
                          placeholder="Nome completo"
                        />
                        <Input
                          value={aprovadores[i].cargo}
                          onChange={e => updateAprovador(i, 'cargo', e.target.value)}
                          placeholder="Cargo / Função"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="email"
                          value={aprovadores[i].email}
                          onChange={e => updateAprovador(i, 'email', e.target.value)}
                          placeholder="email@empresa.com.br *"
                          className="border-primary/40"
                        />
                        <Input
                          value={aprovadores[i].whatsapp}
                          onChange={e => updateAprovador(i, 'whatsapp', e.target.value)}
                          placeholder="WhatsApp (opcional)"
                        />
                      </div>
                      <Input
                        value={aprovadores[i].cpf}
                        onChange={e => updateAprovador(i, 'cpf', formatCpfCnpj(e.target.value))}
                        placeholder="CPF ou CNPJ"
                        inputMode="numeric"
                        maxLength={18}
                      />
                    </div>
                  ))}
                  <Button
                    onClick={handleSaveAprovadores}
                    disabled={savingAprovadores}
                    className="w-full gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {savingAprovadores ? 'Salvando...' : 'Salvar Aprovadores em Todas as Etapas'}
                  </Button>
                </div>
              )}
            </div>

            <Button onClick={() => setEditing({ ...emptyObra })} className="w-full gap-2">
              <Plus className="w-4 h-4" /> Nova Etapa
            </Button>
            {obras.map(obra => (
              <div key={obra.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="font-medium">{obra.nome}</p>
                  <p className="text-sm text-muted-foreground">{obra.cliente || '—'} {obra.contrato ? `· Contrato: ${obra.contrato}` : ''}</p>
                  {obra.responsavel && (
                    <Badge variant="outline" className="text-xs mt-1">{obra.responsavel}</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing({ ...obra })}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(obra)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {obras.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Nenhuma etapa cadastrada</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome da Etapa *</Label>
                <Input value={editing.nome || ''} onChange={e => setEditing({ ...editing, nome: e.target.value })} placeholder="Ex: Etapa 01, Etapa 02..." />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input value={editing.cliente || ''} onChange={e => setEditing({ ...editing, cliente: e.target.value })} placeholder="Nome do cliente" />
              </div>
              <div>
                <Label>Contrato</Label>
                <Input value={editing.contrato || ''} onChange={e => setEditing({ ...editing, contrato: e.target.value })} placeholder="Nº do contrato" />
              </div>
              <div className="col-span-2">
                <Label>Responsável</Label>
                <Input value={editing.responsavel || ''} onChange={e => setEditing({ ...editing, responsavel: e.target.value })} placeholder="Engenheiro responsável" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                <Check className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Etapa'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Excluir Etapa"
        description={`Deseja remover a etapa "${obraToDelete?.nome}"? Todos os RDOs vinculados serão excluídos. Esta ação não pode ser desfeita.`}
      />
    </>
  );
}