-- Ensure forms table has columns used by the form builder (older DBs may be missing some).

ALTER TABLE forms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS form_type TEXT DEFAULT 'normal';
ALTER TABLE forms ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
