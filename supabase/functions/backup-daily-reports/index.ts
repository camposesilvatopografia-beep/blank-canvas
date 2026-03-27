import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPREADSHEET_ID = '1BP-YmGfi9-kBnc_Gi0JpDHEaTm4_W7FpVRd6pqFhqdE';
const DEFAULT_FOLDER_ID = Deno.env.get('BACKUP_DRIVE_FOLDER_ID') || Deno.env.get('RDO_DRIVE_FOLDER_ID') || 'root';


const MESES = [
  '01 - Janeiro', '02 - Fevereiro', '03 - Março', '04 - Abril',
  '05 - Maio', '06 - Junho', '07 - Julho', '08 - Agosto',
  '09 - Setembro', '10 - Outubro', '11 - Novembro', '12 - Dezembro',
];

// ── Google Auth helpers (User OAuth with Refresh Token) ───────────────────

async function getAccessTokenFromRefreshToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials não configuradas (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh error: ${data.error_description || data.error}`);
  return data.access_token;
}

// ── Drive helpers ─────────────────────────────────────────────────────────

async function findFolder(token: string, parentId: string, name: string): Promise<string | null> {
  const escapedName = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(`name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive search: ${JSON.stringify(data)}`);
  return data.files?.[0]?.id || null;
}

async function createFolder(token: string, parentId: string, name: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive folder create: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function ensureFolder(token: string, parentId: string, name: string): Promise<string> {
  return (await findFolder(token, parentId, name)) || (await createFolder(token, parentId, name));
}

async function uploadFileToDrive(
  token: string, fileBytes: Uint8Array, fileName: string, mimeType: string, folderId: string
): Promise<string> {
  const metadata = { name: fileName, mimeType, parents: [folderId] };
  const boundary = '----BackupBoundary';
  const metaJson = JSON.stringify(metadata);
  const parts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  ];
  const bodyParts = parts.map(s => new TextEncoder().encode(s));
  const ending = new TextEncoder().encode(`\r\n--${boundary}--`);
  const totalLength = bodyParts.reduce((a, b) => a + b.length, 0) + fileBytes.length + ending.length;
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of bodyParts) { merged.set(part, offset); offset += part.length; }
  merged.set(fileBytes, offset); offset += fileBytes.length;
  merged.set(ending, offset);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(totalLength),
    },
    body: merged,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive upload [${res.status}]: ${JSON.stringify(data)}`);
  return data.id as string;
}

// ── Sheets helper ─────────────────────────────────────────────────────────

async function readSheet(sheetsToken: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${sheetsToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets read error: ${JSON.stringify(data)}`);
  return data.values || [];
}

// ── Photo download helper ─────────────────────────────────────────────────

async function downloadPhoto(url: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 100) return null; // skip empty/invalid
    return { bytes, mimeType: contentType.split(';')[0] };
  } catch {
    return null;
  }
}

// ── Build HTML report for an entry ────────────────────────────────────────

function buildEntryHtml(
  modulo: string,
  headers: string[],
  row: string[],
  photoB64List: { name: string; b64: string; mime: string }[],
): string {
  const fieldsHtml = headers.map((h, i) => {
    const val = row[i] || '';
    if (!val || val.startsWith('http')) return '';
    return `<tr><td style="font-weight:bold;padding:4px 8px;border:1px solid #ddd;background:#f5f5f5;width:200px">${h}</td><td style="padding:4px 8px;border:1px solid #ddd">${val}</td></tr>`;
  }).filter(Boolean).join('');

  const photosHtml = photoB64List.map(p =>
    `<div style="margin:8px 0;text-align:center">
      <p style="font-size:11px;color:#666">${p.name}</p>
      <img src="data:${p.mime};base64,${p.b64}" style="max-width:400px;max-height:300px;border:1px solid #ccc;border-radius:4px" />
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Backup ${modulo}</title>
<style>body{font-family:Arial,sans-serif;margin:20px;font-size:12px}
h2{color:#1d3557;border-bottom:2px solid #e76f51;padding-bottom:4px}
table{border-collapse:collapse;width:100%;margin-bottom:16px}</style></head>
<body>
<h2>📋 Backup - ${modulo}</h2>
<table>${fieldsHtml}</table>
${photosHtml ? `<h3>📷 Fotos</h3>${photosHtml}` : ''}
</body></html>`;
}

// ── Identify photo columns ────────────────────────────────────────────────

function findPhotoColumns(headers: string[]): number[] {
  const photoKeywords = ['foto', 'photo', 'imagem', 'image', 'img'];
  return headers.map((h, i) => {
    const lower = h.toLowerCase();
    return photoKeywords.some(k => lower.includes(k)) ? i : -1;
  }).filter(i => i >= 0);
}

// ── Find storage paths from URLs ──────────────────────────────────────────

function extractStoragePath(url: string, bucket: string): string | null {
  // URLs like: https://.../storage/v1/object/public/cal-fotos/entradas/2024-01-15/file.jpg
  const pattern = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(pattern);
  if (idx >= 0) return url.slice(idx + pattern.length);
  return null;
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Get access token using User OAuth (refresh token flow)
    const accessToken = await getAccessTokenFromRefreshToken();
    // Same token works for both Sheets and Drive since user granted both scopes
    const sheetsToken = accessToken;
    const driveToken = accessToken;

    // Determine target date (yesterday by default, or from body)
    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body?.date || '';
    } catch {
      targetDate = '';
    }

    if (!targetDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      // Use Brasilia timezone
      const brasiliaOffset = -3 * 60;
      const utcMs = yesterday.getTime() + yesterday.getTimezoneOffset() * 60000;
      const brasiliaDate = new Date(utcMs + brasiliaOffset * 60000);
      targetDate = `${brasiliaDate.getFullYear()}-${String(brasiliaDate.getMonth() + 1).padStart(2, '0')}-${String(brasiliaDate.getDate()).padStart(2, '0')}`;
    }

    const [tYear, tMonth, tDay] = targetDate.split('-').map(Number);
    // Format for matching sheet data (DD/MM/YYYY)
    const targetFormatted = `${String(tDay).padStart(2, '0')}/${String(tMonth).padStart(2, '0')}/${tYear}`;
    const targetFormattedShort = `${String(tDay).padStart(2, '0')}/${String(tMonth).padStart(2, '0')}/${String(tYear).slice(2)}`;

    console.log(`Backup para data: ${targetDate} (${targetFormatted})`);

    // Supabase admin client for storage operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Setup Drive folder structure: Backups → {Módulo} → {Ano} → {Mês}
    const rootFolderId = DEFAULT_FOLDER_ID;
    const backupsFolderId = await ensureFolder(driveToken, rootFolderId, 'Backups Diários');

    const modules = [
      { name: 'Cal', sheetRange: 'Mov_Cal!A:Z', bucket: 'cal-fotos', dateColName: 'Data' },
      { name: 'Pedreira', sheetRange: 'Apontamento_Pedreira!A:AZ', bucket: 'pedreira-ocr-fotos', dateColName: 'Data' },
    ];

    const results: { module: string; entries: number; photos: number; cleaned: number; errors: string[] }[] = [];

    for (const mod of modules) {
      const modResult = { module: mod.name, entries: 0, photos: 0, cleaned: 0, errors: [] as string[] };

      try {
        // Read sheet data
        const sheetData = await readSheet(sheetsToken, mod.sheetRange);
        if (sheetData.length < 2) {
          modResult.errors.push('Planilha vazia ou sem dados');
          results.push(modResult);
          continue;
        }

        const headers = sheetData[0];
        const rows = sheetData.slice(1);

        // Find date column
        const dateColIdx = headers.findIndex(h =>
          h.toLowerCase().includes('data') && !h.toLowerCase().includes('hora')
        );
        if (dateColIdx < 0) {
          modResult.errors.push('Coluna de data não encontrada');
          results.push(modResult);
          continue;
        }

        // Find photo columns
        const photoColIdxs = findPhotoColumns(headers);

        // Filter rows for target date
        const dayRows = rows.filter(row => {
          const cellDate = (row[dateColIdx] || '').trim();
          return cellDate === targetFormatted || cellDate === targetFormattedShort;
        });

        if (dayRows.length === 0) {
          console.log(`${mod.name}: Nenhum registro para ${targetFormatted}`);
          results.push(modResult);
          continue;
        }

        console.log(`${mod.name}: ${dayRows.length} registros encontrados`);
        modResult.entries = dayRows.length;

        // Create Drive folder: Backups → Módulo → Ano → Mês → Data → Veículo
        const moduleFolderId = await ensureFolder(driveToken, backupsFolderId, mod.name);
        const anoFolderId = await ensureFolder(driveToken, moduleFolderId, String(tYear));
        const mesFolderId = await ensureFolder(driveToken, anoFolderId, MESES[tMonth - 1]);
        const dataFolderId = await ensureFolder(driveToken, mesFolderId, targetDate);

        // Process each entry
        const storagePaths: string[] = [];
        // Cache vehicle folder IDs to avoid re-creating
        const vehicleFolderCache = new Map<string, string>();

        for (let i = 0; i < dayRows.length; i++) {
          const row = dayRows[i];

          // Identify vehicle name/label for this entry
          const prefixoCol = headers.findIndex(h => h.toLowerCase().includes('prefixo') || h.toLowerCase().includes('placa'));
          const entryLabel = (row[prefixoCol] || `registro_${i + 1}`).replace(/[/\\?%*:|"<>]/g, '-');

          // Ensure vehicle subfolder exists
          let vehicleFolderId = vehicleFolderCache.get(entryLabel);
          if (!vehicleFolderId) {
            vehicleFolderId = await ensureFolder(driveToken, dataFolderId, entryLabel);
            vehicleFolderCache.set(entryLabel, vehicleFolderId);
          }

          // Download photos
          const photoB64List: { name: string; b64: string; mime: string }[] = [];

          for (const pIdx of photoColIdxs) {
            const photoUrl = (row[pIdx] || '').trim();
            if (!photoUrl || !photoUrl.startsWith('http')) continue;

            const photo = await downloadPhoto(photoUrl);
            if (!photo) continue;

            modResult.photos++;
            const colName = headers[pIdx].replace(/[/\\?%*:|"<>]/g, '-');
            // Chunk-safe base64 encoding (avoids stack overflow on large files)
            let binary = '';
            const chunk = 8192;
            for (let c = 0; c < photo.bytes.length; c += chunk) {
              binary += String.fromCharCode(...photo.bytes.subarray(c, c + chunk));
            }
            const b64 = btoa(binary);
            photoB64List.push({ name: colName, b64, mime: photo.mimeType });

            // Track storage path for cleanup
            const storagePath = extractStoragePath(photoUrl, mod.bucket);
            if (storagePath) storagePaths.push(storagePath);
          }

          // Build HTML report
          const html = buildEntryHtml(mod.name, headers, row, photoB64List);
          const htmlBytes = new TextEncoder().encode(html);
          const fileName = `${mod.name}_${targetDate}_${entryLabel}.html`;

          // Upload to Drive inside vehicle folder
          try {
            await uploadFileToDrive(driveToken, htmlBytes, fileName, 'text/html', vehicleFolderId);
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Upload error';
            modResult.errors.push(`Upload ${entryLabel}: ${errMsg}`);
          }
        }

        // Cleanup: delete photos from Supabase storage
        if (storagePaths.length > 0) {
          console.log(`${mod.name}: Limpando ${storagePaths.length} fotos do storage`);
          // Delete in batches of 20
          for (let b = 0; b < storagePaths.length; b += 20) {
            const batch = storagePaths.slice(b, b + 20);
            const { error: delError } = await supabaseAdmin.storage.from(mod.bucket).remove(batch);
            if (delError) {
              modResult.errors.push(`Cleanup error: ${delError.message}`);
            } else {
              modResult.cleaned += batch.length;
            }
          }
        }

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        modResult.errors.push(errMsg);
      }

      results.push(modResult);
    }

    const summary = {
      success: true,
      date: targetDate,
      results,
      totalEntries: results.reduce((a, r) => a + r.entries, 0),
      totalPhotos: results.reduce((a, r) => a + r.photos, 0),
      totalCleaned: results.reduce((a, r) => a + r.cleaned, 0),
    };

    console.log('Backup concluído:', JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('backup-daily-reports error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
