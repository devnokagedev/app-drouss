-- Compte super admin par défaut (à personnaliser en production).
-- Téléphone : 700080589  |  PIN : 12345  |  email auth : 700080589@dahira.local

SET search_path = public, extensions;

DO $$
DECLARE
  v_phone TEXT := '700080589';
  v_pin TEXT := '12345';
  v_email TEXT := '700080589@dahira.local';
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := extensions.gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_pin, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'identifiant', v_phone,
        'full_name', 'Super Admin',
        'role', 'super_admin'
      ),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      extensions.gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = crypt(v_pin, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'identifiant', v_phone,
          'full_name', 'Super Admin',
          'role', 'super_admin'
        ),
      updated_at = NOW()
    WHERE id = v_user_id;

    IF NOT EXISTS (
      SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email'
    ) THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        extensions.gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        NOW(),
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, identifiant, phone, diwane, diwane_id)
  VALUES (v_user_id, 'Super Admin', v_phone, v_phone, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    identifiant = EXCLUDED.identifiant,
    phone = EXCLUDED.phone;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'admin'::public.app_role
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin'::public.app_role);
  END IF;
END $$;
