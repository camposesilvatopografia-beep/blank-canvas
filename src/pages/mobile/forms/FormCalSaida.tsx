import { useState, useEffect, useRef } from 'react';
import { buildRowRange } from '@/utils/sheetHelpers';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, FlaskConical, ArrowUpCircle, Scale, Camera, X, Clock, CheckCircle2, Trash2, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';

interface OpenCalSaida {
  id: string;
  timestamp: number;
  rowSynced: boolean;
  formData: {
    data: string;
    pesoVazio: string;
  };
  fotoPesoVazioUrl: string;
}

const OPEN_SAIDAS_KEY = 'cal_open_saidas';

function getOpenSaidas(): OpenCalSaida[] {
  try {
    const raw = localStorage.getItem(OPEN_SAIDAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveOpenSaidas(entries: OpenCalSaida[]) {
  localStorage.setItem(OPEN_SAIDAS_KEY, JSON.stringify(entries));
}

function removeOpenSaida(id: string) {
  const entries = getOpenSaidas().filter(e => e.id !== id);
  saveOpenSaidas(entries);
}

// OCR-enabled weight field
interface OcrWeightFieldProps {
  label: string;
  sublabel: string;
  value: string;
  onChange: (val: string) => void;
  formatFn: (raw: string) => string;
  photo: File | null;
  preview: string | null;
  onPhotoSet: (file: File, preview: string) => void;
  onPhotoRemove: () => void;
  disabled?: boolean;
  accentColor: 'orange' | 'emerald';
}

function OcrWeightField({ label, sublabel, value, onChange, formatFn, photo, preview, onPhotoSet, onPhotoRemove, disabled, accentColor }: OcrWeightFieldProps) {
  const ocrRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const { toast } = useToast();

  const borderColor = accentColor === 'orange' ? 'border-orange-200' : 'border-emerald-200';
  const bgColor = accentColor === 'orange' ? 'bg-orange-50/50' : 'bg-emerald-50/50';
  const textColor = accentColor === 'orange' ? 'text-orange-700' : 'text-emerald-700';
  const btnBorder = accentColor === 'orange' ? 'border-orange-400' : 'border-emerald-400';

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Save photo BEFORE attempting OCR
    const previewUrl = URL.createObjectURL(file);
    onPhotoSet(file, previewUrl);

    setOcrLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const response = await supabase.functions.invoke('ocr-peso', {
        body: { imageBase64: base64 },
      });
      if (response.error) throw response.error;
      const { value: ocrValue } = response.data;
      if (ocrValue && ocrValue !== 'ERRO') {
        onChange(String(parseInt(ocrValue, 10)));
        toast({ title: '✅ Peso lido com sucesso!', description: `Valor: ${formatFn(ocrValue)}` });
      } else {
        toast({ title: 'Foto salva!', description: 'Digite o peso manualmente.' });
      }
    } catch (error: any) {
      toast({ title: 'Foto salva!', description: 'OCR indisponível — digite o peso manualmente.' });
    } finally {
      setOcrLoading(false);
      if (ocrRef.current) ocrRef.current.value = '';
    }
  };

  return (
    <Card className={`p-4 ${borderColor} ${bgColor}`}>
      <Label className={`text-sm font-bold ${textColor} flex items-center gap-1`}>
        <Scale className="w-4 h-4" /> {label}
      </Label>
      <p className="text-xs text-gray-500 mb-2">{sublabel}</p>
      <div className="flex gap-2">
        <Input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Ex: 32500"
          className={`text-2xl font-bold text-center h-14 flex-1 border-2 ${btnBorder}`}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => ocrRef.current?.click()}
          disabled={ocrLoading || disabled}
          className={`h-14 px-4 border-2 ${btnBorder} ${textColor} rounded-xl`}
        >
          {ocrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
        </Button>
      </div>
      <input
        ref={ocrRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleOcr}
      />
      <p className="text-xs text-right text-gray-400 mt-1">{value ? `Será salvo como: ${formatFn(value)} kg` : 'kg • 📸 Toque na câmera para ler da balança'}</p>
      {preview && (
        <div className="relative mt-2">
          <img src={preview} alt={label} className="w-full h-32 object-cover rounded-lg" />
          <button
            type="button"
            onClick={onPhotoRemove}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </Card>
  );
}

async function uploadPhoto(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('cal-fotos')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('cal-fotos').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export default function FormCalSaida() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, readSheet, writeSheet } = useGoogleSheets();
  const { isOnline, addPendingRecord } = useOfflineSync();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [openSaidas, setOpenSaidas] = useState<OpenCalSaida[]>([]);
  const [completingEntry, setCompletingEntry] = useState<OpenCalSaida | null>(null);

  // Photo states
  const [fotoPesoVazio, setFotoPesoVazio] = useState<File | null>(null);
  const [previewPesoVazio, setPreviewPesoVazio] = useState<string | null>(null);
  const [fotoPesoCarregado, setFotoPesoCarregado] = useState<File | null>(null);
  const [previewPesoCarregado, setPreviewPesoCarregado] = useState<string | null>(null);

  // Step 1 form: pesagem vazia
  const [pesoVazio, setPesoVazio] = useState('');
  const [dataStep1, setDataStep1] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Step 2 form: pesagem carregado
  const [pesoCarregado, setPesoCarregado] = useState('');

  // Success details for display
  const [successDetails, setSuccessDetails] = useState<{ label: string; value: string }[]>([]);
  const [successTitle, setSuccessTitle] = useState('');
  const [successSubtitle, setSuccessSubtitle] = useState('');

  const defaultFornecedor = 'Cal Trevo';
  const defaultPrefixoEq = 'Caminhão Distribuidor';

  // Weight input: raw kg digits → formatted with thousands separator (32500 → 32.500,00)
  const formatWeightInput = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const value = parseInt(digits, 10);
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseNumeric = (val: string): number => {
    if (!val) return 0;
    return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
  };

  useEffect(() => {
    setOpenSaidas(getOpenSaidas());
  }, []);

  // ─── STEP 1: Save peso vazio as "Em aberto" ───
  const handleSaveStep1 = async () => {
    if (!pesoVazio) {
      toast({ title: 'Erro', description: 'Informe o peso vazio.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setSavedOffline(false);
    try {
      const now = new Date();
      const hora = format(now, 'HH:mm');
      const dataFormatada = format(new Date(dataStep1 + 'T12:00:00'), 'dd/MM/yyyy');
      const dateFolder = format(now, 'yyyy-MM-dd');
      const entryId = Math.random().toString(36).substring(2, 10);

      let urlPesoVazio = '';
      if (navigator.onLine && fotoPesoVazio) {
        try { urlPesoVazio = await uploadPhoto(fotoPesoVazio, `saida-vazio/${dateFolder}`); } catch (err) { console.error('Upload foto peso vazio:', err); }
      }

      // Save to sheet as "Em aberto"
      const calRow = [
        entryId,                              // A: IdCAL
        dataFormatada,                        // B: Data
        'Saida',                              // C: Tipo
        hora,                                 // D: Hora
        '',                                   // E: Veiculo
        '',                                   // F: Peso de Chegada (preenchido no step2)
        pesoVazio || '0,00',                  // G: Peso Vazio
        '',                                   // H: Qtd Balança Obra (preenchido no step2)
        '',                                   // I: (reservado)
        '',                                   // J: Foto Peso Chegada
        urlPesoVazio,                         // K: Foto Peso Saida (peso vazio)
        '',                                   // L: Foto Ticket
        defaultFornecedor,                    // M: Fornecedor
        defaultPrefixoEq,                     // N: Prefixo_Eq
        'Tonelada',                           // O: Und
        '',                                   // P: Qtd (será calculada no step 2)
        '',                                   // Q: NF
        '',                                   // R: Valor
        'Cebolão',                            // S: Local
        effectiveName || '',                  // T: Usuario
        'Em aberto',                          // U: Status
      ];

      let rowSynced = false;
      if (navigator.onLine) {
        await appendSheet('Mov_Cal', [calRow]);
        rowSynced = true;
      } else {
        addPendingRecord('cal', 'Mov_Cal', calRow, { formData: { pesoVazio, data: dataStep1 } });
        rowSynced = false;
      }

      // Save to localStorage for pending list
      const newEntry: OpenCalSaida = {
        id: entryId,
        timestamp: now.getTime(),
        rowSynced,
        formData: { data: dataStep1, pesoVazio },
        fotoPesoVazioUrl: urlPesoVazio,
      };
      const current = getOpenSaidas();
      current.push(newEntry);
      saveOpenSaidas(current);
      setOpenSaidas(current);

      setSuccessTitle(navigator.onLine ? 'Peso Vazio Registrado!' : 'Salvo Localmente!');
      setSuccessSubtitle('Quando o caminhão voltar carregado, abra o registro pendente para finalizar.');
      setSuccessDetails([
        { label: 'Etapa', value: 'Pesagem Vazia (Aguardando Carregamento)' },
        { label: 'Peso Vazio', value: `${pesoVazio} ton` },
      ]);

      if (!navigator.onLine) {
        setSavedOffline(true);
        playOfflineSound();
      } else {
        playSuccessSound();
      }
      setSubmitted(true);
      toast({ title: '✅ Peso vazio registrado!', description: 'Aguardando caminhão voltar carregado.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 2: Finalize with peso carregado ───
  const handleFinalizeStep2 = async () => {
    if (!completingEntry) return;
    if (!pesoCarregado) {
      toast({ title: 'Erro', description: 'Informe o peso carregado.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const dateFolder = format(now, 'yyyy-MM-dd');

      let urlPesoCarregado = '';
      if (navigator.onLine && fotoPesoCarregado) {
        try { urlPesoCarregado = await uploadPhoto(fotoPesoCarregado, `saida-carregado/${dateFolder}`); } catch (err) { console.error(err); }
      }

      const pvNum = parseNumeric(completingEntry.formData.pesoVazio);
      const pcNum = parseNumeric(pesoCarregado);
      // Convert to tons if values are in kg (> 100)
      const pvTon = pvNum > 100 ? pvNum / 1000 : pvNum;
      const pcTon = pcNum > 100 ? pcNum / 1000 : pcNum;
      const quantidadeTon = Math.max(0, pcTon - pvTon);
      const quantidadeFormatada = quantidadeTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      // Qtd Balança Obra in tons
      const qtdBalancaObraFormatted = quantidadeTon > 0
        ? quantidadeFormatada
        : '';

      if (navigator.onLine) {
        // Find the row in the sheet and update it
        try {
          const sheetData = await readSheet('Mov_Cal');
          if (sheetData && sheetData.length > 0) {
            const headers = sheetData[0];
            const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const getIdx = (name: string) => headers.findIndex((h: string) => normalize(String(h)) === normalize(name));
            const idCol = getIdx('IdCAL');

            let found = false;
            for (let i = 1; i < sheetData.length; i++) {
              if (String(sheetData[i][idCol]) === completingEntry.id) {
                const row = [...sheetData[i]];
                while (row.length < headers.length) row.push('');

                // Update Peso de Chegada (col F = peso carregado na saída)
                const fIdx = getIdx('PesodeChegada') !== -1 ? getIdx('PesodeChegada') : (getIdx('PesoCarregado') !== -1 ? getIdx('PesoCarregado') : 5);
                row[fIdx] = pesoCarregado;

                // Update Qtd Balança Obra (col H)
                const hIdx = getIdx('QtdBalancaObra') !== -1 ? getIdx('QtdBalancaObra') : (getIdx('QtdBalançaObra') !== -1 ? getIdx('QtdBalançaObra') : 7);
                row[hIdx] = qtdBalancaObraFormatted;

                // Update foto carregado → column J (Foto do Peso Chegada)
                const jIdx = getIdx('FotodoPesoChegada') !== -1 ? getIdx('FotodoPesoChegada') : (getIdx('FotoPesoChegada') !== -1 ? getIdx('FotoPesoChegada') : 9);
                if (urlPesoCarregado) row[jIdx] = urlPesoCarregado;

                const pIdx = getIdx('Qtd') !== -1 ? getIdx('Qtd') : 15;
                row[pIdx] = quantidadeFormatada;

                const uIdx = getIdx('Status') !== -1 ? getIdx('Status') : 20;
                row[uIdx] = 'Finalizado';

                await writeSheet('Mov_Cal', buildRowRange(i + 1, row.length), [row]);
                found = true;
                break;
              }
            }
            if (!found) {
              const dataFormatada = format(new Date(completingEntry.formData.data + 'T12:00:00'), 'dd/MM/yyyy');
              const calRow = [
                completingEntry.id, dataFormatada, 'Saida', format(now, 'HH:mm'), '',
                pesoCarregado,                              // F: Peso de Chegada
                completingEntry.formData.pesoVazio || '0,00', // G: Peso Vazio
                qtdBalancaObraFormatted,                     // H: Qtd Balança Obra
                 '',                                          // I: reservado
                 urlPesoCarregado,                            // J: Foto do Peso Chegada (carregado)
                 completingEntry.fotoPesoVazioUrl || '',      // K: Foto do Peso Saida (vazio)
                 '',                                          // L: Foto do Ticket
                defaultFornecedor, defaultPrefixoEq, 'Tonelada', quantidadeFormatada,
                '', '', 'Cebolão', effectiveName || '', 'Finalizado',
              ];
              await appendSheet('Mov_Cal', [calRow]);
            }
          }
        } catch (err) {
          console.error('[CAL Saida Step2] Error updating row:', err);
        }
      } else {
        const dataFormatada = format(new Date(completingEntry.formData.data + 'T12:00:00'), 'dd/MM/yyyy');
        const calRow = [
          completingEntry.id, dataFormatada, 'Saida', format(now, 'HH:mm'), '',
          pesoCarregado,                              // F: Peso de Chegada
          completingEntry.formData.pesoVazio || '0,00', // G: Peso Vazio
          qtdBalancaObraFormatted,                     // H: Qtd Balança Obra
           '',                                          // I: reservado
           urlPesoCarregado,                            // J: Foto do Peso Chegada (carregado)
           completingEntry.fotoPesoVazioUrl || '',      // K: Foto do Peso Saida (vazio)
           '',                                          // L: Foto do Ticket
          defaultFornecedor, defaultPrefixoEq, 'Tonelada', quantidadeFormatada,
          '', '', 'Cebolão', effectiveName || '', 'Finalizado',
        ];
        addPendingRecord('cal', 'Mov_Cal', calRow, {});
        setSavedOffline(true);
        playOfflineSound();
      }

      // Remove from pending
      removeOpenSaida(completingEntry.id);
      setOpenSaidas(getOpenSaidas());

      setSuccessTitle(navigator.onLine ? 'Saída Finalizada!' : 'Salvo Localmente!');
      setSuccessSubtitle(navigator.onLine ? 'Saída de CAL registrada e finalizada.' : 'Será sincronizado quando a conexão voltar.');
      setSuccessDetails([
        { label: 'Tipo', value: 'Saída (Obra)' },
        { label: 'Peso Vazio', value: `${completingEntry.formData.pesoVazio} ton` },
        { label: 'Peso Carregado', value: `${pesoCarregado} ton` },
        { label: 'Quantidade', value: `${quantidadeFormatada} ton` },
      ]);

      if (navigator.onLine) playSuccessSound();
      setSubmitted(true);
      toast({ title: '✅ Saída finalizada!' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Select open entry to complete
  const handleSelectOpen = (entry: OpenCalSaida) => {
    setCompletingEntry(entry);
    setPesoCarregado('');
    setFotoPesoCarregado(null);
    setPreviewPesoCarregado(null);
  };

  const handleCancelComplete = () => {
    setCompletingEntry(null);
    setPesoCarregado('');
    setFotoPesoCarregado(null);
    setPreviewPesoCarregado(null);
  };

  const handleDeleteOpen = (id: string) => {
    removeOpenSaida(id);
    setOpenSaidas(getOpenSaidas());
    toast({ title: 'Removido', description: 'Registro pendente removido.' });
  };

  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setCompletingEntry(null);
    setPesoVazio('');
    setPesoCarregado('');
    setDataStep1(format(new Date(), 'yyyy-MM-dd'));
    setFotoPesoVazio(null);
    setPreviewPesoVazio(null);
    setFotoPesoCarregado(null);
    setPreviewPesoCarregado(null);
    setOpenSaidas(getOpenSaidas());
  };

  // Computed
  const isCompleting = !!completingEntry;
  const pvNumPreview = isCompleting ? parseNumeric(completingEntry.formData.pesoVazio) : 0;
  const pcNumPreview = parseNumeric(pesoCarregado);
  const diffPreview = Math.max(0, pcNumPreview - pvNumPreview);
  const qtdPreview = diffPreview > 100 ? diffPreview / 1000 : diffPreview;
  const qtdPreviewStr = qtdPreview.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (submitted) {
    return (
      <SuccessScreen
        title={successTitle}
        subtitle={successSubtitle}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor={savedOffline ? 'amber' : 'emerald'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-orange-600 p-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(getApontadorHomeRoute())} className="text-white hover:bg-orange-700">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5" />
                {isCompleting ? 'Finalizar Saída' : 'Registrar Saída'}
              </h1>
              <p className="text-orange-100 text-sm">
                {isCompleting ? 'Informe o peso carregado' : 'Passo 1: Registre o peso vazio'}
              </p>
            </div>
          </div>
          <OfflineIndicator isOnline={isOnline} pendingCount={0} />
        </div>
      </div>

      {/* Pending entries list */}
      {!isCompleting && openSaidas.length > 0 && (
        <div className="p-4 pb-0">
          <Card className="border-amber-300 bg-amber-50">
            <div className="p-3">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4" /> Aguardando Carregamento ({openSaidas.length})
              </h3>
              <p className="text-xs text-amber-600 mb-2">
                Toque para informar o peso carregado quando o caminhão voltar
              </p>
              <div className="space-y-2">
                {openSaidas.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200">
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => handleSelectOpen(entry)}
                    >
                      <p className="text-sm font-semibold text-amber-900">
                        <Truck className="w-3.5 h-3.5 inline mr-1" />
                        {format(new Date(entry.timestamp), 'dd/MM HH:mm')}
                      </p>
                      <p className="text-xs text-amber-600">
                        Peso Vazio: {entry.formData.pesoVazio} ton
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleSelectOpen(entry)}
                      >
                        <Scale className="w-4 h-4 mr-1" /> Pesar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-300"
                        onClick={() => handleDeleteOpen(entry.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── STEP 2: Completing entry ─── */}
      {isCompleting && (
        <div className="p-4 space-y-5 pb-24">
          {/* Header with cancel */}
          <Card className="border-emerald-300 bg-emerald-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Finalizando Saída
                <span className="text-xs font-normal text-emerald-600">
                  ({format(new Date(completingEntry.timestamp), 'dd/MM HH:mm')})
                </span>
              </p>
              <Button size="sm" variant="outline" onClick={handleCancelComplete} className="text-gray-500">
                Cancelar
              </Button>
            </div>
          </Card>

          {/* Peso Vazio (read-only) */}
          <OcrWeightField
            label="Peso Vazio (registrado)"
            sublabel="Peso do caminhão vazio — registrado no passo 1"
            value={completingEntry.formData.pesoVazio}
            onChange={() => {}}
            formatFn={(v) => v}
            photo={null}
            preview={completingEntry.fotoPesoVazioUrl || null}
            onPhotoSet={() => {}}
            onPhotoRemove={() => {}}
            disabled
            accentColor="orange"
          />

          {/* Peso Carregado */}
          <OcrWeightField
            label="Peso Carregado (após carregar no Silo)"
            sublabel="Peso do caminhão carregado na balança"
            value={pesoCarregado}
            onChange={v => setPesoCarregado(v)}
            formatFn={formatWeightInput}
            photo={fotoPesoCarregado}
            preview={previewPesoCarregado}
            onPhotoSet={(file, preview) => { setFotoPesoCarregado(file); setPreviewPesoCarregado(preview); }}
            onPhotoRemove={() => { setFotoPesoCarregado(null); setPreviewPesoCarregado(null); }}
            accentColor="emerald"
          />

          {/* Quantidade calculada preview */}
          {pesoCarregado && (
            <Card className="p-4 border-emerald-200 bg-emerald-50/50">
              <Label className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                <FlaskConical className="w-4 h-4" /> Quantidade Calculada
              </Label>
              <p className="text-xs text-gray-500 mb-2">Peso Carregado − Peso Vazio</p>
              <p className="text-3xl font-bold text-center text-emerald-700">{qtdPreviewStr} ton</p>
            </Card>
          )}

          <Button
            type="button"
            disabled={loading || !pesoCarregado || qtdPreview <= 0}
            onClick={handleFinalizeStep2}
            className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            {loading ? 'Finalizando...' : 'Finalizar Saída'}
          </Button>
        </div>
      )}

      {/* ─── STEP 1: Peso Vazio form ─── */}
      {!isCompleting && (
        <form onSubmit={(e) => { e.preventDefault(); handleSaveStep1(); }} className="p-4 space-y-5 pb-24">
          {/* Info banner */}
          <Card className="p-3 border-blue-200 bg-blue-50">
            <p className="text-xs text-blue-700">
              <strong>Passo 1:</strong> Registre o peso vazio antes do caminhão ir carregar no silo. 
              Quando ele voltar carregado (10-15 min), abra o registro pendente acima para finalizar.
            </p>
          </Card>

          {/* Data */}
          <div>
            <Label className="text-sm font-medium text-gray-600">Data</Label>
            <Input
              type="date"
              value={dataStep1}
              onChange={e => setDataStep1(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Peso Vazio */}
          <OcrWeightField
            label="Peso Vazio (antes de carregar)"
            sublabel="Peso do caminhão vazio antes de ir ao silo"
            value={pesoVazio}
            onChange={v => setPesoVazio(v)}
            formatFn={formatWeightInput}
            photo={fotoPesoVazio}
            preview={previewPesoVazio}
            onPhotoSet={(file, preview) => { setFotoPesoVazio(file); setPreviewPesoVazio(preview); }}
            onPhotoRemove={() => { setFotoPesoVazio(null); setPreviewPesoVazio(null); }}
            accentColor="orange"
          />

          <Button
            type="submit"
            disabled={loading || !pesoVazio}
            className="w-full h-14 text-lg bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Scale className="w-5 h-5 mr-2" />}
            {loading ? 'Registrando...' : 'Registrar Peso Vazio'}
          </Button>
        </form>
      )}
    </div>
  );
}
