import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Sheets auth helpers (same pattern as google-sheets function)
async function createJWT(serviceAccount: any): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createJWT(serviceAccount);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Token error: ${data.error_description || data.error}`);
  return data.access_token;
}

async function writeSheet(token: string, spreadsheetId: string, range: string, values: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Sheets write error: ${err?.error?.message || res.status}`);
  }
  return res.json();
}

async function clearSheet(token: string, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json();
    console.warn(`Clear warning: ${err?.error?.message || res.status}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');

    if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');

    const SPREADSHEET_ID = '1B9-SbnayFySlsITdRqn_2WJNnA9ZhD0PWYka83581c';

    // Supabase client with service role (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch data
    const [materiaisRes, movimentacoesRes] = await Promise.all([
      supabase.from('alm_materiais').select('*').order('codigo'),
      supabase.from('alm_movimentacoes').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
    ]);

    if (materiaisRes.error) throw new Error(`Materiais error: ${materiaisRes.error.message}`);
    if (movimentacoesRes.error) throw new Error(`Movimentações error: ${movimentacoesRes.error.message}`);

    const materiais = materiaisRes.data || [];
    const movimentacoes = movimentacoesRes.data || [];

    // Build materiais map for name lookups
    const matMap = Object.fromEntries(materiais.map(m => [m.id, m]));

    // Google Sheets auth
    const serviceAccount = JSON.parse(serviceAccountJson.trim().replace(/^\uFEFF/, ''));
    const googleToken = await getAccessToken(serviceAccount);

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // ===== Sheet 1: Alm_Materiais =====
    const matHeader = ['Código', 'Nome', 'Categoria', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Status', 'Observações', 'Atualizado em'];
    const matRows = materiais.map(m => [
      m.codigo, m.nome, m.categoria || '', m.unidade,
      m.estoque_atual, m.estoque_minimo, m.status,
      m.observacoes || '', timestamp
    ]);

    // ===== Sheet 2: Alm_Movimentacoes =====
    const movHeader = ['Data', 'Tipo', 'Material (Código)', 'Material (Nome)', 'Quantidade', 'Saldo Após', 'Fornecedor', 'NF', 'Equipe', 'Local Uso', 'Responsável', 'Nº Requisição', 'Preço Unit.', 'Preço Total', 'Observações'];
    const movRows = movimentacoes.map(m => {
      const mat = matMap[m.material_id];
      return [
        m.data, m.tipo === 'entrada' ? 'Entrada' : 'Saída',
        mat?.codigo || '', mat?.nome || '',
        m.quantidade, m.saldo_apos,
        m.fornecedor || '', m.nota_fiscal || '',
        m.equipe || '', m.local_uso || '',
        m.responsavel || '', m.numero_requisicao || '',
        m.preco_unitario || '', m.preco_total || '',
        m.observacoes || ''
      ];
    });

    // Write to sheets - clear first, then write
    await clearSheet(googleToken, SPREADSHEET_ID, 'Alm_Materiais!A1:Z10000');
    await writeSheet(googleToken, SPREADSHEET_ID, `Alm_Materiais!A1:I${1 + matRows.length}`, [matHeader, ...matRows]);

    await clearSheet(googleToken, SPREADSHEET_ID, 'Alm_Movimentacoes!A1:Z10000');
    await writeSheet(googleToken, SPREADSHEET_ID, `Alm_Movimentacoes!A1:O${1 + movRows.length}`, [movHeader, ...movRows]);

    console.log(`ALM Export OK - ${materiais.length} materiais, ${movimentacoes.length} movimentações at ${timestamp}`);

    return new Response(JSON.stringify({
      success: true,
      materiais: materiais.length,
      movimentacoes: movimentacoes.length,
      timestamp,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno';
    console.error('ALM Export error:', msg, error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
