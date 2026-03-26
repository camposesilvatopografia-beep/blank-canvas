import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, parseISO, isValid, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, X, Check, Building2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Obra {
  id: string;
  nome: string;
  contrato: string | null;
  cliente: string | null;
  responsavel: string | null;
  status: string;
  aprovador1_nome: string | null;
  aprovador2_nome: string | null;
  aprovador3_nome: string | null;
}

const emptyObra = {
  nome: '', contrato: '', cliente: '', responsavel: '', status: 'Ativo',
  objeto: '',
  licenca_ambiental: '', licenca_canteiro: '', outorgas_agua: '',
  dias_aditados: 0, dias_paralisados: 0,
  data_inicio_contrato: '', prazo_contratual_dias: '', data_prazo_contratual: '',
  vigencia_inicial: '', vigencia_final: '',
  usina_cbuq: false, usina_solos: false, usina_concreto: false,
  aprovador1_nome: '', aprovador1_email: '', aprovador1_whatsapp: '', aprovador1_cargo: '', aprovador1_cpf: '',
  aprovador2_nome: '', aprovador2_email: '', aprovador2_whatsapp: '', aprovador2_cargo: '', aprovador2_cpf: '',
  aprovador3_nome: '', aprovador3_email: '', aprovador3_whatsapp: '', aprovador3_cargo: '', aprovador3_cpf: '',
};

export default function RDOEtapas() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchObras = async () => {
    setLoading(true);
    const { data } = await supabase.from('rdo_obras').select('*').order('nome');
    if (data) setObras(data as Obra[]);
    setLoading(false);
  };

  useEffect(() => { fetchObras(); }, []);

  const handleSave = async () => {
    if (!editing?.nome) { toast.error('Nome da etapa é obrigatório'); return; }
    setSaving(true);
    const payload = { ...editing };
    delete payload.id;
    delete payload.prazo_restante_vigencia;

    let err;
    if (editing.id) {
      const { error } = await supabase.from('rdo_obras').update(payload).eq('id', editing.id);
      err = error;
    } else {
      const { error } = await supabase.from('rdo_obras').insert(payload);
      err = error;
    }

    if (err) toast.error('Erro ao salvar etapa');
    else {
      toast.success('Etapa salva com sucesso!');
      // Replicar licença do canteiro para todas as etapas ativas
      if (payload.licenca_canteiro !== undefined) {
        await supabase.from('rdo_obras').update({ licenca_canteiro: payload.licenca_canteiro || null }).eq('status', 'Ativo');
      }
      setEditing(null); fetchObras();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover esta etapa? Todos os RDOs vinculados serão excluídos.')) return;
    const { error } = await supabase.from('rdo_obras').delete().eq('id', id);
    if (error) toast.error('Erro ao remover etapa');
    else { toast.success('Etapa removida'); fetchObras(); }
  };

  const F = (field: string) => editing?.[field] ?? '';
  const setF = (field: string, val: any) => setEditing((prev: any) => ({ ...prev, [field]: val }));

  // Helper: parse date string safely
  const safeDate = (v: string) => { if (!v) return null; const d = parseISO(v); return isValid(d) ? d : null; };
  const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

  // Auto-calc: data_inicio + prazo_dias = data_prazo_contratual
  const setFieldWithCalc = useCallback((field: string, val: any) => {
    setEditing((prev: any) => {
      const next = { ...prev, [field]: val };

      const inicio = safeDate(next.data_inicio_contrato);
      const prazo = parseInt(next.prazo_contratual_dias) || 0;

      // Calc data_prazo_contratual from inicio + prazo
      if (inicio && prazo > 0) {
        next.data_prazo_contratual = fmtDate(addDays(inicio, prazo));
      }

      // Calc vigencia_final from data_prazo_contratual + dias_aditados
      const dataPrazo = safeDate(next.data_prazo_contratual);
      const aditados = parseInt(next.dias_aditados) || 0;
      const paralisados = parseInt(next.dias_paralisados) || 0;
      if (dataPrazo) {
        next.vigencia_final = fmtDate(addDays(dataPrazo, aditados));
      }

      // Calc novo_prazo_contratual = data_prazo_contratual + dias_aditados + dias_paralisados
      if (dataPrazo) {
        next.novo_prazo_contratual = fmtDate(addDays(dataPrazo, aditados + paralisados));
      }

      // Calc prazo_restante_vigencia = (data_publicacao + 540 dias) - hoje
      const dataPub = safeDate(next.data_publicacao);
      if (dataPub) {
        const vigenciaPub = addDays(dataPub, 540);
        next.prazo_restante_vigencia = differenceInDays(vigenciaPub, new Date());
      } else {
        // Fallback: vigencia_final - hoje
        const vigFinal = safeDate(next.vigencia_final);
        if (vigFinal) {
          next.prazo_restante_vigencia = differenceInDays(vigFinal, new Date());
        } else {
          next.prazo_restante_vigencia = null;
        }
      }

      return next;
    });
  }, []);
  // Also compute on initial load if vigencia_final exists but prazo_restante_vigencia not yet set
  const prazoRestanteDisplay = (() => {
    if (!editing) return null;
    // If manually set in state, use it
    if (editing.prazo_restante_vigencia !== undefined && editing.prazo_restante_vigencia !== null) {
      return editing.prazo_restante_vigencia;
    }
    // Otherwise derive from data_publicacao + 540
    const dataPub = safeDate(editing.data_publicacao);
    if (dataPub) {
      return differenceInDays(addDays(dataPub, 540), new Date());
    }
    // Fallback: vigencia_final
    const vigFinal = safeDate(editing.vigencia_final);
    if (!vigFinal) return null;
    return differenceInDays(vigFinal, new Date());
  })();

  if (editing !== null) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>← Voltar</Button>
          <h1 className="text-xl font-bold">{editing.id ? 'Editar Etapa' : 'Nova Etapa'}</h1>
        </div>

        <div className="space-y-5">
          {/* Identificação */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação</p>
            <div className="col-span-2">
              <Label>Nome da Etapa *</Label>
              <Input value={F('nome')} onChange={e => setF('nome', e.target.value)} placeholder="Ex: Etapa 01" className="mt-1" />
            </div>
            <div>
              <Label>Objeto do Contrato</Label>
              <textarea
                rows={3}
                value={F('objeto')}
                onChange={e => setF('objeto', e.target.value)}
                placeholder="Descrição completa do objeto contratado..."
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contrato Nº</Label>
                <Input value={F('contrato')} onChange={e => setF('contrato', e.target.value)} placeholder="Ex: SEINFRA Nº 05/2021" className="mt-1" />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input value={F('cliente')} onChange={e => setF('cliente', e.target.value)} placeholder="Nome do cliente" className="mt-1" />
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={F('responsavel')} onChange={e => setF('responsavel', e.target.value)} placeholder="Engenheiro responsável" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Dados Contratuais */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados Contratuais (pré-preenchidos no RDO)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da Publicação</Label>
                <Input type="date" value={F('data_publicacao')} onChange={e => setF('data_publicacao', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Data da OS (Início do Contrato)</Label>
                <Input type="date" value={F('data_inicio_contrato')} onChange={e => setFieldWithCalc('data_inicio_contrato', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Prazo Contratual (dias)</Label>
                <Input type="number" value={F('prazo_contratual_dias') === 0 ? '' : F('prazo_contratual_dias')} onChange={e => setFieldWithCalc('prazo_contratual_dias', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} placeholder="365" className="mt-1" />
              </div>
              <div>
                <Label>Data do Prazo Contratual <span className="text-xs text-muted-foreground">(auto, editável)</span></Label>
                <Input type="date" value={F('data_prazo_contratual')} onChange={e => setFieldWithCalc('data_prazo_contratual', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Vigência Inicial</Label>
                <Input type="date" value={F('vigencia_inicial')} onChange={e => setF('vigencia_inicial', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Vigência Final <span className="text-xs text-muted-foreground">(auto, editável)</span></Label>
                <Input type="date" value={F('vigencia_final')} onChange={e => {
                  setF('vigencia_final', e.target.value);
                  const vigFinal = safeDate(e.target.value);
                  if (vigFinal) {
                    setF('prazo_restante_vigencia', differenceInDays(vigFinal, new Date()));
                  }
                }} className="mt-1" />
              </div>
              <div>
                <Label>Prazo Restante de Vigência <span className="text-xs text-muted-foreground">(auto, editável)</span></Label>
                <Input
                  type="number"
                  value={prazoRestanteDisplay === null ? '' : prazoRestanteDisplay}
                  onChange={e => setF('prazo_restante_vigencia', e.target.value === '' ? null : parseInt(e.target.value))}
                  placeholder="dias"
                  className={`mt-1 ${prazoRestanteDisplay !== null && prazoRestanteDisplay < 0 ? 'text-destructive font-semibold' : prazoRestanteDisplay !== null && prazoRestanteDisplay <= 30 ? 'text-yellow-600 font-semibold' : ''}`}
                />
              </div>
              <div>
                <Label>Licença Ambiental (validade)</Label>
                <Input type="date" value={F('licenca_ambiental')} onChange={e => setF('licenca_ambiental', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Licença do Canteiro (validade) <span className="text-xs text-muted-foreground">(global)</span></Label>
                <Input type="date" value={F('licenca_canteiro')} onChange={e => setF('licenca_canteiro', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Outorgas de Água</Label>
                <Input value={F('outorgas_agua')} onChange={e => setF('outorgas_agua', e.target.value)} placeholder="Informações sobre outorgas" className="mt-1" />
              </div>
            </div>
          </div>

          {/* Aditivos e Paralisações */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aditivos e Paralisações</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dias Aditados</Label>
                <Input type="number" value={F('dias_aditados') === 0 ? '' : F('dias_aditados')} onChange={e => setFieldWithCalc('dias_aditados', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>Dias Paralisados</Label>
                <Input type="number" value={F('dias_paralisados') === 0 ? '' : F('dias_paralisados')} onChange={e => setFieldWithCalc('dias_paralisados', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)} placeholder="0" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label>Data do Novo Prazo Contratual <span className="text-xs text-muted-foreground">(auto, editável)</span></Label>
                <Input type="date" value={F('novo_prazo_contratual')} onChange={e => setF('novo_prazo_contratual', e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>

          {/* Usinas */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usinas Disponíveis</p>
            <div className="flex gap-4">
              {[['usina_cbuq', 'Usina CBUQ'], ['usina_solos', 'Usina de Solos'], ['usina_concreto', 'Usina de Concreto']].map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!editing[field]} onChange={e => setF(field, e.target.checked)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Aprovadores */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">👥 Aprovadores / Vistos</p>
            <p className="text-xs text-muted-foreground">O e-mail é obrigatório para o acesso ao portal de assinatura.</p>
            {[1, 2, 3].map(n => (
              <div key={n} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Aprovador {n}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={F(`aprovador${n}_nome`)} onChange={e => setF(`aprovador${n}_nome`, e.target.value)} placeholder="Nome completo" />
                  <Input value={F(`aprovador${n}_cargo`)} onChange={e => setF(`aprovador${n}_cargo`, e.target.value)} placeholder="Cargo / Função" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="email" value={F(`aprovador${n}_email`)} onChange={e => setF(`aprovador${n}_email`, e.target.value)} placeholder="email@empresa.com.br *" className="border-primary/40" />
                  <Input value={F(`aprovador${n}_whatsapp`)} onChange={e => setF(`aprovador${n}_whatsapp`, e.target.value)} placeholder="WhatsApp (opcional)" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={F(`aprovador${n}_cpf`)} onChange={e => setF(`aprovador${n}_cpf`, e.target.value)} placeholder="CPF (ex: 000.000.000-00)" />
                  <div className="flex items-center text-xs text-muted-foreground px-1">CPF aparece na assinatura digital</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              <Check className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Etapa'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Etapas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as etapas/obras vinculadas aos RDOs</p>
        </div>
        <Button onClick={() => setEditing({ ...emptyObra })} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Etapa
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : obras.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma etapa cadastrada</p>
          <p className="text-sm mt-1">Clique em "Nova Etapa" para criar a primeira.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {obras.map(obra => (
            <Card key={obra.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{obra.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {obra.cliente || '—'}{obra.contrato ? ` · Contrato: ${obra.contrato}` : ''}
                    </p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[obra.aprovador1_nome, obra.aprovador2_nome, obra.aprovador3_nome].filter(Boolean).map((a, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Duplicar" onClick={() => { const { id, ...rest } = obra as any; setEditing({ ...rest, nome: `${obra.nome} (cópia)` }); }}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditing({ ...obra })}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(obra.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
