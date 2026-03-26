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
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Token ausente' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // -------------------------------------------------------
  // GET: buscar dados do RDO pelo token de aprovação
  // -------------------------------------------------------
  if (req.method === 'GET') {
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
      // Token já consumido — buscar pelo status para mostrar "já assinou"
      return new Response(JSON.stringify({ error: 'Token inválido ou não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar sub-registros
    const [{ data: efetivo }, { data: servicos }, { data: fotos }, { data: equipamentos }] = await Promise.all([
      supabase.from('rdo_efetivo').select('*').eq('rdo_id', foundRdo.id),
      supabase.from('rdo_servicos').select('*').eq('rdo_id', foundRdo.id),
      supabase.from('rdo_fotos').select('*').eq('rdo_id', foundRdo.id).order('created_at'),
      supabase.from('rdo_equipamentos').select('*').eq('rdo_id', foundRdo.id),
    ]);

    // Gerar URLs assinadas para as fotos
    let fotosComUrls: { signedUrl: string; legenda: string }[] = [];
    if (fotos && fotos.length > 0) {
      fotosComUrls = await Promise.all(
        fotos.map(async (f: any) => {
          const { data: signed } = await supabase.storage
            .from('rdo-fotos')
            .createSignedUrl(f.storage_path, 86400);
          return { signedUrl: signed?.signedUrl || '', legenda: f.legenda || '' };
        })
      );
    }

  // Gerar URLs assinadas para assinaturas já existentes
  const assinaturas: Record<string, string> = {};
  for (const n of [1, 2, 3]) {
    const path = foundRdo[`assinatura${n}_path`];
    if (path) {
      const { data: signed } = await supabase.storage.from('rdo-fotos').createSignedUrl(path, 86400);
      assinaturas[`assinatura${n}_url`] = signed?.signedUrl || '';
    }
  }

  // Buscar assinatura salva do aprovador (para reutilização)
  const aprovadorEmail = foundRdo.rdo_obras?.[`aprovador${aprovadorNum}_email`];
  let savedSignatureUrl: string | null = null;
  if (aprovadorEmail) {
    const { data: savedSig } = await supabase
      .from('rdo_saved_signatures' as any)
      .select('storage_path')
      .eq('email', aprovadorEmail)
      .maybeSingle();
    if (savedSig) {
      const { data: signed } = await supabase.storage
        .from('rdo-fotos')
        .createSignedUrl((savedSig as any).storage_path, 86400);
      savedSignatureUrl = signed?.signedUrl || null;
    }
  }

    // Buscar histórico de RDOs anteriores da mesma obra (exceto o atual)
    const { data: historicRdos } = await supabase
      .from('rdos')
      .select('id, data, numero_rdo, status, aprovacao1_status, aprovacao2_status, aprovacao3_status, aprovacao1_data, aprovacao2_data, aprovacao3_data, created_at')
      .eq('obra_id', foundRdo.obra_id)
      .neq('id', foundRdo.id)
      .in('status', ['Aprovado', 'Aprovado Parcialmente', 'Reprovado'])
      .order('data', { ascending: false })
      .limit(20);

    return new Response(
      JSON.stringify({
        rdo: foundRdo,
        obra: foundRdo.rdo_obras,
        aprovadorNum,
        efetivo: efetivo || [],
        servicos: servicos || [],
        fotos: fotosComUrls,
        equipamentos: equipamentos || [],
        assinaturas,
        savedSignatureUrl,
        historicRdos: historicRdos || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // -------------------------------------------------------
  // POST: registrar decisão + assinatura (imagem base64)
  // -------------------------------------------------------
  if (req.method === 'POST') {
    let body: { decision: string; observacao?: string; assinatura_base64?: string; use_saved_signature?: boolean };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Body inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { decision, observacao, assinatura_base64, use_saved_signature } = body;

    if (decision !== 'Aprovado' && decision !== 'Reprovado') {
      return new Response(JSON.stringify({ error: 'Decisão inválida. Use "Aprovado" ou "Reprovado"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Encontrar o RDO pelo token
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
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se este aprovador já decidiu
    const currentStatus = foundRdo[`aprovacao${aprovadorNum}_status`];
    if (currentStatus !== 'Pendente') {
      return new Response(JSON.stringify({ error: 'Este aprovador já registrou sua decisão' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (foundRdo.status === 'Aprovado' || foundRdo.status === 'Reprovado') {
      return new Response(JSON.stringify({ error: 'Este RDO já foi finalizado' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const obra = foundRdo.rdo_obras;

    // ── Upload da assinatura desenhada ou uso da assinatura salva ────────────
    let assinaturaPath: string | null = null;
    const aprovadorEmail = obra?.[`aprovador${aprovadorNum}_email`];

    if (assinatura_base64) {
      try {
        const base64Data = assinatura_base64.replace(/^data:image\/\w+;base64,/, '');
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `assinaturas/${foundRdo.id}/aprovador${aprovadorNum}_${Date.now()}.png`;

        const { error: uploadError } = await supabase.storage
          .from('rdo-fotos')
          .upload(fileName, binaryData, { contentType: 'image/png', upsert: true });

        if (!uploadError) {
          assinaturaPath = fileName;
          // Salvar assinatura para reutilização futura (upsert por email)
          if (aprovadorEmail) {
            await supabase
              .from('rdo_saved_signatures' as any)
              .upsert({ email: aprovadorEmail, storage_path: fileName, updated_at: new Date().toISOString() }, { onConflict: 'email' });
          }
        } else {
          console.error('Erro ao salvar assinatura:', uploadError);
        }
      } catch (err) {
        console.error('Erro ao processar assinatura:', err);
      }
    } else if (use_saved_signature && aprovadorEmail) {
      // Reutilizar assinatura salva anteriormente
      const { data: savedSig } = await supabase
        .from('rdo_saved_signatures' as any)
        .select('storage_path')
        .eq('email', aprovadorEmail)
        .maybeSingle();
      if (savedSig) {
        assinaturaPath = (savedSig as any).storage_path;
      }
    }

    // Montar update
    const update: any = {
      [`aprovacao${aprovadorNum}_status`]: decision,
      [`aprovacao${aprovadorNum}_data`]: new Date().toISOString(),
      [`aprovacao${aprovadorNum}_observacao`]: observacao ? observacao.trim() : null,
      // Token mantido para permitir visualização posterior
    };

    if (assinaturaPath) {
      update[`assinatura${aprovadorNum}_path`] = assinaturaPath;
    }

    // Calcular novo status global
    const statuses = [
      aprovadorNum === 1 ? decision : foundRdo.aprovacao1_status,
      aprovadorNum === 2 ? decision : foundRdo.aprovacao2_status,
      aprovadorNum === 3 ? decision : foundRdo.aprovacao3_status,
    ];

    const hasApprover = [obra?.aprovador1_nome, obra?.aprovador2_nome, obra?.aprovador3_nome];
    const activeStatuses = statuses.filter((_, i) => hasApprover[i]);

    if (activeStatuses.some(s => s === 'Reprovado')) {
      update.status = 'Reprovado';
    } else if (activeStatuses.every(s => s === 'Aprovado')) {
      update.status = 'Aprovado';
    } else {
      update.status = 'Aprovado Parcialmente';
    }

    const { error } = await supabase.from('rdos').update(update).eq('id', foundRdo.id);

    if (error) {
      console.error('Erro ao atualizar RDO:', error);
      return new Response(JSON.stringify({ error: 'Erro ao registrar decisão' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        decision,
        rdoStatus: update.status,
        aprovadorNum,
        assinaturaPath,
        message: `RDO ${decision === 'Aprovado' ? 'aprovado' : 'reprovado'} com sucesso!`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ error: 'Método não permitido' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
