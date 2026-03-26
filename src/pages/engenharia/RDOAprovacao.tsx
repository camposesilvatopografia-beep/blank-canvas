import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2, XCircle, Building2, Calendar, Clock, User, Users,
  AlertCircle, Shield, Lock, Mail, KeyRound, Loader2, RefreshCw,
  CreditCard, Briefcase, ShieldCheck, Edit3, FileText, Download, X as XIcon,
  Sun, CloudRain, Thermometer, HardHat, Wrench, Camera, StickyNote,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CarimboDigital } from '@/components/engenharia/CarimboDigital';
import { HistoricoRdosPanel } from '@/components/engenharia/HistoricoRdosPanel';
import { generateRdoPdfBlob } from '@/hooks/useRdoPdfExport';
import { useIsMobile } from '@/hooks/use-mobile';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callApprovalFn(path: string, options?: RequestInit) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/rdo-approval${path}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        ...options?.headers,
      },
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

// ── Formatação de CPF ─────────────────────────────────────────────────────────
function formatCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// ── Validação de CPF ──────────────────────────────────────────────────────────
function isValidCPF(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(digits[10]);
}

// ── Etapa de confirmação de identidade — apenas CPF ──────────────────────────
interface DataConfirmFormProps {
  nomEsperado: string;
  cargoEsperado: string | null;
  cpfEsperado: string | null;
  slotNum: 1 | 2 | 3;
  onConfirmed: (dados: { nome: string; cargo: string; cpf: string }) => void;
}

function DataConfirmForm({ nomEsperado, cargoEsperado, cpfEsperado, slotNum, onConfirmed }: DataConfirmFormProps) {
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState('');

  const slotColorMap = ['bg-blue-600', 'bg-purple-600', 'bg-emerald-600'];
  const slotBorderMap = ['border-blue-500', 'border-purple-500', 'border-emerald-500'];
  const slotBgMap = ['bg-blue-500/8', 'bg-purple-500/8', 'bg-emerald-500/8'];
  const slotColor = slotColorMap[slotNum - 1];
  const slotBorder = slotBorderMap[slotNum - 1];
  const slotBg = slotBgMap[slotNum - 1];

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
    setCpfError('');
  };

  const handleConfirm = () => {
    const cpfDigits = cpf.replace(/\D/g, '');
    if (!cpfDigits) { setCpfError('CPF/CNPJ é obrigatório.'); return; }
    if (cpfEsperado) {
      const expectedDigits = cpfEsperado.replace(/\D/g, '');
      if (cpfDigits !== expectedDigits) { setCpfError('CPF/CNPJ não confere com o cadastrado para este aprovador.'); return; }
    } else if (!isValidCPF(cpf) && cpfDigits.length !== 14) {
      setCpfError('CPF inválido. Verifique os dígitos.'); return;
    }
    onConfirmed({ nome: nomEsperado, cargo: cargoEsperado || '', cpf: cpf.trim() });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center py-8 px-4">
      <div className="max-w-sm w-full space-y-5">

        <div className="text-center">
          <div className={`w-20 h-20 ${slotColor} rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Confirmar Identidade</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Informe seu CPF ou CNPJ para confirmar sua identidade e prosseguir com a assinatura.
          </p>
        </div>

        <div className={`rounded-2xl border-2 ${slotBorder} ${slotBg} p-5 space-y-4`}>

          {/* Dados vindos do cadastro */}
          <div className="bg-card border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aprovador identificado</p>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-semibold">{nomEsperado}</span>
            </div>
            {cargoEsperado && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{cargoEsperado}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Sua identidade será registrada no carimbo digital conforme a <strong>Lei nº 14.063/2020</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
              CPF / CNPJ <span className="text-destructive">*</span>
            </label>
            <Input
              value={cpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={18}
              autoFocus
              className={cpfError ? 'border-destructive font-mono' : 'font-mono'}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            />
            {cpfError && (
              <p className="text-xs text-destructive flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {cpfError}
              </p>
            )}
          </div>

          <Button
            className={`w-full h-12 gap-2 text-white ${slotColor} hover:opacity-90`}
            onClick={handleConfirm}
          >
            <ShieldCheck className="w-4 h-4" />
            Confirmar e Assinar
          </Button>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <span>Dados protegidos · Assinatura eletrônica com validade jurídica · Lei nº 14.063/2020</span>
        </div>
      </div>
    </div>
  );
}

// ── Fluxo de verificação OTP por email ───────────────────────────────────────
type OtpStep = 'otp-sending' | 'otp-waiting' | 'otp-verifying';

function OtpVerification({
  nomEsperado,
  slotNum,
  token,
  onVerified,
}: {
  nomEsperado: string;
  slotNum: 1 | 2 | 3;
  token: string;
  onVerified: () => void;
}) {
  const [step, setStep] = useState<OtpStep>('otp-sending');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const slotColorMap = ['bg-blue-600', 'bg-purple-600', 'bg-emerald-600'];
  const slotColor = slotColorMap[slotNum - 1];

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    sendOtp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendOtp = async () => {
    setStep('otp-sending');
    setOtpError('');
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/send-approval-otp?token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes('Email do aprovador não configurado')) {
          onVerified();
          return;
        }
        throw new Error(data.error || 'Erro ao enviar código');
      }
      setMaskedEmail(data.maskedEmail || '');
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
      setResendCooldown(60);
      setStep('otp-waiting');
      if (!data.emailSent && data.message) {
        toast.info(data.message, { duration: 30000 });
      } else {
        toast.success(`Código enviado para ${data.maskedEmail}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar código');
      setStep('otp-waiting');
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setStep('otp-verifying');
    setOtpError('');
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/send-approval-otp?token=${token}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ code: otpCode }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Código inválido');
        setStep('otp-waiting');
        return;
      }
      onVerified();
    } catch (e: any) {
      setOtpError(e.message || 'Erro ao verificar código');
      setStep('otp-waiting');
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center py-8 px-4">
      <div className="max-w-sm w-full space-y-5">
        <div className="text-center">
          <div className={`w-20 h-20 ${slotColor} rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
            {step === 'otp-sending'
              ? <Loader2 className="w-10 h-10 text-white animate-spin" />
              : <KeyRound className="w-10 h-10 text-white" />
            }
          </div>
          <h1 className="text-2xl font-bold">
            {step === 'otp-sending' ? 'Enviando código...' : 'Digite o código'}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {step === 'otp-sending'
              ? 'Aguarde enquanto enviamos o código para seu email...'
              : `Código de 6 dígitos enviado para ${maskedEmail}`}
          </p>
        </div>

        <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-4">
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-muted/50`}>
            <div className={`w-10 h-10 rounded-full ${slotColor} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
              {slotNum}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verificação de identidade</p>
              <p className="font-semibold">{nomEsperado}</p>
            </div>
          </div>

          {(step === 'otp-waiting' || step === 'otp-verifying') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                <Mail className="w-4 h-4 shrink-0 text-primary" />
                <span>Código enviado para <strong>{maskedEmail}</strong></span>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Código de 6 dígitos
                </label>
                <Input
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  className={`text-center text-2xl font-mono tracking-[0.5em] h-14 ${otpError ? 'border-destructive' : ''}`}
                  disabled={step === 'otp-verifying'}
                  onKeyDown={e => e.key === 'Enter' && otpCode.length === 6 && verifyOtp()}
                  autoFocus
                />
                {otpError && (
                  <p className="text-xs text-destructive flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {otpError}
                  </p>
                )}
                {expiresAt && (
                  <p className="text-xs text-muted-foreground text-center">
                    Válido até {format(expiresAt, "HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
              <Button
                className="w-full h-11 gap-2"
                onClick={verifyOtp}
                disabled={otpCode.length !== 6 || step === 'otp-verifying'}
              >
                {step === 'otp-verifying'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                  : <><Lock className="w-4 h-4" /> Confirmar identidade</>
                }
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={sendOtp}
                disabled={resendCooldown > 0 || step === 'otp-verifying'}
              >
                <RefreshCw className="w-3 h-3" />
                {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar código'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
          <Shield className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <span>
            Código enviado exclusivamente para o email cadastrado de <strong>{nomEsperado}</strong>.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Visualizador HTML nativo do RDO (para mobile) ────────────────────────────
function RDOViewer({
  rdo,
  obra,
  efetivo,
  servicos,
  equipamentos,
  fotos,
  onClose,
  onDownload,
  downloading,
}: {
  rdo: any;
  obra: any;
  efetivo: any[];
  servicos: any[];
  equipamentos: any[];
  fotos: { signedUrl: string; legenda: string }[];
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const dataFormatada = format(new Date(rdo.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const totalPessoas = efetivo.reduce((s: number, e: any) => s + (e.quantidade || 0), 0);

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
      {/* Header fixo */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b shrink-0 shadow-sm">
        <Button variant="ghost" size="sm" className="gap-2 font-semibold text-sm h-9 px-3" onClick={onClose}>
          <XIcon className="w-4 h-4" />
          Voltar
        </Button>
        <span className="font-medium text-sm text-muted-foreground truncate max-w-[140px]">
          RDO · {obra?.nome}
        </span>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9 shrink-0" onClick={onDownload} disabled={downloading}>
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          PDF
        </Button>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

          {/* Cabeçalho do RDO */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="bg-primary px-5 py-4">
              <h1 className="text-primary-foreground font-bold text-lg">{obra?.nome}</h1>
              {obra?.cliente && <p className="text-primary-foreground/80 text-sm">Cliente: {obra.cliente}</p>}
              {rdo.numero_rdo && (
                <span className="inline-block mt-1 text-xs font-medium bg-primary-foreground/20 text-primary-foreground px-2 py-0.5 rounded-full">
                  RDO Nº {rdo.numero_rdo}
                </span>
              )}
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-semibold">{dataFormatada}</p>
                </div>
              </div>
              {obra?.responsavel && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Responsável</p>
                    <p className="text-sm font-semibold">{obra.responsavel}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Condições climáticas */}
          {(rdo.clima_manha || rdo.clima_tarde) && (
            <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Sun className="w-4 h-4 text-yellow-500" /> Condições Climáticas
              </p>
              <div className="grid grid-cols-2 gap-3">
                {rdo.clima_manha && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Manhã</p>
                    <p className="font-medium text-sm">{rdo.clima_manha}</p>
                    {rdo.temperatura_manha != null && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Thermometer className="w-3 h-3" /> {rdo.temperatura_manha}°C
                      </p>
                    )}
                  </div>
                )}
                {rdo.clima_tarde && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Tarde</p>
                    <p className="font-medium text-sm">{rdo.clima_tarde}</p>
                    {rdo.temperatura_tarde != null && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Thermometer className="w-3 h-3" /> {rdo.temperatura_tarde}°C
                      </p>
                    )}
                  </div>
                )}
              </div>
              {rdo.precipitacao_dia != null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CloudRain className="w-4 h-4" />
                  Precipitação do dia: <strong>{rdo.precipitacao_dia} mm</strong>
                </div>
              )}
            </div>
          )}

          {/* Efetivo */}
          {efetivo.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <HardHat className="w-4 h-4 text-orange-500" /> Efetivo — {totalPessoas} pessoas
              </p>
              <div className="divide-y divide-border/50">
                {efetivo.map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{e.empresa}</p>
                      <p className="text-xs text-muted-foreground">{e.funcao}{e.periodo ? ` · ${e.periodo}` : ''}</p>
                    </div>
                    <span className="font-bold text-base">{e.quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipamentos */}
          {equipamentos.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-500" /> Equipamentos
              </p>
              <div className="divide-y divide-border/50">
                {equipamentos.map((eq: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{eq.equipamento}</p>
                      {eq.prefixo && <p className="text-xs text-muted-foreground">{eq.prefixo}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{eq.horas_trabalhadas}h</p>
                      <p className="text-xs text-muted-foreground">{eq.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Serviços */}
          {servicos.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-purple-500" /> Serviços Executados
              </p>
              <div className="space-y-2">
                {servicos.map((s: any, i: number) => (
                  <div key={i} className="bg-muted/40 rounded-lg px-3 py-2.5">
                    <p className="text-sm font-medium">{s.descricao}</p>
                    {s.local_servico && <p className="text-xs text-muted-foreground">Local: {s.local_servico}</p>}
                    {s.quantidade_executada != null && (
                      <p className="text-xs text-muted-foreground">
                        {s.quantidade_executada} {s.unidade || ''} executados
                        {s.quantidade_prevista != null ? ` / ${s.quantidade_prevista} previstos` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {rdo.observacoes && (
            <div className="rounded-xl border bg-card shadow-sm p-4 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-yellow-500" /> Observações
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{rdo.observacoes}</p>
            </div>
          )}

          {/* Fotos */}
          {fotos.length > 0 && (
            <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Camera className="w-4 h-4 text-pink-500" /> Fotos da Obra ({fotos.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {fotos.map((f, i) => f.signedUrl ? (
                  <div key={i} className="rounded-lg overflow-hidden border">
                    <img
                      src={f.signedUrl}
                      alt={f.legenda || `Foto ${i + 1}`}
                      className="w-full aspect-video object-cover"
                      loading="lazy"
                    />
                    {f.legenda && <p className="text-xs text-muted-foreground px-2 py-1">{f.legenda}</p>}
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {/* Botão fechar no final */}
          <Button className="w-full h-12 gap-2" onClick={onClose}>
            <XIcon className="w-4 h-4" /> Fechar e Voltar para Assinatura
          </Button>

          <p className="text-center text-xs text-muted-foreground pb-2">
            RDO Apropriapp · {obra?.nome}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Slot visual de assinatura ─────────────────────────────────────────────────
function AssinaturaSlot({
  nome,
  cargo,
  cpf,
  status,
  data,
  observacao,
  assinaturaUrl,
  isAtivo,
  slotNum,
}: {
  nome: string;
  cargo: string | null;
  cpf?: string | null;
  status: string | null;
  data: string | null;
  observacao: string | null;
  assinaturaUrl?: string;
  isAtivo: boolean;
  slotNum: 1 | 2 | 3;
}) {
  const slotColors = ['border-blue-500/40 bg-blue-500/5', 'border-purple-500/40 bg-purple-500/5', 'border-emerald-500/40 bg-emerald-500/5'];
  const slotBadgeColors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500'];
  const slotColor = slotColors[slotNum - 1];
  const badgeColor = slotBadgeColors[slotNum - 1];

  return (
    <div className={`rounded-xl border-2 p-4 space-y-2 ${isAtivo ? `${slotColor} ring-2 ring-primary/20` : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full ${badgeColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {slotNum}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{nome}</p>
          {cargo && <p className="text-xs text-muted-foreground">{cargo}</p>}
        </div>
        {isAtivo && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
            Seu espaço
          </span>
        )}
        {status === 'Aprovado' && !isAtivo && (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        )}
        {status === 'Reprovado' && (
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        )}
      </div>

      {/* Área de assinatura — apenas carimbo eletrônico */}
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 min-h-[60px] flex items-center justify-center relative overflow-hidden">
        {status === 'Pendente' || !status ? (
          <p className="text-xs text-muted-foreground py-3">
            {isAtivo ? '← Assine com carimbo eletrônico abaixo' : 'Aguardando assinatura eletrônica'}
          </p>
        ) : (
          <div className="flex items-center gap-2 py-3 px-3">
            <ShieldCheck className={`w-5 h-5 ${status === 'Aprovado' ? 'text-emerald-600' : 'text-red-600'}`} />
            <p className={`text-xs font-semibold ${status === 'Aprovado' ? 'text-emerald-600' : 'text-red-600'}`}>
              {status === 'Aprovado' ? 'Assinado eletronicamente' : 'Reprovado eletronicamente'}
            </p>
          </div>
        )}
      </div>

      {data && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      )}

      {(status === 'Aprovado' || status === 'Reprovado') && data && (
        <CarimboDigital
          nome={nome}
          cargo={cargo}
          cpf={cpf}
          dataHora={data}
          status={status as 'Aprovado' | 'Reprovado'}
          slotNum={slotNum}
          compact
        />
      )}

      {observacao && (
        <div className="bg-muted/50 rounded-lg px-2 py-1.5">
          <p className="text-xs text-muted-foreground italic">"{observacao}"</p>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RDOAprovacao() {
  const { token } = useParams<{ token: string }>();

  const [rdo, setRdo] = useState<any>(null);
  const [obra, setObra] = useState<any>(null);
  const [efetivo, setEfetivo] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [fotos, setFotos] = useState<{ signedUrl: string; legenda: string }[]>([]);
  const [aprovadorNum, setAprovadorNum] = useState<1 | 2 | 3 | null>(null);
  const [assinaturas, setAssinaturas] = useState<Record<string, string>>({});
  const [historicRdos, setHistoricRdos] = useState<any[]>([]);
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<'aprovado' | 'reprovado' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showNativeViewer, setShowNativeViewer] = useState(false);
  const isMobile = useIsMobile();

  // Fluxo: 'data-confirm' → 'sign'
  type FlowStep = 'data-confirm' | 'otp' | 'sign';
  const [flowStep, setFlowStep] = useState<FlowStep>('data-confirm');
  const [dadosConfirmados, setDadosConfirmados] = useState<{ nome: string; cargo: string; cpf: string } | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    callApprovalFn(`?token=${token}`)
      .then(d => {
        setRdo(d.rdo);
        setObra(d.obra);
        setAprovadorNum(d.aprovadorNum);
        setEfetivo(d.efetivo || []);
        setServicos(d.servicos || []);
        setEquipamentos(d.equipamentos || []);
        setFotos(d.fotos || []);
        setAssinaturas(d.assinaturas || {});
        setHistoricRdos(d.historicRdos || []);
      })
      .catch(e => {
        // Token consumido (aprovador já assinou): o backend invalida o token mas
        // podemos mostrar a tela de "já assinou" sem dados completos.
        // Para outros erros (token inexistente, RDO não encontrado), mostramos erro.
        const msg: string = e?.message || '';
        if (msg.includes('Token inválido') || msg.includes('não encontrado')) {
          setError(msg);
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleDataConfirmed = useCallback((dados: { nome: string; cargo: string; cpf: string }) => {
    setDadosConfirmados(dados);
    setFlowStep('sign'); // Pula OTP — token no link já autentica o aprovador
  }, []);

  const handleOtpVerified = useCallback(() => {
    setFlowStep('sign');
  }, []);

  // Monta o override para o PDF refletir a assinatura:
  // 1) Se acabou de assinar agora (done !== null) → usa dados da sessão
  // 2) Se já havia assinado antes (alreadyDecided) → usa dados do RDO do banco
  const buildPdfAprovadorOverride = () => {
    if (!aprovadorNum) return undefined;

    // Acabou de assinar nesta sessão
    if (done && dadosConfirmados) {
      return {
        slotNum: aprovadorNum,
        status: done === 'aprovado' ? 'Aprovado' as const : 'Reprovado' as const,
        nome: dadosConfirmados.nome,
        cargo: dadosConfirmados.cargo,
        cpf: dadosConfirmados.cpf,
        dataHora: new Date().toISOString(),
      };
    }

    // Já havia assinado (alreadyDecided) — usa dados salvos no banco
    if (rdo && aprovadorNum) {
      const myStatus = rdo[`aprovacao${aprovadorNum}_status`] as string | null;
      const myData = rdo[`aprovacao${aprovadorNum}_data`] as string | null;
      if ((myStatus === 'Aprovado' || myStatus === 'Reprovado') && myData) {
        const nome = obra?.[`aprovador${aprovadorNum}_nome`] as string;
        const cargo = obra?.[`aprovador${aprovadorNum}_cargo`] as string | null;
        const cpf = obra?.[`aprovador${aprovadorNum}_cpf`] as string | null;
        return {
          slotNum: aprovadorNum,
          status: myStatus as 'Aprovado' | 'Reprovado',
          nome: nome || '',
          cargo: cargo || '',
          cpf: cpf || '',
          dataHora: myData,
        };
      }
    }

    return undefined;
  };

  const handleGeneratePdfPreview = useCallback(async () => {
    if (!rdo || !obra) return;
    // Em mobile, mostra o visualizador HTML nativo (iOS/Android não suportam iframe PDF)
    if (isMobile) {
      setShowNativeViewer(true);
      return;
    }
    setGeneratingPreview(true);
    try {
      const blob = await generateRdoPdfBlob({ rdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas, aprovadorOverride: buildPdfAprovadorOverride() });
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      setShowPdfPreview(true);
    } catch (e) {
      toast.error('Erro ao gerar visualização do PDF');
    } finally {
      setGeneratingPreview(false);
    }
  }, [rdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas, isMobile, done, dadosConfirmados, aprovadorNum]);

  const handleDownloadPdf = useCallback(async () => {
    if (!rdo || !obra) return;
    setGeneratingPreview(true);
    try {
      const blob = await generateRdoPdfBlob({ rdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas, aprovadorOverride: buildPdfAprovadorOverride() });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RDO_${rdo.numero_rdo || rdo.id}_${rdo.data}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Erro ao baixar PDF');
    } finally {
      setGeneratingPreview(false);
    }
  }, [rdo, obra, efetivo, equipamentos, servicos, fotos, assinaturas, done, dadosConfirmados, aprovadorNum]);

  const handleDecision = async (decision: 'Aprovado' | 'Reprovado') => {
    if (!token || !dadosConfirmados) return;

    setSubmitting(true);
    try {
      await callApprovalFn(`?token=${token}`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          observacao: observacao.trim() || undefined,
          nome_aprovador: dadosConfirmados.nome,
          cargo_aprovador: dadosConfirmados.cargo,
          cpf_aprovador: dadosConfirmados.cpf,
        }),
      });
      setDone(decision === 'Aprovado' ? 'aprovado' : 'reprovado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar decisão');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">Carregando RDO...</p>
      </div>
    </div>
  );

  if (error || !rdo || !aprovadorNum) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-4 space-y-3">
        <XCircle className="w-16 h-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Link inválido</h1>
        <p className="text-muted-foreground">
          Este link de aprovação não existe, expirou ou já foi utilizado.
        </p>
      </div>
    </div>
  );

  const alreadyDecided = rdo[`aprovacao${aprovadorNum}_status`] !== 'Pendente' && !done;
  const dataFormatada = format(new Date(rdo.data + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const nomAprovador = obra?.[`aprovador${aprovadorNum}_nome`] as string;
  const cargoAprovador = obra?.[`aprovador${aprovadorNum}_cargo`] as string | null;
  const cpfAprovador = obra?.[`aprovador${aprovadorNum}_cpf`] as string | null;
  const totalPessoas = efetivo.reduce((s: number, e: any) => s + (e.quantidade || 0), 0);
  const approvalSlots = [1, 2, 3] as const;

  // ── Etapa 1: Confirmação de dados ─────────────────────────────────────────
  if (flowStep === 'data-confirm' && !alreadyDecided && !done) {
    return (
      <DataConfirmForm
        nomEsperado={nomAprovador}
        cargoEsperado={cargoAprovador}
        cpfEsperado={cpfAprovador}
        slotNum={aprovadorNum}
        onConfirmed={handleDataConfirmed}
      />
    );
  }

  // ── Etapa 2: Verificação OTP ──────────────────────────────────────────────
  if (flowStep === 'otp' && !alreadyDecided && !done) {
    return (
      <OtpVerification
        nomEsperado={nomAprovador}
        slotNum={aprovadorNum}
        token={token!}
        onVerified={handleOtpVerified}
      />
    );
  }

  // ── Etapa 3: Documento + Assinatura ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-5">

        {/* ── Visualizador HTML nativo (mobile) ────────────────────────── */}
        {showNativeViewer && (
          <RDOViewer
            rdo={rdo}
            obra={obra}
            efetivo={efetivo}
            servicos={servicos}
            equipamentos={equipamentos}
            fotos={fotos}
            onClose={() => setShowNativeViewer(false)}
            onDownload={handleDownloadPdf}
            downloading={generatingPreview}
          />
        )}

        {/* ── PDF Preview Modal — desktop (iframe) ──────────────────────── */}
        {showPdfPreview && pdfPreviewUrl && !isMobile && (
          <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-background border-b shrink-0 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 font-semibold text-sm h-9 px-3"
                onClick={() => setShowPdfPreview(false)}
              >
                <XIcon className="w-4 h-4" />
                ← Voltar
              </Button>
              <span className="font-medium text-sm text-muted-foreground truncate max-w-[160px] sm:max-w-xs">
                {obra?.nome}
              </span>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9 shrink-0" onClick={handleDownloadPdf} disabled={generatingPreview}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            </div>
            <iframe
              src={pdfPreviewUrl}
              className="flex-1 w-full border-0"
              title="Visualização do RDO"
            />
          </div>
        )}

        {/* Header */}
        <div className="text-center pb-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Aprovação de RDO</h1>
          {nomAprovador && (
            <p className="text-muted-foreground mt-1">
              Olá, <strong>{dadosConfirmados?.nome || nomAprovador}</strong>
              {(dadosConfirmados?.cargo || cargoAprovador) ? ` (${dadosConfirmados?.cargo || cargoAprovador})` : ''}!
            </p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground bg-muted inline-block px-3 py-1 rounded-full">
              Aprovador {aprovadorNum} · Documento protegido
            </span>
            <span className="text-xs bg-emerald-500/10 text-emerald-700 inline-flex items-center gap-1 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3 h-3" /> Dados e identidade verificados
            </span>
          </div>
        </div>

        {/* RDO Info */}
        <div className="border rounded-xl p-5 space-y-4 bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-lg">{obra?.nome}</p>
                <p className="text-muted-foreground text-sm">
                  {dataFormatada}{rdo.numero_rdo ? ` · RDO Nº ${rdo.numero_rdo}` : ''}
                </p>
                {obra?.cliente && <p className="text-xs text-muted-foreground">Cliente: {obra.cliente}</p>}
              </div>
            </div>
            {/* Botão visualizar PDF */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8 shrink-0 border-primary/30 text-primary hover:bg-primary/5"
              onClick={handleGeneratePdfPreview}
              disabled={generatingPreview}
            >
              {generatingPreview
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileText className="w-3.5 h-3.5" />
              }
              {generatingPreview ? 'Gerando...' : 'Ver RDO'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Clima Manhã</p>
              <p className="font-medium">{rdo.clima_manha}</p>
              {rdo.temperatura_manha && <p className="text-xs text-muted-foreground">{rdo.temperatura_manha}°C</p>}
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Clima Tarde</p>
              <p className="font-medium">{rdo.clima_tarde}</p>
              {rdo.temperatura_tarde && <p className="text-xs text-muted-foreground">{rdo.temperatura_tarde}°C</p>}
            </div>
          </div>

          {totalPessoas > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">👷 Efetivo: {totalPessoas} pessoas</p>
              <div className="space-y-1">
                {efetivo.map((e: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{e.empresa} — {e.funcao}</span>
                    <span className="font-medium">{e.quantidade} ({e.periodo})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {equipamentos.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">🚜 Equipamentos</p>
              <div className="space-y-1">
                {equipamentos.map((eq: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{eq.equipamento}{eq.prefixo ? ` (${eq.prefixo})` : ''}</span>
                    <span>{eq.horas_trabalhadas}h · {eq.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {servicos.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">🔧 Serviços Executados</p>
              <div className="space-y-1">
                {servicos.map((s: any, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    • {s.descricao}{s.local_servico ? ` [${s.local_servico}]` : ''}
                    {s.quantidade_executada ? ` — ${s.quantidade_executada} ${s.unidade || ''}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}

          {fotos.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">📷 Fotos da Obra ({fotos.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {fotos.map((f, i) => f.signedUrl ? (
                  <div key={i} className="rounded-lg overflow-hidden border">
                    <img src={f.signedUrl} alt={f.legenda || `Foto ${i + 1}`} className="w-full aspect-video object-cover" />
                    {f.legenda && <p className="text-xs text-muted-foreground px-2 py-1">{f.legenda}</p>}
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {rdo.observacoes && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-1">📝 Observações</p>
              <p className="text-sm text-muted-foreground">{rdo.observacoes}</p>
            </div>
          )}

          {/* Comentários dos responsáveis */}
          {(rdo.comentarios_construtora || rdo.comentarios_gerenciadora || rdo.comentarios_fiscalizacao) && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">💬 Comentários</p>
              {rdo.comentarios_construtora && (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-0.5">Construtora</p>
                  <p className="text-muted-foreground">{rdo.comentarios_construtora}</p>
                </div>
              )}
              {rdo.comentarios_gerenciadora && (
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-0.5">Gerenciadora</p>
                  <p className="text-muted-foreground">{rdo.comentarios_gerenciadora}</p>
                </div>
              )}
              {rdo.comentarios_fiscalizacao && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-sm">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">Fiscalização</p>
                  <p className="text-muted-foreground">{rdo.comentarios_fiscalizacao}</p>
                </div>
              )}
            </div>
          )}

          {/* Observações dos aprovadores */}
          {[1, 2, 3].some(n => rdo[`aprovacao${n}_observacao`]) && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">✍️ Observações dos Aprovadores</p>
              {[1, 2, 3].map(n => {
                const obs = rdo[`aprovacao${n}_observacao`];
                const nome = obra?.[`aprovador${n}_nome`];
                const status = rdo[`aprovacao${n}_status`];
                if (!obs || !nome) return null;
                const isApproved = status === 'Aprovado';
                return (
                  <div key={n} className={`p-2.5 rounded-lg text-sm ${isApproved ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                    <p className={`text-xs font-semibold mb-0.5 ${isApproved ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {nome} ({status})
                    </p>
                    <p className="text-muted-foreground">{obs}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Slots de assinatura */}
        <div className="border rounded-xl p-4 bg-card shadow-sm space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Espaços de Assinatura Eletrônica
          </p>
          <div className="space-y-3">
            {approvalSlots.map(n => {
              const nome = obra?.[`aprovador${n}_nome`];
              if (!nome) return null;
              const cargo = obra?.[`aprovador${n}_cargo`] as string | null;
              const cpf = obra?.[`aprovador${n}_cpf`] as string | null;
              const status = rdo[`aprovacao${n}_status`] as string | null;
              const dataAss = rdo[`aprovacao${n}_data`] as string | null;
              const obs = rdo[`aprovacao${n}_observacao`] as string | null;
              const assinaturaUrl = assinaturas[`assinatura${n}_url`];
              const isAtivo = n === aprovadorNum && !alreadyDecided && !done;

              return (
                <AssinaturaSlot
                  key={n}
                  nome={nome}
                  cargo={cargo}
                  cpf={cpf}
                  status={status}
                  data={dataAss}
                  observacao={obs}
                  assinaturaUrl={assinaturaUrl}
                  isAtivo={isAtivo}
                  slotNum={n}
                />
              );
            })}
          </div>
        </div>

        {/* Área de decisão */}
        {done ? (() => {
            const slots = ([1, 2, 3] as const).filter(n => obra?.[`aprovador${n}_nome`]);
            const allApproved = slots.length > 0 && slots.every(n =>
              n === aprovadorNum ? done === 'aprovado' : rdo[`aprovacao${n}_status`] === 'Aprovado'
            );

            return (
              <div className="space-y-4">
                {/* ── Banner principal ── */}
                {allApproved ? (
                  <div className="rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-lg">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-center text-white">
                      <div className="relative w-24 h-24 mx-auto mb-4">
                        <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
                          <CheckCircle2 className="w-12 h-12 text-white drop-shadow" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-sm">⭐</span>
                        </div>
                      </div>
                      <h2 className="text-3xl font-bold tracking-tight mb-1">RDO Totalmente Aprovado!</h2>
                      <p className="text-emerald-100 text-base">
                        Todos os {slots.length} aprovadores assinaram este relatório.
                      </p>
                      <div className="mt-4 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-medium">
                        <ShieldCheck className="w-4 h-4" /> Documento com validade jurídica plena
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-xl overflow-hidden border-2 ${done === 'aprovado' ? 'border-emerald-500/40' : 'border-red-500/40'}`}>
                    <div className={`px-6 py-8 text-center ${done === 'aprovado' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md ${done === 'aprovado' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        {done === 'aprovado'
                          ? <CheckCircle2 className="w-10 h-10 text-white" />
                          : <XCircle className="w-10 h-10 text-white" />
                        }
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">
                        {done === 'aprovado' ? 'Assinatura Registrada! ✅' : 'Reprovação Registrada'}
                      </h2>
                      <p className={`text-base font-medium mt-1 ${done === 'aprovado' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {done === 'aprovado'
                          ? `Obrigado, ${dadosConfirmados?.nome?.split(' ')[0]}! Sua aprovação foi concluída.`
                          : `${dadosConfirmados?.nome?.split(' ')[0]}, sua reprovação foi registrada.`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Conteúdo pós-assinatura ── */}
                <div className="rounded-xl border bg-card shadow-sm px-6 py-5 space-y-4">
                  <div className="text-center space-y-2">
                    {done === 'aprovado' ? (
                      <>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Sua assinatura eletrônica foi registrada com sucesso no sistema Apropriapp.
                          O carimbo digital abaixo comprova sua participação e possui <strong>validade jurídica</strong> conforme a Lei nº 14.063/2020.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          A equipe de obra agradece sua atenção e agilidade na análise deste documento. 🙏
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Sua reprovação foi registrada com sucesso. A equipe responsável será notificada e
                        poderá tomar as providências necessárias. Obrigado pela análise criteriosa do documento.
                      </p>
                    )}
                  </div>

                  {/* Carimbo digital */}
                  {dadosConfirmados && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 justify-center">
                        <ShieldCheck className="w-3.5 h-3.5" /> Comprovante de Assinatura Eletrônica
                      </p>
                      <CarimboDigital
                        nome={dadosConfirmados.nome}
                        cargo={dadosConfirmados.cargo}
                        cpf={dadosConfirmados.cpf}
                        dataHora={new Date()}
                        status={done === 'aprovado' ? 'Aprovado' : 'Reprovado'}
                        slotNum={aprovadorNum!}
                        rdoId={rdo?.id}
                      />
                    </div>
                  )}

                  {/* Painel de status dos aprovadores */}
                  {slots.length > 0 && (
                    <div className="rounded-xl border bg-muted/30 overflow-hidden">
                      <div className="px-4 py-2.5 border-b bg-muted/50 flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">Andamento das Aprovações</p>
                      </div>
                      <div className="divide-y divide-border/50">
                        {slots.map(n => {
                          const nome = obra?.[`aprovador${n}_nome`] as string;
                          const cargo = obra?.[`aprovador${n}_cargo`] as string | null;
                          const status = n === aprovadorNum
                            ? (done === 'aprovado' ? 'Aprovado' : 'Reprovado')
                            : (rdo[`aprovacao${n}_status`] as string | null);
                          const dataAss = n === aprovadorNum
                            ? new Date().toISOString()
                            : (rdo[`aprovacao${n}_data`] as string | null);
                          const isMe = n === aprovadorNum;

                          return (
                            <div key={n} className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-primary/5' : ''}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                                ['bg-blue-600', 'bg-purple-600', 'bg-emerald-600'][n - 1]
                              }`}>
                                {n}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight truncate">
                                  {nome} {isMe && <span className="text-xs text-primary font-normal">(você)</span>}
                                </p>
                                {cargo && <p className="text-xs text-muted-foreground truncate">{cargo}</p>}
                                {dataAss && (status === 'Aprovado' || status === 'Reprovado') && (
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {format(new Date(dataAss), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0">
                                {status === 'Aprovado' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
                                  </span>
                                ) : status === 'Reprovado' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-700">
                                    <XCircle className="w-3.5 h-3.5" /> Reprovado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" /> Pendente
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Botões de PDF pós-assinatura */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 h-11 text-sm"
                      onClick={handleGeneratePdfPreview}
                      disabled={generatingPreview}
                    >
                      {generatingPreview
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                        : <><FileText className="w-4 h-4" /> Visualizar RDO</>
                      }
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 h-11 text-sm"
                      onClick={handleDownloadPdf}
                      disabled={generatingPreview}
                    >
                      <Download className="w-4 h-4" /> Baixar PDF
                    </Button>
                  </div>

                  <div className="text-center border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      📄 Documento registrado · {obra?.nome} · RDO Apropriapp
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Você já pode fechar esta página com segurança.</p>
                  </div>
                </div>
              </div>
            );
          })() : alreadyDecided ? (
          <div className="space-y-4">
            {/* Banner de já assinado */}
            {(() => {
              const myStatus = rdo[`aprovacao${aprovadorNum}_status`] as string;
              const myData = rdo[`aprovacao${aprovadorNum}_data`] as string | null;
              const myObs = rdo[`aprovacao${aprovadorNum}_observacao`] as string | null;
              const isAprov = myStatus === 'Aprovado';
              return (
                <>
                  <div className={`rounded-xl overflow-hidden border-2 ${isAprov ? 'border-emerald-500/40' : 'border-red-500/40'}`}>
                    <div className={`px-6 py-6 text-center ${isAprov ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isAprov ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        {isAprov ? <CheckCircle2 className="w-8 h-8 text-white" /> : <XCircle className="w-8 h-8 text-white" />}
                      </div>
                      <h2 className="text-xl font-bold">{isAprov ? 'Você já aprovou este RDO ✅' : 'Você já reprovou este RDO'}</h2>
                      {myData && (
                        <p className="text-sm text-muted-foreground mt-1">
                          em {format(new Date(myData), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">
                        Você pode visualizar ou baixar o RDO assinado abaixo.
                      </p>
                    </div>
                  </div>

                  {/* Carimbo do aprovador */}
                  {myData && (myStatus === 'Aprovado' || myStatus === 'Reprovado') && (
                    <div className="border rounded-xl bg-card shadow-sm p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Comprovante de Assinatura Eletrônica
                      </p>
                      <CarimboDigital
                        nome={nomAprovador}
                        cargo={cargoAprovador}
                        cpf={cpfAprovador}
                        dataHora={myData}
                        status={myStatus as 'Aprovado' | 'Reprovado'}
                        slotNum={aprovadorNum!}
                        rdoId={rdo?.id}
                      />
                      {myObs && (
                        <div className="bg-muted/50 rounded-lg px-3 py-2">
                          <p className="text-xs text-muted-foreground italic">Observação: &quot;{myObs}&quot;</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botões para visualizar/baixar */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 h-11 text-sm"
                      onClick={handleGeneratePdfPreview}
                      disabled={generatingPreview}
                    >
                      {generatingPreview
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                        : <><FileText className="w-4 h-4" /> Visualizar RDO</>}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 h-11 text-sm"
                      onClick={handleDownloadPdf}
                      disabled={generatingPreview}
                    >
                      <Download className="w-4 h-4" /> Baixar PDF
                    </Button>
                  </div>

                  {/* Status dos demais aprovadores */}
                  {(() => {
                    const slots = ([1, 2, 3] as const).filter(n => obra?.[`aprovador${n}_nome`]);
                    if (slots.length <= 1) return null;
                    return (
                      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="px-4 py-2.5 border-b bg-muted/50 flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-semibold">Andamento das Aprovações</p>
                        </div>
                        <div className="divide-y divide-border/50">
                          {slots.map(n => {
                            const nm = obra?.[`aprovador${n}_nome`] as string;
                            const cg = obra?.[`aprovador${n}_cargo`] as string | null;
                            const st = rdo[`aprovacao${n}_status`] as string | null;
                            const dt = rdo[`aprovacao${n}_data`] as string | null;
                            const isMe = n === aprovadorNum;
                            return (
                              <div key={n} className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-primary/5' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${['bg-blue-600','bg-purple-600','bg-emerald-600'][n-1]}`}>{n}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{nm} {isMe && <span className="text-xs text-primary">(você)</span>}</p>
                                  {cg && <p className="text-xs text-muted-foreground truncate">{cg}</p>}
                                  {dt && (st === 'Aprovado' || st === 'Reprovado') && (
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Clock className="w-2.5 h-2.5" /> {format(new Date(dt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                  )}
                                </div>
                                <div className="shrink-0">
                                  {st === 'Aprovado'
                                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Aprovado</span>
                                    : st === 'Reprovado'
                                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-700"><XCircle className="w-3.5 h-3.5" /> Reprovado</span>
                                    : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground"><Clock className="w-3.5 h-3.5" /> Pendente</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="border rounded-xl p-5 space-y-5 bg-card shadow-sm">

            {/* Resumo dos dados confirmados */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
                <ShieldCheck className="w-4 h-4" /> Dados verificados para assinatura
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{dadosConfirmados?.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">{dadosConfirmados?.cargo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground font-mono">{dadosConfirmados?.cpf}</span>
                </div>
              </div>
              <button
                className="text-xs text-muted-foreground underline flex items-center gap-1 mt-1"
                onClick={() => setFlowStep('data-confirm')}
              >
                <Edit3 className="w-3 h-3" /> Corrigir dados
              </button>
            </div>

            {/* Preview do carimbo digital */}
            {dadosConfirmados && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Preview do Carimbo Digital
                </p>
                <CarimboDigital
                  nome={dadosConfirmados.nome}
                  cargo={dadosConfirmados.cargo}
                  cpf={dadosConfirmados.cpf}
                  dataHora={new Date()}
                  status="Aprovado"
                  slotNum={aprovadorNum!}
                  rdoId={rdo.id}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Este carimbo será registrado permanentemente no documento ao assinar.
                </p>
              </div>
            )}

            {/* ── Botão Ver RDO em destaque ───────────────────────────── */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Leia o documento antes de assinar
              </p>
              <Button
                className="w-full h-12 gap-2 text-base"
                variant="outline"
                onClick={handleGeneratePdfPreview}
                disabled={generatingPreview}
              >
                {generatingPreview
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando visualização...</>
                  : <><FileText className="w-5 h-5" /> 📄 Visualizar RDO Completo</>
                }
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Você também pode baixar o PDF durante a visualização
              </p>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Observações ou ressalvas{' '}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </label>
              <Textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Informe observações, ressalvas ou motivo de reprovação..."
                rows={3}
              />
            </div>

            {/* Botões de decisão */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                variant="outline"
                className="gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10 h-12"
                onClick={() => handleDecision('Reprovado')}
                disabled={submitting}
              >
                <XCircle className="w-4 h-4" /> Reprovar
              </Button>
              <Button
                className="gap-2 h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleDecision('Aprovado')}
                disabled={submitting}
              >
                <ShieldCheck className="w-4 h-4" />
                {submitting ? 'Aguarde...' : 'Assinar e Aprovar'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center border-t pt-3">
              🔒 Assinatura eletrônica com validade jurídica · Lei nº 14.063/2020 · Link único de uso exclusivo
            </p>
          </div>
        )}

        {/* Histórico de RDOs anteriores da obra — sempre visível */}
        {historicRdos.length > 0 && token && (
          <HistoricoRdosPanel rdos={historicRdos} currentToken={token} />
        )}

        {/* Mostrar histórico também quando já decidiu — ainda útil */}
        {done && historicRdos.length === 0 && (
          <div className="rounded-xl border bg-card p-4 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum RDO anterior disponível para esta etapa.</p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Este documento foi enviado por {obra?.responsavel || obra?.nome} · RDO Apropriapp
        </p>
      </div>
    </div>
  );
}
