import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FlaskConical, FileDown, MessageCircle, Loader2, ArrowDown, ArrowUp, Package, CalendarIcon, RefreshCw, Database, Filter, FileSpreadsheet, BarChart2, ImageIcon, Download, X, Eye, ClipboardList, Settings2, FileText, Pencil, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { WhatsAppExportModal } from '@/components/reports/WhatsAppExportModal';
import * as XLSX from 'xlsx';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { RelatorioEntradasCal, RelatorioEntradasCalRef } from '@/components/reports/RelatorioEntradasCal';
import { exportRelatorioIndividualCal } from '@/components/reports/RelatorioIndividualCal';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';
import { usePageLayout, BlockDefinition } from '@/hooks/usePageLayout';

const CAL_LAYOUT_BLOCKS: BlockDefinition[] = [
  { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
  { key: 'stats_cards', defaultLabel: 'Cards de Resumo (Entradas/Saídas/Saldo)' },
  { key: 'date_filter', defaultLabel: 'Filtro de Data' },
  { key: 'tipo_filter', defaultLabel: 'Filtro de Tipo (Entrada/Saída)' },
  { key: 'table', defaultLabel: 'Tabela de Movimentações' },
  { key: 'reports', defaultLabel: 'Relatórios e Exportações' },
];

const CAL_MOV_COLUMNS: ColumnDefinition[] = [
  { key: 'data', defaultLabel: 'DATA' },
  { key: 'hora', defaultLabel: 'HORA' },
  { key: 'tipo', defaultLabel: 'TIPO' },
  { key: 'local_fornecedor', defaultLabel: 'LOCAL/FORNECEDOR' },
  { key: 'quantidade', defaultLabel: 'Quantidade (t)' },
  { key: 'peso_calc', defaultLabel: 'PESO CALC. OBRA' },
  { key: 'status', defaultLabel: 'STATUS' },
  { key: 'ticket', defaultLabel: 'TICKET' },
];

export default function Cal() {
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [allMovData, setAllMovData] = useState<any[][]>([]);
  const [movHeaders, setMovHeaders] = useState<string[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [filteredMovimentacoes, setFilteredMovimentacoes] = useState<any[]>([]);
  const [estoqueHistorico, setEstoqueHistorico] = useState<any[]>([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [selectedPhotos, setSelectedPhotos] = useState<{ pesoVazio?: string; pesoCarregado?: string; pesoDistribuido?: string; fotosTicket?: string[]; tipo?: string; hora?: string } | null>(null);
  const { readSheet, writeSheet, loading } = useGoogleSheets();
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { isBlockVisible } = usePageLayout('operacao_cal', CAL_LAYOUT_BLOCKS);
  const { configs, getLabel, isVisible, getStyle, getHeaderStyle, getIconName, getHeaderIconName, saveConfigs } = useColumnConfig('cal_movimentacoes', CAL_MOV_COLUMNS);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const entradasRef = useRef<RelatorioEntradasCalRef>(null);
  const [editingMov, setEditingMov] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ qtd: '', fornecedor: '', status: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const calSort = useTableSort(filteredMovimentacoes);

  const [stats, setStats] = useState({
    totalEntradas: 0,
    totalSaidas: 0,
    saldo: 0,
    registrosEntrada: 0,
    registrosSaida: 0,
    estoqueAnterior: 0,
    entradasDia: 0,
    saidasDia: 0,
    estoqueAtual: 0,
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      // Load Mov_Cal
      const movData = await readSheet('Mov_Cal');
      if (movData.length > 1) {
        const headers = movData[0];
        setMovHeaders(headers);
        setAllMovData(movData);
        
        const dateIdx = headers.indexOf('Data');
        const dates = [...new Set(movData.slice(1).map(row => row[dateIdx]).filter(Boolean))];
        
        // Sort dates in descending order
        const sortedDates = dates.sort((a, b) => {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        
        setAvailableDates(sortedDates);
        
        if (sortedDates.length > 0 && !selectedDate) {
          setSelectedDate(sortedDates[0]);
        }

        // Calculate total stats
        const getIdx = (name: string) => headers.indexOf(name);
        const allRecords = movData.slice(1).map(row => ({
          tipo: row[getIdx('Tipo')] || '',
          qtd: parseFloat(String(row[getIdx('Qtd')] || 0).replace('.', '').replace(',', '.')),
        }));

        const entradas = allRecords.filter(r => r.tipo.toLowerCase() === 'entrada');
        const saidas = allRecords.filter(r => r.tipo.toLowerCase() === 'saida' || r.tipo.toLowerCase() === 'saída');

        const totalEntradas = entradas.reduce((sum, r) => sum + r.qtd, 0);
        const totalSaidas = saidas.reduce((sum, r) => sum + r.qtd, 0);

        setStats(prev => ({
          ...prev,
          totalEntradas,
          totalSaidas,
          saldo: totalEntradas - totalSaidas,
          registrosEntrada: entradas.length,
          registrosSaida: saidas.length,
        }));
      }

      // Load Estoque_Cal
      const estoqueData = await readSheet('Estoque_Cal');
      if (estoqueData.length > 1) {
        const headers = estoqueData[0];
        const normalize = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const getIdx = (name: string) => {
          const norm = normalize(name);
          const idx = headers.findIndex((h: string) => normalize(h) === norm);
          if (idx >= 0) return idx;
          // Fallback: partial match
          return headers.findIndex((h: string) => normalize(h).includes(norm) || norm.includes(normalize(h)));
        };
        
        const parseBR = (val: any): number => {
          if (val === null || val === undefined || val === '') return 0;
          const s = String(val).replace(/[^\d.,-]/g, '');
          return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        };
        
        console.log('[Estoque_Cal] Headers:', headers);
        
        const records = estoqueData.slice(1).filter((row: any[]) => row && row.length > 0).map((row: any[]) => ({
          data: row[getIdx('Data')] || '',
          estoqueAnterior: parseBR(row[getIdx('EstoqueAnterior')]),
          saida: parseBR(row[getIdx('Saida')]),
          entrada: parseBR(row[getIdx('Entrada')]),
          estoqueAtual: parseBR(row[getIdx('EstoqueAtual')]),
        }));

        setEstoqueHistorico(records);

        if (records.length > 0) {
          const latest = records[records.length - 1];
          setStats(prev => ({
            ...prev,
            estoqueAnterior: latest.estoqueAnterior,
            estoqueAtual: latest.estoqueAtual,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading cal data:', error);
    }
  };

  const processDataForDate = useCallback((dateStr: string) => {
    if (!allMovData.length || !movHeaders.length || !dateStr) return;
    
    const getIdx = (name: string) => movHeaders.indexOf(name);
    const normalize = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    const getIdxNorm = (name: string) => {
      const norm = normalize(name);
      const idx = movHeaders.findIndex((h: string) => normalize(h) === norm);
      if (idx >= 0) return idx;
      return movHeaders.findIndex((h: string) => normalize(h).includes(norm) || norm.includes(normalize(h)));
    };
    const parseBR = (val: any): number => {
      if (!val) return 0;
      return parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    };
    
    const dayRecords = allMovData.slice(1)
      .map((row, idx) => ({ row, sheetRowIdx: idx + 2 })) // +2: 1-indexed + header
      .filter(({ row }) => row[getIdx('Data')] === dateStr)
      .map(({ row, sheetRowIdx }) => ({
        sheetRowIdx,
        data: row[getIdx('Data')] || '',
        hora: row[getIdx('Hora')] || '',
        tipo: row[getIdx('Tipo')] || '',
        fornecedor: row[getIdx('Fornecedor')] || '',
        prefixo: row[getIdx('Prefixo_Eq')] || '',
        unidade: row[getIdx('Und')] || '',
        qtd: parseFloat(String(row[getIdx('Qtd')] || 0).replace('.', '').replace(',', '.')),
        nf: row[getIdx('NF')] || '',
        valor: parseFloat(String(row[getIdx('Valor')] || 0).replace('R$', '').replace('.', '').replace(',', '.').trim()),
        frete: parseFloat(String(row[getIdx('Frete')] || 0).replace('R$', '').replace('.', '').replace(',', '.').trim()),
        local: row[getIdx('Local')] || '',
        status: row[getIdx('Status')] || '',
        pesoBruto: parseBR(row[getIdxNorm('PesoChegada')] || row[getIdxNorm('PesodeCheGada')] || row[6] || ''),
        pesoVazio: parseBR(row[getIdxNorm('PesoVazio')] || row[5] || ''),
        qtdBalancaObra: (() => {
          const tryNames = ['QtdBalancaObra', 'QtdBalançaObra', 'Qtd Balança Obra', 'Qtd Balanca Obra'];
          let idx = -1;
          for (const name of tryNames) {
            idx = getIdxNorm(name);
            if (idx >= 0) break;
          }
          if (idx < 0) {
            idx = movHeaders.findIndex((h: string) => {
              const n = normalize(h);
              return n.includes('balanc') && n.includes('obra');
            });
          }
          return idx >= 0 ? parseBR(row[idx]) : 0;
        })(),
        fotoPesoVazio: row[getIdx('Foto_Peso_Vazio')] || row[getIdxNorm('FotoPesoVazio')] || row[getIdxNorm('FotodoPesoSaida')] || row[getIdxNorm('FotoPesoSaida')] || row[getIdx('Foto do Peso Saida')] || '',
        fotoPesoCarregado: row[getIdx('Foto_Peso_Carregado')] || row[getIdxNorm('FotoPesoCarregado')] || row[getIdxNorm('FotodoPesoChegada')] || row[getIdxNorm('FotoPesoChegada')] || row[getIdx('Foto do Peso Chegada')] || '',
        fotoPesoDistribuido: row[getIdx('Foto_Peso_Distribuido')] || row[getIdxNorm('FotoPesoDistribuido')] || row[getIdxNorm('FotoPesoDistribuidoObra')] || row[getIdx('Foto Peso Distribuido')] || '',
        fotosTicket: (row[getIdx('Fotos_Ticket')] || row[20] || '').split('|').filter((u: string) => u.startsWith('http')),
      }));

    setMovimentacoes(dayRecords);

    const entradasDia = dayRecords.filter(r => r.tipo.toLowerCase() === 'entrada').reduce((sum, r) => sum + r.qtd, 0);
    const saidasDia = dayRecords.filter(r => r.tipo.toLowerCase() === 'saida' || r.tipo.toLowerCase() === 'saída').reduce((sum, r) => sum + r.qtd, 0);

    setStats(prev => ({
      ...prev,
      entradasDia,
      saidasDia,
    }));
  }, [allMovData, movHeaders]);

  // Filter movimentacoes by tipo
  useEffect(() => {
    if (tipoFiltro === 'todos') {
      setFilteredMovimentacoes(movimentacoes);
    } else if (tipoFiltro === 'entrada') {
      setFilteredMovimentacoes(movimentacoes.filter(m => m.tipo.toLowerCase() === 'entrada'));
    } else {
      setFilteredMovimentacoes(movimentacoes.filter(m => m.tipo.toLowerCase() === 'saida' || m.tipo.toLowerCase() === 'saída'));
    }
  }, [movimentacoes, tipoFiltro]);

  useEffect(() => {
    if (selectedDate) {
      processDataForDate(selectedDate);
    }
  }, [selectedDate, processDataForDate]);

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
  };

  const handleStartEdit = (mov: any) => {
    setEditingMov(mov);
    setEditForm({
      qtd: formatNumber(mov.qtd),
      fornecedor: mov.fornecedor || '',
      status: mov.status || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMov || !movHeaders.length) return;
    setSavingEdit(true);
    try {
      const getIdx = (name: string) => movHeaders.indexOf(name);
      const qtdIdx = getIdx('Qtd');
      const fornecedorIdx = getIdx('Fornecedor');
      const statusIdx = getIdx('Status');
      const rowIdx = editingMov.sheetRowIdx;

      // Parse new quantity
      const newQtd = parseFloat(editForm.qtd.replace(/\./g, '').replace(',', '.')) || 0;
      const oldQtd = editingMov.qtd;

      // Build the row to write - copy current data and update changed fields
      const currentRow = allMovData[rowIdx - 1]; // -1 because allMovData includes header at [0], row 2 = index 1
      if (!currentRow) throw new Error('Linha não encontrada');

      const updatedRow = [...currentRow];
      if (qtdIdx >= 0) updatedRow[qtdIdx] = editForm.qtd.replace('.', '').replace(',', '.');
      if (fornecedorIdx >= 0) updatedRow[fornecedorIdx] = editForm.fornecedor;
      if (statusIdx >= 0) updatedRow[statusIdx] = editForm.status;

      // Write to sheet - handle columns beyond Z (AA, AB, etc.)
      const colToLetter = (col: number): string => {
        let s = '';
        while (col > 0) { col--; s = String.fromCharCode(65 + (col % 26)) + s; col = Math.floor(col / 26); }
        return s;
      };
      const range = `A${rowIdx}:${colToLetter(updatedRow.length)}${rowIdx}`;
      const success = await writeSheet('Mov_Cal', range, [updatedRow]);
      if (!success) throw new Error('Falha ao salvar');

      // Update local data
      const newAllMovData = [...allMovData];
      newAllMovData[rowIdx - 1] = updatedRow;
      setAllMovData(newAllMovData);

      // Recalculate stats
      const diffQtd = newQtd - oldQtd;
      const isEntrada = editingMov.tipo.toLowerCase() === 'entrada';
      setStats(prev => ({
        ...prev,
        totalEntradas: isEntrada ? prev.totalEntradas + diffQtd : prev.totalEntradas,
        totalSaidas: !isEntrada ? prev.totalSaidas + diffQtd : prev.totalSaidas,
        entradasDia: isEntrada ? prev.entradasDia + diffQtd : prev.entradasDia,
        saidasDia: !isEntrada ? prev.saidasDia + diffQtd : prev.saidasDia,
        estoqueAtual: isEntrada ? prev.estoqueAtual + diffQtd : prev.estoqueAtual - diffQtd,
      }));

      // Update movimentacoes locally
      setMovimentacoes(prev => prev.map(m =>
        m.sheetRowIdx === rowIdx
          ? { ...m, qtd: newQtd, fornecedor: editForm.fornecedor, status: editForm.status }
          : m
      ));

      toast.success('Registro atualizado com sucesso!');
      setEditingMov(null);
    } catch (err: any) {
      console.error('Erro ao salvar edição:', err);
      toast.error(err.message || 'Erro ao salvar edição');
    } finally {
      setSavingEdit(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const numberToWords = (num: number): string => {
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (num === 0) return 'zero';
    if (num === 100) return 'cem';

    const convertGroup = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return units[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) {
        const t = Math.floor(n / 10);
        const u = n % 10;
        return tens[t] + (u > 0 ? ' e ' + units[u] : '');
      }
      if (n === 100) return 'cem';
      const h = Math.floor(n / 100);
      const rest = n % 100;
      return hundreds[h] + (rest > 0 ? ' e ' + convertGroup(rest) : '');
    };

    const rounded = Math.round(num);
    if (rounded >= 1000000000) {
      const billions = Math.floor(rounded / 1000000000);
      const rest = rounded % 1000000000;
      const billionWord = billions === 1 ? 'um bilhão' : convertGroup(billions) + ' bilhões';
      return billionWord + (rest > 0 ? ' ' + numberToWords(rest) : '');
    }
    if (rounded >= 1000000) {
      const millions = Math.floor(rounded / 1000000);
      const rest = rounded % 1000000;
      const millionWord = millions === 1 ? 'um milhão' : convertGroup(millions) + ' milhões';
      return millionWord + (rest > 0 ? (rest < 1000 ? ' e ' : ' ') + numberToWords(rest) : '');
    }
    if (rounded >= 1000) {
      const thousands = Math.floor(rounded / 1000);
      const rest = rounded % 1000;
      const thousandWord = thousands === 1 ? 'mil' : convertGroup(thousands) + ' mil';
      return thousandWord + (rest > 0 ? (rest < 100 ? ' e ' : ' ') + convertGroup(rest) : '');
    }
    return convertGroup(rounded);
  };
  
  const formatCurrency = (num: number) => num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getDisplayDate = () => {
    if (!selectedDate) return format(new Date(), "dd 'de' MMMM", { locale: ptBR });
    const [day, month, year] = selectedDate.split('/').map(Number);
    return format(new Date(year, month - 1, day), "dd 'de' MMMM", { locale: ptBR });
  };

  // Helper: convert image src to base64 for PDF embedding
  const toBase64 = (src: string): Promise<string> => {
    if (src.startsWith('data:')) return Promise.resolve(src);
    return new Promise<string>((resolve) => {
      const img = document.createElement('img') as HTMLImageElement;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  // Export to PDF
  const handleExportPDF = async () => {
    const logoBase64 = await toBase64(activeLogo);
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Controle de CAL - ${selectedDate}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { background: linear-gradient(135deg, #ea580c, #f97316); color: white; display: flex; align-items: center; gap: 16px; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; }
          .header-logo-box { background: rgba(255,255,255,0.15); border-radius: 6px; padding: 6px; flex-shrink: 0; }
          .header-logo-box img { height: 60px; width: auto; object-fit: contain; display: block; }
          .header-info { flex: 1; }
          .header-obra-nome { font-size: 13px; font-weight: 700; opacity: 0.9; margin-bottom: 2px; }
          .header-obra-local { font-size: 10px; opacity: 0.7; margin-bottom: 4px; }
          .header-title { font-size: 20px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
          .header-date { font-size: 11px; opacity: 0.85; margin-top: 3px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
          .stat-card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; }
          .stat-card.entrada { border-color: #22c55e; background: #f0fdf4; }
          .stat-card.saida { border-color: #ef4444; background: #fef2f2; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-label { font-size: 11px; color: #666; margin-top: 4px; }
          .entrada .stat-value { color: #16a34a; }
          .saida .stat-value { color: #dc2626; }
          .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px; color: #2d3e50; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
          .badge-entrada { background: #dcfce7; color: #16a34a; }
          .badge-saida { background: #fee2e2; color: #dc2626; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 15px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-logo-box">
            <img src="${logoBase64}" alt="Logo" />
          </div>
          <div class="header-info">
            ${obraConfig.nome ? `<div class="header-obra-nome">${obraConfig.nome}</div>` : ''}
            ${obraConfig.local ? `<div class="header-obra-local">📍 ${obraConfig.local}</div>` : ''}
            <div class="header-title">CONTROLE DE CAL</div>
            <div class="header-date">📅 ${selectedDate}</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatNumber(stats.estoqueAnterior)}</div>
            <div class="stat-label">Estoque Anterior (ton)</div>
          </div>
          <div class="stat-card entrada">
            <div class="stat-value">${formatNumber(stats.entradasDia)}</div>
            <div class="stat-label">Entradas do Dia (ton)</div>
          </div>
          <div class="stat-card saida">
            <div class="stat-value">${formatNumber(stats.saidasDia)}</div>
            <div class="stat-label">Saídas do Dia (ton)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatNumber(stats.estoqueAtual)}</div>
            <div class="stat-label">Estoque Atual (ton)</div>
          </div>
        </div>

        <div class="section-title">
          📋 Movimentações do Dia ${tipoFiltro !== 'todos' ? `(Filtro: ${tipoFiltro === 'entrada' ? 'Entradas' : 'Saídas'})` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Tipo</th>
              <th>Fornecedor</th>
              <th class="text-right">Qtd (ton)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMovimentacoes.map(mov => `
              <tr>
                <td>${mov.hora}</td>
                <td><span class="badge ${mov.tipo.toLowerCase() === 'entrada' ? 'badge-entrada' : 'badge-saida'}">${mov.tipo}</span></td>
                <td>${mov.fornecedor || '-'}</td>
                <td class="text-right">${formatNumber(mov.qtd)}</td>
              </tr>
            `).join('')}
            ${filteredMovimentacoes.length === 0 ? '<tr><td colspan="4" class="text-center">Nenhuma movimentação encontrada</td></tr>' : ''}
          </tbody>
        </table>

        <div class="section-title">📊 Resumo Total do Período</div>
        <div class="stats-grid" style="grid-template-columns: 1fr;">
          <div class="stat-card entrada">
            <div class="stat-value">${formatNumber(stats.totalEntradas)}</div>
            <div class="stat-label">Total Entradas (ton) - ${stats.registrosEntrada} registros</div>
          </div>
        </div>

        <div class="footer">
          <p>ApropriAPP - Gestão Inteligente de Operações</p>
          <p>Este documento foi gerado automaticamente pelo sistema.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 250);
    }
  };

  // Export to XLSX
  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();
    
    const excelData = filteredMovimentacoes.map((mov, idx) => ({
      'Nº': idx + 1,
      'Data': mov.data,
      'Hora': mov.hora,
      'Tipo': mov.tipo,
      'Fornecedor': mov.fornecedor || '',
      'Quantidade (ton)': mov.qtd,
    }));
    
    // Add summary
    excelData.push({} as any);
    excelData.push({
      'Nº': '' as any,
      'Data': 'RESUMO',
      'Hora': '',
      'Tipo': '',
      'Fornecedor': 'Total Entradas',
      'Quantidade (ton)': stats.entradasDia,
    });
    excelData.push({
      'Nº': '' as any,
      'Data': '',
      'Hora': '',
      'Tipo': '',
      'Fornecedor': 'Total Saídas',
      'Quantidade (ton)': stats.saidasDia,
    });
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'CAL');
    XLSX.writeFile(wb, `cal-${selectedDate.replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {isBlockVisible('header_actions') && <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Controle de CAL</h1>
            <p className="text-muted-foreground text-sm">
              Gestão de estoque e movimentações • {getDisplayDate()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedDate} onValueChange={handleDateChange}>
            <SelectTrigger className="w-[160px] h-9">
              <CalendarIcon className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Selecione a data" />
            </SelectTrigger>
            <SelectContent>
              {availableDates.map((date) => (
                <SelectItem key={date} value={date}>
                  {date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="gap-1">
            <Database className="w-3 h-3" />
            {availableDates.length} dias
          </Badge>
          <Button variant="outline" size="icon" onClick={loadAllData} disabled={loading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>}

      {/* Tabs: Operação | Relatórios */}
      <Tabs defaultValue="operacao" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="operacao">
            <FlaskConical className="w-4 h-4 mr-2" />
            Operação
          </TabsTrigger>
          <TabsTrigger value="relatorios">
            <BarChart2 className="w-4 h-4 mr-2" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="entradas">
            <ClipboardList className="w-4 h-4 mr-2" />
            Entradas
          </TabsTrigger>
        </TabsList>

        {/* ── Operação ── */}
        <TabsContent value="operacao" className="space-y-4">
          {/* Period Summary - Only Entradas */}
          {isBlockVisible('stats_cards') && <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📊</span> Resumo Total do Período
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Consolidado de todas as movimentações ({availableDates.length} dias com registros)
              </p>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg border-green-200 bg-green-50/50">
                <p className="text-sm text-green-600 font-medium">TOTAL DE ENTRADAS</p>
                <p className="text-3xl font-bold text-green-600">{stats.totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ton</p>
                <p className="text-xs text-muted-foreground mt-2">{stats.registrosEntrada} registros</p>
              </div>
            </CardContent>
          </Card>}

          {/* Daily Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📅 Controle Diário - {selectedDate || 'Selecione uma data'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Estoque Anterior</p>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(stats.estoqueAnterior)} ton</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDown className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-600">Entradas do Dia</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{formatNumber(stats.entradasDia)} ton</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUp className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-600">Saídas do Dia</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{formatNumber(stats.saidasDia)} ton</p>
                </div>
                <div className="p-4 border rounded-lg bg-secondary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4" />
                    <p className="text-sm font-medium">Estoque Atual</p>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(stats.estoqueAtual)} ton</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Movimentações */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Movimentações do Dia</CardTitle>
                    <div className="flex items-center gap-2">
                      {isMainAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowColumnConfig(true)} title="Configurar colunas">
                          <Settings2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as 'todos' | 'entrada' | 'saida')}>
                        <SelectTrigger className="w-[150px] h-8">
                          <SelectValue placeholder="Filtrar por tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="entrada">
                            <span className="flex items-center gap-2">
                              <ArrowDown className="w-3 h-3 text-green-600" />
                              Entradas
                            </span>
                          </SelectItem>
                          <SelectItem value="saida">
                            <span className="flex items-center gap-2">
                              <ArrowUp className="w-3 h-3 text-red-600" />
                              Saídas
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                    <TableRow className="bg-primary/10">
                        {isVisible('data') && <SortableTableHead sortKey="data" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('data')}>{getLabel('data')}</SortableTableHead>}
                        {isVisible('hora') && <SortableTableHead sortKey="hora" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('hora')}>{getLabel('hora')}</SortableTableHead>}
                        {isVisible('tipo') && <SortableTableHead sortKey="tipo" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('tipo')}>{getLabel('tipo')}</SortableTableHead>}
                        {isVisible('local_fornecedor') && <SortableTableHead sortKey="fornecedor" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('local_fornecedor')}>{getLabel('local_fornecedor')}</SortableTableHead>}
                        {isVisible('quantidade') && <SortableTableHead sortKey="qtd" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('quantidade')}>{getLabel('quantidade')}</SortableTableHead>}
                        {isVisible('peso_calc') && <SortableTableHead sortKey="qtdBalancaObra" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('peso_calc')}>{getLabel('peso_calc')}<br/><span className="font-normal text-muted-foreground">(Chegada - Saída)</span></SortableTableHead>}
                        {isVisible('status') && <SortableTableHead sortKey="status" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('status')}>{getLabel('status')}</SortableTableHead>}
                        {isVisible('ticket') && <SortableTableHead sortKey="ticket" sortConfig={calSort.sortConfig} onSort={calSort.requestSort} style={getHeaderStyle('ticket')} sortable={false}>{getLabel('ticket')}</SortableTableHead>}
                        <TableHead className="text-center w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calSort.sortedData.map((mov, idx) => {
                        const hasTicketPhotos = !!(mov.fotosTicket && mov.fotosTicket.length > 0);
                        return (
                          <TableRow key={idx}>
                            {isVisible('data') && <TableCell style={getStyle('data', mov.data)}>{mov.data}</TableCell>}
                            {isVisible('hora') && <TableCell style={getStyle('hora', mov.hora)}>{mov.hora}</TableCell>}
                            {isVisible('tipo') && <TableCell style={getStyle('tipo', mov.tipo)}>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                mov.tipo.toLowerCase() === 'entrada' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {mov.tipo}
                              </span>
                            </TableCell>}
                            {isVisible('local_fornecedor') && <TableCell style={getStyle('local_fornecedor', mov.tipo.toLowerCase() === 'entrada' ? mov.fornecedor : (mov.local || mov.fornecedor))}>{mov.tipo.toLowerCase() === 'entrada' ? mov.fornecedor : (mov.local || mov.fornecedor)}</TableCell>}
                            {isVisible('quantidade') && <TableCell style={getStyle('quantidade', String(mov.qtd))}>{formatNumber(mov.qtd)}</TableCell>}
                            {isVisible('peso_calc') && <TableCell>
                              {mov.tipo.toLowerCase() === 'entrada' ? (() => {
                                let pesoCalc = mov.qtdBalancaObra;
                                if (!pesoCalc && mov.pesoBruto > 0 && mov.pesoVazio > 0) {
                                  const diffRaw = mov.pesoBruto - mov.pesoVazio;
                                  pesoCalc = diffRaw > 100 ? diffRaw / 1000 : diffRaw;
                                }
                                if (pesoCalc <= 0) return <span className="text-muted-foreground">—</span>;
                                const diff = mov.qtd > 0 ? Math.abs(pesoCalc - mov.qtd) / mov.qtd : 0;
                                const isDivergent = mov.qtd > 0 && diff > 0.05;
                                return (
                                  <span className={`font-medium ${isDivergent ? 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded' : 'text-emerald-700'}`} title={isDivergent ? `Divergência de ${(diff * 100).toFixed(1)}% em relação à QTD (${formatNumber(mov.qtd)})` : ''}>
                                    {formatNumber(pesoCalc)}
                                    {isDivergent && ' ⚠️'}
                                  </span>
                                );
                              })() : <span className="text-muted-foreground">—</span>}
                            </TableCell>}
                            {isVisible('status') && <TableCell className="text-center">
                              {mov.status ? (
                                <Badge variant={mov.status.toLowerCase().includes('aberto') ? 'outline' : 'default'}
                                  className={mov.status.toLowerCase().includes('aberto')
                                    ? 'border-amber-400 text-amber-700 bg-amber-50 text-xs'
                                    : 'bg-emerald-600 text-white text-xs'
                                  }>
                                  {mov.status}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>}
                            {isVisible('ticket') && <TableCell className="text-center">
                              {hasTicketPhotos ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  onClick={() => setSelectedPhotos({
                                    fotosTicket: mov.fotosTicket,
                                    tipo: mov.tipo,
                                    hora: mov.hora,
                                  })}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Ver
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>}
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                  onClick={() => handleStartEdit(mov)}
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50"
                                  onClick={() => exportRelatorioIndividualCal(mov, obraConfig)}
                                  title="Relatório Individual"
                                >
                                  <FileText className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredMovimentacoes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            {tipoFiltro === 'todos' 
                              ? 'Nenhuma movimentação encontrada para esta data'
                              : `Nenhuma ${tipoFiltro === 'entrada' ? 'entrada' : 'saída'} encontrada para esta data`
                            }
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
        </TabsContent>

        {/* ── Relatórios ── */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* PDF */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-slate-200 hover:border-slate-400"
              onClick={handleExportPDF}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <FileDown className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Exportar PDF</h3>
                  <p className="text-sm text-muted-foreground mt-1">Relatório de movimentações para impressão</p>
                </div>
                <Badge variant="secondary">{selectedDate || 'Sem data'}</Badge>
              </CardContent>
            </Card>

            {/* Excel */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-green-200 hover:border-green-400"
              onClick={handleExportXLSX}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Exportar Excel</h3>
                  <p className="text-sm text-muted-foreground mt-1">Planilha com todas as movimentações do dia</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {filteredMovimentacoes.length} registros
                </Badge>
              </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-emerald-200 hover:border-emerald-400"
              onClick={() => setShowWhatsAppModal(true)}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Enviar WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mt-1">Resumo do estoque via mensagem</p>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  {formatNumber(stats.estoqueAtual)} ton
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Entradas reports */}
          <h3 className="text-sm font-semibold text-muted-foreground mt-6 mb-2">Relatório de Entradas</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-blue-200 hover:border-blue-400"
              onClick={() => entradasRef.current?.exportPdf()}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileDown className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">PDF de Entradas</h3>
                  <p className="text-sm text-muted-foreground mt-1">Relatório completo de todas as entradas de CAL</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-green-200 hover:border-green-400"
              onClick={() => entradasRef.current?.exportExcel()}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Excel de Entradas</h3>
                  <p className="text-sm text-muted-foreground mt-1">Planilha com todas as entradas de CAL do período</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Entradas ── */}
        <TabsContent value="entradas">
          <RelatorioEntradasCal
            ref={entradasRef}
            allMovData={allMovData}
            movHeaders={movHeaders}
            obraLogo={activeLogo}
            obraNome={obraConfig.nome}
          />
        </TabsContent>
      </Tabs>

      {/* WhatsApp Export Modal */}
      <WhatsAppExportModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        data={{
          date: selectedDate,
          estoqueAnterior: stats.estoqueAnterior,
          entradasDia: stats.entradasDia,
          saidasDia: stats.saidasDia,
          estoqueAtual: stats.estoqueAtual,
          totalEntradas: stats.totalEntradas,
          totalSaidas: stats.totalSaidas,
          saldo: stats.saldo,
        }}
      />

      {/* Ticket Photo Viewer Modal */}
      <Dialog open={!!selectedPhotos} onOpenChange={(open) => !open && setSelectedPhotos(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Fotos do Ticket — {selectedPhotos?.tipo} {selectedPhotos?.hora}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPhotos?.pesoVazio && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-orange-700">📷 Peso Vazio</p>
                <img src={selectedPhotos.pesoVazio} alt="Ticket Peso Vazio" className="w-full rounded-lg border shadow-sm" />
                <a href={selectedPhotos.pesoVazio} download={`ticket-peso-vazio-${selectedPhotos.hora}.jpg`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download className="w-4 h-4" /> Baixar Imagem
                  </Button>
                </a>
              </div>
            )}
            {selectedPhotos?.pesoCarregado && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-emerald-700">📷 Peso Carregado</p>
                <img src={selectedPhotos.pesoCarregado} alt="Ticket Peso Carregado" className="w-full rounded-lg border shadow-sm" />
                <a href={selectedPhotos.pesoCarregado} download={`ticket-peso-carregado-${selectedPhotos.hora}.jpg`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download className="w-4 h-4" /> Baixar Imagem
                  </Button>
                </a>
              </div>
            )}
            {selectedPhotos?.pesoDistribuido && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-700">📷 Peso Distribuído</p>
                <img src={selectedPhotos.pesoDistribuido} alt="Ticket Peso Distribuído" className="w-full rounded-lg border shadow-sm" />
                <a href={selectedPhotos.pesoDistribuido} download={`ticket-peso-distribuido-${selectedPhotos.hora}.jpg`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download className="w-4 h-4" /> Baixar Imagem
                  </Button>
                </a>
              </div>
            )}
            {/* Ticket Photos (multiple) */}
            {selectedPhotos?.fotosTicket && selectedPhotos.fotosTicket.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-indigo-700">📄 Fotos do Ticket ({selectedPhotos.fotosTicket.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedPhotos.fotosTicket.map((url, idx) => (
                    <div key={idx} className="space-y-1">
                      <img src={url} alt={`Ticket ${idx + 1}`} className="w-full rounded-lg border shadow-sm cursor-pointer" onClick={() => window.open(url, '_blank')} />
                      <a href={url} download={`ticket-${idx + 1}-${selectedPhotos.hora}.jpg`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                          <Download className="w-3 h-3" /> Baixar
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!selectedPhotos?.pesoVazio && !selectedPhotos?.pesoCarregado && !selectedPhotos?.pesoDistribuido && (!selectedPhotos?.fotosTicket || selectedPhotos.fotosTicket.length === 0) && (
              <p className="text-center text-muted-foreground py-8">Nenhuma foto disponível para este registro.</p>
            )}
            {/* Export all as PDF */}
            {(selectedPhotos?.pesoVazio || selectedPhotos?.pesoCarregado || selectedPhotos?.pesoDistribuido || (selectedPhotos?.fotosTicket && selectedPhotos.fotosTicket.length > 0)) && (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  const photos = selectedPhotos!;
                  const ticketImgs = (photos.fotosTicket || []).map((url, i) => `<div class="page-break"><h2>Ticket ${i + 1}</h2><img src="${url}" /></div>`).join('');
                  const printContent = `
                    <!DOCTYPE html><html><head>
                    <title>Ticket CAL - ${photos.tipo} ${photos.hora}</title>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                      h1 { font-size: 18px; margin-bottom: 10px; }
                      h2 { font-size: 14px; color: #666; margin: 20px 0 8px; }
                      img { max-width: 100%; max-height: 70vh; border: 1px solid #ddd; border-radius: 8px; }
                      .page-break { page-break-before: always; }
                      @media print { body { padding: 10px; } }
                    </style></head><body>
                    <h1>Ticket de Pesagem — ${photos.tipo} às ${photos.hora}</h1>
                    <p style="color:#999;font-size:12px;margin-bottom:20px;">${selectedDate} • ${obraConfig.nome || 'ApropriAPP'}</p>
                    ${photos.pesoVazio ? `<h2>Peso Vazio</h2><img src="${photos.pesoVazio}" />` : ''}
                    ${photos.pesoCarregado ? `<div class="${photos.pesoVazio ? 'page-break' : ''}"><h2>Peso Carregado</h2><img src="${photos.pesoCarregado}" /></div>` : ''}
                    ${photos.pesoDistribuido ? `<div class="page-break"><h2>Peso Distribuído</h2><img src="${photos.pesoDistribuido}" /></div>` : ''}
                    ${ticketImgs}
                    </body></html>`;
                  const w = window.open('', '_blank');
                  if (w) { w.document.write(printContent); w.document.close(); setTimeout(() => w.print(), 500); }
                }}
              >
                <FileDown className="w-4 h-4" /> Exportar Tudo em PDF
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingMov} onOpenChange={(open) => !open && setEditingMov(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Editar Movimentação
            </DialogTitle>
          </DialogHeader>
          {editingMov && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <span className="ml-2 font-medium">{editingMov.data}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Hora:</span>
                  <span className="ml-2 font-medium">{editingMov.hora}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge className={`ml-2 ${editingMov.tipo.toLowerCase() === 'entrada' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {editingMov.tipo}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade (ton)</Label>
                <Input
                  value={editForm.qtd}
                  onChange={(e) => setEditForm(prev => ({ ...prev, qtd: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor / Local</Label>
                <Input
                  value={editForm.fornecedor}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fornecedor: e.target.value }))}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Finalizado">Finalizado</SelectItem>
                    <SelectItem value="Em aberto">Em aberto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditingMov(null)} disabled={savingEdit}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Column Config Modal */}
      <ColumnConfigModal
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        tableLabel="Movimentações CAL"
        defaultColumns={CAL_MOV_COLUMNS}
        currentConfigs={configs}
        onSave={saveConfigs}
      />
    </div>
  );
}
