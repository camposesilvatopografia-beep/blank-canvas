import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, GripVertical, RotateCcw, Palette, Type, AlignLeft, AlignCenter, AlignRight, Heading, TableProperties } from 'lucide-react';
import { toast } from 'sonner';
import { ColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { IconPickerPopover, DynamicIcon } from './IconPickerPopover';

const FONT_OPTIONS = [
  { value: '__default', label: 'Padrão' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
];

const FONT_SIZE_OPTIONS = [
  { value: '__default', label: 'Padrão' },
  { value: '0.7rem', label: 'Pequeno' },
  { value: '0.8rem', label: 'Médio' },
  { value: '0.9rem', label: 'Normal' },
  { value: '1rem', label: 'Grande' },
  { value: '1.1rem', label: 'Muito Grande' },
];

const TEXT_TRANSFORM_OPTIONS = [
  { value: '__default', label: 'Padrão' },
  { value: 'uppercase', label: 'MAIÚSCULAS' },
  { value: 'lowercase', label: 'minúsculas' },
  { value: 'capitalize', label: 'Capitalizar' },
];

const LETTER_SPACING_OPTIONS = [
  { value: '__default', label: 'Padrão' },
  { value: '-0.02em', label: 'Condensado' },
  { value: '0.05em', label: 'Leve' },
  { value: '0.1em', label: 'Espaçado' },
  { value: '0.2em', label: 'Muito Espaçado' },
];

const DEFAULT_CFG: Omit<ColumnConfig, 'column_key' | 'column_order'> = {
  custom_label: null,
  visible: true,
  text_color: null,
  bg_color: null,
  font_family: null,
  font_bold: false,
  font_size: null,
  icon_name: null,
  text_align: null,
  font_italic: false,
  text_transform: null,
  letter_spacing: null,
  header_text_color: null,
  header_bg_color: null,
  header_font_family: null,
  header_font_bold: true,
  header_font_size: null,
  header_icon_name: null,
  header_text_align: null,
  header_font_italic: false,
  header_text_transform: null,
  header_letter_spacing: null,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableLabel: string;
  defaultColumns: ColumnDefinition[];
  currentConfigs: ColumnConfig[];
  onSave: (configs: ColumnConfig[]) => Promise<void>;
}

/** Reusable style editor panel for either header or body */
function StylePanel({
  cfg,
  prefix,
  onUpdate,
  defaultLabel,
}: {
  cfg: ColumnConfig;
  prefix: 'body' | 'header';
  onUpdate: (key: string, updates: Partial<ColumnConfig>) => void;
  defaultLabel: string;
}) {
  const isHeader = prefix === 'header';
  const textColor = isHeader ? cfg.header_text_color : cfg.text_color;
  const bgColor = isHeader ? cfg.header_bg_color : cfg.bg_color;
  const fontFamily = isHeader ? cfg.header_font_family : cfg.font_family;
  const fontSize = isHeader ? cfg.header_font_size : cfg.font_size;
  const fontBold = isHeader ? cfg.header_font_bold : cfg.font_bold;
  const fontItalic = isHeader ? cfg.header_font_italic : cfg.font_italic;
  const textAlign = isHeader ? cfg.header_text_align : cfg.text_align;
  const textTransform = isHeader ? cfg.header_text_transform : cfg.text_transform;
  const letterSpacing = isHeader ? cfg.header_letter_spacing : cfg.letter_spacing;
  const iconName = isHeader ? cfg.header_icon_name : cfg.icon_name;

  const fieldMap = (field: string) => isHeader ? `header_${field}` : field;

  const previewStyle: React.CSSProperties = {
    color: textColor || undefined,
    backgroundColor: bgColor || undefined,
    fontFamily: fontFamily || undefined,
    fontWeight: fontBold ? 'bold' : undefined,
    fontStyle: fontItalic ? 'italic' : undefined,
    fontSize: fontSize || undefined,
    textAlign: (textAlign as any) || undefined,
    textTransform: (textTransform as any) || undefined,
    letterSpacing: letterSpacing || undefined,
  };

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="p-2 rounded border bg-background text-center">
        <span style={previewStyle} className="px-2 py-1 rounded inline-flex items-center gap-1.5">
          {iconName && <DynamicIcon name={iconName} className="w-4 h-4" />}
          {cfg.custom_label || defaultLabel}
        </span>
      </div>

      {/* Icon */}
      <div className="space-y-1">
        <Label className="text-xs">Ícone</Label>
        <IconPickerPopover
          value={iconName}
          onChange={(v) => onUpdate(cfg.column_key, { [fieldMap('icon_name')]: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Text Color */}
        <div className="space-y-1">
          <Label className="text-xs">Cor do Texto</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={textColor || '#000000'}
              onChange={(e) => onUpdate(cfg.column_key, { [fieldMap('text_color')]: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border"
            />
            {textColor && (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onUpdate(cfg.column_key, { [fieldMap('text_color')]: null })}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Bg Color */}
        <div className="space-y-1">
          <Label className="text-xs">Cor de Fundo</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bgColor || '#ffffff'}
              onChange={(e) => onUpdate(cfg.column_key, { [fieldMap('bg_color')]: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border"
            />
            {bgColor && (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onUpdate(cfg.column_key, { [fieldMap('bg_color')]: null })}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Font Family */}
        <div className="space-y-1">
          <Label className="text-xs">Fonte</Label>
          <Select
            value={fontFamily || '__default'}
            onValueChange={(v) => onUpdate(cfg.column_key, { [fieldMap('font_family')]: v === '__default' ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(f => (
                <SelectItem key={f.value} value={f.value}>
                  <span style={{ fontFamily: f.value === '__default' ? undefined : f.value }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="space-y-1">
          <Label className="text-xs">Tamanho</Label>
          <Select
            value={fontSize || '__default'}
            onValueChange={(v) => onUpdate(cfg.column_key, { [fieldMap('font_size')]: v === '__default' ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
            <SelectContent>
              {FONT_SIZE_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Text Transform */}
        <div className="space-y-1">
          <Label className="text-xs">Transformação</Label>
          <Select
            value={textTransform || '__default'}
            onValueChange={(v) => onUpdate(cfg.column_key, { [fieldMap('text_transform')]: v === '__default' ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
            <SelectContent>
              {TEXT_TRANSFORM_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Letter Spacing */}
        <div className="space-y-1">
          <Label className="text-xs">Espaçamento</Label>
          <Select
            value={letterSpacing || '__default'}
            onValueChange={(v) => onUpdate(cfg.column_key, { [fieldMap('letter_spacing')]: v === '__default' ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
            <SelectContent>
              {LETTER_SPACING_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Align */}
      <div className="space-y-1">
        <Label className="text-xs">Alinhamento</Label>
        <div className="flex gap-1">
          {[
            { value: null, icon: AlignLeft, label: 'Esquerda' },
            { value: 'center', icon: AlignCenter, label: 'Centro' },
            { value: 'right', icon: AlignRight, label: 'Direita' },
          ].map(({ value: alignVal, icon: AlignIcon, label: alignLabel }) => (
            <button
              key={alignLabel}
              type="button"
              onClick={() => onUpdate(cfg.column_key, { [fieldMap('text_align')]: alignVal })}
              className={`p-1.5 rounded hover:bg-accent transition-colors ${textAlign === alignVal || (!textAlign && !alignVal) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
              title={alignLabel}
            >
              <AlignIcon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Bold + Italic */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={fontBold} onCheckedChange={(v) => onUpdate(cfg.column_key, { [fieldMap('font_bold')]: v })} />
          <Label className="text-xs font-bold">Negrito</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={fontItalic} onCheckedChange={(v) => onUpdate(cfg.column_key, { [fieldMap('font_italic')]: v })} />
          <Label className="text-xs italic">Itálico</Label>
        </div>
      </div>
    </div>
  );
}

export function ColumnConfigModal({ open, onOpenChange, tableLabel, defaultColumns, currentConfigs, onSave }: Props) {
  const [editConfigs, setEditConfigs] = useState<ColumnConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const merged = defaultColumns.map((col, idx) => {
        const existing = currentConfigs.find(c => c.column_key === col.key);
        return {
          ...DEFAULT_CFG,
          column_key: col.key,
          column_order: existing?.column_order ?? idx,
          ...existing,
        } as ColumnConfig;
      });
      merged.sort((a, b) => a.column_order - b.column_order);
      setEditConfigs(merged);
      setExpandedKey(null);
    }
  }, [open, defaultColumns, currentConfigs]);

  const updateConfig = (key: string, updates: Partial<ColumnConfig>) => {
    setEditConfigs(prev => prev.map(c => c.column_key === key ? { ...c, ...updates } : c));
  };

  const resetToDefaults = () => {
    setEditConfigs(defaultColumns.map((col, idx) => ({
      ...DEFAULT_CFG,
      column_key: col.key,
      column_order: idx,
    })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ordered = editConfigs.map((c, idx) => ({ ...c, column_order: idx }));
      await onSave(ordered);
      toast.success('Configurações salvas com sucesso');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar configurações');
    }
    setSaving(false);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx); };
  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }
    setEditConfigs(prev => {
      const arr = [...prev];
      const [item] = arr.splice(dragIdx, 1);
      arr.splice(dropIdx, 0, item);
      return arr;
    });
    setDragIdx(null); setOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Configurar Colunas — {tableLabel}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Arraste para reordenar. Clique em <Palette className="w-3 h-3 inline" /> para estilizar cabeçalho e corpo separadamente.
        </p>

        <div className="space-y-1 mt-2">
          {editConfigs.map((cfg, idx) => {
            const defaultCol = defaultColumns.find(d => d.key === cfg.column_key);
            const isDragging = dragIdx === idx;
            const isOver = overIdx === idx && dragIdx !== idx;
            const isExpanded = expandedKey === cfg.column_key;
            const hasBodyCustom = cfg.icon_name || cfg.text_color || cfg.bg_color || cfg.font_family || cfg.font_bold || cfg.font_italic || cfg.text_transform || cfg.letter_spacing || cfg.font_size;
            const hasHeaderCustom = cfg.header_icon_name || cfg.header_text_color || cfg.header_bg_color || cfg.header_font_family || !cfg.header_font_bold || cfg.header_font_italic || cfg.header_text_transform || cfg.header_letter_spacing || cfg.header_font_size;
            const hasCustomization = hasBodyCustom || hasHeaderCustom;

            return (
              <div key={cfg.column_key}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-40 scale-95' : ''} ${isOver ? 'border-primary ring-1 ring-primary/30' : ''}`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  
                  {cfg.icon_name && (
                    <div className="shrink-0">
                      <DynamicIcon name={cfg.icon_name} className="w-4 h-4 text-primary" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5 min-w-0">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">
                      Padrão: {defaultCol?.defaultLabel}
                    </Label>
                    <Input
                      value={cfg.custom_label || ''}
                      onChange={(e) => updateConfig(cfg.column_key, { custom_label: e.target.value || null })}
                      placeholder={defaultCol?.defaultLabel}
                      className="h-8 text-sm"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isExpanded ? null : cfg.column_key)}
                    className={`p-1.5 rounded-md hover:bg-accent transition-colors shrink-0 relative ${isExpanded ? 'bg-accent text-primary' : 'text-muted-foreground'}`}
                    title="Estilizar coluna"
                  >
                    <Palette className="w-4 h-4" />
                    {hasCustomization && !isExpanded && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-xs text-muted-foreground">Visível</Label>
                    <Switch
                      checked={cfg.visible}
                      onCheckedChange={(v) => updateConfig(cfg.column_key, { visible: v })}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="ml-8 mr-2 mt-1 mb-2 p-3 rounded-lg border border-dashed bg-muted/30 space-y-3">
                    <Tabs defaultValue="header" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="header" className="text-xs gap-1.5">
                          <Heading className="w-3.5 h-3.5" />
                          Cabeçalho
                        </TabsTrigger>
                        <TabsTrigger value="body" className="text-xs gap-1.5">
                          <TableProperties className="w-3.5 h-3.5" />
                          Células
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="header" className="mt-3">
                        <StylePanel
                          cfg={cfg}
                          prefix="header"
                          onUpdate={updateConfig}
                          defaultLabel={cfg.custom_label || defaultCol?.defaultLabel || cfg.column_key}
                        />
                      </TabsContent>
                      <TabsContent value="body" className="mt-3">
                        <StylePanel
                          cfg={cfg}
                          prefix="body"
                          onUpdate={updateConfig}
                          defaultLabel={cfg.custom_label || defaultCol?.defaultLabel || cfg.column_key}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-xs gap-1">
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
