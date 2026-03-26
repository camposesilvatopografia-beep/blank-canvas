import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FlaskConical, RefreshCw, Share2, ArrowDownCircle, ArrowUpCircle, Package } from 'lucide-react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface MovimentoRecord {
  hora: string;
  tipo: string;
  quantidade: number;
  fornecedor?: string;
  notaFiscal?: string;
  destino?: string;
}

export default function MobileReportCal() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { readSheet, loading } = useGoogleSheets();
  const { obraConfig } = useObraConfig();
  const [movData, setMovData] = useState<any[][]>([]);
  const [estoqueData, setEstoqueData] = useState<any[][]>([]);
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
      const [mov, estoque] = await Promise.all([
        readSheet('Mov_Cal').catch(() => []),
        readSheet('Estoque_Cal').catch(() => [])
      ]);
      setMovData(mov || []);
      setEstoqueData(estoque || []);
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

  const filteredMov = filterByDateAndUser(movData, selectedDate);
  const headers = movData[0] || [];

  // Get column indices (match actual sheet headers)
  const tipoIdx = headers.indexOf('Tipo');
  const quantidadeIdx = headers.indexOf('Qtd') !== -1 ? headers.indexOf('Qtd') : headers.indexOf('Quantidade');
  const horaIdx = headers.indexOf('Hora');
  const fornecedorIdx = headers.indexOf('Fornecedor');
  const notaFiscalIdx = headers.indexOf('NF') !== -1 ? headers.indexOf('NF') : headers.indexOf('Nota Fiscal');
  const destinoIdx = headers.indexOf('Local') !== -1 ? headers.indexOf('Local') : headers.indexOf('Destino');

  // Parse movements
  const movements: MovimentoRecord[] = filteredMov.map(row => ({
    hora: row[horaIdx] || '',
    tipo: row[tipoIdx] || '',
    quantidade: parseFloat(String(row[quantidadeIdx] || '0').replace('.', '').replace(',', '.')) || 0,
    fornecedor: fornecedorIdx !== -1 ? row[fornecedorIdx] : undefined,
    notaFiscal: notaFiscalIdx !== -1 ? row[notaFiscalIdx] : undefined,
    destino: destinoIdx !== -1 ? row[destinoIdx] : undefined,
  }));

  // Calculate totals
  const totalEntradas = movements.filter(m => m.tipo === 'Entrada').reduce((acc, m) => acc + m.quantidade, 0);
  const totalSaidas = movements.filter(m => m.tipo === 'Saída' || m.tipo === 'Saida').reduce((acc, m) => acc + m.quantidade, 0);

  // Total entradas do período (all data, not filtered by date)
  const totalEntradasPeriodo = useMemo(() => {
    if (!movData || movData.length < 2) return 0;
    const h = movData[0];
    const tipoI = h.indexOf('Tipo');
    const qtdI = h.indexOf('Qtd') !== -1 ? h.indexOf('Qtd') : h.indexOf('Quantidade');
    if (tipoI === -1 || qtdI === -1) return 0;
    return movData.slice(1)
      .filter(r => String(r[tipoI] || '').toLowerCase() === 'entrada')
      .reduce((s, r) => s + (parseFloat(String(r[qtdI] || '0').replace('.', '').replace(',', '.')) || 0), 0);
  }, [movData]);
  
  // Get current stock from Estoque_Cal (last row) - robust header matching
  let estoqueAtual = 0;
  if (estoqueData.length > 1) {
    const estoqueHeaders = estoqueData[0] || [];
    const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    // Try multiple possible column names
    let qtdIdx = estoqueHeaders.findIndex((h: string) => {
      const n = norm(h);
      return n === 'estoqueAtual' || n === 'estoqueatual' || n === 'quantidade' || n === 'estoque' || n === 'qtd' || n === 'saldo' || n === 'saldoatual';
    });
    
    // Fallback: find any header containing 'estoque' or 'quantidade'
    if (qtdIdx === -1) {
      qtdIdx = estoqueHeaders.findIndex((h: string) => {
        const n = norm(h);
        return n.includes('estoque') || n.includes('quantidade') || n.includes('saldo');
      });
    }
    
    console.log('[MobileReportCal] Estoque_Cal headers:', estoqueHeaders, 'qtdIdx:', qtdIdx);
    
    if (qtdIdx !== -1) {
      const lastRow = estoqueData[estoqueData.length - 1];
      const raw = String(lastRow[qtdIdx] || '0').replace(/\./g, '').replace(',', '.');
      estoqueAtual = parseFloat(raw) || 0;
    } else {
      // Last resort: try last numeric column in last row
      const lastRow = estoqueData[estoqueData.length - 1];
      for (let i = lastRow.length - 1; i >= 0; i--) {
        const val = parseFloat(String(lastRow[i] || '').replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0) { estoqueAtual = val; break; }
      }
    }
  }

  const shareViaWhatsApp = () => {
    const message = `📊 *RELATÓRIO CAL - ${selectedDate}*

👷 Apontador: ${effectiveName || 'N/A'}

📋 *Movimentações do Dia:*
• Entradas: ${totalEntradas.toLocaleString('pt-BR')} kg
• Saídas: ${totalSaidas.toLocaleString('pt-BR')} kg
• Saldo: ${(totalEntradas - totalSaidas).toLocaleString('pt-BR')} kg

📦 *Estoque Atual:* ${estoqueAtual.toLocaleString('pt-BR')} kg

📝 *Detalhamento:*
${movements.map(m => `• ${m.hora} - ${m.tipo}: ${m.quantidade.toLocaleString('pt-BR')} kg${m.fornecedor ? ` (${m.fornecedor})` : ''}`).join('\n') || 'Nenhum movimento'}

---
_Enviado via ApropriAPP_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-teal-600 text-white p-4">
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
              <h1 className="font-semibold text-sm">{obraConfig.nome || 'Relatório CAL'}</h1>
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
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-green-50 border-0 p-2.5 rounded-xl">
            <div className="text-center">
              <ArrowDownCircle className="w-4 h-4 text-green-600 mx-auto mb-0.5" />
              <p className="text-base font-bold text-green-700 leading-tight">{totalEntradas.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-green-600 leading-tight">Entradas (kg)</p>
            </div>
          </Card>
          <Card className="bg-red-50 border-0 p-2.5 rounded-xl">
            <div className="text-center">
              <ArrowUpCircle className="w-4 h-4 text-red-600 mx-auto mb-0.5" />
              <p className="text-base font-bold text-red-700 leading-tight">{totalSaidas.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-red-600 leading-tight">Saídas (kg)</p>
            </div>
          </Card>
          <Card className="bg-teal-50 border-0 p-2.5 rounded-xl">
            <div className="text-center">
              <Package className="w-4 h-4 text-teal-600 mx-auto mb-0.5" />
              <p className="text-base font-bold text-teal-700 leading-tight">{estoqueAtual.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-teal-600 leading-tight">Estoque (kg)</p>
            </div>
          </Card>
        </div>

        {/* Saldo do Dia */}
        <Card className="border-0 p-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/80">Saldo do Dia</p>
              <p className="text-xl font-bold leading-tight">{(totalEntradas - totalSaidas).toLocaleString('pt-BR')} kg</p>
            </div>
            <FlaskConical className="w-8 h-8 text-white/30" />
          </div>
        </Card>

        {/* Total Entradas Período */}
        <Card className="border-0 p-2.5 bg-green-50 rounded-xl">
          <p className="text-[10px] text-green-600 font-medium">TOTAL DE ENTRADAS (Período)</p>
          <p className="text-lg font-bold text-green-700 leading-tight">{totalEntradasPeriodo.toLocaleString('pt-BR')} kg</p>
        </Card>

        {/* Movimentações do Dia */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
            <FlaskConical className="w-4 h-4 text-teal-600" />
            Movimentações do Dia
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum movimento hoje</p>
          ) : (
            <div className="space-y-2">
              {movements.map((mov, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    {mov.tipo === 'Entrada' ? (
                      <ArrowDownCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4 text-red-600" />
                    )}
                    <div>
                      <p className="text-sm text-gray-700">{mov.hora}</p>
                      {mov.fornecedor && (
                        <p className="text-xs text-gray-500">{mov.fornecedor}</p>
                      )}
                      {mov.destino && (
                        <p className="text-xs text-gray-500">→ {mov.destino}</p>
                      )}
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={mov.tipo === 'Entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                  >
                    {mov.tipo === 'Entrada' ? '+' : '-'}{mov.quantidade.toLocaleString('pt-BR')} kg
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
