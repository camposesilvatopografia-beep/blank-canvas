
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Papa from "papaparse";
import { Loader2, Trash2, Download, AlertCircle, CheckCircle2 } from "lucide-react";

interface TableConfig {
  id: string;
  name: string;
  sheetName: string;
  columns: string[];
  upsertKey: string | string[];
}

const TABLES_CONFIG: TableConfig[] = [
  {
    id: "apontamentos_carga",
    name: "Apontamentos Carga",
    sheetName: "Carga",
    columns: ["data", "hora", "prefixo_escavadeira", "descricao_escavadeira", "empresa_escavadeira", "operador", "prefixo_caminhao", "descricao_caminhao", "empresa_caminhao", "motorista", "local", "estaca", "material", "quantidade", "viagens", "volume_total", "status"],
    upsertKey: ["data", "hora", "prefixo_escavadeira", "prefixo_caminhao"]
  },
  {
    id: "alm_materiais",
    name: "Materiais Almoxarifado",
    sheetName: "Materiais",
    columns: ["codigo", "nome", "categoria", "unidade", "estoque_minimo", "estoque_atual", "observacoes", "status"],
    upsertKey: "codigo"
  },
  {
    id: "alm_movimentacoes",
    name: "Movimentações Almoxarifado",
    sheetName: "Movimentacoes",
    columns: ["tipo", "data", "material_id", "quantidade", "saldo_apos", "fornecedor", "nota_fiscal", "responsavel", "local_armazenamento", "equipe", "etapa_obra", "local_uso", "numero_requisicao", "observacoes", "preco_unitario", "preco_total"],
    upsertKey: "id"
  },
  {
    id: "locais",
    name: "Locais",
    sheetName: "Locais",
    columns: ["tipo", "nome", "obra", "status"],
    upsertKey: "nome"
  },
  {
    id: "materiais",
    name: "Materiais Carga",
    sheetName: "Materiais_Carga",
    columns: ["nome", "status"],
    upsertKey: "nome"
  },
  {
    id: "empresas",
    name: "Empresas",
    sheetName: "Empresas",
    columns: ["nome", "status"],
    upsertKey: "nome"
  },
  {
    id: "fornecedores_cal",
    name: "Fornecedores Cal",
    sheetName: "Fornecedores_Cal",
    columns: ["nome", "cnpj", "contato", "status"],
    upsertKey: "nome"
  },
  {
    id: "fornecedores_pedreira",
    name: "Fornecedores Pedreira",
    sheetName: "Fornecedores_Pedreira",
    columns: ["nome", "cnpj", "contato", "status"],
    upsertKey: "nome"
  },
  {
    id: "materiais_pedreira",
    name: "Materiais Pedreira",
    sheetName: "Materiais_Pedreira",
    columns: ["nome", "status"],
    upsertKey: "nome"
  },
  {
    id: "rdo_obras",
    name: "Obras RDO",
    sheetName: "RDO_Obras",
    columns: ["nome", "contrato", "cliente", "responsavel", "status", "data_inicio_contrato", "data_prazo_contratual", "prazo_contratual_dias", "aprovador1_nome", "aprovador1_email", "aprovador1_whatsapp", "aprovador1_cargo", "aprovador2_nome", "aprovador2_email", "aprovador2_whatsapp", "aprovador2_cargo", "aprovador3_nome", "aprovador3_email", "aprovador3_whatsapp", "aprovador3_cargo"],
    upsertKey: "nome"
  },
  {
    id: "rdos",
    name: "RDOs",
    sheetName: "RDOs",
    columns: ["obra_id", "data", "numero_rdo", "clima_manha", "clima_tarde", "temperatura_manha", "temperatura_tarde", "precipitacao_dia", "condicao_tempo", "observacoes", "status"],
    upsertKey: ["obra_id", "data"]
  }
];

const ImportacaoSheets = () => {
  const { isAdmin } = useAuth();
  const [sheetUrl, setSheetUrl] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>(TABLES_CONFIG.map(t => t.id));
  const [isImporting, setIsImporting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ processed: number, total: number, errors: number } | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <p className="text-muted-foreground">Acesso negado. Esta página é restrita a administradores.</p>
      </div>
    );
  }

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const parseNumber = (value: any) => {
    if (typeof value === "string") {
      const cleaned = value.replace(",", ".");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return typeof value === "number" ? value : null;
  };

  const formatDate = (value: any) => {
    if (!value) return null;
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch (e) {
      return value;
    }
    return value;
  };

  const processRow = (row: any, config: TableConfig) => {
    const processed: any = {};
    let hasRequiredFields = true;

    config.columns.forEach(col => {
      let val = row[col];
      
      if (col.includes("data")) {
        val = formatDate(val);
      } else if (["quantidade", "volume_total", "viagens", "estoque_minimo", "estoque_atual", "saldo_apos", "preco_unitario", "preco_total", "temperatura_manha", "temperatura_tarde", "precipitacao_dia", "prazo_contratual_dias"].includes(col)) {
        val = parseNumber(val);
      }

      processed[col] = val;

      const isKey = Array.isArray(config.upsertKey) ? config.upsertKey.includes(col) : config.upsertKey === col;
      if (isKey && (val === null || val === undefined || val === "")) {
        hasRequiredFields = false;
      }
    });

    return hasRequiredFields ? processed : null;
  };

  const importTable = async (config: TableConfig, sheetId: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(config.sheetName)}`;
    
    addLog(`Iniciando importação da tabela ${config.name}...`);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erro ao buscar dados: ${response.statusText}`);
      
      const csvText = await response.text();
      const { data, errors } = Papa.parse(csvText, { header: true, skipEmptyLines: true });

      if (errors.length > 0) {
        addLog(`⚠️ Avisos no parse CSV para ${config.name}: ${errors.length} erros detectados.`);
      }

      const processedData = data
        .map((row: any) => processRow(row, config))
        .filter(row => row !== null);

      if (processedData.length === 0) {
        addLog(`❌ Nenhum dado válido encontrado para ${config.name}.`);
        return 0;
      }

      addLog(`Importando ${processedData.length} registros para ${config.name}...`);

      const batchSize = 100;
      let count = 0;
      let tableErrors = 0;

      for (let i = 0; i < processedData.length; i += batchSize) {
        const batch = processedData.slice(i, i + batchSize);
        const onConflictColumns = Array.isArray(config.upsertKey) ? config.upsertKey.join(",") : config.upsertKey;
        
        const { error } = await supabase
          .from(config.id as any)
          .upsert(batch, { onConflict: onConflictColumns });

        if (error) {
          console.error(`Erro no upsert (${config.id}):`, error);
          addLog(`❌ Erro no lote ${Math.floor(i/batchSize) + 1} de ${config.name}: ${error.message}`);
          tableErrors += batch.length;
        } else {
          count += batch.length;
          if (processedData.length > batchSize) {
            addLog(`... ${count}/${processedData.length} registros importados`);
          }
        }
      }

      addLog(`✅ ${config.name}: ${count} registros importados / ${tableErrors} erros.`);
      return count;
    } catch (error: any) {
      addLog(`❌ Erro crítico em ${config.name}: ${error.message}`);
      return -1;
    }
  };

  const handleImport = async () => {
    if (!sheetUrl) {
      toast.error("Por favor, cole a URL da planilha.");
      return;
    }

    const sheetIdMatch = sheetUrl.match(/[-\w]{25,}/);
    if (!sheetIdMatch) {
      toast.error("URL da planilha inválida.");
      return;
    }

    const sheetId = sheetIdMatch[0];
    setIsImporting(true);
    setLogs([]);
    setSummary(null);
    
    let totalImported = 0;
    let tablesProcessed = 0;
    let totalErrors = 0;

    const tablesToImport = TABLES_CONFIG.filter(t => selectedTables.includes(t.id));

    for (const config of tablesToImport) {
      const result = await importTable(config, sheetId);
      if (result >= 0) {
        totalImported += result;
        tablesProcessed++;
      } else {
        totalErrors++;
      }
    }

    setSummary({ processed: tablesProcessed, total: totalImported, errors: totalErrors });
    setIsImporting(false);
    toast.success("Processo de importação concluído!");
  };

  const toggleTable = (id: string) => {
    setSelectedTables(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importação de Tabelas</h1>
          <p className="text-muted-foreground">Popule o banco de dados importando tabelas de dados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração</CardTitle>
              <CardDescription>Configure a origem e destino dos dados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sheetUrl">URL da Planilha</Label>
                <Input 
                  id="sheetUrl" 
                  placeholder="URL da Planilha..." 
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  disabled={isImporting}
                />
                <p className="text-[10px] text-muted-foreground">vou criar copia da plainilha para nao impactar no projeto original, pois a planilha é a mes,a e esse agora, deve alimentar uma copia</p>
              </div>

              <div className="space-y-3">
                <Label>Tabelas para Importar</Label>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {TABLES_CONFIG.map((table) => (
                      <div key={table.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={table.id} 
                          checked={selectedTables.includes(table.id)}
                          onCheckedChange={() => toggleTable(table.id)}
                          disabled={isImporting}
                        />
                        <Label htmlFor={table.id} className="text-sm cursor-pointer">{table.name}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Button 
                className="w-full" 
                onClick={handleImport} 
                disabled={isImporting || !sheetUrl}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Importar Agora
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {summary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                  Resumo Final
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>Tabelas processadas: <span className="font-bold">{summary.processed}</span></p>
                <p>Registros inseridos: <span className="font-bold">{summary.total}</span></p>
                {summary.errors > 0 && (
                  <p className="text-destructive flex items-center">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Tabelas com erro: <span className="font-bold ml-1">{summary.errors}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Log de Processamento</CardTitle>
                <CardDescription>Acompanhe o progresso em tempo real.</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLogs([])}
                disabled={logs.length === 0 || isImporting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Log
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-[500px] lg:h-[600px] border-t">
                <div className="p-4 font-mono text-xs space-y-1">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground italic">Aguardando início do processo...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className={log.includes("❌") ? "text-destructive" : log.includes("✅") ? "text-green-600 dark:text-green-400" : ""}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ImportacaoSheets;
