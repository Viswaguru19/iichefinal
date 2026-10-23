-- Attendance reports belong only in Event documents (no committee folder).
-- Any signed-in member can delete library documents.

UPDATE documents
SET committee_id = NULL
WHERE (source_key LIKE 'attendance_report:%' OR COALESCE(metadata->>'kind', '') = 'attendance_report')
  AND committee_id IS NOT NULL;

DROP POLICY IF EXISTS "Authenticated members can delete documents" ON documents;
CREATE POLICY "Authenticated members can delete documents"
ON documents FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated members can delete committee documents" ON committee_documents;
CREATE POLICY "Authenticated members can delete committee documents"
ON committee_documents FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
