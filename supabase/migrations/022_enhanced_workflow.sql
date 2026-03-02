-- Add supporting documents and poster to event proposals
ALTER TABLE event_proposals ADD COLUMN IF NOT EXISTS supporting_doc_url TEXT;
ALTER TABLE event_proposals ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE event_proposals ADD COLUMN IF NOT EXISTS head_approved_by UUID REFERENCES profiles(id);
ALTER TABLE event_proposals ADD COLUMN IF NOT EXISTS co_head_approved_by UUID REFERENCES profiles(id);

-- Add document upload to task updates
ALTER TABLE task_updates ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Create event poster table (Graphics committee only)
CREATE TABLE IF NOT EXISTS event_posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES event_proposals(id) ON DELETE CASCADE,
  poster_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_posters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posters" ON event_posters FOR SELECT USING (true);
CREATE POLICY "Graphics can upload posters" ON event_posters FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM committee_members cm
    JOIN committees c ON cm.committee_id = c.id
    WHERE cm.user_id = auth.uid() AND c.name = 'Graphics Committee'
  )
);

-- Create workflow configuration table
CREATE TABLE IF NOT EXISTS workflow_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view workflow" ON workflow_config FOR SELECT USING (true);
CREATE POLICY "Super admin can update workflow" ON workflow_config FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Insert default workflow configurations
INSERT INTO workflow_config (workflow_type, config) VALUES
('proposal_approval', '{"require_dual_head_approval": true, "notify_all_committees": true}'),
('task_assignment', '{"allow_internal_assignment": true, "require_deadline": true}')
ON CONFLICT (workflow_type) DO NOTHING;
