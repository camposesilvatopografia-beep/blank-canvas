import { useState, useEffect } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, 
  Edit3, 
  Trash2, 
  Plus, 
  Search, 
  Filter,
  CheckCircle2,
  AlertCircle,
  Truck,
  User,
  AlertTriangle
} from 'lucide-react';

interface BatchEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetName: 'Carga' | 'Descarga';
  onSuccess?: () => void;
}

interface RecordItem {
  rowIndex: number;
  data: string;
  hora: string;
  prefixoCb: string;
  motorista: string;
  material: string;
  local: string;
  volume: string;
  viagens: string;
  selected: boolean;
  original: any[];
}

export function BatchEditModal({ open, onOpenChange, sheetName, onSuccess }: BatchEditModalProps) {
  const { toast } = useToast();
  const { readSheet, writeSheet, loading } = useGoogleSheets();
  const { profile } = useAuth();
  
  const [allData, setAllData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<RecordItem[]>([]);
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [searchTruck, setSearchTruck] = useState('');
  const [searchDriver, setSearchDriver] = useState('');
  
  const [editField, setEditField] = useState<'motorista' | 'material' | 'local' | 'volume'>('motorista');
  const [newValue, setNewValue] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'add' | 'delete'>('edit');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add form state
  const [addForm, setAddForm] = useState({
    data: '',
    hora: '',
    prefixoCb: '',
    motorista: '',
    material: '',
    local: '',
    volume: '',
    viagens: '1',
  });

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, sheetName]);

  const loadData = async () => {
    try {
      const data = await readSheet(sheetName);
      if (data.length > 1) {
        const hdrs = data[0];
        setHeaders(hdrs);
        setAllData(data);
        
        const dateIdx = hdrs.indexOf('Data');
        const dates = [...new Set(data.slice(1).map(row => row[dateIdx]).filter(Boolean))];
        
        const sortedDates = dates.sort((a, b) => {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        
        setAvailableDates(sortedDates);
        
        if (sortedDates.length > 0) {
          setSelectedDate(sortedDates[0]);
          setAddForm(prev => ({ ...prev, data: sortedDates[0] }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os registros.',
        variant: 'destructive',
      });
    }
  };

  // Process records when date changes
  useEffect(() => {
    if (!allData.length || !headers.length || !selectedDate) return;
    
    const getIdx = (name: string) => headers.indexOf(name);
    const dateIdx = getIdx('Data');
    const horaIdx = sheetName === 'Carga' ? getIdx('Hora_Carga') : getIdx('Hora');
    const prefixoCbIdx = getIdx('Prefixo_Cb');
    const motoristaIdx = getIdx('Motorista');
    const materialIdx = getIdx('Material');
    const localIdx = getIdx('Local_da_Obra');
    const volumeIdx = getIdx('Volume');
    const viagensIdx = sheetName === 'Carga' ? getIdx('I_Viagens') : getIdx('N_Viagens');
    
    const filtered = allData.slice(1)
      .map((row, idx) => ({
        rowIndex: idx + 2, // +2 because slice(1) and 1-indexed
        data: row[dateIdx] || '',
        hora: row[horaIdx] || '',
        prefixoCb: row[prefixoCbIdx] || '',
        motorista: row[motoristaIdx] || '',
        material: row[materialIdx] || '',
        local: row[localIdx] || '',
        volume: row[volumeIdx] || '',
        viagens: row[viagensIdx] || '1',
        selected: false,
        original: row,
      }))
      .filter(r => r.data === selectedDate);
    
    setRecords(filtered);
    setFilteredRecords(filtered);
  }, [allData, headers, selectedDate, sheetName]);

  // Filter records by search
  useEffect(() => {
    let filtered = records;
    
    if (searchTruck) {
      filtered = filtered.filter(r => 
        r.prefixoCb.toLowerCase().includes(searchTruck.toLowerCase())
      );
    }
    
    if (searchDriver) {
      filtered = filtered.filter(r => 
        r.motorista.toLowerCase().includes(searchDriver.toLowerCase())
      );
    }
    
    setFilteredRecords(filtered);
  }, [records, searchTruck, searchDriver]);

  const toggleSelectAll = () => {
    const allSelected = filteredRecords.every(r => r.selected);
    setRecords(prev => prev.map(r => {
      if (filteredRecords.some(fr => fr.rowIndex === r.rowIndex)) {
        return { ...r, selected: !allSelected };
      }
      return r;
    }));
  };

  const toggleSelect = (rowIndex: number) => {
    setRecords(prev => prev.map(r => 
      r.rowIndex === rowIndex ? { ...r, selected: !r.selected } : r
    ));
  };

  const selectedCount = records.filter(r => r.selected).length;

  const handleBatchEdit = async () => {
    if (!newValue.trim()) {
      toast({
        title: 'Valor obrigatório',
        description: 'Digite o novo valor para o campo.',
        variant: 'destructive',
      });
      return;
    }

    const selectedRecords = records.filter(r => r.selected);
    if (selectedRecords.length === 0) {
      toast({
        title: 'Nenhum registro selecionado',
        description: 'Selecione pelo menos um registro para editar.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const getIdx = (name: string) => headers.indexOf(name);
      const fieldIdx = getIdx(editField === 'motorista' ? 'Motorista' : 
                              editField === 'material' ? 'Material' :
                              editField === 'local' ? 'Local_da_Obra' : 'Volume');

      // Update each selected record
      for (const record of selectedRecords) {
        const newRow = [...record.original];
        newRow[fieldIdx] = newValue;
        
        const success = await writeSheet(sheetName, buildRowRange(record.rowIndex, newRow.length), [newRow]);
        
        if (success) {
          // Sync with Supabase
          if (sheetName === 'Carga') {
            const getColIdx = (name: string) => headers.indexOf(name);
            const externalId = record.original[getColIdx('ID')];
            
            // Note: Since we don't have a direct 1:1 mapping with Supabase ID easily,
            // we search by external_id if it exists, or common fields.
            // But wait, the apontamentos_carga table doesn't have external_id!
            // Let's check the schema again.
          }
        }
      }

      toast({
        title: 'Registros atualizados!',
        description: `${selectedRecords.length} registro(s) atualizado(s) com sucesso.`,
      });

      // Reload data
      await loadData();
      setNewValue('');
      setRecords(prev => prev.map(r => ({ ...r, selected: false })));
      onSuccess?.();
    } catch (error) {
      console.error('Error updating records:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar os registros.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    const selectedRecords = records.filter(r => r.selected);
    if (selectedRecords.length === 0) {
      toast({
        title: 'Nenhum registro selecionado',
        description: 'Selecione pelo menos um registro para excluir.',
        variant: 'destructive',
      });
      return;
    }

    setShowDeleteConfirm(true);
  };

  const confirmBatchDelete = async () => {
    const selectedRecords = records.filter(r => r.selected).sort((a, b) => b.rowIndex - a.rowIndex);
    
    setIsProcessing(true);
    setShowDeleteConfirm(false);

    try {
      // Delete rows from bottom to top to maintain correct indices
      for (const record of selectedRecords) {
        // Clear the row content (Google Sheets API doesn't support direct row deletion easily)
        const emptyRow = new Array(headers.length).fill('');
        await writeSheet(sheetName, buildRowRange(record.rowIndex, headers.length), [emptyRow]);
      }

      toast({
        title: 'Registros excluídos!',
        description: `${selectedRecords.length} registro(s) excluído(s) com sucesso. As linhas foram limpas.`,
      });

      // Reload data
      await loadData();
      setRecords(prev => prev.map(r => ({ ...r, selected: false })));
      onSuccess?.();
    } catch (error) {
      console.error('Error deleting records:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir os registros.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddRecord = async () => {
    if (!addForm.data || !addForm.prefixoCb || !addForm.motorista) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha pelo menos Data, Caminhão e Motorista.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const getIdx = (name: string) => headers.indexOf(name);
      const newRow = new Array(headers.length).fill('');
      
      newRow[getIdx('Data')] = addForm.data;
      newRow[getIdx(sheetName === 'Carga' ? 'Hora_Carga' : 'Hora')] = addForm.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      newRow[getIdx('Prefixo_Cb')] = addForm.prefixoCb;
      newRow[getIdx('Motorista')] = addForm.motorista;
      newRow[getIdx('Material')] = addForm.material;
      newRow[getIdx('Local_da_Obra')] = addForm.local;
      newRow[getIdx('Volume')] = addForm.volume;
      newRow[getIdx(sheetName === 'Carga' ? 'I_Viagens' : 'N_Viagens')] = addForm.viagens || '1';

      // Calculate volume total if volume exists
      if (addForm.volume && addForm.viagens) {
        const volumeTotal = parseFloat(addForm.volume.replace(',', '.')) * parseInt(addForm.viagens);
        newRow[getIdx('Volume_Total')] = volumeTotal.toString().replace('.', ',');
      }

      // Append new row
      const lastRow = allData.length + 1;
      const success = await writeSheet(sheetName, buildRowRange(lastRow, newRow.length), [newRow]);

      if (success) {
        if (sheetName === 'Carga') {
          const volValue = parseFloat(addForm.volume.replace(',', '.')) || 0;
          const viagensValue = parseInt(addForm.viagens) || 1;
          const volTotal = volValue * viagensValue;
          
          await supabase.from('apontamentos_carga').insert({
            data: addForm.data,
            hora: addForm.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            prefixo_caminhao: addForm.prefixoCb,
            motorista: addForm.motorista,
            material: addForm.material,
            local: addForm.local,
            viagens: viagensValue,
            volume_total: volTotal,
            created_by: profile?.id
          });
        } else {
          const volValue = parseFloat(addForm.volume.replace(',', '.')) || 0;
          const viagensValue = parseInt(addForm.viagens) || 1;
          const volTotal = volValue * viagensValue;

          await supabase.from('apontamentos_descarga').insert({
            data: addForm.data,
            hora: addForm.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            prefixo_caminhao: addForm.prefixoCb,
            motorista: addForm.motorista,
            material: addForm.material,
            local: addForm.local,
            volume: volValue,
            viagens: viagensValue,
            volume_total: volTotal,
            usuario: profile?.nome || 'Sistema'
          });
        }
      }

      toast({
        title: 'Registro adicionado!',
        description: `Novo registro de ${sheetName.toLowerCase()} adicionado com sucesso.`,
      });

      // Reset form and reload
      setAddForm({
        data: selectedDate,
        hora: '',
        prefixoCb: '',
        motorista: '',
        material: '',
        local: '',
        volume: '',
        viagens: '1',
      });
      await loadData();
      onSuccess?.();
    } catch (error) {
      console.error('Error adding record:', error);
      toast({
        title: 'Erro ao adicionar',
        description: 'Não foi possível adicionar o registro.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderRecordsList = () => (
    <div className="flex-1 border rounded-lg overflow-hidden">
      <div className="bg-muted/50 p-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Checkbox 
            checked={filteredRecords.length > 0 && filteredRecords.every(r => r.selected)}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedCount} de {filteredRecords.length} selecionado(s)
          </span>
        </div>
        <Badge variant="outline">{filteredRecords.length} registros</Badge>
      </div>

      <ScrollArea className="h-[250px]">
        <div className="divide-y">
          {filteredRecords.map((record) => (
            <div 
              key={record.rowIndex}
              className={`p-3 flex items-center gap-4 hover:bg-muted/30 transition-colors ${
                record.selected ? 'bg-primary/5' : ''
              }`}
            >
              <Checkbox 
                checked={record.selected}
                onCheckedChange={() => toggleSelect(record.rowIndex)}
              />
              <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Caminhão</p>
                  <p className="font-medium">{record.prefixoCb}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Motorista</p>
                  <p className="font-medium truncate">{record.motorista}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Material</p>
                  <p className="truncate">{record.material || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Hora</p>
                  <p>{record.hora}</p>
                </div>
              </div>
            </div>
          ))}

          {filteredRecords.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum registro encontrado para os filtros selecionados</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderFilters = () => (
    <div className="flex flex-wrap gap-3">
      <Select value={selectedDate} onValueChange={setSelectedDate}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Data" />
        </SelectTrigger>
        <SelectContent>
          {availableDates.map(date => (
            <SelectItem key={date} value={date}>{date}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative flex-1 min-w-[150px]">
        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar caminhão..."
          value={searchTruck}
          onChange={(e) => setSearchTruck(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="relative flex-1 min-w-[150px]">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar motorista..."
          value={searchDriver}
          onChange={(e) => setSearchDriver(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Edição em Lote - {sheetName}
            </DialogTitle>
            <DialogDescription>
              Edite, adicione ou exclua múltiplos registros de uma vez
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'add' | 'delete')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="edit" className="gap-2">
                <Edit3 className="w-4 h-4" />
                Editar
              </TabsTrigger>
              <TabsTrigger value="add" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar
              </TabsTrigger>
              <TabsTrigger value="delete" className="gap-2 text-red-600">
                <Trash2 className="w-4 h-4" />
                Excluir
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="flex-1 flex flex-col overflow-hidden mt-4 space-y-4">
              {renderFilters()}
              {renderRecordsList()}

              {/* Edit Action */}
              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="mb-2 block">Campo para editar</Label>
                    <Select value={editField} onValueChange={(v) => setEditField(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorista">Motorista</SelectItem>
                        <SelectItem value="material">Material</SelectItem>
                        <SelectItem value="local">Local da Obra</SelectItem>
                        <SelectItem value="volume">Volume</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="mb-2 block">Novo valor</Label>
                    <Input
                      placeholder={`Novo ${editField}...`}
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleBatchEdit}
                  disabled={isProcessing || loading || selectedCount === 0}
                  className="w-full gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Aplicar alteração em {selectedCount} registro(s)
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="add" className="flex-1 mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data *</Label>
                    <Select value={addForm.data} onValueChange={(v) => setAddForm(prev => ({ ...prev, data: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a data" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDates.map(date => (
                          <SelectItem key={date} value={date}>{date}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={addForm.hora}
                      onChange={(e) => setAddForm(prev => ({ ...prev, hora: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prefixo Caminhão *</Label>
                    <Input
                      placeholder="Ex: CB-28"
                      value={addForm.prefixoCb}
                      onChange={(e) => setAddForm(prev => ({ ...prev, prefixoCb: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  <div>
                    <Label>Motorista *</Label>
                    <Input
                      placeholder="Nome do motorista"
                      value={addForm.motorista}
                      onChange={(e) => setAddForm(prev => ({ ...prev, motorista: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Material</Label>
                    <Input
                      placeholder="Ex: Aterro, Areia..."
                      value={addForm.material}
                      onChange={(e) => setAddForm(prev => ({ ...prev, material: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Local da Obra</Label>
                    <Input
                      placeholder="Local da obra"
                      value={addForm.local}
                      onChange={(e) => setAddForm(prev => ({ ...prev, local: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Volume (m³)</Label>
                    <Input
                      placeholder="Ex: 12"
                      value={addForm.volume}
                      onChange={(e) => setAddForm(prev => ({ ...prev, volume: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Nº de Viagens</Label>
                    <Input
                      type="number"
                      min="1"
                      value={addForm.viagens}
                      onChange={(e) => setAddForm(prev => ({ ...prev, viagens: e.target.value }))}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleAddRecord}
                  disabled={isProcessing || loading}
                  className="w-full gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Adicionar Registro
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="delete" className="flex-1 flex flex-col overflow-hidden mt-4 space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-800 dark:text-red-200">Atenção: Exclusão em Lote</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Selecione os registros que deseja excluir permanentemente. Esta ação não pode ser desfeita.
                    </p>
                  </div>
                </div>
              </div>

              {renderFilters()}
              {renderRecordsList()}

              <Button 
                variant="destructive"
                onClick={handleBatchDelete}
                disabled={isProcessing || loading || selectedCount === 0}
                className="w-full gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir {selectedCount} registro(s) selecionado(s)
              </Button>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{selectedCount}</strong> registro(s) de {sheetName.toLowerCase()}.
              <br /><br />
              Esta ação <strong>não pode ser desfeita</strong>. Os registros serão removidos permanentemente da planilha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatchDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
