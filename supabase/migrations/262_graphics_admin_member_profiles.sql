-- Graphics committee and portal admins can update other members' public profiles
-- (photo, name, bio) without changing roles or admin flags.

CREATE OR REPLACE FUNCTION public.can_edit_member_public_profiles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('super_admin', 'secretary')
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.committee_members cm
      JOIN public.committees c ON c.id = cm.committee_id
      WHERE cm.user_id = auth.uid()
        AND lower(c.name) LIKE '%graphics%'
    );
$$;

REVOKE ALL ON FUNCTION public.can_edit_member_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_member_public_profiles() TO authenticated;

DROP POLICY IF EXISTS "Graphics and admins can update member profiles" ON public.profiles;
CREATE POLICY "Graphics and admins can update member profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.can_edit_member_public_profiles())
WITH CHECK (public.can_edit_member_public_profiles());

CREATE OR REPLACE FUNCTION public.guard_member_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_faculty IS DISTINCT FROM OLD.is_faculty
     OR NEW.executive_role IS DISTINCT FROM OLD.executive_role
     OR COALESCE(NEW.approved, true) IS DISTINCT FROM COALESCE(OLD.approved, true)
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.role IN ('super_admin', 'secretary'))
    ) THEN
      RAISE EXCEPTION 'Only admins can change roles or account flags';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_member_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_member_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_member_profile_privileged_columns();

DROP POLICY IF EXISTS "Graphics can upload profile photos" ON storage.objects;
CREATE POLICY "Graphics can upload profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('profile-photos', 'avatars')
  AND public.can_edit_member_public_profiles()
);

DROP POLICY IF EXISTS "Graphics can update profile photos" ON storage.objects;
CREATE POLICY "Graphics can update profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('profile-photos', 'avatars')
  AND public.can_edit_member_public_profiles()
);
