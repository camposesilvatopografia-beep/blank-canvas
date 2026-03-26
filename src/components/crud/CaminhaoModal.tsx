import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface Caminhao {
  rowIndex?: number;
  prefixo: string;
  descricao: string;
  motorista: string;
  marca: string;
  potencia: string;
  volume: string;
  empresa: string;
  encarregado: string;
}

interface CaminhaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Caminhao) => Promise<void>;
  caminhao?: Caminhao | null;
  loading?: boolean;
}

export function CaminhaoModal({ open, onOpenChange, onSave, caminhao, loading = false }: CaminhaoModalProps) {
  const [prefixo, setPrefixo] = useState('');
  const [descricao, setDescricao] = useState('Caminhão Basculante');
  const [motorista, setMotorista] = useState('');
  const [marca, setMarca] = useState('');
  const [potencia, setPotencia] = useState('');
  const [volume, setVolume] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [encarregado, setEncarregado] = useState('');

  useEffect(() => {
    if (caminhao) {
      setPrefixo(caminhao.prefixo);
      setDescricao(caminhao.descricao);
      setMotorista(caminhao.motorista);
      setMarca(caminhao.marca);
      setPotencia(caminhao.potencia);
      setVolume(caminhao.volume);
      setEmpresa(caminhao.empresa);
      setEncarregado(caminhao.encarregado);
    } else {
      setPrefixo('');
      setDescricao('Caminhão Basculante');
      setMotorista('');
      setMarca('');
      setPotencia('');
      setVolume('');
      setEmpresa('');
      setEncarregado('');
    }
  }, [caminhao, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      rowIndex: caminhao?.rowIndex,
      prefixo,
      descricao,
      motorista,
      marca,
      potencia,
      volume,
      empresa,
      encarregado,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{caminhao ? 'Editar Caminhão' : 'Novo Caminhão'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prefixo">Prefixo *</Label>
              <Input
                id="prefixo"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
                placeholder="Ex: CBT-01-LP"
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
                placeholder="Caminhão Basculante"
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="motorista">Motorista</Label>
              <Input
                id="motorista"
                value={motorista}
                onChange={(e) => setMotorista(e.target.value)}
                placeholder="Nome do motorista"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex: Volvo, Mercedes"
                disabled={loading}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="potencia">Potência</Label>
              <Input
                id="potencia"
                value={potencia}
                onChange={(e) => setPotencia(e.target.value)}
                placeholder="Ex: 420"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume">Volume (m³)</Label>
              <Input
                id="volume"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="Ex: 15,54"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex: L. Pereira"
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
