-- Add access_type and require_approval columns to meetings table
-- access_type: 'invite_only' (default) or 'general' (anyone with link)
-- require_approval: if true, non-invited users need approval to join

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'invite_only';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT false;
