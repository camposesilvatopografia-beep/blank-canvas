import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useAppLogo } from '@/hooks/useAppLogo';
import { useIsMobile } from '@/hooks/use-mobile';
import defaultLogo from '@/assets/logo-apropriapp.png';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface PluviometriaRow {
  data: string;
  quantidade: number;
  dia: number;
  mes: number;
  ano: number;
}

interface PluviometriaPdfExportProps {
  filteredRows: PluviometriaRow[];
  allRows: PluviometriaRow[];
  filterMes: number;
  filterAno: number;
}

// Helper to draw header
async function drawHeader(pdf: any, M: number, CW: number, HEADER_H: number, activeLogo: string, obraConfig: any, filterMes: number, filterAno: number) {
  pdf.setFillColor(29, 53, 87);
  pdf.roundedRect(M, M, CW, HEADER_H, 2, 2, 'F');

  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      logoImg.src = activeLogo;
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const logoH = HEADER_H - 3;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(M + 2, M + 1.5, logoW + 2, logoH, 1, 1, 'F');
      pdf.addImage(logoImg, 'PNG', M + 3, M + 1.5, logoW, logoH);
    }
  } catch { /* ignore */ }

  const textX = CW / 2 + M;
  let textY = M + 6;
  if (obraConfig.nome) {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(obraConfig.nome, textX, textY, { align: 'center' });
    textY += 4;
  }
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(`CONTROLE PLUVIOMÉTRICO — ${MESES[filterMes - 1].toUpperCase()} ${filterAno}`, textX, textY, { align: 'center' });
}

function drawFooter(pdf: any, M: number, pageW: number, footerY: number, obraConfig: any) {
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Fonte: ${obraConfig.nome || 'ApropriaAPP'}`, M, footerY);
  pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageW - M, footerY, { align: 'right' });
}

export function PluviometriaPdfExport({ filteredRows, allRows, filterMes, filterAno }: PluviometriaPdfExportProps) {
  const [exporting, setExporting] = useState(false);
  const { obraConfig } = useObraConfig();
  const { customLogo } = useAppLogo();
  const isMobile = useIsMobile();
  const activeLogo = customLogo || obraConfig.logo || defaultLogo;

  const handleExport = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');

      // Data prep (shared)
      const daysInMonth = new Date(filterAno, filterMes, 0).getDate();
      const dailyMap = new Map<number, number>();
      filteredRows.forEach(r => dailyMap.set(r.dia, r.quantidade));
      const acumuladoMes = filteredRows.reduce((s, r) => s + r.quantidade, 0);
      const diasChuvosos = filteredRows.filter(r => r.quantidade > 0).length;
      const maxPrecip = filteredRows.length > 0 ? Math.max(...filteredRows.map(r => r.quantidade)) : 1;
      const monthlyTotals: number[] = [];
      for (let m = 1; m <= 12; m++) {
        monthlyTotals.push(allRows.filter(r => r.mes === m && r.ano === filterAno).reduce((s, r) => s + r.quantidade, 0));
      }
      const maxMonthly = Math.max(...monthlyTotals, 1);
      const totalAnual = monthlyTotals.reduce((a, b) => a + b, 0);
      const diasChuvososAno = allRows.filter(r => r.ano === filterAno && r.quantidade > 0).length;
      const recordeDiario = allRows.filter(r => r.ano === filterAno).length > 0
        ? Math.max(...allRows.filter(r => r.ano === filterAno).map(r => r.quantidade)) : 0;
      const mediaChuvoso = diasChuvososAno > 0 ? totalAnual / diasChuvososAno : 0;

      if (isMobile) {
        // ===== MOBILE: Portrait A4, single column, larger fonts =====
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const PW = 210, PH = 297, M = 8;
        const CW = PW - M * 2;
        const HEADER_H = 16;

        await drawHeader(pdf, M, CW, HEADER_H, activeLogo, obraConfig, filterMes, filterAno);

        let cy = M + HEADER_H + 5;

        // --- KPIs (3x2 grid) ---
        const kpis = [
          { label: 'Acumulado Mês', value: `${acumuladoMes.toFixed(0)} mm`, color: [220, 50, 50] as [number, number, number] },
          { label: 'Dias Chuvosos (mês)', value: `${diasChuvosos}`, color: [29, 53, 87] as [number, number, number] },
          { label: 'Acumulado Anual', value: `${totalAnual.toFixed(0)} mm`, color: [66, 133, 244] as [number, number, number] },
          { label: 'Dias Chuvosos (ano)', value: `${diasChuvososAno}`, color: [29, 53, 87] as [number, number, number] },
          { label: 'Recorde Diário', value: `${recordeDiario.toFixed(1)} mm`, color: [220, 50, 50] as [number, number, number] },
          { label: 'Média/Dia Chuvoso', value: `${mediaChuvoso.toFixed(1)} mm`, color: [29, 53, 87] as [number, number, number] },
        ];

        const kpiBoxW = (CW - 4) / 3;
        const kpiBoxH = 16;
        kpis.forEach((kpi, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const kx = M + col * (kpiBoxW + 2);
          const ky = cy + row * (kpiBoxH + 2);
          pdf.setFillColor(245, 248, 255);
          pdf.roundedRect(kx, ky, kpiBoxW, kpiBoxH, 1.5, 1.5, 'F');
          pdf.setDrawColor(210, 220, 235);
          pdf.roundedRect(kx, ky, kpiBoxW, kpiBoxH, 1.5, 1.5, 'S');
          pdf.setFillColor(...kpi.color);
          pdf.rect(kx + 0.5, ky, kpiBoxW - 1, 1.2, 'F');
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...kpi.color);
          pdf.text(kpi.value, kx + kpiBoxW / 2, ky + 9, { align: 'center' });
          pdf.setFontSize(5.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(kpi.label, kx + kpiBoxW / 2, ky + 13.5, { align: 'center' });
        });
        cy += 2 * (kpiBoxH + 2) + 3;

        // --- Daily bar chart (full width) ---
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(29, 53, 87);
        pdf.text('Precipitação Diária (mm)', M, cy);
        cy += 4;

        const maxScale = Math.max(maxPrecip, 30);
        const labelW = 16;
        const maxBarW = CW - labelW - 16;
        const barH = Math.min(4.5, (PH - cy - 80) / daysInMonth);
        const barGap = 0.4;

        // Scale
        const scaleValues = [0, 10, 20, 30];
        pdf.setFontSize(5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(140, 140, 140);
        scaleValues.forEach(v => {
          if (v <= maxScale) {
            const sx = M + labelW + (v / maxScale) * maxBarW;
            pdf.text(`${v}`, sx, cy, { align: 'center' });
          }
        });
        cy += 2;

        // Grid lines
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.08);
        scaleValues.forEach(v => {
          if (v <= maxScale) {
            const sx = M + labelW + (v / maxScale) * maxBarW;
            pdf.line(sx, cy, sx, cy + daysInMonth * (barH + barGap));
          }
        });

        for (let d = 1; d <= daysInMonth; d++) {
          const y = cy + (d - 1) * (barH + barGap);
          const dateStr = `${d.toString().padStart(2, '0')}/${filterMes.toString().padStart(2, '0')}`;
          const precip = dailyMap.get(d) || 0;
          pdf.setFontSize(5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(60, 60, 60);
          pdf.text(dateStr, M, y + barH - 0.3);

          if (d % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(M + labelW, y, maxBarW, barH, 'F');
          }

          if (precip > 0) {
            const bw = (precip / maxScale) * maxBarW;
            pdf.setFillColor(66, 133, 244);
            pdf.rect(M + labelW, y, bw, barH, 'F');
            pdf.setFontSize(5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(29, 53, 87);
            pdf.text(`${precip}`, M + labelW + bw + 1, y + barH - 0.3);
          }
        }

        cy += daysInMonth * (barH + barGap) + 5;

        // --- Monthly bar chart (full width) ---
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(29, 53, 87);
        pdf.text(`Acumulado Mensal ${filterAno}`, M, cy);
        cy += 4;

        const mBarChartH = Math.min(35, PH - cy - 15);
        const mBarChartW = CW - 12;
        const mBarX = M + 8;
        const mVBarW = (mBarChartW - 12 * 2) / 12;

        // Y grid
        pdf.setDrawColor(235, 235, 235);
        pdf.setLineWidth(0.08);
        for (let i = 0; i <= 4; i++) {
          const gy = cy + mBarChartH - (i / 4) * mBarChartH;
          pdf.line(mBarX, gy, mBarX + mBarChartW, gy);
          pdf.setFontSize(4.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(140, 140, 140);
          pdf.text(`${Math.round((i / 4) * maxMonthly)}`, mBarX - 1, gy + 1, { align: 'right' });
        }

        for (let m = 0; m < 12; m++) {
          const bx = mBarX + m * (mVBarW + 2);
          const bh = monthlyTotals[m] > 0 ? (monthlyTotals[m] / maxMonthly) * mBarChartH : 0;
          const by = cy + mBarChartH - bh;
          if (bh > 0) {
            pdf.setFillColor(m + 1 === filterMes ? 66 : 150, m + 1 === filterMes ? 133 : 185, m + 1 === filterMes ? 244 : 235);
            pdf.rect(bx, by, mVBarW, bh, 'F');
            if (monthlyTotals[m] > 0) {
              pdf.setFontSize(4.5);
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(29, 53, 87);
              pdf.text(`${monthlyTotals[m].toFixed(0)}`, bx + mVBarW / 2, by - 1, { align: 'center' });
            }
          }
          pdf.setFontSize(5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          pdf.text(MESES[m].substring(0, 3), bx + mVBarW / 2, cy + mBarChartH + 4, { align: 'center' });
        }

        // Axis
        pdf.setDrawColor(29, 53, 87);
        pdf.setLineWidth(0.2);
        pdf.line(mBarX, cy, mBarX, cy + mBarChartH);
        pdf.line(mBarX, cy + mBarChartH, mBarX + mBarChartW, cy + mBarChartH);

        drawFooter(pdf, M, PW, PH - M, obraConfig);

        const fileName = `Controle_Pluviometrico_${MESES[filterMes - 1]}_${filterAno}.pdf`;
        pdf.save(fileName);
      } else {
        // ===== DESKTOP: Landscape A4, 3 columns (original) =====
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const A4_W = 297, A4_H = 210, M = 6;
        const CW = A4_W - M * 2;
        const HEADER_H = 16;

        await drawHeader(pdf, M, CW, HEADER_H, activeLogo, obraConfig, filterMes, filterAno);

        const contentTop = M + HEADER_H + 3;
        const contentH = A4_H - contentTop - M - 4;
        const footerY = A4_H - M;

        const col1W = CW * 0.42;
        const col2W = CW * 0.28;
        const col3W = CW * 0.26;
        const colGap = (CW - col1W - col2W - col3W) / 2;
        const col1X = M;
        const col2X = col1X + col1W + colGap;
        const col3X = col2X + col2W + colGap;

        // Column 1: Daily bars
        let cy = contentTop;
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(29, 53, 87);
        pdf.text('Precipitação Diária (mm)', col1X, cy);
        cy += 3;

        const maxScale = Math.max(maxPrecip, 30);
        const labelW = 18;
        const maxBarW = col1W - labelW - 14;
        const barH = Math.min(3.2, (contentH - 6) / daysInMonth);
        const barGap = 0.3;

        const scaleValues = [0, 10, 20, 30];
        pdf.setFontSize(4.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(140, 140, 140);
        scaleValues.forEach(v => {
          if (v <= maxScale) {
            const sx = col1X + labelW + (v / maxScale) * maxBarW;
            pdf.text(`${v}`, sx, cy, { align: 'center' });
          }
        });
        cy += 1.5;

        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.08);
        scaleValues.forEach(v => {
          if (v <= maxScale) {
            const sx = col1X + labelW + (v / maxScale) * maxBarW;
            pdf.line(sx, cy, sx, cy + daysInMonth * (barH + barGap));
          }
        });

        for (let d = 1; d <= daysInMonth; d++) {
          const y = cy + (d - 1) * (barH + barGap);
          const dateStr = `${d.toString().padStart(2, '0')}/${filterMes.toString().padStart(2, '0')}`;
          const precip = dailyMap.get(d) || 0;
          pdf.setFontSize(4.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(60, 60, 60);
          pdf.text(dateStr, col1X, y + barH - 0.3);
          if (d % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(col1X + labelW, y, maxBarW, barH, 'F');
          }
          if (precip > 0) {
            const bw = (precip / maxScale) * maxBarW;
            pdf.setFillColor(66, 133, 244);
            pdf.rect(col1X + labelW, y, bw, barH, 'F');
            pdf.setFontSize(4);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(29, 53, 87);
            pdf.text(`${precip}`, col1X + labelW + bw + 1, y + barH - 0.3);
          }
        }

        // Column 2: Monthly chart + comparison table
        let c2y = contentTop;
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(29, 53, 87);
        pdf.text(`Acumulado Mensal ${filterAno}`, col2X, c2y);
        c2y += 4;

        const barChartH = contentH * 0.55;
        const barChartW = col2W - 10;
        const vBarW = (barChartW - 12 * 1.5) / 12;
        const barChartX = col2X + 6;

        const ySteps = 4;
        pdf.setDrawColor(235, 235, 235);
        pdf.setLineWidth(0.08);
        for (let i = 0; i <= ySteps; i++) {
          const gy = c2y + barChartH - (i / ySteps) * barChartH;
          pdf.line(barChartX, gy, barChartX + barChartW, gy);
          pdf.setFontSize(4);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(140, 140, 140);
          pdf.text(`${Math.round((i / ySteps) * maxMonthly)}`, barChartX - 1, gy + 1, { align: 'right' });
        }

        for (let m = 0; m < 12; m++) {
          const bx = barChartX + m * (vBarW + 1.5);
          const bh = monthlyTotals[m] > 0 ? (monthlyTotals[m] / maxMonthly) * barChartH : 0;
          const by = c2y + barChartH - bh;
          if (bh > 0) {
            pdf.setFillColor(m + 1 === filterMes ? 66 : 150, m + 1 === filterMes ? 133 : 185, m + 1 === filterMes ? 244 : 235);
            pdf.rect(bx, by, vBarW, bh, 'F');
            if (monthlyTotals[m] > 0) {
              pdf.setFontSize(3.5);
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(29, 53, 87);
              pdf.text(`${monthlyTotals[m].toFixed(0)}`, bx + vBarW / 2, by - 1, { align: 'center' });
            }
          }
          pdf.setFontSize(4);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          pdf.text(MESES[m].substring(0, 3), bx + vBarW / 2, c2y + barChartH + 3, { align: 'center' });
        }

        pdf.setDrawColor(29, 53, 87);
        pdf.setLineWidth(0.2);
        pdf.line(barChartX, c2y, barChartX, c2y + barChartH);
        pdf.line(barChartX, c2y + barChartH, barChartX + barChartW, c2y + barChartH);

        let tblY = c2y + barChartH + 8;
        const allYears = [...new Set(allRows.map(r => r.ano).filter(y => y > 0))].sort((a, b) => b - a).slice(0, 3);

        if (allYears.length > 1) {
          pdf.setFontSize(6);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(29, 53, 87);
          pdf.text('Comparativo Anual', col2X, tblY);
          tblY += 2;
          const tH = 4.5;
          const tW = col2W;
          pdf.setFillColor(29, 53, 87);
          pdf.rect(col2X, tblY, tW, tH, 'F');
          pdf.setFontSize(4.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.text('Mês', col2X + 2, tblY + 3);
          const yrColW = (tW - 14) / allYears.length;
          allYears.forEach((yr, i) => {
            pdf.text(`${yr}`, col2X + 14 + yrColW * i + yrColW / 2, tblY + 3, { align: 'center' });
          });
          tblY += tH;
          for (let m = 1; m <= 12; m++) {
            if (m % 2 === 0) {
              pdf.setFillColor(248, 248, 248);
              pdf.rect(col2X, tblY, tW, tH, 'F');
            }
            pdf.setFontSize(4);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(MESES[m - 1].substring(0, 3), col2X + 2, tblY + 3);
            allYears.forEach((yr, i) => {
              const total = allRows.filter(r => r.mes === m && r.ano === yr).reduce((s, r) => s + r.quantidade, 0);
              pdf.setFont('helvetica', total > 0 ? 'bold' : 'normal');
              pdf.setTextColor(total > 0 ? 29 : 170, total > 0 ? 53 : 170, total > 0 ? 87 : 170);
              pdf.text(total > 0 ? `${total.toFixed(0)}` : '-', col2X + 14 + yrColW * i + yrColW / 2, tblY + 3, { align: 'center' });
            });
            tblY += tH;
          }
          pdf.setFillColor(29, 53, 87);
          pdf.rect(col2X, tblY, tW, tH + 0.5, 'F');
          pdf.setFontSize(4.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.text('TOTAL', col2X + 2, tblY + 3.5);
          allYears.forEach((yr, i) => {
            const total = allRows.filter(r => r.ano === yr).reduce((s, r) => s + r.quantidade, 0);
            pdf.text(`${total.toFixed(0)}`, col2X + 14 + yrColW * i + yrColW / 2, tblY + 3.5, { align: 'center' });
          });
        }

        // Column 3: KPIs
        let c3y = contentTop;
        const kpis = [
          { label: 'Acumulado Mês', value: `${acumuladoMes.toFixed(0)} mm`, color: [220, 50, 50] as [number, number, number] },
          { label: 'Dias Chuvosos (mês)', value: `${diasChuvosos}`, color: [29, 53, 87] as [number, number, number] },
          { label: 'Acumulado Anual', value: `${totalAnual.toFixed(0)} mm`, color: [66, 133, 244] as [number, number, number] },
          { label: 'Dias Chuvosos (ano)', value: `${diasChuvososAno}`, color: [29, 53, 87] as [number, number, number] },
          { label: 'Recorde Diário', value: `${recordeDiario.toFixed(1)} mm`, color: [220, 50, 50] as [number, number, number] },
          { label: 'Média/Dia Chuvoso', value: `${mediaChuvoso.toFixed(1)} mm`, color: [29, 53, 87] as [number, number, number] },
        ];
        const kpiBoxH = 14;
        const kpiBoxW = (col3W - 2) / 2;
        kpis.forEach((kpi, i) => {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const kx = col3X + col * (kpiBoxW + 2);
          const ky = c3y + row * (kpiBoxH + 2);
          pdf.setFillColor(245, 248, 255);
          pdf.roundedRect(kx, ky, kpiBoxW, kpiBoxH, 1.5, 1.5, 'F');
          pdf.setDrawColor(210, 220, 235);
          pdf.roundedRect(kx, ky, kpiBoxW, kpiBoxH, 1.5, 1.5, 'S');
          pdf.setFillColor(...kpi.color);
          pdf.rect(kx + 0.5, ky, kpiBoxW - 1, 1, 'F');
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...kpi.color);
          pdf.text(kpi.value, kx + kpiBoxW / 2, ky + 8, { align: 'center' });
          pdf.setFontSize(4.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(kpi.label, kx + kpiBoxW / 2, ky + 12, { align: 'center' });
        });

        c3y += 3 * (kpiBoxH + 2) + 4;

        const sameMonthYears = [...new Set(allRows.map(r => r.ano).filter(y => y !== filterAno && y > 0))]
          .sort((a, b) => b - a)
          .map(y => ({ ano: y, total: allRows.filter(r => r.mes === filterMes && r.ano === y).reduce((s, r) => s + r.quantidade, 0) }))
          .filter(y => y.total > 0)
          .slice(0, 4);

        if (sameMonthYears.length > 0) {
          pdf.setFontSize(6);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(29, 53, 87);
          pdf.text(`${MESES[filterMes - 1]} - Anos Anteriores`, col3X, c3y);
          c3y += 2;
          const tH = 5;
          pdf.setFillColor(29, 53, 87);
          pdf.rect(col3X, c3y, col3W, tH, 'F');
          pdf.setFontSize(4.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.text('Ano', col3X + 2, c3y + 3.5);
          pdf.text('Total', col3X + col3W - 2, c3y + 3.5, { align: 'right' });
          c3y += tH;
          sameMonthYears.forEach((yr, i) => {
            if (i % 2 === 0) {
              pdf.setFillColor(248, 248, 248);
              pdf.rect(col3X, c3y, col3W, tH, 'F');
            }
            pdf.setFontSize(4.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            pdf.text(`${yr.ano}`, col3X + 2, c3y + 3.5);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${yr.total.toFixed(0)} mm`, col3X + col3W - 2, c3y + 3.5, { align: 'right' });
            c3y += tH;
          });
        }

        drawFooter(pdf, M, A4_W, footerY, obraConfig);

        const fileName = `Controle_Pluviometrico_${MESES[filterMes - 1]}_${filterAno}.pdf`;
        pdf.save(fileName);
      }

      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao exportar PDF');
    }
    setExporting(false);
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {exporting ? 'Gerando PDF...' : 'Exportar PDF'}
    </Button>
  );
}
