import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Home, Plus, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';

interface SuccessScreenProps {
  title: string;
  subtitle?: string;
  details?: { label: string; value: string }[];
  onNewRecord?: () => void;
  showNewRecordButton?: boolean;
  autoRedirectDelay?: number;
  accentColor?: string;
  imageUrl?: string;
}

export default function SuccessScreen({
  title,
  subtitle = 'Os dados foram sincronizados com sucesso.',
  details = [],
  onNewRecord,
  showNewRecordButton = true,
  autoRedirectDelay = 0,
  accentColor = 'green',
  imageUrl,
}: SuccessScreenProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(autoRedirectDelay);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Animate content in
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (autoRedirectDelay > 0 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, autoRedirectDelay]);

  const colorClasses = {
    green: {
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-500',
      ring: 'ring-green-500/30',
      button: 'bg-green-500 hover:bg-green-600',
    },
    blue: {
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-500',
      ring: 'ring-blue-500/30',
      button: 'bg-blue-500 hover:bg-blue-600',
    },
    cyan: {
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-500',
      ring: 'ring-cyan-500/30',
      button: 'bg-cyan-500 hover:bg-cyan-600',
    },
    amber: {
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-500',
      ring: 'ring-amber-500/30',
      button: 'bg-amber-500 hover:bg-amber-600',
    },
    purple: {
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-500',
      ring: 'ring-purple-500/30',
      button: 'bg-purple-500 hover:bg-purple-600',
    },
  };

  const colors = colorClasses[accentColor as keyof typeof colorClasses] || colorClasses.green;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card
        className={cn(
          'bg-white/10 border-white/20 p-8 max-w-sm w-full transform transition-all duration-500',
          showContent ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        )}
      >
        {/* Success Icon with Animation */}
        <div className="relative flex justify-center mb-6">
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center ring-4 transition-all duration-700',
              colors.iconBg,
              colors.ring,
              showContent ? 'scale-100' : 'scale-0'
            )}
          >
            <CheckCircle2
              className={cn(
                'w-10 h-10 transition-all duration-500 delay-200',
                colors.iconColor,
                showContent ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              )}
            />
          </div>
          {/* Animated rings */}
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              showContent ? 'animate-ping' : ''
            )}
          >
            <div className={cn('w-20 h-20 rounded-full opacity-20', colors.iconBg)} />
          </div>
        </div>

        {/* Title */}
        <h2
          className={cn(
            'text-xl font-bold text-white text-center mb-2 transition-all duration-500 delay-300',
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
        >
          {title}
        </h2>

        {/* Subtitle */}
        <p
          className={cn(
            'text-white/60 text-center mb-6 transition-all duration-500 delay-400',
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
        >
          {subtitle}
        </p>

        {/* Details */}
        {details.length > 0 && (
          <div
            className={cn(
              'bg-white/5 rounded-lg p-4 mb-6 space-y-2 transition-all duration-500 delay-500',
              showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            )}
          >
            {details.map((detail, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-white/50">{detail.label}</span>
                <span className="text-white font-medium">{detail.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Image Display */}
        {imageUrl && (
          <div
            className={cn(
              'mb-6 rounded-lg overflow-hidden border-2 border-white/10 transition-all duration-500 delay-[550ms]',
              showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            )}
          >
            <img 
              src={imageUrl} 
              alt="Comprovante" 
              className="w-full h-auto object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div
          className={cn(
            'space-y-3 transition-all duration-500 delay-600',
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
        >
          {showNewRecordButton && onNewRecord && (
            <Button
              onClick={onNewRecord}
              className={cn('w-full h-12 font-semibold', colors.button)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Novo Apontamento
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => navigate(getApontadorHomeRoute())}
            className="w-full h-12 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Home className="w-5 h-5 mr-2" />
            Voltar ao Início
            {countdown > 0 && (
              <span className="ml-2 text-white/40">({countdown}s)</span>
            )}
          </Button>
        </div>

        {/* Sync indicator */}
        <div
          className={cn(
            'mt-6 flex items-center justify-center gap-2 text-xs text-white/40 transition-all duration-500 delay-700',
            showContent ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Dados sincronizados com a planilha e Supabase
        </div>
      </Card>
    </div>
  );
}
