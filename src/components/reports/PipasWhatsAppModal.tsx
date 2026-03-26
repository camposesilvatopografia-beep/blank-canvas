import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Copy, Check, Droplets } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PipaResumoData {
  prefixo: string;
  empresa: string;
  capacidade: number;
  viagens: number;
}

interface LocalResumo {
  local: string;
  items: PipaResumoData[];
  total: number;
}

interface PipasWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    date: string;
    totalPipas: number;
    totalViagens: number;
    volumeAgua: number;
    locais: LocalResumo[];
  };
}

const STORAGE_KEY = 'pipas_whatsapp_config';

export function PipasWhatsAppModal({ open, onOpenChange, data }: PipasWhatsAppModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Load saved config
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setPhoneNumber(config.phoneNumber || '');
      } catch (e) {
        console.error('Error loading config:', e);
      }
    }
  }, []);

  // Save config when phone changes
  useEffect(() => {
    if (phoneNumber) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ phoneNumber }));
    }
  }, [phoneNumber]);

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  const generateMessage = () => {
    let message = `💧 *RESUMO PIPAS - ${data.date}*\n\n`;
    
    // General stats
    message += `📊 *Resumo Geral:*\n`;
    message += `• Pipas Ativas: ${data.totalPipas}\n`;
    message += `• Total Viagens: ${data.totalViagens}\n`;
    message += `• Volume Estimado: ${formatNumber(data.volumeAgua)} L\n\n`;
    
    // Details by location
    if (data.locais.length > 0) {
      data.locais.forEach((localData) => {
        message += `📍 *${localData.local}* (${localData.total} viagens)\n`;
        localData.items.forEach((item) => {
          message += `   • ${item.prefixo} - ${item.viagens} viagens\n`;
        });
        message += `\n`;
      });
    }
    
    message += `_Relatório gerado - ApropriAPP_`;
    
    return message;
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generateMessage());
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "Mensagem copiada para a área de transferência.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(generateMessage());
    const phone = phoneNumber.replace(/\D/g, '');
    const url = phone 
      ? `https://wa.me/${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-600" />
            Exportar Pipas para WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie o resumo diário de Pipas via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-4 border">
            <Label className="text-xs text-muted-foreground mb-2 block">Prévia da mensagem:</Label>
            <Textarea 
              value={generateMessage()} 
              readOnly 
              className="min-h-[250px] text-sm bg-white resize-none font-mono text-xs"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp (opcional)</Label>
            <Input
              id="phone"
              placeholder="+55 82 99999-9999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para escolher o contato ao enviar.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopyMessage} className="flex-1 gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
            <Button onClick={handleSendWhatsApp} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
              <MessageCircle className="w-4 h-4" />
              Enviar WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
