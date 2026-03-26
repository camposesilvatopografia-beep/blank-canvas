import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings2, Table2, Paintbrush } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';
import { ConditionalFormatModal } from '@/components/crud/ConditionalFormatModal';
import { useConditionalFormat } from '@/hooks/useConditionalFormat';

// All table definitions centralized
const TABLE_DEFINITIONS: { tableKey: string; label: string; columns: ColumnDefinition[] }[] = [
  {
    tableKey: 'cal_movimentacoes',
    label: 'Movimentações CAL',
    columns: [
      { key: 'data', defaultLabel: 'DATA' },
      { key: 'hora', defaultLabel: 'HORA' },
      { key: 'tipo', defaultLabel: 'TIPO' },
      { key: 'local_fornecedor', defaultLabel: 'LOCAL/FORNECEDOR' },
      { key: 'quantidade', defaultLabel: 'Quantidade (t)' },
      { key: 'peso_calc', defaultLabel: 'PESO CALC. OBRA' },
      { key: 'ticket', defaultLabel: 'TICKET' },
    ],
  },
  {
    tableKey: 'pedreira_registros',
    label: 'Registros Pedreira',
    columns: [
      { key: 'hora', defaultLabel: 'HORA' },
      { key: 'prefixo', defaultLabel: 'PREFIXO' },
      { key: 'fornecedor', defaultLabel: 'FORNECEDOR' },
      { key: 'empresa', defaultLabel: 'EMPRESA' },
      { key: 'material', defaultLabel: 'MATERIAL' },
      { key: 'peso_final', defaultLabel: 'PESO FINAL' },
      { key: 'foto', defaultLabel: '📷' },
      { key: 'toneladas', defaultLabel: 'TONELADAS' },
      { key: 'peso_chegada', defaultLabel: 'P. CHEGADA' },
      { key: 'diferenca', defaultLabel: 'DIFERENÇA' },
      { key: 'acoes', defaultLabel: 'AÇÕES' },
    ],
  },
  {
    tableKey: 'pipas_registros',
    label: 'Registros Pipas',
    columns: [
      { key: 'data', defaultLabel: 'DATA' },
      { key: 'prefixo', defaultLabel: 'PREFIXO' },
      { key: 'empresa', defaultLabel: 'EMPRESA' },
      { key: 'motorista', defaultLabel: 'MOTORISTA' },
      { key: 'capacidade', defaultLabel: 'CAPACIDADE' },
      { key: 'local', defaultLabel: 'LOCAL' },
      { key: 'viagens', defaultLabel: 'VIAGENS' },
      { key: 'acoes', defaultLabel: 'AÇÕES' },
    ],
  },
  {
    tableKey: 'descarga_caminhoes',
    label: 'Caminhões Descarga',
    columns: [
      { key: 'caminhao', defaultLabel: 'CAMINHÃO' },
      { key: 'motorista', defaultLabel: 'MOTORISTA' },
      { key: 'areia', defaultLabel: 'AREIA' },
      { key: 'aterro', defaultLabel: 'ATERRO' },
      { key: 'bgs', defaultLabel: 'BGS' },
      { key: 'bota_fora', defaultLabel: 'BOTA FORA' },
      { key: 'total', defaultLabel: 'TOTAL' },
      { key: 'acoes', defaultLabel: '' },
    ],
  },
  // --- Almoxarifado ---
  {
    tableKey: 'alm_materiais',
    label: 'Almoxarifado — Materiais',
    columns: [
      { key: 'codigo', defaultLabel: 'Código' },
      { key: 'nome', defaultLabel: 'Nome' },
      { key: 'categoria', defaultLabel: 'Categoria' },
      { key: 'unidade', defaultLabel: 'Unidade' },
      { key: 'estoque_atual', defaultLabel: 'Estoque Atual' },
      { key: 'estoque_minimo', defaultLabel: 'Mínimo' },
      { key: 'status', defaultLabel: 'Status' },
      { key: 'acoes', defaultLabel: 'Ações' },
    ],
  },
  {
    tableKey: 'alm_saidas',
    label: 'Almoxarifado — Saídas',
    columns: [
      { key: 'data', defaultLabel: 'Data' },
      { key: 'material', defaultLabel: 'Material' },
      { key: 'quantidade', defaultLabel: 'Qtd' },
      { key: 'equipe', defaultLabel: 'Equipe' },
      { key: 'etapa', defaultLabel: 'Etapa' },
      { key: 'requisicao', defaultLabel: 'Requisição' },
      { key: 'saldo_apos', defaultLabel: 'Saldo Após' },
      { key: 'acoes', defaultLabel: 'Ações' },
    ],
  },
  {
    tableKey: 'alm_inventario',
    label: 'Almoxarifado — Inventário',
    columns: [
      { key: 'codigo', defaultLabel: 'Código' },
      { key: 'material', defaultLabel: 'Material' },
      { key: 'unidade', defaultLabel: 'Unidade' },
      { key: 'estoque_atual', defaultLabel: 'Estoque Atual' },
      { key: 'estoque_minimo', defaultLabel: 'Mínimo' },
      { key: 'status', defaultLabel: 'Status' },
    ],
  },
  // --- Frota ---
  {
    tableKey: 'frota_equipamentos',
    label: 'Frota — Equipamentos',
    columns: [
      { key: 'prefixo', defaultLabel: 'Prefixo' },
      { key: 'descricao', defaultLabel: 'Descrição' },
      { key: 'empresa', defaultLabel: 'Empresa' },
      { key: 'operador', defaultLabel: 'Operador' },
      { key: 'status', defaultLabel: 'Status' },
      { key: 'acoes', defaultLabel: 'Ações' },
    ],
  },
  {
    tableKey: 'frota_caminhoes',
    label: 'Frota — Caminhões',
    columns: [
      { key: 'prefixo', defaultLabel: 'Prefixo' },
      { key: 'descricao', defaultLabel: 'Descrição' },
      { key: 'empresa', defaultLabel: 'Empresa' },
      { key: 'motorista', defaultLabel: 'Motorista' },
      { key: 'status', defaultLabel: 'Status' },
      { key: 'acoes', defaultLabel: 'Ações' },
    ],
  },
  {
    tableKey: 'frota_reboques',
    label: 'Frota — Reboques',
    columns: [
      { key: 'prefixo', defaultLabel: 'Prefixo' },
      { key: 'descricao', defaultLabel: 'Descrição' },
      { key: 'empresa', defaultLabel: 'Empresa' },
      { key: 'motorista', defaultLabel: 'Motorista' },
      { key: 'status', defaultLabel: 'Status' },
      { key: 'acoes', defaultLabel: 'Ações' },
    ],
  },
  {
    tableKey: 'frota_pipas',
    label: 'Frota — Pipas',
    columns: [
      { key: 'prefixo', defaultLabel: 'Prefixo' },
      { key: 'descricao', defaultLabel: 'Descrição' },
      { key: 'empresa', defaultLabel: 'Empresa' },
      { key: 'motorista', defaultLabel: 'Motorista' },
      { key: 'local_trabalho', defaultLabel: 'Local de Trabalho' },
      { key: 'status', defaultLabel: 'Status' },
      { key: 'acoes', defaultLabel: 'Ações' },
    ],
  },
  {
    tableKey: 'frota_resumo_empresa',
    label: 'Frota — Resumo por Empresa',
    columns: [
      { key: 'empresa', defaultLabel: 'EMPRESA' },
      { key: 'equipamentos', defaultLabel: 'EQUIP.' },
      { key: 'caminhoes', defaultLabel: 'CAM.' },
      { key: 'reboques', defaultLabel: 'REB.' },
      { key: 'pipas', defaultLabel: 'PIPAS' },
      { key: 'total', defaultLabel: 'TOTAL' },
    ],
  },
];

function TableConfigCard({ tableKey, label, columns }: { tableKey: string; label: string; columns: ColumnDefinition[] }) {
  const { configs, saveConfigs } = useColumnConfig(tableKey, columns);
  const { rules, saveRules } = useConditionalFormat(tableKey);
  const [open, setOpen] = useState(false);
  const [cfOpen, setCfOpen] = useState(false);

  const customized = configs.filter(c => c.custom_label || !c.visible).length;

  return (
    <>
      <Card className="hover:shadow-md transition-shadow group">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors cursor-pointer" onClick={() => setOpen(true)}>
            <Table2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpen(true)}>
            <h3 className="font-semibold text-sm">{label}</h3>
            <p className="text-xs text-muted-foreground">
              {columns.length} colunas • {customized > 0 ? `${customized} personalizada(s)` : 'Padrão'}
              {rules.length > 0 ? ` • ${rules.length} regra(s) condicional` : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" title="Formatação Condicional" onClick={() => setCfOpen(true)}>
            <Paintbrush className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setOpen(true)}>
            <Settings2 className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      <ColumnConfigModal
        open={open}
        onOpenChange={setOpen}
        tableLabel={label}
        defaultColumns={columns}
        currentConfigs={configs}
        onSave={saveConfigs}
      />

      <ConditionalFormatModal
        open={cfOpen}
        onOpenChange={setCfOpen}
        tableKey={tableKey}
        tableLabel={label}
        columns={columns}
        currentRules={rules}
        onSave={saveRules}
      />
    </>
  );
}

export default function ConfiguracaoColunas() {
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';

  if (!isMainAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-primary" />
          Configuração de Colunas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie títulos, visibilidade e ordem das colunas de todas as tabelas do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TABLE_DEFINITIONS.map((def) => (
          <TableConfigCard key={def.tableKey} {...def} />
        ))}
      </div>
    </div>
  );
}
