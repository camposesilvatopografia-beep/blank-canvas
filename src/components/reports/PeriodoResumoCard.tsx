import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CalendarIcon, 
  ChevronDown, 
  ChevronUp, 
  Scale, 
  Building2,
  TrendingUp,
  Sparkles,
  Share2,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MaterialStat {
  material: string;
  viagens: number;
  toneladas: number;
  frete: number;
}

interface EmpresaStat {
  empresa: string;
  caminhoes?: number;
  viagens: number;
  toneladas: number;
  frete?: number;
}

type CardVariant = 'total' | 'month' | 'day';

interface PeriodoResumoCardProps {
  title: string;
  subtitle?: string;
  viagens: number;
  toneladas: number;
  frete: number;
  materialStats: MaterialStat[];
  empresaStats: EmpresaStat[];
  variant?: CardVariant;
  showCaminhoes?: boolean;
  defaultExpanded?: boolean;
  freteRate?: number;
  onConfigClick?: () => void;
}

const variantStyles: Record<CardVariant, {
  border: string;
  badge: string;
  bg: string;
  headerBg: string;
  icon: React.ReactNode;
  emoji: string;
}> = {
  total: {
    border: 'border-l-4 border-l-primary',
    badge: 'bg-primary hover:bg-primary/90',
    bg: 'bg-gradient-to-br from-primary/5 via-background to-background',
    headerBg: 'bg-primary/10',
    icon: <Sparkles className="w-3.5 h-3.5 text-primary" />,
    emoji: '📊',
  },
  month: {
    border: 'border-l-4 border-l-teal-500',
    badge: 'bg-teal-500 hover:bg-teal-600',
    bg: 'bg-gradient-to-br from-teal-500/5 via-background to-background',
    headerBg: 'bg-teal-500/10',
    icon: <TrendingUp className="w-3.5 h-3.5 text-teal-600" />,
    emoji: '📅',
  },
  day: {
    border: 'border-l-4 border-l-slate-400',
    badge: 'bg-slate-500 hover:bg-slate-600',
    bg: 'bg-background',
    headerBg: 'bg-muted/50',
    icon: <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />,
    emoji: '📆',
  },
};

export function PeriodoResumoCard({
  title,
  subtitle,
  viagens,
  toneladas,
  frete,
  materialStats,
  empresaStats,
  variant = 'day',
  showCaminhoes = false,
  defaultExpanded = true,
  freteRate,
  onConfigClick,
}: PeriodoResumoCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const styles = variantStyles[variant];

  const formatNumber = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const formatCurrency = (num: number) => num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Calculate total frete for empresas
  const totalEmpresaFrete = empresaStats.reduce((sum, e) => sum + (e.frete || 0), 0);

  const handleWhatsAppExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const emoji = styles.emoji;
    let message = `${emoji} *PEDREIRA - ${title.toUpperCase()}*\n`;
    if (subtitle) message += `📍 ${subtitle}\n`;
    message += `\n`;
    message += `🚛 *${viagens} viagens*\n`;
    message += `⚖️ *${formatNumber(toneladas)} toneladas*\n`;
    message += `💰 *Frete: ${formatCurrency(frete)}*\n`;
    
    if (freteRate) {
      message += `📋 Taxa: ${formatCurrency(freteRate)}/ton\n`;
    }
    
    message += `\n`;
    message += `━━━━━━━━━━━━━━━━━━\n`;
    message += `📦 *POR MATERIAL:*\n`;
    materialStats.forEach(mat => {
      message += `• ${mat.material}: ${mat.viagens} viagens | ${formatNumber(mat.toneladas)}t | ${formatCurrency(mat.frete)}\n`;
    });
    
    message += `\n`;
    message += `🏢 *POR EMPRESA:*\n`;
    empresaStats.forEach(emp => {
      if (showCaminhoes) {
        message += `• ${emp.empresa}: ${emp.caminhoes} cam. | ${emp.viagens} viagens | ${formatNumber(emp.toneladas)}t | ${formatCurrency(emp.frete || 0)}\n`;
      } else {
        message += `• ${emp.empresa}: ${emp.viagens} viagens | ${formatNumber(emp.toneladas)}t | ${formatCurrency(emp.frete || 0)}\n`;
      }
    });
    
    message += `\n━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 _Gerado: ${new Date().toLocaleString('pt-BR')}_`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Abrindo WhatsApp...');
  };

  return (
    <Card 
      className={cn(
        'transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md',
        styles.border,
        styles.bg
      )}
    >
      <CardContent className="pt-0 px-0">
        {/* Header - Always visible */}
        <div 
          className={cn(
            "cursor-pointer select-none px-3 py-2 rounded-t-lg",
            styles.headerBg
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {styles.icon}
              <div>
                <p className={cn(
                  "font-semibold leading-tight",
                  variant === 'total' ? 'text-sm text-primary' : 'text-xs'
                )}>{title}</p>
                {subtitle && <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Badge className={cn(styles.badge, "text-[10px] px-1.5 py-0.5 h-5")}>{viagens} viagens</Badge>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={handleWhatsAppExport}
                title="Compartilhar via WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
              </Button>
              {variant === 'total' && onConfigClick && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigClick();
                  }}
                  title="Configurar taxa de frete"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-5 w-5">
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Summary - Always visible */}
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(
              "p-1.5 rounded-md",
              variant === 'total' ? 'bg-background/80' : ''
            )}>
              <p className={cn(
                "font-bold leading-tight",
                variant === 'total' ? 'text-xl text-primary' : 'text-lg'
              )}>
                {toneladas > 0 ? formatNumber(toneladas) : '0'}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">Total Toneladas</p>
            </div>
            <div className={cn(
              "p-1.5 rounded-md",
              variant === 'total' ? 'bg-background/80' : ''
            )}>
              <p className={cn(
                "font-bold text-emerald-600 leading-tight",
                variant === 'total' ? 'text-xl' : 'text-lg'
              )}>
                {formatCurrency(frete)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Total Frete
                {freteRate && <span className="ml-0.5 text-muted-foreground/70">({formatCurrency(freteRate)}/t)</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Expandable Content - Default expanded */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out px-3',
            isExpanded ? 'max-h-[2000px] opacity-100 py-2' : 'max-h-0 opacity-0 py-0'
          )}
        >
          {/* Por Material */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Scale className="w-3 h-3 text-muted-foreground" />
              <p className="text-[11px] font-medium">Por Material</p>
            </div>
            <div className="space-y-0.5 bg-muted/30 rounded-md p-1.5">
              <div className="grid grid-cols-4 text-[9px] text-muted-foreground font-medium pb-0.5 border-b border-border/50">
                <span>Material</span>
                <span className="text-center">Viagens</span>
                <span className="text-right">Ton</span>
                <span className="text-right">Frete</span>
              </div>
              {materialStats.map(mat => (
                <div key={mat.material} className="grid grid-cols-4 text-[10px] py-0.5">
                  <span className="truncate pr-1">{mat.material}</span>
                  <span className="text-center font-medium">{mat.viagens}</span>
                  <span className="text-right text-primary font-medium">{formatNumber(mat.toneladas)} t</span>
                  <span className="text-right text-emerald-600 font-medium">{formatCurrency(mat.frete)}</span>
                </div>
              ))}
              {materialStats.length === 0 && (
                <p className="text-[9px] text-muted-foreground text-center py-1">Sem dados</p>
              )}
            </div>
          </div>

          {/* Por Empresa */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                <p className="text-[11px] font-medium">Por Empresa</p>
              </div>
              {totalEmpresaFrete > 0 && (
                <span className="text-[9px] text-emerald-600 font-medium">
                  Total: {formatCurrency(totalEmpresaFrete)}
                </span>
              )}
            </div>
            <div className="space-y-0.5 bg-muted/30 rounded-md p-1.5">
              {showCaminhoes ? (
                <>
                  <div className="grid grid-cols-5 text-[9px] text-muted-foreground font-medium pb-0.5 border-b border-border/50">
                    <span>Empresa</span>
                    <span className="text-center">Cam.</span>
                    <span className="text-center">Viagens</span>
                    <span className="text-right">Ton</span>
                    <span className="text-right">Frete</span>
                  </div>
                  {empresaStats.map(emp => (
                    <div key={emp.empresa} className="grid grid-cols-5 text-[10px] py-0.5">
                      <span className="truncate pr-1">{emp.empresa}</span>
                      <span className="text-center">{emp.caminhoes}</span>
                      <span className="text-center font-medium">{emp.viagens}</span>
                      <span className="text-right text-primary font-medium">{formatNumber(emp.toneladas)} t</span>
                      <span className="text-right text-emerald-600 font-medium">{formatCurrency(emp.frete || 0)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 text-[9px] text-muted-foreground font-medium pb-0.5 border-b border-border/50">
                    <span>Empresa</span>
                    <span className="text-center">Viagens</span>
                    <span className="text-right">Ton</span>
                    <span className="text-right">Frete</span>
                  </div>
                  {empresaStats.map(emp => (
                    <div key={emp.empresa} className="grid grid-cols-4 text-[10px] py-0.5">
                      <span className="truncate pr-1">{emp.empresa}</span>
                      <span className="text-center font-medium">{emp.viagens}</span>
                      <span className="text-right text-primary font-medium">{formatNumber(emp.toneladas)} t</span>
                      <span className="text-right text-emerald-600 font-medium">{formatCurrency(emp.frete || 0)}</span>
                    </div>
                  ))}
                </>
              )}
              {empresaStats.length === 0 && (
                <p className="text-[9px] text-muted-foreground text-center py-1">Sem dados</p>
              )}
            </div>
          </div>
        </div>

        {/* Collapsed indicator */}
        {!isExpanded && (materialStats.length > 0 || empresaStats.length > 0) && (
          <div className="text-[9px] text-muted-foreground text-center py-1.5 px-3 border-t border-border/30">
            <span className="flex items-center justify-center gap-0.5">
              Clique para expandir
              <ChevronDown className="w-2.5 h-2.5" />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
