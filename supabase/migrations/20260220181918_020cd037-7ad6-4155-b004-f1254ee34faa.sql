-- Criar função temporária para bootstrap do admin principal
-- Esta função cria o usuário diretamente na tabela auth.users
-- e registra o perfil e role de admin

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Verificar se o usuário já existe
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'jeanallbuquerque@gmail.com';
  
  IF new_user_id IS NULL THEN
    -- Criar o usuário na tabela auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'jeanallbuquerque@gmail.com',
      crypt('Vida0312.', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"nome":"Jean Albuquerque"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO new_user_id;
    
    RAISE NOTICE 'Usuário criado com ID: %', new_user_id;
  ELSE
    -- Usuário já existe, apenas atualizar a senha
    UPDATE auth.users
    SET 
      encrypted_password = crypt('Vida0312.', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = new_user_id;
    
    RAISE NOTICE 'Senha atualizada para usuário existente: %', new_user_id;
  END IF;
  
  -- Criar/atualizar perfil
  INSERT INTO public.profiles (user_id, nome, email, tipo, status)
  VALUES (new_user_id, 'Jean Albuquerque', 'jeanallbuquerque@gmail.com', 'Administrador', 'ativo')
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    tipo = EXCLUDED.tipo,
    status = EXCLUDED.status,
    updated_at = NOW();
  
  -- Criar/garantir role de admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE 'Perfil e role de admin garantidos para: %', new_user_id;
END;
$$;