import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Loader2, Eye, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateRdoPdfBlob } from '@/hooks/useRdoPdfExport';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface HistoricRdo {
  id: string;
  data: string;
  numero_rdo: string | null;
  status: string;
  aprovacao1_status: string | null;
  aprovacao2_status: string | null;
  aprovacao3_status: string | null;
  aprovacao1_data: string | null;
  aprovacao2_data: string | null;
  aprovacao3_data: string | null;
  created_at: string;
}

interface HistoricoRdosPanelProps {
  rdos: HistoricRdo[];
  currentToken: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'Aprovado') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Aprovado
      </span>
    );
  }
  if (status === 'Reprovado') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-700">
        <XCircle className="w-3 h-3" /> Reprovado
      </span>
    );
  }
  if (status === 'Aprovado Parcialmente') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
        <Clock className="w-3 h-3" /> Parcial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      {status}
    </span>
  );
}

function HistoricoItem({ rdo, currentToken }: { rdo: HistoricRdo; currentToken: string }) {
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const dataFormatada = (() => {
    try {
      return format(new Date(rdo.data + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return rdo.data;
    }
  })();

  const fetchRdoData = async () => {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/rdo-historic-pdf?rdo_id=${rdo.id}&token=${currentToken}`,
      { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY } }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao carregar dados do RDO');
    }
    return res.json();
  };

  const handlePreview = async () => {
    // Se já temos a URL, apenas abre
    if (previewUrl) { setShowPreview(true); return; }
    setPreviewing(true);
    try {
      const data = await fetchRdoData();
      const blob = await generateRdoPdfBlob({
        rdo: data.rdo, obra: data.obra, efetivo: data.efetivo,
        equipamentos: data.equipamentos, servicos: data.servicos,
        fotos: data.fotos, assinaturas: data.assinaturas,
      });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar visualização');
    } finally {
      setPreviewing(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const data = await fetchRdoData();
      const blob = await generateRdoPdfBlob({
        rdo: data.rdo, obra: data.obra, efetivo: data.efetivo,
        equipamentos: data.equipamentos, servicos: data.servicos,
        fotos: data.fotos, assinaturas: data.assinaturas,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RDO_${rdo.numero_rdo || rdo.data}_${data.obra?.nome?.replace(/\s+/g, '_') || 'obra'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* Fullscreen preview overlay */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-background border-b shrink-0 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 font-semibold text-sm h-9 px-3"
              onClick={() => setShowPreview(false)}
            >
              <XIcon className="w-4 h-4" />
              ← Voltar
            </Button>
            <span className="font-medium text-sm text-muted-foreground truncate max-w-[140px] sm:max-w-xs">
              RDO {dataFormatada}{rdo.numero_rdo ? ` · Nº ${rdo.numero_rdo}` : ''}
            </span>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9 shrink-0"
              onClick={handleDownloadPdf} disabled={downloading}>
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
          </div>
          <iframe src={previewUrl} className="flex-1 w-full border-0" title={`RDO ${dataFormatada}`} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 py-2.5 px-1 border-b border-border/50 last:border-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">
              {dataFormatada}
              {rdo.numero_rdo && (
                <span className="text-muted-foreground font-normal"> · RDO #{rdo.numero_rdo}</span>
              )}
            </p>
            <div className="mt-0.5">
              <StatusBadge status={rdo.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" className="gap-1 h-8 text-xs px-2.5"
            onClick={handlePreview} disabled={previewing || downloading}>
            {previewing
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Gerando...</>
              : <><Eye className="w-3 h-3" /> Ver</>
            }
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-8 text-xs px-2.5"
            onClick={handleDownloadPdf} disabled={downloading || previewing}>
            {downloading
              ? <><Loader2 className="w-3 h-3 animate-spin" /> PDF...</>
              : <><Download className="w-3 h-3" /> PDF</>
            }
          </Button>
        </div>
      </div>
    </>
  );
}

export function HistoricoRdosPanel({ rdos, currentToken }: HistoricoRdosPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!rdos || rdos.length === 0) return null;

  const visibleRdos = expanded ? rdos : rdos.slice(0, 3);

  return (
    <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Histórico de RDOs</p>
          <p className="text-xs text-muted-foreground">{rdos.length} documento{rdos.length !== 1 ? 's' : ''} anteriores disponíveis</p>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 divide-y divide-border/30">
        {visibleRdos.map(r => (
          <HistoricoItem key={r.id} rdo={r} currentToken={currentToken} />
        ))}
      </div>

      {/* Ver mais */}
      {rdos.length > 3 && (
        <button
          className="w-full px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-center gap-1.5 hover:bg-muted/30 transition-colors border-t"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Ver todos ({rdos.length - 3} mais)</>
          }
        </button>
      )}
    </div>
  );
}
