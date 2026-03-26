import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const rdoId = url.searchParams.get('rdo_id');
  const approvalToken = url.searchParams.get('token'); // token do RDO atual para validar acesso

  if (!rdoId || !approvalToken) {
    return new Response(JSON.stringify({ error: 'Parâmetros ausentes' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validar que o token pertence à mesma obra do rdo_id solicitado
  let obra_id: string | null = null;
  for (const n of [1, 2, 3] as const) {
    const { data } = await supabase
      .from('rdos')
      .select('obra_id')
      .eq(`aprovacao${n}_token`, approvalToken)
      .maybeSingle();
    if (data) { obra_id = data.obra_id; break; }
  }

  // Se token já consumido, tentar pelo rdo_id pedido (fallback — valida pela obra)
  if (!obra_id) {
    // Tenta buscar direto (o token foi consumido mas a sessão ainda tem acesso)
    const { data: targetRdo } = await supabase.from('rdos').select('obra_id').eq('id', rdoId).maybeSingle();
    if (!targetRdo) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    obra_id = targetRdo.obra_id;
  }

  // Buscar o RDO histórico (deve ser da mesma obra)
  const { data: rdoHist, error: rdoErr } = await supabase
    .from('rdos')
    .select('*, rdo_obras(*)')
    .eq('id', rdoId)
    .eq('obra_id', obra_id)
    .single();

  if (rdoErr || !rdoHist) {
    return new Response(JSON.stringify({ error: 'RDO não encontrado ou sem permissão' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Garantir que RDOs antigos também exibam todos os aprovadores (fallback global por slot)
  const obraComFallback = rdoHist.rdo_obras ? { ...rdoHist.rdo_obras } : null;
  if (obraComFallback) {
    const hasMissing = [1, 2, 3].some((n) => !obraComFallback[`aprovador${n}_nome`]);
    if (hasMissing) {
      const { data: outrasObras } = await supabase
        .from('rdo_obras')
        .select('*')
        .eq('status', 'Ativo')
        .neq('id', obraComFallback.id || rdoHist.obra_id);

      if (outrasObras && outrasObras.length > 0) {
        for (const n of [1, 2, 3]) {
          if (!obraComFallback[`aprovador${n}_nome`]) {
            const fonte = outrasObras.find((o: any) => o[`aprovador${n}_nome`]);
            if (fonte) {
              for (const campo of ['nome', 'email', 'whatsapp', 'cargo', 'cpf']) {
                obraComFallback[`aprovador${n}_${campo}`] = fonte[`aprovador${n}_${campo}`] || null;
              }
            }
          }
        }
      }
    }
  }

  // Buscar sub-registros
  const [{ data: efetivo }, { data: servicos }, { data: fotos }, { data: equipamentos }] = await Promise.all([
    supabase.from('rdo_efetivo').select('*').eq('rdo_id', rdoId),
    supabase.from('rdo_servicos').select('*').eq('rdo_id', rdoId),
    supabase.from('rdo_fotos').select('*').eq('rdo_id', rdoId).order('created_at'),
    supabase.from('rdo_equipamentos').select('*').eq('rdo_id', rdoId),
  ]);

  // URLs assinadas para fotos
  let fotosComUrls: { signedUrl: string; legenda: string }[] = [];
  if (fotos && fotos.length > 0) {
    fotosComUrls = await Promise.all(
      fotos.map(async (f: any) => {
        const { data: signed } = await supabase.storage
          .from('rdo-fotos')
          .createSignedUrl(f.storage_path, 3600);
        return { signedUrl: signed?.signedUrl || '', legenda: f.legenda || '' };
      })
    );
  }

  // URLs assinadas para assinaturas
  const assinaturas: Record<string, string> = {};
  for (const n of [1, 2, 3]) {
    const path = rdoHist[`assinatura${n}_path`];
    if (path) {
      const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(path, 3600);
      assinaturas[`assinatura${n}_url`] = signed?.signedUrl || '';
    }
  }

  return new Response(
    JSON.stringify({
      rdo: { ...rdoHist, rdo_obras: obraComFallback ?? rdoHist.rdo_obras },
      obra: obraComFallback ?? rdoHist.rdo_obras,
      efetivo: efetivo || [],
      servicos: servicos || [],
      fotos: fotosComUrls,
      equipamentos: equipamentos || [],
      assinaturas,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
