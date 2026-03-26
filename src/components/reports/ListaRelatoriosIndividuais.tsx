import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileDown, CalendarDays, Truck, Camera, ExternalLink, Scale, X, Eye, Pencil, ImageIcon } from 'lucide-react';
import { PedreiraFilterBar } from '@/components/reports/PedreiraFilterBar';
import { useObraConfig } from '@/hooks/useObraConfig';
import { exportRelatorioIndividualPedreira } from '@/components/reports/RelatorioIndividualPedreira';
import { PedreiraEditModal } from '@/components/crud/PedreiraEditModal';
import { getPhotoFallbackCandidates, normalizePhotoUrl } from '@/utils/photoUrl';

interface TripRecord {
  rowIndex?: number;
  data?: string;
  hora: string;
  ordem: string;
  fornecedor: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  placa: string;
  material: string;
  pesoVazio: number;
  pesoFinal: number;
  pesoLiquido: number;
  tonelada: number;
  toneladaTicket?: number;
  toneladaCalcObra?: number;
  frete?: number;
  pesoChegada: number;
  pesoVazioObra?: number;
  fotoChegada: string;
  fotoPesagem: string;
  fotoVazio?: string;
}

interface ListaRelatoriosIndividuaisProps {
  records: TripRecord[];
  selectedDate: string;
  allRecords?: TripRecord[];
  availableDates?: string[];
  headers?: string[];
  onEditSuccess?: () => void;
}

const encodeFallbackQueue = (urls: string[]) => urls.map(url => encodeURIComponent(url)).join('||');

const getPhotoRenderSources = (url?: string | null) => {
  const candidates = getPhotoFallbackCandidates(url);
  return {
    primary: candidates[0] || '',
    fallbackQueue: encodeFallbackQueue(candidates.slice(1)),
  };
};

const tryNextPhotoFallback = (img: HTMLImageElement) => {
  const queue = (img.dataset.fallbackQueue || '')
    .split('||')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => decodeURIComponent(part));

  const [next, ...remaining] = queue;
  if (!next) return false;

  img.dataset.fallbackQueue = encodeFallbackQueue(remaining);
  img.src = next;
  return true;
};

export function ListaRelatoriosIndividuais({
  records,
  selectedDate,
  allRecords,
  availableDates = [],
  headers = [],
  onEditSuccess,
}: ListaRelatoriosIndividuaisProps) {
  const { obraConfig } = useObraConfig();
  const [internalDate, setInternalDate] = useState<string>('');
  const [previewRecord, setPreviewRecord] = useState<TripRecord | null>(null);
  const [filterMaterial, setFilterMaterial] = useState<string[]>([]);
  const [filterFornecedor, setFilterFornecedor] = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterVeiculo, setFilterVeiculo] = useState<string[]>([]);
  const [editRecord, setEditRecord] = useState<TripRecord | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; label: string } | null>(null);

  const baseRecordsForDate = useMemo(() => {
    if (internalDate && allRecords) {
      return allRecords.filter(r => r.data === internalDate);
    }
    return records;
  }, [internalDate, allRecords, records]);

  const activeRecords = useMemo(() => {
    return baseRecordsForDate.filter(r => {
      if (filterMaterial.length > 0 && !filterMaterial.includes(r.material)) return false;
      if (filterFornecedor.length > 0 && !filterFornecedor.includes(r.fornecedor)) return false;
      if (filterEmpresa.length > 0 && !filterEmpresa.includes(r.empresa)) return false;
      if (filterVeiculo.length > 0 && !filterVeiculo.includes(r.prefixo)) return false;
      return true;
    });
  }, [baseRecordsForDate, filterMaterial, filterFornecedor, filterEmpresa, filterVeiculo]);

  const activeDate = internalDate || selectedDate;
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const handleExportAll = async () => {
    for (const record of activeRecords) {
      await exportRelatorioIndividualPedreira(record as any, obraConfig);
      await new Promise(r => setTimeout(r, 600));
    }
  };

  if (records.length === 0 && !internalDate) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Truck className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-base font-medium">Relatórios Individuais — {activeDate}</CardTitle>
              {activeRecords.length > 0 && (
                <Badge variant="secondary">{activeRecords.length} viagens</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {availableDates.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <Select
                    value={internalDate || selectedDate}
                    onValueChange={(v) => setInternalDate(v === selectedDate ? '' : v)}
                  >
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue placeholder="Filtrar data" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDates.map(d => (
                        <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeRecords.length > 0 && (
                <Button onClick={handleExportAll} size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50">
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportar Todos
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-2">
          <PedreiraFilterBar
            records={baseRecordsForDate}
            filterMaterial={filterMaterial} setFilterMaterial={setFilterMaterial}
            filterFornecedor={filterFornecedor} setFilterFornecedor={setFilterFornecedor}
            filterEmpresa={filterEmpresa} setFilterEmpresa={setFilterEmpresa}
            filterVeiculo={filterVeiculo} setFilterVeiculo={setFilterVeiculo}
          />
        </CardContent>

        {activeRecords.length === 0 ? (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum registro para esta data.</p>
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-0 overflow-x-auto">
            <Table className="table-fixed w-full text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-1.5 px-1.5 w-[5%]">Hora</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[5%]">Nº OS</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[6%]">Prefixo</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[10%]">Motorista</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[7%]">Material</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[8%] text-right bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">P. Vazio</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[8%] text-right bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">P. Carreg.</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[7%] text-right bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-bold">Ton. Ped.</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[8%] text-right bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300">P. Cheg.</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[8%] text-right bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-bold">Ton. Obra</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[7%] text-right">Dif. (t)</TableHead>
                  <TableHead className="py-1.5 px-1.5 w-[11%] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRecords.map((record, idx) => {
                  const fotoPesagemUrl = normalizePhotoUrl(record.fotoPesagem);
                  const fotoChegadaUrl = normalizePhotoUrl(record.fotoChegada);
                  const fotoVazioUrl = normalizePhotoUrl(record.fotoVazio);
                  const tonTicket = record.toneladaTicket || record.tonelada || 0;
                  // Ton Calc Obra: pesoChegada - (pesoVazioObra se informado, senão pesoVazio cadastro)
                  const pesoVazioEfetivo = (record.pesoVazioObra && record.pesoVazioObra > 0) ? record.pesoVazioObra : record.pesoVazio;
                  const tonCalcObra = (record.pesoChegada > 0 && pesoVazioEfetivo > 0)
                    ? (record.pesoChegada - pesoVazioEfetivo) / 1000
                    : (record.toneladaCalcObra || 0);
                  const difTon = tonCalcObra > 0 && tonTicket > 0
                    ? (tonCalcObra - tonTicket) : 0;
                  const hasDif = Math.abs(difTon) > 0.0005;
                  

                  return (
                    <TableRow key={idx} className="cursor-pointer hover:bg-muted/50" onClick={() => setPreviewRecord(record)}>
                      <TableCell className="py-1.5 px-1.5 font-medium truncate">{record.hora}</TableCell>
                      <TableCell className="py-1.5 px-1.5 truncate">{record.ordem || '—'}</TableCell>
                      <TableCell className="py-1.5 px-1.5 font-semibold truncate">{record.prefixo}</TableCell>
                      <TableCell className="py-1.5 px-1.5 truncate">{record.motorista || '—'}</TableCell>
                      <TableCell className="py-1.5 px-1.5 truncate">{record.material}</TableCell>
                      <TableCell className="py-1.5 px-1.5 text-right bg-amber-50/50 dark:bg-amber-950/10">{record.pesoVazio > 0 ? record.pesoVazio.toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell className="py-1.5 px-1.5 text-right bg-amber-50/50 dark:bg-amber-950/10">{record.pesoFinal > 0 ? record.pesoFinal.toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell className="py-1.5 px-1.5 text-right font-bold bg-amber-50/50 dark:bg-amber-950/10 text-amber-700 dark:text-amber-400">{tonTicket > 0 ? fmt(tonTicket) : '—'}</TableCell>
                      <TableCell className="py-1.5 px-1.5 text-right bg-blue-50/50 dark:bg-blue-950/10">{record.pesoChegada > 0 ? record.pesoChegada.toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell className="py-1.5 px-1.5 text-right font-bold bg-blue-50/50 dark:bg-blue-950/10 text-blue-700 dark:text-blue-400">{tonCalcObra > 0 ? fmt(tonCalcObra) : '—'}</TableCell>
                      <TableCell className="py-1.5 px-1.5 text-right">
                        {hasDif ? (
                          <span className={`font-bold ${difTon > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {difTon > 0 ? '+' : ''}{fmt(difTon)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-1.5 px-1.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5 flex-wrap">
                          {record.fotoPesagem ? (
                            <button onClick={() => setPhotoPreview({ url: fotoPesagemUrl, label: '⚖️ Pesagem Pedreira (Balança)' })}
                              className="text-amber-600 hover:text-amber-800" title="Foto Pesagem Pedreira">
                              <Scale className="w-4 h-4" />
                            </button>
                          ) : null}
                          {record.fotoChegada ? (
                            <button onClick={() => setPhotoPreview({ url: fotoChegadaUrl, label: '🏢 Peso Chegada — Obra' })}
                              className="text-blue-600 hover:text-blue-800" title="Foto Chegada Obra">
                              <Camera className="w-4 h-4" />
                            </button>
                          ) : null}
                          {record.fotoVazio ? (
                            <button onClick={() => setPhotoPreview({ url: fotoVazioUrl, label: '🚛 Peso Saída (Vazio) — Obra' })}
                              className="text-green-600 hover:text-green-800" title="Foto Peso Vazio">
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          ) : null}
                          {headers.length > 0 && onEditSuccess && record.rowIndex != null && (
                            <Button variant="ghost" size="icon" title="Editar lançamento"
                              onClick={() => { setEditRecord(record); setEditModalOpen(true); }}>
                              <Pencil className="w-4 h-4 text-amber-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar relatório (nova aba)"
                            onClick={() => exportRelatorioIndividualPedreira(record as any, obraConfig, { printOnOpen: false })}>
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Exportar PDF individual"
                            onClick={() => exportRelatorioIndividualPedreira(record as any, obraConfig)}>
                            <FileDown className="w-3.5 h-3.5 text-orange-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Photo Preview Modal */}
      <Dialog open={!!photoPreview} onOpenChange={(open) => !open && setPhotoPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              {photoPreview?.label}
            </DialogTitle>
          </DialogHeader>
          {photoPreview && (
            (() => {
              const sources = getPhotoRenderSources(photoPreview.url);
              return (
            <img
                src={sources.primary}
                alt={photoPreview.label}
                className="w-full max-h-[70vh] object-contain rounded-lg border"
                referrerPolicy="no-referrer"
                data-fallback-queue={sources.fallbackQueue}
                onLoad={(e) => {
                  e.currentTarget.style.display = 'block';
                }}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!tryNextPhotoFallback(img)) {
                    img.style.display = 'none';
                  }
                }}
              />
            );
            })()
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewRecord} onOpenChange={(open) => !open && setPreviewRecord(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Truck className="w-5 h-5 text-orange-600" />
              {previewRecord?.prefixo} — {previewRecord?.data} às {previewRecord?.hora}
            </DialogTitle>
          </DialogHeader>

          {previewRecord && (() => {
            const tonTicket = previewRecord.toneladaTicket || previewRecord.tonelada || 0;
            const pesoVazioEfetivo = (previewRecord.pesoVazioObra && previewRecord.pesoVazioObra > 0) ? previewRecord.pesoVazioObra : previewRecord.pesoVazio;
            const tonCalcObra = (previewRecord.pesoChegada > 0 && pesoVazioEfetivo > 0)
              ? (previewRecord.pesoChegada - pesoVazioEfetivo) / 1000
              : (previewRecord.toneladaCalcObra || 0);
            const difTon = tonCalcObra > 0 && tonTicket > 0 ? (tonCalcObra - tonTicket) : 0;
            const hasDif = Math.abs(difTon) > 0.0005;

            return (
              <div className="space-y-3">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Motorista', value: previewRecord.motorista },
                    { label: 'Empresa', value: previewRecord.empresa },
                    { label: 'Fornecedor', value: previewRecord.fornecedor },
                    { label: 'Material', value: previewRecord.material },
                    { label: 'Nº Pedido', value: previewRecord.ordem },
                    { label: 'Placa', value: previewRecord.placa },
                  ].map((item, i) => (
                    <div key={i} className="border rounded-md px-2.5 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold leading-none mb-0.5">{item.label}</p>
                      <p className="text-xs font-medium truncate">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Weights — compact 4-col grid */}
                <div className="border rounded-md overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30 border-b">
                    <Scale className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-xs font-semibold text-orange-800 dark:text-orange-300">Pesagem</span>
                  </div>
                  <div className="grid grid-cols-4 divide-x">
                    {[
                      { label: 'Peso Final', value: previewRecord.pesoFinal > 0 ? previewRecord.pesoFinal.toLocaleString('pt-BR') : '—', unit: 'kg' },
                      { label: 'Ton. Ticket', value: tonTicket > 0 ? fmt(tonTicket) : '—', unit: 't' },
                      { label: 'Ton. Obra', value: tonCalcObra > 0 ? fmt(tonCalcObra) : '—', unit: 't' },
                      { label: 'Diferença', value: hasDif ? `${difTon > 0 ? '+' : ''}${fmt(difTon)}` : '—', unit: 't', className: hasDif ? (difTon > 0 ? 'text-blue-600' : 'text-red-600') : '' },
                    ].map((cell, i) => (
                      <div key={i} className="text-center py-2 px-1">
                        <p className="text-[9px] uppercase text-muted-foreground font-semibold leading-none mb-1">{cell.label}</p>
                        <p className={`text-sm font-bold leading-tight ${cell.className || ''}`}>{cell.value}</p>
                        <p className="text-[9px] text-muted-foreground">{cell.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Photos */}
                {(previewRecord.fotoChegada || previewRecord.fotoVazio || previewRecord.fotoPesagem) && (() => {
                  const photos = [
                    previewRecord.fotoPesagem ? { url: normalizePhotoUrl(previewRecord.fotoPesagem), label: 'Pesagem Pedreira', icon: <Scale className="w-3.5 h-3.5 text-amber-600" /> } : null,
                    previewRecord.fotoChegada ? { url: normalizePhotoUrl(previewRecord.fotoChegada), label: 'Chegada (Obra)', icon: <Camera className="w-3.5 h-3.5 text-blue-600" /> } : null,
                    previewRecord.fotoVazio ? { url: normalizePhotoUrl(previewRecord.fotoVazio), label: 'Saída Vazio', icon: <ImageIcon className="w-3.5 h-3.5 text-green-600" /> } : null,
                  ].filter(Boolean) as { url: string; label: string; icon: React.ReactNode }[];
                  const cols = photos.length >= 3 ? 'grid-cols-3' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-1';
                  return (
                    <div className={`grid gap-2 ${cols}`}>
                      {photos.map((photo, i) => {
                        const sources = getPhotoRenderSources(photo.url);

                        return (
                        <div key={i} className="border rounded-md overflow-hidden">
                          <p className="text-[10px] font-semibold px-2 py-1 bg-muted/50 flex items-center gap-1 border-b">
                            {photo.icon} {photo.label}
                          </p>
                          <img
                            src={sources.primary}
                            alt={photo.label}
                            className="w-full max-h-44 object-contain p-1"
                            referrerPolicy="no-referrer"
                            data-fallback-queue={sources.fallbackQueue}
                            onLoad={(e) => {
                              e.currentTarget.style.display = 'block';
                            }}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (!tryNextPhotoFallback(img)) {
                                img.style.display = 'none';
                              }
                            }}
                          />
                        </div>
                      )})}
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => exportRelatorioIndividualPedreira(previewRecord as any, obraConfig, { printOnOpen: false })}
                    variant="outline"
                    className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button
                    onClick={() => exportRelatorioIndividualPedreira(previewRecord as any, obraConfig)}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {headers.length > 0 && onEditSuccess && (
        <PedreiraEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onSuccess={() => {
            setEditModalOpen(false);
            setEditRecord(null);
            onEditSuccess();
          }}
          editData={editRecord as any}
          headers={headers}
        />
      )}
    </>
  );
}
