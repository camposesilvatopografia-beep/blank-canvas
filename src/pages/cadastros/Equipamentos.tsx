import { useEffect, useState } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, Search, Loader2, HardHat, Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronRight, Building2, Shovel, Container, Droplets, CarFront } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';

// Generic equipment interface
interface Equipment {
  rowIndex: number;
  prefixo: string;
  descricao: string;
  operador?: string;
  motorista?: string;
  marca?: string;
  potencia?: string;
  volume?: string;
  empresa: string;
  encarregado?: string;
  placa?: string;
  modelo?: string;
  pesoVazio?: string;
  capacidade?: string;
}

interface EquipmentTab {
  id: string;
  label: string;
  sheetName: string;
  icon: React.ReactNode;
  columns: { key: string; label: string; sheetKey: string }[];
}

interface EmpresaGroup {
  empresa: string;
  items: Equipment[];
}

// Tab configurations for each equipment type
const EQUIPMENT_TABS: EquipmentTab[] = [
  {
    id: 'escavadeiras',
    label: 'Escavadeiras',
    sheetName: 'Equipamentos',
    icon: <Shovel className="w-4 h-4" />,
    columns: [
      { key: 'prefixo', label: 'Prefixo', sheetKey: 'Prefixo_Eq' },
      { key: 'descricao', label: 'Descrição', sheetKey: 'Descricao_Eq' },
      { key: 'operador', label: 'Operador', sheetKey: 'Operador' },
      { key: 'marca', label: 'Marca', sheetKey: 'Marca' },
      { key: 'potencia', label: 'Potência', sheetKey: 'Potencia' },
      { key: 'empresa', label: 'Empresa', sheetKey: 'Empresa_Eq' },
      { key: 'encarregado', label: 'Encarregado', sheetKey: 'Encarregado_Eq' },
    ],
  },
  {
    id: 'caminhoes',
    label: 'Caminhões',
    sheetName: 'Caminhao',
    icon: <Truck className="w-4 h-4" />,
    columns: [
      { key: 'prefixo', label: 'Prefixo', sheetKey: 'Prefixo_Cb' },
      { key: 'descricao', label: 'Descrição', sheetKey: 'Descricao_Cb' },
      { key: 'motorista', label: 'Motorista', sheetKey: 'Motorista' },
      { key: 'marca', label: 'Marca', sheetKey: 'Marca' },
      { key: 'potencia', label: 'Potência', sheetKey: 'Potencia' },
      { key: 'volume', label: 'Volume', sheetKey: 'Volume' },
      { key: 'empresa', label: 'Empresa', sheetKey: 'Empresa_Cb' },
      { key: 'encarregado', label: 'Encarregado', sheetKey: 'Encarregado_Cb' },
    ],
  },
  {
    id: 'retroescavadeiras',
    label: 'Retros',
    sheetName: 'Retro',
    icon: <HardHat className="w-4 h-4" />,
    columns: [
      { key: 'prefixo', label: 'Prefixo', sheetKey: 'Prefixo' },
      { key: 'descricao', label: 'Descrição', sheetKey: 'Descricao' },
      { key: 'operador', label: 'Operador', sheetKey: 'Operador' },
      { key: 'marca', label: 'Marca', sheetKey: 'Marca' },
      { key: 'potencia', label: 'Potência', sheetKey: 'Potencia' },
      { key: 'empresa', label: 'Empresa', sheetKey: 'Empresa' },
    ],
  },
  {
    id: 'reboques',
    label: 'Cam. Reboque',
    sheetName: 'Cam_reboque',
    icon: <Container className="w-4 h-4" />,
    columns: [
      { key: 'prefixo', label: 'Prefixo', sheetKey: 'Prefixo' },
      { key: 'descricao', label: 'Descrição', sheetKey: 'Descricao' },
      { key: 'motorista', label: 'Motorista', sheetKey: 'Motorista' },
      { key: 'empresa', label: 'Empresa', sheetKey: 'Empresa' },
      { key: 'modelo', label: 'Modelo', sheetKey: 'Modelo' },
      { key: 'placa', label: 'Placa', sheetKey: 'Placa' },
      { key: 'pesoVazio', label: 'Peso Vazio', sheetKey: 'Peso_Vazio' },
    ],
  },
  {
    id: 'pipas',
    label: 'Cam. Pipa',
    sheetName: 'Caminhao_Pipa',
    icon: <Droplets className="w-4 h-4" />,
    columns: [
      { key: 'prefixo', label: 'Prefixo', sheetKey: 'Prefixo' },
      { key: 'descricao', label: 'Descrição', sheetKey: 'Descricao' },
      { key: 'motorista', label: 'Motorista', sheetKey: 'Motorista' },
      { key: 'empresa', label: 'Empresa', sheetKey: 'Empresa' },
      { key: 'capacidade', label: 'Capacidade', sheetKey: 'Capacidade' },
      { key: 'placa', label: 'Placa', sheetKey: 'Placa' },
      { key: 'tipoLocal', label: 'Local de Trabalho', sheetKey: 'Tipo_Local' },
    ],
  },
];

export default function Equipamentos() {
  const [equipmentData, setEquipmentData] = useState<Record<string, Equipment[]>>({});
  const [headers, setHeaders] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('escavadeiras');
  const [openEmpresas, setOpenEmpresas] = useState<Record<string, boolean>>({});
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  
  const { readSheet, writeSheet, appendSheet, loading } = useGoogleSheets();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadAllEquipments();
  }, []);

  const loadAllEquipments = async () => {
    try {
      const newData: Record<string, Equipment[]> = {};
      const newHeaders: Record<string, string[]> = {};

      for (const tab of EQUIPMENT_TABS) {
        try {
          const data = await readSheet(tab.sheetName);
          if (data && data.length > 0) {
            const sheetHeaders = data[0];
            newHeaders[tab.id] = sheetHeaders;
            
            const getIdx = (name: string) => {
              let idx = sheetHeaders.indexOf(name);
              if (idx !== -1) return idx;
              idx = sheetHeaders.findIndex((h: string) => h?.toLowerCase() === name.toLowerCase());
              return idx;
            };
            
            const items = data.slice(1)
              .map((row: any[], idx: number) => {
                const item: Equipment = {
                  rowIndex: idx + 2,
                  prefixo: '',
                  descricao: '',
                  empresa: '',
                };
                
                tab.columns.forEach(col => {
                  const value = row[getIdx(col.sheetKey)] || '';
                  (item as any)[col.key] = value;
                });
                
                return item;
              })
              .filter((item: Equipment) => item.prefixo);
            
            newData[tab.id] = items;
            
            // Open all companies by default
            const empresas = [...new Set(items.map((e: Equipment) => e.empresa))];
            const openState: Record<string, boolean> = {};
            empresas.forEach(emp => openState[`${tab.id}-${emp}`] = true);
            setOpenEmpresas(prev => ({ ...prev, ...openState }));
          } else {
            newData[tab.id] = [];
          }
        } catch (error) {
          console.log(`Sheet ${tab.sheetName} not found or empty`);
          newData[tab.id] = [];
        }
      }
      
      setEquipmentData(newData);
      setHeaders(newHeaders);
    } catch (error) {
      console.error('Error loading equipamentos:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar equipamentos',
      });
    }
  };

  const getCurrentTab = () => EQUIPMENT_TABS.find(t => t.id === activeTab) || EQUIPMENT_TABS[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentTab = getCurrentTab();
      const sheetHeaders = headers[currentTab.id] || [];
      
      if (sheetHeaders.length === 0) {
        throw new Error('Headers não carregados para esta planilha');
      }
      
      const getIdx = (name: string) => {
        let idx = sheetHeaders.indexOf(name);
        if (idx !== -1) return idx;
        idx = sheetHeaders.findIndex((h: string) => h?.toLowerCase() === name.toLowerCase());
        return idx;
      };
      
      const row = new Array(sheetHeaders.length).fill('');
      currentTab.columns.forEach(col => {
        const idx = getIdx(col.sheetKey);
        if (idx !== -1) {
          row[idx] = formData[col.key] || '';
        }
      });

      if (selectedEquipment?.rowIndex) {
        const lastCol = buildRowRange(selectedEquipment.rowIndex, sheetHeaders.length);
        await writeSheet(currentTab.sheetName, lastCol, [row]);
        toast({ title: 'Sucesso', description: `${currentTab.label.slice(0, -1)} atualizado(a)` });
      } else {
        await appendSheet(currentTab.sheetName, [row]);
        toast({ title: 'Sucesso', description: `${currentTab.label.slice(0, -1)} adicionado(a)` });
      }
      
      setModalOpen(false);
      setSelectedEquipment(null);
      setFormData({});
      loadAllEquipments();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao salvar',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEquipment) return;
    setSaving(true);
    try {
      const currentTab = getCurrentTab();
      const sheetHeaders = headers[currentTab.id] || [];
      const emptyRow = new Array(sheetHeaders.length).fill('');
      
      await writeSheet(currentTab.sheetName, buildRowRange(selectedEquipment.rowIndex, sheetHeaders.length), [emptyRow]);
      toast({ title: 'Sucesso', description: 'Equipamento removido' });
      
      setDeleteDialogOpen(false);
      setSelectedEquipment(null);
      loadAllEquipments();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao excluir',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEmpresa = (key: string) => {
    setOpenEmpresas(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openEdit = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    const data: Record<string, string> = {};
    getCurrentTab().columns.forEach(col => {
      data[col.key] = (equipment as any)[col.key] || '';
    });
    setFormData(data);
    setModalOpen(true);
  };

  const openNew = () => {
    setSelectedEquipment(null);
    const data: Record<string, string> = {};
    getCurrentTab().columns.forEach(col => {
      data[col.key] = '';
    });
    setFormData(data);
    setModalOpen(true);
  };

  const openDeleteDialog = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setDeleteDialogOpen(true);
  };

  // Filter equipment
  const getFilteredEquipment = (tabId: string) => {
    const items = equipmentData[tabId] || [];
    if (!search) return items;
    
    const searchLower = search.toLowerCase();
    return items.filter(item => 
      item.prefixo.toLowerCase().includes(searchLower) ||
      item.descricao?.toLowerCase().includes(searchLower) ||
      item.operador?.toLowerCase().includes(searchLower) ||
      item.motorista?.toLowerCase().includes(searchLower) ||
      item.empresa?.toLowerCase().includes(searchLower)
    );
  };

  // Group by empresa
  const groupByEmpresa = (items: Equipment[]): EmpresaGroup[] => {
    const groups = new Map<string, Equipment[]>();
    items.forEach(item => {
      const empresa = item.empresa || 'Sem Empresa';
      if (!groups.has(empresa)) groups.set(empresa, []);
      groups.get(empresa)!.push(item);
    });
    return Array.from(groups.entries())
      .map(([empresa, items]) => ({ empresa, items }))
      .sort((a, b) => a.empresa.localeCompare(b.empresa));
  };

  const currentTab = getCurrentTab();
  const filteredItems = getFilteredEquipment(activeTab);
  const groups = groupByEmpresa(filteredItems);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Equipamentos</h1>
            <p className="text-muted-foreground">Gerenciar todos os equipamentos cadastrados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAllEquipments} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button className="gap-2" onClick={openNew}>
            <Plus className="w-4 h-4" />
            Novo {currentTab.label.slice(0, -1)}
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por prefixo, operador, motorista ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {loading && Object.keys(equipmentData).length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            {EQUIPMENT_TABS.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                {tab.icon}
                {tab.label} ({(equipmentData[tab.id] || []).length})
              </TabsTrigger>
            ))}
          </TabsList>

          {EQUIPMENT_TABS.map(tab => (
            <TabsContent key={tab.id} value={tab.id} className="space-y-4">
              {groups.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum equipamento encontrado nesta categoria
                  </CardContent>
                </Card>
              ) : (
                groups.map((group) => (
                  <Card key={group.empresa}>
                    <Collapsible 
                      open={openEmpresas[`${tab.id}-${group.empresa}`] !== false}
                      onOpenChange={() => toggleEmpresa(`${tab.id}-${group.empresa}`)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="flex flex-row items-center justify-between py-4 cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-primary" />
                            <CardTitle className="text-lg">{group.empresa}</CardTitle>
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                              {group.items.length} equipamentos
                            </span>
                          </div>
                          {openEmpresas[`${tab.id}-${group.empresa}`] !== false ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {tab.columns.filter(c => c.key !== 'empresa' && c.key !== 'encarregado').map(col => (
                                  <TableHead key={col.key}>{col.label}</TableHead>
                                ))}
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.items.map((item) => (
                                <TableRow key={item.rowIndex}>
                                  {tab.columns.filter(c => c.key !== 'empresa' && c.key !== 'encarregado').map(col => (
                                    <TableCell key={col.key} className={col.key === 'prefixo' ? 'font-medium text-primary' : ''}>
                                      {(item as any)[col.key] || '-'}
                                    </TableCell>
                                  ))}
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    {(tab.id !== 'pipas' || isAdmin) && (
                                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(item)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Generic Equipment Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentTab.icon}
              {selectedEquipment ? `Editar ${currentTab.label.slice(0, -1)}` : `Novo ${currentTab.label.slice(0, -1)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {currentTab.columns.map(col => (
              <div key={col.key} className="space-y-2">
                <Label htmlFor={col.key}>{col.label}</Label>
                {col.key === 'tipoLocal' ? (
                  <Select
                    value={formData[col.key] || ''}
                    onValueChange={(value) => setFormData({ ...formData, [col.key]: value })}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o local de trabalho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Produção">Produção</SelectItem>
                      <SelectItem value="Recicladora">Recicladora</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={col.key}
                    value={formData[col.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
                    placeholder={`Digite ${col.label.toLowerCase()}`}
                    disabled={saving}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.prefixo}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Excluir Equipamento"
        description={`Tem certeza que deseja excluir "${selectedEquipment?.prefixo}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
