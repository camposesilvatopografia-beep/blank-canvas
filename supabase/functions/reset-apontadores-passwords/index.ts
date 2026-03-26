import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode JWT payload without verification (verification done by Supabase)
function decodeJwtPayload(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the authorization header to verify the requesting user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token and decode JWT payload
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token || token === 'null' || token === 'undefined' || token.length < 20) {
      console.error('Invalid token format');
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = decodeJwtPayload(token);
    
    if (!payload || !payload.sub) {
      console.error('Failed to decode JWT payload');
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.error('Token expired');
      return new Response(
        JSON.stringify({ error: 'Token expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserId = payload.sub;
    console.log(`Request from user: ${adminUserId} (${payload.email})`);

    // Verify user exists and check if admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (roleError) {
      console.error('Error fetching user role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (roleData?.role !== 'admin') {
      console.error('User is not admin:', roleData?.role);
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // System default password
    const SYSTEM_PASSWORD = 'apropriapp@2024';

    // Get all apontadores
    const { data: apontadores, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, usuario, tipo')
      .in('tipo', ['Apontador', 'Supervisor', 'Encarregado'])
      .eq('status', 'ativo');

    if (fetchError) {
      console.error('Error fetching apontadores:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar apontadores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${apontadores?.length || 0} apontadores to update`);

    const results = [];
    const errors = [];

    for (const apontador of apontadores || []) {
      try {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          apontador.user_id,
          { password: SYSTEM_PASSWORD }
        );

        if (updateError) {
          console.error(`Error updating password for ${apontador.usuario}:`, updateError);
          errors.push({ usuario: apontador.usuario, error: updateError.message });
        } else {
          console.log(`Password updated for ${apontador.usuario}`);
          results.push({ usuario: apontador.usuario, success: true });
        }
      } catch (e: any) {
        console.error(`Exception updating password for ${apontador.usuario}:`, e);
        errors.push({ usuario: apontador.usuario, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Senhas atualizadas: ${results.length}/${apontadores?.length || 0}`,
        results,
        errors
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
