import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2, XCircle, Clock, Eye, Download, MessageCircle, RotateCcw,
  Pen, Search, Calendar, Building2, FileText, LogOut, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { generateRdoPdfBlob } from '@/hooks/useRdoPdfExport';
import logoApropriapp from '@/assets/logo-apropriapp.png';

// ── Signature Pad ────────────────────────────────────────────────────────────
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'clientX' in e ? (e as MouseEvent).clientX : (e as Touch).clientX;
    const clientY = 'clientY' in e ? (e as MouseEvent).clientY : (e as Touch).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const startDraw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault(); drawing.current = true;
      const touch = 'touches' in e ? e.touches[0] : e as MouseEvent;
      const pos = getPos(touch, canvas);
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    };
    const draw = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return; e.preventDefault();
      const touch = 'touches' in e ? e.touches[0] : e as MouseEvent;
      const pos = getPos(touch, canvas);
      ctx.lineTo(pos.x, pos.y); ctx.stroke(); hasDrawn.current = true;
    };
    const stopDraw = () => {
      if (!drawing.current) return; drawing.current = false;
      if (hasDrawn.current) onChange(canvas.toDataURL('image/png'));
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDraw);
    };
  }, [onChange]);

  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false; onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-primary/40 rounded-xl bg-white overflow-hidden touch-none relative">
        <canvas ref={canvasRef} width={600} height={150} className="w-full cursor-crosshair" style={{ touchAction: 'none' }} />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
          <Pen className="w-10 h-10 text-primary" />
        </div>
        <div className="absolute bottom-7 left-6 right-6 border-b border-border/50 pointer-events-none" />
        <p className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-muted-foreground pointer-events-none">Assine acima desta linha</p>
      </div>
      <Button variant="outline" size="sm" onClick={clear} className="gap-2 text-xs">
        <RotateCcw className="w-3 h-3" /> Limpar
      </Button>
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
const statusConfig = {
  Aprovado: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', label: 'Aprovado' },
  Reprovado: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', label: 'Reprovado' },
  Pendente: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', label: 'Pendente' },
};

const rdoStatusBadge = (status: string) => {
  if (status === 'Aprovado') return <Badge className="bg-green-100 text-green-800 border-green-300">{status}</Badge>;
  if (status === 'Reprovado') return <Badge variant="destructive">{status}</Badge>;
  if (status === 'Aguardando Aprovação') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
};

// ── Main Portal ───────────────────────────────────────────────────────────────
export default function RDOPortal() {
  const { profile, signOut, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [rdos, setRdos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewRdo, setViewRdo] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [efetivo, setEfetivo] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [fotos, setFotos] = useState<any[]>([]);
  const [obra, setObra] = useState<any>(null);
  const [assinaturas, setAssinaturas] = useState<Record<string, string>>({});
  const [exportingPdf, setExportingPdf] = useState(false);

  // Signature modal
  const [sigOpen, setSigOpen] = useState(false);
  const [sigSlot, setSigSlot] = useState<1 | 2 | 3>(1);
  const [sigDecision, setSigDecision] = useState<'Aprovado' | 'Reprovado'>('Aprovado');
  const [sigObservacao, setSigObservacao] = useState('');
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);

  // Detect session (magic link authenticates automatically via URL hash)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setSessionEmail(session.user.email);
        setSessionReady(true);
      } else {
        // Wait for auth state change (magic link flow)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user?.email) {
            setSessionEmail(session.user.email);
            setSessionReady(true);
            subscription.unsubscribe();
          } else if (event === 'SIGNED_OUT') {
            navigate('/auth');
          }
        });
        // If no session after short wait, redirect to login
        setTimeout(() => {
          if (!sessionEmail) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (!session) navigate('/auth');
              else {
                setSessionEmail(session.user?.email || null);
                setSessionReady(true);
              }
            });
          }
        }, 2000);
      }
    };
    checkSession();
  }, []);

  const fetchRdos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('rdos')
      .select('*, rdo_obras(nome, cliente, aprovador1_nome, aprovador1_cargo, aprovador1_email, aprovador2_nome, aprovador2_cargo, aprovador2_email, aprovador3_nome, aprovador3_cargo, aprovador3_email)')
      .neq('status', 'Rascunho')
      .order('data', { ascending: false });
    if (data) setRdos(data);
    setLoading(false);
  };

  useEffect(() => {
    if (sessionReady) fetchRdos();
  }, [sessionReady]);

  const openView = async (rdo: any) => {
    setViewRdo(rdo);
    setViewOpen(true);
    const [{ data: ef }, { data: eq }, { data: sv }, { data: ob }, { data: ft }] = await Promise.all([
      supabase.from('rdo_efetivo').select('*').eq('rdo_id', rdo.id),
      supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdo.id),
      supabase.from('rdo_servicos').select('*').eq('rdo_id', rdo.id),
      supabase.from('rdo_obras').select('*').eq('id', rdo.obra_id).single(),
      supabase.from('rdo_fotos').select('*').eq('rdo_id', rdo.id).order('created_at'),
    ]);
    setEfetivo(ef || []); setEquipamentos(eq || []); setServicos(sv || []); setObra(ob);

    if (ft && ft.length > 0) {
      const fotosWithUrls = await Promise.all((ft as any[]).map(async (f: any) => {
        const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(f.storage_path, 3600);
        return { storage_path: f.storage_path, legenda: f.legenda || '', signedUrl: signed?.signedUrl || '' };
      }));
      setFotos(fotosWithUrls);
    } else { setFotos([]); }

    const assMap: Record<string, string> = {};
    for (const n of [1, 2, 3]) {
      const path = rdo[`assinatura${n}_path`];
      if (path) {
        const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(path, 3600);
        if (signed?.signedUrl) assMap[`assinatura${n}_url`] = signed.signedUrl;
      }
    }
    setAssinaturas(assMap);
  };

  const openSig = (rdo: any, slot: 1 | 2 | 3) => {
    setSigSlot(slot);
    setSigDecision('Aprovado');
    setSigObservacao('');
    setSigDataUrl(null);
    setSigOpen(true);
  };

  const handleSignSave = async () => {
    if (!sigDataUrl) { toast.error('Desenhe sua assinatura antes de confirmar'); return; }
    if (!viewRdo) return;
    setSigSaving(true);
    try {
      // Upload signature image
      const resp = await fetch(sigDataUrl);
      const blob = await resp.blob();
      const path = `signatures/${viewRdo.id}/assinatura_${sigSlot}_${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from('rdo-fotos').upload(path, blob, { contentType: 'image/png', upsert: true });
      if (upErr) throw new Error(upErr.message);

      const now = new Date().toISOString();
      const obsField = sigSlot === 1 ? 'comentarios_construtora' : sigSlot === 2 ? 'comentarios_gerenciadora' : 'comentarios_fiscalizacao';

      const updatePayload: any = {
        [`aprovacao${sigSlot}_status`]: sigDecision,
        [`aprovacao${sigSlot}_data`]: now,
        [`assinatura${sigSlot}_path`]: path,
      };
      if (sigObservacao.trim()) updatePayload[obsField] = sigObservacao.trim();

      // Update overall RDO status
      const allStatuses = [1, 2, 3].map(n => n === sigSlot ? sigDecision : viewRdo[`aprovacao${n}_status`]);
      if (allStatuses.some(s => s === 'Reprovado')) updatePayload.status = 'Reprovado';
      else if (allStatuses.every(s => s === 'Aprovado')) updatePayload.status = 'Aprovado';
      else if (allStatuses.some(s => s === 'Aprovado')) updatePayload.status = 'Aprovado Parcialmente';

      const { error } = await supabase.from('rdos').update(updatePayload).eq('id', viewRdo.id);
      if (error) throw new Error(error.message);

      toast.success(sigDecision === 'Aprovado' ? '✅ RDO aprovado com sucesso!' : '❌ RDO reprovado');
      setSigOpen(false);
      // Refresh
      const { data: updatedRdo } = await supabase.from('rdos').select('*, rdo_obras(nome, cliente, aprovador1_nome, aprovador1_cargo, aprovador1_email, aprovador2_nome, aprovador2_cargo, aprovador2_email, aprovador3_nome, aprovador3_cargo, aprovador3_email)').eq('id', viewRdo.id).single();
      if (updatedRdo) {
        setViewRdo(updatedRdo);
        setRdos(prev => prev.map(r => r.id === viewRdo.id ? updatedRdo : r));
      }
      // Reload signatures
      const assMap: Record<string, string> = {};
      for (const n of [1, 2, 3]) {
        const p = (updatedRdo as any)?.[`assinatura${n}_path`];
        if (p) { const { data: s } = await supabase.storage.from('rdo-fotos').createSignedUrl(p, 3600); if (s?.signedUrl) assMap[`assinatura${n}_url`] = s.signedUrl; }
      }
      setAssinaturas(assMap);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSigSaving(false);
    }
  };

  const handleExportPdf = async () => {
    if (!viewRdo || !obra) return;
    setExportingPdf(true);
    try {
      const blob = await generateRdoPdfBlob({ rdo: viewRdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RDO_${viewRdo.numero_rdo || viewRdo.data}_${obra.nome.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF exportado!');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleWhatsApp = () => {
    if (!viewRdo || !obra) return;
    const dataFmt = format(new Date(viewRdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    const text = [
      `🏗️ *RDO - ${obra.nome}*`,
      `📅 ${dataFmt}${viewRdo.numero_rdo ? ` | Nº ${viewRdo.numero_rdo}` : ''}`,
      `Status: ${viewRdo.status}`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Find which slot this user is (by email matching aprovadores)
  // Uses sessionEmail (from Supabase session) to work even with magic link logins
  const effectiveEmail = sessionEmail || profile?.email || null;
  const getUserSlot = (rdo: any): 1 | 2 | 3 | null => {
    if (!effectiveEmail || !rdo?.rdo_obras) return null;
    const obra = rdo.rdo_obras;
    for (const n of [1, 2, 3] as const) {
      if (obra[`aprovador${n}_email`]?.toLowerCase() === effectiveEmail.toLowerCase()) return n;
    }
    return null;
  };

  const displayName = profile?.nome || sessionEmail?.split('@')[0] || 'Responsável';

  const filtered = rdos.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.rdo_obras?.nome?.toLowerCase().includes(q) ||
      r.numero_rdo?.toLowerCase().includes(q) ||
      r.data?.includes(q)
    );
  });

  // Show loading screen while waiting for session (magic link auth)
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 gap-4">
        <img src={logoApropriapp} alt="ApropriAPP" className="w-16 h-16 object-contain" />
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Verificando acesso ao Portal RDO...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logoApropriapp} alt="ApropriAPP" className="w-9 h-9 object-contain rounded" />
            <div>
              <h1 className="font-bold text-base leading-tight">Portal RDO</h1>
              <p className="text-xs text-muted-foreground">{displayName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate('/auth'); }} className="gap-2 text-muted-foreground">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por etapa, número ou data..." className="pl-10" />
        </div>

        {/* RDO List */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando RDOs...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum RDO encontrado</p>
            <p className="text-sm mt-1">Os RDOs enviados para aprovação aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rdo => {
              const userSlot = getUserSlot(rdo);
              const myStatus = userSlot ? rdo[`aprovacao${userSlot}_status`] : null;
              return (
                <Card key={rdo.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold truncate">{rdo.rdo_obras?.nome}</p>
                          {rdoStatusBadge(rdo.status)}
                          {myStatus && (
                            <Badge variant="outline" className="text-xs">
                              Meu voto: {myStatus}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(rdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          {rdo.numero_rdo && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              Nº {rdo.numero_rdo}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {rdo.clima_manha} / {rdo.clima_tarde}
                          </span>
                        </div>
                        {/* Slot statuses */}
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {[1, 2, 3].map(n => {
                            const nm = rdo.rdo_obras?.[`aprovador${n}_nome`];
                            if (!nm) return null;
                            const st = rdo[`aprovacao${n}_status`] as keyof typeof statusConfig;
                            const cfg = statusConfig[st] || statusConfig.Pendente;
                            const Icon = cfg.icon;
                            return (
                              <span key={n} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                <Icon className="w-3 h-3" /> {nm.split(' ')[0]}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openView(rdo)} className="gap-1.5 shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* View Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {obra?.nome} — {viewRdo?.data ? format(new Date(viewRdo.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : ''}
            </DialogTitle>
          </DialogHeader>

          {viewRdo && (
            <div className="space-y-5">
              {/* Status & Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {rdoStatusBadge(viewRdo.status)}
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf} className="gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    {exportingPdf ? 'Gerando...' : 'PDF'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleWhatsApp} className="gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </Button>
                </div>
              </div>

              {/* Clima */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Manhã</p>
                  <p className="font-semibold">{viewRdo.clima_manha}</p>
                  {viewRdo.temperatura_manha && <p className="text-xs text-muted-foreground">{viewRdo.temperatura_manha}°C</p>}
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Tarde</p>
                  <p className="font-semibold">{viewRdo.clima_tarde}</p>
                  {viewRdo.temperatura_tarde && <p className="text-xs text-muted-foreground">{viewRdo.temperatura_tarde}°C</p>}
                </div>
              </div>

              {/* Efetivo */}
              {efetivo.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mão de Obra</p>
                  <div className="space-y-1">
                    {efetivo.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                        <span>{e.empresa} — {e.funcao}</span>
                        <span className="font-medium">{e.quantidade} × {e.periodo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipamentos */}
              {equipamentos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Equipamentos</p>
                  <div className="space-y-1">
                    {equipamentos.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                        <span>{e.equipamento}{e.prefixo ? ` (${e.prefixo})` : ''}</span>
                        <span className={e.status === 'Operando' ? 'text-green-600' : 'text-yellow-600'}>{e.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Serviços */}
              {servicos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Serviços Executados</p>
                  <div className="space-y-1">
                    {servicos.map((s, i) => (
                      <div key={i} className="text-sm py-1.5 border-b last:border-0">
                        <p className="font-medium">{s.descricao}</p>
                        {s.local_servico && <p className="text-xs text-muted-foreground">Local: {s.local_servico}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações */}
              {viewRdo.observacoes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Observações Gerais</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{viewRdo.observacoes}</p>
                </div>
              )}

              {/* Comentários por aprovador */}
              {(viewRdo.comentarios_construtora || viewRdo.comentarios_gerenciadora || viewRdo.comentarios_fiscalizacao) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comentários</p>
                  {viewRdo.comentarios_construtora && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Construtora</p>
                      <p>{viewRdo.comentarios_construtora}</p>
                    </div>
                  )}
                  {viewRdo.comentarios_gerenciadora && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm">
                      <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">Gerenciadora</p>
                      <p>{viewRdo.comentarios_gerenciadora}</p>
                    </div>
                  )}
                  {viewRdo.comentarios_fiscalizacao && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Fiscalização</p>
                      <p>{viewRdo.comentarios_fiscalizacao}</p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Aprovadores / Assinaturas */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Aprovações & Assinaturas</p>
                <div className="space-y-3">
                  {[1, 2, 3].map(n => {
                    const nm = obra?.[`aprovador${n}_nome`];
                    if (!nm) return null;
                    const cargo = obra?.[`aprovador${n}_cargo`];
                    const email = obra?.[`aprovador${n}_email`];
                    const status = viewRdo[`aprovacao${n}_status`] as keyof typeof statusConfig;
                    const cfg = statusConfig[status] || statusConfig.Pendente;
                    const Icon = cfg.icon;
                    const sigUrl = assinaturas[`assinatura${n}_url`];
                    const isMe = effectiveEmail?.toLowerCase() === email?.toLowerCase();
                    const canSign = isMe && status === 'Pendente';
                    const slot = n as 1 | 2 | 3;

                    return (
                      <div key={n} className={`p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                            <div>
                              <p className="font-medium text-sm">{nm}</p>
                              {cargo && <p className="text-xs text-muted-foreground">{cargo}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                            {canSign && (
                              <Button size="sm" onClick={() => openSig(viewRdo, slot)} className="gap-1.5 h-7 text-xs">
                                <Pen className="w-3 h-3" />
                                Assinar
                              </Button>
                            )}
                          </div>
                        </div>
                        {sigUrl && (
                          <div className="mt-2">
                            <img src={sigUrl} alt={`Assinatura ${n}`} className="h-16 bg-white rounded border" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fotos */}
              {fotos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fotos ({fotos.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {fotos.map((f, i) => (
                      <div key={i} className="space-y-1">
                        <img src={f.signedUrl} alt={f.legenda || `Foto ${i + 1}`} className="w-full rounded-lg object-cover aspect-video bg-muted" />
                        {f.legenda && <p className="text-xs text-muted-foreground">{f.legenda}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={sigOpen} onOpenChange={o => { setSigOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovação / Assinatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Decision */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Decisão</Label>
              <div className="flex gap-2">
                <Button
                  variant={sigDecision === 'Aprovado' ? 'default' : 'outline'}
                  onClick={() => setSigDecision('Aprovado')}
                  className="flex-1 gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Aprovar
                </Button>
                <Button
                  variant={sigDecision === 'Reprovado' ? 'destructive' : 'outline'}
                  onClick={() => setSigDecision('Reprovado')}
                  className="flex-1 gap-2"
                >
                  <XCircle className="w-4 h-4" /> Reprovar
                </Button>
              </div>
            </div>

            {/* Observação */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Comentário / Observação (opcional)</Label>
              <Textarea
                value={sigObservacao}
                onChange={e => setSigObservacao(e.target.value)}
                placeholder="Adicione um comentário sobre este RDO..."
                rows={3}
              />
            </div>

            {/* Signature pad */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Assinatura Digital</Label>
              <SignaturePad onChange={setSigDataUrl} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSigOpen(false)}>Cancelar</Button>
              <Button
                className={`flex-1 gap-2 ${sigDecision === 'Reprovado' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                onClick={handleSignSave}
                disabled={sigSaving || !sigDataUrl}
              >
                {sigSaving ? 'Salvando...' : sigDecision === 'Aprovado' ? '✅ Confirmar Aprovação' : '❌ Confirmar Reprovação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
