import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Upload, Trash2, Save, Image, CheckCircle2 } from 'lucide-react';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useAppLogo } from '@/hooks/useAppLogo';
import logoApropriapp from '@/assets/logo-apropriapp.png';

export default function Obra() {
  const { obraConfig, setObraConfig, loading } = useObraConfig();
  const { customLogo } = useAppLogo();

  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form fields whenever obraConfig loads from localStorage
  useEffect(() => {
    if (!loading) {
      setNome(obraConfig.nome);
      setLocal(obraConfig.local);
      setLogo(obraConfig.logo);
    }
  }, [loading, obraConfig.nome, obraConfig.local, obraConfig.logo]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('A logo deve ter no máximo 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogo(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setObraConfig({ nome, local, logo });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewLogo = logo || customLogo || logoApropriapp;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Building2 className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Dados da Obra</h1>
      </div>
      <p className="text-muted-foreground text-sm -mt-4">
        Essas informações aparecem no cabeçalho de todos os relatórios gerados.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação da Obra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome-obra">Nome da Obra</Label>
            <Input
              id="nome-obra"
              placeholder="Ex: Consórcio Aero Maragogi - AL"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
          </div>

          {/* Local */}
          <div className="space-y-2">
            <Label htmlFor="local-obra">Local / Município</Label>
            <Input
              id="local-obra"
              placeholder="Ex: Maragogi - AL"
              value={local}
              onChange={e => setLocal(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="w-4 h-4" />
            Logo da Obra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="flex-shrink-0 w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
              <img
                src={previewLogo}
                alt="Preview da logo"
                className="w-full h-full object-contain p-1"
              />
            </div>

            <div className="space-y-3 flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
                id="logo-upload-obra"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2"
              >
                <Upload className="w-4 h-4" />
                {logo ? 'Trocar Logo' : 'Enviar Logo da Obra'}
              </Button>
              {logo && (
                <Button
                  variant="outline"
                  onClick={handleRemoveLogo}
                  className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover Logo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 3MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview section */}
      {(nome || local || logo) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Prévia do cabeçalho nos relatórios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-[#1d3557] rounded-lg px-6 py-4 flex items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <img src={previewLogo} alt="Logo" className="h-12 w-12 object-contain rounded bg-white/20 p-0.5" />
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">{nome || 'Nome da Obra'}</h2>
                  {local && <p className="text-white/70 text-xs">{local}</p>}
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm text-right">
                <span className="text-xs font-medium text-gray-700">RELATÓRIO</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2 min-w-[140px]">
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar Dados
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
