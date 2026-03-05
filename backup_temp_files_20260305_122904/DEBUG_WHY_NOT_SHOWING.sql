-- ============================================
-- DEBUG: WHY EVENT NOT SHOWING IN UI
-- ============================================

-- 1. Show ALL events (no filter)
SELECT 
  '1️⃣ ALL EVENTS (no filter)' as section,
  id,
  title,
  status,
  date,
  created_at
FROM events
ORDER BY created_at DESC;

-- 2. Show events with status='active' (what UI queries)
SELECT 
  '2️⃣ EVENTS WITH status=active (UI query)' as section,
  id,
  title,
  status,
  date,
  created_at
FROM events
WHERE status = 'active'
ORDER BY date DESC;

-- 3. Check for any weird characters or spaces in status
SELECT 
  '3️⃣ STATUS ANALYSIS' as section,
  status,
  LENGTH(status) as status_length,
  status = 'active' as equals_active,
  status::text as status_as_text,
  pg_typeof(status) as status_type
FROM events
ORDER BY created_at DESC
LIMIT 1;

-- 4. Try different status comparisons
SELECT 
  '4️⃣ STATUS COMPARISONS' as section,
  title,
  status,
  status = 'active' as exact_match,
  status LIKE 'active' as like_match,
  status ILIKE 'active' as ilike_match,
  TRIM(status) = 'active' as trimmed_match
FROM events
ORDER BY created_at DESC
LIMIT 1;

-- 5. Check if there are any RLS issues (run as authenticated user)
SELECT 
  '5️⃣ RLS CHECK' as section,
  'If you see this event, RLS is not blocking it' as message,
  id,
  title,
  status
FROM events
WHERE status = 'active'
LIMIT 1;

-- 6. Show the exact query the UI uses
SELECT 
  '6️⃣ EXACT UI QUERY SIMULATION' as section,
  e.id,
  e.title,
  e.status,
  e.date,
  e.description,
  c.name as committee_name,
  p1.name as proposer_name,
  p2.name as head_approver_name
FROM events e
LEFT JOIN committees c ON c.id = e.committee_id
LEFT JOIN profiles p1 ON p1.id = e.proposed_by
LEFT JOIN profiles p2 ON p2.id = e.head_approved_by
WHERE e.status = 'active'
ORDER BY e.date DESC;
