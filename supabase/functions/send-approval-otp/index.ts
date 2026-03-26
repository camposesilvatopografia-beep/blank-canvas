import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Token ausente' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── POST: gerar e enviar OTP ─────────────────────────────────────────────
  if (req.method === 'POST') {
    // 1. Encontrar RDO pelo token
    let foundRdo: any = null;
    let aprovadorNum: 1 | 2 | 3 | null = null;

    for (const n of [1, 2, 3] as const) {
      const { data } = await supabase
        .from('rdos')
        .select('*, rdo_obras(*)')
        .eq(`aprovacao${n}_token`, token)
        .single();
      if (data) { foundRdo = data; aprovadorNum = n; break; }
    }

    if (!foundRdo || !aprovadorNum) {
      return new Response(JSON.stringify({ error: 'Token inválido ou não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const obra = foundRdo.rdo_obras;
    const email = obra?.[`aprovador${aprovadorNum}_email`];
    const nomeAprovador = obra?.[`aprovador${aprovadorNum}_nome`] || 'Aprovador';
    const cargoAprovador = obra?.[`aprovador${aprovadorNum}_cargo`] || '';

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email do aprovador não configurado nesta etapa. Solicite ao administrador que atualize o cadastro da etapa.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verificar se já houve envio recente (< 30 seg) para evitar spam acidental,
    //    mas NÃO bloquear envios em lote (múltiplos aprovadores simultâneos têm aprovador_num diferentes)
    const thirtySecAgo = new Date(Date.now() - 30000).toISOString();
    const { data: recentOtp } = await supabase
      .from('rdo_approval_otps')
      .select('created_at')
      .eq('rdo_id', foundRdo.id)
      .eq('aprovador_num', aprovadorNum)
      .is('used_at', null)
      .gte('created_at', thirtySecAgo)
      .single();

    if (recentOtp) {
      return new Response(JSON.stringify({ error: 'Aguarde 30 segundos antes de reenviar para o mesmo aprovador.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Montar link direto de aprovação (sem necessidade de OTP)
    const origin = Deno.env.get('SITE_URL') || 'https://apropriapp.lovable.app';
    const approvalLink = `${origin}/rdo/aprovar/${token}`;

    const rdoData = new Date(foundRdo.data + 'T12:00:00');
    const dataFormatada = rdoData.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const rdoNumero = foundRdo.numero_rdo ? `Nº ${foundRdo.numero_rdo} ` : '';

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:28px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ApropriAPP</h1>
            <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:13px;">Aprovação de Relatório Diário de Obra</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:600;">Olá, ${nomeAprovador}${cargoAprovador ? ` (${cargoAprovador})` : ''}!</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              Você foi solicitado a aprovar o <strong>RDO ${rdoNumero}</strong>da etapa <strong>${obra?.nome || ''}</strong> referente a <strong>${dataFormatada}</strong>.
            </p>

            <!-- Botão CTA -->
            <div style="text-align:center;margin:28px 0;">
              <a href="${approvalLink}"
                 style="display:inline-block;background:#1a1a2e;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:10px;letter-spacing:0.3px;">
                ✍️ Clique aqui para assinar o RDO
              </a>
            </div>

            <p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.6;text-align:center;">
              Ou copie e cole o link abaixo no seu navegador:
            </p>
            <div style="background:#f4f4f5;border-radius:8px;padding:10px 14px;word-break:break-all;">
              <a href="${approvalLink}" style="font-size:12px;color:#6366f1;">${approvalLink}</a>
            </div>

            <!-- Info de segurança -->
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:12px 16px;margin-top:24px;">
              <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
                🔒 <strong>Segurança:</strong> Este link é exclusivo para você. Não compartilhe com outras pessoas.
                Se você não esperava receber esta solicitação, ignore este email.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Este email foi gerado automaticamente pelo sistema ApropriAPP · Não responda este email
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    let emailSent = false;
    let resendId: string | null = null;
    let emailError: string | null = null;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    console.log(`[ApprovalLink] RESEND_API_KEY presente: ${!!resendKey}`);
    if (resendKey) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'ApropriAPP <noreply@iajeancampos.online>',
            to: [email],
            subject: `Relatório Diário de Obra — ${obra?.nome || ''} (${dataFormatada})`,
            html: emailBody,
          }),
        });
        const resendBody = await resendRes.text();
        if (resendRes.ok) {
          emailSent = true;
          try { resendId = JSON.parse(resendBody)?.id ?? null; } catch { /* ignore */ }
          console.log(`[ApprovalLink] Email enviado via Resend para ${email}`);
        } else {
          emailError = `Resend ${resendRes.status}: ${resendBody}`;
          console.error(`[ApprovalLink] Erro Resend (status ${resendRes.status}): ${resendBody}`);
        }
      } catch (e) {
        emailError = String(e);
        console.error('[ApprovalLink] Exceção ao chamar Resend:', e);
      }
    } else {
      emailError = 'RESEND_API_KEY não configurada';
      console.warn('[ApprovalLink] RESEND_API_KEY não encontrada nas variáveis de ambiente');
    }

    // ── Gravar log de envio ───────────────────────────────────────────────────
    try {
      await supabase.from('rdo_email_logs').insert({
        rdo_id: foundRdo.id,
        obra_nome: obra?.nome || null,
        aprovador_num: aprovadorNum,
        email,
        status: emailSent ? 'success' : 'error',
        error_message: emailError,
        resend_id: resendId,
      });
    } catch (logErr) {
      console.error('[ApprovalLink] Erro ao gravar log:', logErr);
    }

    console.log(`[ApprovalLink] Link de aprovação para ${email}: ${approvalLink}`);

    const emailParts = email.split('@');
    const maskedEmail = emailParts[0].slice(0, 2) + '***@' + emailParts[1];

    return new Response(
      JSON.stringify({
        success: true,
        maskedEmail,
        emailSent,
        approvalLink,
        message: emailSent
          ? `Link de aprovação enviado para ${maskedEmail}`
          : `Link gerado. Configure RESEND_API_KEY para envio automático por email. Link: ${approvalLink}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ error: 'Método não permitido' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

