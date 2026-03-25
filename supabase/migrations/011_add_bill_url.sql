-- Add bill_url column to statement_of_accounts for attaching receipts/bills
ALTER TABLE statement_of_accounts ADD COLUMN IF NOT EXISTS bill_url TEXT;
