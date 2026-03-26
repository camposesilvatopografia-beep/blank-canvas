import { useState, useMemo, lazy, Suspense } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { icons } from 'lucide-react';
import { X } from 'lucide-react';

// Popular/common icons for quick access
const POPULAR_ICONS = [
  'Calendar', 'Clock', 'Hash', 'Tag', 'User', 'Users', 'Truck', 'Package',
  'MapPin', 'Building', 'Wrench', 'Fuel', 'Weight', 'Ruler', 'FileText',
  'Camera', 'CheckCircle', 'AlertTriangle', 'ArrowUp', 'ArrowDown',
  'DollarSign', 'Percent', 'BarChart3', 'Activity', 'Layers',
  'Box', 'Clipboard', 'Star', 'Flag', 'Zap', 'Thermometer',
  'Droplets', 'Mountain', 'Factory', 'HardHat', 'Gauge',
  'CircleDot', 'Target', 'Eye', 'Edit', 'Trash2',
];

interface Props {
  value: string | null;
  onChange: (iconName: string | null) => void;
}

export function IconPickerPopover({ value, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const allIconNames = useMemo(() => Object.keys(icons), []);

  const filteredIcons = useMemo(() => {
    if (!search) return POPULAR_ICONS.filter(name => name in icons);
    const q = search.toLowerCase();
    return allIconNames.filter(name => name.toLowerCase().includes(q)).slice(0, 60);
  }, [search, allIconNames]);

  const SelectedIcon = value && value in icons ? (icons as any)[value] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
          {SelectedIcon ? (
            <>
              <SelectedIcon className="w-4 h-4" />
              <span className="max-w-[80px] truncate">{value}</span>
            </>
          ) : (
            'Selecionar ícone'
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar ícone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
            {value && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { onChange(null); setOpen(false); }}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
            {filteredIcons.map(name => {
              const Icon = (icons as any)[name];
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); setSearch(''); }}
                  title={name}
                  className={`p-1.5 rounded hover:bg-accent transition-colors ${value === name ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum ícone encontrado</p>
          )}
          {!search && (
            <p className="text-[10px] text-muted-foreground text-center">
              {allIconNames.length}+ ícones disponíveis. Use a busca para encontrar mais.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Render a Lucide icon by name. Returns null if not found. */
export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (icons as any)[name];
  if (!Icon) return null;
  return <Icon className={className || 'w-4 h-4'} />;
}
