import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X } from 'lucide-react';

interface PedreiraFilterBarProps {
  records: Array<{
    material?: string;
    fornecedor?: string;
    empresa?: string;
    prefixo?: string;
  }>;
  filterMaterial: string[];
  setFilterMaterial: (v: string[]) => void;
  filterFornecedor: string[];
  setFilterFornecedor: (v: string[]) => void;
  filterEmpresa: string[];
  setFilterEmpresa: (v: string[]) => void;
  filterVeiculo: string[];
  setFilterVeiculo: (v: string[]) => void;
}

export function PedreiraFilterBar({
  records,
  filterMaterial, setFilterMaterial,
  filterFornecedor, setFilterFornecedor,
  filterEmpresa, setFilterEmpresa,
  filterVeiculo, setFilterVeiculo,
}: PedreiraFilterBarProps) {
  const filterOptions = useMemo(() => ({
    materiais: [...new Set(records.map(r => r.material).filter(Boolean) as string[])].sort(),
    fornecedores: [...new Set(records.map(r => r.fornecedor).filter(Boolean) as string[])].sort(),
    empresas: [...new Set(records.map(r => r.empresa).filter(Boolean) as string[])].sort(),
    veiculos: [...new Set(records.map(r => r.prefixo).filter(Boolean) as string[])].sort(),
  }), [records]);

  const hasActiveFilters = filterMaterial.length + filterFornecedor.length + filterEmpresa.length + filterVeiculo.length > 0;

  const clearAllFilters = () => {
    setFilterMaterial([]);
    setFilterFornecedor([]);
    setFilterEmpresa([]);
    setFilterVeiculo([]);
  };

  const renderFilterPopover = (
    label: string,
    options: string[],
    selected: string[],
    setSelected: (v: string[]) => void,
    width = 'w-52'
  ) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={selected.length > 0 ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1">
          {label} {selected.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{selected.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`${width} p-2`} align="start">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {options.map(m => (
            <label key={m} className="flex items-center gap-2 text-xs py-1 px-1 hover:bg-muted rounded cursor-pointer">
              <Checkbox
                checked={selected.includes(m)}
                onCheckedChange={(checked) => {
                  setSelected(checked ? [...selected, m] : selected.filter(x => x !== m));
                }}
              />
              {m}
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-1 h-6 text-xs" onClick={() => setSelected([])}>Limpar</Button>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">Filtros:</span>
      {renderFilterPopover('Material', filterOptions.materiais, filterMaterial, setFilterMaterial)}
      {renderFilterPopover('Fornecedor', filterOptions.fornecedores, filterFornecedor, setFilterFornecedor)}
      {renderFilterPopover('Empresa', filterOptions.empresas, filterEmpresa, setFilterEmpresa)}
      {renderFilterPopover('Veículo', filterOptions.veiculos, filterVeiculo, setFilterVeiculo, 'w-64')}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive gap-1" onClick={clearAllFilters}>
          <X className="w-3.5 h-3.5" />
          Limpar todos
        </Button>
      )}
    </div>
  );
}

export function usePedreiraFilters() {
  const [filterMaterial, setFilterMaterial] = useState<string[]>([]);
  const [filterFornecedor, setFilterFornecedor] = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterVeiculo, setFilterVeiculo] = useState<string[]>([]);

  const applyFilters = <T extends { material?: string; fornecedor?: string; empresa?: string; prefixo?: string }>(records: T[]): T[] => {
    return records.filter(r => {
      if (filterMaterial.length > 0 && !filterMaterial.includes(r.material || '')) return false;
      if (filterFornecedor.length > 0 && !filterFornecedor.includes(r.fornecedor || '')) return false;
      if (filterEmpresa.length > 0 && !filterEmpresa.includes(r.empresa || '')) return false;
      if (filterVeiculo.length > 0 && !filterVeiculo.includes(r.prefixo || '')) return false;
      return true;
    });
  };

  const hasActiveFilters = filterMaterial.length + filterFornecedor.length + filterEmpresa.length + filterVeiculo.length > 0;

  return {
    filterMaterial, setFilterMaterial,
    filterFornecedor, setFilterFornecedor,
    filterEmpresa, setFilterEmpresa,
    filterVeiculo, setFilterVeiculo,
    applyFilters,
    hasActiveFilters,
  };
}
