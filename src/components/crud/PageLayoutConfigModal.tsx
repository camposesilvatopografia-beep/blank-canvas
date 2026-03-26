import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LayoutGrid, GripVertical, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { BlockConfig, BlockDefinition } from '@/hooks/usePageLayout';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageLabel: string;
  defaultBlocks: BlockDefinition[];
  currentConfigs: BlockConfig[];
  onSave: (configs: BlockConfig[]) => Promise<void>;
}

export function PageLayoutConfigModal({ open, onOpenChange, pageLabel, defaultBlocks, currentConfigs, onSave }: Props) {
  const [editConfigs, setEditConfigs] = useState<BlockConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      const merged = defaultBlocks.map((block, idx) => {
        const existing = currentConfigs.find(c => c.block_key === block.key);
        return {
          block_key: block.key,
          block_order: existing?.block_order ?? idx,
          visible: existing?.visible ?? true,
        };
      });
      merged.sort((a, b) => a.block_order - b.block_order);
      setEditConfigs(merged);
    }
  }, [open, defaultBlocks, currentConfigs]);

  const updateConfig = (key: string, updates: Partial<BlockConfig>) => {
    setEditConfigs(prev => prev.map(c => c.block_key === key ? { ...c, ...updates } : c));
  };

  const resetToDefaults = () => {
    setEditConfigs(defaultBlocks.map((block, idx) => ({
      block_key: block.key,
      block_order: idx,
      visible: true,
    })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ordered = editConfigs.map((c, idx) => ({ ...c, block_order: idx }));
      await onSave(ordered);
      toast.success('Layout salvo com sucesso');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar layout');
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

  const visibleCount = editConfigs.filter(c => c.visible).length;
  const hiddenCount = editConfigs.length - visibleCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Layout — {pageLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {visibleCount} visíveis</span>
          {hiddenCount > 0 && <span className="flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> {hiddenCount} ocultos</span>}
        </div>

        <p className="text-xs text-muted-foreground">Arraste os blocos para reordenar as seções da página.</p>

        <div className="space-y-1 mt-2">
          {editConfigs.map((cfg, idx) => {
            const block = defaultBlocks.find(b => b.key === cfg.block_key);
            const isDragging = dragIdx === idx;
            const isOver = overIdx === idx && dragIdx !== idx;
            return (
              <div
                key={cfg.block_key}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-40 scale-95' : ''} ${isOver ? 'border-primary ring-1 ring-primary/30' : ''} ${!cfg.visible ? 'opacity-50' : ''}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{block?.defaultLabel || cfg.block_key}</p>
                  <p className="text-[10px] text-muted-foreground">Posição {idx + 1}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label className="text-xs text-muted-foreground">Visível</Label>
                  <Switch
                    checked={cfg.visible}
                    onCheckedChange={(v) => updateConfig(cfg.block_key, { visible: v })}
                  />
                </div>
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
