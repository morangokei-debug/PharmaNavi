-- PharmaNavi: 新規ユーザー登録時にpharma_profilesを作成
CREATE OR REPLACE FUNCTION public.pharma_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.pharma_profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS pharma_on_auth_user_created ON auth.users;
CREATE TRIGGER pharma_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.pharma_handle_new_user();
