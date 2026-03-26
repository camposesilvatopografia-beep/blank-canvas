import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { 
  Loader2, RefreshCw, Truck, Factory, MapPin, Clock, 
  CheckCircle2, AlertCircle, ArrowRight, Search, Filter,
  MessageCircle, FileText, CalendarIcon, Send, Pencil, Trash2,
  FastForward
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import html2canvas from 'html2canvas';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useToast } from '@/hooks/use-toast';

interface CycleRecord {
  rowIndex: number;
  data: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  placa: string;
  fornecedor: string;
  material: string;
  horaSaidaBritador: string;
  horaBalanca: string;
  horaChegadaObra: string;
  usuarioBritador: string;
  usuarioObra: string;
  pesoVazio: string;
  pesoFinal: string;
  tonelada: string;
  ordem: string;
  status: string;
  // raw row for editing
  _row?: string[];
  _headers?: string[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Factory; bgClass: string }> = {
  'Saiu_Britador': { 
    label: 'Em Trânsito (Britador → Balança)', 
    color: 'bg-amber-500', 
    icon: Factory,
    bgClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
  },
  'Pesado': { 
    label: 'Pesado (Balança → Obra)', 
    color: 'bg-blue-500', 
    icon: Truck,
    bgClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
  },
  'Finalizado': { 
    label: 'Finalizado', 
    color: 'bg-green-500', 
    icon: CheckCircle2,
    bgClass: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
  },
};

interface Props {
  /** Pre-filter search term (e.g. prefixo from pending cycle click) */
  initialSearch?: string;
  /** Pre-select a specific date (dd/MM/yyyy) */
  initialDate?: string;
}

export function PedreiraAcompanhamentoTab({ initialSearch = '', initialDate = '' }: Props) {
  const { readSheet, writeSheet, deleteRow, loading: sheetLoading } = useGoogleSheets();
  const { isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { toast } = useToast();
  const [advancingRow, setAdvancingRow] = useState<number | null>(null);

  const [records, setRecords] = useState<CycleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [observacao, setObservacao] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<CycleRecord | null>(null);
  const [editForm, setEditForm] = useState({
    prefixo: '', motorista: '', empresa: '', material: '',
    horaSaidaBritador: '', horaBalanca: '', horaChegadaObra: '',
    pesoVazio: '', pesoFinal: '', tonelada: '', ordem: '', status: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<CycleRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const parseDate = (d: string) => {
    const [day, month, year] = d.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateStr = (date: Date) =>
    `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (!data || data.length < 2) { setRecords([]); return; }

      const headers = data[0];
      const fi = (name: string) => headers.indexOf(name);

      const datesSet = new Set<string>();
      const allRecords: CycleRecord[] = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowDate = row[fi('Data')] || '';
        const status = row[fi('Status')] || '';
        
        if (rowDate) datesSet.add(rowDate);

        allRecords.push({
          rowIndex: i + 1,
          data: rowDate,
          prefixo: row[fi('Prefixo_Eq')] || '',
          descricao: row[fi('Descricao_Eq')] || '',
          empresa: row[fi('Empresa_Eq')] || '',
          motorista: row[fi('Motorista')] || '',
          placa: row[fi('Placa')] || '',
          fornecedor: row[fi('Fornecedor')] || '',
          material: row[fi('Material')] || '',
          horaSaidaBritador: row[fi('Hora_Saida_Britador')] || '',
          horaBalanca: row[fi('Hora')] || '',
          horaChegadaObra: row[fi('Hora_Chegada_Obra')] || '',
          usuarioBritador: row[fi('Usuario_Britador')] || '',
          usuarioObra: row[fi('Usuario_Obra')] || '',
          pesoVazio: row[fi('Peso_Vazio')] || '',
          pesoFinal: row[fi('Peso_Final')] || '',
          tonelada: row[fi('Tonelada')] || '',
          ordem: row[fi('Ordem_Carregamento')] || '',
          status,
          _row: [...row],
          _headers: headers,
        });
      }

      const sortedDates = Array.from(datesSet).sort((a, b) => parseDate(b).getTime() - parseDate(a).getTime());
      setAvailableDates(sortedDates);

      if (!selectedDate && sortedDates.length > 0) {
        const dateToSet = initialDate || sortedDates[0];
        setSelectedDate(dateToSet);
        setCalendarDate(parseDate(dateToSet));
      }

      setRecords(allRecords);
    } catch (error) {
      console.error('Error loading tracking data:', error);
    } finally {
      setLoading(false);
    }
  }, [readSheet, initialDate]);

  useEffect(() => {
    loadData();
  }, []);

  // Sync props when they change (e.g. from parent after pending cycle click)
  useEffect(() => {
    if (initialSearch) setSearchTerm(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      try { setCalendarDate(parseDate(initialDate)); } catch {}
    }
  }, [initialDate]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    setCalendarDate(date);
    setSelectedDate(formatDateStr(date));
  };

  // Filter records
  // Records filtered by date + search (for KPI counts - independent of status filter)
  const baseFilteredRecords = records.filter(r => {
    if (selectedDate && r.data !== selectedDate) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !r.prefixo.toLowerCase().includes(term) &&
        !r.motorista.toLowerCase().includes(term) &&
        !r.empresa.toLowerCase().includes(term) &&
        !r.ordem.toLowerCase().includes(term)
      ) return false;
    }
    return true;
  });

  // Records filtered by date + search + status (for table display)
  const filteredRecords = baseFilteredRecords.filter(r => {
    if (statusFilter === 'sem_status') return !r.status;
    if (statusFilter !== 'todos') return r.status === statusFilter;
    return true;
  });

  const byStatus = {
    'Saiu_Britador': baseFilteredRecords.filter(r => r.status === 'Saiu_Britador'),
    'Pesado': baseFilteredRecords.filter(r => r.status === 'Pesado'),
    'Finalizado': baseFilteredRecords.filter(r => r.status === 'Finalizado'),
  };

  const emTransito = byStatus['Saiu_Britador'].length;
  const pesados = byStatus['Pesado'].length;
  const finalizados = byStatus['Finalizado'].length;
  const semStatus = baseFilteredRecords.filter(r => !r.status).length;
  const totalCiclo = emTransito + pesados + finalizados + semStatus;

  const totalToneladas = filteredRecords.reduce((sum, r) => {
    const ton = parseFloat(r.tonelada?.replace(',', '.') || '0') || 0;
    return sum + ton;
  }, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Saiu_Britador': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">🏗️ Britador</Badge>;
      case 'Pesado': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">⚖️ Pesado</Badge>;
      case 'Finalizado': return <Badge className="bg-green-500 hover:bg-green-600 text-white">✅ Finalizado</Badge>;
      default: return <Badge variant="outline">Sem status</Badge>;
    }
  };

  // ── EDIT ──
  const openEdit = (r: CycleRecord) => {
    setEditRecord(r);
    setEditForm({
      prefixo: r.prefixo, motorista: r.motorista, empresa: r.empresa,
      material: r.material, horaSaidaBritador: r.horaSaidaBritador,
      horaBalanca: r.horaBalanca, horaChegadaObra: r.horaChegadaObra,
      pesoVazio: r.pesoVazio, pesoFinal: r.pesoFinal,
      tonelada: r.tonelada, ordem: r.ordem, status: r.status,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editRecord || !editRecord._row || !editRecord._headers) return;
    setSaving(true);
    try {
      const headers = editRecord._headers;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...editRecord._row];
      while (currentRow.length < headers.length) currentRow.push('');

      const set = (col: string, val: string) => { const idx = fi(col); if (idx !== -1) currentRow[idx] = val; };
      set('Prefixo_Eq', editForm.prefixo);
      set('Motorista', editForm.motorista);
      set('Empresa_Eq', editForm.empresa);
      set('Material', editForm.material);
      set('Hora_Saida_Britador', editForm.horaSaidaBritador);
      set('Hora', editForm.horaBalanca);
      set('Hora_Chegada_Obra', editForm.horaChegadaObra);
      set('Peso_Vazio', editForm.pesoVazio);
      set('Peso_Final', editForm.pesoFinal);
      set('Tonelada', editForm.tonelada);
      set('Ordem_Carregamento', editForm.ordem);
      set('Status', editForm.status);

      const rowNum = editRecord.rowIndex;
      const lastCol = String.fromCharCode(65 + currentRow.length - 1);
      const ok = await writeSheet('Apontamento_Pedreira', `A${rowNum}:${lastCol}${rowNum}`, [currentRow]);
      if (!ok) throw new Error('Erro ao salvar');

      toast({ title: '✅ Registro atualizado com sucesso!' });
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      setEditOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE ──
  const openDelete = (r: CycleRecord) => {
    setDeleteRecord(r);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteRecord) return;
    setDeleting(true);
    try {
      const ok = await deleteRow('Apontamento_Pedreira', deleteRecord.rowIndex);
      if (!ok) throw new Error('Erro ao excluir');
      toast({ title: '🗑️ Registro excluído com sucesso!' });
      // Signal mobile/other tabs to refresh
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      setDeleteOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // ── AVANÇAR ETAPA (quick status progression) ──
  const NEXT_STATUS: Record<string, string> = {
    'Saiu_Britador': 'Pesado',
    'Pesado': 'Finalizado',
  };

  const handleAdvanceStatus = async (r: CycleRecord) => {
    if (!r._row || !r._headers) return;
    const nextStatus = NEXT_STATUS[r.status];
    if (!nextStatus) return;
    
    setAdvancingRow(r.rowIndex);
    try {
      const headers = r._headers;
      const fi = (name: string) => headers.indexOf(name);
      const currentRow = [...r._row];
      while (currentRow.length < headers.length) currentRow.push('');

      const set = (col: string, val: string) => { const idx = fi(col); if (idx !== -1) currentRow[idx] = val; };
      set('Status', nextStatus);

      // Set timestamps
      const now = format(new Date(), 'HH:mm');
      if (nextStatus === 'Pesado') {
        set('Hora', now); // Hora Balança
        set('Hora_Chegada_Balanca', now);
        set('Hora_Saida_Balanca', now);
      } else if (nextStatus === 'Finalizado') {
        set('Hora_Chegada_Obra', now);
      }
      set('Usuario_Obra', effectiveName);

      const rowNum = r.rowIndex;
      const lastCol = String.fromCharCode(65 + currentRow.length - 1);
      const ok = await writeSheet('Apontamento_Pedreira', `A${rowNum}:${lastCol}${rowNum}`, [currentRow]);
      if (!ok) throw new Error('Erro ao avançar etapa');

      const statusLabel = nextStatus === 'Pesado' ? '⚖️ Pesado' : '✅ Finalizado';
      toast({ title: `${statusLabel} — ${r.prefixo} atualizado!` });
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro ao avançar', description: err.message, variant: 'destructive' });
    } finally {
      setAdvancingRow(null);
    }
  };

  // WhatsApp
  const generateWhatsAppMessage = () => {
    let msg = `⛰️ *ACOMPANHAMENTO PEDREIRA - ${selectedDate}*\n\n`;
    msg += `📊 *Resumo do Dia:*\n`;
    msg += `• Total: ${filteredRecords.length} registros\n`;
    if (totalCiclo > 0) msg += `• Ciclo: ${totalCiclo}\n`;
    if (emTransito > 0) msg += `• 🏗️ Em Trânsito: ${emTransito}\n`;
    if (pesados > 0) msg += `• ⚖️ Pesados: ${pesados}\n`;
    if (finalizados > 0) msg += `• ✅ Finalizados: ${finalizados}\n`;
    if (semStatus > 0) msg += `• Sem Status: ${semStatus}\n`;
    if (totalToneladas > 0) msg += `\n📦 *Tonelagem Total:* ${totalToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t\n`;

    if (finalizados > 0) {
      const vehicleMap = new Map<string, { count: number; tons: number }>();
      byStatus['Finalizado'].forEach(r => {
        const key = r.prefixo || 'Sem Prefixo';
        const existing = vehicleMap.get(key) || { count: 0, tons: 0 };
        existing.count++;
        existing.tons += parseFloat(r.tonelada?.replace(',', '.') || '0') || 0;
        vehicleMap.set(key, existing);
      });
      msg += `\n🚛 *Veículos Finalizados:*\n`;
      Array.from(vehicleMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([prefixo, data]) => {
          msg += `• ${prefixo}: ${data.count} viagem(ns) — ${data.tons.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t\n`;
        });
    }

    if (emTransito > 0) {
      msg += `\n🏗️ *Em Trânsito (Britador → Balança):*\n`;
      byStatus['Saiu_Britador'].forEach(r => {
        msg += `• ${r.prefixo} — ${r.motorista} (Saída: ${r.horaSaidaBritador})\n`;
      });
    }

    if (pesados > 0) {
      msg += `\n⚖️ *Pesados (Balança → Obra):*\n`;
      byStatus['Pesado'].forEach(r => {
        msg += `• ${r.prefixo} — ${r.material} — ${r.tonelada} t\n`;
      });
    }

    if (observacao) msg += `\n📝 *Observação:*\n${observacao}\n`;
    msg += `\n---\n_Enviado via ApropriAPP_`;
    return msg;
  };

  const sendWhatsApp = () => {
    const message = encodeURIComponent(generateWhatsAppMessage());
    window.open(`https://wa.me/?text=${message}`, '_blank');
    setShowWhatsApp(false);
    setObservacao('');
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Acompanhamento Pedreira - ${selectedDate}</title><style>@page{size:A4 landscape;margin:10mm}body{margin:0;display:flex;justify-content:center;align-items:flex-start}img{max-width:100%;height:auto}</style></head><body><img src="${imgData}" onload="window.print();window.close();" /></body></html>`);
        printWindow.document.close();
      }
    } catch (error) { console.error('PDF export error:', error); }
  };

  const availableDateObjects = availableDates.map(d => parseDate(d));

  return (
    <div className="space-y-6">
      {/* Filters + Export */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {selectedDate || 'Selecionar data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={handleCalendarSelect}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{ available: availableDateObjects }}
              modifiersStyles={{ available: { fontWeight: 'bold', color: 'hsl(var(--primary))' } }}
            />
          </PopoverContent>
        </Popover>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="Saiu_Britador">🏗️ Em Trânsito</SelectItem>
            <SelectItem value="Pesado">⚖️ Pesado</SelectItem>
            <SelectItem value="Finalizado">✅ Finalizado</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar prefixo, motorista, empresa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setShowWhatsApp(true)} title="Enviar via WhatsApp">
            <MessageCircle className="w-4 h-4 text-green-600" />
          </Button>
          <Button variant="outline" size="icon" onClick={exportPDF} title="Exportar PDF">
            <FileText className="w-4 h-4 text-red-600" />
          </Button>
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Report content wrapper for PDF */}
      <div ref={reportRef}>
        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-6">
          <Card 
            className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'todos' && "ring-2 ring-primary shadow-md")}
            onClick={() => setStatusFilter('todos')}
          >
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium">Total Ciclo</p>
              <p className="text-3xl font-bold">{totalCiclo}</p>
            </CardContent>
          </Card>
          <Card 
            className={cn("border-amber-200 dark:border-amber-800 cursor-pointer transition-all hover:shadow-md", statusFilter === 'Saiu_Britador' && "ring-2 ring-amber-500 shadow-md bg-amber-50 dark:bg-amber-950/30")}
            onClick={() => setStatusFilter(statusFilter === 'Saiu_Britador' ? 'todos' : 'Saiu_Britador')}
          >
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-amber-600 font-medium">🏗️ Em Trânsito</p>
              <p className="text-3xl font-bold text-amber-600">{emTransito}</p>
            </CardContent>
          </Card>
          <Card 
            className={cn("border-blue-200 dark:border-blue-800 cursor-pointer transition-all hover:shadow-md", statusFilter === 'Pesado' && "ring-2 ring-blue-500 shadow-md bg-blue-50 dark:bg-blue-950/30")}
            onClick={() => setStatusFilter(statusFilter === 'Pesado' ? 'todos' : 'Pesado')}
          >
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-blue-600 font-medium">⚖️ Pesado</p>
              <p className="text-3xl font-bold text-blue-600">{pesados}</p>
            </CardContent>
          </Card>
          <Card 
            className={cn("border-green-200 dark:border-green-800 cursor-pointer transition-all hover:shadow-md", statusFilter === 'Finalizado' && "ring-2 ring-green-500 shadow-md bg-green-50 dark:bg-green-950/30")}
            onClick={() => setStatusFilter(statusFilter === 'Finalizado' ? 'todos' : 'Finalizado')}
          >
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-green-600 font-medium">✅ Finalizado</p>
              <p className="text-3xl font-bold text-green-600">{finalizados}</p>
            </CardContent>
          </Card>
          <Card 
            className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'sem_status' && "ring-2 ring-muted-foreground shadow-md")}
            onClick={() => setStatusFilter(statusFilter === 'sem_status' ? 'todos' : 'sem_status')}
          >
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium">Sem Status</p>
              <p className="text-3xl font-bold text-muted-foreground">{semStatus}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Visual */}
        {(emTransito > 0 || pesados > 0) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Caminhões em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {byStatus['Saiu_Britador'].map((r, i) => (
                  <div key={`transit-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold shrink-0">🏗️</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r.prefixo} — {r.motorista}</p>
                      <p className="text-xs text-muted-foreground">{r.empresa} • Saída: {r.horaSaidaBritador}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-amber-600 shrink-0">Balança</span>
                  </div>
                ))}

                {byStatus['Pesado'].map((r, i) => (
                  <div key={`pesado-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">⚖️</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r.prefixo} — {r.motorista}</p>
                      <p className="text-xs text-muted-foreground">{r.material} • {r.tonelada} t • OS: {r.ordem}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-medium text-blue-600 shrink-0">Obra</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Todos os Registros ({selectedDate})</CardTitle>
                <div className="flex items-center gap-2">
                  {totalToneladas > 0 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      {totalToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                    </Badge>
                  )}
                  <Badge variant="secondary">{filteredRecords.length} registros</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>STATUS</TableHead>
                      <TableHead>PREFIXO</TableHead>
                      <TableHead>MOTORISTA</TableHead>
                      <TableHead>EMPRESA</TableHead>
                      <TableHead>FORNECEDOR</TableHead>
                      <TableHead>MATERIAL</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead className="text-center">BRITADOR</TableHead>
                      <TableHead className="text-center">BALANÇA</TableHead>
                      <TableHead className="text-center">OBRA</TableHead>
                      <TableHead className="text-right">TONELADA</TableHead>
                      {isAdmin && <TableHead className="text-right">AÇÕES</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r, idx) => (
                      <TableRow key={idx} className={
                        r.status === 'Saiu_Britador' ? 'bg-amber-50/50 dark:bg-amber-950/10' :
                        r.status === 'Pesado' ? 'bg-blue-50/50 dark:bg-blue-950/10' :
                        r.status === 'Finalizado' ? 'bg-green-50/50 dark:bg-green-950/10' : ''
                      }>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell className="font-medium">{r.prefixo}</TableCell>
                        <TableCell>{r.motorista}</TableCell>
                        <TableCell>{r.empresa}</TableCell>
                        <TableCell>{r.fornecedor}</TableCell>
                        <TableCell>{r.material}</TableCell>
                        <TableCell>{r.ordem}</TableCell>
                        <TableCell className="text-center">
                          {r.horaSaidaBritador ? (
                            <span className="text-xs">{r.horaSaidaBritador}<br/><span className="text-muted-foreground">{r.usuarioBritador}</span></span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.horaBalanca ? <span className="text-xs">{r.horaBalanca}</span> : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.horaChegadaObra ? (
                            <span className="text-xs">{r.horaChegadaObra}<br/><span className="text-muted-foreground">{r.usuarioObra}</span></span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{r.tonelada || '—'}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {NEXT_STATUS[r.status] && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary hover:text-primary"
                                  onClick={() => handleAdvanceStatus(r)}
                                  disabled={advancingRow === r.rowIndex}
                                  title={`Avançar para ${NEXT_STATUS[r.status] === 'Pesado' ? 'Pesado' : 'Finalizado'}`}
                                >
                                  {advancingRow === r.rowIndex ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FastForward className="w-3.5 h-3.5" />}
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} title="Editar">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openDelete(r)} title="Excluir">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {filteredRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 12 : 11} className="text-center text-muted-foreground py-8">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── EDIT MODAL ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Editar Registro — {editRecord?.prefixo}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Prefixo</Label>
              <Input value={editForm.prefixo} onChange={e => setEditForm(f => ({ ...f, prefixo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Motorista</Label>
              <Input value={editForm.motorista} onChange={e => setEditForm(f => ({ ...f, motorista: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Input value={editForm.empresa} onChange={e => setEditForm(f => ({ ...f, empresa: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Material</Label>
              <Input value={editForm.material} onChange={e => setEditForm(f => ({ ...f, material: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>OS / Ordem</Label>
              <Input value={editForm.ordem} onChange={e => setEditForm(f => ({ ...f, ordem: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Saiu_Britador">🏗️ Saiu do Britador</SelectItem>
                  <SelectItem value="Pesado">⚖️ Pesado</SelectItem>
                  <SelectItem value="Finalizado">✅ Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Hora Saída Britador</Label>
              <Input type="time" value={editForm.horaSaidaBritador} onChange={e => setEditForm(f => ({ ...f, horaSaidaBritador: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Hora Balança</Label>
              <Input type="time" value={editForm.horaBalanca} onChange={e => setEditForm(f => ({ ...f, horaBalanca: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Hora Chegada Obra</Label>
              <Input type="time" value={editForm.horaChegadaObra} onChange={e => setEditForm(f => ({ ...f, horaChegadaObra: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Peso Vazio</Label>
              <Input value={editForm.pesoVazio} onChange={e => setEditForm(f => ({ ...f, pesoVazio: e.target.value }))} placeholder="Ex: 15.000,00" />
            </div>
            <div className="space-y-1">
              <Label>Peso Final</Label>
              <Input value={editForm.pesoFinal} onChange={e => setEditForm(f => ({ ...f, pesoFinal: e.target.value }))} placeholder="Ex: 30.000,00" />
            </div>
            <div className="space-y-1">
              <Label>Tonelada</Label>
              <Input value={editForm.tonelada} onChange={e => setEditForm(f => ({ ...f, tonelada: e.target.value }))} placeholder="Ex: 15,00" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir o registro de <strong>{deleteRecord?.prefixo}</strong> ({deleteRecord?.data})?
              Esta ação removerá permanentemente da planilha e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* WhatsApp Modal */}
      <Dialog open={showWhatsApp} onOpenChange={setShowWhatsApp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Resumo via WhatsApp — {selectedDate}
            </DialogTitle>
          </DialogHeader>

          <div className="bg-green-50 rounded-xl p-4 max-h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
              {generateWhatsAppMessage()}
            </pre>
          </div>

          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Adicionar observação (opcional)..."
            className="w-full h-16 p-3 border border-gray-200 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <Button onClick={sendWhatsApp} className="w-full bg-green-500 hover:bg-green-600 text-white py-5 rounded-xl">
            <Send className="w-5 h-5 mr-2" />
            Enviar via WhatsApp
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
