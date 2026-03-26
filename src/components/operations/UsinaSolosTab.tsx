import { useEffect, useState, useCallback } from 'react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { buildRowRange } from '@/utils/sheetHelpers';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw, Factory, Plus, Pencil, Trash2, FileText, Share2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

interface UsinaSolosRecord {
  rowIndex: number;
  data: string;
  quantidade: number;
  quantidadeRaw: string;
}

export function UsinaSolosTab() {
  const { readSheet, appendSheet, writeSheet, deleteRow, loading } = useGoogleSheets();
  const { toast } = useToast();
  const [records, setRecords] = useState<UsinaSolosRecord[]>([]);

  // New/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<UsinaSolosRecord | null>(null);
  const [formData, setFormData] = useState('');
  const [formQtdRaw, setFormQtdRaw] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete
  const [recordToDelete, setRecordToDelete] = useState<UsinaSolosRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formQtdDisplay = (() => {
    if (!formQtdRaw) return '';
    const num = parseInt(formQtdRaw, 10);
    return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  })();

  const formQtdReal = formQtdRaw ? parseInt(formQtdRaw, 10) / 100 : 0;

  const loadData = useCallback(async () => {
    const data = await readSheet('Produção Usina Solos');
    if (data.length > 1) {
      const rows = data.slice(1).filter(r => r[0]).map((r, i) => ({
        rowIndex: i + 2, // 1-based, skip header
        data: String(r[0] || ''),
        quantidade: parseFloat(String(r[1] || '0').replace(/\./g, '').replace(',', '.')) || 0,
        quantidadeRaw: String(r[1] || '0'),
      }));
      rows.sort((a, b) => {
        const da = a.data.split('/').reverse().join('-');
        const db = b.data.split('/').reverse().join('-');
        return db.localeCompare(da);
      });
      setRecords(rows);
    }
  }, [readSheet]);

  useEffect(() => { loadData(); }, []);

  const openNewModal = () => {
    setEditingRecord(null);
    setFormData(format(new Date(), 'yyyy-MM-dd'));
    setFormQtdRaw('');
    setShowModal(true);
  };

  const openEditModal = (rec: UsinaSolosRecord) => {
    setEditingRecord(rec);
    const [day, month, year] = rec.data.split('/');
    setFormData(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    const cleanQtd = rec.quantidadeRaw.replace(/\./g, '').replace(',', '.');
    const numVal = parseFloat(cleanQtd) || 0;
    setFormQtdRaw(String(Math.round(numVal * 100)));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formQtdRaw || formQtdReal <= 0) {
      toast({ title: 'Preencha a quantidade', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const dataFormatada = format(new Date(formData + 'T12:00:00'), 'dd/MM/yyyy');
      const row = [dataFormatada, formQtdReal.toFixed(2).replace('.', ',')];

      let success: boolean;
      if (editingRecord) {
        const range = buildRowRange(editingRecord.rowIndex, row.length);
        success = await writeSheet('Produção Usina Solos', range, [row]);
      } else {
        success = await appendSheet('Produção Usina Solos', [row]);
      }

      if (success) {
        toast({ title: editingRecord ? 'Registro atualizado!' : 'Produção registrada!' });
        setShowModal(false);
        setFormQtdRaw('');
        setEditingRecord(null);
        loadData();
      } else {
        throw new Error('Erro ao salvar');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    setDeleting(true);
    try {
      const success = await deleteRow('Produção Usina Solos', recordToDelete.rowIndex);
      if (success) {
        toast({ title: 'Registro excluído!' });
        setRecordToDelete(null);
        loadData();
      } else {
        throw new Error('Erro ao excluir');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const totalQtd = records.reduce((s, r) => s + r.quantidade, 0);
  const mediaQtd = records.length > 0 ? totalQtd / records.length : 0;


  const exportPdf = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pw = 297, ph = 210;
    const mx = 12, my = 12;

    // Header bar
    doc.setFillColor(29, 53, 87);
    doc.rect(0, 0, pw, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('RELATÓRIO DE PRODUÇÃO — USINA DE SOLOS', pw / 2, 14, { align: 'center' });

    // Subtitle
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pw - mx, 30, { align: 'right' });

    // KPI Cards
    const cardW = 85, cardH = 22, cardY = 35;
    const kpis = [
      { label: 'Total Registros', value: String(records.length) },
      { label: 'Total Produzido', value: `${totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` },
      { label: 'Média Diária', value: `${mediaQtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` },
    ];
    kpis.forEach((k, i) => {
      const cx = mx + i * (cardW + 8);
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(cx, cardY, cardW, cardH, 3, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(k.label, cx + 6, cardY + 8);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(29, 53, 87);
      doc.text(k.value, cx + 6, cardY + 18);
    });

    // Table
    let ty = cardY + cardH + 12;
    doc.setFillColor(29, 53, 87);
    doc.rect(mx, ty, pw - mx * 2, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Data', mx + 4, ty + 6);
    doc.text('Quantidade (t)', pw - mx - 4, ty + 6, { align: 'right' });
    ty += 8;

    doc.setFont('helvetica', 'normal');
    records.forEach((r, i) => {
      if (ty > ph - 15) { doc.addPage('landscape'); ty = 15; }
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 252);
        doc.rect(mx, ty, pw - mx * 2, 7, 'F');
      }
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(9);
      doc.text(r.data, mx + 4, ty + 5);
      doc.text(r.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 }), pw - mx - 4, ty + 5, { align: 'right' });
      ty += 7;
    });

    // Total row
    doc.setFillColor(29, 53, 87);
    doc.rect(mx, ty, pw - mx * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', mx + 4, ty + 6);
    doc.text(`${totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`, pw - mx - 4, ty + 6, { align: 'right' });

    doc.save('producao-usina-solos.pdf');
    toast({ title: 'PDF exportado com sucesso!' });
  };

  const shareWhatsApp = () => {
    let msg = `📊 *PRODUÇÃO USINA DE SOLOS*\n`;
    msg += `📅 ${format(new Date(), 'dd/MM/yyyy')}\n\n`;
    msg += `📋 *Resumo:*\n`;
    msg += `• Total de Registros: ${records.length}\n`;
    msg += `• Total Produzido: ${totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t\n`;
    msg += `• Média Diária: ${mediaQtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t\n\n`;
    msg += `📈 *Últimos lançamentos:*\n`;
    records.slice(0, 5).forEach(r => {
      msg += `  ${r.data} → ${r.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t\n`;
    });
    if (records.length > 5) msg += `  ... e mais ${records.length - 5} registros\n`;
    msg += `\n_Gerado por ApropriAPP_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const chartData = [...records].reverse().slice(-15).map(r => ({
    data: r.data.substring(0, 5),
    quantidade: r.quantidade,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-lg">Produção Usina Solos</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={records.length === 0}>
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={shareWhatsApp} disabled={records.length === 0}>
            <Share2 className="w-4 h-4 mr-1" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-1" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      {loading && records.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Registros</p>
                <p className="text-2xl font-bold">{records.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Produzido</p>
                <p className="text-2xl font-bold">{totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Média Diária</p>
                <p className="text-2xl font-bold">{mediaQtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t</p>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-base font-bold text-foreground mb-4">Produção Diária (últimos 15 dias)</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                    <XAxis dataKey="data" tick={{ fontSize: 13, fontWeight: 700, fill: '#000' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 13, fontWeight: 700, fill: '#000' }} tickLine={false} />
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString('pt-BR')} t`, 'Quantidade']} />
                    <Bar dataKey="quantidade" fill="#d97706" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="quantidade" position="top" fontSize={13} fontWeight={700} fill="#000" formatter={(v: number) => v.toLocaleString('pt-BR')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Quantidade (t)</TableHead>
                      <TableHead className="text-right w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.rowIndex}>
                        <TableCell className="font-medium">{r.data}</TableCell>
                        <TableCell className="text-right font-semibold">{r.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => openEditModal(r)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setRecordToDelete(r)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {records.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal Novo/Editar Lançamento */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRecord ? <Pencil className="w-5 h-5 text-amber-600" /> : <Factory className="w-5 h-5" />}
              {editingRecord ? 'Editar Lançamento' : 'Novo Lançamento'} - Usina Solos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={formData} onChange={e => setFormData(e.target.value)} />
            </div>
            <div>
              <Label>Quantidade (t)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={formQtdDisplay}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setFormQtdRaw(digits);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !formQtdRaw}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingRecord ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro de <strong>{recordToDelete?.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t</strong> do dia <strong>{recordToDelete?.data}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
