-- Custom folders inside committee document libraries, plus a stable source_key
-- so event / task / poster uploads can be indexed without duplicates.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_key TEXT;

CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_folders_committee ON document_folders(committee_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON document_folders(parent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_folder_id_fkey'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS documents_source_key_uidx ON documents(source_key) WHERE source_key IS NOT NULL;

ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view document folders" ON document_folders;
CREATE POLICY "Members can view document folders"
ON document_folders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members can create document folders" ON document_folders;
CREATE POLICY "Members can create document folders"
ON document_folders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can rename document folders" ON document_folders;
CREATE POLICY "Members can rename document folders"
ON document_folders FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can delete document folders" ON document_folders;
CREATE POLICY "Members can delete document folders"
ON document_folders FOR DELETE TO authenticated USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR executive_role IS NOT NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE document_folders TO authenticated;

CREATE OR REPLACE FUNCTION sync_portal_documents_into_library()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  n integer;
BEGIN
  -- Event posters
  INSERT INTO documents (title, file_url, file_type, document_type, committee_id, event_id, uploaded_by, year, month, source_key, metadata)
  SELECT
    'Poster: ' || COALESCE(e.title, 'Event'),
    e.poster_url,
    'image',
    'other',
    e.committee_id,
    e.id,
    COALESCE(e.poster_uploaded_by, e.created_by),
    EXTRACT(YEAR FROM COALESCE(e.created_at, NOW()))::int,
    EXTRACT(MONTH FROM COALESCE(e.created_at, NOW()))::int,
    'poster:' || e.id::text,
    jsonb_build_object('kind', 'poster', 'source_key', 'poster:' || e.id::text, 'event_title', e.title)
  FROM events e
  WHERE e.committee_id IS NOT NULL
    AND e.poster_url IS NOT NULL
    AND btrim(e.poster_url) <> ''
    AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.source_key = 'poster:' || e.id::text);
  GET DIAGNOSTICS n = ROW_COUNT;
  inserted_count := inserted_count + n;

  -- JSON files attached to event proposals
  INSERT INTO documents (title, file_url, document_type, committee_id, event_id, uploaded_by, year, month, source_key, metadata)
  SELECT
    COALESCE(NULLIF(elem->>'name', ''), 'Proposal document'),
    COALESCE(NULLIF(elem->>'url', ''), ''),
    'proposal',
    e.committee_id,
    e.id,
    CASE
      WHEN (elem->>'uploaded_by') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (elem->>'uploaded_by')::uuid
      ELSE e.created_by
    END,
    EXTRACT(YEAR FROM COALESCE(e.created_at, NOW()))::int,
    EXTRACT(MONTH FROM COALESCE(e.created_at, NOW()))::int,
    'event_doc:' || e.id::text || ':' || left(COALESCE(elem->>'url', elem->>'name', ''), 180),
    jsonb_build_object(
      'kind', 'event_proposal',
      'source_key', 'event_doc:' || e.id::text || ':' || left(COALESCE(elem->>'url', elem->>'name', ''), 180),
      'event_title', e.title
    )
  FROM events e
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN e.documents IS NULL THEN '[]'::jsonb
      WHEN pg_typeof(e.documents)::text IN ('json', 'jsonb') AND jsonb_typeof(e.documents::jsonb) = 'array' THEN e.documents::jsonb
      ELSE '[]'::jsonb
    END
  ) elem
  WHERE e.committee_id IS NOT NULL
    AND COALESCE(NULLIF(elem->>'url', ''), '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM documents d
      WHERE d.source_key = 'event_doc:' || e.id::text || ':' || left(COALESCE(elem->>'url', elem->>'name', ''), 180)
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  inserted_count := inserted_count + n;

  -- Task supporting files (assigned committee, else event committee)
  INSERT INTO documents (title, file_url, file_type, file_size, document_type, committee_id, event_id, task_id, uploaded_by, year, month, source_key, metadata)
  SELECT
    COALESCE(NULLIF(td.file_name, ''), 'Task document'),
    td.file_url,
    td.file_type,
    td.file_size,
    'other',
    COALESCE(ta.assigned_to_committee, e.committee_id),
    td.event_id,
    td.task_id,
    td.uploaded_by,
    EXTRACT(YEAR FROM COALESCE(td.created_at, NOW()))::int,
    EXTRACT(MONTH FROM COALESCE(td.created_at, NOW()))::int,
    'task_doc:' || td.id::text,
    jsonb_build_object(
      'kind', 'task_document',
      'source_key', 'task_doc:' || td.id::text,
      'event_title', e.title,
      'original_name', td.file_name
    )
  FROM task_documents td
  JOIN events e ON e.id = td.event_id
  LEFT JOIN task_assignments ta ON ta.id = td.task_id
  WHERE COALESCE(ta.assigned_to_committee, e.committee_id) IS NOT NULL
    AND td.file_url IS NOT NULL
    AND btrim(td.file_url) <> ''
    AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.source_key = 'task_doc:' || td.id::text);
  GET DIAGNOSTICS n = ROW_COUNT;
  inserted_count := inserted_count + n;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION sync_portal_documents_into_library() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_portal_documents_into_library() TO authenticated;
