import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { maskCPFCNPJ, maskPhone } from '@/utils/masks';

interface Fornecedor {
  id?: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  status: string;
}

interface FornecedorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Fornecedor, 'id'>) => Promise<void>;
  fornecedor?: Fornecedor | null;
  loading?: boolean;
}

export function FornecedorModal({ open, onOpenChange, onSave, fornecedor, loading = false }: FornecedorModalProps) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [contato, setContato] = useState('');
  const [status, setStatus] = useState('Ativo');

  useEffect(() => {
    if (fornecedor) {
      setNome(fornecedor.nome);
      setCnpj(fornecedor.cnpj || '');
      setContato(fornecedor.contato || '');
      setStatus(fornecedor.status);
    } else {
      setNome('');
      setCnpj('');
      setContato('');
      setStatus('Ativo');
    }
  }, [fornecedor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ nome, cnpj: cnpj || null, contato: contato || null, status });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do fornecedor"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cnpj">CPF/CNPJ (opcional)</Label>
            <Input
              id="cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(maskCPFCNPJ(e.target.value))}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              disabled={loading}
              maxLength={18}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contato">Contato (opcional)</Label>
            <Input
              id="contato"
              value={contato}
              onChange={(e) => setContato(maskPhone(e.target.value))}
              placeholder="(99) 99999-9999"
              disabled={loading}
              maxLength={15}
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
