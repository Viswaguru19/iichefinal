-- File posters under Graphics. Index attendance reports for completed events.

CREATE OR REPLACE FUNCTION sync_portal_documents_into_library()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  n integer;
  graphics_id uuid;
BEGIN
  UPDATE documents
  SET committee_id = NULL
  WHERE (source_key LIKE 'attendance_report:%' OR COALESCE(metadata->>'kind', '') = 'attendance_report')
    AND committee_id IS NOT NULL;

  SELECT id INTO graphics_id
  FROM committees
  WHERE name ILIKE '%graphics%'
  ORDER BY name
  LIMIT 1;

  -- Existing posters belong in Graphics
  IF graphics_id IS NOT NULL THEN
    UPDATE documents
    SET committee_id = graphics_id
    WHERE source_key LIKE 'poster:%'
      AND (committee_id IS DISTINCT FROM graphics_id);
  END IF;

  -- Event posters
  INSERT INTO documents (title, file_url, file_type, document_type, committee_id, event_id, uploaded_by, year, month, source_key, metadata)
  SELECT
    'Poster: ' || COALESCE(e.title, 'Event'),
    e.poster_url,
    'image',
    'other',
    COALESCE(graphics_id, e.committee_id),
    e.id,
    COALESCE(e.poster_uploaded_by, e.created_by),
    EXTRACT(YEAR FROM COALESCE(e.created_at, NOW()))::int,
    EXTRACT(MONTH FROM COALESCE(e.created_at, NOW()))::int,
    'poster:' || e.id::text,
    jsonb_build_object('kind', 'poster', 'source_key', 'poster:' || e.id::text, 'event_title', e.title)
  FROM events e
  WHERE COALESCE(graphics_id, e.committee_id) IS NOT NULL
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

  -- Attendance reports for completed events
  INSERT INTO documents (title, file_url, file_type, document_type, committee_id, event_id, uploaded_by, year, month, source_key, metadata)
  SELECT
    'Attendance report: ' || COALESCE(e.title, 'Event'),
    '',
    'text/csv',
    'report',
    NULL,
    e.id,
    e.created_by,
    EXTRACT(YEAR FROM COALESCE(e.created_at, NOW()))::int,
    EXTRACT(MONTH FROM COALESCE(e.created_at, NOW()))::int,
    'attendance_report:' || e.id::text,
    jsonb_build_object(
      'kind', 'attendance_report',
      'source_key', 'attendance_report:' || e.id::text,
      'event_id', e.id,
      'event_title', e.title
    )
  FROM events e
  WHERE e.status = 'completed'
    AND e.id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.source_key = 'attendance_report:' || e.id::text);
  GET DIAGNOSTICS n = ROW_COUNT;
  inserted_count := inserted_count + n;

  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_portal_documents_into_library() TO authenticated;
