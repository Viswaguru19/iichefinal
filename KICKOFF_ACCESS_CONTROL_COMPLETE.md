# Kickoff Control Access Restriction Complete ✅

## Access Control Implemented

### Who Can Access Kickoff Control?

1. **Super Admin** (role: `super_admin`)
2. **Secretary** (role: `secretary`)
3. **Any user with** `is_admin = true`
4. **Social and Environmental Committee Head**
5. **Social and Environmental Committee Co-Head**

### Who CANNOT Access?

- Regular committee members
- Heads/Co-heads of other committees
- Students without special roles
- Faculty (unless they're also admin)
- Executive Committee members (unless they're also admin or Social & Environmental head)

## Files Modified

### 1. `app/dashboard/kickoff/page.tsx`
**Changes:**
- Enhanced `checkAuth()` function
- Now checks for admin status OR Social & Environmental Committee head/co-head
- Shows clear error message: "Access denied - Only admins and Social & Environmental Committee heads can access Kickoff Control"
- Redirects unauthorized users to dashboard

**Before:**
```typescript
if (!['super_admin', 'secretary', 'program_head', 'committee_head'].includes(role)) {
  router.push('/dashboard');
}
```

**After:**
```typescript
// Check if admin
const isAdmin = profile?.role === 'super_admin' || profile?.role === 'secretary' || profile?.is_admin;

if (isAdmin) return; // Admin has access

// Check if Social & Environmental Committee head/co-head
const isSocialEnvHead = 
  membership && 
  committees?.name === 'Social and Environmental Committee' &&
  (position === 'head' || position === 'co_head');

if (!isSocialEnvHead) {
  // Access denied
}
```

### 2. `app/dashboard/page.tsx`
**Changes:**
- Updated `canManageKickoff` logic
- Kickoff Control card only shows to authorized users
- Checks committee membership dynamically

**Before:**
```typescript
const canManageKickoff = ['super_admin', 'secretary', 'committee_head'].includes(role);
```

**After:**
```typescript
const canManageKickoff = isAdmin || (
  userCommittee && 
  committees?.name === 'Social and Environmental Committee' &&
  (position === 'head' || position === 'co_head')
);
```

## How It Works

### Dashboard Display
1. User logs in
2. System checks their role and committee membership
3. If authorized, "Kickoff Control" card appears in dashboard
4. If not authorized, card is hidden

### Page Access
1. User tries to access `/dashboard/kickoff`
2. `checkAuth()` function runs
3. Checks if user is admin
4. If not admin, checks if user is Social & Environmental Committee head/co-head
5. If neither, shows error toast and redirects to dashboard

## Committee Name Reference

The exact committee name in the database is:
```
"Social and Environmental Committee"
```

This must match exactly for the access control to work.

## Testing Checklist

### As Admin
- [ ] Can see "Kickoff Control" card in dashboard
- [ ] Can access `/dashboard/kickoff` page
- [ ] Can manage tournament settings
- [ ] Can approve teams

### As Social & Environmental Committee Head
- [ ] Can see "Kickoff Control" card in dashboard
- [ ] Can access `/dashboard/kickoff` page
- [ ] Can manage tournament settings
- [ ] Can approve teams

### As Social & Environmental Committee Co-Head
- [ ] Can see "Kickoff Control" card in dashboard
- [ ] Can access `/dashboard/kickoff` page
- [ ] Can manage tournament settings
- [ ] Can approve teams

### As Other Committee Head (e.g., Technical Committee Head)
- [ ] CANNOT see "Kickoff Control" card in dashboard
- [ ] CANNOT access `/dashboard/kickoff` page (redirected)
- [ ] Gets error message if trying to access directly

### As Regular Member
- [ ] CANNOT see "Kickoff Control" card in dashboard
- [ ] CANNOT access `/dashboard/kickoff` page (redirected)
- [ ] Gets error message if trying to access directly

## Error Messages

When unauthorized user tries to access:
```
"Access denied - Only admins and Social & Environmental Committee heads can access Kickoff Control"
```

## Database Query to Check Access

```sql
-- Check who has access to Kickoff Control
SELECT 
  p.id,
  p.name,
  p.email,
  p.role,
  p.is_admin,
  c.name as committee_name,
  cm.position
FROM profiles p
LEFT JOIN committee_members cm ON p.id = cm.user_id
LEFT JOIN committees c ON cm.committee_id = c.id
WHERE 
  p.role IN ('super_admin', 'secretary')
  OR p.is_admin = true
  OR (
    c.name = 'Social and Environmental Committee' 
    AND cm.position IN ('head', 'co_head')
  )
ORDER BY p.name;
```

## Public Pages (No Restriction)

These pages remain publicly accessible:
- `/kickoff` - Public tournament page
- `/kickoff/schedule` - View tournament schedule
- `/kickoff/register` - Register team (when tournament is active)

Only the **control panel** (`/dashboard/kickoff`) is restricted.

## Admin Panel Access

The admin panel (`/dashboard/admin`) shows Kickoff Control to all admins. This is correct because:
1. All admins have access to Kickoff Control
2. Non-admins cannot access the admin panel anyway
3. Social & Environmental heads access Kickoff Control from main dashboard

## Troubleshooting

### Issue: Social & Environmental head cannot access
**Check:**
1. User is actually a member of "Social and Environmental Committee"
2. Position is set to 'head' or 'co_head'
3. Committee name matches exactly (case-sensitive)

**SQL to verify:**
```sql
SELECT 
  p.name,
  c.name as committee,
  cm.position
FROM profiles p
JOIN committee_members cm ON p.id = cm.user_id
JOIN committees c ON cm.committee_id = c.id
WHERE p.email = 'user@example.com';
```

### Issue: Card shows but page access denied
**Cause:** Mismatch between dashboard logic and page logic
**Fix:** Ensure both use same committee name check

### Issue: Wrong committee members have access
**Check:** Committee name in database matches "Social and Environmental Committee" exactly

## Security Notes

- Access control is enforced at both UI level (hiding card) and page level (redirect)
- Direct URL access is blocked with redirect
- Error messages are user-friendly but don't reveal system details
- Admin access is checked first for performance
- Committee membership is verified from database, not client-side

## Future Enhancements

If you need to add more committees with Kickoff access:
```typescript
const authorizedCommittees = [
  'Social and Environmental Committee',
  'Another Committee Name'
];

const isSocialEnvHead = 
  membership && 
  authorizedCommittees.includes(committees?.name) &&
  (position === 'head' || position === 'co_head');
```
