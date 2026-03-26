import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Verify requesting user is admin
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token.length < 20) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = decodeJwtPayload(token);
    if (!payload?.sub) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: roleData } = await admin.from('user_roles').select('role').eq('user_id', payload.sub).single();
    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem convidar usuários' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'invite') {
      const { email, nome } = body;
      if (!email || !nome) {
        return new Response(JSON.stringify({ error: 'Email e nome são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if user already exists
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const found = existingUsers?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

      let userId: string;

      if (found) {
        userId = found.id;
        await admin.from('profiles').update({ nome, tipo: 'Responsavel RDO', status: 'ativo' }).eq('user_id', userId);
      } else {
        const tempPass = `rdo_resp_${crypto.randomUUID()}`;
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password: tempPass,
          email_confirm: true,
          user_metadata: { nome },
        });
        if (createErr || !created.user) {
          return new Response(JSON.stringify({ error: createErr?.message || 'Erro ao criar usuário' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        userId = created.user.id;

        const { data: existingProfile } = await admin.from('profiles').select('id').eq('user_id', userId).single();
        if (existingProfile) {
          await admin.from('profiles').update({ nome, tipo: 'Responsavel RDO', status: 'ativo' }).eq('user_id', userId);
        } else {
          await admin.from('profiles').insert({ user_id: userId, nome, email, tipo: 'Responsavel RDO', status: 'ativo', usuario: email.split('@')[0] });
        }

        const { data: existingRole } = await admin.from('user_roles').select('id').eq('user_id', userId).single();
        if (!existingRole) {
          await admin.from('user_roles').insert({ user_id: userId, role: 'apontador' });
        }
      }

      // Generate magic link pointing to /rdo/portal
      const origin = req.headers.get('origin') || 'https://apropriapp.lovable.app';
      const redirectTo = `${origin}/rdo/portal`;
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      });

      if (linkError) {
        return new Response(JSON.stringify({ error: linkError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, userId, magicLink: linkData.properties?.action_link, nome, email }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: 'userId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await admin.from('user_roles').delete().eq('user_id', userId);
      await admin.from('profiles').delete().eq('user_id', userId);
      await admin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'resend') {
      const { email } = body;
      const origin = req.headers.get('origin') || 'https://apropriapp.lovable.app';
      const redirectTo = `${origin}/rdo/portal`;
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      });
      if (linkError) return new Response(JSON.stringify({ error: linkError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true, magicLink: linkData.properties?.action_link }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
