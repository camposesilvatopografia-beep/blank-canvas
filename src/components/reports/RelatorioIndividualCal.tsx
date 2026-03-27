import logoApropriapp from '@/assets/logo-apropriapp.png';

interface CalRecord {
  data: string;
  hora: string;
  tipo: string;
  fornecedor: string;
  prefixo: string;
  local: string;
  pesoBruto: number;
  pesoVazio: number;
  qtd: number;
  qtdBalancaObra: number;
  nf: string;
  status: string;
  fotoPesoVazio: string;
  fotoPesoCarregado: string;
  fotoPesoDistribuido: string;
}

const toBase64 = (src: string): Promise<string> => {
  if (!src || src.startsWith('data:')) return Promise.resolve(src || '');
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

  return tryFetch(src, { mode: 'cors', referrerPolicy: 'no-referrer' })
    .catch(() => tryFetch(src, { mode: 'no-cors', referrerPolicy: 'no-referrer' }))
    .catch(() => src);
};

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function exportRelatorioIndividualCal(
  record: CalRecord,
  obraConfig: { nome: string; local: string; logo: string | null },
  options?: { printOnOpen?: boolean },
) {
  const activeLogo = obraConfig.logo || logoApropriapp;
  const logoB64 = await toBase64(activeLogo);

  // Photos
  let fotoVazioSrc = record.fotoPesoVazio || '';
  let fotoCarregadoSrc = record.fotoPesoCarregado || '';
  let fotoDistribuidoSrc = record.fotoPesoDistribuido || '';

  const [b64Vazio, b64Carregado, b64Distribuido] = await Promise.all([
    fotoVazioSrc ? toBase64(fotoVazioSrc) : Promise.resolve(''),
    fotoCarregadoSrc ? toBase64(fotoCarregadoSrc) : Promise.resolve(''),
    fotoDistribuidoSrc ? toBase64(fotoDistribuidoSrc) : Promise.resolve(''),
  ]);

  fotoVazioSrc = b64Vazio || fotoVazioSrc;
  fotoCarregadoSrc = b64Carregado || fotoCarregadoSrc;
  fotoDistribuidoSrc = b64Distribuido || fotoDistribuidoSrc;

  const hasFotoVazio = !!fotoVazioSrc;
  const hasFotoCarregado = !!fotoCarregadoSrc;
  const hasFotoDistribuido = !!fotoDistribuidoSrc;
  const photoCount = [hasFotoVazio, hasFotoCarregado, hasFotoDistribuido].filter(Boolean).length;

  let fotosHtml = '';
  if (photoCount > 0) {
    // Smart photo assignment: "Peso Carregado" = heavier weight (chegada/bruto), 
    // "Peso Distribuído/Vazio" = lighter weight (after unloading)
    // If only carregado and distribuido exist and pesoBruto > pesoVazio, keep order;
    // otherwise swap to ensure labels match actual weights
    let finalFotoCarregado = fotoCarregadoSrc;
    let finalFotoDistribuido = fotoDistribuidoSrc;
    
    // If both photos exist but no vazio photo, the two photos represent carregado vs distribuido
    // Carregado = heavier (pesoBruto), Distribuído = lighter (pesoVazio/after distribution)
    // The photo order from sheet may be swapped, so we keep the mapped order from headers
    // (the fix is in Cal.tsx mapping, not here)
    
    const gridCols = photoCount >= 2 ? 'repeat(2, 1fr)' : '1fr';
    fotosHtml = `
      <div class="fotos-section">
        <h3>📸 Evidências Fotográficas</h3>
        <div class="fotos-grid" style="grid-template-columns: ${gridCols}">
          ${hasFotoCarregado ? `
          <div class="foto-item">
            <div class="foto-label">🏢 Peso Carregado</div>
            <img src="${finalFotoCarregado}" alt="Foto peso carregado" class="foto-img" referrerpolicy="no-referrer" onerror="this.onerror=null;tryAltSrc(this,'${record.fotoPesoCarregado.replace(/'/g, "\\'")}')" />
          </div>
          ` : ''}
          ${hasFotoDistribuido ? `
          <div class="foto-item">
            <div class="foto-label">🚛 Peso Distribuído (Obra)</div>
            <img src="${finalFotoDistribuido}" alt="Foto peso distribuído" class="foto-img" referrerpolicy="no-referrer" onerror="this.onerror=null;tryAltSrc(this,'${record.fotoPesoDistribuido.replace(/'/g, "\\'")}')" />
          </div>
          ` : ''}
          ${hasFotoVazio ? `
          <div class="foto-item">
            <div class="foto-label">⚖️ Peso Vazio</div>
            <img src="${fotoVazioSrc}" alt="Foto peso vazio" class="foto-img" referrerpolicy="no-referrer" onerror="this.onerror=null;tryAltSrc(this,'${record.fotoPesoVazio.replace(/'/g, "\\'")}')" />
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  const isEntrada = record.tipo.toLowerCase() === 'entrada';
  const pesoLiquido = record.pesoBruto > 0 && record.pesoVazio > 0 ? record.pesoBruto - record.pesoVazio : 0;
  const toneladaCalc = pesoLiquido > 100 ? pesoLiquido / 1000 : pesoLiquido;
  const hasDif = record.qtd > 0 && record.qtdBalancaObra > 0;
  const difTon = hasDif ? record.qtdBalancaObra - record.qtd : 0;

  const pesoBrutoOrigem = record.pesoBruto || 0;
  const pesoVazioOrigem = record.pesoVazio || 0;
  
  const pesoBrutoDestino = record.qtdBalancaObra ? (record.qtdBalancaObra * 1000 + pesoVazioOrigem) : 0;
  const pesoVazioDestino = pesoVazioOrigem; // Usually same truck weight


  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8" />
    <meta name="referrer" content="no-referrer" />
    <title>CAL ${record.tipo} ${record.prefixo} — ${record.data}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
      body { padding: 0; font-size: 11px; color: #1a1a2e; }

      .header {
        background: linear-gradient(135deg, #0e7490, #06b6d4);
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
      .header .tipo-badge {
        background: ${isEntrada ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        margin-top: 4px;
        display: inline-block;
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
        border: 2px solid #0891b2;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .peso-section .peso-header {
        background: #0891b2;
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
      .peso-cell.highlight { background: #ecfeff; }
      .peso-cell.dif-positiva .p-value { color: #2563eb; }
      .peso-cell.dif-negativa .p-value { color: #dc2626; }

      .peso-cell-small {
        text-align: center;
        padding: 4px;
      }
      .peso-cell-small .p-label { font-size: 8px; color: #6b7280; text-transform: uppercase; font-weight: 700; }
      .peso-cell-small .p-value { font-size: 14px; font-weight: 800; color: #1a1a2e; margin-top: 2px; }
      .peso-cell-small .p-unit { font-size: 8px; color: #9ca3af; }


      .fotos-section { margin-bottom: 16px; }
      .fotos-section h3 {
        font-size: 12px;
        font-weight: 700;
        color: #374151;
        margin-bottom: 10px;
        padding-bottom: 4px;
        border-bottom: 2px solid #0891b2;
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
        if (img.src.startsWith('data:') || img.src !== originalUrl) {
          img.src = originalUrl;
          img.referrerPolicy = 'no-referrer';
          img.onerror = function() {
            if (originalUrl.includes('supabase') && !originalUrl.includes('?download')) {
              img.src = originalUrl + (originalUrl.includes('?') ? '&' : '?') + 'download=';
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
        <h1>🧪 RELATÓRIO DE MOVIMENTAÇÃO — CAL</h1>
        ${obraConfig.nome ? `<p>${obraConfig.nome}</p>` : ''}
        ${obraConfig.local ? `<p>📍 ${obraConfig.local}</p>` : ''}
        <span class="tipo-badge">${isEntrada ? '📥 ENTRADA' : '📤 SAÍDA'}</span>
      </div>
      <div class="date-badge">
        📅 ${record.data}<br/>${record.hora}
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="label">🚛 Veículo</div>
        <div class="value">${record.prefixo || '—'}</div>
      </div>
      <div class="info-card">
        <div class="label">${isEntrada ? '🏭 Fornecedor' : '📍 Local'}</div>
        <div class="value">${isEntrada ? (record.fornecedor || '—') : (record.local || record.fornecedor || '—')}</div>
      </div>
      <div class="info-card">
        <div class="label">📋 Nota Fiscal</div>
        <div class="value">${record.nf || '—'}</div>
      </div>
      <div class="info-card">
        <div class="label">📊 Status</div>
        <div class="value">${record.status || 'Finalizado'}</div>
      </div>
    </div>

    <div class="peso-section" style="border-color: #0891b2; margin-bottom: 24px;">
      <div class="peso-header" style="background: #0891b2; display: flex; justify-content: space-between; align-items: center;">
        <span>📊 RESUMO DE PESAGEM</span>
        ${hasDif ? `<span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 10px;">DIFERENÇA: ${difTon > 0 ? '+' : ''}${fmt(difTon)} t</span>` : ''}
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: #fff;">
        <!-- Coluna ORIGEM (Ticket) -->
        <div style="border-right: 1px solid #cffafe; padding-bottom: 8px;">
          <div style="background: #ecfeff; padding: 6px 12px; font-size: 10px; font-weight: 800; color: #0e7490; border-bottom: 1px solid #cffafe; display: flex; align-items: center; gap: 6px;">
            🏗️ ORIGEM (Ticket)
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; padding: 12px;">
            <div class="peso-cell-small">
              <div class="p-label">Peso Bruto</div>
              <div class="p-value" style="font-size: 14px;">${record.pesoBruto > 0 ? record.pesoBruto.toLocaleString('pt-BR') : '—'}</div>
              <div class="p-unit">kg</div>
            </div>
            <div class="peso-cell-small">
              <div class="p-label">Peso Vazio</div>
              <div class="p-value" style="font-size: 14px;">${record.pesoVazio > 0 ? record.pesoVazio.toLocaleString('pt-BR') : '—'}</div>
              <div class="p-unit">kg</div>
            </div>
            <div class="peso-cell-small" style="background: #ecfeff; border-radius: 4px;">
              <div class="p-label" style="color: #0e7490;">Líquido (Ton)</div>
              <div class="p-value" style="font-size: 16px; color: #0e7490;">${record.qtd > 0 ? fmt(record.qtd) : '—'}</div>
              <div class="p-unit" style="color: #0e7490;">t</div>
            </div>
          </div>
        </div>

        <!-- Coluna DESTINO (Obra) -->
        <div>
          <div style="background: #ecfeff; padding: 6px 12px; font-size: 10px; font-weight: 800; color: #0e7490; border-bottom: 1px solid #cffafe; display: flex; align-items: center; gap: 6px;">
            🚧 DESTINO (Obra)
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; padding: 12px;">
            <div class="peso-cell-small">
              <div class="p-label">Peso Chegada</div>
              <div class="p-value" style="font-size: 14px;">${pesoBrutoDestino > 0 ? Math.round(pesoBrutoDestino).toLocaleString('pt-BR') : '—'}</div>
              <div class="p-unit">kg</div>
            </div>
            <div class="peso-cell-small">
              <div class="p-label">Peso Vazio</div>
              <div class="p-value" style="font-size: 14px;">${record.pesoVazio > 0 ? record.pesoVazio.toLocaleString('pt-BR') : '—'}</div>
              <div class="p-unit">kg</div>
            </div>
            <div class="peso-cell-small" style="background: #ecfeff; border-radius: 4px;">
              <div class="p-label" style="color: #0e7490;">Líquido (Ton)</div>
              <div class="p-value" style="font-size: 16px; color: #0e7490;">${record.qtdBalancaObra > 0 ? fmt(record.qtdBalancaObra) : '—'}</div>
              <div class="p-unit" style="color: #0e7490;">t</div>
            </div>
          </div>
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
