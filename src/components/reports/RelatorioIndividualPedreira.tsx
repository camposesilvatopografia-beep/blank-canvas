import logoApropriapp from '@/assets/logo-apropriapp.png';
import { useObraConfig } from '@/hooks/useObraConfig';
import { getPhotoFallbackCandidates, normalizePhotoUrl } from '@/utils/photoUrl';

interface PedreiraRecord {
  data: string;
  hora: string;
  ordem: string;
  fornecedor: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  placa: string;
  material: string;
  pesoVazio: number;
  pesoFinal: number;
  pesoLiquido: number;
  tonelada: number;
  toneladaTicket?: number;
  toneladaCalcObra?: number;
  pesoChegada: number;
  fotoChegada: string;
  fotoPesagem: string;
  fotoVazio: string;
}

const toBase64 = (src: string): Promise<string> => {
  const normalizedSrc = normalizePhotoUrl(src);
  if (!normalizedSrc || normalizedSrc.startsWith('data:')) return Promise.resolve(normalizedSrc || '');
  // Try multiple fetch strategies for resilience
  const tryFetch = (url: string, opts: RequestInit): Promise<string> =>
    fetch(url, opts)
      .then(res => {
        if (!res.ok) throw new Error('fetch failed');
        return res.blob();
      })
      .then(blob => {
        if (!blob || !blob.size || blob.type === 'text/html') throw new Error('invalid blob');
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result && result.length > 100 ? result : '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      });

  return tryFetch(normalizedSrc, { mode: 'cors', referrerPolicy: 'no-referrer' })
    .catch(() => tryFetch(normalizedSrc, { mode: 'no-cors', referrerPolicy: 'no-referrer' }))
    .catch(() => normalizedSrc); // fallback to raw URL
};

const esc = (value: string) => (value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function exportRelatorioIndividualPedreira(
  record: PedreiraRecord,
  obraConfig: { nome: string; local: string; logo: string | null },
  options?: { printOnOpen?: boolean },
) {
  const activeLogo = obraConfig.logo || logoApropriapp;
  const logoB64 = await toBase64(activeLogo);

  const rawRecord = record as any;
  const fotoChegadaCandidates = getPhotoFallbackCandidates(
    record.fotoChegada || rawRecord['Foto do Peso Chegada Obra'] || rawRecord['Foto Peso Chegada Obra'] || rawRecord['Foto do Peso da Chegada'] || rawRecord['Foto_Peso_Chegada'] || rawRecord['Foto Peso Chegada'] || '',
  );
  const fotoPesagemCandidates = getPhotoFallbackCandidates(
    record.fotoPesagem || rawRecord['Foto Pesagem Pedreira'] || rawRecord['Foto_Pesagem_Pedreira'] || rawRecord['Foto Pesagem'] || rawRecord['Foto da Pesagem'] || rawRecord['Foto do Peso Carregado'] || '',
  );
  const fotoVazioCandidates = getPhotoFallbackCandidates(
    record.fotoVazio || rawRecord['Foto do Peso Saida Obra'] || rawRecord['Foto do Peso Saída Obra'] || rawRecord['Foto do Peso Vazio Obra'] || rawRecord['Foto Peso Vazio Obra'] || rawRecord['Foto_Peso_Vazio_Obra'] || rawRecord['Foto Peso Vazio'] || '',
  );

  let fotoChegadaSrc = fotoChegadaCandidates[0] || '';
  let fotoPesagemSrc = fotoPesagemCandidates[0] || '';
  let fotoVazioSrc = fotoVazioCandidates[0] || '';
  
  const [b64Chegada, b64Pesagem, b64Vazio] = await Promise.all([
    fotoChegadaSrc ? toBase64(fotoChegadaSrc) : Promise.resolve(''),
    fotoPesagemSrc ? toBase64(fotoPesagemSrc) : Promise.resolve(''),
    fotoVazioSrc ? toBase64(fotoVazioSrc) : Promise.resolve(''),
  ]);
  
  fotoChegadaSrc = b64Chegada || fotoChegadaSrc;
  fotoPesagemSrc = b64Pesagem || fotoPesagemSrc;
  fotoVazioSrc = b64Vazio || fotoVazioSrc;

  const fotoChegadaFallback = fotoChegadaCandidates[1] || fotoChegadaCandidates[0] || '';
  const fotoPesagemFallback = fotoPesagemCandidates[1] || fotoPesagemCandidates[0] || '';
  const fotoVazioFallback = fotoVazioCandidates[1] || fotoVazioCandidates[0] || '';

  const hasFotoChegada = !!fotoChegadaSrc;
  const hasFotoPesagem = !!fotoPesagemSrc;
  const hasFotoVazio = !!fotoVazioSrc;
  const photoCount = [hasFotoChegada, hasFotoPesagem, hasFotoVazio].filter(Boolean).length;

  let fotosHtml = '';
  if (photoCount > 0) {
    const gridCols = photoCount >= 3 ? 'repeat(3, 1fr)' : photoCount === 2 ? 'repeat(2, 1fr)' : '1fr';
    fotosHtml = `
      <div class="fotos-section">
        <h3>📸 Evidências Fotográficas</h3>
        <div class="fotos-grid" style="grid-template-columns: ${gridCols}">
          ${hasFotoPesagem ? `
          <div class="foto-item">
            <div class="foto-label">⚖️ Peso Carregado na Balança (Pedreira)</div>
            <img src="${fotoPesagemSrc}" alt="Foto pesagem pedreira" class="foto-img" referrerpolicy="no-referrer" onerror="this.onerror=null;tryAltSrc(this,'${esc(fotoPesagemFallback)}')" />
          </div>
          ` : ''}
          ${hasFotoChegada ? `
          <div class="foto-item">
            <div class="foto-label">🏢 Peso de Chegada na Obra (Carregado)</div>
            <img src="${fotoChegadaSrc}" alt="Foto peso chegada" class="foto-img" referrerpolicy="no-referrer" onerror="this.onerror=null;tryAltSrc(this,'${esc(fotoChegadaFallback)}')" />
          </div>
          ` : ''}
          ${hasFotoVazio ? `
          <div class="foto-item">
            <div class="foto-label">🚛 Peso de Saída (Vazio) — Obra</div>
            <img src="${fotoVazioSrc}" alt="Foto peso vazio" class="foto-img" referrerpolicy="no-referrer" onerror="this.onerror=null;tryAltSrc(this,'${esc(fotoVazioFallback)}')" />
          </div>
          ` : ''}
        </div>
      </div>
    `; 
  }

  const tonTicket = record.toneladaTicket || record.tonelada || 0;
  const tonCalcObra = record.toneladaCalcObra || 0;
  const difTon = tonCalcObra > 0 && tonTicket > 0 ? (tonCalcObra - tonTicket) : 0;
  const hasDif = Math.abs(difTon) > 0.0005;

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8" />
    <meta name="referrer" content="no-referrer" />
    <title>Carregamento ${record.prefixo} — ${record.data}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { padding: 0; font-size: 11px; color: #1a1a2e; }

      .header {
        background: linear-gradient(135deg, #c2410c, #f97316);
        color: #fff;
        padding: 16px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }
      .header img.logo { height: 50px; border-radius: 8px; background: rgba(255,255,255,0.15); padding: 4px; }
      .header .title-area { flex: 1; }
      .header h1 { font-size: 16px; font-weight: 800; }
      .header p { font-size: 10px; opacity: 0.85; margin-top: 2px; }
      .header .date-badge {
        background: rgba(255,255,255,0.2);
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 16px;
      }
      .info-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px 14px;
        background: #fafafa;
      }
      .info-card .label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6b7280;
        font-weight: 600;
        margin-bottom: 3px;
      }
      .info-card .value {
        font-size: 13px;
        font-weight: 700;
        color: #1a1a2e;
      }
      .info-card .sub { font-size: 9px; color: #9ca3af; margin-top: 1px; }

      .peso-section {
        border: 2px solid #ea580c;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .peso-section .peso-header {
        background: #ea580c;
        color: white;
        padding: 8px 14px;
        font-weight: 700;
        font-size: 12px;
      }
      .peso-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0;
      }
      .peso-cell {
        padding: 14px 10px;
        text-align: center;
        border-right: 1px solid #e5e7eb;
      }
      .peso-cell:last-child { border-right: none; }
      .peso-cell .p-label { font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
      .peso-cell .p-value { font-size: 18px; font-weight: 800; color: #1a1a2e; margin-top: 4px; }
      .peso-cell .p-unit { font-size: 9px; color: #9ca3af; }
      .peso-cell.highlight { background: #fff7ed; }
      .peso-cell.dif-positiva .p-value { color: #2563eb; }
      .peso-cell.dif-negativa .p-value { color: #dc2626; }

      .fotos-section {
        margin-bottom: 16px;
      }
      .fotos-section h3 {
        font-size: 12px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 10px;
        padding-bottom: 4px;
        border-bottom: 2px solid #ea580c;
      }
      .fotos-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .foto-item {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
      .foto-label {
        background: #f3f4f6;
        padding: 6px 10px;
        font-size: 10px;
        font-weight: 700;
        color: #374151;
        text-align: center;
        border-bottom: 1px solid #e5e7eb;
      }
      .foto-img {
        width: 100%;
        height: 320px;
        object-fit: contain;
        display: block;
        margin: 6px auto;
        padding: 4px;
        background: #fafafa;
        image-rendering: auto;
      }
      .foto-error {
        width: 100%;
        height: 240px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f9fafb;
        color: #9ca3af;
        font-size: 11px;
        font-style: italic;
      }

      .footer {
        text-align: center;
        font-size: 8px;
        color: #9ca3af;
        margin-top: 20px;
        padding-top: 8px;
        border-top: 1px solid #e5e7eb;
      }

      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
    <script>
      function tryAltSrc(img, originalUrl) {
        if (!originalUrl) { img.outerHTML = '<div class="foto-error">📷 Foto indisponível</div>'; return; }
        // If we tried base64 and it failed, try the raw URL directly
        if (img.src.startsWith('data:') || img.src !== originalUrl) {
          img.src = originalUrl;
          img.referrerPolicy = 'no-referrer';
          img.onerror = function() {
            // For Supabase storage URLs, try adding download param
            if (originalUrl.includes('supabase') && !originalUrl.includes('?download')) {
              img.src = originalUrl + (originalUrl.includes('?') ? '&' : '?') + 'download=';
              img.onerror = function() { img.outerHTML = '<div class="foto-error">📷 Foto indisponível</div>'; };
              return;
            }
            var match = originalUrl.match(/[-\\w]{25,}/);
            if (originalUrl.includes('drive.google') && match) {
              img.src = 'https://lh3.googleusercontent.com/d/' + match[0] + '=w800';
              img.onerror = function() { img.outerHTML = '<div class="foto-error">📷 Foto indisponível</div>'; };
              return;
            }
            img.outerHTML = '<div class="foto-error">📷 Foto indisponível</div>';
          };
          return;
        }
        img.outerHTML = '<div class="foto-error">📷 Foto indisponível</div>';
      }
    </script>
  </head><body>

    <div class="header">
      ${logoB64 ? `<img class="logo" src="${logoB64}" alt="Logo" />` : ''}
      <div class="title-area">
        <h1>⛰️ RELATÓRIO DE CARREGAMENTO</h1>
        ${obraConfig.nome ? `<p>${obraConfig.nome}</p>` : ''}
        ${obraConfig.local ? `<p>📍 ${obraConfig.local}</p>` : ''}
      </div>
      <div class="date-badge">
        📅 ${record.data}<br/>${record.hora}
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="label">🚛 Veículo</div>
        <div class="value">${record.prefixo}</div>
        <div class="sub">${record.descricao || ''} ${record.placa ? `• Placa: ${record.placa}` : ''}</div>
      </div>
      <div class="info-card">
        <div class="label">👤 Motorista</div>
        <div class="value">${record.motorista || '—'}</div>
        <div class="sub">${record.empresa || ''}</div>
      </div>
      <div class="info-card">
        <div class="label">🏭 Fornecedor</div>
        <div class="value">${record.fornecedor || '—'}</div>
        <div class="sub">Nº Pedido: ${record.ordem || '—'}</div>
      </div>
      <div class="info-card">
        <div class="label">📦 Material</div>
        <div class="value">${record.material || '—'}</div>
      </div>
    </div>

    <div class="peso-section">
      <div class="peso-header">⚖️ Dados de Pesagem</div>
      <div class="peso-grid">
        <div class="peso-cell">
          <div class="p-label">Peso Final</div>
          <div class="p-value">${record.pesoFinal > 0 ? record.pesoFinal.toLocaleString('pt-BR') : '—'}</div>
          <div class="p-unit">kg</div>
        </div>
        <div class="peso-cell highlight">
          <div class="p-label">Ton. Ticket</div>
          <div class="p-value">${tonTicket > 0 ? fmt(tonTicket) : '—'}</div>
          <div class="p-unit">t</div>
        </div>
        <div class="peso-cell">
          <div class="p-label">Ton. Calc Obra</div>
          <div class="p-value">${tonCalcObra > 0 ? fmt(tonCalcObra) : '—'}</div>
          <div class="p-unit">t</div>
        </div>
        <div class="peso-cell ${hasDif ? (difTon > 0 ? 'dif-positiva' : 'dif-negativa') : ''}">
          <div class="p-label">Diferença</div>
          <div class="p-value">${hasDif ? `${difTon > 0 ? '+' : ''}${fmt(difTon)}` : '—'}</div>
          <div class="p-unit">t</div>
        </div>
      </div>
    </div>

    ${fotosHtml}

    <div class="footer">
      Gerado em ${new Date().toLocaleString('pt-BR')} • ApropriAPP — Gestão Inteligente
    </div>

  </body></html>`;

  const shouldPrint = options?.printOnOpen !== false;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    if (shouldPrint) {
      const imgs = w.document.querySelectorAll('img.foto-img');
      const loaded = Array.from(imgs).map(img => new Promise<void>(resolve => {
        if ((img as HTMLImageElement).complete) { resolve(); return; }
        img.addEventListener('load', () => resolve());
        img.addEventListener('error', () => resolve());
        setTimeout(() => resolve(), 3000);
      }));
      Promise.all(loaded).then(() => setTimeout(() => w.print(), 300));
    }
  }
}
