import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send, Settings, Copy, Check, Loader2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    date: string;
    estoqueAnterior: number;
    entradasDia: number;
    saidasDia: number;
    estoqueAtual: number;
    totalEntradas: number;
    totalSaidas: number;
    saldo: number;
  };
}

const STORAGE_KEY = 'cal_whatsapp_config';

export function WhatsAppExportModal({ open, onOpenChange, data }: WhatsAppExportModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load saved config
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setPhoneNumber(config.phoneNumber || '');
        setWebhookUrl(config.webhookUrl || '');
        setAutoSendEnabled(config.autoSendEnabled || false);
      } catch (e) {
        console.error('Error loading config:', e);
      }
    }
  }, []);

  // Save config when it changes
  const saveConfig = () => {
    const config = { phoneNumber, webhookUrl, autoSendEnabled };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast({
      title: "Configuração salva",
      description: "Suas preferências foram salvas com sucesso.",
    });
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const generateMessage = () => {
    return `📊 *RESUMO CAL - ${data.date}*

📦 *Controle Diário:*
• Estoque Anterior: ${formatNumber(data.estoqueAnterior)} ton
• Entradas do Dia: ${formatNumber(data.entradasDia)} ton
• Saídas do Dia: ${formatNumber(data.saidasDia)} ton
• *Estoque Atual: ${formatNumber(data.estoqueAtual)} ton*

📈 *Acumulado do Período:*
• Total Entradas: ${formatNumber(data.totalEntradas)} ton

_Relatório gerado automaticamente - ApropriAPP_`;
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

  const handleTriggerWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "URL não configurada",
        description: "Por favor, insira a URL do webhook Zapier.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          date: data.date,
          estoqueAnterior: data.estoqueAnterior,
          entradasDia: data.entradasDia,
          saidasDia: data.saidasDia,
          estoqueAtual: data.estoqueAtual,
          totalEntradas: data.totalEntradas,
          totalSaidas: data.totalSaidas,
          saldo: data.saldo,
          message: generateMessage(),
          triggered_from: window.location.origin,
        }),
      });

      toast({
        title: "Enviado!",
        description: "Requisição enviada ao Zapier. Verifique o histórico do seu Zap para confirmar.",
      });
    } catch (error) {
      console.error("Error triggering webhook:", error);
      toast({
        title: "Erro",
        description: "Falha ao enviar para o Zapier. Verifique a URL e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Exportar para WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie o resumo diário de CAL via WhatsApp ou configure envio automático.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="enviar" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="enviar" className="gap-2">
              <Send className="w-4 h-4" />
              Enviar
            </TabsTrigger>
            <TabsTrigger value="configurar" className="gap-2">
              <Settings className="w-4 h-4" />
              Automático
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="space-y-4 mt-4">
            {/* Preview */}
            <div className="bg-muted/50 rounded-lg p-4 border">
              <Label className="text-xs text-muted-foreground mb-2 block">Prévia da mensagem:</Label>
              <Textarea 
                value={generateMessage()} 
                readOnly 
                className="min-h-[200px] text-sm bg-white resize-none"
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
          </TabsContent>

          <TabsContent value="configurar" className="space-y-4 mt-4">
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label htmlFor="webhook" className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                URL do Webhook Zapier
              </Label>
              <Input
                id="webhook"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Crie um Zap com trigger "Webhooks by Zapier" e cole a URL aqui.
              </p>
            </div>

            {/* Auto Send Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label>Envio Automático Diário</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar resumo automaticamente ao final do dia
                </p>
              </div>
              <Switch
                checked={autoSendEnabled}
                onCheckedChange={setAutoSendEnabled}
              />
            </div>

            {autoSendEnabled && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  ⚠️ Para envio 100% automático, configure um agendamento no Zapier 
                  que chame este webhook diariamente no horário desejado.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveConfig} className="flex-1">
                Salvar Configuração
              </Button>
              <Button 
                onClick={handleTriggerWebhook} 
                disabled={isLoading || !webhookUrl}
                className="flex-1 gap-2 bg-orange-500 hover:bg-orange-600"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Testar Webhook
              </Button>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
              <p className="font-medium">Como configurar o envio automático:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Acesse <a href="https://zapier.com" target="_blank" rel="noopener" className="text-primary underline">zapier.com</a> e crie um novo Zap</li>
                <li>Escolha "Webhooks by Zapier" como trigger</li>
                <li>Selecione "Catch Hook" e copie a URL gerada</li>
                <li>Cole a URL acima e salve</li>
                <li>Configure a ação desejada (ex: enviar WhatsApp via Twilio)</li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
