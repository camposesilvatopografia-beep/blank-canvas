import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertTriangle, Check, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ImportRow {
  codigo: string;
  nome: string;
  categoria: string;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
  observacoes: string;
  valid: boolean;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const normalize = (s: string) =>
  s?.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') || '';

const COLUMN_MAP: Record<string, keyof Omit<ImportRow, 'valid' | 'error'>> = {
  codigo: 'codigo', cod: 'codigo', code: 'codigo', codigomaterial: 'codigo',
  nome: 'nome', material: 'nome', descricao: 'nome', item: 'nome', nomematerial: 'nome',
  categoria: 'categoria', cat: 'categoria', tipo: 'categoria', grupo: 'categoria',
  unidade: 'unidade', und: 'unidade', un: 'unidade', unidademedida: 'unidade',
  estoqueatual: 'estoque_atual', saldo: 'estoque_atual', quantidade: 'estoque_atual', qtd: 'estoque_atual', qtde: 'estoque_atual', estoque: 'estoque_atual',
  estoqueminimo: 'estoque_minimo', minimo: 'estoque_minimo', min: 'estoque_minimo',
  observacoes: 'observacoes', obs: 'observacoes', observacao: 'observacoes',
};

function mapColumns(headers: string[]): Record<number, keyof Omit<ImportRow, 'valid' | 'error'>> {
  const map: Record<number, keyof Omit<ImportRow, 'valid' | 'error'>> = {};
  headers.forEach((h, i) => {
    const key = normalize(h);
    if (COLUMN_MAP[key]) map[i] = COLUMN_MAP[key];
  });
  return map;
}

export default function AlmImportModal({ open, onClose }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (json.length < 2) { toast.error('Planilha vazia ou sem dados'); return; }

        const headers = json[0].map(String);
        const colMap = mapColumns(headers);

        if (!Object.values(colMap).includes('nome')) {
          toast.error('Coluna "Nome" ou "Material" não encontrada na planilha');
          return;
        }

        const parsed: ImportRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const r = json[i];
          if (!r || r.every(c => !c)) continue;

          const row: ImportRow = {
            codigo: '', nome: '', categoria: '', unidade: 'un',
            estoque_atual: 0, estoque_minimo: 0, observacoes: '', valid: true,
          };

          Object.entries(colMap).forEach(([idx, field]) => {
            const val = r[Number(idx)];
            if (val === undefined || val === null) return;
            if (field === 'estoque_atual' || field === 'estoque_minimo') {
              row[field] = Number(val) || 0;
            } else {
              (row as any)[field] = String(val).trim();
            }
          });

          if (!row.nome) { row.valid = false; row.error = 'Nome obrigatório'; }
          if (!row.codigo) row.codigo = `IMP-${String(i).padStart(4, '0')}`;

          parsed.push(row);
        }

        setRows(parsed);
        toast.success(`${parsed.length} itens lidos da planilha`);
      } catch {
        toast.error('Erro ao ler o arquivo');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const valid = rows.filter(r => r.valid);
    if (valid.length === 0) { toast.error('Nenhum item válido para importar'); return; }

    setImporting(true);
    try {
      const batch = valid.map(r => ({
        codigo: r.codigo,
        nome: r.nome,
        categoria: r.categoria || null,
        unidade: r.unidade || 'un',
        estoque_atual: r.estoque_atual,
        estoque_minimo: r.estoque_minimo,
        observacoes: r.observacoes || null,
        status: 'Ativo',
      }));

      const { error } = await (supabase as any).from('alm_materiais').upsert(batch, { onConflict: 'codigo' });
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['alm_materiais'] });
      toast.success(`${valid.length} materiais importados com sucesso!`);
      setRows([]);
      setFileName('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  const downloadTemplate = () => {
    const templateData = [
      ['Código', 'Nome', 'Categoria', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Observações'],
      ['MAT-0001', 'Cimento CP-II 50kg', 'Construção', 'sc', 100, 20, 'Marca XYZ'],
      ['MAT-0002', 'Aço CA-50 10mm', 'Construção', 'kg', 500, 100, ''],
      ['MAT-0003', 'Fio 2,5mm Azul', 'Elétrica', 'rl', 30, 10, 'Rolo 100m'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_importacao_almoxarifado.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setRows([]); setFileName(''); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Importar Inventário</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Selecione um arquivo Excel (.xlsx) ou CSV com os materiais</p>
            <p className="text-xs text-muted-foreground">Colunas esperadas: <strong>Código, Nome/Material, Categoria, Unidade, Estoque Atual/Qtd, Estoque Mínimo, Observações</strong></p>
            <div className="flex gap-2 justify-center flex-wrap">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                {fileName || 'Escolher arquivo'}
              </Button>
              <Button variant="ghost" size="sm" className="text-primary" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-1" /> Baixar modelo
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex gap-2 items-center flex-wrap">
                <Badge variant="outline" className="border-emerald-500 text-emerald-600"><Check className="w-3 h-3 mr-1" />{validCount} válidos</Badge>
                {invalidCount > 0 && <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{invalidCount} com erro</Badge>}
              </div>

              <div className="border rounded-lg overflow-auto max-h-[40vh]">
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: '#1d3557' }}>
                      <TableHead className="text-white font-bold">Código</TableHead>
                      <TableHead className="text-white font-bold">Nome</TableHead>
                      <TableHead className="text-white font-bold">Categoria</TableHead>
                      <TableHead className="text-white font-bold text-center">Unid</TableHead>
                      <TableHead className="text-white font-bold text-center">Estoque</TableHead>
                      <TableHead className="text-white font-bold text-center">Mín</TableHead>
                      <TableHead className="text-white font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i} className={!r.valid ? 'bg-red-50 dark:bg-red-950/20' : i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                        <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell>{r.categoria || '-'}</TableCell>
                        <TableCell className="text-center">{r.unidade}</TableCell>
                        <TableCell className="text-center font-bold">{r.estoque_atual}</TableCell>
                        <TableCell className="text-center">{r.estoque_minimo}</TableCell>
                        <TableCell className="text-center">
                          {r.valid
                            ? <Badge variant="outline" className="border-emerald-500 text-emerald-600">OK</Badge>
                            : <Badge variant="destructive" title={r.error}>{r.error}</Badge>
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button className="w-full" onClick={handleImport} disabled={importing || validCount === 0}>
                {importing ? 'Importando...' : `Importar ${validCount} materiais`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
