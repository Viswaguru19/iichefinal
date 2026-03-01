-- Statement of Accounts Table
CREATE TABLE IF NOT EXISTS statement_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sr_no INTEGER,
  date DATE NOT NULL,
  month TEXT,
  year INTEGER,
  event TEXT NOT NULL,
  item TEXT NOT NULL,
  debit NUMERIC(10,2) DEFAULT 0,
  credit NUMERIC(10,2) DEFAULT 0,
  balance NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert existing records
INSERT INTO statement_of_accounts (sr_no, date, month, year, event, item, debit, credit, balance) VALUES
-- 2023 Kick Off 23
(1, '2023-09-15', 'September', 2023, 'Kick Off 23', 'Registration Income', 0, 13500, 13500),
(2, '2023-09-20', 'September', 2023, 'Kick Off 23', 'Trophy', 500, 0, 13000),
(3, '2023-09-20', 'September', 2023, 'Kick Off 23', 'Glucose', 250, 0, 12750),
(4, '2023-09-20', 'September', 2023, 'Kick Off 23', 'Prize Money', 500, 0, 12250),
(5, '2023-09-20', 'September', 2023, 'Kick Off 23', 'Refreshments', 1500, 0, 10750),
(6, '2023-09-20', 'September', 2023, 'Kick Off 23', 'Memento', 1500, 0, 9250),

-- 2024 Spot Photography
(7, '2024-02-10', 'February', 2024, 'Spot Photography', 'Registration Income', 0, 1350, 10600),
(8, '2024-02-15', 'February', 2024, 'Spot Photography', 'Prize Money', 1000, 0, 9600),

-- 2024 Kick Off 24
(9, '2024-09-01', 'September', 2024, 'Kick Off 24', 'Registration Income', 0, 18000, 27600),
(10, '2024-09-10', 'September', 2024, 'Kick Off 24', 'Memento', 826, 0, 26774),
(11, '2024-09-10', 'September', 2024, 'Kick Off 24', 'Football', 1800, 0, 24974),
(12, '2024-09-10', 'September', 2024, 'Kick Off 24', 'Volini', 340, 0, 24634),
(13, '2024-09-10', 'September', 2024, 'Kick Off 24', 'Fuel', 300, 0, 24334),
(14, '2024-09-10', 'September', 2024, 'Kick Off 24', 'Prize Money', 650, 0, 23684),
(15, '2024-09-10', 'September', 2024, 'Kick Off 24', 'Glucose', 212, 0, 23472),

-- 2024 CHESS
(16, '2024-10-05', 'October', 2024, 'CHESS', 'Memento for Chem Talk', 618, 0, 22854),
(17, '2024-10-10', 'October', 2024, 'CHESS', 'Reimbursed Amount (Memento)', 0, 1442, 24296),

-- 2024 Publicity Event
(18, '2024-11-15', 'November', 2024, 'Publicity Event', 'Prize Money', 800, 0, 23496),
(19, '2024-11-15', 'November', 2024, 'Publicity Event', 'Refreshments', 300, 0, 23196),
(20, '2024-11-20', 'November', 2024, 'Publicity Event', 'Reimbursed Memento (Chem Talk)', 0, 1200, 24396),

-- 2025 Photography
(21, '2025-01-10', 'January', 2025, 'Photography', 'Registration Income', 0, 2850, 27246),
(22, '2025-01-15', 'January', 2025, 'Photography', 'Prize Money', 1150, 0, 26096);

-- RLS Policies
ALTER TABLE statement_of_accounts ENABLE ROW LEVEL SECURITY;

-- Everyone can view
CREATE POLICY "Anyone can view statement of accounts"
  ON statement_of_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role IN ('super_admin', 'committee_head', 'committee_cohead')
        OR profiles.executive_role IS NOT NULL
      )
    )
  );

-- Only treasurer and secretary can insert/update
CREATE POLICY "Treasurer and Secretary can manage accounts"
  ON statement_of_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.executive_role IN ('treasurer', 'secretary', 'associate_treasurer') OR profiles.role = 'super_admin')
    )
  );

-- Function to get finance summary
CREATE OR REPLACE FUNCTION get_finance_summary()
RETURNS TABLE (
  total_income NUMERIC,
  total_expense NUMERIC,
  balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(credit), 0) as total_income,
    COALESCE(SUM(debit), 0) as total_expense,
    COALESCE(SUM(credit) - SUM(debit), 0) as balance
  FROM statement_of_accounts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
