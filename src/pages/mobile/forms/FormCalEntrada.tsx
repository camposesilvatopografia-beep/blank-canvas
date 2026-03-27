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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Scale, Truck, FileText, Camera, X, Image, Clock, CheckCircle2, Trash2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import SuccessScreen from '@/components/mobile/SuccessScreen';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { playSuccessSound, playOfflineSound } from '@/utils/notificationSound';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';
import { formatBankNumberInput, formatToneladaInput } from '@/utils/masks';

interface FornecedorOption {
  id: string;
  nome: string;
}

interface OpenCalEntry {
  id: string;
  timestamp: number;
  formData: {
    data: string;
    fornecedor: string;
    notaFiscal: string;
    prefixoCaminhao: string;
    pesoBruto: string;
    valor: string;
    quantidade: string;
  };
  fotoChegadaUrl: string;
  fotoTicketUrl: string;
  calRowPartial: string[]; // The partial row already built
}

const OPEN_ENTRIES_KEY = 'cal_open_entries';
const PLACAS_HISTORY_KEY = 'cal_placas_history';
const MAX_PLACAS = 20;

function getPlacasHistory(): string[] {
  try {
    const raw = localStorage.getItem(PLACAS_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePlaca(placa: string) {
  if (!placa.trim()) return;
  const upper = placa.trim().toUpperCase();
  const history = getPlacasHistory().filter(p => p !== upper);
  history.unshift(upper);
  localStorage.setItem(PLACAS_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_PLACAS)));
}

function getOpenEntries(): OpenCalEntry[] {
  try {
    const raw = localStorage.getItem(OPEN_ENTRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveOpenEntries(entries: OpenCalEntry[]) {
  localStorage.setItem(OPEN_ENTRIES_KEY, JSON.stringify(entries));
}

function removeOpenEntry(id: string) {
  const entries = getOpenEntries().filter(e => e.id !== id);
  saveOpenEntries(entries);
}

// Photo upload helper
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

interface PhotoFieldProps {
  label: string;
  sublabel: string;
  photo: File | null;
  preview: string | null;
  onCapture: (file: File, url: string) => void;
  onRemove: () => void;
  accentColor: string;
  uploading?: boolean;
}

function PhotoField({ label, sublabel, photo, preview, onCapture, onRemove, accentColor, uploading }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localUploading, setLocalUploading] = useState(false);
  const { toast } = useToast();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalUploading(true);
      try {
        const url = await uploadPhoto(file, 'cal-fotos-temp');
        onCapture(file, url);
        toast({ title: 'Foto salva!', description: 'Foto armazenada no Supabase.', variant: 'default' });
      } catch (err) {
        console.error('Error uploading photo:', err);
        const localUrl = URL.createObjectURL(file);
        onCapture(file, localUrl);
        toast({ title: 'Erro ao salvar', description: 'Foto salva apenas localmente.', variant: 'destructive' });
      } finally {
        setLocalUploading(false);
      }
    }
  };

  const isUploading = uploading || localUploading;
  const borderColor = accentColor === 'emerald' ? 'border-emerald-200' : accentColor === 'orange' ? 'border-orange-200' : 'border-purple-200';
  const bgColor = accentColor === 'emerald' ? 'bg-emerald-50/50' : accentColor === 'orange' ? 'bg-orange-50/50' : 'bg-purple-50/50';
  const textColor = accentColor === 'emerald' ? 'text-emerald-700' : accentColor === 'orange' ? 'text-orange-700' : 'text-purple-700';
  const btnColor = accentColor === 'emerald' ? 'bg-emerald-100 text-emerald-700' : accentColor === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700';

  return (
    <Card className={`p-3 ${borderColor} ${bgColor}`}>
      <Label className={`text-sm font-bold ${textColor} flex items-center gap-1`}>
        <Camera className="w-4 h-4" /> {label}
      </Label>
      <p className="text-xs text-gray-500 mb-2">{sublabel}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {preview ? (
        <div className="relative group">
          <img src={preview} alt={label} className="w-full h-32 object-cover rounded-lg shadow-sm" />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
            {isUploading && <Loader2 className="w-6 h-6 animate-spin text-white" />}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {!isUploading && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-green-500/80 text-[10px] text-white rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Supabase
            </div>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          className={`w-full h-20 ${btnColor} border-dashed border-2 hover:bg-white/50 transition-all`}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-1">
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Image className="w-6 h-6" />}
            <span className="text-xs font-semibold">{isUploading ? 'Salvando no Supabase...' : 'Tirar Foto / Selecionar'}</span>
          </div>
        </Button>
      )}
    </Card>
  );
}


// OCR-enabled weight field with photo capture
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
  accentColor: 'emerald' | 'orange';
}

function OcrWeightField({ label, sublabel, value, onChange, formatFn, photo, preview, onPhotoSet, onPhotoRemove, disabled, accentColor }: OcrWeightFieldProps) {
  const ocrRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const { toast } = useToast();

  const borderColor = accentColor === 'emerald' ? 'border-emerald-200' : 'border-orange-200';
  const bgColor = accentColor === 'emerald' ? 'bg-emerald-50/50' : 'bg-orange-50/50';
  const textColor = accentColor === 'emerald' ? 'text-emerald-700' : 'text-orange-700';
  const btnBorder = accentColor === 'emerald' ? 'border-emerald-400' : 'border-orange-400';

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    onPhotoSet(file, previewUrl);

    setOcrLoading(true);
    try {
      const remoteUrl = await uploadPhoto(file, 'cal-ocr-temp');
      onPhotoSet(file, remoteUrl);
      
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      toast({ title: '✅ Foto capturada!', description: 'Digite o peso manualmente abaixo.' });
    } catch (error: any) {
      toast({ title: '✅ Foto capturada!', description: 'Digite o peso manualmente abaixo.' });
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
      <div className="flex gap-2 relative">
        <Input
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Ex: 32500"
          className={`text-2xl font-bold text-center h-14 flex-1 border-2 ${btnBorder} transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20`}
          disabled={disabled || ocrLoading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => ocrRef.current?.click()}
          disabled={ocrLoading || disabled}
          className={`h-14 px-4 border-2 ${btnBorder} ${textColor} rounded-xl hover:bg-white/50 transition-all`}
        >
          {ocrLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
        </Button>
      </div>
      <p className="text-xs text-right text-gray-400 mt-1">{value ? `Será salvo como: ${formatFn(value)} kg` : 'kg • 📸 Toque na câmera para ler da balança'}</p>
      {preview && (
        <div className="relative mt-2 group">
          <img src={preview} alt={label} className="w-full h-32 object-cover rounded-lg shadow-sm" />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
            {ocrLoading && <Loader2 className="w-6 h-6 animate-spin text-white" />}
          </div>
          <button
            type="button"
            onClick={onPhotoRemove}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {!ocrLoading && (
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-green-500/80 text-[10px] text-white rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Supabase
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function FormCalEntrada() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { appendSheet, loading: sheetLoading, readSheet, deleteRow, writeSheet } = useGoogleSheets();
  const { isOnline, addPendingRecord } = useOfflineSync();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [openEntries, setOpenEntries] = useState<OpenCalEntry[]>([]);
  const [completingEntry, setCompletingEntry] = useState<OpenCalEntry | null>(null);
  const [savedPartial, setSavedPartial] = useState(false);
  const [placasHistory, setPlacasHistory] = useState<string[]>([]);
  const [showPlacaSuggestions, setShowPlacaSuggestions] = useState(false);
  // Photos state
  const [fotoPesoChegada, setFotoPesoChegada] = useState<File | null>(null);
  const [fotoPesoSaida, setFotoPesoSaida] = useState<File | null>(null);
  const [fotoTicket, setFotoTicket] = useState<File | null>(null);
  const [previewChegada, setPreviewChegada] = useState<string | null>(null);
  const [previewSaida, setPreviewSaida] = useState<string | null>(null);
  const [previewTicket, setPreviewTicket] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    fornecedor: 'Cal Trevo',
    notaFiscal: '',
    prefixoCaminhao: '',
    pesoBruto: '',
    pesoVazio: '',
    valor: '',
    quantidade: '',
  });

  // Quantidade (t): usuário digita apenas números e o sistema posiciona a vírgula
  const formatQuantityInput = (raw: string): string => formatToneladaInput(raw);

  // Valor (R$): máscara bancária
  const formatCurrencyInput = (raw: string): string => formatBankNumberInput(raw, 2, 12);

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

  const pesoBrutoRaw = parseNumeric(formData.pesoBruto);
  const pesoVazioRaw = parseNumeric(formData.pesoVazio);
  const diffBruto = Math.max(0, pesoBrutoRaw - pesoVazioRaw);
  // Se a diferença é > 100, os pesos estão em kg — converter para toneladas
  const totalToneladas = diffBruto > 100 ? diffBruto / 1000 : diffBruto;
  const pesoBrutoTon = pesoBrutoRaw;
  const pesoVazioTon = pesoVazioRaw;

  // Photo helpers
  const handlePhotoCapture = (setter: (f: File | null) => void, previewSetter: (s: string | null) => void) => (file: File, url: string) => {
    setter(file);
    previewSetter(url);
  };

  const handlePhotoRemove = (setter: (f: File | null) => void, previewSetter: (s: string | null) => void) => () => {
    setter(null);
    previewSetter(null);
  };

  useEffect(() => {
    const loadFornecedores = async () => {
      const { data } = await supabase
        .from('fornecedores_cal')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');
      if (data) setFornecedores(data);
    };
    loadFornecedores();
    setOpenEntries(getOpenEntries());
    setPlacasHistory(getPlacasHistory());

    // Sync: write any localStorage open entries that are missing from the sheet
    const syncOpenEntriesToSheet = async () => {
      if (!navigator.onLine) return;
      const entries = getOpenEntries();
      if (entries.length === 0) return;
      try {
        const sheetData = await readSheet('Mov_Cal', 'A:A');
        if (!sheetData) return;
        const existingIds = new Set(sheetData.map((row: any[]) => row[0]));
        for (const entry of entries) {
          if (!existingIds.has(entry.id)) {
            const dataFormatada = format(new Date(entry.formData.data + 'T12:00:00'), 'dd/MM/yyyy');
            const hora = format(new Date(entry.timestamp), 'HH:mm');
            const quantidadeFormatted = entry.formData.quantidade || '0,00';
            const pesoBrutoFormatted = entry.formData.pesoBruto || '0,00';
            const partialRow = [
              entry.id,
              dataFormatada,
              'Entrada',
              hora,
              entry.formData.prefixoCaminhao || '',
              pesoBrutoFormatted,               // F: Peso de Chegada
              '',                               // G: Peso Vazio
              '',                               // H: Qtd Balança Obra
              '',                               // I: (reservado)
              entry.fotoChegadaUrl || '',        // J: Foto Peso Chegada
              '',                               // K: Foto Peso Saida
              entry.fotoTicketUrl || '',         // L: Foto Ticket
              entry.formData.fornecedor,         // M: Fornecedor
              'Caminhão Distribuidor',           // N: Prefixo_Eq
              'Tonelada',                        // O: Und
              quantidadeFormatted,               // P: Qtd
              entry.formData.notaFiscal || '',   // Q: NF
              entry.formData.valor ? 'R$ ' + entry.formData.valor : '', // R: Valor
              'Cebolão',                         // S: Local
              effectiveName || '',               // T: Usuario
              'Em aberto',                       // U: Status
            ];

            // Backup to Supabase
            supabase.from('movimentacoes_cal').insert({
              data: entry.formData.data,
              hora: hora,
              prefixo_caminhao: entry.formData.prefixoCaminhao,
              fornecedor: entry.formData.fornecedor,
              nota_fiscal: entry.formData.notaFiscal,
              quantidade: parseNumeric(entry.formData.quantidade),
              local: 'Cebolão',
              usuario: effectiveName,
              foto_path: entry.fotoChegadaUrl,
              nf_foto_path: entry.fotoTicketUrl,
            }).then(({ error }) => {
              if (error) console.error('Supabase backup error (Cal Entrada Sync):', error);
            });

            await appendSheet('Mov_Cal', [partialRow]);
            console.log(`[CAL Sync] Wrote missing open entry ${entry.id} to sheet`);
          }
        }
      } catch (err) {
        console.error('[CAL Sync] Error syncing open entries:', err);
      }
    };
    syncOpenEntriesToSheet();
  }, []);

  // Select an open entry to complete
  const handleSelectOpen = (entry: OpenCalEntry) => {
    setCompletingEntry(entry);
    setFormData({
      ...entry.formData,
      pesoVazio: '',
    });
    // Show uploaded arrival photo if available
    setPreviewChegada(entry.fotoChegadaUrl || null);
    setPreviewTicket(entry.fotoTicketUrl || null);
    setFotoPesoChegada(null); // Already uploaded
    setFotoTicket(null);
    setFotoPesoSaida(null);
    setPreviewSaida(null);
  };

  const handleCancelComplete = () => {
    setCompletingEntry(null);
    handleNewRecord();
  };

  // Save PARTIAL (arrival only)
  const handleSavePartial = async () => {
    if (!formData.quantidade.trim()) {
      toast({ title: 'Erro', description: 'Informe a quantidade.', variant: 'destructive' });
      return;
    }
    if (!formData.prefixoCaminhao.trim()) {
      toast({ title: 'Erro', description: 'Informe a placa/prefixo do caminhão.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const hora = format(now, 'HH:mm');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const dateFolder = format(now, 'yyyy-MM-dd');
      const generateId = () => Math.random().toString(36).substring(2, 10);
      const pesoBrutoFormatted = formData.pesoBruto || '0,00';
      const quantidadeFormatted = formData.quantidade || '0,00';

      // Upload arrival photo if available
      let urlChegada = '';
      let urlTicket = '';
      if (navigator.onLine) {
        if (fotoPesoChegada) {
          try { urlChegada = await uploadPhoto(fotoPesoChegada, `chegada/${dateFolder}`); } catch (err) { console.error('Upload foto chegada:', err); }
        }
        if (fotoTicket) {
          try { urlTicket = await uploadPhoto(fotoTicket, `ticket/${dateFolder}`); } catch (err) { console.error('Upload foto ticket:', err); }
        }
      }

      const entryId = generateId();

      // Write partial row to sheet with status "Em aberto"
      const partialRow = [
        entryId,                          // A: IdCAL
        dataFormatada,                    // B: Data
        'Entrada',                        // C: Tipo
        hora,                             // D: Hora
        formData.prefixoCaminhao || '',   // E: Veiculo
        pesoBrutoFormatted,               // F: Peso de Chegada
        '',                               // G: Peso Vazio
        '',                               // H: Qtd Balança Obra (preenchido ao finalizar)
        '',                               // I: (reservado)
        urlChegada,                       // J: Foto Peso Chegada
        '',                               // K: Foto Peso Saida
        urlTicket,                        // L: Foto Ticket
        formData.fornecedor,              // M: Fornecedor
        'Caminhão Distribuidor',          // N: Prefixo_Eq (fixo)
        'Tonelada',                       // O: Und
        quantidadeFormatted,              // P: Qtd (quantidade informada pelo apontador)
        formData.notaFiscal,              // Q: NF
        formData.valor ? 'R$ ' + formData.valor : '', // R: Valor
        'Cebolão',                        // S: Local
        effectiveName || '',              // T: Usuario
        'Em aberto',                      // U: Status
      ];

      // Backup to Supabase
      if (navigator.onLine) {
        supabase.from('movimentacoes_cal').insert({
          data: formData.data,
          hora,
          prefixo_caminhao: formData.prefixoCaminhao,
          fornecedor: formData.fornecedor,
          nota_fiscal: formData.notaFiscal,
          quantidade: parseNumeric(formData.quantidade),
          local: 'Cebolão',
          usuario: effectiveName,
          foto_path: urlChegada,
          nf_foto_path: urlTicket,
        }).then(({ error }) => {
          if (error) console.error('Supabase backup error (Cal Entrada):', error);
        });
      }

      if (navigator.onLine) {
        await appendSheet('Mov_Cal', [partialRow]);
      }

      const openEntry: OpenCalEntry = {
        id: entryId,
        timestamp: Date.now(),
        formData: {
          data: formData.data,
          fornecedor: formData.fornecedor,
          notaFiscal: formData.notaFiscal,
          prefixoCaminhao: formData.prefixoCaminhao,
          pesoBruto: formData.pesoBruto,
          valor: formData.valor,
          quantidade: formData.quantidade,
        },
        fotoChegadaUrl: urlChegada,
        fotoTicketUrl: urlTicket,
        calRowPartial: [],
      };

      const entries = getOpenEntries();
      entries.push(openEntry);
      saveOpenEntries(entries);
      setOpenEntries(entries);

      savePlaca(formData.prefixoCaminhao);
      setSavedPartial(true);
      setSubmitted(true);
      playSuccessSound();
      toast({ title: 'Chegada Salva!', description: 'Quando o caminhão sair, finalize a pesagem.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Submit COMPLETE record (or completing an open entry)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtdNum = parseNumeric(formData.quantidade);
    if (qtdNum <= 0) {
      toast({ title: 'Erro', description: 'Informe a quantidade.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setSavedOffline(false);

    try {
      const now = new Date();
      const hora = format(now, 'HH:mm');
      const dataFormatada = format(new Date(formData.data + 'T12:00:00'), 'dd/MM/yyyy');
      const generateId = () => Math.random().toString(36).substring(2, 10);

      const quantidadeFormatted = formData.quantidade || '0,00';
      const valorFormatted = formData.valor ? 'R$ ' + formData.valor : '';
      const pesoBrutoFormatted = formData.pesoBruto || '0,00';
      const pesoVazioFormatted = formData.pesoVazio || '0,00';

      // Upload photos
      let urlChegada = completingEntry?.fotoChegadaUrl || '';
      let urlSaida = '';
      let urlTicket = completingEntry?.fotoTicketUrl || '';

      if (navigator.onLine) {
        const dateFolder = format(now, 'yyyy-MM-dd');
        if (fotoPesoChegada) {
          try { urlChegada = await uploadPhoto(fotoPesoChegada, `chegada/${dateFolder}`); } catch (err) { console.error('Upload foto chegada:', err); }
        }
        if (fotoPesoSaida) {
          try { urlSaida = await uploadPhoto(fotoPesoSaida, `saida/${dateFolder}`); } catch (err) { console.error('Upload foto saída:', err); }
        }
        if (fotoTicket) {
          try { urlTicket = await uploadPhoto(fotoTicket, `ticket/${dateFolder}`); } catch (err) { console.error('Upload foto ticket:', err); }
        }
      }

      // Calculate Qtd Balança Obra in toneladas
      const pbNum = parseNumeric(pesoBrutoFormatted);
      const pvNum = parseNumeric(pesoVazioFormatted);
      const qtdBalancaObra = pbNum > 0 && pvNum > 0
        ? Math.max(0, (pbNum > 100 ? pbNum / 1000 : pbNum) - (pvNum > 100 ? pvNum / 1000 : pvNum))
        : 0;
      const qtdBalancaObraFormatted = qtdBalancaObra > 0
        ? qtdBalancaObra.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

      const calRow = [
        completingEntry?.id || generateId(), // A: IdCAL
        dataFormatada,          // B: Data
        'Entrada',              // C: Tipo
        hora,                   // D: Hora
        formData.prefixoCaminhao || '', // E: Veiculo
        pesoBrutoFormatted,     // F: Peso de Chegada (bruto)
        pesoVazioFormatted,     // G: Peso Vazio (tara)
        qtdBalancaObraFormatted, // H: Qtd Balança Obra (tons)
        '',                     // I: (reservado)
        urlChegada,             // J: Foto Peso Chegada
        urlSaida,               // K: Foto Peso Saida
        urlTicket,              // L: Foto Ticket
        formData.fornecedor,    // M: Fornecedor
        'Caminhão Distribuidor', // N: Prefixo_Eq (fixo)
        'Tonelada',             // O: Und
        quantidadeFormatted,    // P: Qtd (quantidade informada)
        formData.notaFiscal,    // Q: NF
        valorFormatted,         // R: Valor
        'Cebolão',              // S: Local
        effectiveName || '',    // T: Usuario
        'Finalizado',           // U: Status
      ];

      if (!navigator.onLine) {
        addPendingRecord('cal', 'Mov_Cal', calRow, { formData });
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
        toast({ title: 'Salvo Localmente', description: 'Será sincronizado quando a conexão voltar.' });
        // Remove open entry if completing
        if (completingEntry) {
          removeOpenEntry(completingEntry.id);
          setOpenEntries(getOpenEntries());
        }
        setLoading(false);
        return;
      }

      // If completing an open entry, find and UPDATE the existing row in-place
      if (completingEntry && navigator.onLine) {
        try {
          const sheetData = await readSheet('Mov_Cal', 'A:A');
          if (sheetData) {
            const rowIdx = sheetData.findIndex((row: any[]) => row[0] === completingEntry.id);
            if (rowIdx >= 0) {
              // rowIdx is 0-based from readSheet (includes header), sheet rows are 1-based
              const sheetRowNum = rowIdx + 1;
              await writeSheet('Mov_Cal', buildRowRange(sheetRowNum, calRow.length), [calRow]);
              
              // Remove open entry
              removeOpenEntry(completingEntry.id);
              setOpenEntries(getOpenEntries());

              savePlaca(formData.prefixoCaminhao);
              setSubmitted(true);
              playSuccessSound();
              toast({ title: 'Sucesso!', description: 'Entrada de CAL finalizada com sucesso.' });
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error('Error updating existing row, will append instead:', err);
        }
      }

      const success = await appendSheet('Mov_Cal', [calRow]);
      if (!success) throw new Error('Erro ao salvar movimento');

      // Remove open entry if completing
      if (completingEntry) {
        removeOpenEntry(completingEntry.id);
        setOpenEntries(getOpenEntries());
      }

      savePlaca(formData.prefixoCaminhao);
      setSubmitted(true);
      playSuccessSound();
      toast({ title: 'Sucesso!', description: 'Entrada de CAL registrada com controle de peso.' });
    } catch (error: any) {
      if (!navigator.onLine) {
        setSavedOffline(true);
        setSubmitted(true);
        playOfflineSound();
      } else {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewRecord = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSavedPartial(false);
    setCompletingEntry(null);
    setFotoPesoChegada(null);
    setFotoPesoSaida(null);
    setFotoTicket(null);
    setPreviewChegada(null);
    setPreviewSaida(null);
    setPreviewTicket(null);
    setOpenEntries(getOpenEntries());
    setFormData({
      data: format(new Date(), 'yyyy-MM-dd'),
      fornecedor: 'Cal Trevo',
      notaFiscal: '',
      prefixoCaminhao: '',
      pesoBruto: '',
      pesoVazio: '',
      valor: '',
      quantidade: '',
    });
  };

  if (submitted) {
    if (savedPartial) {
      const successDetails = [
        { label: 'Tipo', value: 'Chegada (Parcial)' },
        { label: 'Quantidade', value: `${formData.quantidade} ton` },
        ...(formData.pesoBruto ? [{ label: 'Peso Bruto (Conferência)', value: `${formData.pesoBruto} ton` }] : []),
        { label: 'Caminhão', value: formData.prefixoCaminhao },
        ...(formData.fornecedor ? [{ label: 'Fornecedor', value: formData.fornecedor }] : []),
      ];

      return (
        <SuccessScreen
          title="Chegada Registrada!"
          subtitle="Quando o caminhão sair, volte para finalizar a pesagem de saída."
          details={successDetails}
          onNewRecord={handleNewRecord}
          accentColor="amber"
        />
      );
    }

    const successDetails = [
      { label: 'Tipo', value: completingEntry ? 'Entrada Finalizada' : 'Entrada (Pesagem)' },
      { label: 'Quantidade', value: `${formData.quantidade} ton` },
      ...(formData.pesoBruto ? [{ label: 'Peso Bruto (Conferência)', value: `${formData.pesoBruto} ton` }] : []),
      ...(formData.pesoVazio ? [{ label: 'Tara (Conferência)', value: `${formData.pesoVazio} ton` }] : []),
      ...(pesoBrutoTon > 0 && pesoVazioTon > 0 ? [{ label: 'Peso Líquido (Conferência)', value: `${totalToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton` }] : []),
      ...(formData.fornecedor ? [{ label: 'Fornecedor', value: formData.fornecedor }] : []),
      ...(formData.notaFiscal ? [{ label: 'Nota Fiscal', value: formData.notaFiscal }] : []),
      ...(formData.prefixoCaminhao ? [{ label: 'Caminhão', value: formData.prefixoCaminhao }] : []),
      { label: 'Fotos', value: [fotoPesoChegada, fotoPesoSaida, fotoTicket].filter(Boolean).length + ' anexada(s)' },
    ];

    return (
      <SuccessScreen
        title={savedOffline ? "Salvo Localmente!" : "Entrada Registrada!"}
        subtitle={savedOffline ? "Será sincronizado quando a conexão voltar." : "Entrada de CAL com pesagem registrada."}
        details={successDetails}
        onNewRecord={handleNewRecord}
        accentColor={savedOffline ? "amber" : "emerald"}
      />
    );
  }

  const isCompleting = !!completingEntry;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className={`${isCompleting ? 'bg-blue-600' : 'bg-emerald-600'} p-5 sticky top-0 z-10 shadow-md`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => isCompleting ? handleCancelComplete() : navigate(getApontadorHomeRoute())} className="text-white hover:bg-white/20">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {isCompleting ? (
                  <><CheckCircle2 className="w-5 h-5" /> Finalizar Pesagem</>
                ) : (
                  <><Scale className="w-5 h-5" /> Registrar Entrada</>
                )}
              </h1>
              <p className={`${isCompleting ? 'text-blue-100' : 'text-emerald-100'} text-sm`}>
                {isCompleting ? `Caminhão: ${completingEntry.formData.prefixoCaminhao}` : 'Controle por pesagem'}
              </p>
            </div>
          </div>
          <OfflineIndicator isOnline={isOnline} pendingCount={0} />
        </div>
      </div>

      {/* Open Entries Banner */}
      {!isCompleting && openEntries.length > 0 && (
        <div className="p-4 pb-0">
          <Card className="p-3 border-amber-300 bg-amber-50">
            <Label className="text-sm font-bold text-amber-800 flex items-center gap-1 mb-2">
              <Clock className="w-4 h-4" /> Caminhões Aguardando Saída ({openEntries.length})
            </Label>
            <div className="space-y-2">
              {openEntries.map(entry => (
                <div key={entry.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectOpen(entry)}
                    className="flex-1 flex items-center justify-between p-3 rounded-lg bg-white border border-amber-200 hover:bg-amber-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-bold text-sm text-gray-800">{entry.formData.prefixoCaminhao}</p>
                      <p className="text-xs text-gray-500">
                        {entry.formData.fornecedor} • Bruto: {entry.formData.pesoBruto} ton
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(entry.timestamp), 'dd/MM HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600">
                      <span className="text-xs font-medium">Finalizar</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Excluir entrada em aberto do caminhão ${entry.formData.prefixoCaminhao}?`)) {
                        removeOpenEntry(entry.id);
                        setOpenEntries(getOpenEntries());
                        toast({ title: 'Entrada removida', description: `Caminhão ${entry.formData.prefixoCaminhao} removido da fila.` });
                      }
                    }}
                    className="p-3 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-24">
        {/* Completing banner */}
        {isCompleting && (
          <Card className="p-3 border-blue-300 bg-blue-50">
            <p className="text-sm font-bold text-blue-800">Finalizando pesagem do caminhão</p>
            <p className="text-xs text-blue-600 mt-1">
              Chegada: {completingEntry.formData.pesoBruto} ton • {completingEntry.formData.fornecedor}
            </p>
            <p className="text-xs text-blue-500 mt-0.5">
              Informe o peso de saída (vazio) para calcular o líquido.
            </p>
          </Card>
        )}

        {/* Data */}
        <div>
          <Label className="text-sm font-medium text-gray-600">Data</Label>
          <Input
            type="date"
            value={formData.data}
            onChange={e => setFormData({ ...formData, data: e.target.value })}
            className="mt-1"
            disabled={isCompleting}
          />
        </div>

        {/* Caminhão / Prefixo */}
        <div className="relative">
          <Label className="text-sm font-medium text-gray-600">
            <Truck className="w-4 h-4 inline mr-1" /> Placa / Prefixo do Caminhão
          </Label>
          <Input
            value={formData.prefixoCaminhao}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              setFormData({ ...formData, prefixoCaminhao: val });
              setShowPlacaSuggestions(val.length > 0);
            }}
            onFocus={() => setShowPlacaSuggestions(formData.prefixoCaminhao.length > 0 || placasHistory.length > 0)}
            onBlur={() => setTimeout(() => setShowPlacaSuggestions(false), 200)}
            placeholder="Ex: ABC-1234"
            className="mt-1"
            disabled={isCompleting}
            autoComplete="off"
          />
          {showPlacaSuggestions && !isCompleting && (() => {
            const filtered = formData.prefixoCaminhao
              ? placasHistory.filter(p => p.includes(formData.prefixoCaminhao.toUpperCase()) && p !== formData.prefixoCaminhao.toUpperCase())
              : placasHistory;
            if (filtered.length === 0) return null;
            return (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filtered.slice(0, 8).map(placa => (
                  <button
                    key={placa}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setFormData({ ...formData, prefixoCaminhao: placa });
                      setShowPlacaSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-2"
                  >
                    <Truck className="w-3.5 h-3.5 text-gray-400" />
                    {placa}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Quantidade (campo principal) */}
        <Card className="p-4 border-2 border-emerald-400 bg-emerald-50/30">
          <Label className="text-sm font-bold text-emerald-800 flex items-center gap-1">
            <Package className="w-4 h-4" /> Quantidade (Toneladas) *
          </Label>
          <p className="text-xs text-gray-500 mb-2">Quantidade real de CAL recebida</p>
          <Input
            type="tel"
            inputMode="numeric"
            value={formData.quantidade}
            onChange={e => setFormData({ ...formData, quantidade: formatQuantityInput(e.target.value) })}
            placeholder="0,00"
            className="text-2xl font-bold text-center h-14 border-2 border-emerald-400"
            disabled={isCompleting}
          />
          <p className="text-xs text-right text-gray-400 mt-1">
            {formData.quantidade ? `Será salvo como: ${formData.quantidade} ton` : 'Ex: digite 2550 = 25,50 ton'}
          </p>
        </Card>

        {/* Peso Bruto (Chegada) with OCR - CONFERÊNCIA */}
        {!isCompleting ? (
          <OcrWeightField
            label="Peso Bruto - Chegada (Conferência)"
            sublabel="Apenas para conferência na balança (opcional)"
            value={formData.pesoBruto}
            onChange={val => setFormData({ ...formData, pesoBruto: val })}
            formatFn={formatWeightInput}
            photo={fotoPesoChegada}
            preview={previewChegada}
            onPhotoSet={(file, prev) => { setFotoPesoChegada(file); setPreviewChegada(prev); }}
            onPhotoRemove={() => { setFotoPesoChegada(null); setPreviewChegada(null); }}
            accentColor="emerald"
          />
        ) : (
          <Card className="p-4 border-gray-200 bg-gray-50/50">
            <Label className="text-sm font-bold text-gray-600 flex items-center gap-1">
              <Scale className="w-4 h-4" /> Peso Bruto - Conferência
            </Label>
            <p className="text-xl font-bold text-center mt-2 text-gray-600">{formData.pesoBruto || '—'} ton</p>
            {previewChegada && (
              <img src={previewChegada} alt="Chegada" className="w-full h-32 object-cover rounded-lg mt-2" />
            )}
          </Card>
        )}

        {/* Foto do Ticket */}
        {!isCompleting ? (
          <PhotoField
            label="Foto do Ticket"
            sublabel="Foto do comprovante / ticket da balança"
            photo={fotoTicket}
            preview={previewTicket}
            onCapture={handlePhotoCapture(setFotoTicket, setPreviewTicket)}
            onRemove={handlePhotoRemove(setFotoTicket, setPreviewTicket)}
            accentColor="purple"
          />
        ) : previewTicket ? (
          <Card className="p-3 border-purple-200 bg-purple-50/50">
            <Label className="text-sm font-bold text-purple-700 flex items-center gap-1">
              <Camera className="w-4 h-4" /> Foto do Ticket
            </Label>
            <img src={previewTicket} alt="Ticket" className="w-full h-32 object-cover rounded-lg mt-2" />
          </Card>
        ) : null}

        {/* Nota Fiscal */}
        <div>
          <Label className="text-sm font-medium text-gray-600">
            <FileText className="w-4 h-4 inline mr-1" /> Nota Fiscal
          </Label>
          <Input
            value={formData.notaFiscal}
            onChange={e => setFormData({ ...formData, notaFiscal: e.target.value })}
            placeholder="Número da NF"
            className="mt-1"
            disabled={isCompleting}
          />
        </div>

        {/* Valor */}
        <div>
          <Label className="text-sm font-medium text-gray-600">Valor Total (R$)</Label>
          <Input
            type="tel"
            inputMode="numeric"
            value={formData.valor}
            onChange={e => setFormData({ ...formData, valor: formatCurrencyInput(e.target.value) })}
            placeholder="0,00"
            className="mt-1 text-lg font-semibold"
            disabled={isCompleting}
          />
        </div>

        {/* Peso Vazio (Tara/Saída) with OCR — only when completing, conferência */}
        {isCompleting && (
          <OcrWeightField
            label="Tara / Peso Vazio - Saída (Conferência)"
            sublabel="Peso do caminhão vazio (conferência)"
            value={formData.pesoVazio}
            onChange={val => setFormData({ ...formData, pesoVazio: val })}
            formatFn={formatWeightInput}
            photo={fotoPesoSaida}
            preview={previewSaida}
            onPhotoSet={(file, prev) => { setFotoPesoSaida(file); setPreviewSaida(prev); }}
            onPhotoRemove={() => { setFotoPesoSaida(null); setPreviewSaida(null); }}
            accentColor="orange"
          />
        )}

        {/* Total Líquido — conferência, only when completing */}
        {isCompleting && (pesoBrutoTon > 0 && pesoVazioTon > 0) && (
          <Card className="p-4 border-gray-300 bg-gray-50">
            <div className="text-center">
              <p className="text-sm text-gray-600 font-medium">Peso Líquido (Conferência: Bruto − Tara)</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">
                {totalToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-base font-medium">ton</span>
              </p>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Complete submit — only when completing (both weights available) */}
          {isCompleting && (
            <Button
              type="submit"
              disabled={loading || parseNumeric(formData.quantidade) <= 0}
              className="w-full h-14 text-lg font-bold rounded-xl shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
              {loading ? 'Salvando...' : 'Finalizar Entrada'}
            </Button>
          )}

          {/* Partial save (arrival only) - only when NOT completing */}
          {!isCompleting && formData.quantidade.trim() && (
            <Button
              type="button"
              onClick={handleSavePartial}
              disabled={loading || !formData.prefixoCaminhao.trim()}
              className="w-full h-12 text-base bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Clock className="w-5 h-5 mr-2" />}
              Salvar Chegada (Aguardar Saída)
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
