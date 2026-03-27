import { useState, useEffect, useCallback } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { parseNumeric } from '@/utils/masks';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Droplets, Loader2, CheckCircle2, Truck as TruckIcon, RefreshCw, MapPin, ClipboardList, Pencil, Trash2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { useFormFieldPermissions } from '@/components/mobile/FieldPermissionWrapper';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';

interface PipaData {
  id: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  capacidade: string;
  placa: string;
  tipoLocal: string;
}

interface PipaRecord {
  rowIndex: number;
  id: string;
  data: string;
  prefixo: string;
  motorista: string;
  empresa: string;
  capacidade: string;
  viagens: string;
  localTrabalho: string;
}

export default function FormPipas() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, loading: sheetLoading, readSheet, writeSheet, deleteRow } = useGoogleSheets();
  const { isOnline, addPendingRecord, pendingCount, syncAllPending, isSyncing } = useOfflineSync();
  const { toast } = useToast();
  const { isFieldVisible, isFieldDisabled, loading: permissionsLoading, hasFullAccess } = useFormFieldPermissions('pipas');

  const [loading, setLoading] = useState(false);
  const [veiculos, setVeiculos] = useState<PipaData[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);

  // Records view state
  const [showRecords, setShowRecords] = useState(false);
  const [records, setRecords] = useState<PipaRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PipaRecord | null>(null);
  const [editForm, setEditForm] = useState({ viagens: '', localTrabalho: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<PipaRecord | null>(null);

  // Modal for adding new local
  const [showAddLocalModal, setShowAddLocalModal] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');
  const [addingLocal, setAddingLocal] = useState(false);

  // Selected vehicle data for auto-fill
  const [selectedPipa, setSelectedPipa] = useState<PipaData | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    veiculo: '',
    localTrabalho: '',
    viagens: '1',
  });

  // Load options
  useEffect(() => {
    const loadOptions = async () => {
      // Load veículos (pipas) from Google Sheets with full data
      const pipaData = await readSheet('Caminhao_Pipa');
      if (pipaData && pipaData.length > 1) {
        const headers = pipaData[0];
        const getIdx = (name: string) => headers.indexOf(name);
        
        const pipasData = pipaData.slice(1)
          .filter(row => row[getIdx('Prefixo')])
          .map(row => ({
            id: row[getIdx('ID_Pipa')] || '',
            prefixo: row[getIdx('Prefixo')] || '',
            descricao: row[getIdx('Descricao')] || '',
            empresa: row[getIdx('Empresa')] || '',
            motorista: row[getIdx('Motorista')] || '',
            capacidade: row[getIdx('Capacidade')] || '',
            placa: row[getIdx('Placa')] || '',
            tipoLocal: row[getIdx('Tipo_Local')] || '',
          }));
        setVeiculos(pipasData);
      }
      
    };

    loadOptions();
  }, [readSheet]);

  // Handle pipa selection - auto-fill related fields
  const handlePipaChange = (prefixo: string) => {
    const found = veiculos.find(p => p.prefixo === prefixo);
    setSelectedPipa(found || null);
    
    // Auto-fill localTrabalho from fleet's Tipo_Local config
    setFormData(prev => ({ 
      ...prev, 
      veiculo: prefixo,
      localTrabalho: found?.tipoLocal || prev.localTrabalho,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedOffline(false);

    try {
      const now = new Date();
      const hora = format(now, 'HH:mm:ss');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';
      const viagens = isSalaTecnica ? formData.viagens : '1';

      // Apontamento_Pipa sheet: A:ID_Pipa, B:Data, C:Prefixo, D:Descricao, E:Empresa, F:Motorista, G:Capacidade, H:N_Viagens, I:Local de Trabalho
      const generateId = () => Math.random().toString(36).substring(2, 10);
      const pipaRow = [
        generateId(),                            // A: ID_Pipa (auto-generated)
        dataFormatada,                           // B: Data
        formData.veiculo,                        // C: Prefixo (user selected)
        selectedPipa?.descricao || '',           // D: Descricao (auto-filled from fleet)
        selectedPipa?.empresa || '',             // E: Empresa (auto-filled from Caminhao_Pipa)
        selectedPipa?.motorista || '',           // F: Motorista (auto-filled from Caminhao_Pipa)
        selectedPipa?.capacidade || '',          // G: Capacidade (auto-filled from Caminhao_Pipa)
        viagens,                                 // H: N_Viagens
        formData.localTrabalho || '',            // I: Local de Trabalho (Produção/Recicladora)
      ];

      const supabaseBackup = async () => {
        try {
          const capacity = parseNumeric(selectedPipa?.capacidade || '0');
          const { error } = await supabase.from('movimentacoes_pipas').insert({
            data: formData.data,
            hora,
            prefixo_pipa: formData.veiculo,
            motorista: selectedPipa?.motorista,
            empresa: selectedPipa?.empresa,
            local: formData.localTrabalho,
            atividade: 'Rega/Umectação',
            volume: capacity,
            viagens: parseInt(viagens),
            volume_total: capacity * parseInt(viagens),
            usuario: effectiveName,
          });
          if (error) console.error('Supabase backup error (Pipas):', error);
        } catch (e) {
          console.error('Failed to insert in Supabase (Pipas):', e);
        }
      };

      // Check if offline
      if (!isOnline) {
        addPendingRecord('pipas', 'Apontamento_Pipa', pipaRow, { ...formData });
        await supabaseBackup();
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        toast({
          title: 'Salvo Localmente',
          description: 'Será sincronizado quando a conexão voltar.',
        });
        setLoading(false);
        return;
      }

      const success = await appendSheet('Apontamento_Pipa', [pipaRow]);

      // Backup to Supabase
      await supabaseBackup();

      if (!success) {
        addPendingRecord('pipas', 'Apontamento_Pipa', pipaRow, { ...formData });
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        toast({
          title: 'Salvo Localmente',
          description: 'Falha na planilha. Registro salvo no dispositivo e Supabase.',
        });
        setLoading(false);
        return;
      }

      setSubmitted(true);
      playSuccessSound();
      toast({
        title: 'Sucesso!',
        description: 'Apontamento de pipa registrado na planilha e Supabase.',
      });

    } catch (error: any) {
      console.error('Pipas submission error:', error);
      // If error, save offline
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';
      const viagens = isSalaTecnica ? formData.viagens : '1';
      const generateIdFallback = () => Math.random().toString(36).substring(2, 10);

      const pipaRow = [
        generateIdFallback(),
        dataFormatada,
        formData.veiculo,
        selectedPipa?.descricao || '',
        selectedPipa?.empresa || '',
        selectedPipa?.motorista || '',
        selectedPipa?.capacidade || '',
        viagens,
        formData.localTrabalho || '',
      ];

      addPendingRecord('pipas', 'Apontamento_Pipa', pipaRow, { ...formData });
      setSavedOffline(true);
      setSubmitted(true);
      playOfflineSound();
      toast({
        title: 'Salvo Localmente',
        description: 'Erro inesperado. Registro salvo offline.',
      });
    } finally {
      setLoading(false);
    }
  };


  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSelectedPipa(null);
    setFormData({
      ...formData,
      veiculo: '',
      localTrabalho: '',
      viagens: '1',
    });
  };

  // ===================== LOAD RECORDS =====================
  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const data = await readSheet('Apontamento_Pipa');
      if (!data || data.length < 2) { setRecords([]); return; }
      const headers = data[0];
      const fi = (name: string) => {
        let idx = headers.indexOf(name);
        if (idx !== -1) return idx;
        return headers.findIndex((h: string) => h?.toLowerCase() === name.toLowerCase());
      };
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      const parsed: PipaRecord[] = [];
      data.slice(1).forEach((row, idx) => {
        const rawDate = row[fi('Data')] || '';
        const rowDate = rawDate.split('/').map(p => p.padStart(2, '0')).join('/');
        if (rowDate === todayStr) {
          parsed.push({
            rowIndex: idx + 2,
            id: row[fi('ID_Pipa')] || row[0] || '',
            data: rowDate,
            prefixo: row[fi('Prefixo')] || '',
            motorista: row[fi('Motorista')] || '',
            empresa: row[fi('Empresa')] || '',
            capacidade: row[fi('Capacidade')] || '',
            viagens: row[fi('N_Viagens')] || '1',
            localTrabalho: row[fi('Local de Trabalho')] || row[fi('Local_Trabalho')] || '',
          });
        }
      });
      setRecords(parsed);
    } catch (error) {
      console.error('Error loading pipa records:', error);
    } finally {
      setLoadingRecords(false);
    }
  }, [readSheet]);

  const handleStartEdit = (record: PipaRecord) => {
    setEditingRecord(record);
    setEditForm({ viagens: record.viagens, localTrabalho: record.localTrabalho });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      const data = await readSheet('Apontamento_Pipa');
      if (!data || data.length < editingRecord.rowIndex) throw new Error('Registro não encontrado');
      const currentRow = [...data[editingRecord.rowIndex - 1]];
      const headers = data[0];
      const fi = (name: string) => {
        let idx = headers.indexOf(name);
        if (idx !== -1) return idx;
        return headers.findIndex((h: string) => h?.toLowerCase() === name.toLowerCase());
      };
      if (fi('N_Viagens') !== -1) currentRow[fi('N_Viagens')] = editForm.viagens;
      const localIdx = fi('Local de Trabalho') !== -1 ? fi('Local de Trabalho') : fi('Local_Trabalho');
      if (localIdx !== -1) currentRow[localIdx] = editForm.localTrabalho;

      const rowNum = editingRecord.rowIndex;
      const success = await writeSheet('Apontamento_Pipa', buildRowRange(rowNum, currentRow.length), [currentRow]);
      if (success) {
        toast({ title: '✅ Registro atualizado!' });
        setEditingRecord(null);
        loadRecords();
      } else {
        throw new Error('Falha ao atualizar');
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteRecord = (record: PipaRecord) => setRecordToDelete(record);
  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    setDeletingId(recordToDelete.id);
    setRecordToDelete(null);
    try {
      const success = await deleteRow('Apontamento_Pipa', recordToDelete.rowIndex);
      if (success) {
        toast({ title: '🗑️ Registro excluído!' });
        loadRecords();
      } else {
        throw new Error('Falha ao excluir');
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const generateWhatsAppRecords = () => {
    const today = format(new Date(), 'dd/MM/yyyy');
    const userName = effectiveName || 'Usuário';
    const totalViagens = records.reduce((sum, r) => sum + (parseInt(r.viagens) || 1), 0);
    let msg = `💧 *REGISTROS PIPAS - ${today}*\n\n👷 Apontador: ${userName}\n📊 Total: ${records.length} registro(s)\n🚰 Viagens: ${totalViagens}\n`;
    records.forEach(r => { msg += `\n• ${r.prefixo} — ${r.viagens} viagem(ns) • ${r.localTrabalho}`; });
    msg += `\n\n---\n_Enviado via ApropriAPP_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const isSalaTecnica = isAdmin || profile?.tipo === 'Sala Técnica';

  if (submitted) {
    const successDetails = [
      { label: 'Veículo', value: `${formData.veiculo}${selectedPipa?.motorista ? ` - ${selectedPipa.motorista}` : ''}` },
      { label: 'Local', value: formData.localTrabalho || '-' },
      { label: 'Capacidade', value: selectedPipa?.capacidade ? `${selectedPipa.capacidade} L` : '-' },
      { label: 'Viagens', value: isSalaTecnica ? formData.viagens : '1' },
    ];

    return (
      <SuccessScreen
        title={savedOffline ? "Salvo Localmente!" : "Apontamento Registrado!"}
        subtitle={savedOffline ? "Será sincronizado quando a conexão voltar." : "A viagem da pipa foi registrada."}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor={savedOffline ? "amber" : "cyan"}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-cyan-500 p-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/mobile')}
              className="text-white hover:text-white hover:bg-white/20 w-14 h-14"
            >
              <ArrowLeft className="w-8 h-8" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg">
                <Droplets className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-2xl text-white">Apontar Viagens</h1>
                <p className="text-base text-white/80">Pipas</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowRecords(true); loadRecords(); }}
              className="text-white hover:text-white hover:bg-white/20 w-12 h-12"
              title="Ver meus registros"
            >
              <ClipboardList className="w-6 h-6" />
            </Button>
            <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />
          </div>
        </div>
      </div>

      {/* Pending Records Banner */}
      {pendingCount > 0 && isOnline && (
        <div className="mx-5 mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between">
          <span className="text-lg font-semibold text-amber-800">
            {pendingCount} registro(s) pendente(s)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={syncAllPending}
            disabled={isSyncing}
            className="text-amber-700 hover:bg-amber-100 h-12 px-4 text-base font-semibold"
          >
            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
            Sincronizar
          </Button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Data */}
        {isFieldVisible('data') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block">Data</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={formData.data}
                onChange={e => setFormData({ ...formData, data: e.target.value })}
                disabled={isFieldDisabled('data')}
                className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ ...formData, data: format(new Date(), 'yyyy-MM-dd') })}
                className="h-16 px-4 text-sm font-semibold border-2 border-[#1d3557]/20 text-[#1d3557] rounded-xl whitespace-nowrap"
              >
                Hoje
              </Button>
            </div>
          </Card>
        )}

        {/* Veículo */}
        {isFieldVisible('veiculo') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block flex items-center gap-3">
              <TruckIcon className="w-7 h-7 text-cyan-600" />
              Veículo
            </Label>
            <Select 
              value={formData.veiculo} 
              onValueChange={handlePipaChange}
              disabled={isFieldDisabled('veiculo')}
            >
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o veículo" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                {veiculos.map(v => (
                  <SelectItem key={v.prefixo} value={v.prefixo} className="text-lg py-3">
                    {v.prefixo} - {v.motorista || v.empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPipa && (
              <div className="mt-4 p-4 bg-cyan-50 border-2 border-cyan-200 rounded-xl space-y-2">
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Motorista:</span> <span className="font-semibold">{selectedPipa.motorista || '-'}</span></p>
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Capacidade:</span> <span className="font-semibold">{selectedPipa.capacidade || '-'} L</span></p>
                <p className="text-lg text-gray-800"><span className="text-gray-500 font-medium">Empresa:</span> <span className="font-semibold">{selectedPipa.empresa || '-'}</span></p>
              </div>
            )}
          </Card>
        )}

        {/* Local de Trabalho */}
        {isFieldVisible('local_trabalho') && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-gray-800 text-xl font-bold flex items-center gap-3">
                <MapPin className="w-7 h-7 text-cyan-600" />
                Local de Trabalho
              </Label>
            </div>
            <Select 
              value={formData.localTrabalho} 
              onValueChange={(value) => setFormData({ ...formData, localTrabalho: value })}
              disabled={isFieldDisabled('local_trabalho')}
            >
              <SelectTrigger className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium">
                <SelectValue placeholder="Selecione o local" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-200">
                <SelectItem value="Produção" className="text-lg py-3">Produção</SelectItem>
                <SelectItem value="Recicladora" className="text-lg py-3">Recicladora</SelectItem>
              </SelectContent>
            </Select>
            {formData.localTrabalho && selectedPipa?.tipoLocal && formData.localTrabalho !== selectedPipa.tipoLocal && (
              <p className="text-base text-amber-600 mt-3">
                ⚠ Local alterado manualmente (padrão da frota: {selectedPipa.tipoLocal})
              </p>
            )}
          </Card>
        )}

        {/* Nº de Viagens - Only for Sala Técnica OR if visible */}
        {(isSalaTecnica || isFieldVisible('viagens')) && (
          <Card className="bg-gray-50 border-2 border-gray-200 p-6 rounded-2xl shadow-sm">
            <Label className="text-gray-800 text-xl font-bold mb-4 block">Nº de Viagens</Label>
            <Input
              type="number"
              min="1"
              value={formData.viagens}
              onChange={e => setFormData({ ...formData, viagens: e.target.value })}
              disabled={!isSalaTecnica && isFieldDisabled('viagens')}
              className="bg-white border-2 border-gray-300 text-gray-900 h-16 text-xl rounded-xl font-medium"
            />
            {!isSalaTecnica && (
              <p className="text-base text-gray-500 mt-3">* Campo controlado por permissões</p>
            )}
          </Card>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={loading || sheetLoading || !formData.veiculo}
          className="w-full h-20 text-2xl font-bold bg-cyan-500 hover:bg-cyan-600 shadow-xl mt-4 rounded-2xl"
        >
          {loading || sheetLoading ? (
            <>
              <Loader2 className="w-8 h-8 mr-3 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-8 h-8 mr-3" />
              Registrar Apontamento
            </>
          )}
        </Button>
      </form>

      {/* =================== MODAL: Meus Registros =================== */}
      <Dialog open={showRecords} onOpenChange={setShowRecords}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-cyan-600" />
              Meus Registros de Hoje
              {records.length > 0 && <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100 ml-auto">{records.length}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {loadingRecords ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado hoje.</p>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => (
                <Card key={rec.id} className="p-4 border-2 border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-base">{rec.prefixo} — {rec.motorista}</p>
                      <p className="text-sm text-muted-foreground">{rec.empresa} • {rec.capacidade} L</p>
                      <p className="text-sm text-muted-foreground">Viagens: {rec.viagens} • Local: {rec.localTrabalho}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" onClick={() => handleStartEdit(rec)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => confirmDeleteRecord(rec)} disabled={deletingId === rec.id}>
                        {deletingId === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={loadRecords} disabled={loadingRecords}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingRecords ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {records.length > 0 && (
              <Button variant="outline" className="flex-1 text-cyan-700 border-cyan-200 hover:bg-cyan-50" onClick={generateWhatsAppRecords}>
                <Send className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteRecord}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* =================== MODAL: Editar Registro =================== */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Editar Registro
            </DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl text-sm">
                <p><span className="text-muted-foreground">Veículo:</span> {editingRecord.prefixo}</p>
                <p><span className="text-muted-foreground">Data:</span> {editingRecord.data}</p>
                <p><span className="text-muted-foreground">Motorista:</span> {editingRecord.motorista}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Nº de Viagens</Label>
                <Input
                  type="number"
                  min="1"
                  value={editForm.viagens}
                  onChange={e => setEditForm({ ...editForm, viagens: e.target.value })}
                  className="h-14 text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Local de Trabalho</Label>
                <Select value={editForm.localTrabalho} onValueChange={v => setEditForm({ ...editForm, localTrabalho: v })}>
                  <SelectTrigger className="h-14 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Produção">Produção</SelectItem>
                    <SelectItem value="Recicladora">Recicladora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingRecord(null)}>Cancelar</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSaveEdit} disabled={savingEdit || !editForm.viagens}>
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
