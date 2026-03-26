import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DollarSign, Calculator, Info } from 'lucide-react';

interface FreteConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRate: number;
  onSave: (rate: number) => void;
}

const FRETE_RATE_KEY = 'pedreira_frete_rate';

export function getStoredFreteRate(): number {
  const stored = localStorage.getItem(FRETE_RATE_KEY);
  return stored ? parseFloat(stored) : 0;
}

export function setStoredFreteRate(rate: number): void {
  localStorage.setItem(FRETE_RATE_KEY, rate.toString());
}

export function FreteConfigModal({
  open,
  onOpenChange,
  currentRate,
  onSave,
}: FreteConfigModalProps) {
  const [rate, setRate] = useState(currentRate.toString());

  useEffect(() => {
    if (open) {
      setRate(currentRate.toString());
    }
  }, [open, currentRate]);

  const handleSave = () => {
    const numRate = parseFloat(rate.replace(',', '.')) || 0;
    if (numRate < 0) {
      toast.error('O valor do frete não pode ser negativo');
      return;
    }
    
    setStoredFreteRate(numRate);
    onSave(numRate);
    toast.success(`Taxa de frete atualizada para R$ ${numRate.toFixed(2)}/tonelada`);
    onOpenChange(false);
  };

  const handleInputChange = (value: string) => {
    // Allow only numbers and comma/dot for decimals
    const sanitized = value.replace(/[^\d.,]/g, '');
    setRate(sanitized);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Configurar Taxa de Frete
          </DialogTitle>
          <DialogDescription>
            Defina o valor do frete por tonelada para calcular automaticamente os custos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="frete-rate" className="text-sm font-medium">
              Valor por Tonelada (R$/ton)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="frete-rate"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={rate}
                onChange={(e) => handleInputChange(e.target.value)}
                className="pl-9 text-lg font-medium"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Como funciona:</p>
              <p>O valor do frete será calculado multiplicando a tonelagem pela taxa configurada.</p>
              <p className="mt-1">Ex: 100 toneladas × R$ 15,00 = R$ 1.500,00</p>
            </div>
          </div>

          {parseFloat(rate.replace(',', '.')) > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">Prévia:</span> Com essa taxa, 1.000 toneladas custariam{' '}
                <span className="font-bold">
                  {(1000 * parseFloat(rate.replace(',', '.') || '0')).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-primary">
            Salvar Taxa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
