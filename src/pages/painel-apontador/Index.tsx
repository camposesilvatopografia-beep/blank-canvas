import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Smartphone, 
  Copy, 
  Share2, 
  ExternalLink,
  Download,
  QrCode,
  Link as LinkIcon,
  FileText,
  ChevronDown,
  ChevronUp,
  Terminal,
  Package,
  Key,
  Upload,
  CheckCircle2,
  PlayCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function PainelApontador() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [twaOpen, setTwaOpen] = useState(false);
  
  const installUrl = window.location.origin + '/install';
  const mobileLoginUrl = window.location.origin + '/mobile/auth';
  const publishedUrl = window.location.origin;
  
  const copyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado!', description: `${label} copiado para a área de transferência.` });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Código copiado!', description: 'Comando copiado para a área de transferência.' });
  };

  const shareLink = async (url: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Acesse o ApropriAPP - ${title}`,
          url,
        });
      } catch (err) {
        copyLink(url, title);
      }
    } else {
      copyLink(url, title);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas administradores podem acessar esta página.</p>
        </Card>
      </div>
    );
  }

  const twaSteps = [
    {
      icon: Terminal,
      title: 'Instalar Bubblewrap',
      description: 'Ferramenta do Google para criar TWA',
      code: 'npm install -g @nicholasbraun/pwa2apk',
    },
    {
      icon: Package,
      title: 'Inicializar Projeto',
      description: 'Criar projeto Android a partir do manifest',
      code: `npx bubblewrap init --manifest ${publishedUrl}/manifest.json`,
    },
    {
      icon: Key,
      title: 'Gerar Keystore',
      description: 'Criar chave de assinatura do APK',
      code: 'keytool -genkeypair -v -keystore apropriapp.keystore -alias apropriapp -keyalg RSA -keysize 2048 -validity 10000',
    },
    {
      icon: FileText,
      title: 'Extrair SHA256',
      description: 'Obter fingerprint para assetlinks.json',
      code: 'keytool -list -v -keystore apropriapp.keystore -alias apropriapp | grep SHA256',
    },
    {
      icon: Upload,
      title: 'Build APK/AAB',
      description: 'Gerar arquivo para instalação/Play Store',
      code: 'npx bubblewrap build',
    },
    {
      icon: PlayCircle,
      title: 'Instalar no Dispositivo',
      description: 'Testar no Android via ADB',
      code: 'adb install app-release-signed.apk',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Painel do Apontador</h1>
            <p className="text-muted-foreground">Gerencie apontadores e distribua o app mobile</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/cadastros/apontadores')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm">Gerenciar</p>
                <p className="text-2xl font-bold">Apontadores</p>
                <p className="text-amber-100 text-xs mt-1">Criar, editar e permissões</p>
              </div>
              <Users className="w-12 h-12 text-amber-200" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => window.open(installUrl, '_blank')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Instalar</p>
                <p className="text-2xl font-bold">App PWA</p>
                <p className="text-green-100 text-xs mt-1">Adicionar à tela inicial</p>
              </div>
              <Download className="w-12 h-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => window.open(mobileLoginUrl, '_blank')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Acessar</p>
                <p className="text-2xl font-bold">Login Mobile</p>
                <p className="text-blue-100 text-xs mt-1">Testar acesso do apontador</p>
              </div>
              <ExternalLink className="w-12 h-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* App Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Distribuição do App Mobile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Install Link */}
          <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                <img src={logoApropriapp} alt="ApropriAPP" className="w-12 h-12 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                  Link de Instalação do App
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  Compartilhe este link com os apontadores para que instalem o app no celular
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={installUrl}
                    readOnly
                    className="bg-white dark:bg-green-950 border-green-300 dark:border-green-700 text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => copyLink(installUrl, 'Link de instalação')}
                    className="shrink-0 border-green-300 hover:bg-green-200"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={() => shareLink(installUrl, 'Instalação do App')}
                    className="shrink-0 bg-green-600 hover:bg-green-700 gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Login Link */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                <Smartphone className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  Link de Login Mobile
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Link direto para a tela de login do apontador no celular
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={mobileLoginUrl}
                    readOnly
                    className="bg-white dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => copyLink(mobileLoginUrl, 'Link de login')}
                    className="shrink-0 border-blue-300 hover:bg-blue-200"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={() => shareLink(mobileLoginUrl, 'Login do App')}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TWA Android Section */}
      <Card className="border-purple-200 dark:border-purple-800">
        <Collapsible open={twaOpen} onOpenChange={setTwaOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  App Android (TWA) - Google Play Store
                  <Badge variant="outline" className="ml-2 text-purple-600 border-purple-300">Avançado</Badge>
                </CardTitle>
                {twaOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* What is TWA */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  O que é TWA (Trusted Web Activity)?
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                  TWA permite empacotar seu PWA como um app Android nativo para publicar na <strong>Google Play Store</strong>.
                  O app roda em <strong>tela cheia</strong> (sem barra de endereço) e atualiza automaticamente.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-purple-600">Tela Cheia</Badge>
                  <Badge className="bg-purple-600">Play Store</Badge>
                  <Badge className="bg-purple-600">Auto-Update</Badge>
                  <Badge className="bg-purple-600">Android 10+</Badge>
                </div>
              </div>

              {/* Configuration Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-xl">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Configurações do App
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package Name:</span>
                      <code className="bg-background px-2 py-0.5 rounded">app.lovable.apropriapp</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start URL:</span>
                      <code className="bg-background px-2 py-0.5 rounded">/mobile/auth</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Theme Color:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-amber-500"></div>
                        <code className="bg-background px-2 py-0.5 rounded">#f59e0b</code>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Background:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-[#2d3e50]"></div>
                        <code className="bg-background px-2 py-0.5 rounded">#2d3e50</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-xl">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    URLs Importantes
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Manifest:</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2"
                        onClick={() => copyLink(`${publishedUrl}/manifest.json`, 'Manifest URL')}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Asset Links:</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2"
                        onClick={() => copyLink(`${publishedUrl}/.well-known/assetlinks.json`, 'Asset Links URL')}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Login Mobile:</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2"
                        onClick={() => copyLink(`${publishedUrl}/mobile/auth`, 'Login URL')}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step by Step */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Passo a Passo para Criar o APK
                </h4>
                <div className="space-y-3">
                  {twaSteps.map((step, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl border hover:bg-muted transition-colors"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shrink-0">
                        <step.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                          <h5 className="font-medium">{step.title}</h5>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-background px-3 py-2 rounded text-xs font-mono overflow-x-auto">
                            {step.code}
                          </code>
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="shrink-0 h-8 w-8"
                            onClick={() => copyCode(step.code)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alternative: PWABuilder */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Alternativa: PWABuilder (Interface Visual)
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Se preferir uma interface visual, use o PWABuilder do Microsoft:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline"
                    className="border-blue-300 hover:bg-blue-200"
                    onClick={() => window.open('https://www.pwabuilder.com/', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir PWABuilder
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => copyLink(publishedUrl, 'URL do App')}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar URL do App
                  </Button>
                </div>
              </div>

              {/* Documentation Link */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Documentação Completa</p>
                    <p className="text-sm text-muted-foreground">Guia detalhado em docs/TWA_ANDROID_SETUP.md</p>
                  </div>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Disponível
                </Badge>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Como distribuir o App
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-amber-600">1</span>
              </div>
              <h4 className="font-semibold mb-2">Cadastre o Apontador</h4>
              <p className="text-sm text-muted-foreground">
                Acesse "Cadastro de Apontadores" e crie um novo usuário com email e senha
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-amber-600">2</span>
              </div>
              <h4 className="font-semibold mb-2">Compartilhe o Link</h4>
              <p className="text-sm text-muted-foreground">
                Envie o link de instalação via WhatsApp ou email para o apontador
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-amber-600">3</span>
              </div>
              <h4 className="font-semibold mb-2">Apontador Acessa</h4>
              <p className="text-sm text-muted-foreground">
                O apontador instala o app e faz login com as credenciais fornecidas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-6 justify-start gap-4"
          onClick={() => navigate('/cadastros/apontadores')}
        >
          <Users className="w-8 h-8 text-primary" />
          <div className="text-left">
            <p className="font-semibold">Cadastro de Apontadores</p>
            <p className="text-sm text-muted-foreground">Criar, editar e gerenciar permissões</p>
          </div>
        </Button>
        
        <Button 
          variant="outline" 
          className="h-auto py-6 justify-start gap-4"
          onClick={() => navigate('/cadastros/usuarios')}
        >
          <Users className="w-8 h-8 text-primary" />
          <div className="text-left">
            <p className="font-semibold">Gestão de Usuários</p>
            <p className="text-sm text-muted-foreground">Administradores e configurações avançadas</p>
          </div>
        </Button>
      </div>
    </div>
  );
}
