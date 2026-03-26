import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Package, Clock } from 'lucide-react';

interface DetalheRecord {
  hora: string;
  prefixoEq?: string;
  prefixoCb?: string;
  motorista?: string;
  operador?: string;
  local: string;
  material: string;
  volume: number;
  viagens: number;
}

interface DetalheProducaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: 'escavadeira' | 'caminhao';
  titulo: string;
  subtitulo?: string;
  registros: DetalheRecord[];
  totalViagens: number;
}

export function DetalheProducaoModal({
  open,
  onOpenChange,
  tipo,
  titulo,
  subtitulo,
  registros,
  totalViagens,
}: DetalheProducaoModalProps) {
  // Aggregate by location
  const locaisAgrupados = registros.reduce((acc, r) => {
    const key = r.local || 'Sem Local';
    if (!acc[key]) {
      acc[key] = { viagens: 0, volume: 0, materiais: new Set<string>() };
    }
    acc[key].viagens += r.viagens;
    acc[key].volume += r.volume;
    if (r.material) acc[key].materiais.add(r.material);
    return acc;
  }, {} as Record<string, { viagens: number; volume: number; materiais: Set<string> }>);

  // Aggregate by material
  const materiaisAgrupados = registros.reduce((acc, r) => {
    const key = r.material || 'Não especificado';
    if (!acc[key]) {
      acc[key] = { viagens: 0, volume: 0 };
    }
    acc[key].viagens += r.viagens;
    acc[key].volume += r.volume;
    return acc;
  }, {} as Record<string, { viagens: number; volume: number }>);

  // Get unique trucks/operators
  const entidadesUnicas = tipo === 'escavadeira' 
    ? [...new Set(registros.map(r => r.prefixoCb).filter(Boolean))]
    : [...new Set(registros.map(r => r.prefixoEq).filter(Boolean))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {tipo === 'escavadeira' ? (
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Package className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Truck className="w-5 h-5" />
              </div>
            )}
            <div>
              <span className="text-primary">{titulo}</span>
              {subtitulo && <p className="text-sm font-normal text-muted-foreground">{subtitulo}</p>}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Total Viagens</p>
              <p className="text-2xl font-bold text-primary">{totalViagens}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Locais Atendidos</p>
              <p className="text-2xl font-bold text-emerald-600">{Object.keys(locaisAgrupados).length}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                {tipo === 'escavadeira' ? 'Caminhões Carregados' : 'Escavadeiras'}
              </p>
              <p className="text-2xl font-bold text-blue-600">{entidadesUnicas.length}</p>
            </div>
          </div>

          {/* By Location */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Produção por Local
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Local</TableHead>
                    <TableHead className="text-center">Viagens</TableHead>
                    <TableHead className="text-right">Volume (m³)</TableHead>
                    <TableHead>Materiais</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(locaisAgrupados)
                    .sort((a, b) => b[1].viagens - a[1].viagens)
                    .map(([local, data]) => (
                      <TableRow key={local}>
                        <TableCell className="font-medium">{local}</TableCell>
                        <TableCell className="text-center font-semibold">{data.viagens}</TableCell>
                        <TableCell className="text-right">{data.volume.toLocaleString('pt-BR')}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {[...data.materiais].map(mat => (
                              <Badge key={mat} variant="secondary" className="text-xs">
                                {mat}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* By Material */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Produção por Material
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(materiaisAgrupados)
                .sort((a, b) => b[1].viagens - a[1].viagens)
                .map(([material, data]) => (
                  <div key={material} className="bg-muted/30 rounded-lg p-3 border">
                    <p className="font-medium text-sm">{material}</p>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{data.viagens} viagens</span>
                      <span className="text-xs font-semibold">{data.volume.toLocaleString('pt-BR')} m³</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Related Entities */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              {tipo === 'escavadeira' ? 'Caminhões Carregados' : 'Escavadeiras Utilizadas'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {entidadesUnicas.map(entidade => (
                <Badge key={entidade} variant="outline" className="text-sm py-1 px-3">
                  {entidade}
                </Badge>
              ))}
              {entidadesUnicas.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhum registro encontrado</p>
              )}
            </div>
          </div>

          {/* Recent Records */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Últimos Registros
            </h3>
            <div className="border rounded-lg overflow-hidden max-h-48 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Hora</TableHead>
                    <TableHead>{tipo === 'escavadeira' ? 'Caminhão' : 'Escavadeira'}</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.slice(-10).reverse().map((reg, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{reg.hora}</TableCell>
                      <TableCell className="font-medium text-primary">
                        {tipo === 'escavadeira' ? reg.prefixoCb : reg.prefixoEq}
                      </TableCell>
                      <TableCell className="text-sm">{reg.local || '-'}</TableCell>
                      <TableCell className="text-sm">{reg.material || '-'}</TableCell>
                      <TableCell className="text-right text-sm">{reg.volume} m³</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
