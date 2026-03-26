import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Plus, Save, Loader2, FileText, Trash2, Upload, Eye, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PedidoCompra {
  id: string;
  fornecedor: string;
  material: string;
  quantidade_pedido: number;
  observacoes: string | null;
  pdf_path: string | null;
}

interface PedidoCompraPedreiraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedores: string[];
  materiais: string[];
  onSaved?: () => void;
}

function BankStyleInlineInput({ initialValue, onCommit }: { initialValue: number; onCommit: (val: number) => void }) {
  const numToRaw = (n: number) => String(Math.round(n * 100));
  const [raw, setRaw] = useState(() => numToRaw(initialValue));
  const formatted = () => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '0,00';
    return (parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={formatted()}
      onChange={e => setRaw(e.target.value.replace(/\D/g, ''))}
      onBlur={() => {
        const digits = raw.replace(/\D/g, '');
        onCommit(digits ? parseInt(digits, 10) / 100 : 0);
      }}
      className="h-7 text-xs text-center w-28 mx-auto"
    />
  );
}

export function PedidoCompraPedreiraModal({ open, onOpenChange, fornecedores, materiais, onSaved }: PedidoCompraPedreiraModalProps) {
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // New entry form
  const [newFornecedor, setNewFornecedor] = useState('');
  const [newMaterial, setNewMaterial] = useState('');
  const [newQuantidadeRaw, setNewQuantidadeRaw] = useState('');
  const [newObs, setNewObs] = useState('');

  // Bank-style formatting helpers
  const formatBankStyle = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const rawToNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return 0;
    return parseInt(digits, 10) / 100;
  };

  const loadPedidos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos_compra_pedreira')
      .select('*')
      .order('fornecedor', { ascending: true });
    if (!error && data) setPedidos(data as PedidoCompra[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadPedidos();
  }, [open]);

  const handleAdd = async () => {
    if (!newFornecedor || !newMaterial || !newQuantidadeRaw) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('pedidos_compra_pedreira').insert({
      fornecedor: newFornecedor,
      material: newMaterial,
      quantidade_pedido: rawToNumber(newQuantidadeRaw),
      observacoes: newObs || null,
    });

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pedido salvo!' });
      setNewFornecedor('');
      setNewMaterial('');
      setNewQuantidadeRaw('');
      setNewObs('');
      loadPedidos();
      onSaved?.();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('pedidos_compra_pedreira').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Pedido removido' });
      loadPedidos();
      onSaved?.();
    }
  };

  const handleUploadFile = async (pedidoId: string, fornecedor: string, material: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(pedidoId);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const safeFornecedor = fornecedor.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeMaterial = material.replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = `pedidos-compra/${safeFornecedor}_${safeMaterial}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('pedreira-ocr-fotos').upload(path, file);
      if (uploadError) {
        toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
        setUploading(null);
        return;
      }
      await supabase.from('pedidos_compra_pedreira').update({ pdf_path: path }).eq('id', pedidoId);
      toast({ title: 'Arquivo anexado!' });
      setUploading(null);
      loadPedidos();
    };
    input.click();
  };

  const handleViewPdf = async (pdfPath: string) => {
    const { data } = supabase.storage.from('pedreira-ocr-fotos').getPublicUrl(pdfPath);
    if (data?.publicUrl) window.open(data.publicUrl, '_blank');
  };

  const handleUpdateQuantidade = async (id: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    await supabase.from('pedidos_compra_pedreira').update({ quantidade_pedido: num }).eq('id', id);
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, quantidade_pedido: num } : p));
    onSaved?.();
  };

  // Group pedidos by fornecedor
  const grouped = pedidos.reduce((acc, p) => {
    if (!acc[p.fornecedor]) acc[p.fornecedor] = [];
    acc[p.fornecedor].push(p);
    return acc;
  }, {} as Record<string, PedidoCompra[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Pedidos de Compra — Pedreira
          </DialogTitle>
          <DialogDescription>
            Gerencie os pedidos de compra por fornecedor e material. Acompanhe o que foi comprado vs. recebido.
          </DialogDescription>
        </DialogHeader>

        {/* Add new pedido */}
        <Card className="border-dashed border-2 border-primary/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Novo Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fornecedor *</Label>
                <select
                  value={newFornecedor}
                  onChange={e => setNewFornecedor(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Material *</Label>
                <select
                  value={newMaterial}
                  onChange={e => setNewMaterial(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {materiais.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Qtd. Pedido (toneladas) *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formatBankStyle(newQuantidadeRaw)}
                  onChange={e => setNewQuantidadeRaw(e.target.value.replace(/\D/g, ''))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Input
                  value={newObs}
                  onChange={e => setNewObs(e.target.value)}
                  placeholder="Ex: Contrato #123"
                />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving} size="sm" className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Pedido
            </Button>
          </CardContent>
        </Card>

        {/* Existing pedidos grouped by fornecedor */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center text-muted-foreground py-6 text-sm">
            Nenhum pedido cadastrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([fornecedor, items]) => (
              <Card key={fornecedor} className="border-l-4 border-l-primary/50">
                <CardHeader className="py-2 px-4 bg-muted/30">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    {fornecedor}
                    <Badge variant="secondary" className="text-[10px]">{items.length} materiais</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="py-1.5 text-[11px]">Material</TableHead>
                        <TableHead className="py-1.5 text-[11px] text-center w-28">Qtd. Pedido (t)</TableHead>
                        <TableHead className="py-1.5 text-[11px] text-center w-20">Anexo</TableHead>
                        <TableHead className="py-1.5 text-[11px] text-center w-16">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="py-1.5 text-xs font-medium">{p.material}</TableCell>
                          <TableCell className="py-1.5 text-center">
                            <BankStyleInlineInput
                              initialValue={p.quantidade_pedido}
                              onCommit={(val) => handleUpdateQuantidade(p.id, String(val))}
                            />
                          </TableCell>
                          <TableCell className="py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {p.pdf_path ? (
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600" onClick={() => handleViewPdf(p.pdf_path!)}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                disabled={uploading === p.id}
                                onClick={() => handleUploadFile(p.id, p.fornecedor, p.material)}
                              >
                                {uploading === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 text-center">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
