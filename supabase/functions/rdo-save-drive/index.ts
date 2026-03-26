import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_FOLDER_ID = Deno.env.get('RDO_DRIVE_FOLDER_ID') || 'root';

// Meses em português
const MESES = [
  '01 - Janeiro', '02 - Fevereiro', '03 - Março', '04 - Abril',
  '05 - Maio', '06 - Junho', '07 - Julho', '08 - Agosto',
  '09 - Setembro', '10 - Outubro', '11 - Novembro', '12 - Dezembro',
];

async function createJWT(serviceAccount: any): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
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

async function getDriveAccessToken(serviceAccount: any): Promise<string> {
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
  if (!response.ok) throw new Error(`Drive token error: ${data.error_description || data.error}`);
  return data.access_token;
}

/**
 * Busca uma pasta pelo nome dentro de um parent. Retorna o ID ou null.
 */
async function findFolder(token: string, parentId: string, name: string): Promise<string | null> {
  const escapedName = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive folder search error: ${JSON.stringify(data)}`);
  return data.files?.[0]?.id || null;
}

/**
 * Cria uma pasta no Drive dentro de um parent. Retorna o ID criado.
 */
async function createFolder(token: string, parentId: string, name: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive folder create error: ${JSON.stringify(data)}`);
  return data.id as string;
}

/**
 * Garante que a pasta existe (busca ou cria). Retorna o ID.
 */
async function ensureFolder(token: string, parentId: string, name: string): Promise<string> {
  const existing = await findFolder(token, parentId, name);
  if (existing) return existing;
  return createFolder(token, parentId, name);
}

/** Busca o file ID de um arquivo no Drive pelo nome dentro de uma pasta */
async function findFileInDrive(token: string, folderId: string, fileName: string): Promise<string | null> {
  const escapedName = fileName.replace(/'/g, "\\'");
  const q = encodeURIComponent(`name='${escapedName}' and '${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive search error: ${JSON.stringify(data)}`);
  return data.files?.[0]?.id || null;
}

/** Upload multipart para o Drive (novo arquivo ou atualização) */
async function uploadToDrive(
  token: string,
  pdfBytes: Uint8Array,
  fileName: string,
  folderId: string,
  existingFileId?: string | null,
): Promise<string> {
  const metadata = existingFileId
    ? { name: fileName }
    : { name: fileName, mimeType: 'application/pdf', parents: [folderId] };

  const boundary = '----RDOBoundary';
  const metaJson = JSON.stringify(metadata);
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`,
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
  ];

  const bodyParts = body.map(s => new TextEncoder().encode(s));
  const ending = new TextEncoder().encode(`\r\n--${boundary}--`);
  const totalLength = bodyParts.reduce((a, b) => a + b.length, 0) + pdfBytes.length + ending.length;
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of bodyParts) { merged.set(part, offset); offset += part.length; }
  merged.set(pdfBytes, offset); offset += pdfBytes.length;
  merged.set(ending, offset);

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(totalLength),
    },
    body: merged,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Drive upload error [${res.status}]: ${JSON.stringify(data)}`);
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: claimsData } = await supabase.auth.getClaims(token);
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Body ─────────────────────────────────────────────────────────────────
    let body: { rdo_id: string; pdf_base64: string; numero_rdo?: string; obra_nome?: string; rdo_data?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Body inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { rdo_id, pdf_base64, numero_rdo, obra_nome, rdo_data } = body;
    if (!rdo_id || !pdf_base64) {
      return new Response(JSON.stringify({ error: 'rdo_id e pdf_base64 são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Converter base64 → bytes ──────────────────────────────────────────────
    const pdfBytes = Uint8Array.from(atob(pdf_base64), c => c.charCodeAt(0));

    // ── Nome do arquivo ────────────────────────────────────────────────────────
    const safeObra = (obra_nome || 'Obra').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 50);
    const nRdo = numero_rdo || rdo_id.slice(0, 8);
    const fileName = `RDO_${safeObra}_${nRdo}.pdf`;

    // ── Determinar Ano e Mês a partir da data do RDO ──────────────────────────
    const rdoDate = rdo_data ? new Date(rdo_data + 'T12:00:00') : new Date();
    const ano = String(rdoDate.getFullYear());
    const mesIndex = rdoDate.getMonth(); // 0-based
    const mes = MESES[mesIndex];

    // ── Google Drive ─────────────────────────────────────────────────────────
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado');

    const serviceAccount = JSON.parse(serviceAccountJson.trim().replace(/^\uFEFF/, ''));
    const driveToken = await getDriveAccessToken(serviceAccount);
    const rootFolderId = DEFAULT_FOLDER_ID;

    // ── Criar hierarquia: Raiz → Obra → Ano → Mês ────────────────────────────
    console.log(`Garantindo estrutura de pastas: "${safeObra}" / "${ano}" / "${mes}"`);
    const obraFolderId = await ensureFolder(driveToken, rootFolderId, safeObra);
    const anoFolderId = await ensureFolder(driveToken, obraFolderId, ano);
    const mesFolderId = await ensureFolder(driveToken, anoFolderId, mes);

    // Verificar se já existe (para atualizar em vez de criar novo)
    const existingId = await findFileInDrive(driveToken, mesFolderId, fileName);
    const driveFileId = await uploadToDrive(driveToken, pdfBytes, fileName, mesFolderId, existingId);

    // ── Atualizar pdf_path no banco ────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const driveLink = `https://drive.google.com/file/d/${driveFileId}/view`;
    await supabaseAdmin.from('rdos').update({ pdf_path: driveLink }).eq('id', rdo_id);

    console.log(`PDF ${existingId ? 'atualizado' : 'criado'} em: ${safeObra}/${ano}/${mes}/${fileName} (${driveFileId})`);

    return new Response(
      JSON.stringify({
        success: true,
        driveFileId,
        driveLink,
        fileName,
        updated: !!existingId,
        folderPath: `${safeObra}/${ano}/${mes}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('rdo-save-drive error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
