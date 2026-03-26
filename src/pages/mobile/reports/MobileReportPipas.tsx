import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Droplets, RefreshCw, Share2, MapPin, Truck } from 'lucide-react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface LocalSummary {
  local: string;
  viagens: number;
  litros: number;
}

interface PipaSummary {
  pipa: string;
  viagens: number;
  litros: number;
}

export default function MobileReportPipas() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { readSheet, loading } = useGoogleSheets();
  const { obraConfig } = useObraConfig();
  const [data, setData] = useState<any[][]>([]);
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
      const result = await readSheet('Apontamento_Pipa').catch(() => []);
      setData(result || []);
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
      // Filter by user if column exists
      if (userIdx !== -1 && userName) {
        const recordUser = row[userIdx] || '';
        return matchDate && recordUser === userName;
      }
      return matchDate;
    });
  };

  const filteredData = filterByDateAndUser(data, selectedDate);
  const headers = data[0] || [];

  // Get column indices
  const localIdx = headers.indexOf('Local');
  const pipaIdx = headers.indexOf('Pipa') !== -1 ? headers.indexOf('Pipa') : headers.indexOf('Prefixo');
  const litrosIdx = headers.indexOf('Litros') !== -1 ? headers.indexOf('Litros') : headers.indexOf('Capacidade');
  const viagensIdx = headers.indexOf('Viagens') !== -1 ? headers.indexOf('Viagens') : -1;

  // Summarize by local
  const summarizeByLocal = (): LocalSummary[] => {
    if (localIdx === -1) return [];

    const summary: { [key: string]: LocalSummary } = {};
    filteredData.forEach(row => {
      const local = row[localIdx] || 'N/A';
      const litros = parseFloat(row[litrosIdx]) || 0;
      const viagens = viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 1) : 1;
      if (!summary[local]) {
        summary[local] = { local, viagens: 0, litros: 0 };
      }
      summary[local].viagens += viagens;
      summary[local].litros += litros * viagens;
    });
    return Object.values(summary).sort((a, b) => b.viagens - a.viagens);
  };

  // Summarize by pipa
  const summarizeByPipa = (): PipaSummary[] => {
    if (pipaIdx === -1) return [];

    const summary: { [key: string]: PipaSummary } = {};
    filteredData.forEach(row => {
      const pipa = row[pipaIdx] || 'N/A';
      const litros = parseFloat(row[litrosIdx]) || 0;
      const viagens = viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 1) : 1;
      if (!summary[pipa]) {
        summary[pipa] = { pipa, viagens: 0, litros: 0 };
      }
      summary[pipa].viagens += viagens;
      summary[pipa].litros += litros * viagens;
    });
    return Object.values(summary).sort((a, b) => b.viagens - a.viagens);
  };

  const byLocal = summarizeByLocal();
  const byPipa = summarizeByPipa();

  const totalViagens = filteredData.reduce((acc, row) => {
    const viagens = viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 1) : 1;
    return acc + viagens;
  }, 0);
  
  const totalLitros = filteredData.reduce((acc, row) => {
    const litros = parseFloat(row[litrosIdx]) || 0;
    const viagens = viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 1) : 1;
    return acc + (litros * viagens);
  }, 0);

  const shareViaWhatsApp = () => {
    const message = `📊 *RELATÓRIO PIPAS - ${selectedDate}*

👷 Apontador: ${effectiveName || 'N/A'}

📋 *Resumo do Dia:*
• Total Viagens: ${totalViagens}
• Volume Total: ${(totalLitros / 1000).toLocaleString('pt-BR')} m³

📍 *Por Local:*
${byLocal.map(l => `• ${l.local}: ${l.viagens} viagens (${(l.litros / 1000).toLocaleString('pt-BR')} m³)`).join('\n') || 'Nenhum registro'}

🚛 *Por Pipa:*
${byPipa.slice(0, 5).map(p => `• ${p.pipa}: ${p.viagens} viagens`).join('\n') || 'Nenhum registro'}

---
_Enviado via ApropriAPP_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-500 text-white p-4">
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
              <h1 className="font-semibold text-sm">{obraConfig.nome || 'Relatório Pipas'}</h1>
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
          <Card className="bg-blue-50 border-0 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-blue-700 leading-tight">{totalViagens}</p>
                <p className="text-[11px] text-blue-600">Viagens</p>
              </div>
            </div>
          </Card>
          <Card className="bg-cyan-50 border-0 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-200 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-cyan-700 font-bold text-xs">m³</span>
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-cyan-700 leading-tight">{(totalLitros / 1000).toLocaleString('pt-BR')}</p>
                <p className="text-[11px] text-cyan-600">Volume</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Por Local */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-blue-600" />
            Por Local
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : byLocal.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-1.5">
              {byLocal.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 gap-2">
                  <span className="text-xs text-gray-700 flex-1 truncate">{item.local}</span>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5">
                      {item.viagens}v
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      {(item.litros / 1000).toLocaleString('pt-BR')} m³
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por Pipa */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-cyan-600" />
            Por Pipa
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : byPipa.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-2">
              {byPipa.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{item.pipa}</span>
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-700">
                    {item.viagens} viagens
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
