-- Statement of accounts: any authenticated portal user can read; only treasurer,
-- associate treasurer, and faculty can insert/update/delete (secretary / admin-only manage removed).

DROP POLICY IF EXISTS "Anyone can view statement of accounts" ON statement_of_accounts;
DROP POLICY IF EXISTS "Treasurer and Secretary can manage accounts" ON statement_of_accounts;

CREATE POLICY "Authenticated users can view statement of accounts"
  ON statement_of_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Treasurer associate treasurer faculty can insert statement rows"
  ON statement_of_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_faculty IS TRUE
          OR lower(trim(coalesce(profiles.executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
        )
    )
  );

CREATE POLICY "Treasurer associate treasurer faculty can update statement rows"
  ON statement_of_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_faculty IS TRUE
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
          OR lower(trim(coalesce(profiles.executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
        )
    )
  );

CREATE POLICY "Treasurer associate treasurer faculty can delete statement rows"
  ON statement_of_accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.is_faculty IS TRUE
          OR lower(trim(coalesce(profiles.executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
        )
    )
  );

GRANT EXECUTE ON FUNCTION get_finance_summary() TO authenticated;
