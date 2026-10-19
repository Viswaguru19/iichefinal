-- Resolve profile names for task updates even when client RLS embeds fail.

CREATE OR REPLACE FUNCTION public.profile_display_names(p_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(
      p.id::text,
      COALESCE(
        NULLIF(btrim(p.name), ''),
        NULLIF(btrim(p.username), ''),
        NULLIF(split_part(COALESCE(p.email, ''), '@', 1), '')
      )
    ),
    '{}'::jsonb
  )
  FROM profiles p
  WHERE p_ids IS NOT NULL
    AND p.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION public.profile_display_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_display_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_display_names(uuid[]) TO anon;
