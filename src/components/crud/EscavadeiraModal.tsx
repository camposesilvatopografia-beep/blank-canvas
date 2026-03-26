import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Escavadeira {
  rowIndex?: number;
  prefixo: string;
  descricao: string;
  operador: string;
  marca: string;
  potencia: string;
  empresa: string;
  encarregado: string;
}

interface EscavadeiraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Escavadeira) => Promise<void>;
  escavadeira?: Escavadeira | null;
  loading?: boolean;
}

export function EscavadeiraModal({ open, onOpenChange, onSave, escavadeira, loading = false }: EscavadeiraModalProps) {
  const [prefixo, setPrefixo] = useState('');
  const [descricao, setDescricao] = useState('Escavadeira Hidráulica');
  const [operador, setOperador] = useState('');
  const [marca, setMarca] = useState('');
  const [potencia, setPotencia] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [encarregado, setEncarregado] = useState('');

  useEffect(() => {
    if (escavadeira) {
      setPrefixo(escavadeira.prefixo);
      setDescricao(escavadeira.descricao);
      setOperador(escavadeira.operador);
      setMarca(escavadeira.marca);
      setPotencia(escavadeira.potencia);
      setEmpresa(escavadeira.empresa);
      setEncarregado(escavadeira.encarregado);
    } else {
      setPrefixo('');
      setDescricao('Escavadeira Hidráulica');
      setOperador('');
      setMarca('');
      setPotencia('');
      setEmpresa('');
      setEncarregado('');
    }
  }, [escavadeira, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      rowIndex: escavadeira?.rowIndex,
      prefixo,
      descricao,
      operador,
      marca,
      potencia,
      empresa,
      encarregado,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{escavadeira ? 'Editar Escavadeira' : 'Nova Escavadeira'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prefixo">Prefixo *</Label>
              <Input
                id="prefixo"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
                placeholder="Ex: EH-01-LP"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Escavadeira Hidráulica"
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operador">Operador</Label>
              <Input
                id="operador"
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
                placeholder="Nome do operador"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex: CAT, Volvo"
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="potencia">Potência</Label>
              <Input
                id="potencia"
                value={potencia}
                onChange={(e) => setPotencia(e.target.value)}
                placeholder="Ex: 320"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex: Engemat, L. Pereira"
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="encarregado">Encarregado</Label>
            <Input
              id="encarregado"
              value={encarregado}
              onChange={(e) => setEncarregado(e.target.value)}
              placeholder="Nome do encarregado"
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !prefixo}>
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
