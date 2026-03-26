import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Allowed spreadsheet IDs - only these can be accessed
const ALLOWED_SPREADSHEET_IDS = [
  '1B9-SbnayFySlsITdRqn_2WJNnA9ZHhD0PWYka83581c'
];

// Allowed sheet names for validation
const ALLOWED_SHEET_NAMES = [
  'Carga', 'Descarga', 'Apontamento_Pedreira', 'Apontamento_Pipa', 
  'Mov_Cal', 'Estoque_Cal', 'Caminhao', 'Equipamentos', 'Reboque', 'Pipa', 'Caminhao_Pipa',
  'Cam_reboque', 'Cam_Reboque',
  'Abastecimentos', 'Horimetros', 'Manutenções',
  'Estoques Comboios', 'Estoques Tanques',
  'Frota Geral',
  'Pluviometria',
  'Produção Usina Solos',
  'Mobilização',
  'Caminhões Areia Express'
];

interface SheetRequest {
  action: 'read' | 'write' | 'append' | 'deleteRow';
  spreadsheetId: string;
  range: string;
  values?: any[][];
  sheetName?: string;
  rowIndex?: number;
}

// Input validation functions
function validateSpreadsheetId(spreadsheetId: string): boolean {
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    return false;
  }
  return ALLOWED_SPREADSHEET_IDS.includes(spreadsheetId);
}

function validateRange(range: string): boolean {
  if (!range || typeof range !== 'string') {
    return false;
  }
  // Range should be max 100 characters
  if (range.length > 100) {
    return false;
  }
  // Extract sheet name from range (before !)
  const sheetName = range.includes('!') ? range.split('!')[0] : range;
  // Validate sheet name is in allowed list
  return ALLOWED_SHEET_NAMES.some(allowed => 
    sheetName.toLowerCase() === allowed.toLowerCase()
  );
}

function validateAction(action: string): action is 'read' | 'write' | 'append' | 'deleteRow' {
  return ['read', 'write', 'append', 'deleteRow'].includes(action);
}

function validateValues(values: any[][]): boolean {
  if (!Array.isArray(values)) {
    return false;
  }
  // Limit to 1000 rows to prevent DoS
  if (values.length > 1000) {
    return false;
  }
  // Validate each row is an array with max 50 columns
  for (const row of values) {
    if (!Array.isArray(row) || row.length > 50) {
      return false;
    }
    // Validate cell values are primitives
    for (const cell of row) {
      if (cell !== null && cell !== undefined && 
          typeof cell !== 'string' && typeof cell !== 'number' && typeof cell !== 'boolean') {
        return false;
      }
      // Limit string length to 10000 characters
      if (typeof cell === 'string' && cell.length > 10000) {
        return false;
      }
    }
  }
  return true;
}

// Simple JWT signing for Google Service Account
async function createJWT(serviceAccount: any): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

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

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

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
  if (!response.ok) {
    throw new Error(`Token error: ${data.error_description || data.error}`);
  }
  
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============ PARSE AND VALIDATE INPUT (moved before auth to check action) ============
    let requestBody: SheetRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Requisição inválida: JSON malformado' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { action, spreadsheetId, range, values, sheetName, rowIndex } = requestBody;

    // ============ AUTHENTICATION ============
    // Read-only operations allow unauthenticated access (for /dashboard-only public page)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;
    const hasValidToken = token && token !== 'null' && token !== 'undefined' && token.length >= 20;
    
    let userId = 'anonymous';

    if (hasValidToken) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

      if (claimsError || !claimsData?.claims) {
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
          // If action is read, allow anonymous; otherwise reject
          if (action !== 'read') {
            console.error('Auth error:', userError || claimsError);
            return new Response(JSON.stringify({
              success: false,
              error: 'Não autorizado: Token inválido'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } else {
          userId = userData.user.id;
        }
      } else {
        userId = claimsData.claims.sub;
      }
    } else if (action !== 'read') {
      // Write/append/delete operations REQUIRE authentication
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Não autorizado: Token de acesso ausente' 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`User: ${userId}, Action: ${action}`);

    // Validate action
    if (!validateAction(action)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Ação inválida. Permitidas: read, write, append' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validate spreadsheetId
    if (!validateSpreadsheetId(spreadsheetId)) {
      console.warn(`Attempted access to unauthorized spreadsheet: ${spreadsheetId} by user ${userId}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Planilha não autorizada' 
      }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validate range (not required for deleteRow)
    if (action !== 'deleteRow') {
      if (!validateRange(range)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Intervalo inválido ou aba não permitida' 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Validate deleteRow specific params
    if (action === 'deleteRow') {
      if (!sheetName || !ALLOWED_SHEET_NAMES.some(a => a.toLowerCase() === sheetName.toLowerCase())) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Aba não permitida para exclusão' 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      if (!rowIndex || typeof rowIndex !== 'number' || rowIndex < 2) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Índice de linha inválido (mínimo: 2, não pode excluir cabeçalho)' 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Validate values for write/append operations
    if ((action === 'write' || action === 'append') && values !== undefined) {
      if (!validateValues(values)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Dados inválidos: verifique formato e limites' 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // ============ GOOGLE SHEETS API ============
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
    }

    // Clean the JSON string - remove any BOM, trim whitespace
    const cleanedJson = serviceAccountJson.trim().replace(/^\uFEFF/, '');
    
    if (!cleanedJson.startsWith('{')) {
      throw new Error('Invalid service account configuration');
    }

    const serviceAccount = JSON.parse(cleanedJson);
    
    console.log(`Google Sheets API - User: ${userId}, Action: ${action}, Range: ${range}`);

    const googleToken = await getAccessToken(serviceAccount);
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

    let response;
    let data;

    if (action === 'read') {
      response = await fetch(
        `${baseUrl}/values/${encodeURIComponent(range)}`,
        {
          headers: { 'Authorization': `Bearer ${googleToken}` },
        }
      );
      data = await response.json();
      
      if (!response.ok) {
        console.error('Google Sheets API Error:', data);
        throw new Error('Falha ao ler dados da planilha');
      }

      console.log(`Read ${data.values?.length || 0} rows from ${range}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: data.values || [] 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'write') {
      response = await fetch(
        `${baseUrl}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        }
      );
      data = await response.json();

      if (!response.ok) {
        console.error('Google Sheets API Error:', data);
        throw new Error('Falha ao escrever na planilha');
      }

      console.log(`Updated ${data.updatedCells} cells in ${range} by user ${userId}`);

      return new Response(JSON.stringify({ 
        success: true, 
        updatedCells: data.updatedCells 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'append') {
      console.log(`APPEND request - Range: ${range}, Values rows: ${values?.length}, First row cols: ${values?.[0]?.length}`);

      // Extract sheet name from range (e.g. "Apontamento_Pedreira!A2" -> "Apontamento_Pedreira")
      const sheetNameOnly = range.includes('!') ? range.split('!')[0] : range;

      // Step 1: Read column A to find the actual last row with data
      const scanRange = `${sheetNameOnly}!A:A`;
      const scanUrl = `${baseUrl}/values/${encodeURIComponent(scanRange)}?majorDimension=COLUMNS`;
      const scanResp = await fetch(scanUrl, {
        headers: { 'Authorization': `Bearer ${googleToken}` },
      });
      const scanData = await scanResp.json();

      let lastRow = 1; // default: at least row 1 (header)
      if (scanData.values && scanData.values[0]) {
        lastRow = scanData.values[0].length; // length = number of rows with data in col A
      }

      // Also scan a few more columns to catch rows where col A is empty but other cols have data
      const scanRangeWide = `${sheetNameOnly}!A1:AZ${lastRow + 100}`;
      const scanWideResp = await fetch(`${baseUrl}/values/${encodeURIComponent(scanRangeWide)}`, {
        headers: { 'Authorization': `Bearer ${googleToken}` },
      });
      const scanWideData = await scanWideResp.json();
      if (scanWideData.values) {
        lastRow = Math.max(lastRow, scanWideData.values.length);
      }

      const nextRow = lastRow + 1;
      const numCols = values?.[0]?.length || 1;

      // Convert column number to letter (e.g. 1->A, 27->AA)
      const colToLetter = (col: number): string => {
        let result = '';
        let c = col;
        while (c > 0) {
          c--;
          result = String.fromCharCode(65 + (c % 26)) + result;
          c = Math.floor(c / 26);
        }
        return result;
      };

      const endCol = colToLetter(numCols);
      const endRow = nextRow + (values?.length || 1) - 1;
      const writeRange = `${sheetNameOnly}!A${nextRow}:${endCol}${endRow}`;

      console.log(`APPEND: lastRow=${lastRow}, writing to ${writeRange}`);

      // Step 2: Write directly to the calculated position
      const writeUrl = `${baseUrl}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;
      response = await fetch(writeUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });
      data = await response.json();

      if (!response.ok) {
        console.error('Google Sheets API Error (append-write):', JSON.stringify(data));
        throw new Error(`Falha ao adicionar dados na planilha: ${data?.error?.message || 'unknown'}`);
      }

      console.log(`APPEND SUCCESS - ${values?.length || 0} rows written at row ${nextRow} by user ${userId}`);

      return new Response(JSON.stringify({ 
        success: true, 
        updates: { updatedRows: values?.length || 0, startRow: nextRow }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'deleteRow') {
      // Get sheet ID (gid) from metadata
      const metaResponse = await fetch(
        `${baseUrl}?fields=sheets.properties`,
        { headers: { 'Authorization': `Bearer ${googleToken}` } }
      );
      const metaData = await metaResponse.json();
      if (!metaResponse.ok) {
        throw new Error('Falha ao obter metadados da planilha');
      }

      const targetSheet = metaData.sheets?.find((s: any) => 
        s.properties?.title === sheetName
      );
      if (!targetSheet) {
        throw new Error(`Aba "${sheetName}" não encontrada`);
      }

      const sheetId = targetSheet.properties.sheetId;

      // Delete the row using batchUpdate
      response = await fetch(
        `${baseUrl}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex! - 1, // 0-indexed
                  endIndex: rowIndex!, // exclusive
                }
              }
            }]
          }),
        }
      );
      data = await response.json();

      if (!response.ok) {
        console.error('Google Sheets API Error (deleteRow):', JSON.stringify(data));
        throw new Error('Falha ao excluir linha da planilha');
      }

      console.log(`DELETE ROW ${rowIndex} from ${sheetName} by user ${userId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Operação não suportada');

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('Unhandled error in google-sheets function:', errorMessage, error);
    // Return generic error message to prevent information leakage
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Erro ao processar requisição' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
