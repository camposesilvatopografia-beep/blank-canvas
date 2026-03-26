import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LocalStats {
  local: string;
  aterro: number;
  areia: number;
  botaFora: number;
  vegetal: number;
  bgs: number;
  total: number;
}

interface ResumoPorLocalProps {
  title: string;
  data: LocalStats[];
  className?: string;
}

export function ResumoPorLocal({ title, data, className }: ResumoPorLocalProps) {
  const formatNumber = (num: number) => {
    if (num === 0) return '';
    return num.toLocaleString('pt-BR');
  };

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => ({
      aterro: acc.aterro + row.aterro,
      areia: acc.areia + row.areia,
      botaFora: acc.botaFora + row.botaFora,
      vegetal: acc.vegetal + row.vegetal,
      bgs: acc.bgs + row.bgs,
      total: acc.total + row.total,
    }),
    { aterro: 0, areia: 0, botaFora: 0, vegetal: 0, bgs: 0, total: 0 }
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-center text-[#c0392b] font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-bold text-gray-700">Local ▲</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">Aterro</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">Areia</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">Bota Fora</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">Vegetal</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">BGS</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow key={row.local || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <TableCell className="font-medium">{row.local || '-'}</TableCell>
                  <TableCell className="text-center">{formatNumber(row.aterro)}</TableCell>
                  <TableCell className="text-center">{formatNumber(row.areia)}</TableCell>
                  <TableCell className="text-center">{formatNumber(row.botaFora)}</TableCell>
                  <TableCell className="text-center">{formatNumber(row.vegetal)}</TableCell>
                  <TableCell className="text-center">{formatNumber(row.bgs)}</TableCell>
                  <TableCell className="text-center font-bold">{formatNumber(row.total)}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-4">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              )}
              {/* Total Row */}
              {data.length > 0 && (
                <TableRow className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <TableCell className="font-bold">Total geral</TableCell>
                  <TableCell className="text-center font-bold">{formatNumber(totals.aterro)}</TableCell>
                  <TableCell className="text-center font-bold">{formatNumber(totals.areia)}</TableCell>
                  <TableCell className="text-center font-bold">{formatNumber(totals.botaFora)}</TableCell>
                  <TableCell className="text-center font-bold">{formatNumber(totals.vegetal)}</TableCell>
                  <TableCell className="text-center font-bold">{formatNumber(totals.bgs)}</TableCell>
                  <TableCell className="text-center font-bold text-[#c0392b]">{formatNumber(totals.total)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {data.length > 0 && (
          <div className="text-right text-xs text-gray-500 mt-2">
            1 - {data.length} / {data.length}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
