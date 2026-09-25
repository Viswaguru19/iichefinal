-- Keep Sr and running balance in chronological order after add/edit/delete.

CREATE OR REPLACE FUNCTION renumber_statement_of_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (
        is_faculty IS TRUE
        OR is_admin IS TRUE
        OR lower(trim(coalesce(role::text, ''))) IN ('super_admin', 'secretary')
        OR lower(trim(coalesce(executive_role::text, ''))) IN ('treasurer', 'associate_treasurer')
      )
  ) THEN
    RAISE EXCEPTION 'Not allowed to renumber statement of accounts';
  END IF;

  UPDATE statement_of_accounts SET sr_no = sr_no + 100000;

  WITH ordered AS (
    SELECT
      id,
      row_number() OVER (ORDER BY date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC) AS new_sr,
      SUM(COALESCE(credit, 0) - COALESCE(debit, 0)) OVER (
        ORDER BY date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
        ROWS UNBOUNDED PRECEDING
      ) AS new_balance
    FROM statement_of_accounts
  )
  UPDATE statement_of_accounts s
  SET sr_no = o.new_sr,
      balance = o.new_balance
  FROM ordered o
  WHERE s.id = o.id;
END;
$$;

GRANT EXECUTE ON FUNCTION renumber_statement_of_accounts() TO authenticated;

-- Fix existing rows now (function checks auth.uid(); run the same ordering here).
UPDATE statement_of_accounts SET sr_no = sr_no + 100000;

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC) AS new_sr,
    SUM(COALESCE(credit, 0) - COALESCE(debit, 0)) OVER (
      ORDER BY date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
      ROWS UNBOUNDED PRECEDING
    ) AS new_balance
  FROM statement_of_accounts
)
UPDATE statement_of_accounts s
SET sr_no = o.new_sr,
    balance = o.new_balance
FROM ordered o
WHERE s.id = o.id;
