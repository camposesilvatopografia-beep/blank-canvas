CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _allowed RECORD;
  _tipo TEXT;
  _role app_role;
BEGIN
  SELECT nome, tipo INTO _allowed
  FROM public.allowed_emails
  WHERE email = LOWER(NEW.email)
    AND status = 'ativo'
  LIMIT 1;

  IF _allowed IS NOT NULL THEN
    _tipo := _allowed.tipo;
  ELSIF NEW.email = 'jeanallbuquerque@gmail.com' THEN
    _tipo := 'Administrador';
  ELSE
    _tipo := 'Apontador';
  END IF;

  IF _tipo IN ('Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização') THEN
    _role := 'admin';
  ELSE
    _role := 'apontador';
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, tipo)
  VALUES (
    NEW.id,
    COALESCE(
      _allowed.nome,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'nome',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    _tipo
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$