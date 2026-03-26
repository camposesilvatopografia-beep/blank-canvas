import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { usePageLayout, BlockDefinition } from '@/hooks/usePageLayout';
import { PageLayoutConfigModal } from '@/components/crud/PageLayoutConfigModal';

// All page layout definitions — covers every page/tab in the system
const PAGE_DEFINITIONS: { pageKey: string; label: string; category: string; blocks: BlockDefinition[] }[] = [
  // ===== DASHBOARD =====
  {
    pageKey: 'dashboard_carga',
    label: 'Dashboard — Produção',
    category: 'Dashboard',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Indicadores Diários' },
      { key: 'charts_caminhoes_escavadeiras', defaultLabel: 'Gráficos Top 10 (Caminhões/Escavadeiras)' },
      { key: 'material_distribution', defaultLabel: 'Materiais + Pluviometria + Atividades' },
      { key: 'period_stats', defaultLabel: 'Produção do Mês (Gráfico)' },
      { key: 'monthly_consolidation', defaultLabel: 'Consolidado Geral do Período' },
    ],
  },
  {
    pageKey: 'dashboard_cal',
    label: 'Dashboard — CAL',
    category: 'Dashboard',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo CAL' },
      { key: 'charts', defaultLabel: 'Gráficos de Estoque/Movimentação' },
      { key: 'table', defaultLabel: 'Tabela de Resumo' },
    ],
  },
  {
    pageKey: 'dashboard_pedreira',
    label: 'Dashboard — Pedreira',
    category: 'Dashboard',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo Pedreira' },
      { key: 'charts', defaultLabel: 'Gráficos de Produção' },
      { key: 'table', defaultLabel: 'Tabela de Resumo' },
    ],
  },
  {
    pageKey: 'dashboard_pipas',
    label: 'Dashboard — Pipas',
    category: 'Dashboard',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo Pipas' },
      { key: 'charts', defaultLabel: 'Gráficos de Distribuição' },
      { key: 'table', defaultLabel: 'Tabela de Resumo' },
    ],
  },
  {
    pageKey: 'dashboard_abastecimento',
    label: 'Dashboard — Abastecimento',
    category: 'Dashboard',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
      { key: 'charts', defaultLabel: 'Gráficos de Consumo' },
      { key: 'table', defaultLabel: 'Tabela de Abastecimentos' },
    ],
  },
  {
    pageKey: 'dashboard_frota_geral',
    label: 'Dashboard — Frota Geral',
    category: 'Dashboard',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
      { key: 'charts', defaultLabel: 'Gráficos de Frota' },
      { key: 'table', defaultLabel: 'Tabela de Equipamentos' },
    ],
  },
  {
    pageKey: 'dashboard_consolidado',
    label: 'Dashboard — Consolidado',
    category: 'Dashboard',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'period_selector', defaultLabel: 'Seletor de Período' },
      { key: 'summary_table', defaultLabel: 'Tabela Consolidada' },
      { key: 'charts', defaultLabel: 'Gráficos Consolidados' },
    ],
  },

  // ===== OPERAÇÃO =====
  {
    pageKey: 'operacao_carga',
    label: 'Operação — Carga',
    category: 'Operação',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'date_filter', defaultLabel: 'Filtro de Data' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
      { key: 'tabs_escavadeiras', defaultLabel: 'Aba Escavadeiras' },
      { key: 'tabs_caminhoes', defaultLabel: 'Aba Caminhões' },
      { key: 'tabs_locais', defaultLabel: 'Aba Locais' },
      { key: 'tabs_monitoramento', defaultLabel: 'Aba Monitoramento' },
      { key: 'reports', defaultLabel: 'Relatórios' },
    ],
  },
  {
    pageKey: 'operacao_descarga',
    label: 'Operação — Lançamento',
    category: 'Operação',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'date_filter', defaultLabel: 'Filtro de Data' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo por Local' },
      { key: 'table', defaultLabel: 'Tabela de Registros' },
      { key: 'batch_actions', defaultLabel: 'Ações em Lote' },
      { key: 'reports', defaultLabel: 'Relatórios' },
    ],
  },
  {
    pageKey: 'operacao_pedreira',
    label: 'Operação — Pedreira',
    category: 'Operação',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
      { key: 'date_filter', defaultLabel: 'Filtro de Data' },
      { key: 'table', defaultLabel: 'Tabela de Registros' },
      { key: 'reports_tabs', defaultLabel: 'Abas de Relatórios' },
      { key: 'ciclos_pendentes', defaultLabel: 'Ciclos Pendentes' },
    ],
  },
  {
    pageKey: 'operacao_pipas',
    label: 'Operação — Pipas',
    category: 'Operação',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
      { key: 'date_filter', defaultLabel: 'Filtro de Data' },
      { key: 'table', defaultLabel: 'Tabela de Registros' },
      { key: 'reports', defaultLabel: 'Relatórios' },
    ],
  },
  {
    pageKey: 'operacao_cal',
    label: 'Operação — CAL',
    category: 'Operação',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo (Entradas/Saídas/Saldo)' },
      { key: 'date_filter', defaultLabel: 'Filtro de Data' },
      { key: 'tipo_filter', defaultLabel: 'Filtro de Tipo (Entrada/Saída)' },
      { key: 'table', defaultLabel: 'Tabela de Movimentações' },
      { key: 'reports', defaultLabel: 'Relatórios e Exportações' },
    ],
  },
  {
    pageKey: 'operacao_pluviometria',
    label: 'Operação — Pluviometria',
    category: 'Operação',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
      { key: 'month_selector', defaultLabel: 'Seletor de Mês/Ano' },
      { key: 'table', defaultLabel: 'Tabela de Registros Diários' },
      { key: 'charts', defaultLabel: 'Gráficos de Precipitação' },
      { key: 'annual_summary', defaultLabel: 'Resumo Anual' },
      { key: 'pdf_export', defaultLabel: 'Exportação PDF' },
    ],
  },

  // ===== ENGENHARIA =====
  {
    pageKey: 'engenharia_rdo',
    label: 'Engenharia — RDO',
    category: 'Engenharia',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'obra_selector', defaultLabel: 'Seletor de Obra' },
      { key: 'filters', defaultLabel: 'Filtros (Data/Status/Busca)' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
      { key: 'rdo_list', defaultLabel: 'Lista de RDOs' },
      { key: 'approval_panel', defaultLabel: 'Painel de Aprovações' },
    ],
  },

  // ===== FROTA =====
  {
    pageKey: 'frota',
    label: 'Frota Geral',
    category: 'Frota',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'summary_table', defaultLabel: 'Resumo por Empresa' },
      { key: 'equipamentos_tab', defaultLabel: 'Aba Equipamentos' },
      { key: 'caminhoes_tab', defaultLabel: 'Aba Caminhões' },
      { key: 'reboques_tab', defaultLabel: 'Aba Reboques' },
      { key: 'pipas_tab', defaultLabel: 'Aba Pipas' },
    ],
  },
  {
    pageKey: 'historico_veiculos',
    label: 'Histórico de Veículos',
    category: 'Frota',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'vehicle_selector', defaultLabel: 'Seletor de Veículo' },
      { key: 'period_filter', defaultLabel: 'Filtro de Período' },
      { key: 'horimetro_chart', defaultLabel: 'Gráfico de Horímetro' },
      { key: 'history_table', defaultLabel: 'Tabela de Histórico' },
    ],
  },

  // ===== ALERTAS =====
  {
    pageKey: 'alertas',
    label: 'Alertas',
    category: 'Sistema',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'stats_cards', defaultLabel: 'Cards de Resumo de Alertas' },
      { key: 'config_panel', defaultLabel: 'Configurações de Alertas' },
      { key: 'alerts_list', defaultLabel: 'Lista de Alertas' },
      { key: 'whatsapp_config', defaultLabel: 'Configuração WhatsApp' },
    ],
  },

  // ===== ALMOXARIFADO =====
  {
    pageKey: 'almoxarifado',
    label: 'Almoxarifado',
    category: 'Almoxarifado',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'dashboard', defaultLabel: 'Dashboard/Resumo' },
      { key: 'materiais_tab', defaultLabel: 'Aba Materiais' },
      { key: 'entradas_tab', defaultLabel: 'Aba Entradas' },
      { key: 'saidas_tab', defaultLabel: 'Aba Saídas' },
      { key: 'movimentacoes_tab', defaultLabel: 'Aba Movimentações' },
      { key: 'inventario_tab', defaultLabel: 'Aba Inventário' },
      { key: 'relatorios_tab', defaultLabel: 'Aba Relatórios' },
    ],
  },

  // ===== CADASTROS =====
  {
    pageKey: 'cadastros_obra',
    label: 'Cadastros — Dados da Obra',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'obra_info', defaultLabel: 'Informações da Obra' },
      { key: 'logo_config', defaultLabel: 'Configuração de Logo' },
    ],
  },
  {
    pageKey: 'cadastros_apontadores',
    label: 'Cadastros — Apontadores',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'search_filter', defaultLabel: 'Busca e Filtros' },
      { key: 'table', defaultLabel: 'Tabela de Apontadores' },
    ],
  },
  {
    pageKey: 'cadastros_usuarios',
    label: 'Cadastros — Usuários',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'allowed_emails', defaultLabel: 'E-mails Permitidos' },
      { key: 'search_filter', defaultLabel: 'Busca e Filtros' },
      { key: 'table', defaultLabel: 'Tabela de Usuários' },
    ],
  },
  {
    pageKey: 'cadastros_locais',
    label: 'Cadastros — Locais',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'search_filter', defaultLabel: 'Busca e Filtros' },
      { key: 'table', defaultLabel: 'Tabela de Locais' },
      { key: 'map', defaultLabel: 'Mapa de Locais' },
    ],
  },
  {
    pageKey: 'cadastros_materiais',
    label: 'Cadastros — Materiais',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'search_filter', defaultLabel: 'Busca e Filtros' },
      { key: 'table', defaultLabel: 'Tabela de Materiais' },
    ],
  },
  {
    pageKey: 'cadastros_equipamentos',
    label: 'Cadastros — Equipamentos',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'search_filter', defaultLabel: 'Busca e Filtros' },
      { key: 'table', defaultLabel: 'Tabela de Equipamentos' },
    ],
  },
  {
    pageKey: 'cadastros_fornecedores_cal',
    label: 'Cadastros — Fornecedores CAL',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'search_filter', defaultLabel: 'Busca e Filtros' },
      { key: 'table', defaultLabel: 'Tabela de Fornecedores' },
    ],
  },
  {
    pageKey: 'cadastros_fornecedores_pedreira',
    label: 'Cadastros — Fornecedores Pedreira',
    category: 'Cadastros',
    blocks: [
      { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
      { key: 'search_filter', defaultLabel: 'Busca e Filtros' },
      { key: 'table', defaultLabel: 'Tabela de Fornecedores' },
    ],
  },
];

// Group by category
const CATEGORIES = [...new Set(PAGE_DEFINITIONS.map(d => d.category))];

function PageLayoutCard({ pageKey, label, blocks }: { pageKey: string; label: string; blocks: BlockDefinition[] }) {
  const { configs, saveConfigs } = usePageLayout(pageKey, blocks);
  const [open, setOpen] = useState(false);

  const customized = configs.filter(c => !c.visible).length;
  const reordered = configs.some((c, i) => c.block_order !== i);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setOpen(true)}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <LayoutGrid className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{label}</h3>
            <p className="text-xs text-muted-foreground">
              {blocks.length} seções • {customized > 0 ? `${customized} oculta(s)` : reordered ? 'Reordenado' : 'Padrão'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
            <LayoutGrid className="w-3.5 h-3.5" />
          </Button>
        </CardContent>
      </Card>

      <PageLayoutConfigModal
        open={open}
        onOpenChange={setOpen}
        pageLabel={label}
        defaultBlocks={blocks}
        currentConfigs={configs}
        onSave={saveConfigs}
      />
    </>
  );
}

export default function ConfiguracaoLayout() {
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';

  if (!isMainAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutGrid className="w-6 h-6 text-primary" />
          Configuração de Layout
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie a ordem e visibilidade dos blocos/seções de cada página do sistema. ({PAGE_DEFINITIONS.length} páginas configuráveis)
        </p>
      </div>

      {CATEGORIES.map(category => {
        const pages = PAGE_DEFINITIONS.filter(d => d.category === category);
        return (
          <div key={category} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground border-b pb-1">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pages.map((def) => (
                <PageLayoutCard key={def.pageKey} pageKey={def.pageKey} label={def.label} blocks={def.blocks} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
