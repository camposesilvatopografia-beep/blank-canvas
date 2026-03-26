import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Paintbrush } from 'lucide-react';
import { ColumnDefinition } from '@/hooks/useColumnConfig';
import { ConditionalFormatRule } from '@/hooks/useConditionalFormat';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableKey: string;
  tableLabel: string;
  columns: ColumnDefinition[];
  currentRules: ConditionalFormatRule[];
  onSave: (rules: ConditionalFormatRule[]) => Promise<void>;
}

const PRESET_COLORS = [
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Azul Bebê', value: '#93c5fd' },
  { label: 'Laranja Escuro', value: '#c2410c' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Verde Claro', value: '#86efac' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Roxo', value: '#a855f7' },
  { label: 'Amarelo', value: '#eab308' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Cinza', value: '#6b7280' },
  { label: 'Teal', value: '#14b8a6' },
];

export function ConditionalFormatModal({ open, onOpenChange, tableKey, tableLabel, columns, currentRules, onSave }: Props) {
  const [rules, setRules] = useState<ConditionalFormatRule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRules(currentRules.length > 0 ? [...currentRules] : []);
    }
  }, [open, currentRules]);

  const addRule = () => {
    setRules(prev => [...prev, {
      table_key: tableKey,
      column_key: columns[0]?.key || '',
      match_value: '',
      bg_color: '#3b82f6',
      text_color: '#ffffff',
    }]);
  };

  const updateRule = (index: number, field: keyof ConditionalFormatRule, value: string) => {
    setRules(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const valid = rules.filter(r => r.match_value.trim() !== '');
    setSaving(true);
    try {
      await onSave(valid);
      toast.success('Formatação condicional salva!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paintbrush className="w-5 h-5 text-primary" />
            Formatação Condicional — {tableLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Defina regras para colorir células automaticamente com base no valor. Ex: quando "Empresa" = "L. Pereira" → fundo Azul.
          </p>

          {rules.map((rule, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 p-3 border rounded-lg bg-muted/30">
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs">Coluna</Label>
                <Select value={rule.column_key} onValueChange={v => updateRule(i, 'column_key', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {columns.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.defaultLabel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs">Valor</Label>
                <Input
                  className="h-9"
                  placeholder="Ex: L. Pereira"
                  value={rule.match_value}
                  onChange={e => updateRule(i, 'match_value', e.target.value)}
                />
              </div>

              <div className="min-w-[130px]">
                <Label className="text-xs">Cor de Fundo</Label>
                <div className="flex gap-1 items-center">
                  <input
                    type="color"
                    value={rule.bg_color}
                    onChange={e => updateRule(i, 'bg_color', e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border"
                  />
                  <Select value={rule.bg_color} onValueChange={v => updateRule(i, 'bg_color', v)}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Preset" /></SelectTrigger>
                    <SelectContent>
                      {PRESET_COLORS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.value }} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="min-w-[80px]">
                <Label className="text-xs">Cor Texto</Label>
                <input
                  type="color"
                  value={rule.text_color || '#ffffff'}
                  onChange={e => updateRule(i, 'text_color', e.target.value)}
                  className="w-full h-9 rounded cursor-pointer border"
                />
              </div>

              <div
                className="px-3 py-1.5 rounded text-xs font-medium min-w-[60px] text-center"
                style={{ backgroundColor: rule.bg_color, color: rule.text_color || '#fff' }}
              >
                {rule.match_value || 'Preview'}
              </div>

              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeRule(i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addRule} className="w-full">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Regra
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
