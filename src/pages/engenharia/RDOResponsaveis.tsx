import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AprovadorData {
  nome: string;
  email: string;
  whatsapp: string;
  cargo: string;
  cpf: string;
}

const emptyAprovador: AprovadorData = { nome: '', email: '', whatsapp: '', cargo: '', cpf: '' };
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function RDOResponsaveis() {
  const [aprovadores, setAprovadores] = useState<[AprovadorData, AprovadorData, AprovadorData]>([
    { ...emptyAprovador }, { ...emptyAprovador }, { ...emptyAprovador },
  ]);
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [obraCount, setObraCount] = useState(0);

  const fetchAprovadores = async () => {
    setLoading(true);
    // Pegar aprovadores da primeira obra ativa (são globais, todos iguais)
    const { data } = await supabase
      .from('rdo_obras')
      .select('aprovador1_nome, aprovador1_email, aprovador1_whatsapp, aprovador1_cargo, aprovador1_cpf, aprovador2_nome, aprovador2_email, aprovador2_whatsapp, aprovador2_cargo, aprovador2_cpf, aprovador3_nome, aprovador3_email, aprovador3_whatsapp, aprovador3_cargo, aprovador3_cpf')
      .eq('status', 'Ativo')
      .limit(1)
      .maybeSingle();

    const { count } = await supabase.from('rdo_obras').select('id', { count: 'exact', head: true }).eq('status', 'Ativo');
    setObraCount(count || 0);

    if (data) {
      setAprovadores([
        { nome: data.aprovador1_nome || '', email: data.aprovador1_email || '', whatsapp: data.aprovador1_whatsapp || '', cargo: data.aprovador1_cargo || '', cpf: data.aprovador1_cpf || '' },
        { nome: data.aprovador2_nome || '', email: data.aprovador2_email || '', whatsapp: data.aprovador2_whatsapp || '', cargo: data.aprovador2_cargo || '', cpf: data.aprovador2_cpf || '' },
        { nome: data.aprovador3_nome || '', email: data.aprovador3_email || '', whatsapp: data.aprovador3_whatsapp || '', cargo: data.aprovador3_cargo || '', cpf: data.aprovador3_cpf || '' },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAprovadores(); }, []);

  const handleChange = (idx: number, field: keyof AprovadorData, value: string) => {
    setAprovadores(prev => {
      const next = [...prev] as [AprovadorData, AprovadorData, AprovadorData];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    if (field === 'email') {
      const key = `aprovador${idx + 1}_email`;
      if (value && !isValidEmail(value)) {
        setEmailErrors(prev => ({ ...prev, [key]: 'E-mail inválido' }));
      } else {
        setEmailErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
      }
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    aprovadores.forEach((ap, i) => {
      if (ap.email && !isValidEmail(ap.email)) {
        errors[`aprovador${i + 1}_email`] = 'E-mail inválido';
      }
    });
    if (Object.keys(errors).length > 0) {
      setEmailErrors(errors);
      toast.error('Corrija os e-mails inválidos antes de salvar');
      return;
    }

    setSaving(true);
    const payload: Record<string, string | null> = {};
    aprovadores.forEach((ap, i) => {
      const n = i + 1;
      payload[`aprovador${n}_nome`] = ap.nome || null;
      payload[`aprovador${n}_email`] = ap.email || null;
      payload[`aprovador${n}_whatsapp`] = ap.whatsapp || null;
      payload[`aprovador${n}_cargo`] = ap.cargo || null;
      payload[`aprovador${n}_cpf`] = ap.cpf || null;
    });

    // Atualizar TODAS as etapas ativas com os mesmos aprovadores
    const { error } = await supabase
      .from('rdo_obras')
      .update(payload)
      .eq('status', 'Ativo');

    if (error) {
      toast.error('Erro ao salvar responsáveis');
    } else {
      toast.success(`Responsáveis salvos em ${obraCount} etapa(s)!`);
      setEmailErrors({});
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cadastro de Responsáveis</h1>
        <p className="text-sm text-muted-foreground">
          Configure os 3 aprovadores/assinantes — serão aplicados a todas as {obraCount} etapa(s) ativa(s).
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        O email é obrigatório para autenticação por código de verificação antes da assinatura.
      </p>

      <div className="space-y-4">
        {aprovadores.map((ap, idx) => {
          const n = idx + 1;
          const emailKey = `aprovador${n}_email`;
          return (
            <Card key={n}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Aprovador {n}
                  {ap.nome && <Badge variant="secondary" className="text-xs ml-auto">Configurado</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome completo</Label>
                    <Input value={ap.nome} onChange={e => handleChange(idx, 'nome', e.target.value)} placeholder="Nome do aprovador" />
                  </div>
                  <div>
                    <Label className="text-xs">Cargo / Função</Label>
                    <Input value={ap.cargo} onChange={e => handleChange(idx, 'cargo', e.target.value)} placeholder="Ex: Engenheiro Fiscal" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Email *</Label>
                    <Input
                      type="email"
                      value={ap.email}
                      onChange={e => handleChange(idx, 'email', e.target.value)}
                      placeholder="email@empresa.com.br"
                      className={emailErrors[emailKey] ? 'border-destructive focus-visible:ring-destructive' : 'border-primary/40'}
                    />
                    {emailErrors[emailKey] && <p className="text-xs text-destructive mt-1">{emailErrors[emailKey]}</p>}
                  </div>
                  <div>
                    <Label className="text-xs">WhatsApp</Label>
                    <Input value={ap.whatsapp} onChange={e => handleChange(idx, 'whatsapp', e.target.value)} placeholder="(xx) xxxxx-xxxx" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">CPF</Label>
                    <Input value={ap.cpf} onChange={e => handleChange(idx, 'cpf', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div className="flex items-end text-xs text-muted-foreground pb-2">CPF aparece na assinatura digital</div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Check className="w-4 h-4" />
          {saving ? 'Salvando...' : `Salvar Responsáveis (${obraCount} etapas)`}
        </Button>
      </div>
    </div>
  );
}
