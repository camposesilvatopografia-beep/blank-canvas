import { useState, useMemo } from 'react';
import { useAlmMovimentacoes, useAlmMateriais } from './useAlmData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export default function AlmRelatorios() {
  const { data: movs = [] } = useAlmMovimentacoes();
  const { data: materiais = [] } = useAlmMateriais();
  const matMap = Object.fromEntries(materiais.map(m => [m.id, m]));

  const [equipeFilter, setEquipeFilter] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const saidas = useMemo(() => {
    return movs.filter(m => {
      if (m.tipo !== 'saida') return false;
      if (equipeFilter && m.equipe !== equipeFilter) return false;
      if (dataInicio && m.data < dataInicio) return false;
      if (dataFim && m.data > dataFim) return false;
      return true;
    });
  }, [movs, equipeFilter, dataInicio, dataFim]);

  const equipes = [...new Set(movs.filter(m => m.equipe).map(m => m.equipe!))];

  // Agrupar por equipe
  const porEquipe: Record<string, { material: string; quantidade: number; unidade: string; datas: string[] }[]> = {};
  saidas.forEach(s => {
    const eq = s.equipe || 'Não informado';
    if (!porEquipe[eq]) porEquipe[eq] = [];
    const mat = matMap[s.material_id];
    const existing = porEquipe[eq].find(x => x.material === (mat?.nome || '-'));
    if (existing) {
      existing.quantidade += Number(s.quantidade);
      existing.datas.push(s.data);
    } else {
      porEquipe[eq].push({ material: mat?.nome || '-', quantidade: Number(s.quantidade), unidade: mat?.unidade || '', datas: [s.data] });
    }
  });

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(29, 53, 87);
    doc.text('RELATÓRIO DE CONSUMO POR EQUIPE', 105, 20, { align: 'center' });
    let y = 35;
    Object.entries(porEquipe).forEach(([eq, items]) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(29, 53, 87);
      doc.text(`Equipe: ${eq}`, 14, y);
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(0);
      items.forEach(item => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(`${item.material} — ${item.quantidade} ${item.unidade}`, 18, y);
        y += 5;
      });
      y += 5;
    });
    doc.save('consumo-por-equipe.pdf');
  };

  const exportExcel = () => {
    const rows: any[] = [];
    Object.entries(porEquipe).forEach(([eq, items]) => {
      items.forEach(item => {
        rows.push({ Equipe: eq, Material: item.material, Quantidade: item.quantidade, Unidade: item.unidade });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consumo');
    XLSX.writeFile(wb, 'consumo-por-equipe.xlsx');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros do Relatório</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" placeholder="Data Início" />
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" placeholder="Data Fim" />
          <Select value={equipeFilter} onValueChange={setEquipeFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todas as equipes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {equipes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={exportPdf}><FileText className="w-4 h-4 mr-1" /> PDF</Button>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
          </div>
        </CardContent>
      </Card>

      {Object.entries(porEquipe).length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum dado para os filtros selecionados</p>
      ) : Object.entries(porEquipe).map(([eq, items]) => (
        <Card key={eq}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{eq}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow style={{ background: '#1d3557' }}>
                  <TableHead className="text-white font-bold">Material</TableHead>
                  <TableHead className="text-white font-bold text-center">Quantidade</TableHead>
                  <TableHead className="text-white font-bold text-center">Unidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    <TableCell className="font-medium">{item.material}</TableCell>
                    <TableCell className="text-center font-bold">{item.quantidade}</TableCell>
                    <TableCell className="text-center">{item.unidade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
