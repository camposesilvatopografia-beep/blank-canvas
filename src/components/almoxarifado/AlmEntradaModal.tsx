import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, ChevronsUpDown, Plus, Camera, Search, Loader2, X, Image as ImageIcon, FileText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlmMateriais, useSaveMovimentacao, useAlmFornecedores } from './useAlmData';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AlmMaterialModal from './AlmMaterialModal';
import { Badge } from '@/components/ui/badge';

interface Props { open: boolean; onClose: () => void; }

interface AddedItem {
  material_id: string;
  material_nome: string;
  material_codigo: string;
  material_unidade: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  observacoes: string;
  fotoFiles: File[];
  fotoPreviews: string[];
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AlmEntradaModal({ open, onClose }: Props) {
  const { data: materiais = [] } = useAlmMateriais();
  const { data: fornecedores = [] } = useAlmFornecedores();
  const save = useSaveMovimentacao();
  const ativos = materiais.filter(m => m.status === 'Ativo');
  const [showNewMat, setShowNewMat] = useState(false);

  // Shared fields (header)
  const [shared, setShared] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    fornecedor: '',
    nota_fiscal: '',
    responsavel: 'Edinaldo',
  });

  // NF Photo state (multiple)
  const [nfFotoFiles, setNfFotoFiles] = useState<File[]>([]);
  const [nfFotoPreviews, setNfFotoPreviews] = useState<string[]>([]);
  const nfFileInputRef = useRef<HTMLInputElement>(null);
  const nfCameraInputRef = useRef<HTMLInputElement>(null);

  // Current item being added (inline row)
  const [currentItem, setCurrentItem] = useState({ material_id: '', quantidade: '', preco_unitario: '', observacoes: '' });
  const [matOpen, setMatOpen] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);
  const precoRef = useRef<HTMLInputElement>(null);

  // Photo state for current item
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Added items list
  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);

  // AI search state
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<any[] | null>(null);
  const [aiDescricao, setAiDescricao] = useState<string | null>(null);
  const searchFileRef = useRef<HTMLInputElement>(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  const selectedMat = ativos.find(m => m.id === currentItem.material_id);
  const precoUnitNum = Number(currentItem.preco_unitario) / 100;
  const precoTotal = (Number(currentItem.quantidade) || 0) * precoUnitNum;

  const formatBRL = (cents: string) => {
    const num = Number(cents) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrecoChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    setCurrentItem(p => ({ ...p, preco_unitario: digits }));
  };

  const fornecedoresNorm = useMemo(() => {
    const map = new Map<string, string>();
    fornecedores.forEach(f => {
      const key = f.toLowerCase().trim();
      if (!map.has(key)) map.set(key, normalizeName(f));
    });
    return Array.from(map.values()).sort();
  }, [fornecedores]);

  // Photo handlers
  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Apenas imagens JPG ou PNG'); return; }
    setFotoFiles(prev => [...prev, file]);
    setFotoPreviews(prev => [...prev, URL.createObjectURL(file)]);
  };
  const removePhoto = (index: number) => {
    URL.revokeObjectURL(fotoPreviews[index]);
    setFotoFiles(prev => prev.filter((_, i) => i !== index));
    setFotoPreviews(prev => prev.filter((_, i) => i !== index));
  };
  const clearPhotos = () => { fotoPreviews.forEach(u => URL.revokeObjectURL(u)); setFotoFiles([]); setFotoPreviews([]); };

  const handleNfPhotoSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Apenas imagens JPG ou PNG'); return; }
    setNfFotoFiles(prev => [...prev, file]);
    setNfFotoPreviews(prev => [...prev, URL.createObjectURL(file)]);
  };
  const removeNfPhoto = (index: number) => {
    URL.revokeObjectURL(nfFotoPreviews[index]);
    setNfFotoFiles(prev => prev.filter((_, i) => i !== index));
    setNfFotoPreviews(prev => prev.filter((_, i) => i !== index));
  };
  const clearNfPhotos = () => { nfFotoPreviews.forEach(u => URL.revokeObjectURL(u)); setNfFotoFiles([]); setNfFotoPreviews([]); };

  // AI search
  const handleAiSearch = async (file: File) => {
    setAiSearching(true); setAiResults(null); setAiDescricao(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('alm-identify-material', { body: { imageBase64: base64 } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro na identificação');
      setAiDescricao(data.descricao);
      setAiResults(data.matches || []);
      if (data.matches?.length > 0) toast.success(`${data.matches.length} material(is) encontrado(s)!`);
      else toast.info('Nenhum material correspondente encontrado.');
    } catch (e: any) { toast.error(`Erro: ${e.message}`); }
    finally { setAiSearching(false); }
  };

  const handleSelectMaterial = (id: string) => {
    setCurrentItem(p => ({ ...p, material_id: id }));
    setMatOpen(false);
    setAiResults(null); setAiDescricao(null);
    setTimeout(() => qtyRef.current?.focus(), 100);
  };

  // Add current item to list
  const addItemToList = () => {
    if (!currentItem.material_id || !currentItem.quantidade) {
      toast.error('Selecione o material e informe a quantidade');
      return;
    }
    const mat = ativos.find(m => m.id === currentItem.material_id);
    if (!mat) return;

    const newItem: AddedItem = {
      material_id: currentItem.material_id,
      material_nome: mat.nome,
      material_codigo: mat.codigo,
      material_unidade: mat.unidade,
      quantidade: Number(currentItem.quantidade),
      preco_unitario: precoUnitNum,
      preco_total: precoTotal,
      observacoes: currentItem.observacoes,
      fotoFiles: [...fotoFiles],
      fotoPreviews: [...fotoPreviews],
    };

    setAddedItems(prev => [...prev, newItem]);
    setCurrentItem({ material_id: '', quantidade: '', preco_unitario: '', observacoes: '' });
    setFotoFiles([]);
    setFotoPreviews([]);
    toast.success(`${mat.nome} adicionado à lista!`);
    setTimeout(() => setMatOpen(true), 200);
  };

  const removeItem = (index: number) => {
    const item = addedItems[index];
    item.fotoPreviews.forEach(u => URL.revokeObjectURL(u));
    setAddedItems(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[], folder: string): Promise<string[]> => {
    const paths: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('alm-fotos').upload(path, file, { contentType: file.type });
      if (error) throw new Error(`Erro ao enviar foto: ${error.message}`);
      paths.push(path);
    }
    return paths;
  };

  // Save all items
  const handleSaveAll = async () => {
    // If there's a current item being filled, add it first
    let itemsToSave = [...addedItems];
    if (currentItem.material_id && currentItem.quantidade) {
      const mat = ativos.find(m => m.id === currentItem.material_id);
      if (mat) {
        itemsToSave.push({
          material_id: currentItem.material_id,
          material_nome: mat.nome,
          material_codigo: mat.codigo,
          material_unidade: mat.unidade,
          quantidade: Number(currentItem.quantidade),
          preco_unitario: precoUnitNum,
          preco_total: precoTotal,
          observacoes: currentItem.observacoes,
          fotoFiles: [...fotoFiles],
          fotoPreviews: [...fotoPreviews],
        });
      }
    }

    if (itemsToSave.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    setSaving(true);
    const fornecedorNorm = shared.fornecedor.trim() ? normalizeName(shared.fornecedor) : null;

    try {
      const nfFotoPaths = nfFotoFiles.length > 0 ? await uploadFiles(nfFotoFiles, 'nf') : [];

      for (const item of itemsToSave) {
        const fotoPaths = item.fotoFiles.length > 0 ? await uploadFiles(item.fotoFiles, 'entradas') : [];

        await save.mutateAsync({
          tipo: 'entrada',
          data: shared.data,
          material_id: item.material_id,
          quantidade: item.quantidade,
          fornecedor: fornecedorNorm,
          nota_fiscal: shared.nota_fiscal || null,
          responsavel: shared.responsavel || null,
          observacoes: item.observacoes || null,
          preco_unitario: item.preco_unitario,
          preco_total: item.preco_total,
          foto_path: fotoPaths.join(',') || null,
          nf_foto_path: nfFotoPaths.join(',') || null,
        } as any);
      }

      toast.success(`${itemsToSave.length} entrada(s) registrada(s) com sucesso!`);
      resetAll();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setShared({ data: format(new Date(), 'yyyy-MM-dd'), fornecedor: '', nota_fiscal: '', responsavel: 'Edinaldo' });
    setCurrentItem({ material_id: '', quantidade: '', preco_unitario: '', observacoes: '' });
    clearPhotos();
    clearNfPhotos();
    setAddedItems([]);
    setAiResults(null);
    setAiDescricao(null);
  };

  const totalGeral = addedItems.reduce((a, b) => a + b.preco_total, 0) + precoTotal;

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) { resetAll(); onClose(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Nova Entrada de Estoque
              {addedItems.length > 0 && (
                <Badge className="bg-emerald-600 text-white">{addedItems.length} item(ns) na lista</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Shared fields - horizontal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/40 border">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={shared.data} onChange={e => setShared(p => ({ ...p, data: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input
                list="fornecedores-entrada-list"
                value={shared.fornecedor}
                onChange={e => setShared(p => ({ ...p, fornecedor: e.target.value }))}
                onBlur={e => { if (e.target.value.trim()) setShared(p => ({ ...p, fornecedor: normalizeName(e.target.value) })); }}
                placeholder="Digite ou selecione"
                className="h-8 text-sm"
              />
              <datalist id="fornecedores-entrada-list">{fornecedoresNorm.map(f => <option key={f} value={f} />)}</datalist>
            </div>
            <div>
              <Label className="text-xs">Nº Nota Fiscal</Label>
              <Input value={shared.nota_fiscal} onChange={e => setShared(p => ({ ...p, nota_fiscal: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={shared.responsavel} onChange={e => setShared(p => ({ ...p, responsavel: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>

          {/* NF Photos */}
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" /> Fotos NF:</Label>
            {nfFotoPreviews.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt={`NF ${i + 1}`} className="w-10 h-10 object-cover rounded border" />
                <Button type="button" size="icon" variant="destructive" className="absolute -top-1 -right-1 h-4 w-4" onClick={() => removeNfPhoto(i)}><X className="w-2 h-2" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => nfCameraInputRef.current?.click()}>
              <Camera className="w-3 h-3 mr-1" /> Foto
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => nfFileInputRef.current?.click()}>
              <FileText className="w-3 h-3 mr-1" /> Anexar
            </Button>
            <input ref={nfCameraInputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={e => { e.target.files?.[0] && handleNfPhotoSelect(e.target.files[0]); e.target.value = ''; }} />
            <input ref={nfFileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => { e.target.files?.[0] && handleNfPhotoSelect(e.target.files[0]); e.target.value = ''; }} />
          </div>

          {/* AI Search */}
          <div className="border border-dashed rounded-lg p-2 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Buscar material por foto (IA)</span>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs ml-auto" onClick={() => searchFileRef.current?.click()} disabled={aiSearching}>
                {aiSearching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Camera className="w-3 h-3 mr-1" />}
                {aiSearching ? 'Identificando...' : 'Enviar Foto'}
              </Button>
              <input ref={searchFileRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAiSearch(f); e.target.value = ''; }} />
            </div>
            {aiDescricao && <p className="text-xs">🤖 IA identificou: <span className="text-primary font-medium">{aiDescricao}</span></p>}
            {aiResults && aiResults.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {aiResults.map((r: any) => (
                  <button key={r.id} type="button" className="text-xs px-2 py-1 rounded bg-background hover:bg-primary/10 border transition-colors" onClick={() => handleSelectMaterial(r.id)}>
                    {r.codigo} - {r.nome} <span className={cn('ml-1 font-bold', r.confianca >= 70 ? 'text-emerald-600' : r.confianca >= 40 ? 'text-yellow-600' : 'text-red-600')}>{r.confianca}%</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1d3557]">
                  <TableHead className="text-white font-bold text-xs w-[40%]">Material</TableHead>
                  <TableHead className="text-white font-bold text-xs text-center w-[12%]">Qtd</TableHead>
                  <TableHead className="text-white font-bold text-xs text-center w-[14%]">Preço Unit.</TableHead>
                  <TableHead className="text-white font-bold text-xs text-center w-[14%]">Total</TableHead>
                  <TableHead className="text-white font-bold text-xs w-[14%]">Obs</TableHead>
                  <TableHead className="text-white font-bold text-xs text-center w-[6%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Already added items */}
                {addedItems.map((item, i) => (
                  <TableRow key={i} className={cn('text-sm', i % 2 === 0 ? 'bg-emerald-50 dark:bg-emerald-950/10' : 'bg-emerald-100/50 dark:bg-emerald-950/20')}>
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="text-xs font-medium">{item.material_codigo} - {item.material_nome}</span>
                        {item.fotoFiles.length > 0 && <ImageIcon className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-1.5 font-bold text-emerald-600 text-xs">{item.quantidade} {item.material_unidade}</TableCell>
                    <TableCell className="text-center py-1.5 text-xs">{item.preco_unitario > 0 ? `R$ ${item.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</TableCell>
                    <TableCell className="text-center py-1.5 text-xs font-semibold">{item.preco_total > 0 ? `R$ ${item.preco_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground truncate max-w-[100px]">{item.observacoes || '—'}</TableCell>
                    <TableCell className="py-1.5 text-center">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removeItem(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* New item input row */}
                <TableRow className="bg-background border-t-2 border-primary/20">
                  <TableCell className="py-2">
                    <Popover open={matOpen} onOpenChange={setMatOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between font-normal text-xs h-8">
                          {selectedMat ? `${selectedMat.codigo} - ${selectedMat.nome}` : 'Selecione...'}
                          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[350px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar material..." />
                          <CommandList>
                            <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                            <CommandGroup>
                              {ativos.map(m => (
                                <CommandItem key={m.id} value={`${m.codigo} ${m.nome}`} onSelect={() => handleSelectMaterial(m.id)}>
                                  <Check className={cn("mr-2 h-3 w-3", currentItem.material_id === m.id ? "opacity-100" : "opacity-0")} />
                                  {m.codigo} - {m.nome}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandGroup>
                              <CommandItem onSelect={() => { setMatOpen(false); setShowNewMat(true); }} className="text-primary font-medium">
                                <Plus className="mr-2 h-3 w-3" /> Cadastrar novo
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      ref={qtyRef}
                      type="number"
                      step="0.01"
                      value={currentItem.quantidade}
                      onChange={e => setCurrentItem(p => ({ ...p, quantidade: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && currentItem.quantidade) { e.preventDefault(); precoRef.current?.focus(); } }}
                      className="h-8 text-xs text-center"
                      placeholder="0"
                    />
                  </TableCell>
                   <TableCell className="py-2">
                    <Input
                      ref={precoRef}
                      inputMode="numeric"
                      value={currentItem.preco_unitario ? `R$ ${formatBRL(currentItem.preco_unitario)}` : ''}
                      onChange={e => handlePrecoChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItemToList(); } }}
                      className="h-8 text-xs text-center"
                      placeholder="R$ 0,00"
                    />
                  </TableCell>
                  <TableCell className="py-2 text-center text-xs font-semibold text-muted-foreground">
                    {precoTotal > 0 ? `R$ ${precoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      value={currentItem.observacoes}
                      onChange={e => setCurrentItem(p => ({ ...p, observacoes: e.target.value }))}
                      className="h-8 text-xs"
                      placeholder="Obs..."
                    />
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100"
                      onClick={addItemToList}
                      disabled={!currentItem.material_id || !currentItem.quantidade}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Photo for current item */}
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Fotos do item:</Label>
            {fotoPreviews.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt={`Mat ${i + 1}`} className="w-10 h-10 object-cover rounded border" />
                <Button type="button" size="icon" variant="destructive" className="absolute -top-1 -right-1 h-4 w-4" onClick={() => removePhoto(i)}><X className="w-2 h-2" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => cameraInputRef.current?.click()}>
              <Camera className="w-3 h-3 mr-1" /> Foto
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-3 h-3 mr-1" /> Anexar
            </Button>
            <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={e => { e.target.files?.[0] && handlePhotoSelect(e.target.files[0]); e.target.value = ''; }} />
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => { e.target.files?.[0] && handlePhotoSelect(e.target.files[0]); e.target.value = ''; }} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm">
              {(addedItems.length > 0 || (currentItem.material_id && currentItem.quantidade)) && (
                <span className="font-semibold">
                  Total geral: <span className="text-emerald-600">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { resetAll(); onClose(); }}>Cancelar</Button>
              <Button onClick={handleSaveAll} disabled={saving || (addedItems.length === 0 && (!currentItem.material_id || !currentItem.quantidade))} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {saving ? 'Salvando...' : `Registrar ${addedItems.length + (currentItem.material_id && currentItem.quantidade ? 1 : 0)} Entrada(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlmMaterialModal open={showNewMat} onClose={() => setShowNewMat(false)} />
    </>
  );
}
