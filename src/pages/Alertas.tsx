import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Truck,
  MapPin,
  Clock,
  RefreshCw,
  Settings,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  Users,
  Activity,
  Zap,
  MessageCircle,
  Send,
  Webhook,
  Phone,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  category: 'caminhao' | 'apontador' | 'volume' | 'frequencia' | 'horario' | 'local' | 'sistema';
  title: string;
  description: string;
  entity: string;
  timestamp: Date;
  data?: any;
  read: boolean;
  dismissed: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  icon: React.ElementType;
}

const defaultRules: AlertRule[] = [
  {
    id: 'trip-anomaly',
    name: 'Anomalia de Viagens',
    description: 'Alertar quando caminhão tem viagens muito diferentes da média do dia',
    enabled: true,
    category: 'caminhao',
    icon: Truck,
  },
  {
    id: 'location-change',
    name: 'Mudança de Local',
    description: 'Alertar quando apontador registra em local diferente do padrão',
    enabled: true,
    category: 'apontador',
    icon: MapPin,
  },
  {
    id: 'low-volume',
    name: 'Volume Baixo',
    description: 'Alertar quando volume transportado está abaixo do esperado',
    enabled: true,
    category: 'volume',
    icon: TrendingDown,
  },
  {
    id: 'high-frequency',
    name: 'Alta Frequência',
    description: 'Alertar viagens muito rápidas (possível erro de apontamento)',
    enabled: true,
    category: 'frequencia',
    icon: Zap,
  },
  {
    id: 'inactive-equipment',
    name: 'Equipamento Inativo',
    description: 'Alertar quando equipamento não registra viagens há muito tempo',
    enabled: true,
    category: 'sistema',
    icon: Clock,
  },
  {
    id: 'duplicate-entry',
    name: 'Entrada Duplicada',
    description: 'Detectar possíveis registros duplicados',
    enabled: true,
    category: 'sistema',
    icon: AlertCircle,
  },
  {
    id: 'material-mismatch',
    name: 'Material Inconsistente',
    description: 'Alertar quando material não combina com local de destino',
    enabled: false,
    category: 'local',
    icon: AlertTriangle,
  },
  {
    id: 'descarga-divergence',
    name: 'Divergência Descarga > Carga',
    description: 'Alertar quando caminhão tem mais descargas do que cargas no dia',
    enabled: true,
    category: 'caminhao',
    icon: AlertCircle,
  },
  {
    id: 'peak-performance',
    name: 'Desempenho Excepcional',
    description: 'Notificar quando equipamento supera a média significativamente',
    enabled: true,
    category: 'caminhao',
    icon: TrendingUp,
  },
];

export default function Alertas() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>(defaultRules);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // WhatsApp Integration State
  const [whatsappEnabled, setWhatsappEnabled] = useState(() => {
    return localStorage.getItem('alertas_whatsapp_enabled') === 'true';
  });
  const [whatsappPhone, setWhatsappPhone] = useState(() => {
    return localStorage.getItem('alertas_whatsapp_phone') || '';
  });
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('alertas_webhook_url') || '';
  });
  const [sendOnlyErrors, setSendOnlyErrors] = useState(() => {
    return localStorage.getItem('alertas_send_only_errors') === 'true';
  });
  const [showWhatsappConfig, setShowWhatsappConfig] = useState(false);
  const [lastWhatsappSent, setLastWhatsappSent] = useState<Date | null>(null);
  
  const { readSheet } = useGoogleSheets();
  const { toast } = useToast();

  // Save WhatsApp settings to localStorage
  useEffect(() => {
    localStorage.setItem('alertas_whatsapp_enabled', String(whatsappEnabled));
    localStorage.setItem('alertas_whatsapp_phone', whatsappPhone);
    localStorage.setItem('alertas_webhook_url', webhookUrl);
    localStorage.setItem('alertas_send_only_errors', String(sendOnlyErrors));
  }, [whatsappEnabled, whatsappPhone, webhookUrl, sendOnlyErrors]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      analyzeData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Initial load
  useEffect(() => {
    analyzeData();
  }, []);

  const sendPushNotification = (alert: Alert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const icon = alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
      new Notification(`${icon} ApropriAPP - ${alert.title}`, {
        body: alert.description,
        icon: '/favicon.png',
        tag: alert.id,
      });
    }

  };

  // Send WhatsApp notification
  const sendWhatsAppNotification = async (alertsToSend: Alert[]) => {
    if (!whatsappEnabled || alertsToSend.length === 0) return;

    // Filter alerts based on settings
    const filteredAlerts = sendOnlyErrors 
      ? alertsToSend.filter(a => a.type === 'error' || a.type === 'warning')
      : alertsToSend;

    if (filteredAlerts.length === 0) return;

    // Build message
    const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const errorIcon = '🚨';
    const warningIcon = '⚠️';
    const infoIcon = 'ℹ️';

    let message = `*📊 ApropriAPP - Alertas*\n`;
    message += `_${now}_\n\n`;
    
    const errors = filteredAlerts.filter(a => a.type === 'error');
    const warnings = filteredAlerts.filter(a => a.type === 'warning');
    const infos = filteredAlerts.filter(a => a.type === 'info');

    if (errors.length > 0) {
      message += `*${errorIcon} CRÍTICOS (${errors.length}):*\n`;
      errors.slice(0, 5).forEach(alert => {
        message += `• ${alert.title}: ${alert.entity}\n`;
      });
      if (errors.length > 5) message += `_... e mais ${errors.length - 5}_\n`;
      message += '\n';
    }

    if (warnings.length > 0) {
      message += `*${warningIcon} AVISOS (${warnings.length}):*\n`;
      warnings.slice(0, 5).forEach(alert => {
        message += `• ${alert.title}: ${alert.entity}\n`;
      });
      if (warnings.length > 5) message += `_... e mais ${warnings.length - 5}_\n`;
      message += '\n';
    }

    if (infos.length > 0 && !sendOnlyErrors) {
      message += `*${infoIcon} INFORMATIVOS (${infos.length}):*\n`;
      infos.slice(0, 3).forEach(alert => {
        message += `• ${alert.title}: ${alert.entity}\n`;
      });
      if (infos.length > 3) message += `_... e mais ${infos.length - 3}_\n`;
    }

    message += `\n_Acesse a Central de Alertas para mais detalhes._`;

    // Try webhook first (Zapier, N8N, etc.)
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'no-cors',
          body: JSON.stringify({
            message,
            alerts: filteredAlerts.map(a => ({
              type: a.type,
              title: a.title,
              description: a.description,
              entity: a.entity,
              timestamp: a.timestamp.toISOString(),
            })),
            summary: {
              total: filteredAlerts.length,
              errors: errors.length,
              warnings: warnings.length,
              infos: infos.length,
            },
            timestamp: new Date().toISOString(),
          }),
        });
        
        setLastWhatsappSent(new Date());
        toast({
          title: 'Alertas enviados via Webhook',
          description: `${filteredAlerts.length} alertas enviados para automação`,
        });
        return;
      } catch (error) {
        console.error('Error sending webhook:', error);
      }
    }

    // Fallback to WhatsApp direct link
    if (whatsappPhone) {
      const cleanPhone = whatsappPhone.replace(/\D/g, '');
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      
      window.open(whatsappUrl, '_blank');
      setLastWhatsappSent(new Date());
      
      toast({
        title: 'WhatsApp aberto',
        description: 'Mensagem preparada para envio',
      });
    }
  };

  // Manual send to WhatsApp
  const handleManualWhatsAppSend = () => {
    const alertsToSend = alerts.filter(a => !a.dismissed);
    if (alertsToSend.length === 0) {
      toast({
        title: 'Nenhum alerta',
        description: 'Não há alertas para enviar',
        variant: 'destructive',
      });
      return;
    }
    sendWhatsAppNotification(alertsToSend);
  };

  const analyzeData = async () => {
    setLoading(true);
    try {
      const cargaData = await readSheet('Carga');
      if (!cargaData || cargaData.length < 2) {
        setLoading(false);
        return;
      }

      const headers = cargaData[0];
      const rows = cargaData.slice(1);
      const getIdx = (name: string) => headers.indexOf(name);

      const dateIdx = getIdx('Data');
      const horaIdx = getIdx('Hora_Carga');
      const prefixoCbIdx = getIdx('Prefixo_Cb');
      const prefixoEqIdx = getIdx('Prefixo_Eq');
      const localIdx = getIdx('Local_da_Obra');
      const materialIdx = getIdx('Material');
      const volumeIdx = getIdx('Volume_Total');
      const apontadorIdx = getIdx('Apontador');

      // Get today's date (most recent date in data)
      const dates = [...new Set(rows.map(r => r[dateIdx]).filter(Boolean))].sort((a, b) => {
        const [da, ma, ya] = a.split('/').map(Number);
        const [db, mb, yb] = b.split('/').map(Number);
        return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
      });
      const today = dates[0];

      const todayData = rows.filter(r => r[dateIdx] === today);
      const newAlerts: Alert[] = [];

      // Rule 1: Trip Anomaly Detection
      if (rules.find(r => r.id === 'trip-anomaly')?.enabled) {
        const caminhaoTrips = new Map<string, number>();
        todayData.forEach(row => {
          const cb = row[prefixoCbIdx];
          if (cb) {
            caminhaoTrips.set(cb, (caminhaoTrips.get(cb) || 0) + 1);
          }
        });

        const tripCounts = Array.from(caminhaoTrips.values());
        const avgTrips = tripCounts.reduce((a, b) => a + b, 0) / tripCounts.length || 0;
        const stdDev = Math.sqrt(tripCounts.reduce((sum, val) => sum + Math.pow(val - avgTrips, 2), 0) / tripCounts.length) || 1;

        caminhaoTrips.forEach((trips, caminhao) => {
          if (trips < avgTrips - 2 * stdDev && trips < avgTrips * 0.5) {
            newAlerts.push({
              id: `trip-low-${caminhao}-${Date.now()}`,
              type: 'warning',
              category: 'caminhao',
              title: 'Viagens Abaixo do Esperado',
              description: `${caminhao} fez apenas ${trips} viagens hoje (média: ${avgTrips.toFixed(1)}). Verificar possível problema.`,
              entity: caminhao,
              timestamp: new Date(),
              data: { trips, avgTrips, stdDev },
              read: false,
              dismissed: false,
            });
          } else if (trips > avgTrips + 2 * stdDev && trips > avgTrips * 1.5) {
            newAlerts.push({
              id: `trip-high-${caminhao}-${Date.now()}`,
              type: 'info',
              category: 'caminhao',
              title: 'Desempenho Excepcional',
              description: `${caminhao} fez ${trips} viagens hoje (média: ${avgTrips.toFixed(1)}). Excelente produtividade!`,
              entity: caminhao,
              timestamp: new Date(),
              data: { trips, avgTrips },
              read: false,
              dismissed: false,
            });
          }
        });
      }

      // Rule 2: Location Change Detection
      if (rules.find(r => r.id === 'location-change')?.enabled) {
        const apontadorLocais = new Map<string, Map<string, number>>();
        todayData.forEach(row => {
          const apontador = row[apontadorIdx] || 'Desconhecido';
          const local = row[localIdx];
          if (local) {
            if (!apontadorLocais.has(apontador)) {
              apontadorLocais.set(apontador, new Map());
            }
            const locais = apontadorLocais.get(apontador)!;
            locais.set(local, (locais.get(local) || 0) + 1);
          }
        });

        apontadorLocais.forEach((locais, apontador) => {
          const entries = Array.from(locais.entries());
          const total = entries.reduce((sum, [, count]) => sum + count, 0);
          const mainLocal = entries.sort((a, b) => b[1] - a[1])[0];
          
          if (mainLocal && entries.length > 1) {
            entries.forEach(([local, count]) => {
              if (local !== mainLocal[0] && count >= 1 && (count / total) < 0.2) {
                newAlerts.push({
                  id: `loc-change-${apontador}-${local}-${Date.now()}`,
                  type: 'warning',
                  category: 'apontador',
                  title: 'Mudança de Local Detectada',
                  description: `${apontador} registrou ${count} viagem(ns) em "${local}" (diferente do local principal "${mainLocal[0]}")`,
                  entity: apontador,
                  timestamp: new Date(),
                  data: { local, mainLocal: mainLocal[0], count },
                  read: false,
                  dismissed: false,
                });
              }
            });
          }
        });
      }

      // Rule 3: Low Volume Detection
      if (rules.find(r => r.id === 'low-volume')?.enabled) {
        const volumes = todayData.map(row => parseFloat(String(row[volumeIdx] || 0).replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length || 0;

        todayData.forEach((row, idx) => {
          const volume = parseFloat(String(row[volumeIdx] || 0).replace(',', '.'));
          const caminhao = row[prefixoCbIdx];
          if (volume > 0 && volume < avgVolume * 0.3 && caminhao) {
            newAlerts.push({
              id: `low-vol-${caminhao}-${idx}-${Date.now()}`,
              type: 'warning',
              category: 'volume',
              title: 'Volume Muito Baixo',
              description: `${caminhao} transportou apenas ${volume.toFixed(1)}m³ (média: ${avgVolume.toFixed(1)}m³). Verificar carga incompleta.`,
              entity: caminhao,
              timestamp: new Date(),
              data: { volume, avgVolume },
              read: false,
              dismissed: false,
            });
          }
        });
      }

      // Rule 4: High Frequency (Rapid Trips) Detection
      if (rules.find(r => r.id === 'high-frequency')?.enabled) {
        const caminhaoTimes = new Map<string, string[]>();
        todayData.forEach(row => {
          const cb = row[prefixoCbIdx];
          const hora = row[horaIdx];
          if (cb && hora) {
            if (!caminhaoTimes.has(cb)) {
              caminhaoTimes.set(cb, []);
            }
            caminhaoTimes.get(cb)!.push(hora);
          }
        });

        caminhaoTimes.forEach((times, caminhao) => {
          const sortedTimes = times.sort();
          for (let i = 1; i < sortedTimes.length; i++) {
            const [h1, m1] = sortedTimes[i - 1].split(':').map(Number);
            const [h2, m2] = sortedTimes[i].split(':').map(Number);
            const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            
            if (diff > 0 && diff < 5) { // Less than 5 minutes between trips
              newAlerts.push({
                id: `rapid-${caminhao}-${i}-${Date.now()}`,
                type: 'error',
                category: 'frequencia',
                title: 'Viagem Muito Rápida',
                description: `${caminhao} registrou 2 viagens com apenas ${diff} minutos de intervalo (${sortedTimes[i-1]} → ${sortedTimes[i]}). Possível duplicidade.`,
                entity: caminhao,
                timestamp: new Date(),
                data: { times: [sortedTimes[i-1], sortedTimes[i]], diff },
                read: false,
                dismissed: false,
              });
            }
          }
        });
      }

      // Rule 5: Inactive Equipment
      if (rules.find(r => r.id === 'inactive-equipment')?.enabled) {
        const allCaminhoes = new Set<string>();
        const activeCaminhoes = new Set<string>();
        
        rows.slice(-500).forEach(row => {
          const cb = row[prefixoCbIdx];
          if (cb) allCaminhoes.add(cb);
        });
        
        todayData.forEach(row => {
          const cb = row[prefixoCbIdx];
          if (cb) activeCaminhoes.add(cb);
        });

        allCaminhoes.forEach(caminhao => {
          if (!activeCaminhoes.has(caminhao)) {
            // Check if it was active yesterday
            const yesterday = dates[1];
            const wasActiveYesterday = rows.some(r => r[dateIdx] === yesterday && r[prefixoCbIdx] === caminhao);
            
            if (wasActiveYesterday) {
              newAlerts.push({
                id: `inactive-${caminhao}-${Date.now()}`,
                type: 'info',
                category: 'sistema',
                title: 'Equipamento Inativo Hoje',
                description: `${caminhao} estava ativo ontem mas não registrou viagens hoje.`,
                entity: caminhao,
                timestamp: new Date(),
                read: false,
                dismissed: false,
              });
            }
          }
        });
      }

      // Rule 6: Descarga > Carga Divergence Detection
      if (rules.find(r => r.id === 'descarga-divergence')?.enabled) {
        try {
          const descargaData = await readSheet('Descarga');
          if (descargaData && descargaData.length >= 2) {
            const descHeaders = descargaData[0];
            const descRows = descargaData.slice(1);
            const descDateIdx = descHeaders.indexOf('Data');
            const descCbIdx = descHeaders.indexOf('Prefixo_Cb') !== -1 
              ? descHeaders.indexOf('Prefixo_Cb') 
              : descHeaders.indexOf('PrefixoCb');
            const descViagensIdx = descHeaders.indexOf('N_Viagens') !== -1 
              ? descHeaders.indexOf('N_Viagens') 
              : descHeaders.indexOf('I_Viagens');

            // Count carga trips per truck today
            const cargaTripMap = new Map<string, number>();
            todayData.forEach(row => {
              const cb = row[prefixoCbIdx];
              const viagens = parseInt(row[getIdx('N_Viagens')] || row[getIdx('I_Viagens')]) || 1;
              if (cb) {
                cargaTripMap.set(cb, (cargaTripMap.get(cb) || 0) + viagens);
              }
            });

            // Count descarga trips per truck today
            const descargaTripMap = new Map<string, number>();
            const todayDescarga = descRows.filter(r => r[descDateIdx] === today);
            todayDescarga.forEach(row => {
              const cb = row[descCbIdx];
              const viagens = parseInt(row[descViagensIdx]) || 1;
              if (cb) {
                descargaTripMap.set(cb, (descargaTripMap.get(cb) || 0) + viagens);
              }
            });

            // Check for trucks with more descarga than carga
            const allTrucks = new Set([...cargaTripMap.keys(), ...descargaTripMap.keys()]);
            allTrucks.forEach(caminhao => {
              const cargaTrips = cargaTripMap.get(caminhao) || 0;
              const descargaTrips = descargaTripMap.get(caminhao) || 0;
              
              if (descargaTrips > cargaTrips) {
                const diferenca = descargaTrips - cargaTrips;
                newAlerts.push({
                  id: `div-desc-${caminhao}-${Date.now()}`,
                  type: 'error',
                  category: 'caminhao',
                  title: 'Descarga > Carga',
                  description: `${caminhao} tem ${descargaTrips} descarga(s) mas apenas ${cargaTrips} carga(s) hoje (${diferenca} a mais). Verificar possível erro de apontamento.`,
                  entity: caminhao,
                  timestamp: new Date(),
                  data: { cargaTrips, descargaTrips, diferenca },
                  read: false,
                  dismissed: false,
                });
              }
            });
          }
        } catch (error) {
          console.error('Error analyzing descarga divergence:', error);
        }
      }

      // Limit and sort alerts
      const sortedAlerts = newAlerts
        .sort((a, b) => {
          const typePriority = { error: 0, warning: 1, info: 2, success: 3 };
          return typePriority[a.type] - typePriority[b.type];
        })
        .slice(0, 50);

      // Notify for new critical alerts
      const prevAlertIds = new Set(alerts.map(a => a.id));
      sortedAlerts.forEach(alert => {
        if (!prevAlertIds.has(alert.id) && (alert.type === 'error' || alert.type === 'warning')) {
          sendPushNotification(alert);
        }
      });

      // Auto-send WhatsApp for new critical alerts
      const newCriticalAlerts = sortedAlerts.filter(
        alert => !prevAlertIds.has(alert.id) && (alert.type === 'error' || alert.type === 'warning')
      );
      
      if (whatsappEnabled && newCriticalAlerts.length > 0) {
        // Debounce WhatsApp sends - only send if last send was more than 5 minutes ago
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (!lastWhatsappSent || lastWhatsappSent < fiveMinutesAgo) {
          sendWhatsAppNotification(newCriticalAlerts);
        }
      }

      setAlerts(sortedAlerts);
      setLastUpdate(new Date());
      setLoading(false);

      if (sortedAlerts.length > 0) {
        toast({
          title: `${sortedAlerts.length} alertas detectados`,
          description: `${sortedAlerts.filter(a => a.type === 'error').length} críticos, ${sortedAlerts.filter(a => a.type === 'warning').length} avisos`,
        });
      }
    } catch (error) {
      console.error('Error analyzing data:', error);
      setLoading(false);
    }
  };

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, read: true } : a
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, dismissed: true } : a
    ));
  };

  const clearAllAlerts = () => {
    setAlerts(prev => prev.map(a => ({ ...a, dismissed: true })));
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
  };

  const getAlertBg = (type: Alert['type'], read: boolean) => {
    const opacity = read ? '50' : '';
    switch (type) {
      case 'error': return `bg-red-${opacity || '100'} border-red-300`;
      case 'warning': return `bg-yellow-${opacity || '100'} border-yellow-300`;
      case 'info': return `bg-blue-${opacity || '100'} border-blue-300`;
      case 'success': return `bg-green-${opacity || '100'} border-green-300`;
    }
  };

  const activeAlerts = alerts.filter(a => !a.dismissed);
  const errorCount = activeAlerts.filter(a => a.type === 'error').length;
  const warningCount = activeAlerts.filter(a => a.type === 'warning').length;
  const infoCount = activeAlerts.filter(a => a.type === 'info').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Bell className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Central de Alertas</h1>
            <p className="text-muted-foreground">
              Monitoramento inteligente em tempo real • Última atualização: {format(lastUpdate, "HH:mm:ss", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <label htmlFor="auto-refresh" className="text-sm">Auto-atualizar</label>
          </div>
          <Button
            variant={whatsappEnabled ? 'default' : 'outline'}
            className={whatsappEnabled ? 'bg-green-600 hover:bg-green-700' : ''}
            onClick={() => setShowWhatsappConfig(true)}
            title="Configurar WhatsApp"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
            {whatsappEnabled && <Badge variant="secondary" className="ml-2 bg-white/20">ON</Badge>}
          </Button>
          <Button variant="outline" onClick={handleManualWhatsAppSend} disabled={activeAlerts.length === 0}>
            <Send className="w-4 h-4 mr-2" />
            Enviar Agora
          </Button>
          <Button variant="outline" onClick={analyzeData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Analisar
          </Button>
        </div>
      </div>

      {/* WhatsApp Status Badge */}
      {whatsappEnabled && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 rounded-lg">
          <MessageCircle className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700">Envio automático ativo</p>
            <p className="text-xs text-green-600">
              {webhookUrl ? 'Via Webhook (Zapier/N8N)' : `Para: ${whatsappPhone}`}
              {lastWhatsappSent && ` • Último envio: ${format(lastWhatsappSent, "HH:mm", { locale: ptBR })}`}
            </p>
          </div>
          <Badge variant="outline" className="border-green-300 text-green-700">
            {sendOnlyErrors ? 'Apenas críticos/avisos' : 'Todos os alertas'}
          </Badge>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Críticos</p>
                <p className="text-3xl font-bold text-red-700">{errorCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Avisos</p>
                <p className="text-3xl font-bold text-yellow-700">{warningCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Informativos</p>
                <p className="text-3xl font-bold text-blue-700">{infoCount}</p>
              </div>
              <Info className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Regras Ativas</p>
                <p className="text-3xl font-bold text-green-700">{rules.filter(r => r.enabled).length}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="w-4 h-4" />
            Alertas ({activeAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings className="w-4 h-4" />
            Configurar Regras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Alertas Ativos
              </CardTitle>
              {activeAlerts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllAlerts}>
                  Limpar todos
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {activeAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                    <h3 className="text-lg font-medium">Tudo em ordem!</h3>
                    <p className="text-muted-foreground">Nenhum alerta detectado no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeAlerts.map(alert => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border-l-4 transition-all ${
                          alert.type === 'error' ? 'bg-red-50 border-l-red-500 dark:bg-red-950/30' :
                          alert.type === 'warning' ? 'bg-yellow-50 border-l-yellow-500 dark:bg-yellow-950/30' :
                          alert.type === 'info' ? 'bg-blue-50 border-l-blue-500 dark:bg-blue-950/30' :
                          'bg-green-50 border-l-green-500 dark:bg-green-950/30'
                        } ${alert.read ? 'opacity-70' : ''}`}
                        onClick={() => markAsRead(alert.id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {getAlertIcon(alert.type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{alert.title}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {alert.entity}
                                </Badge>
                                {!alert.read && (
                                  <Badge variant="default" className="text-xs bg-primary">
                                    Novo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{alert.description}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {format(alert.timestamp, "HH:mm:ss", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                          >
                            Dispensar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Regras de Detecção
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure quais tipos de anomalias devem gerar alertas
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rules.map(rule => (
                  <div
                    key={rule.id}
                    className={`p-4 rounded-lg border transition-all ${
                      rule.enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${rule.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                          <rule.icon className={`w-5 h-5 ${rule.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">{rule.name}</h4>
                          <p className="text-sm text-muted-foreground">{rule.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Configuration Modal */}
      <Dialog open={showWhatsappConfig} onOpenChange={setShowWhatsappConfig}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Configurar Envio WhatsApp
            </DialogTitle>
            <DialogDescription>
              Configure o envio automático de alertas para a equipe técnica via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-base font-medium">Envio Automático</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar alertas automaticamente quando detectados
                </p>
              </div>
              <Switch
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
              />
            </div>

            {/* Webhook Configuration */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Webhook className="w-4 h-4" />
                Webhook (Zapier/N8N)
              </Label>
              <Input
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cole a URL do webhook do Zapier ou N8N para automação completa. 
                O webhook receberá os alertas em formato JSON.
              </p>
            </div>

            {/* Phone Number */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Número WhatsApp (Fallback)
              </Label>
              <Input
                placeholder="5511999999999 (com código do país)"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se o webhook não estiver configurado, abrirá o WhatsApp com a mensagem pronta.
              </p>
            </div>

            {/* Send Only Errors */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-base font-medium">Apenas Críticos e Avisos</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar somente alertas de erro e warning
                </p>
              </div>
              <Switch
                checked={sendOnlyErrors}
                onCheckedChange={setSendOnlyErrors}
              />
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-700 flex items-center gap-2 mb-2">
                <Info className="w-4 h-4" />
                Como configurar o Zapier
              </h4>
              <ol className="text-sm text-blue-600 space-y-1 list-decimal list-inside">
                <li>Crie um novo Zap no Zapier</li>
                <li>Adicione um trigger "Webhooks by Zapier"</li>
                <li>Escolha "Catch Hook"</li>
                <li>Copie a URL gerada e cole acima</li>
                <li>Adicione uma ação "WhatsApp" ou "Twilio"</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsappConfig(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                setShowWhatsappConfig(false);
                toast({
                  title: 'Configurações salvas',
                  description: whatsappEnabled ? 'Envio automático ativado' : 'Configurações atualizadas',
                });
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
