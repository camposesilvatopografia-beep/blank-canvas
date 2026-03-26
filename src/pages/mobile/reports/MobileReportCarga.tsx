import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, Download, RefreshCw, Share2, Truck, Cog } from 'lucide-react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface RecordSummary {
  material: string;
  count: number;
  volume: number;
}

interface LocalSummary {
  local: string;
  carga: number;
  descarga: number;
}

interface EquipmentSummary {
  prefixo: string;
  viagens: number;
}

export default function MobileReportCarga() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { readSheet, loading } = useGoogleSheets();
  const { obraConfig } = useObraConfig();
  const [cargaData, setCargaData] = useState<any[][]>([]);
  const [descargaData, setDescargaData] = useState<any[][]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  useEffect(() => {
    setSelectedDate(todayStr);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [carga, descarga] = await Promise.all([
        readSheet('Carga').catch(() => []),
        readSheet('Descarga').catch(() => [])
      ]);
      setCargaData(carga || []);
      setDescargaData(descarga || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter data for selected date AND by user (Usuario column)
  const filterByDateAndUser = (data: any[][], dateStr: string) => {
    if (!data || data.length < 2) return [];
    const headers = data[0];
    const dateIdx = headers.indexOf('Data');
    const userIdx = headers.indexOf('Usuario');
    if (dateIdx === -1) return [];
    
    const userName = effectiveName;
    
    return data.slice(1).filter(row => {
      const matchDate = (row[dateIdx] || '').split('/').map(p => p.padStart(2, '0')).join('/') === dateStr;
      // Filter by user if not admin
      if (userIdx !== -1 && userName) {
        const recordUser = row[userIdx] || '';
        return matchDate && recordUser === userName;
      }
      return matchDate;
    });
  };

  const filteredCarga = filterByDateAndUser(cargaData, selectedDate);
  const filteredDescarga = filterByDateAndUser(descargaData, selectedDate);

  // Summarize by material
  const summarizeByMaterial = (data: any[][], headers: string[]): RecordSummary[] => {
    const materialIdx = headers.indexOf('Material');
    const volumeIdx = headers.indexOf('Volume');
    if (materialIdx === -1) return [];

    const summary: { [key: string]: RecordSummary } = {};
    data.forEach(row => {
      const material = row[materialIdx] || 'N/A';
      const volume = parseFloat(row[volumeIdx]) || 0;
      if (!summary[material]) {
        summary[material] = { material, count: 0, volume: 0 };
      }
      summary[material].count++;
      summary[material].volume += volume;
    });
    return Object.values(summary).sort((a, b) => b.count - a.count);
  };

  // Summarize by local
  const summarizeByLocal = (): LocalSummary[] => {
    const cargaHeaders = cargaData[0] || [];
    const descargaHeaders = descargaData[0] || [];
    const cargaLocalIdx = cargaHeaders.indexOf('Local');
    const descargaLocalIdx = descargaHeaders.indexOf('Local');

    const summary: { [key: string]: LocalSummary } = {};
    
    filteredCarga.forEach(row => {
      const local = row[cargaLocalIdx] || 'N/A';
      if (!summary[local]) {
        summary[local] = { local, carga: 0, descarga: 0 };
      }
      summary[local].carga++;
    });

    filteredDescarga.forEach(row => {
      const local = row[descargaLocalIdx] || 'N/A';
      if (!summary[local]) {
        summary[local] = { local, carga: 0, descarga: 0 };
      }
      summary[local].descarga++;
    });

    return Object.values(summary).sort((a, b) => (b.carga + b.descarga) - (a.carga + a.descarga));
  };

  // Summarize by Escavadeira (Prefixo_Eq column)
  const summarizeByEscavadeira = (): EquipmentSummary[] => {
    const cargaHeaders = cargaData[0] || [];
    // Try Prefixo_Eq first (correct column name), then fallback
    let escavadeiraIdx = cargaHeaders.indexOf('Prefixo_Eq');
    if (escavadeiraIdx === -1) escavadeiraIdx = cargaHeaders.indexOf('PrefixoEq');
    if (escavadeiraIdx === -1) escavadeiraIdx = cargaHeaders.indexOf('PrefixoCb');
    if (escavadeiraIdx === -1) return [];

    const summary: { [key: string]: EquipmentSummary } = {};
    filteredCarga.forEach(row => {
      const prefixo = row[escavadeiraIdx] || 'N/A';
      if (prefixo && prefixo !== 'N/A') {
        if (!summary[prefixo]) {
          summary[prefixo] = { prefixo, viagens: 0 };
        }
        summary[prefixo].viagens++;
      }
    });
    return Object.values(summary).sort((a, b) => b.viagens - a.viagens);
  };

  // Summarize by Caminhão (Prefixo_Cb column)
  const summarizeByCaminhao = (): EquipmentSummary[] => {
    const cargaHeaders = cargaData[0] || [];
    // Try Prefixo_Cb first (correct column name), then fallback
    let caminhaoIdx = cargaHeaders.indexOf('Prefixo_Cb');
    if (caminhaoIdx === -1) caminhaoIdx = cargaHeaders.indexOf('PrefixoCb');
    if (caminhaoIdx === -1) caminhaoIdx = cargaHeaders.indexOf('Prefixo');
    if (caminhaoIdx === -1) return [];

    const summary: { [key: string]: EquipmentSummary } = {};
    filteredCarga.forEach(row => {
      const prefixo = row[caminhaoIdx] || 'N/A';
      if (prefixo && prefixo !== 'N/A') {
        if (!summary[prefixo]) {
          summary[prefixo] = { prefixo, viagens: 0 };
        }
        summary[prefixo].viagens++;
      }
    });
    return Object.values(summary).sort((a, b) => b.viagens - a.viagens);
  };

  const cargaByMaterial = summarizeByMaterial(filteredCarga, cargaData[0] || []);
  const descargaByMaterial = summarizeByMaterial(filteredDescarga, descargaData[0] || []);
  const byLocal = summarizeByLocal();
  const byEscavadeira = summarizeByEscavadeira();
  const byCaminhao = summarizeByCaminhao();

  const totalCarga = filteredCarga.length;
  const totalDescarga = filteredDescarga.length;

  // Period stats (all data, not filtered by date/user)
  const periodStats = useMemo(() => {
    if (!cargaData || cargaData.length < 2) return { totalViagens: 0, totalVolTransp: 0, totalVolEscavado: 0, dias: 0 };
    const headers = cargaData[0];
    const rows = cargaData.slice(1);
    const volumeTotalIdx = headers.indexOf('Volume_Total');
    const volumeIdx = headers.indexOf('Volume');
    const viagensIdx = headers.indexOf('N_Viagens');
    const viagensIdxAlt = headers.indexOf('I_Viagens');
    const dateIdx = headers.indexOf('Data');

    let totalViagens = 0;
    let totalVolTransp = 0;
    const dates = new Set<string>();

    rows.forEach(row => {
      const rawV = viagensIdx !== -1 ? row[viagensIdx] : viagensIdxAlt !== -1 ? row[viagensIdxAlt] : undefined;
      const v = Math.max(1, parseInt(String(rawV ?? '1'), 10) || 1);
      totalViagens += v;

      const volTotal = parseFloat(String(row[volumeTotalIdx] || 0).replace(',', '.'));
      const volUnit = parseFloat(String(row[volumeIdx] || 0).replace(',', '.'));
      const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnit) ? 0 : volUnit));
      totalVolTransp += vol;

      if (dateIdx !== -1 && row[dateIdx]) dates.add(row[dateIdx]);
    });

    return {
      totalViagens,
      totalVolTransp: Math.round(totalVolTransp * 100) / 100,
      totalVolEscavado: Math.round(totalVolTransp * 100) / 100,
      dias: dates.size,
    };
  }, [cargaData]);

  const formatNum = (n: number) => n.toLocaleString('pt-BR');

  const shareViaWhatsApp = () => {
    const escavadeirasSummary = byEscavadeira.length > 0
      ? byEscavadeira.map(e => `• ${e.prefixo}: ${e.viagens} viagens`).join('\n')
      : 'Nenhum registro';
    
    const caminhoesSummary = byCaminhao.length > 0
      ? byCaminhao.map(c => `• ${c.prefixo}: ${c.viagens} viagens`).join('\n')
      : 'Nenhum registro';

    const message = `📊 *RELATÓRIO DE APROPRIAÇÃO - ${selectedDate}*

👷 Apontador: ${effectiveName || 'N/A'}

📋 *Resumo do Dia:*
• Total Cargas: ${totalCarga}
• Total Descargas: ${totalDescarga}

🚜 *Escavadeiras (${byEscavadeira.reduce((acc, e) => acc + e.viagens, 0)} viagens):*
${escavadeirasSummary}

🚚 *Caminhões (${byCaminhao.reduce((acc, c) => acc + c.viagens, 0)} viagens):*
${caminhoesSummary}

📦 *Por Material (Carga):*
${cargaByMaterial.map(m => `• ${m.material}: ${m.count} viagens`).join('\n') || 'Nenhum registro'}

📍 *Por Local:*
${byLocal.slice(0, 5).map(l => `• ${l.local}: ${l.carga}C / ${l.descarga}D`).join('\n') || 'Nenhum registro'}

---
_Enviado via ApropriAPP_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-amber-500 text-white p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => navigate('/mobile')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={obraConfig.logo || logoApropriapp} alt="Logo" className="w-8 h-8 rounded" />
            <div>
              <h1 className="font-semibold text-sm">{obraConfig.nome || 'Relatório de Apropriação'}</h1>
              <p className="text-xs text-white/80">{obraConfig.local ? `${obraConfig.local} • ${selectedDate}` : selectedDate}</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={fetchData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={shareViaWhatsApp}
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="bg-amber-50 border-0 p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-200 rounded-lg flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4 text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-amber-700 leading-tight">{totalCarga}</p>
                <p className="text-[11px] text-amber-600">Cargas</p>
              </div>
            </div>
          </Card>
          <Card className="bg-blue-50 border-0 p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-blue-700 leading-tight">{totalDescarga}</p>
                <p className="text-[11px] text-blue-600">Descargas</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Resumo do Período */}
        <Card className="border-0 p-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl">
          <h3 className="font-semibold text-xs mb-2 text-white/90">📊 Resumo do Período ({periodStats.dias} dias)</h3>
          <div className="grid grid-cols-3 gap-1">
            <div className="text-center bg-white/10 rounded-lg py-2 px-1">
              <p className="text-base font-bold leading-tight">{formatNum(periodStats.totalViagens)}</p>
              <p className="text-[9px] text-white/80 leading-tight mt-0.5">Total Viagens</p>
            </div>
            <div className="text-center bg-white/10 rounded-lg py-2 px-1">
              <p className="text-base font-bold leading-tight">{formatNum(periodStats.totalVolTransp)}</p>
              <p className="text-[9px] text-white/80 leading-tight mt-0.5">Vol. Transp. (m³)</p>
            </div>
            <div className="text-center bg-white/10 rounded-lg py-2 px-1">
              <p className="text-base font-bold leading-tight">{formatNum(periodStats.totalVolEscavado)}</p>
              <p className="text-[9px] text-white/80 leading-tight mt-0.5">Vol. Escav. (m³)</p>
            </div>
          </div>
        </Card>

        {/* Escavadeiras */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
            <Cog className="w-4 h-4 text-orange-600" />
            Escavadeiras
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 ml-auto">
              {byEscavadeira.reduce((acc, e) => acc + e.viagens, 0)} viagens
            </Badge>
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : byEscavadeira.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-2">
              {byEscavadeira.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700 font-medium">{item.prefixo}</span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    {item.viagens} viagens
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Caminhões */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-emerald-600" />
            Caminhões
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 ml-auto">
              {byCaminhao.reduce((acc, c) => acc + c.viagens, 0)} viagens
            </Badge>
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : byCaminhao.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-2">
              {byCaminhao.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700 font-medium">{item.prefixo}</span>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                    {item.viagens} viagens
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por Material - Carga */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4 text-amber-600" />
            Cargas por Material
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : cargaByMaterial.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-2">
              {cargaByMaterial.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{item.material}</span>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                    {item.count} viagens
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por Material - Descarga */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4 text-blue-600" />
            Descargas por Material
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : descargaByMaterial.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-2">
              {descargaByMaterial.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{item.material}</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {item.count} viagens
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por Local */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 text-sm">Resumo por Local</h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : byLocal.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-2">
              {byLocal.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700 flex-1">{item.local}</span>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                      {item.carga}C
                    </Badge>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                      {item.descarga}D
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
