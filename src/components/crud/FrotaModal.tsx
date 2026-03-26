import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';

interface FrotaItem {
  rowIndex?: number;
  prefixo: string;
  descricao: string;
  empresa: string;
  status?: string;
  operador?: string;
  motorista?: string;
  marca?: string;
  potencia?: string;
  volume?: string;
  capacidade?: string;
  placa?: string;
  tipoLocal?: string;
}

interface FrotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: FrotaItem) => Promise<void>;
  item?: FrotaItem | null;
  tipo: 'equipamento' | 'caminhao' | 'reboque' | 'pipa';
  loading?: boolean;
  statusOptions?: string[];
}

const DEFAULT_STATUS_OPTIONS = ['Mobilizado', 'Desmobilizado', 'Manutenção', 'Reserva'];

export function FrotaModal({ open, onOpenChange, onSave, item, tipo, loading = false, statusOptions = DEFAULT_STATUS_OPTIONS }: FrotaModalProps) {
  const [formData, setFormData] = useState<FrotaItem>({
    prefixo: '',
    descricao: '',
    empresa: '',
    status: 'Mobilizado',
    operador: '',
    motorista: '',
    marca: '',
    potencia: '',
    volume: '',
    capacidade: '',
    placa: '',
    tipoLocal: '',
  });
  
  const [customStatus, setCustomStatus] = useState('');
  const [showCustomStatus, setShowCustomStatus] = useState(false);
  const [allStatusOptions, setAllStatusOptions] = useState<string[]>(DEFAULT_STATUS_OPTIONS);

  useEffect(() => {
    // Merge statusOptions prop with defaults
    const merged = [...new Set([...DEFAULT_STATUS_OPTIONS, ...statusOptions])];
    setAllStatusOptions(merged);
  }, [statusOptions]);

  useEffect(() => {
    if (item) {
      setFormData({
        ...item,
        status: item.status || 'Mobilizado',
      });
      // If item has a custom status not in options, add it
      if (item.status && !allStatusOptions.includes(item.status)) {
        setAllStatusOptions(prev => [...new Set([...prev, item.status!])]);
      }
    } else {
      setFormData({
        prefixo: '',
        descricao: '',
        empresa: '',
        status: 'Mobilizado',
        operador: '',
        motorista: '',
        marca: '',
        potencia: '',
        volume: '',
        capacidade: '',
        placa: '',
        tipoLocal: '',
      });
    }
    setShowCustomStatus(false);
    setCustomStatus('');
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (field: keyof FrotaItem, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddCustomStatus = () => {
    if (customStatus.trim()) {
      const newStatus = customStatus.trim();
      setAllStatusOptions(prev => [...new Set([...prev, newStatus])]);
      setFormData(prev => ({ ...prev, status: newStatus }));
      setCustomStatus('');
      setShowCustomStatus(false);
    }
  };

  const getTipoLabel = () => {
    switch (tipo) {
      case 'equipamento': return 'Equipamento';
      case 'caminhao': return 'Caminhão';
      case 'reboque': return 'Reboque';
      case 'pipa': return 'Pipa';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? `Editar ${getTipoLabel()}` : `Novo ${getTipoLabel()}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prefixo">Prefixo *</Label>
              <Input
                id="prefixo"
                value={formData.prefixo}
                onChange={(e) => handleChange('prefixo', e.target.value)}
                placeholder="Ex: ESC-001"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa *</Label>
              <Input
                id="empresa"
                value={formData.empresa}
                onChange={(e) => handleChange('empresa', e.target.value)}
                placeholder="Nome da empresa"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Ex: Escavadeira CAT 320"
              disabled={loading}
            />
          </div>

          {/* Status Field */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            {showCustomStatus ? (
              <div className="flex gap-2">
                <Input
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="Digite o novo status"
                  disabled={loading}
                  autoFocus
                />
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleAddCustomStatus}
                  disabled={!customStatus.trim() || loading}
                >
                  Adicionar
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setShowCustomStatus(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select 
                  value={formData.status || 'Mobilizado'} 
                  onValueChange={(value) => handleChange('status', value)} 
                  disabled={loading}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  size="icon" 
                  variant="outline"
                  onClick={() => setShowCustomStatus(true)}
                  disabled={loading}
                  title="Criar novo status"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {tipo === 'equipamento' && (
            <div className="space-y-2">
              <Label htmlFor="operador">Operador</Label>
              <Input
                id="operador"
                value={formData.operador}
                onChange={(e) => handleChange('operador', e.target.value)}
                placeholder="Nome do operador"
                disabled={loading}
              />
            </div>
          )}

          {(tipo === 'caminhao' || tipo === 'pipa') && (
            <div className="space-y-2">
              <Label htmlFor="motorista">Motorista</Label>
              <Input
                id="motorista"
                value={formData.motorista}
                onChange={(e) => handleChange('motorista', e.target.value)}
                placeholder="Nome do motorista"
                disabled={loading}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={formData.marca}
                onChange={(e) => handleChange('marca', e.target.value)}
                placeholder="Ex: Caterpillar"
                disabled={loading}
              />
            </div>
            {tipo !== 'pipa' && (
              <div className="space-y-2">
                <Label htmlFor="potencia">Potência</Label>
                <Input
                  id="potencia"
                  value={formData.potencia}
                  onChange={(e) => handleChange('potencia', e.target.value)}
                  placeholder="Ex: 200 HP"
                  disabled={loading}
                />
              </div>
            )}
            {tipo === 'pipa' && (
              <div className="space-y-2">
                <Label htmlFor="capacidade">Capacidade (L)</Label>
                <Input
                  id="capacidade"
                  value={formData.capacidade}
                  onChange={(e) => handleChange('capacidade', e.target.value)}
                  placeholder="Ex: 10000"
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {tipo === 'caminhao' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volume">Volume (m³)</Label>
                <Input
                  id="volume"
                  value={formData.volume}
                  onChange={(e) => handleChange('volume', e.target.value)}
                  placeholder="Ex: 12"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="placa">Placa</Label>
                <Input
                  id="placa"
                  value={formData.placa}
                  onChange={(e) => handleChange('placa', e.target.value)}
                  placeholder="Ex: ABC-1234"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {tipo === 'pipa' && (
            <div className="space-y-2">
              <Label htmlFor="tipoLocal">Local de Trabalho</Label>
              <Select 
                value={formData.tipoLocal || ''} 
                onValueChange={(value) => handleChange('tipoLocal', value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Produção">Produção</SelectItem>
                  <SelectItem value="Recicladora">Recicladora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(tipo === 'reboque' || tipo === 'pipa') && (
            <div className="space-y-2">
              <Label htmlFor="placa">Placa</Label>
              <Input
                id="placa"
                value={formData.placa}
                onChange={(e) => handleChange('placa', e.target.value)}
                placeholder="Ex: ABC-1234"
                disabled={loading}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.prefixo || !formData.empresa}>
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
