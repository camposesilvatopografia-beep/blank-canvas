import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface Local {
  id?: string;
  tipo: string;
  nome: string;
  obra: string | null;
  status: string;
}

interface LocalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Local, 'id'>) => Promise<void>;
  local?: Local | null;
  loading?: boolean;
}

export function LocalModal({ open, onOpenChange, onSave, local, loading = false }: LocalModalProps) {
  const [tipo, setTipo] = useState('Origem');
  const [nome, setNome] = useState('');
  const [obra, setObra] = useState('');
  const [status, setStatus] = useState('Ativo');

  useEffect(() => {
    if (local) {
      setTipo(local.tipo);
      setNome(local.nome);
      setObra(local.obra || '');
      setStatus(local.status);
    } else {
      setTipo('Origem');
      setNome('');
      setObra('');
      setStatus('Ativo');
    }
  }, [local, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ tipo, nome, obra: obra || null, status });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{local ? 'Editar Local' : 'Novo Local'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Origem">Origem</SelectItem>
                <SelectItem value="Destino">Destino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do local"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obra">Obra (opcional)</Label>
            <Input
              id="obra"
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              placeholder="Nome da obra"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !nome}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
