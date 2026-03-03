-- ユーザーに pharma_profiles が無い場合も組織作成できるようにする
-- （Dashboard で手動作成したユーザーなど、トリガーが発火しなかったケース対応）

CREATE OR REPLACE FUNCTION public.create_organization(org_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;
  IF trim(org_name) = '' OR org_name IS NULL THEN
    RETURN jsonb_build_object('error', 'name required');
  END IF;

  -- pharma_profiles に行が無ければ作成（手動作成ユーザー対応）
  INSERT INTO pharma_profiles (id, name, email, role)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    u.email,
    'user'
  FROM auth.users u
  WHERE u.id = uid
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO pharma_organizations (name) VALUES (trim(org_name)) RETURNING id INTO new_org_id;
  UPDATE pharma_profiles SET organization_id = new_org_id WHERE id = uid;
  RETURN jsonb_build_object('id', new_org_id);
END;
$$;
