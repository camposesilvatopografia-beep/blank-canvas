import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface RdoPdfData {
  rdo: any;
  obra: any;
  efetivo: any[];
  equipamentos: any[];
  servicos: any[];
  fotos: { signedUrl: string; legenda: string }[];
  assinaturas?: Record<string, string>;
  /** Dados do aprovador que acabou de assinar no portal (para refletir no PDF imediatamente) */
  aprovadorOverride?: {
    slotNum: 1 | 2 | 3;
    status: 'Aprovado' | 'Reprovado';
    nome: string;
    cargo: string;
    cpf: string;
    dataHora: string; // ISO string
  };
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try { return format(new Date(d + (d.length === 10 ? 'T12:00:00' : '')), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return d; }
};

export async function generateRdoPdfBlob(data: RdoPdfData): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { rdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas = {}, aprovadorOverride } = data;

  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const M = 6;
  const CW = W - 2 * M; // content width
  let y = M;

  // ── Colors ──────────────────────────────────────────────────────────────
  const NAVY: [number, number, number] = [29, 53, 87];
  const NAVY2: [number, number, number] = [45, 90, 142];
  const LIGHT_BLUE: [number, number, number] = [220, 230, 245];
  const WHITE: [number, number, number] = [255, 255, 255];
  const GRAY_BG: [number, number, number] = [248, 248, 250];
  const HIGHLIGHT_BG: [number, number, number] = [255, 243, 200];
  const BORDER: [number, number, number] = [150, 150, 170];
  const DARK_GRAY: [number, number, number] = [70, 70, 80];

  // ── Helpers ─────────────────────────────────────────────────────────────
  const PAGE_H = 297;
  // Force single page - never add pages (signatures must always be on the same page)
  const ensurePage = (_need: number) => { /* no-op: single page mode */ };

  const cell = (
    x: number, cy: number, w: number, h: number,
    text: string, opts: {
      bg?: [number, number, number];
      bold?: boolean;
      size?: number;
      align?: 'left' | 'center' | 'right';
      color?: [number, number, number];
      border?: boolean;
      wrap?: boolean;
    } = {}
  ) => {
    const { bg, bold = false, size = 7, align = 'left', color = [0,0,0], border = true, wrap = false } = opts;
    if (bg) { doc.setFillColor(...bg); doc.rect(x, cy, w, h, 'F'); }
    if (border) { doc.setDrawColor(...BORDER); doc.setLineWidth(0.2); doc.rect(x, cy, w, h); }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const pad = 1.5;
    if (wrap) {
      const lines = doc.splitTextToSize(text, w - pad * 2);
      doc.text(lines, align === 'center' ? x + w / 2 : align === 'right' ? x + w - pad : x + pad, cy + pad + size * 0.35, { align });
    } else {
      const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - pad : x + pad;
      doc.text(text, tx, cy + h / 2 + size * 0.18, { align });
    }
    doc.setTextColor(0, 0, 0);
  };

  // ── HEADER PADRONIZADO (mesmo padrão dos demais relatórios) ─────────────
  // Tentar carregar logo da obra do localStorage
  const OBRA_CONFIG_KEY = 'apropriapp_obra_config';
  let logoDataUrl: string | null = null;
  try {
    const stored = localStorage.getItem(OBRA_CONFIG_KEY);
    if (stored) {
      const cfg = JSON.parse(stored);
      if (cfg.logo) logoDataUrl = cfg.logo;
    }
  } catch { /* ignore */ }

  const HDR_H = 20;
  const BLACK: [number, number, number] = [0, 0, 0];
  doc.setFillColor(...BLACK);
  doc.rect(M, y, CW, HDR_H, 'F');

  // Título
  const textX = M + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text('RELATÓRIO DIÁRIO DE OBRA', textX, y + 6);
  // Nome da etapa (maior e evidenciado)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  const obraNomeHdr = (obra.nome || '').toUpperCase();
  doc.text(obraNomeHdr, textX, y + 12, { maxWidth: CW - 70 });
  // Contrato abaixo da etapa (maior e evidenciado)
  const contratoText = obra.contrato ? obra.contrato.toUpperCase() : '';
  if (contratoText) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(220, 220, 220);
    doc.text(contratoText, textX, y + 17);
  }

  // RDO número (canto direito, acima)
  if (rdo.numero_rdo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(`RDO Nº ${rdo.numero_rdo}`, M + CW - 3, y + 6, { align: 'right' });
  }
  // Data por extenso (abaixo do título, canto direito)
  const fmtDateLong = (d: string) => {
    try {
      const dateObj = new Date(d + 'T12:00:00');
      const str = format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch { return d; }
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtDateLong(rdo.data), M + CW - 3, y + 12, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  y += HDR_H + 0.5;

  // ── OBJETO (inline compacto) ──────────────────────────────────────────────
  const objetoText = obra.objeto || obra.nome || '—';
  const objetoValueW = CW - 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  const objetoLines = doc.splitTextToSize(objetoText, objetoValueW - 4);
  const objetoH = Math.max(6, objetoLines.length * 3 + 3);

  cell(M, y, 20, objetoH, 'OBJETO:', { bg: LIGHT_BLUE, bold: true, size: 6.5, align: 'left' });
  cell(M + 20, y, objetoValueW, objetoH, '', { bg: WHITE, border: true });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);
  doc.text(objetoLines, M + 22, y + 3.5, { lineHeightFactor: 1.3 });
  y += objetoH;

  // ── DATA / PRAZOS DE VIGÊNCIA ─────────────────────────────────────────────
  const rowH = 8;
  const colW3 = CW / 3;
  const cols = [
    { label: 'DATA DA PUBLICAÇÃO:', value: fmtDate(obra.data_publicacao || rdo.data), w: colW3 },
    { label: 'PRAZO DE VIGENCIA INICIAL', value: (() => { const pub = obra.data_publicacao || rdo.data; if (!pub) return ''; const d = new Date(pub + 'T12:00:00'); d.setDate(d.getDate() + 540); return fmtDate(d.toISOString().split('T')[0]); })(), w: colW3 },
    { label: 'PRAZO DE VIGENCIA FINAL', value: fmtDate(obra.vigencia_final), w: colW3 },
  ];

  let cx = M;
  for (const c of cols) {
    const lh = 3.5; const vh = rowH - lh;
    cell(cx, y, c.w, lh, c.label, { bg: LIGHT_BLUE, bold: true, size: 6 });
    cell(cx, y + lh, c.w, vh, c.value, { bg: WHITE, bold: true, size: 7, align: 'center' });
    cx += c.w;
  }
  y += rowH;

  // ── DADOS CONTRATUAIS ───────────────────────────────────────────────────
  const dadosH = 4;
  cell(M, y, CW, dadosH, 'DADOS CONTRATUAIS', { bg: DARK_GRAY, bold: true, size: 7.5, align: 'center', border: true, color: WHITE });
  y += dadosH;

  const dc = [
    { label: 'DATA DA OS:', value: fmtDate(obra.data_inicio_contrato), w: CW / 3 },
    { label: 'PRAZO CONTRATUAL (DIAS):', value: String(obra.prazo_contratual_dias || '—'), w: CW / 3 },
    { label: 'PRAZO INICIAL CONTRATUAL:', value: fmtDate(obra.data_prazo_contratual), w: CW / 3 },
  ];

  cx = M;
  const dcLH = 3.5; const dcVH = 5;
  for (const c of dc) {
    cell(cx, y, c.w, dcLH, c.label, { bg: LIGHT_BLUE, bold: true, size: 6 });
    cell(cx, y + dcLH, c.w, dcVH, c.value, { bg: GRAY_BG, bold: true, size: 7, align: 'center' });
    cx += c.w;
  }
  y += dcLH + dcVH;

  // ── ADITIVOS E PARALISAÇÕES ──────────────────────────────────────────────
  cell(M, y, CW, dadosH, 'ADITIVOS E PARALIZAÇÕES', { bg: DARK_GRAY, bold: true, size: 7.5, align: 'center', color: WHITE });
  y += dadosH;

  const ad = [
    { label: 'DIAS ADITADOS:', value: String(obra.dias_aditados ?? 0), w: CW / 3 },
    { label: 'DIAS PARALIZADOS:', value: String(obra.dias_paralisados ?? 0), w: CW / 3 },
    { label: 'NOVO PRAZO CONTRATUAL:', value: fmtDate(obra.novo_prazo_contratual || rdo.novo_prazo_contratual), w: CW / 3 },
  ];

  cx = M;
  for (const c of ad) {
    const isHighlight = c.label.includes('NOVO PRAZO');
    cell(cx, y, c.w, dcLH, c.label, { bg: LIGHT_BLUE, bold: true, size: 5.5 });
    cell(cx, y + dcLH, c.w, dcVH, c.value, { bg: isHighlight ? HIGHLIGHT_BG : GRAY_BG, bold: true, size: 7, align: 'center' });
    cx += c.w;
  }

  y += dcLH + dcVH;

  // ── PRAZOS ──────────────────────────────────────────────────────────────
  cell(M, y, CW, dadosH, 'PRAZOS', { bg: DARK_GRAY, bold: true, size: 7.5, align: 'center', color: WHITE });
  y += dadosH;

  const prazos = [
    { label: 'PRAZO DECORRIDO:', value: String(rdo.prazo_decorrido ?? '—'), w: CW / 3 },
    { label: 'PRAZO RESTANTE:', value: (() => { if (!rdo.novo_prazo_contratual) return '—'; const hoje = new Date(); hoje.setHours(12,0,0,0); const np = new Date(rdo.novo_prazo_contratual + 'T12:00:00'); const diff = Math.ceil((np.getTime() - hoje.getTime()) / (1000*60*60*24)); return String(diff); })(), w: CW / 3 },
    { label: 'PRAZO RESTANTE DE VIGENCIA:', value: (() => { if (!obra.vigencia_final) return '—'; const hoje = new Date(); hoje.setHours(12,0,0,0); const vf = new Date(obra.vigencia_final + 'T12:00:00'); const diff = Math.ceil((vf.getTime() - hoje.getTime()) / (1000*60*60*24)); return String(diff); })(), w: CW / 3 },
  ];
  cx = M;
  for (const c of prazos) {
    const isHighlight = c.label.includes('VIGENCIA');
    cell(cx, y, c.w, dcLH, c.label, { bg: LIGHT_BLUE, bold: true, size: 6 });
    cell(cx, y + dcLH, c.w, dcVH, c.value, { bg: isHighlight ? HIGHLIGHT_BG : GRAY_BG, bold: true, size: 7, align: 'center' });
    cx += c.w;
  }
  y += dcLH + dcVH;

  // ── LICENÇAS ────────────────────────────────────────────────────────────
  cell(M, y, CW, dadosH, 'LICENÇAS', { bg: DARK_GRAY, bold: true, size: 7.5, align: 'center', color: WHITE });
  y += dadosH;

  const licItems = [
    { label: 'LICENÇA AMBIENTAL:', value: fmtDate(obra.licenca_ambiental) },
    { label: 'LICENÇA DO CANTEIRO:', value: fmtDate((obra as any).licenca_canteiro) },
    { label: 'ASV:', value: fmtDate((obra as any).asv) },
  ];
  const licW = CW / 3;
  cx = M;
  for (const c of licItems) {
    cell(cx, y, licW, dcLH, c.label, { bg: LIGHT_BLUE, bold: true, size: 6 });
    cell(cx, y + dcLH, licW, dcVH, c.value, { bg: GRAY_BG, bold: true, size: 7, align: 'center' });
    cx += licW;
  }
  y += dcLH + dcVH;

  // ── PLUVIOMETRIA + CONDIÇÃO DO TEMPO (3 KPIs) ─────────────────────────────
  y += 1;
  const pluvGap = 2;
  const pluvKpiW = (CW - pluvGap * 2) / 3;
  const pluvKpiH = 9;
  const PLUV_BG1: [number, number, number] = [25, 80, 140];
  const PLUV_LABEL1: [number, number, number] = [160, 200, 240];

  doc.setFillColor(...PLUV_BG1); doc.roundedRect(M, y, pluvKpiW, pluvKpiH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(...PLUV_LABEL1);
  doc.text('PRECIPITAÇÃO DO DIA', M + 3, y + 3.5);
  doc.setFontSize(9); doc.setTextColor(...WHITE);
  doc.text(`${rdo.precipitacao_dia ?? 0} mm`, M + pluvKpiW - 3, y + 6.5, { align: 'right' });

  const PLUV_BG2: [number, number, number] = [20, 120, 90];
  const PLUV_LABEL2: [number, number, number] = [160, 230, 200];
  const kpi2X = M + pluvKpiW + pluvGap;
  doc.setFillColor(...PLUV_BG2); doc.roundedRect(kpi2X, y, pluvKpiW, pluvKpiH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(...PLUV_LABEL2);
  doc.text('ACUMULADA NO MÊS', kpi2X + 3, y + 3.5);
  doc.setFontSize(9); doc.setTextColor(...WHITE);
  doc.text(`${rdo.precipitacao_acumulada_mes ?? 0} mm`, kpi2X + pluvKpiW - 3, y + 6.5, { align: 'right' });

  // 3rd KPI: Condição do Tempo
  const condicaoTexto = rdo.condicao_tempo || 'Bom';
  const condicaoBg: [number, number, number] = condicaoTexto === 'Impraticável' ? [180, 40, 40] : condicaoTexto === 'Instável' ? [180, 130, 20] : [30, 100, 60];
  const condicaoLabel: [number, number, number] = condicaoTexto === 'Impraticável' ? [255, 180, 180] : condicaoTexto === 'Instável' ? [255, 230, 160] : [160, 230, 180];
  const kpi3X = kpi2X + pluvKpiW + pluvGap;
  doc.setFillColor(...condicaoBg); doc.roundedRect(kpi3X, y, pluvKpiW, pluvKpiH, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(...condicaoLabel);
  doc.text('CONDIÇÃO DO TEMPO', kpi3X + 3, y + 3.5);
  doc.setFontSize(9); doc.setTextColor(...WHITE);
  doc.text(condicaoTexto, kpi3X + pluvKpiW - 3, y + 6.5, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  y += pluvKpiH + 2;

  // ── MÃO DE OBRA PRÓPRIA + EQUIPAMENTOS + MÃO DE OBRA TERCEIRIZADA ──────
  ensurePage(60);

  // Funções de MO Própria (ordenadas alfabeticamente)
  const MO_PROPRIA = [
    'Almoxarife', 'Apontador', 'Aprendiz / Assist. Adm.', 'Aux. Administrativo',
    'Aux. Laboratório', 'Borracheiro', 'Carpinteiro', 'Controlador Manut.',
    'Eletricista de Auto', 'Enc. Adm.', 'Enc. Geral', 'Enc. Laboratório',
    'Enc. Mecânica', 'Enc. Serv. Gerais', 'Enc. Terraplenagem',
    'Engenheiro', 'Frentista', 'Greidista', 'Laboratorista',
    'Lubrificador', 'Mecânico', 'Motoristas', 'Nivelador N1',
    'Operadores', 'Pedreiro', 'Servente', 'Tec. Seg.', 'Topógrafo', 'Vigia',
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Equipamentos (ordenados)
  const EQUIP_COL = [
    'Betoneira', 'Bomba de Concreto', 'Caminhão Basculante', 'Caminhão Comboio',
    'Caminhão Munck', 'Caminhão Pipa', 'Compactador de Solo', 'Escavadeira Hidráulica',
    'Guindaste', 'Moto Bomba', 'Motoniveladora', 'Ônibus',
    'Plataforma Elevatória', 'Retroescavadeira', 'Rolo Compactador',
    'Trator de Esteira', 'Trator de Pneu', 'Usina de Asfalto',
    'Veículos Leves', 'Vibrador de Concreto',
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // MO Terceirizada (ordenada)
  const MO_TERC = [
    'Caminhão Comboio', 'Caminhão Pipa', 'Engenheiro', 'Escavadeira Hidr.',
    'Lubrificador', 'Mecânico', 'Moto Bomba', 'Motorista',
    'Ônibus', 'Operador', 'Retro Escavadeira', 'Rolo Compactador',
    'Trator de Esteira', 'Trator de Pneu', 'Vigia',
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Separar efetivo entre própria e terceirizada
  const efetivoPropria = efetivo.filter((r: any) => r.empresa !== 'Terceirizada');
  const efetivoTerc = efetivo.filter((r: any) => r.empresa === 'Terceirizada');

  const getQtd = (list: any[], name: string, field = 'quantidade') => {
    const found = list.find((r: any) => {
      const fn = (r.funcao || r.equipamento || '').toLowerCase();
      return fn === name.toLowerCase();
    });
    if (!found) return 0;
    const val = found[field] ?? found.horas_trabalhadas ?? found.quantidade ?? 0;
    return Number(val) || 0;
  };

  // Header
  const colMoW = CW * 0.35;
  const colTeW = CW * 0.35;
  const colEqW = CW - colMoW - colTeW;
  const hdrH = 4;

  cell(M, y, colMoW, hdrH, 'MÃO DE OBRA PRÓPRIA:', { bg: LIGHT_BLUE, bold: true, size: 7, align: 'center' });
  cell(M + colMoW, y, colTeW, hdrH, 'MÃO DE OBRA TERCEIRIZADA:', { bg: LIGHT_BLUE, bold: true, size: 6.5, align: 'center' });
  cell(M + colMoW + colTeW, y, colEqW, hdrH, 'EQUIPAMENTOS:', { bg: LIGHT_BLUE, bold: true, size: 7, align: 'center' });
  y += hdrH;

  const rowHItem = 3.5;
  const numW = 8;

  // Filtrar apenas itens com quantidade > 0 para ganhar espaço
  const moPropriaFiltered = MO_PROPRIA.filter(name => getQtd(efetivoPropria, name) > 0);
  const equipFiltered = EQUIP_COL.filter(name => getQtd(equipamentos, name, 'horas_trabalhadas') > 0);
  const moTercFiltered = MO_TERC.filter(name => getQtd(efetivoTerc, name) > 0);

  // Incluir também registros do banco que não estão nas listas fixas
  const addedMoPropria = new Set(moPropriaFiltered.map(n => n.toLowerCase()));
  const addedEquip = new Set(equipFiltered.map(n => n.toLowerCase()));
  const addedTerc = new Set(moTercFiltered.map(n => n.toLowerCase()));

  for (const r of efetivoPropria) {
    const fn = (r.funcao || '').trim();
    if (fn && (Number(r.quantidade) || 0) > 0 && !addedMoPropria.has(fn.toLowerCase())) {
      moPropriaFiltered.push(fn);
      addedMoPropria.add(fn.toLowerCase());
    }
  }
  for (const r of efetivoTerc) {
    const fn = (r.funcao || '').trim();
    if (fn && (Number(r.quantidade) || 0) > 0 && !addedTerc.has(fn.toLowerCase())) {
      moTercFiltered.push(fn);
      addedTerc.add(fn.toLowerCase());
    }
  }
  for (const r of equipamentos) {
    const fn = (r.equipamento || '').trim();
    if (fn && (Number(r.horas_trabalhadas ?? r.quantidade ?? 0)) > 0 && !addedEquip.has(fn.toLowerCase())) {
      equipFiltered.push(fn);
      addedEquip.add(fn.toLowerCase());
    }
  }

  moPropriaFiltered.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  equipFiltered.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  moTercFiltered.sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const maxRows = Math.max(moPropriaFiltered.length, equipFiltered.length, moTercFiltered.length, 1);

  // Totais reais
  const totalMOReal = efetivoPropria.reduce((s: number, r: any) => s + (Number(r.quantidade) || 0), 0);
  const totalTercReal = efetivoTerc.reduce((s: number, r: any) => s + (Number(r.quantidade) || 0), 0);
  const totalEquipReal = equipamentos.reduce((s: number, r: any) => s + (Number(r.horas_trabalhadas ?? r.quantidade ?? 0)), 0);
  let totalMO = 0, totalEquip = 0, totalTerc = 0;

  for (let i = 0; i < maxRows; i++) {
    ensurePage(rowHItem);
    const moFunc = moPropriaFiltered[i] || '';
    const teFunc = moTercFiltered[i] || '';
    const eqFunc = equipFiltered[i] || '';
    const moQtd = moFunc ? getQtd(efetivoPropria, moFunc) : 0;
    const teQtd = teFunc ? getQtd(efetivoTerc, teFunc) : 0;
    const eqQtd = eqFunc ? getQtd(equipamentos, eqFunc, 'horas_trabalhadas') : 0;
    totalMO += moQtd; totalEquip += eqQtd; totalTerc += teQtd;

    // MO Própria col
    cell(M, y, colMoW - numW, rowHItem, moFunc, { bg: i % 2 === 0 ? WHITE : GRAY_BG, size: 5.8 });
    cell(M + colMoW - numW, y, numW, rowHItem, moQtd > 0 ? String(moQtd) : '', { bg: i % 2 === 0 ? WHITE : GRAY_BG, size: 6, bold: true, align: 'center' });

    // MO Terceirizada col
    cell(M + colMoW, y, colTeW - numW, rowHItem, teFunc, { bg: i % 2 === 0 ? WHITE : GRAY_BG, size: 5.8 });
    cell(M + colMoW + colTeW - numW, y, numW, rowHItem, teQtd > 0 ? String(teQtd) : '', { bg: i % 2 === 0 ? WHITE : GRAY_BG, size: 6, bold: true, align: 'center' });

    // Equipamentos col
    cell(M + colMoW + colTeW, y, colEqW - numW, rowHItem, eqFunc, { bg: i % 2 === 0 ? WHITE : GRAY_BG, size: 5.8 });
    cell(M + colMoW + colTeW + colEqW - numW, y, numW, rowHItem, eqQtd > 0 ? String(eqQtd) : '', { bg: i % 2 === 0 ? WHITE : GRAY_BG, size: 6, bold: true, align: 'center' });

    y += rowHItem;
  }

  // Totals row
  ensurePage(6);
  const totH = 4;
  cell(M, y, colMoW - numW, totH, 'TOTAL MÃO DE OBRA', { bg: LIGHT_BLUE, bold: true, size: 6.5 });
  cell(M + colMoW - numW, y, numW, totH, String(totalMOReal), { bg: LIGHT_BLUE, bold: true, size: 7, align: 'center' });
  cell(M + colMoW, y, colTeW - numW, totH, 'TOTAL TERCEIRIZADOS', { bg: LIGHT_BLUE, bold: true, size: 6.5 });
  cell(M + colMoW + colTeW - numW, y, numW, totH, String(totalTercReal), { bg: LIGHT_BLUE, bold: true, size: 7, align: 'center' });
  cell(M + colMoW + colTeW, y, colEqW - numW, totH, 'TOTAL EQUIPAMENTOS', { bg: LIGHT_BLUE, bold: true, size: 6.5 });
  cell(M + colMoW + colTeW + colEqW - numW, y, numW, totH, String(totalEquipReal), { bg: LIGHT_BLUE, bold: true, size: 7, align: 'center' });
  y += totH + 1;

  // ── SERVIÇOS (if any) ────────────────────────────────────────────────────
  if (servicos.length > 0) {
    ensurePage(10);
    cell(M, y, CW, dadosH, 'SERVIÇOS EXECUTADOS', { bg: DARK_GRAY, bold: true, size: 7.5, align: 'center', color: WHITE });
    y += dadosH;
    for (const s of servicos) {
      if (!s.descricao) continue;
      const txt = `• ${s.descricao}${s.local_servico ? ` — ${s.local_servico}` : ''}${s.quantidade_executada ? ` [Exec: ${s.quantidade_executada} ${s.unidade || ''}]` : ''}`;
      const lines = doc.splitTextToSize(txt, CW - 4);
      const h = Math.max(5, lines.length * 4);
      ensurePage(h);
      cell(M, y, CW, h, '', { bg: WHITE, border: true });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(30, 30, 30);
      doc.text(lines, M + 2, y + 3);
      y += h;
    }
  }

  // ── COMENTÁRIOS (3 seções — sem preenchimento) ──────────────────────────
  const comentSection = (title: string, value: string) => {
    cell(M, y, CW, dadosH, title, { bg: LIGHT_BLUE, bold: true, size: 6.5, align: 'left' });
    y += dadosH;
    const contentH = 10;
    cell(M, y, CW, contentH, '', { bg: WHITE, border: true });
    if (value?.trim()) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(value, CW - 4);
      doc.text(lines.slice(0, 4), M + 2, y + 3, { lineHeightFactor: 1.2 });
    }
    y += contentH;
  };

  comentSection('COMENTÁRIOS CONSTRUTORA', rdo.comentarios_construtora || '');
  comentSection('COMENTÁRIOS GERENCIADORA', rdo.comentarios_gerenciadora || '');
  comentSection('COMENTÁRIOS FISCALIZAÇÃO', rdo.comentarios_fiscalizacao || '');

  const fotosValidas = fotos.filter(f => f.signedUrl);

  // ── VISTO / ASSINATURA — 3 boxes com carimbo digital ────────────────────
  // Montar slots aplicando override do aprovador que acabou de assinar
  const SIG_H = 30;

  const buildSlotDefs = () => {
    const base = [
      { title: 'VISTO CONSTRUTORA', slotN: 1, nome: obra.aprovador1_nome || '', cargo: obra.aprovador1_cargo || '', cpf: obra.aprovador1_cpf || '', assinaturaUrl: assinaturas['assinatura1_url'] || null, status: rdo.aprovacao1_status, dataAss: rdo.aprovacao1_data },
      { title: 'VISTO GERENCIADORA', slotN: 2, nome: obra.aprovador2_nome || '', cargo: obra.aprovador2_cargo || '', cpf: obra.aprovador2_cpf || '', assinaturaUrl: assinaturas['assinatura2_url'] || null, status: rdo.aprovacao2_status, dataAss: rdo.aprovacao2_data },
      { title: 'VISTO FISCALIZAÇÃO',  slotN: 3, nome: obra.aprovador3_nome || '', cargo: obra.aprovador3_cargo || '', cpf: obra.aprovador3_cpf || '', assinaturaUrl: assinaturas['assinatura3_url'] || null, status: rdo.aprovacao3_status, dataAss: rdo.aprovacao3_data },
    ];
    // Aplicar dados do aprovador que acabou de assinar (não tem assinatura salva ainda, mas os metadados já existem)
    if (aprovadorOverride) {
      const idx = aprovadorOverride.slotNum - 1;
      base[idx] = {
        ...base[idx],
        status: aprovadorOverride.status,
        dataAss: aprovadorOverride.dataHora,
        nome: aprovadorOverride.nome || base[idx].nome,
        cargo: aprovadorOverride.cargo || base[idx].cargo,
        cpf: aprovadorOverride.cpf || base[idx].cpf,
      };
    }
    return base;
  };

  const slotDefs = buildSlotDefs();

  const assinaturaDataUrls = await Promise.all(
    slotDefs.map(s => s.assinaturaUrl ? fetchImageAsDataUrl(s.assinaturaUrl) : Promise.resolve(null))
  );

  // Tentar manter assinaturas na mesma página — se não couber, nova página
  ensurePage(SIG_H + 8);
  // Label header antes dos boxes
  cell(M, y, CW, 5, 'VISTOS E ASSINATURAS', { bg: DARK_GRAY, bold: true, size: 7.5, align: 'center', color: WHITE });
  y += 5;
  ensurePage(SIG_H);

  const boxW = CW / 3;

  const maskCpfPdf = (cpf: string) => {
    const d = cpf.replace(/\D/g, '');
    if (d.length === 14) return `${d.slice(0,2)}.***.***/****-${d.slice(12,14)}`;
    if (d.length !== 11) return cpf;
    return `${d.slice(0,3)}.***.***.${d.slice(9,11)}`;
  };

  const genCode = (nome: string, dt: string, rdoId?: string) => {
    const str = `${nome}|${dt}|${rdoId || ''}`;
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; }
    return Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
  };

  for (let i = 0; i < slotDefs.length; i++) {
    const slot = slotDefs[i];
    const imgData = assinaturaDataUrls[i];
    const bx = M + i * boxW;

    const isAprovado = slot.status === 'Aprovado';
    const isReprovado = slot.status === 'Reprovado';
    const isPendente = !isAprovado && !isReprovado;

    const hColor: [number, number, number] = isAprovado ? [22, 163, 74] : isReprovado ? [220, 38, 38] : [100, 110, 140];
    const statusLabel = isAprovado ? '✔ APROVADO' : isReprovado ? '✖ REPROVADO' : 'PENDENTE';

    // Outer box — clean thin border, no fill
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
    doc.rect(bx, y, boxW, SIG_H);

    // Header bar with status color
    doc.setFillColor(...hColor);
    doc.rect(bx, y, boxW, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(...WHITE);
    doc.text(slot.title, bx + 2, y + 3);
    doc.setFontSize(5.5);
    doc.text(statusLabel, bx + boxW - 2, y + 3.5, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    let innerY = y + 5.5;

    // ── Nome do aprovador (sempre visível) ──
    if (slot.nome) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.setTextColor(30, 30, 50);
      const nomeLines = doc.splitTextToSize(slot.nome, boxW - 8);
      doc.text(nomeLines, bx + 3, innerY + 3.5);
      innerY += 3 + nomeLines.length * 3;
      if (slot.cargo) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(100, 100, 120);
        doc.text(slot.cargo, bx + 3, innerY + 1);
        innerY += 3.5;
      }
    }

    // ── Signature image area ──
    if (imgData) {
      const imgAreaH = 10;
      doc.setDrawColor(200, 200, 210); doc.setLineWidth(0.15);
      doc.rect(bx + 2, innerY, boxW - 4, imgAreaH);
      doc.addImage(imgData, 'PNG', bx + 3, innerY + 1, boxW - 6, imgAreaH - 2);
      innerY += imgAreaH + 1;
    } else if (isPendente) {
      const imgAreaH = 8;
      doc.setDrawColor(210, 210, 220); doc.setLineWidth(0.15);
      doc.rect(bx + 2, innerY, boxW - 4, imgAreaH);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(180, 180, 190);
      doc.text('Aguardando assinatura', bx + boxW / 2, innerY + imgAreaH / 2 + 1, { align: 'center' });
      innerY += imgAreaH + 1;
    }

    // ── Digital Stamp / Carimbo Digital (only when signed) ──
    if (slot.nome && !isPendente) {
      const stampH = SIG_H - (innerY - y) - 1;
      const stampBorder: [number, number, number] = isAprovado ? [134, 239, 172] : [252, 165, 165];

      doc.setDrawColor(...stampBorder); doc.setLineWidth(0.2);
      doc.rect(bx + 2, innerY, boxW - 4, stampH);

      // Banner "Assinado Eletronicamente"
      doc.setFillColor(...hColor);
      doc.rect(bx + 2, innerY, boxW - 4, 4, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5); doc.setTextColor(...WHITE);
      doc.text('Assinado Eletronicamente', bx + boxW / 2, innerY + 2.7, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      const stampX = bx + 3.5;
      const lineH = 3;
      let sy = innerY + 5;

      // CPF/CNPJ mascarado
      if (slot.cpf) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(60, 60, 80);
        doc.text(`Doc: ${maskCpfPdf(slot.cpf)}`, stampX, sy, { maxWidth: boxW - 7 }); sy += lineH;
      }

      // Data e hora
      if (slot.dataAss) {
        try {
          const dt = new Date(slot.dataAss);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(60, 60, 80);
          doc.text(`${format(dt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} (BSB)`, stampX, sy, { maxWidth: boxW - 7 }); sy += lineH;
        } catch { /* skip */ }
      }

      // Código de verificação
      const code = slot.dataAss ? genCode(slot.nome, slot.dataAss, rdo.id) : '--------';
      doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5); doc.setTextColor(100, 100, 120);
      doc.text(`COD: ${code}`, stampX, sy + 0.5, { maxWidth: boxW - 8 }); sy += lineH;

      // Nota legal
      doc.setFont('helvetica', 'italic'); doc.setFontSize(3.5); doc.setTextColor(160, 160, 180);
      doc.text('Lei 14.063/2020 · MP 2.200-2/2001', stampX, sy, { maxWidth: boxW - 7 });
    } else if (isPendente) {
      const stampH = SIG_H - (innerY - y) - 1;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(180, 180, 200);
      doc.text('Aprovação pendente', bx + boxW / 2, innerY + stampH / 2, { align: 'center' });
    }

    doc.setTextColor(0, 0, 0); doc.setLineWidth(0.3);
  }

  // ── FOTOS em página separada (se houver) ───────────────────────────────
  if (fotosValidas.length > 0) {
    doc.addPage();
    let fy = M;
    cell(M, fy, CW, dadosH, `FOTOS DA OBRA (${fotosValidas.length})`, { bg: DARK_GRAY, bold: true, size: 7.5, align: 'center', color: WHITE });
    fy += dadosH;
    const cols2 = 2; const gap = 4;
    const imgW = (CW - gap * (cols2 - 1)) / cols2;
    const imgH = imgW * 0.62;
    let col = 0;
    for (const foto of fotosValidas) {
      try {
        const response = await fetch(foto.signedUrl);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        if (fy + imgH + 10 > PAGE_H - 12) { doc.addPage(); fy = M; }
        const fx = M + col * (imgW + gap);
        doc.addImage(dataUrl, 'JPEG', fx, fy, imgW, imgH);
        if (foto.legenda) {
          doc.setFontSize(6); doc.setTextColor(80, 80, 80);
          doc.text(foto.legenda, fx + imgW / 2, fy + imgH + 3, { align: 'center', maxWidth: imgW });
          doc.setTextColor(0, 0, 0);
        }
        col++;
        if (col >= cols2) { col = 0; fy += imgH + (foto.legenda ? 8 : 5); }
      } catch { /* skip */ }
    }
  }

  return doc.output('blob');
}

export async function uploadRdoPdf(data: RdoPdfData): Promise<string | null> {
  try {
    const blob = await generateRdoPdfBlob(data);
    const { rdo } = data;
    const dataFmt = format(new Date(rdo.data + 'T12:00:00'), 'yyyy-MM-dd', { locale: ptBR });
    const fileName = `rdo_${rdo.id}_${dataFmt}.pdf`;
    const storagePath = `pdfs/${rdo.obra_id}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('rdo-fotos').upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });
    if (uploadError) { console.error('Erro ao fazer upload do PDF:', uploadError); return null; }
    await supabase.from('rdos').update({ pdf_path: storagePath }).eq('id', rdo.id);
    return storagePath;
  } catch (err) {
    console.error('Erro ao gerar/enviar PDF:', err);
    return null;
  }
}

export async function getRdoPdfSignedUrl(pdfPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('rdo-fotos').createSignedUrl(pdfPath, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
