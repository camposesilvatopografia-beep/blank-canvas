import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { buildRowRange } from '@/utils/sheetHelpers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, Factory, ClipboardList, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { playSuccessSound } from '@/utils/notificationSound';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';

interface UsinaSolosRecord {
  rowIndex: number;
  data: string;
  quantidade: string;
}

export default function FormUsinaSolos() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, readSheet, writeSheet, deleteRow, loading } = useGoogleSheets();
  const { isOnline, pendingCount } = useOfflineSync();
  const { toast } = useToast();

  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [quantidadeRaw, setQuantidadeRaw] = useState('');

  const quantidadeDisplay = (() => {
    if (!quantidadeRaw) return '';
    const num = parseInt(quantidadeRaw, 10);
    return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  })();

  const quantidadeReal = quantidadeRaw ? parseInt(quantidadeRaw, 10) / 100 : 0;
  const [showSuccess, setShowSuccess] = useState(false);

  // Records state
  const [showRecords, setShowRecords] = useState(false);
  const [records, setRecords] = useState<UsinaSolosRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Edit state
  const [editingRecord, setEditingRecord] = useState<UsinaSolosRecord | null>(null);
  const [editData, setEditData] = useState('');
  const [editQuantidadeRaw, setEditQuantidadeRaw] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [recordToDelete, setRecordToDelete] = useState<UsinaSolosRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);

  const editQuantidadeDisplay = (() => {
    if (!editQuantidadeRaw) return '';
    const num = parseInt(editQuantidadeRaw, 10);
    return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  })();

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const sheetData = await readSheet('Produção Usina Solos');
      if (!sheetData || sheetData.length <= 1) {
        setRecords([]);
        return;
      }

      const today = format(new Date(), 'dd/MM/yyyy');
      const parsed: UsinaSolosRecord[] = [];

      for (let i = sheetData.length - 1; i >= 1; i--) {
        const row = sheetData[i];
        if (!row[0]) continue;
        // Show only today's records for the apontador
        if (row[0] === today) {
          parsed.push({
            rowIndex: i + 1,
            data: row[0],
            quantidade: row[1] || '0',
          });
        }
      }

      setRecords(parsed);
    } catch {
      toast({ title: 'Erro ao carregar registros', variant: 'destructive' });
    } finally {
      setLoadingRecords(false);
    }
  }, [readSheet, toast]);

  useEffect(() => {
    if (showRecords) loadRecords();
  }, [showRecords, loadRecords]);

  const handleSubmit = async () => {
    if (!quantidadeRaw || quantidadeReal <= 0) {
      toast({ title: 'Preencha a quantidade', variant: 'destructive' });
      return;
    }

    try {
      const dataFormatada = format(new Date(data + 'T12:00:00'), 'dd/MM/yyyy');
      const row = [dataFormatada, quantidadeReal.toFixed(2).replace('.', ',')];

      const supabaseBackup = async () => {
        try {
          const { error } = await supabase.from('movimentacoes_usina_solos').insert({
            data: data,
            hora: format(new Date(), 'HH:mm:ss'),
            usina: 'Usina de Solos',
            material: 'BGTC/BGTC-F',
            quantidade: quantidadeReal,
            umidade: 0,
            local: 'Usina',
            usuario: effectiveName,
          });
          if (error) console.error('Supabase backup error (Usina Solos):', error);
        } catch (e) {
          console.error('Failed to insert in Supabase (Usina Solos):', e);
        }
      };

      if (!isOnline) {
        addPendingRecord('carga', 'Produção Usina Solos', row, { data, quantidadeReal });
        await supabaseBackup();
        playSuccessSound();
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setQuantidadeRaw('');
        }, 2000);
        return;
      }

      const success = await appendSheet('Produção Usina Solos', [row]);
      
      // Backup regardless of sheet success
      await supabaseBackup();

      if (success) {
        playSuccessSound();
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setQuantidadeRaw('');
        }, 2000);
      } else {
        // Sheet failed, save offline
        addPendingRecord('carga', 'Produção Usina Solos', row, { data, quantidadeReal });
        toast({ title: 'Salvo Localmente', description: 'Falha na planilha. Dados salvos no dispositivo e Supabase.' });
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setQuantidadeRaw('');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Usina Solos submission error:', error);
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
  };


  const openEdit = (rec: UsinaSolosRecord) => {
    setEditingRecord(rec);
    // Parse date dd/MM/yyyy -> yyyy-MM-dd
    const [day, month, year] = rec.data.split('/');
    setEditData(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    // Parse quantidade (e.g. "1.440,00" or "50,00") -> raw digits
    const cleanQtd = rec.quantidade.replace(/\./g, '').replace(',', '.');
    const numVal = parseFloat(cleanQtd) || 0;
    setEditQuantidadeRaw(String(Math.round(numVal * 100)));
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editQuantidadeRaw) return;
    setSavingEdit(true);
    try {
      const dataFormatada = format(new Date(editData + 'T12:00:00'), 'dd/MM/yyyy');
      const editQuantidadeReal = parseInt(editQuantidadeRaw, 10) / 100;
      const row = [dataFormatada, editQuantidadeReal.toFixed(2).replace('.', ',')];

      const range = buildRowRange(editingRecord.rowIndex, row.length);
      const success = await writeSheet('Produção Usina Solos', range, [row]);
      if (success) {
        toast({ title: 'Registro atualizado!' });
        setEditingRecord(null);
        loadRecords();
      } else {
        throw new Error('Erro ao atualizar');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    setDeletingRecord(true);
    try {
      const success = await deleteRow('Produção Usina Solos', recordToDelete.rowIndex);
      if (success) {
        toast({ title: 'Registro excluído!' });
        setRecordToDelete(null);
        loadRecords();
      } else {
        throw new Error('Erro ao excluir');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingRecord(false);
    }
  };

  if (showSuccess) {
    return <SuccessScreen title="Produção Usina Solos registrada!" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} />
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(getApontadorHomeRoute())}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Factory className="w-5 h-5" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Produção Usina Solos</h1>
            <p className="text-xs opacity-80">{effectiveName || profile?.nome} • {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => setShowRecords(!showRecords)}
        >
          <ClipboardList className="w-5 h-5" />
        </Button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-5 max-w-lg mx-auto">
        {!showRecords ? (
          <>
            <Card className="p-4 space-y-4">
              <div>
                <Label className="text-sm font-medium">Data</Label>
                <Input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>

              <div>
                <Label className="text-sm font-medium">Quantidade (t)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={quantidadeDisplay}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setQuantidadeRaw(digits);
                  }}
                  className="text-lg font-semibold"
                />
              </div>
            </Card>

            <Button
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700"
              onClick={handleSubmit}
              disabled={loading || !quantidadeRaw}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Registrar Produção
            </Button>
          </>
        ) : (
          /* Records List */
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-600" />
                Registros de Hoje
              </h2>
              <Button variant="ghost" size="sm" onClick={loadRecords} disabled={loadingRecords}>
                <RefreshCw className={`w-4 h-4 ${loadingRecords ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loadingRecords ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro hoje</p>
            ) : (
              <div className="space-y-3">
                {records.map((rec, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-900">{rec.quantidade} t</p>
                      <p className="text-sm text-gray-500">{rec.data}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" onClick={() => openEdit(rec)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => setRecordToDelete(rec)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setShowRecords(false)}
            >
              Voltar ao Formulário
            </Button>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-600" />
              Editar Registro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data</Label>
              <Input type="date" value={editData} onChange={e => setEditData(e.target.value)} />
            </div>
            <div>
              <Label>Quantidade (t)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={editQuantidadeDisplay}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setEditQuantidadeRaw(digits);
                }}
                className="text-lg font-semibold"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingRecord(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                onClick={handleSaveEdit}
                disabled={savingEdit || !editQuantidadeRaw}
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro de <strong>{recordToDelete?.quantidade} t</strong> do dia <strong>{recordToDelete?.data}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deletingRecord} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingRecord ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
