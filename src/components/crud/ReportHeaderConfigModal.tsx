import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RotateCcw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { ReportHeaderConfig } from '@/hooks/useReportHeaderConfig';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportLabel: string;
  config: ReportHeaderConfig;
  defaults: ReportHeaderConfig;
  onSave: (config: ReportHeaderConfig) => Promise<void>;
}

const FIELD_DEFS: { key: keyof ReportHeaderConfig; label: string; min: number; max: number; unit: string; isBoolean?: boolean }[] = [
  { key: 'logo_visible', label: 'Exibir Logo', min: 0, max: 1, unit: '', isBoolean: true },
  { key: 'logo_height', label: 'Altura do Logo', min: 20, max: 120, unit: 'px' },
  { key: 'header_padding_top', label: 'Espaço Superior', min: 0, max: 40, unit: 'px' },
  { key: 'header_padding_bottom', label: 'Espaço Inferior', min: 0, max: 40, unit: 'px' },
  { key: 'header_padding_left', label: 'Espaço Esquerdo', min: 0, max: 60, unit: 'px' },
  { key: 'header_padding_right', label: 'Espaço Direito', min: 0, max: 60, unit: 'px' },
  { key: 'header_gap', label: 'Gap Interno do Cabeçalho', min: 4, max: 40, unit: 'px' },
  { key: 'title_font_size', label: 'Tamanho do Título', min: 10, max: 32, unit: 'px' },
  { key: 'subtitle_font_size', label: 'Tamanho do Subtítulo', min: 8, max: 24, unit: 'px' },
  { key: 'date_font_size', label: 'Tamanho da Data', min: 8, max: 20, unit: 'px' },
  { key: 'stats_gap', label: 'Gap entre Cards', min: 4, max: 30, unit: 'px' },
  { key: 'stats_margin_bottom', label: 'Margem abaixo dos Cards', min: 0, max: 40, unit: 'px' },
];

export function ReportHeaderConfigModal({ open, onOpenChange, reportLabel, config, defaults, onSave }: Props) {
  const [edit, setEdit] = useState<ReportHeaderConfig>(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setEdit(config); }, [open, config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(edit);
      toast.success('Configuração do relatório salva');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Layout do Relatório — {reportLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {FIELD_DEFS.map(f => {
            if (f.isBoolean) {
              return (
                <div key={f.key} className="flex items-center justify-between">
                  <Label className="text-sm">{f.label}</Label>
                  <Switch
                    checked={edit[f.key] as boolean}
                    onCheckedChange={(v) => setEdit(prev => ({ ...prev, [f.key]: v }))}
                  />
                </div>
              );
            }
            const val = edit[f.key] as number;
            return (
              <div key={f.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{f.label}</Label>
                  <span className="text-xs text-muted-foreground font-mono">{val}{f.unit}</span>
                </div>
                <Slider
                  min={f.min}
                  max={f.max}
                  step={1}
                  value={[val]}
                  onValueChange={([v]) => setEdit(prev => ({ ...prev, [f.key]: v }))}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" size="sm" onClick={() => setEdit(defaults)} className="text-xs gap-1">
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar padrões
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
