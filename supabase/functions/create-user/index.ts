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

    const userId = payload.sub;
    console.log(`Request from user: ${userId} (${payload.email})`);

    // Verify user exists and check if admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
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
        JSON.stringify({ error: 'Apenas administradores podem criar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { nome, usuario, password, tipo, status, email: providedEmail } = await req.json();

    if (!nome || !password) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Nome e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided email or generate from username
    const email = providedEmail || `${usuario}@apropriapp.local`;
    const finalUsuario = usuario || (providedEmail ? providedEmail.split('@')[0] : 'user');

    console.log(`Creating user: ${nome} (${email})`);

    // Create user using admin API
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { nome },
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      console.error('No user returned from createUser');
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auth user created: ${authData.user.id}`);

    // Check if profile already exists (created by trigger)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    if (existingProfile) {
      // Update existing profile (was created by trigger)
      console.log(`Profile already exists, updating: ${existingProfile.id}`);
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          nome,
          usuario: finalUsuario,
          tipo: tipo || 'Administrador',
          status: status || 'ativo',
        })
        .eq('user_id', authData.user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          nome,
          email,
          usuario: finalUsuario,
          tipo: tipo || 'Administrador',
          status: status || 'ativo',
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        // Try to clean up auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if role already exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    if (!existingRole) {
      // ALL admin types get 'admin' role - they should access dashboard, never mobile
      const adminTypes = ['Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização'];
      const role = adminTypes.includes(tipo) ? 'admin' : 'apontador';
      
      console.log(`Assigning role '${role}' to user with type '${tipo}'`);
      
      const { error: roleInsertError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role,
        });

      if (roleInsertError) {
        console.error('Error creating role:', roleInsertError);
      }
    }

    // Ensure email is in allowed_emails for login sync
    const { error: allowedError } = await supabaseAdmin
      .from('allowed_emails')
      .upsert({
        email: email.toLowerCase(),
        nome,
        tipo: tipo || 'Administrador',
        status: 'ativo',
      }, { onConflict: 'email' });

    if (allowedError) {
      console.error('Error adding to allowed_emails:', allowedError);
    }

    console.log(`User created successfully: ${authData.user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: authData.user.id, 
          email, 
          nome, 
          usuario: finalUsuario 
        } 
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
