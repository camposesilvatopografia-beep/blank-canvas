import { useEffect, useState } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Truck, HardHat, Loader2, FileDown, Plus, Pencil, Trash2, RefreshCw, Droplets, Container, Filter, Fuel, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FrotaModal } from '@/components/crud/FrotaModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';

const FROTA_EQUIP_COLS: ColumnDefinition[] = [
  { key: 'prefixo', defaultLabel: 'Prefixo' },
  { key: 'descricao', defaultLabel: 'Descrição' },
  { key: 'empresa', defaultLabel: 'Empresa' },
  { key: 'operador', defaultLabel: 'Operador' },
  { key: 'status', defaultLabel: 'Status' },
  { key: 'acoes', defaultLabel: 'Ações' },
];
const FROTA_CAM_COLS: ColumnDefinition[] = [
  { key: 'prefixo', defaultLabel: 'Prefixo' },
  { key: 'descricao', defaultLabel: 'Descrição' },
  { key: 'empresa', defaultLabel: 'Empresa' },
  { key: 'motorista', defaultLabel: 'Motorista' },
  { key: 'status', defaultLabel: 'Status' },
  { key: 'acoes', defaultLabel: 'Ações' },
];
const FROTA_REB_COLS: ColumnDefinition[] = [
  { key: 'prefixo', defaultLabel: 'Prefixo' },
  { key: 'descricao', defaultLabel: 'Descrição' },
  { key: 'empresa', defaultLabel: 'Empresa' },
  { key: 'motorista', defaultLabel: 'Motorista' },
  { key: 'status', defaultLabel: 'Status' },
  { key: 'acoes', defaultLabel: 'Ações' },
];
const FROTA_PIPA_COLS: ColumnDefinition[] = [
  { key: 'prefixo', defaultLabel: 'Prefixo' },
  { key: 'descricao', defaultLabel: 'Descrição' },
  { key: 'empresa', defaultLabel: 'Empresa' },
  { key: 'motorista', defaultLabel: 'Motorista' },
  { key: 'local_trabalho', defaultLabel: 'Local de Trabalho' },
  { key: 'status', defaultLabel: 'Status' },
  { key: 'acoes', defaultLabel: 'Ações' },
];
const FROTA_RESUMO_COLS: ColumnDefinition[] = [
  { key: 'empresa', defaultLabel: 'EMPRESA' },
  { key: 'equipamentos', defaultLabel: 'EQUIP.' },
  { key: 'caminhoes', defaultLabel: 'CAM.' },
  { key: 'reboques', defaultLabel: 'REB.' },
  { key: 'pipas', defaultLabel: 'PIPAS' },
  { key: 'total', defaultLabel: 'TOTAL' },
];



interface EmpresaStats {
  empresa: string;
  equipamentos: number;
  caminhoes: number;
  reboques: number;
  pipas: number;
  total: number;
}

interface FrotaItem {
  rowIndex: number;
  prefixo: string;
  descricao: string;
  empresa: string;
  status?: string;
  operador?: string;
  motorista?: string;
  marca?: string;
  potencia?: string;
  volume?: string;
  capacidade?: string;
  placa?: string;
  tipoLocal?: string;
}

type FrotaTipo = 'equipamento' | 'caminhao' | 'reboque' | 'pipa';
type StatusFilter = 'todos' | 'Mobilizado' | 'Desmobilizado' | 'Manutenção' | 'Reserva';

export default function Frota() {
  const [empresaStats, setEmpresaStats] = useState<EmpresaStats[]>([]);
  const [equipamentos, setEquipamentos] = useState<FrotaItem[]>([]);
  const [caminhoes, setCaminhoes] = useState<FrotaItem[]>([]);
  const [reboques, setReboques] = useState<FrotaItem[]>([]);
  const [pipas, setPipas] = useState<FrotaItem[]>([]);
  const [headers, setHeaders] = useState<Record<FrotaTipo, string[]>>({
    equipamento: [],
    caminhao: [],
    reboque: [],
    pipa: [],
  });
  const [activeTab, setActiveTab] = useState('resumo');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FrotaItem | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<FrotaTipo>('equipamento');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  
  const { readSheet, writeSheet, appendSheet, loading } = useGoogleSheets();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { configs: eqCfg, getLabel: eqL, isVisible: eqV, saveConfigs: eqSave } = useColumnConfig('frota_equipamentos', FROTA_EQUIP_COLS);
  const { configs: camCfg, getLabel: camL, isVisible: camV, saveConfigs: camSave } = useColumnConfig('frota_caminhoes', FROTA_CAM_COLS);
  const { configs: rebCfg, getLabel: rebL, isVisible: rebV, saveConfigs: rebSave } = useColumnConfig('frota_reboques', FROTA_REB_COLS);
  const { configs: pipCfg, getLabel: pipL, isVisible: pipV, saveConfigs: pipSave } = useColumnConfig('frota_pipas', FROTA_PIPA_COLS);
  const { configs: resCfg, getLabel: resL, isVisible: resV, saveConfigs: resSave } = useColumnConfig('frota_resumo_empresa', FROTA_RESUMO_COLS);
  const [showColConfig, setShowColConfig] = useState<string | null>(null);

  const [totals, setTotals] = useState({
    geral: 0,
    equipamentos: 0,
    caminhoes: 0,
    reboques: 0,
    pipas: 0,
  });

  useEffect(() => {
    loadFrotaData();
  }, []);

  const loadFrotaData = async () => {
    try {
      const [escData, camData, rebData, pipaData, frotaGeralData] = await Promise.all([
        readSheet('Equipamentos'),
        readSheet('Caminhao'),
        readSheet('Cam_Reboque'),
        readSheet('Caminhao_Pipa'),
        readSheet('Frota Geral'),
      ]);

      // Store headers
      setHeaders({
        equipamento: escData[0] || [],
        caminhao: camData[0] || [],
        reboque: rebData[0] || [],
        pipa: pipaData[0] || [],
      });

      // Collect all custom statuses from sheets
      const allStatuses: string[] = [];
      
      // Parse equipamentos
      if (escData.length > 1) {
        const hdrs = escData[0];
        const getIdx = (name: string) => hdrs.indexOf(name);
        setEquipamentos(escData.slice(1).filter(row => row[getIdx('Prefixo_Eq')]).map((row, idx) => {
          const status = row[getIdx('Status')] || 'Mobilizado';
          if (status && !allStatuses.includes(status)) allStatuses.push(status);
          return {
            rowIndex: idx + 2,
            prefixo: row[getIdx('Prefixo_Eq')] || '',
            descricao: row[getIdx('Descricao_Eq')] || '',
            empresa: row[getIdx('Empresa_Eq')] || '',
            status,
            operador: row[getIdx('Operador')] || '',
            marca: row[getIdx('Marca')] || '',
            potencia: row[getIdx('Potencia')] || '',
          };
        }));
      }

      // Parse caminhoes
      if (camData.length > 1) {
        const hdrs = camData[0];
        const getIdx = (name: string) => hdrs.indexOf(name);
        setCaminhoes(camData.slice(1).filter(row => row[getIdx('Prefixo_Cb')]).map((row, idx) => {
          const status = row[getIdx('Status')] || 'Mobilizado';
          if (status && !allStatuses.includes(status)) allStatuses.push(status);
          return {
            rowIndex: idx + 2,
            prefixo: row[getIdx('Prefixo_Cb')] || '',
            descricao: row[getIdx('Descricao_Cb')] || '',
            empresa: row[getIdx('Empresa_Cb')] || '',
            status,
            motorista: row[getIdx('Motorista')] || '',
            marca: row[getIdx('Marca')] || '',
            potencia: row[getIdx('Potencia')] || '',
            volume: row[getIdx('Volume')] || '',
            placa: row[getIdx('Placa')] || '',
          };
        }));
      }

      // Parse reboques
      if (rebData.length > 1) {
        const hdrs = rebData[0];
        const getIdx = (name: string) => hdrs.indexOf(name);
        setReboques(rebData.slice(1).filter(row => row[getIdx('Prefixo')]).map((row, idx) => {
          const status = row[getIdx('Status')] || 'Mobilizado';
          if (status && !allStatuses.includes(status)) allStatuses.push(status);
          return {
            rowIndex: idx + 2,
            prefixo: row[getIdx('Prefixo')] || '',
            descricao: row[getIdx('Descricao')] || '',
            empresa: row[getIdx('Empresa')] || '',
            status,
            motorista: row[getIdx('Motorista')] || '',
            placa: row[getIdx('Placa')] || '',
          };
        }));
      }

      // Parse pipas
      if (pipaData.length > 1) {
        const hdrs = pipaData[0];
        const getIdx = (name: string) => hdrs.indexOf(name);
        // Try multiple possible header names for the local field
        const tipoLocalIdx = getIdx('Tipo_Local') >= 0 
          ? getIdx('Tipo_Local') 
          : getIdx('Local de Trabalho') >= 0 
            ? getIdx('Local de Trabalho') 
            : getIdx('Local_Trabalho') >= 0 
              ? getIdx('Local_Trabalho') 
              : -1;
        
        console.log('[Frota] Pipa headers:', hdrs);
        console.log('[Frota] Tipo_Local column index:', tipoLocalIdx);
        
        setPipas(pipaData.slice(1).filter(row => row[getIdx('Prefixo')]).map((row, idx) => {
          const status = row[getIdx('Status')] || 'Mobilizado';
          if (status && !allStatuses.includes(status)) allStatuses.push(status);
          const tipoLocal = tipoLocalIdx >= 0 ? (row[tipoLocalIdx] || '') : '';
          return {
            rowIndex: idx + 2,
            prefixo: row[getIdx('Prefixo')] || '',
            descricao: row[getIdx('Descricao')] || '',
            empresa: row[getIdx('Empresa')] || '',
            status,
            motorista: row[getIdx('Motorista')] || '',
            capacidade: row[getIdx('Capacidade')] || '',
            placa: row[getIdx('Placa')] || '',
            tipoLocal,
          };
        }));
      }
      
      // Set custom statuses collected from data
      setCustomStatuses(allStatuses.filter(s => !['Mobilizado', 'Desmobilizado', 'Manutenção', 'Reserva'].includes(s)));

      // Use "Frota Geral" consolidated sheet for totals and empresa stats
      if (frotaGeralData.length > 1) {
        const fgHdrs = frotaGeralData[0].map((h: string) => String(h).trim());
        const fgIdx = (name: string) => fgHdrs.findIndex((h: string) => h.toLowerCase() === name.toLowerCase());
        const catIdx = fgIdx('Categoria');
        const empIdx = fgIdx('Empresa');
        const descIdx = fgIdx('Descricao');
        const codIdx = fgIdx('Codigo');
        const statusIdx = fgIdx('Status');

        const fgRows = frotaGeralData.slice(1).filter((row: any[]) => {
          const code = codIdx >= 0 ? String(row[codIdx] || '').trim() : '';
          return code !== '';
        });

        // Categorize by Descricao field from Frota Geral
        let eqCount = 0, camCount = 0, rebCount = 0, pipaCount = 0;
        const empresaMap = new Map<string, EmpresaStats>();

        fgRows.forEach((row: any[]) => {
          const cat = catIdx >= 0 ? String(row[catIdx] || '').trim().toLowerCase() : '';
          const desc = descIdx >= 0 ? String(row[descIdx] || '').trim().toLowerCase() : '';
          const emp = empIdx >= 0 ? String(row[empIdx] || '').trim() : 'Sem Empresa';

          if (!empresaMap.has(emp)) {
            empresaMap.set(emp, { empresa: emp, equipamentos: 0, caminhoes: 0, reboques: 0, pipas: 0, total: 0 });
          }
          const stats = empresaMap.get(emp)!;
          stats.total++;

          // Categorize: check description for type classification
          if (desc.includes('pipa') || desc.includes('caminhão pipa')) {
            pipaCount++;
            stats.pipas++;
          } else if (desc.includes('reboque') || desc.includes('carreta') || desc.includes('cam_reboque') || desc.includes('caminhão reboque')) {
            rebCount++;
            stats.reboques++;
          } else if (cat === 'veiculo' || cat === 'veículo' || desc.includes('caminhão') || desc.includes('basculante')) {
            camCount++;
            stats.caminhoes++;
          } else {
            eqCount++;
            stats.equipamentos++;
          }
        });

        setTotals({
          geral: fgRows.length,
          equipamentos: eqCount,
          caminhoes: camCount,
          reboques: rebCount,
          pipas: pipaCount,
        });

        setEmpresaStats(Array.from(empresaMap.values()).sort((a, b) => b.total - a.total));
      } else {
        // Fallback to individual sheets if Frota Geral is empty
        setTotals({
          geral: (escData.length - 1) + (camData.length - 1) + (rebData.length - 1) + (pipaData.length - 1),
          equipamentos: escData.length - 1,
          caminhoes: camData.length - 1,
          reboques: rebData.length - 1,
          pipas: pipaData.length - 1,
        });

        const empresaMap = new Map<string, EmpresaStats>();
        const getEmpresa = (hdrs: string[], row: any[], key: string) => {
          const idx = hdrs.indexOf(key);
          return idx >= 0 ? (row[idx] || 'Sem Empresa') : 'Sem Empresa';
        };

        if (escData.length > 1) {
          escData.slice(1).forEach(row => {
            const emp = getEmpresa(escData[0], row, 'Empresa_Eq');
            if (!empresaMap.has(emp)) empresaMap.set(emp, { empresa: emp, equipamentos: 0, caminhoes: 0, reboques: 0, pipas: 0, total: 0 });
            empresaMap.get(emp)!.equipamentos++;
            empresaMap.get(emp)!.total++;
          });
        }
        if (camData.length > 1) {
          camData.slice(1).forEach(row => {
            const emp = getEmpresa(camData[0], row, 'Empresa_Cb');
            if (!empresaMap.has(emp)) empresaMap.set(emp, { empresa: emp, equipamentos: 0, caminhoes: 0, reboques: 0, pipas: 0, total: 0 });
            empresaMap.get(emp)!.caminhoes++;
            empresaMap.get(emp)!.total++;
          });
        }
        if (rebData.length > 1) {
          rebData.slice(1).forEach(row => {
            const emp = getEmpresa(rebData[0], row, 'Empresa');
            if (!empresaMap.has(emp)) empresaMap.set(emp, { empresa: emp, equipamentos: 0, caminhoes: 0, reboques: 0, pipas: 0, total: 0 });
            empresaMap.get(emp)!.reboques++;
            empresaMap.get(emp)!.total++;
          });
        }
        if (pipaData.length > 1) {
          pipaData.slice(1).forEach(row => {
            const emp = getEmpresa(pipaData[0], row, 'Empresa');
            if (!empresaMap.has(emp)) empresaMap.set(emp, { empresa: emp, equipamentos: 0, caminhoes: 0, reboques: 0, pipas: 0, total: 0 });
            empresaMap.get(emp)!.pipas++;
            empresaMap.get(emp)!.total++;
          });
        }
        setEmpresaStats(Array.from(empresaMap.values()).sort((a, b) => b.total - a.total));
      }

    } catch (error) {
      console.error('Error loading frota data:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao carregar dados da frota' });
    }
  };

  const getSheetName = (tipo: FrotaTipo) => {
    switch (tipo) {
      case 'equipamento': return 'Equipamentos';
      case 'caminhao': return 'Caminhao';
      case 'reboque': return 'Cam_Reboque';
      case 'pipa': return 'Caminhao_Pipa';
    }
  };

  const buildRow = (tipo: FrotaTipo, data: FrotaItem): string[] => {
    const hdrs = headers[tipo];
    const row = new Array(hdrs.length).fill('');
    const getIdx = (name: string) => hdrs.indexOf(name);

    if (tipo === 'equipamento') {
      row[getIdx('Prefixo_Eq')] = data.prefixo;
      row[getIdx('Descricao_Eq')] = data.descricao;
      row[getIdx('Empresa_Eq')] = data.empresa;
      row[getIdx('Status')] = data.status || 'Mobilizado';
      row[getIdx('Operador')] = data.operador || '';
      row[getIdx('Marca')] = data.marca || '';
      row[getIdx('Potencia')] = data.potencia || '';
    } else if (tipo === 'caminhao') {
      row[getIdx('Prefixo_Cb')] = data.prefixo;
      row[getIdx('Descricao_Cb')] = data.descricao;
      row[getIdx('Empresa_Cb')] = data.empresa;
      row[getIdx('Status')] = data.status || 'Mobilizado';
      row[getIdx('Motorista')] = data.motorista || '';
      row[getIdx('Marca')] = data.marca || '';
      row[getIdx('Potencia')] = data.potencia || '';
      row[getIdx('Volume')] = data.volume || '';
      row[getIdx('Placa')] = data.placa || '';
    } else {
      row[getIdx('Prefixo')] = data.prefixo;
      row[getIdx('Descricao')] = data.descricao;
      row[getIdx('Empresa')] = data.empresa;
      row[getIdx('Status')] = data.status || 'Mobilizado';
      row[getIdx('Motorista')] = data.motorista || '';
      if (tipo === 'pipa') {
        row[getIdx('Capacidade')] = data.capacidade || '';
        // Write to whatever header name exists for the local field
        const tipoLocalIdx = getIdx('Tipo_Local') >= 0 
          ? getIdx('Tipo_Local') 
          : getIdx('Local de Trabalho') >= 0 
            ? getIdx('Local de Trabalho') 
            : getIdx('Local_Trabalho');
        if (tipoLocalIdx >= 0) {
          row[tipoLocalIdx] = data.tipoLocal || '';
        }
      }
      row[getIdx('Placa')] = data.placa || '';
    }

    return row;
  };

  const handleSave = async (data: FrotaItem) => {
    setSaving(true);
    try {
      const sheetName = getSheetName(selectedTipo);
      const hdrs = headers[selectedTipo];
      const row = buildRow(selectedTipo, data);

      if (data.rowIndex) {
        await writeSheet(sheetName, buildRowRange(data.rowIndex, hdrs.length), [row]);
        toast({ title: 'Sucesso', description: 'Item atualizado com sucesso' });
      } else {
        await appendSheet(sheetName, [row]);
        toast({ title: 'Sucesso', description: 'Item adicionado com sucesso' });
      }

      setModalOpen(false);
      setSelectedItem(null);
      loadFrotaData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const sheetName = getSheetName(selectedTipo);
      const hdrs = headers[selectedTipo];
      const emptyRow = new Array(hdrs.length).fill('');
      await writeSheet(sheetName, buildRowRange(selectedItem.rowIndex, hdrs.length), [emptyRow]);
      toast({ title: 'Sucesso', description: 'Item excluído com sucesso' });
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      loadFrotaData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Erro ao excluir' });
    } finally {
      setSaving(false);
    }
  };

  const openNewModal = (tipo: FrotaTipo) => {
    setSelectedTipo(tipo);
    setSelectedItem(null);
    setModalOpen(true);
  };

  const openEditModal = (item: FrotaItem, tipo: FrotaTipo) => {
    setSelectedTipo(tipo);
    setSelectedItem(item);
    setModalOpen(true);
  };

  const openDeleteDialog = (item: FrotaItem, tipo: FrotaTipo) => {
    setSelectedTipo(tipo);
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const exportToPDF = () => {
    // Filter items by current status filter
    const filteredEquip = equipamentos.filter(e => statusFilter === 'todos' || e.status === statusFilter);
    const filteredCam = caminhoes.filter(e => statusFilter === 'todos' || e.status === statusFilter);
    const filteredReb = reboques.filter(e => statusFilter === 'todos' || e.status === statusFilter);
    const filteredPipas = pipas.filter(e => statusFilter === 'todos' || e.status === statusFilter);
    
    const statusLabel = statusFilter === 'todos' ? 'Todos' : statusFilter;
    
    // Create printable content
    const printContent = `
      <html>
        <head>
          <title>Frota Geral - Relatório</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            h1 { color: #333; margin-bottom: 5px; }
            h2 { color: #444; margin-top: 20px; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
            h3 { color: #555; margin-top: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
            .summary-card { padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; }
            .status-filter { background: #e3f2fd; padding: 8px 15px; border-radius: 5px; margin-bottom: 15px; }
            .status-mob { color: #2e7d32; font-weight: bold; }
            .status-desm { color: #f57c00; font-weight: bold; }
            .status-manut { color: #d32f2f; font-weight: bold; }
            .status-other { color: #666; font-weight: bold; }
            @media print {
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <h1>Relatório de Frota Geral</h1>
          <p>Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          <div class="status-filter">
            <strong>Filtro de Status:</strong> ${statusLabel}
          </div>
          
          <h2>Resumo Geral</h2>
          <div class="summary">
            <div class="summary-card"><strong>Total Filtrado:</strong> ${filteredEquip.length + filteredCam.length + filteredReb.length + filteredPipas.length}</div>
            <div class="summary-card"><strong>Equipamentos:</strong> ${filteredEquip.length}</div>
            <div class="summary-card"><strong>Caminhões:</strong> ${filteredCam.length}</div>
            <div class="summary-card"><strong>Reboques:</strong> ${filteredReb.length}</div>
            <div class="summary-card"><strong>Pipas:</strong> ${filteredPipas.length}</div>
          </div>

          <h2>Por Empresa</h2>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Equipamentos</th>
                <th>Caminhões</th>
                <th>Reboques</th>
                <th>Pipas</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${empresaStats.map(emp => `
                <tr>
                  <td>${emp.empresa}</td>
                  <td>${emp.equipamentos || '-'}</td>
                  <td>${emp.caminhoes || '-'}</td>
                  <td>${emp.reboques || '-'}</td>
                  <td>${emp.pipas || '-'}</td>
                  <td><strong>${emp.total}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${filteredEquip.length > 0 ? `
            <h2>Equipamentos / Escavadeiras</h2>
            <table>
              <thead>
                <tr><th>Prefixo</th><th>Descrição</th><th>Empresa</th><th>Operador</th><th>Marca</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${filteredEquip.map(e => `
                  <tr>
                    <td><strong>${e.prefixo}</strong></td>
                    <td>${e.descricao || '-'}</td>
                    <td>${e.empresa || '-'}</td>
                    <td>${e.operador || '-'}</td>
                    <td>${e.marca || '-'}</td>
                    <td class="${e.status === 'Mobilizado' ? 'status-mob' : e.status === 'Desmobilizado' ? 'status-desm' : e.status === 'Manutenção' ? 'status-manut' : 'status-other'}">${e.status || 'Mobilizado'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${filteredCam.length > 0 ? `
            <h2 class="page-break">Caminhões</h2>
            <table>
              <thead>
                <tr><th>Prefixo</th><th>Descrição</th><th>Empresa</th><th>Motorista</th><th>Volume</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${filteredCam.map(c => `
                  <tr>
                    <td><strong>${c.prefixo}</strong></td>
                    <td>${c.descricao || '-'}</td>
                    <td>${c.empresa || '-'}</td>
                    <td>${c.motorista || '-'}</td>
                    <td>${c.volume || '-'}</td>
                    <td class="${c.status === 'Mobilizado' ? 'status-mob' : c.status === 'Desmobilizado' ? 'status-desm' : c.status === 'Manutenção' ? 'status-manut' : 'status-other'}">${c.status || 'Mobilizado'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${filteredReb.length > 0 ? `
            <h2>Reboques / Carretas</h2>
            <table>
              <thead>
                <tr><th>Prefixo</th><th>Descrição</th><th>Empresa</th><th>Motorista</th><th>Placa</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${filteredReb.map(r => `
                  <tr>
                    <td><strong>${r.prefixo}</strong></td>
                    <td>${r.descricao || '-'}</td>
                    <td>${r.empresa || '-'}</td>
                    <td>${r.motorista || '-'}</td>
                    <td>${r.placa || '-'}</td>
                    <td class="${r.status === 'Mobilizado' ? 'status-mob' : r.status === 'Desmobilizado' ? 'status-desm' : r.status === 'Manutenção' ? 'status-manut' : 'status-other'}">${r.status || 'Mobilizado'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${filteredPipas.length > 0 ? `
            <h2>Caminhões Pipa</h2>
            <table>
              <thead>
                <tr><th>Prefixo</th><th>Descrição</th><th>Empresa</th><th>Motorista</th><th>Capacidade</th><th>Local de Trabalho</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${filteredPipas.map(p => `
                  <tr>
                    <td><strong>${p.prefixo}</strong></td>
                    <td>${p.descricao || '-'}</td>
                    <td>${p.empresa || '-'}</td>
                    <td>${p.motorista || '-'}</td>
                    <td>${p.capacidade || '-'}</td>
                    <td>${p.tipoLocal || '-'}</td>
                    <td class="${p.status === 'Mobilizado' ? 'status-mob' : p.status === 'Desmobilizado' ? 'status-desm' : p.status === 'Manutenção' ? 'status-manut' : 'status-other'}">${p.status || 'Mobilizado'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Frota Geral</h1>
            <p className="text-muted-foreground">Visão consolidada da frota</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadFrotaData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportToPDF}>
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {loading && equipamentos.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="bg-secondary text-secondary-foreground">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-80">Total Geral</p>
                    <p className="text-3xl font-bold">{totals.geral}</p>
                    <p className="text-sm opacity-70">Todos os tipos</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Truck className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Equipamentos</p>
                    <p className="text-3xl font-bold">{totals.equipamentos}</p>
                    <p className="text-sm text-muted-foreground">Escavadeiras</p>
                  </div>
                  <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                    <HardHat className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/10">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary">Caminhões</p>
                    <p className="text-3xl font-bold text-primary">{totals.caminhoes}</p>
                    <p className="text-sm text-primary/70">Basculantes</p>
                  </div>
                  <div className="p-2 bg-primary/20 text-primary rounded-lg">
                    <Truck className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reboques</p>
                    <p className="text-3xl font-bold">{totals.reboques}</p>
                    <p className="text-sm text-muted-foreground">Carretas</p>
                  </div>
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <Container className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pipas</p>
                    <p className="text-3xl font-bold">{totals.pipas}</p>
                    <p className="text-sm text-muted-foreground">Caminhões Pipa</p>
                  </div>
                  <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg">
                    <Droplets className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtrar por Status:</span>
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Mobilizado">Mobilizado</SelectItem>
                <SelectItem value="Desmobilizado">Desmobilizado</SelectItem>
                <SelectItem value="Manutenção">Manutenção</SelectItem>
                <SelectItem value="Reserva">Reserva</SelectItem>
                {customStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs for different views */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="space-y-2">
              {/* Linha 1: Cadastro da frota */}
              <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="resumo" className="text-xs sm:text-sm">Resumo</TabsTrigger>
                <TabsTrigger value="equipamentos" className="text-xs sm:text-sm">Equipamentos ({equipamentos.filter(e => statusFilter === 'todos' || e.status === statusFilter).length})</TabsTrigger>
                <TabsTrigger value="caminhoes" className="text-xs sm:text-sm">Caminhões ({caminhoes.filter(e => statusFilter === 'todos' || e.status === statusFilter).length})</TabsTrigger>
                <TabsTrigger value="reboques" className="text-xs sm:text-sm">Reboques ({reboques.filter(e => statusFilter === 'todos' || e.status === statusFilter).length})</TabsTrigger>
                <TabsTrigger value="pipas" className="text-xs sm:text-sm">Pipas ({pipas.filter(e => statusFilter === 'todos' || e.status === statusFilter).length})</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="resumo">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    🏢 Agrupado por Empresa
                  </CardTitle>
                  {isMainAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => setShowColConfig('resumo')} title="Configurar colunas">
                      <Settings2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {resV('empresa') && <TableHead>{resL('empresa')}</TableHead>}
                        {resV('equipamentos') && <TableHead className="text-center">{resL('equipamentos')}</TableHead>}
                        {resV('caminhoes') && <TableHead className="text-center">{resL('caminhoes')}</TableHead>}
                        {resV('reboques') && <TableHead className="text-center">{resL('reboques')}</TableHead>}
                        {resV('pipas') && <TableHead className="text-center">{resL('pipas')}</TableHead>}
                        {resV('total') && <TableHead className="text-right">{resL('total')}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empresaStats.map((emp) => (
                        <TableRow key={emp.empresa}>
                          {resV('empresa') && <TableCell className="font-medium">{emp.empresa}</TableCell>}
                          {resV('equipamentos') && <TableCell className="text-center text-primary">{emp.equipamentos || '-'}</TableCell>}
                          {resV('caminhoes') && <TableCell className="text-center text-primary">{emp.caminhoes || '-'}</TableCell>}
                          {resV('reboques') && <TableCell className="text-center">{emp.reboques || '-'}</TableCell>}
                          {resV('pipas') && <TableCell className="text-center">{emp.pipas || '-'}</TableCell>}
                          {resV('total') && <TableCell className="text-right font-bold">{emp.total}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="equipamentos">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Equipamentos / Escavadeiras</CardTitle>
                  <div className="flex gap-2">
                    {isMainAdmin && <Button variant="ghost" size="icon" onClick={() => setShowColConfig('equip')}><Settings2 className="w-4 h-4" /></Button>}
                    <Button className="gap-2" onClick={() => openNewModal('equipamento')}><Plus className="w-4 h-4" /> Novo Equipamento</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {eqV('prefixo') && <TableHead>{eqL('prefixo')}</TableHead>}
                        {eqV('descricao') && <TableHead>{eqL('descricao')}</TableHead>}
                        {eqV('empresa') && <TableHead>{eqL('empresa')}</TableHead>}
                        {eqV('operador') && <TableHead>{eqL('operador')}</TableHead>}
                        {eqV('status') && <TableHead>{eqL('status')}</TableHead>}
                        {eqV('acoes') && <TableHead className="text-right">{eqL('acoes')}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipamentos.filter(e => statusFilter === 'todos' || e.status === statusFilter).map((item) => (
                        <TableRow key={item.rowIndex}>
                          {eqV('prefixo') && <TableCell className="font-medium text-primary">{item.prefixo}</TableCell>}
                          {eqV('descricao') && <TableCell>{item.descricao}</TableCell>}
                          {eqV('empresa') && <TableCell>{item.empresa}</TableCell>}
                          {eqV('operador') && <TableCell>{item.operador}</TableCell>}
                          {eqV('status') && <TableCell><Badge variant={item.status === 'Mobilizado' ? 'default' : item.status === 'Desmobilizado' ? 'secondary' : 'outline'}>{item.status || 'Mobilizado'}</Badge></TableCell>}
                          {eqV('acoes') && <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(item, 'equipamento')}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(item, 'equipamento')}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>}
                        </TableRow>
                      ))}
                      {equipamentos.filter(e => statusFilter === 'todos' || e.status === statusFilter).length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum equipamento encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="caminhoes">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Caminhões</CardTitle>
                  <div className="flex gap-2">
                    {isMainAdmin && <Button variant="ghost" size="icon" onClick={() => setShowColConfig('cam')}><Settings2 className="w-4 h-4" /></Button>}
                    <Button className="gap-2" onClick={() => openNewModal('caminhao')}><Plus className="w-4 h-4" /> Novo Caminhão</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {camV('prefixo') && <TableHead>{camL('prefixo')}</TableHead>}
                        {camV('descricao') && <TableHead>{camL('descricao')}</TableHead>}
                        {camV('empresa') && <TableHead>{camL('empresa')}</TableHead>}
                        {camV('motorista') && <TableHead>{camL('motorista')}</TableHead>}
                        {camV('status') && <TableHead>{camL('status')}</TableHead>}
                        {camV('acoes') && <TableHead className="text-right">{camL('acoes')}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caminhoes.filter(e => statusFilter === 'todos' || e.status === statusFilter).map((item) => (
                        <TableRow key={item.rowIndex}>
                          {camV('prefixo') && <TableCell className="font-medium text-primary">{item.prefixo}</TableCell>}
                          {camV('descricao') && <TableCell>{item.descricao}</TableCell>}
                          {camV('empresa') && <TableCell>{item.empresa}</TableCell>}
                          {camV('motorista') && <TableCell>{item.motorista}</TableCell>}
                          {camV('status') && <TableCell><Badge variant={item.status === 'Mobilizado' ? 'default' : item.status === 'Desmobilizado' ? 'secondary' : 'outline'}>{item.status || 'Mobilizado'}</Badge></TableCell>}
                          {camV('acoes') && <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(item, 'caminhao')}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(item, 'caminhao')}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>}
                        </TableRow>
                      ))}
                      {caminhoes.filter(e => statusFilter === 'todos' || e.status === statusFilter).length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum caminhão encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reboques">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Reboques / Carretas</CardTitle>
                  <div className="flex gap-2">
                    {isMainAdmin && <Button variant="ghost" size="icon" onClick={() => setShowColConfig('reb')}><Settings2 className="w-4 h-4" /></Button>}
                    <Button className="gap-2" onClick={() => openNewModal('reboque')}><Plus className="w-4 h-4" /> Novo Reboque</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {rebV('prefixo') && <TableHead>{rebL('prefixo')}</TableHead>}
                        {rebV('descricao') && <TableHead>{rebL('descricao')}</TableHead>}
                        {rebV('empresa') && <TableHead>{rebL('empresa')}</TableHead>}
                        {rebV('motorista') && <TableHead>{rebL('motorista')}</TableHead>}
                        {rebV('status') && <TableHead>{rebL('status')}</TableHead>}
                        {rebV('acoes') && <TableHead className="text-right">{rebL('acoes')}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reboques.filter(e => statusFilter === 'todos' || e.status === statusFilter).map((item) => (
                        <TableRow key={item.rowIndex}>
                          {rebV('prefixo') && <TableCell className="font-medium text-primary">{item.prefixo}</TableCell>}
                          {rebV('descricao') && <TableCell>{item.descricao}</TableCell>}
                          {rebV('empresa') && <TableCell>{item.empresa}</TableCell>}
                          {rebV('motorista') && <TableCell>{item.motorista}</TableCell>}
                          {rebV('status') && <TableCell><Badge variant={item.status === 'Mobilizado' ? 'default' : item.status === 'Desmobilizado' ? 'secondary' : 'outline'}>{item.status || 'Mobilizado'}</Badge></TableCell>}
                          {rebV('acoes') && <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(item, 'reboque')}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(item, 'reboque')}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>}
                        </TableRow>
                      ))}
                      {reboques.filter(e => statusFilter === 'todos' || e.status === statusFilter).length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum reboque encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pipas">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Caminhões Pipa</CardTitle>
                  <div className="flex gap-2">
                    {isMainAdmin && <Button variant="ghost" size="icon" onClick={() => setShowColConfig('pip')}><Settings2 className="w-4 h-4" /></Button>}
                    <Button className="gap-2" onClick={() => openNewModal('pipa')}><Plus className="w-4 h-4" /> Nova Pipa</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {pipV('prefixo') && <TableHead>{pipL('prefixo')}</TableHead>}
                        {pipV('descricao') && <TableHead>{pipL('descricao')}</TableHead>}
                        {pipV('empresa') && <TableHead>{pipL('empresa')}</TableHead>}
                        {pipV('motorista') && <TableHead>{pipL('motorista')}</TableHead>}
                        {pipV('local_trabalho') && <TableHead>{pipL('local_trabalho')}</TableHead>}
                        {pipV('status') && <TableHead>{pipL('status')}</TableHead>}
                        {pipV('acoes') && <TableHead className="text-right">{pipL('acoes')}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipas.filter(e => statusFilter === 'todos' || e.status === statusFilter).map((item) => (
                        <TableRow key={item.rowIndex}>
                          {pipV('prefixo') && <TableCell className="font-medium text-primary">{item.prefixo}</TableCell>}
                          {pipV('descricao') && <TableCell>{item.descricao}</TableCell>}
                          {pipV('empresa') && <TableCell>{item.empresa}</TableCell>}
                          {pipV('motorista') && <TableCell>{item.motorista}</TableCell>}
                          {pipV('local_trabalho') && <TableCell>
                            {item.tipoLocal ? (
                              <Badge variant={item.tipoLocal === 'Produção' ? 'default' : 'secondary'}>{item.tipoLocal}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>}
                          {pipV('status') && <TableCell><Badge variant={item.status === 'Mobilizado' ? 'default' : item.status === 'Desmobilizado' ? 'secondary' : 'outline'}>{item.status || 'Mobilizado'}</Badge></TableCell>}
                          {pipV('acoes') && <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(item, 'pipa')}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => openDeleteDialog(item, 'pipa')}><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>}
                        </TableRow>
                      ))}
                      {pipas.filter(e => statusFilter === 'todos' || e.status === statusFilter).length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma pipa encontrada</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>


          </Tabs>
        </>
      )}

      <FrotaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        item={selectedItem}
        tipo={selectedTipo}
        loading={saving}
        statusOptions={customStatuses}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        title="Excluir Item"
        description={`Tem certeza que deseja excluir "${selectedItem?.prefixo}"?`}
      />

      <ColumnConfigModal open={showColConfig === 'resumo'} onOpenChange={() => setShowColConfig(null)} tableLabel="Frota — Resumo por Empresa" defaultColumns={FROTA_RESUMO_COLS} currentConfigs={resCfg} onSave={resSave} />
      <ColumnConfigModal open={showColConfig === 'equip'} onOpenChange={() => setShowColConfig(null)} tableLabel="Frota — Equipamentos" defaultColumns={FROTA_EQUIP_COLS} currentConfigs={eqCfg} onSave={eqSave} />
      <ColumnConfigModal open={showColConfig === 'cam'} onOpenChange={() => setShowColConfig(null)} tableLabel="Frota — Caminhões" defaultColumns={FROTA_CAM_COLS} currentConfigs={camCfg} onSave={camSave} />
      <ColumnConfigModal open={showColConfig === 'reb'} onOpenChange={() => setShowColConfig(null)} tableLabel="Frota — Reboques" defaultColumns={FROTA_REB_COLS} currentConfigs={rebCfg} onSave={rebSave} />
      <ColumnConfigModal open={showColConfig === 'pip'} onOpenChange={() => setShowColConfig(null)} tableLabel="Frota — Pipas" defaultColumns={FROTA_PIPA_COLS} currentConfigs={pipCfg} onSave={pipSave} />
    </div>
  );
}
