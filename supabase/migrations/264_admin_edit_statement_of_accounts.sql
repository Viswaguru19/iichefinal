-- Allow portal admins (is_admin, super_admin, secretary) to edit statement of accounts
-- alongside faculty, treasurer, and associate treasurer.

DROP POLICY IF EXISTS "Treasurer associate treasurer faculty can insert statement rows" ON statement_of_accounts;
DROP POLICY IF EXISTS "Treasurer associate treasurer faculty can update statement rows" ON statement_of_accounts;
DROP POLICY IF EXISTS "Treasurer associate treasurer faculty can delete statement rows" ON statement_of_accounts;
DROP POLICY IF EXISTS "Treasurer and Secretary can manage accounts" ON statement_of_accounts;

CREATE POLICY "Admins faculty treasurers can insert statement rows"
  ON statement_of_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_faculty IS TRUE
          OR profiles.is_admin IS TRUE
          OR lower(trim(coalesce(profiles.role::text, ''))) IN ('super_admin', 'secretary')
          OR lower(trim(coalesce(profiles.executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
        )
    )
  );

CREATE POLICY "Admins faculty treasurers can update statement rows"
  ON statement_of_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_faculty IS TRUE
          OR profiles.is_admin IS TRUE
          OR lower(trim(coalesce(profiles.role::text, ''))) IN ('super_admin', 'secretary')
          OR lower(trim(coalesce(profiles.executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_faculty IS TRUE
          OR profiles.is_admin IS TRUE
          OR lower(trim(coalesce(profiles.role::text, ''))) IN ('super_admin', 'secretary')
          OR lower(trim(coalesce(profiles.executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
        )
    )
  );

CREATE POLICY "Admins faculty treasurers can delete statement rows"
  ON statement_of_accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_faculty IS TRUE
          OR profiles.is_admin IS TRUE
          OR lower(trim(coalesce(profiles.role::text, ''))) IN ('super_admin', 'secretary')
          OR lower(trim(coalesce(profiles.executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
        )
    )
  );
