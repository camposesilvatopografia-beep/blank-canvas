import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPREADSHEET_ID = '1BP-YmGfi9-kBnc_Gi0JpDHEaTm4_W7FpVRd6pqFhqdE';

// Brazil timezone helper
function getBrazilNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function fmtDDMMYYYY(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Detect date intent from query — returns target date strings for row filtering
function detectDateFilter(query: string): { dates: string[]; label: string } | null {
  const lq = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const brazil = getBrazilNow();

  if (/\b(hoje|today|atual|momento|agora)\b/.test(lq)) {
    return { dates: [fmtDDMMYYYY(brazil), fmtISO(brazil)], label: `HOJE ${fmtDDMMYYYY(brazil)}` };
  }
  if (/\b(ontem|yesterday)\b/.test(lq)) {
    const d = new Date(brazil); d.setDate(d.getDate() - 1);
    return { dates: [fmtDDMMYYYY(d), fmtISO(d)], label: `ONTEM ${fmtDDMMYYYY(d)}` };
  }
  if (/anteontem|antes de ontem/.test(lq)) {
    const d = new Date(brazil); d.setDate(d.getDate() - 2);
    return { dates: [fmtDDMMYYYY(d), fmtISO(d)], label: `ANTEONTEM ${fmtDDMMYYYY(d)}` };
  }
  if (/esta semana|semana atual|essa semana/.test(lq)) {
    const dates: string[] = [];
    const dow = brazil.getDay();
    const mon = new Date(brazil); mon.setDate(brazil.getDate() - (dow === 0 ? 6 : dow - 1));
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      dates.push(fmtDDMMYYYY(d), fmtISO(d));
    }
    return { dates, label: 'ESTA SEMANA' };
  }
  // Specific date dd/mm or dd/mm/yyyy
  const m = lq.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) {
    const dd = m[1].padStart(2,'0'), mm = m[2].padStart(2,'0'), yy = m[3] || String(brazil.getFullYear());
    return { dates: [`${dd}/${mm}/${yy}`, `${yy}-${mm}-${dd}`], label: `DIA ${dd}/${mm}/${yy}` };
  }
  return null;
}

// Normalize text for comparison (remove accents, lowercase)
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function queryDatabase(supabaseAdmin: any, query: string): Promise<string> {
  const context: string[] = [];
  const lq = norm(query);
  const brazil = getBrazilNow();
  const todayISO = fmtISO(brazil);
  const yesterdayDate = new Date(brazil); yesterdayDate.setDate(brazil.getDate() - 1);
  const yesterdayISO = fmtISO(yesterdayDate);
  const weekAgo = new Date(brazil); weekAgo.setDate(brazil.getDate() - 7);
  const weekAgoISO = fmtISO(weekAgo);

  // ── ALWAYS FETCH: Core summaries (runs on every query) ──
  const [matRes, movTodayRes, movWeekRes, lowStockRes, userRes, rdoRes, localRes, obraRes] = await Promise.all([
    supabaseAdmin.from('alm_materiais').select('id, nome, codigo, categoria, unidade, estoque_atual, estoque_minimo, status').order('nome'),
    supabaseAdmin.from('alm_movimentacoes').select('tipo, data, quantidade, saldo_apos, fornecedor, responsavel, local_uso, equipe, etapa_obra, numero_requisicao, observacoes, material_id').eq('data', todayISO).order('created_at', { ascending: false }),
    supabaseAdmin.from('alm_movimentacoes').select('tipo, data, quantidade, saldo_apos, fornecedor, responsavel, local_uso, material_id').gte('data', weekAgoISO).order('data', { ascending: false }).limit(200),
    supabaseAdmin.from('alm_materiais').select('nome, codigo, estoque_atual, estoque_minimo, unidade').filter('status', 'eq', 'Ativo'),
    supabaseAdmin.from('profiles').select('nome, email, tipo, status, usuario').order('nome'),
    supabaseAdmin.from('rdos').select('numero_rdo, data, status, observacoes, clima_manha, clima_tarde, obra_id').order('data', { ascending: false }).limit(30),
    supabaseAdmin.from('locais').select('nome, tipo, obra, status').order('nome'),
    supabaseAdmin.from('obra_config').select('nome, local').limit(5),
  ]);

  // Summaries
  const materiais = matRes.data || [];
  const movToday = movTodayRes.data || [];
  const movWeek = movWeekRes.data || [];
  const users = userRes.data || [];
  const rdos = rdoRes.data || [];
  const locais = localRes.data || [];
  const obra = obraRes.data || [];

  if (obra.length) context.push(`OBRA: ${JSON.stringify(obra)}`);

  // Counts summary
  const activeUsers = users.filter((u: any) => u.status === 'ativo');
  context.push(`RESUMO GERAL: ${materiais.length} materiais cadastrados, ${users.length} usuários (${activeUsers.length} ativos), ${rdos.length} últimos RDOs, ${locais.length} locais`);

  // Low stock alert — always show
  const lowStock = (lowStockRes.data || []).filter((m: any) => m.estoque_atual <= m.estoque_minimo && m.estoque_minimo > 0);
  if (lowStock.length) {
    context.push(`⚠️ MATERIAIS ESTOQUE BAIXO (${lowStock.length}): ${JSON.stringify(lowStock)}`);
  }

  // Today movements
  if (movToday.length) {
    // Enrich with material names
    const matMap: Record<string, string> = {};
    materiais.forEach((m: any) => { matMap[m.id] = `${m.nome} (${m.codigo})`; });
    const enriched = movToday.map((m: any) => ({ ...m, material_nome: matMap[m.material_id] || m.material_id }));
    const entradas = enriched.filter((m: any) => m.tipo === 'entrada');
    const saidas = enriched.filter((m: any) => m.tipo === 'saida');
    context.push(`MOVIMENTAÇÕES HOJE (${movToday.length}): ${entradas.length} entradas, ${saidas.length} saídas\n${JSON.stringify(enriched)}`);
  } else {
    context.push(`MOVIMENTAÇÕES HOJE: 0 registros`);
  }

  // Week movements summary
  if (movWeek.length) {
    const byDay: Record<string, number> = {};
    movWeek.forEach((m: any) => { byDay[m.data] = (byDay[m.data] || 0) + 1; });
    context.push(`MOVIMENTAÇÕES SEMANA (${movWeek.length} total): ${JSON.stringify(byDay)}`);
  }

  // All materials with stock
  context.push(`MATERIAIS COMPLETO: ${JSON.stringify(materiais)}`);

  // Users
  context.push(`USUÁRIOS (${users.length}): ${JSON.stringify(users)}`);

  // Locais
  context.push(`LOCAIS (${locais.length}): ${JSON.stringify(locais)}`);

  // RDOs
  if (rdos.length) context.push(`ÚLTIMOS RDOs (${rdos.length}): ${JSON.stringify(rdos)}`);

  // ── CONDITIONAL: Extra detail based on keywords ──
  const fetches: Promise<void>[] = [];

  if (lq.match(/fornecedor|compra|pedido/)) {
    fetches.push(Promise.all([
      supabaseAdmin.from('alm_fornecedores').select('nome, cnpj, contato, status, telefone, email').limit(50),
      supabaseAdmin.from('fornecedores_pedreira').select('nome, cnpj, contato, status').limit(50),
      supabaseAdmin.from('fornecedores_cal').select('nome, cnpj, contato, status').limit(50),
    ]).then(([alm, ped, cal]: any[]) => {
      if (alm.data?.length) context.push(`FORNECEDORES ALMOX: ${JSON.stringify(alm.data)}`);
      if (ped.data?.length) context.push(`FORNECEDORES PEDREIRA: ${JSON.stringify(ped.data)}`);
      if (cal.data?.length) context.push(`FORNECEDORES CAL: ${JSON.stringify(cal.data)}`);
    }));
  }

  if (lq.match(/empresa|empreiteira/)) {
    fetches.push(supabaseAdmin.from('empresas').select('nome, cnpj, contato, status').limit(50).then(({ data }: any) => {
      if (data?.length) context.push(`EMPRESAS (${data.length}): ${JSON.stringify(data)}`);
    }));
  }

  if (lq.match(/pedreira|brita|rachao|po de pedra/)) {
    fetches.push(supabaseAdmin.from('materiais_pedreira').select('nome, status').limit(50).then(({ data }: any) => {
      if (data?.length) context.push(`MATERIAIS PEDREIRA: ${JSON.stringify(data)}`);
    }));
  }

  if (lq.match(/material|carga|descarga/)) {
    fetches.push(supabaseAdmin.from('materiais').select('nome, unidade, status').limit(50).then(({ data }: any) => {
      if (data?.length) context.push(`MATERIAIS CARGA/DESCARGA: ${JSON.stringify(data)}`);
    }));
  }

  if (lq.match(/obra|contrato|cliente|engenharia/)) {
    fetches.push(supabaseAdmin.from('rdo_obras').select('nome, contrato, cliente, responsavel, status').limit(30).then(({ data }: any) => {
      if (data?.length) context.push(`OBRAS ENGENHARIA (${data.length}): ${JSON.stringify(data)}`);
    }));
  }

  if (lq.match(/pedido|compra|falta/)) {
    fetches.push(supabaseAdmin.from('pedidos_compra_pedreira').select('fornecedor, material, quantidade_pedido, observacoes, created_at').order('created_at', { ascending: false }).limit(20).then(({ data }: any) => {
      if (data?.length) context.push(`PEDIDOS COMPRA: ${JSON.stringify(data)}`);
    }));
  }

  if (lq.match(/setor|equipe/)) {
    fetches.push(Promise.all([
      supabaseAdmin.from('alm_locais_uso').select('nome, descricao, status').limit(50),
      supabaseAdmin.from('alm_setores').select('nome, responsavel, status').limit(50),
    ]).then(([locaisUso, setores]: any[]) => {
      if (locaisUso.data?.length) context.push(`LOCAIS DE USO: ${JSON.stringify(locaisUso.data)}`);
      if (setores.data?.length) context.push(`SETORES: ${JSON.stringify(setores.data)}`);
    }));
  }

  await Promise.all(fetches);
  return context.join('\n\n');
}

async function getGoogleAccessToken(): Promise<string | null> {
  const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) return null;

  const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const pemContent = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${header}.${claimSet}`));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${header}.${claimSet}.${signatureB64}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const { access_token } = await tokenResp.json();
  return access_token || null;
}

// All available sheets
const ALL_SHEETS: Record<string, string[]> = {
  'Carga': ['carga', 'carregamento', 'viagem', 'transporte', 'caminhao', 'producao', 'volume', 'escavadeira'],
  'Descarga': ['descarga', 'descarregamento', 'lancamento'],
  'Apontamento_Pedreira': ['pedreira', 'britagem', 'brita', 'rachao'],
  'Apontamento_Pipa': ['pipa', 'agua', 'irrigacao'],
  'Mov_Cal': ['cal', 'calcario'],
  'Abastecimentos': ['abastecimento', 'combustivel', 'diesel', 'gasolina', 'litro'],
  'Horimetros': ['horimetro', 'hora maquina', 'horas'],
  'Manutenções': ['manutencao', 'manutencoes', 'parado', 'parada', 'oficina', 'conserto', 'reparo', 'problema', 'defeito', 'quebrado'],
  'Frota Geral': ['frota', 'veiculo', 'equipamento', 'maquina', 'prefixo'],
  'Pluviometria': ['pluvio', 'chuva', 'precipitacao'],
  'Caminhões Areia Express': ['areia', 'express'],
  'Mobilização': ['mobilizacao', 'desmobilizacao'],
};

async function queryGoogleSheets(query: string): Promise<string> {
  const lq = norm(query);
  const context: string[] = [];

  const access_token = await getGoogleAccessToken();
  if (!access_token) return '';

  // Determine which sheets to query
  const matched: string[] = [];
  for (const [sheet, keywords] of Object.entries(ALL_SHEETS)) {
    if (keywords.some(kw => lq.includes(kw))) {
      matched.push(sheet);
    }
  }
  // If no keyword match, query all sheets
  const selectedSheets = matched.length > 0 ? matched : Object.keys(ALL_SHEETS);

  const dateFilter = detectDateFilter(query);

  const fetchSheet = async (sheet: string) => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheet)}?majorDimension=ROWS`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
      if (!resp.ok) return;
      const data = await resp.json();
      const rows = data.values || [];
      if (rows.length < 2) return;

      const headers: string[] = rows[0];
      const totalRows = rows.length - 1;

      const dateColIdx = headers.findIndex((h: string) => {
        const n = norm(h);
        return n === 'data' || n === 'date' || n === 'dia' || n.startsWith('data');
      });

      let dataRows: string[][];

      if (dateColIdx >= 0 && dateFilter) {
        // Filter rows matching any of the target dates
        const targetDates = new Set(dateFilter.dates);
        dataRows = rows.slice(1).filter((row: string[]) => {
          const cell = (row[dateColIdx] || '').trim();
          return targetDates.has(cell);
        });
      } else if (dateColIdx >= 0) {
        // No specific date filter — last 200 rows
        dataRows = rows.slice(Math.max(1, rows.length - 200));
      } else {
        dataRows = rows.slice(1);
      }

      if (dataRows.length === 0) {
        const lbl = dateFilter ? dateFilter.label : 'período';
        context.push(`"${sheet}": ${totalRows} registros total, 0 para ${lbl}`);
        return;
      }

      const records = dataRows.map((row: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { if (row[i]) obj[h] = row[i]; });
        return obj;
      });

      // Cap at 500 records to avoid token overflow
      const capped = records.length > 500 ? records.slice(-500) : records;
      const label = dateFilter
        ? `"${sheet}" ${dateFilter.label}: ${records.length} registros (${totalRows} total)`
        : `"${sheet}": ${records.length} registros`;
      context.push(`${label}\nColunas: ${headers.join(', ')}\n${JSON.stringify(capped)}`);
    } catch (e) {
      console.error(`Error reading sheet ${sheet}:`, e);
    }
  };

  await Promise.all(selectedSheets.map(fetchSheet));
  return context.join('\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages } = await req.json();
    const lastUserMessage = messages?.filter((m: any) => m.role === 'user').pop()?.content || '';

    const [dbContext, sheetsContext] = await Promise.all([
      queryDatabase(supabaseAdmin, lastUserMessage),
      queryGoogleSheets(lastUserMessage).catch(e => { console.error('Sheets error:', e); return ''; }),
    ]);

    const todayLabel = fmtDDMMYYYY(getBrazilNow());

    const systemPrompt = `Você é o Assistente IA do ApropriaApp — sistema de gestão de obras rodoviárias.
Hoje é ${todayLabel} (horário de Brasília).

DADOS EM TEMPO REAL DO SISTEMA (PRIORIZE ESTES DADOS):

${dbContext ? `## BANCO DE DADOS (FONTE PRINCIPAL — dados mais confiáveis e atualizados)\n${dbContext}` : ''}

${sheetsContext ? `## PLANILHAS OPERACIONAIS (FONTE COMPLEMENTAR — dados de campo como carga, pedreira, pipas, abastecimentos, horímetros, manutenções)\n${sheetsContext}` : ''}

PRIORIDADE DE DADOS: Use PRIMEIRO os dados do BANCO DE DADOS. Use as PLANILHAS apenas para dados operacionais de campo (carga, pedreira, pipas, abastecimento, horímetro, manutenção) que não existem no banco.

## ESTRUTURA COMPLETA DO SISTEMA (Menus e Funcionalidades):

### 📊 DASHBOARD (Página inicial)
Consolidação de dados operacionais em abas:
• **Produção** — cronogramas e produtividade de Carga/Lançamento
• **Abastecimento** — gestão de combustível e manutenções ativas
• **Frota** — status de mobilização de veículos/equipamentos
• **CAL** — movimentações por local/fornecedor
• **Pipas** — controle de viagens de água
• **Pluviometria** — gráficos climáticos e acumulados

### 🔧 OPERAÇÃO (Menu com submenus):
• **Carga** — registro de viagens de carga (caminhões, escavadeiras, volumes)
• **Lançamento/Descarga** — registro de descarregamento nos destinos
• **Pedreira** — apontamento de produção de pedra britada (brita, rachão, pó de pedra)
• **Pipas** — registro de viagens de caminhão-pipa (irrigação, compactação)
• **Cal** — controle de movimentações de calcário (entradas e saídas com peso)
• **Pluviometria** — monitoramento de chuvas em tempo real com previsão 7 dias

### 🏗️ SALA TÉCNICA:
• **Relatórios** — hub com relatórios de Carga, Pedreira, Pipas, Escavadeiras, Medição
• **Relatório Combinado** — consolidação de dados de múltiplas frotas
• **Histórico dos Veículos** — histórico completo por veículo/equipamento
• **Frota Geral da Obra** — gestão operacional da frota
• **Caminhões Areia Express** — controle de caminhões terceirizados

### 🚗 FROTA:
• **Abastecimentos** — registro de abastecimentos (diesel, gasolina, litros)
• **Horímetros** — controle de horas máquina por equipamento
• **Monitoramento** — status em tempo real da frota
• **Histórico Veículo** — linha do tempo por veículo

### 🏛️ ENGENHARIA:
• **RDO** — Relatório Diário de Obra com aprovação digital e assinatura
• **Aprovação RDO** — painel de aprovações com OTP por e-mail
• **Obras RDO** — cadastro de obras com dados contratuais
• **Etapas/Responsáveis RDO** — gerenciar etapas e responsáveis técnicos
• **Medição de Equipamentos** — cálculo por hora trabalhada, horas mínimas e dias úteis
• **Mobilização** — controle de mobilização/desmobilização

### 📦 ALMOXARIFADO:
• **Dashboard** — visão geral do estoque com KPIs
• **Materiais** — cadastro com código, categoria, unidade, estoque mínimo
• **Entradas** — registro com NF, fornecedor, fotos
• **Saídas** — requisições por equipe, local de uso, etapa da obra
• **Movimentações** — histórico completo
• **Inventário** — controle de inventário físico
• **Cadastros** — fornecedores, locais de uso, setores
• **Relatórios** — consumo, posição de estoque

### ⚙️ CADASTROS:
• **Equipamentos** — caminhões, escavadeiras, pipas
• **Locais** — carga, descarga, jazidas, bota-fora
• **Materiais** — materiais de carga/descarga
• **Fornecedores** — fornecedores de pedreira e CAL
• **Usuários** — gestão de usuários e permissões por módulo/submenu/equipamento/local
• **Config Colunas** — personalização visual das tabelas
• **Config Layout** — reordenar e ocultar blocos

### 📱 MOBILE (Apontadores em campo):
• Formulários de Carga, Pedreira, Pipas, CAL, Usina de Solos
• QR Code Scanner para identificação rápida

### 🔔 ALERTAS:
• Sino no cabeçalho — RDOs pendentes e materiais com estoque baixo
• Tela de descanso — ativa após 3 min de inatividade com alertas

## REGRAS — SIGA RIGOROSAMENTE:
1. Português brasileiro SEMPRE
2. Respostas PRÁTICAS e ORGANIZADAS
3. SEMPRE organize dados em listas com bullet points (•) ou tabelas markdown compactas
4. Para quantidades: primeiro o NÚMERO em negrito, depois a lista detalhada
5. CONTE os registros dos dados acima — NUNCA invente números
6. Se não tiver dados, diga "Não encontrei dados sobre isso no sistema."
7. NÃO repita a pergunta. NÃO diga "Com base nos dados". Vá DIRETO à resposta
8. Quando contar viagens/registros, conte TODOS os itens do array de dados
9. Use negrito (**texto**) para destacar números e informações-chave
10. Máximo 2 frases de introdução antes dos dados — depois vá direto à lista
11. Quando perguntarem sobre menus, funcionalidades ou como usar o sistema, responda usando a ESTRUTURA COMPLETA acima
12. Seja útil para QUALQUER pergunta sobre o sistema, planilhas, banco de dados ou operação da obra

FORMATO IDEAL DE RESPOSTA:
**89 viagens de carga hoje:**

• BGS → 14 viagens (210 m³)
• Bota Fora → 12 viagens (192 m³)
• Aterro → 10 viagens (160 m³)`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Muitas requisições. Tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes para IA.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'Erro no serviço de IA' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('AI assistant error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
