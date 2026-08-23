-- Remove duplicate entries from statement_of_accounts
-- Keep only one row per sr_no (the earliest created one)
DELETE FROM statement_of_accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (sr_no) id
  FROM statement_of_accounts
  ORDER BY sr_no, created_at ASC
);

-- Add unique constraint on sr_no to prevent future duplicates
ALTER TABLE statement_of_accounts ADD CONSTRAINT unique_sr_no UNIQUE (sr_no);
