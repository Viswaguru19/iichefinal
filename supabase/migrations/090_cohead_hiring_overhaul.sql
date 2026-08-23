-- Co-head annual hiring: preferences, hiring-only profiles, committee review RLS, RPCs.
-- Creates hiring tables if missing (e.g. DB never ran 013/017).

-- --- Base tables (idempotent); uses uuid-ossp from initial migrations ---
CREATE TABLE IF NOT EXISTS hiring_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO hiring_settings (is_active)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM hiring_settings LIMIT 1);

CREATE TABLE IF NOT EXISTS hiring_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  location TEXT,
  deadline DATE,
  is_open BOOLEAN DEFAULT true,
  committee_id UUID REFERENCES committees(id) ON DELETE SET NULL,
  is_system_generated BOOLEAN NOT NULL DEFAULT false,
  hiring_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hiring_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID REFERENCES hiring_positions(id) ON DELETE CASCADE,
  applicant_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  preference_1_id UUID REFERENCES committees(id) ON DELETE SET NULL,
  preference_2_id UUID REFERENCES committees(id) ON DELETE SET NULL,
  preference_3_id UUID REFERENCES committees(id) ON DELETE SET NULL,
  selected_committee_id UUID REFERENCES committees(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  resume TEXT NOT NULL,
  cover_letter TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  department TEXT,
  year_of_study TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hiring_applications_position ON hiring_applications(position_id);
CREATE INDEX IF NOT EXISTS idx_hiring_applications_status ON hiring_applications(status);

ALTER TABLE hiring_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_applications ENABLE ROW LEVEL SECURITY;

-- --- Profiles: hiring-only portal until selected ---
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hiring_portal_only BOOLEAN NOT NULL DEFAULT FALSE;

-- --- hiring_positions: single system campaign + optional committee link (legacy) ---
ALTER TABLE hiring_positions ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES committees(id) ON DELETE SET NULL;
ALTER TABLE hiring_positions ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hiring_positions ADD COLUMN IF NOT EXISTS hiring_year INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS hiring_positions_one_system_campaign
  ON hiring_positions ((1))
  WHERE is_system_generated = true;

-- --- hiring_applications ---
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS applicant_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS preference_1_id UUID REFERENCES committees(id) ON DELETE SET NULL;
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS preference_2_id UUID REFERENCES committees(id) ON DELETE SET NULL;
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS preference_3_id UUID REFERENCES committees(id) ON DELETE SET NULL;
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS selected_committee_id UUID REFERENCES committees(id) ON DELETE SET NULL;
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS year_of_study TEXT;
ALTER TABLE hiring_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE hiring_applications ALTER COLUMN position_id DROP NOT NULL;

UPDATE hiring_applications SET status = 'pending' WHERE status IS NULL OR trim(status) = '';
UPDATE hiring_applications
SET status = 'pending'
WHERE status IS NOT NULL
  AND lower(trim(status)) NOT IN ('pending', 'shortlisted', 'interview', 'selected', 'rejected');

ALTER TABLE hiring_applications DROP CONSTRAINT IF EXISTS hiring_applications_status_check;
ALTER TABLE hiring_applications ADD CONSTRAINT hiring_applications_status_check
  CHECK (status IN (
    'pending', 'shortlisted', 'interview', 'selected', 'rejected'
  ));

CREATE INDEX IF NOT EXISTS idx_hiring_applications_applicant ON hiring_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_hiring_applications_pref1 ON hiring_applications(preference_1_id);

-- --- Who may turn hiring on/off (matches app: admin/faculty/EC + Social & Environmental / HR committee) ---
CREATE OR REPLACE FUNCTION public.can_manage_hiring_toggle(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_uid
      AND (
        p.is_admin IS TRUE
        OR p.is_faculty IS TRUE
        OR p.executive_role IS NOT NULL
        OR p.role::text IN ('admin', 'faculty_advisor')
      )
  )
  OR EXISTS (
    SELECT 1
    FROM committee_members cm
    JOIN committees c ON c.id = cm.committee_id
    WHERE cm.user_id = p_uid
      AND (
        (LOWER(TRIM(c.name)) LIKE '%social%' AND LOWER(TRIM(c.name)) LIKE '%environment%')
        OR LOWER(TRIM(c.name)) LIKE '%hr committee%'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_hiring_toggle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_hiring_toggle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_hiring_toggle(uuid) TO service_role;

-- Committee head/co-head may review apps that list their committee
CREATE OR REPLACE FUNCTION public.user_reviews_hiring_row(p_uid uuid, p_app_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM hiring_applications ha
    JOIN committee_members cm ON cm.user_id = p_uid
      AND cm.position IN ('head', 'co_head')
      AND (
        cm.committee_id = ha.preference_1_id
        OR cm.committee_id = ha.preference_2_id
        OR cm.committee_id = ha.preference_3_id
      )
    WHERE ha.id = p_app_id
  );
$$;

REVOKE ALL ON FUNCTION public.user_reviews_hiring_row(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_reviews_hiring_row(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_reviews_hiring_row(uuid, uuid) TO service_role;

-- Sync single system “co-head campaign” row (no CASCADE delete of past applications)
CREATE OR REPLACE FUNCTION public.sync_cohead_hiring_positions()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  y int := EXTRACT(YEAR FROM timezone('utc', now()))::int;
BEGIN
  IF NOT public.can_manage_hiring_toggle(v_uid) THEN
    RAISE EXCEPTION 'not allowed to sync hiring positions';
  END IF;

  SELECT id INTO v_id FROM hiring_positions WHERE is_system_generated = true LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO hiring_positions (
      title, description, requirements, is_open, is_system_generated, hiring_year
    ) VALUES (
      'Committee Co-Head Recruitment',
      'Annual recruitment for co-head roles across student committees. Each committee typically takes two co-heads per year. Shortlisted candidates are interviewed by committees they applied to.',
      'Select three different committee preferences at the end of the application. You must create a hiring account and sign in to apply.',
      true,
      true,
      y
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE hiring_positions
    SET is_open = true,
        hiring_year = y,
        title = COALESCE(title, 'Committee Co-Head Recruitment'),
        updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_cohead_hiring_positions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_cohead_hiring_positions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_cohead_hiring_positions() TO service_role;

CREATE OR REPLACE FUNCTION public.close_system_hiring_positions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_hiring_toggle(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE hiring_positions SET is_open = false, updated_at = now() WHERE is_system_generated = true;
END;
$$;

REVOKE ALL ON FUNCTION public.close_system_hiring_positions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_system_hiring_positions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_system_hiring_positions() TO service_role;

CREATE OR REPLACE FUNCTION public.accept_hiring_application(p_application_id uuid, p_committee_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app hiring_applications%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_app FROM hiring_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_app.status = 'selected' THEN
    RETURN json_build_object('ok', false, 'error', 'already_selected');
  END IF;

  IF p_committee_id IS DISTINCT FROM v_app.preference_1_id
     AND p_committee_id IS DISTINCT FROM v_app.preference_2_id
     AND p_committee_id IS DISTINCT FROM v_app.preference_3_id THEN
    RETURN json_build_object('ok', false, 'error', 'committee_not_in_preferences');
  END IF;

  IF NOT (
    public.can_manage_hiring_toggle(v_uid)
    OR EXISTS (
      SELECT 1 FROM committee_members cm
      WHERE cm.user_id = v_uid
        AND cm.committee_id = p_committee_id
        AND cm.position IN ('head', 'co_head')
    )
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_app.applicant_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'legacy_application_no_user');
  END IF;

  UPDATE hiring_applications
  SET status = 'selected',
      selected_committee_id = p_committee_id,
      updated_at = now()
  WHERE id = p_application_id;

  UPDATE profiles
  SET hiring_portal_only = false,
      approved = true,
      role = 'committee_cohead',
      updated_at = now()
  WHERE id = v_app.applicant_user_id;

  INSERT INTO committee_members (user_id, committee_id, position)
  VALUES (v_app.applicant_user_id, p_committee_id, 'co_head')
  ON CONFLICT (user_id, committee_id)
  DO UPDATE SET position = EXCLUDED.position;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_hiring_application(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_hiring_application(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_hiring_application(uuid, uuid) TO service_role;

-- --- New user: hiring_signup in raw_user_meta_data → approved + hiring_portal_only ---
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hiring boolean := COALESCE((NEW.raw_user_meta_data->>'hiring_signup') = 'true', false);
  v_name text := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_username text := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''),
    regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g') || '_' || left(replace(NEW.id::text, '-', ''), 8)
  );
BEGIN
  INSERT INTO public.profiles (id, name, email, role, username, approved, hiring_portal_only)
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    'committee_member',
    v_username,
    CASE WHEN v_hiring THEN true ELSE false END,
    v_hiring
  );
  RETURN NEW;
END;
$$;

-- --- RLS: drop legacy hiring policies ---
DROP POLICY IF EXISTS "Anyone can view hiring settings" ON hiring_settings;
DROP POLICY IF EXISTS "Super admin and HR can update hiring settings" ON hiring_settings;
DROP POLICY IF EXISTS "Social Committee can manage settings" ON hiring_settings;

DROP POLICY IF EXISTS "Anyone can view open positions" ON hiring_positions;
DROP POLICY IF EXISTS "Super admin and HR can insert positions" ON hiring_positions;
DROP POLICY IF EXISTS "Super admin and HR can update positions" ON hiring_positions;
DROP POLICY IF EXISTS "Super admin and HR can delete positions" ON hiring_positions;
DROP POLICY IF EXISTS "Social Committee can manage positions" ON hiring_positions;

DROP POLICY IF EXISTS "Anyone can submit applications" ON hiring_applications;
DROP POLICY IF EXISTS "Social Committee can view applications" ON hiring_applications;
DROP POLICY IF EXISTS "Social Committee can update applications" ON hiring_applications;

DROP POLICY IF EXISTS "hiring_settings_select_public" ON hiring_settings;
DROP POLICY IF EXISTS "hiring_settings_update_managers" ON hiring_settings;
DROP POLICY IF EXISTS "hiring_positions_select_public" ON hiring_positions;
DROP POLICY IF EXISTS "hiring_positions_insert_managers" ON hiring_positions;
DROP POLICY IF EXISTS "hiring_positions_update_managers" ON hiring_positions;
DROP POLICY IF EXISTS "hiring_positions_delete_managers" ON hiring_positions;
DROP POLICY IF EXISTS "hiring_apps_insert_own" ON hiring_applications;
DROP POLICY IF EXISTS "hiring_apps_select_eligible" ON hiring_applications;
DROP POLICY IF EXISTS "hiring_apps_update_eligible" ON hiring_applications;

CREATE POLICY "hiring_settings_select_public" ON hiring_settings FOR SELECT USING (true);
CREATE POLICY "hiring_settings_update_managers" ON hiring_settings FOR UPDATE
  USING (public.can_manage_hiring_toggle(auth.uid()));

CREATE POLICY "hiring_positions_select_public" ON hiring_positions FOR SELECT USING (true);
CREATE POLICY "hiring_positions_insert_managers" ON hiring_positions FOR INSERT
  WITH CHECK (public.can_manage_hiring_toggle(auth.uid()));
CREATE POLICY "hiring_positions_update_managers" ON hiring_positions FOR UPDATE
  USING (public.can_manage_hiring_toggle(auth.uid()));
CREATE POLICY "hiring_positions_delete_managers" ON hiring_positions FOR DELETE
  USING (public.can_manage_hiring_toggle(auth.uid()));

CREATE POLICY "hiring_apps_insert_own" ON hiring_applications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND applicant_user_id = auth.uid()
  );

CREATE POLICY "hiring_apps_select_eligible" ON hiring_applications FOR SELECT
  USING (
    applicant_user_id = auth.uid()
    OR public.can_manage_hiring_toggle(auth.uid())
    OR public.user_reviews_hiring_row(auth.uid(), id)
  );

CREATE POLICY "hiring_apps_update_eligible" ON hiring_applications FOR UPDATE
  USING (
    public.can_manage_hiring_toggle(auth.uid())
    OR public.user_reviews_hiring_row(auth.uid(), id)
  );
