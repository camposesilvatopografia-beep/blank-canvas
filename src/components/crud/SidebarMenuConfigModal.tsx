import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GripVertical, RotateCcw, Eye, EyeOff, Menu, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { MenuConfig } from '@/hooks/useSidebarMenuConfig';

interface MenuDef {
  key: string;
  defaultLabel: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuDefs: MenuDef[];
  currentConfigs: MenuConfig[];
  onSave: (configs: MenuConfig[]) => Promise<void>;
}

export function SidebarMenuConfigModal({ open, onOpenChange, menuDefs, currentConfigs, onSave }: Props) {
  const [items, setItems] = useState<(MenuConfig & { defaultLabel: string })[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const merged = menuDefs.map((def, idx) => {
        const existing = currentConfigs.find(c => c.menu_key === def.key);
        return {
          menu_key: def.key,
          custom_label: existing?.custom_label ?? null,
          menu_order: existing?.menu_order ?? idx,
          visible: existing?.visible ?? true,
          defaultLabel: def.defaultLabel,
        };
      });
      merged.sort((a, b) => a.menu_order - b.menu_order);
      setItems(merged);
      setEditingKey(null);
    }
  }, [open, menuDefs, currentConfigs]);

  const update = (key: string, updates: Partial<MenuConfig>) => {
    setItems(prev => prev.map(i => i.menu_key === key ? { ...i, ...updates } : i));
  };

  const resetAll = () => {
    setItems(menuDefs.map((def, idx) => ({
      menu_key: def.key,
      custom_label: null,
      menu_order: idx,
      visible: true,
      defaultLabel: def.defaultLabel,
    })));
    setEditingKey(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ordered = items.map((item, idx) => ({
        menu_key: item.menu_key,
        custom_label: item.custom_label,
        menu_order: idx,
        visible: item.visible,
      }));
      await onSave(ordered);
      toast.success('Menu salvo com sucesso');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar menu');
    }
    setSaving(false);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx); };
  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }
    setItems(prev => {
      const arr = [...prev];
      const [item] = arr.splice(dragIdx, 1);
      arr.splice(dropIdx, 0, item);
      return arr;
    });
    setDragIdx(null); setOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  const visibleCount = items.filter(i => i.visible).length;
  const hiddenCount = items.length - visibleCount;
  const renamedCount = items.filter(i => i.custom_label).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Menu className="w-5 h-5" />
            Configurar Menu Lateral
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {visibleCount} visíveis</span>
          {hiddenCount > 0 && <span className="flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> {hiddenCount} ocultos</span>}
          {renamedCount > 0 && <span className="flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> {renamedCount} renomeados</span>}
        </div>

        <p className="text-xs text-muted-foreground">Arraste para reordenar. Clique no lápis para renomear.</p>

        <div className="space-y-1 mt-2">
          {items.map((item, idx) => {
            const isDragging = dragIdx === idx;
            const isOver = overIdx === idx && dragIdx !== idx;
            const isEditing = editingKey === item.menu_key;
            const displayLabel = item.custom_label || item.defaultLabel;

            return (
              <div
                key={item.menu_key}
                draggable={!isEditing}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 p-3 rounded-lg border bg-card transition-all ${isDragging ? 'opacity-40 scale-95' : ''} ${isOver ? 'border-primary ring-1 ring-primary/30' : ''} ${!item.visible ? 'opacity-50' : ''}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.custom_label ?? item.defaultLabel}
                        onChange={(e) => update(item.menu_key, { custom_label: e.target.value || null })}
                        onKeyDown={(e) => { if (e.key === 'Enter') setEditingKey(null); }}
                        onBlur={() => setEditingKey(null)}
                        className="h-7 text-sm"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{displayLabel}</p>
                      {item.custom_label && (
                        <span className="text-[10px] text-muted-foreground">({item.defaultLabel})</span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">Posição {idx + 1}</p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={(e) => { e.stopPropagation(); setEditingKey(isEditing ? null : item.menu_key); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>

                <div className="flex items-center gap-1 shrink-0">
                  <Label className="text-xs text-muted-foreground sr-only">Visível</Label>
                  <Switch
                    checked={item.visible}
                    onCheckedChange={(v) => update(item.menu_key, { visible: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" size="sm" onClick={resetAll} className="text-xs gap-1">
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
