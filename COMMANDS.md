# 🎯 COMMAND REFERENCE - IIChE AVVU Portal

Quick reference for all commands you'll need.

---

## 📦 INSTALLATION

### Install Dependencies
```bash
npm install
```

### Install Specific Package (if needed)
```bash
npm install package-name
```

---

## 🚀 DEVELOPMENT

### Start Development Server
```bash
npm run dev
```
Opens at: http://localhost:3000

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Run Linter
```bash
npm run lint
```

---

## 🗄️ DATABASE COMMANDS

### Create Super Admin (Supabase SQL Editor)
```sql
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'your@email.com';
```

### Verify Super Admin
```sql
SELECT id, email, name, role 
FROM profiles 
WHERE role = 'super_admin';
```

### Change User Role
```sql
UPDATE profiles 
SET role = 'committee_head' 
WHERE email = 'user@email.com';
```

### List All Users
```sql
SELECT id, name, email, role 
FROM profiles 
ORDER BY created_at DESC;
```

### List All Committees
```sql
SELECT * FROM committees ORDER BY name;
```

### List Committee Members
```sql
SELECT 
  cm.position,
  p.name,
  p.email,
  c.name as committee_name
FROM committee_members cm
JOIN profiles p ON cm.user_id = p.id
JOIN committees c ON cm.committee_id = c.id
ORDER BY c.name, cm.position;
```

### List All Events
```sql
SELECT 
  e.title,
  e.event_date,
  e.approved,
  c.name as committee_name
FROM events e
LEFT JOIN committees c ON e.committee_id = c.id
ORDER BY e.event_date DESC;
```

### List Kickoff Teams
```sql
SELECT 
  t.name,
  t.approved,
  COUNT(p.id) as player_count
FROM kickoff_teams t
LEFT JOIN kickoff_players p ON t.id = p.team_id
GROUP BY t.id, t.name, t.approved
ORDER BY t.created_at;
```

### List Matches with Scores
```sql
SELECT 
  m.match_date,
  t1.name as team1,
  m.team1_score,
  m.team2_score,
  t2.name as team2,
  m.completed
FROM kickoff_matches m
JOIN kickoff_teams t1 ON m.team1_id = t1.id
JOIN kickoff_teams t2 ON m.team2_id = t2.id
ORDER BY m.match_date;
```

### Delete All Matches (Reset Tournament)
```sql
DELETE FROM kickoff_matches;
```

### Reset Team Approvals
```sql
UPDATE kickoff_teams SET approved = false;
```

---

## 🔐 SUPABASE COMMANDS

### Check RLS Status
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Enable RLS on Table
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### List All Policies
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

---

## 📁 FILE OPERATIONS

### Create .env.local File
```bash
# Windows
copy .env.local.example .env.local

# Mac/Linux
cp .env.local.example .env.local
```

### View File Contents
```bash
# Windows
type filename.txt

# Mac/Linux
cat filename.txt
```

### List Files
```bash
# Windows
dir

# Mac/Linux
ls -la
```

---

## 🔧 GIT COMMANDS

### Initialize Git
```bash
git init
```

### Add All Files
```bash
git add .
```

### Commit Changes
```bash
git commit -m "Initial commit"
```

### Add Remote
```bash
git remote add origin https://github.com/username/repo.git
```

### Push to GitHub
```bash
git push -u origin main
```

---

## 🚀 DEPLOYMENT COMMANDS

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel
```

### Build and Test Locally
```bash
npm run build
npm start
```

---

## 🧪 TESTING COMMANDS

### Check TypeScript Errors
```bash
npx tsc --noEmit
```

### Format Code (if Prettier installed)
```bash
npx prettier --write .
```

### Check for Unused Dependencies
```bash
npx depcheck
```

---

## 📊 USEFUL QUERIES

### Count Users by Role
```sql
SELECT role, COUNT(*) as count 
FROM profiles 
GROUP BY role 
ORDER BY count DESC;
```

### Recent Signups
```sql
SELECT name, email, role, created_at 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;
```

### Upcoming Events
```sql
SELECT title, event_date, location 
FROM events 
WHERE event_date > NOW() 
AND approved = true 
ORDER BY event_date 
LIMIT 5;
```

### Tournament Statistics
```sql
SELECT 
  COUNT(DISTINCT t.id) as total_teams,
  COUNT(DISTINCT p.id) as total_players,
  COUNT(DISTINCT m.id) as total_matches,
  COUNT(DISTINCT g.id) as total_goals
FROM kickoff_teams t
LEFT JOIN kickoff_players p ON t.id = p.team_id
LEFT JOIN kickoff_matches m ON t.id = m.team1_id OR t.id = m.team2_id
LEFT JOIN kickoff_goals g ON m.id = g.match_id;
```

### Top Scorers
```sql
SELECT 
  p.name as player_name,
  t.name as team_name,
  COUNT(g.id) as goals
FROM kickoff_goals g
JOIN kickoff_players p ON g.player_id = p.id
JOIN kickoff_teams t ON p.team_id = t.id
GROUP BY p.id, p.name, t.name
ORDER BY goals DESC
LIMIT 10;
```

---

## 🔄 MAINTENANCE COMMANDS

### Clear Next.js Cache
```bash
# Windows
rmdir /s /q .next

# Mac/Linux
rm -rf .next
```

### Reinstall Dependencies
```bash
# Windows
rmdir /s /q node_modules
npm install

# Mac/Linux
rm -rf node_modules
npm install
```

### Update All Packages
```bash
npm update
```

### Check for Outdated Packages
```bash
npm outdated
```

---

## 🆘 TROUBLESHOOTING COMMANDS

### Check Node Version
```bash
node --version
```

### Check npm Version
```bash
npm --version
```

### Clear npm Cache
```bash
npm cache clean --force
```

### Check Port Usage (if 3000 is busy)
```bash
# Windows
netstat -ano | findstr :3000

# Mac/Linux
lsof -i :3000
```

### Kill Process on Port 3000
```bash
# Windows
taskkill /PID <PID> /F

# Mac/Linux
kill -9 <PID>
```

---

## 📝 ENVIRONMENT VARIABLES

### Required Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Check Environment Variables (in code)
```typescript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

---

## 🎯 QUICK ACTIONS

### Full Reset (Start Fresh)
```bash
# 1. Stop server (Ctrl+C)
# 2. Clear cache
rm -rf .next
# 3. Reinstall
rm -rf node_modules
npm install
# 4. Restart
npm run dev
```

### Deploy to Production
```bash
# 1. Build
npm run build
# 2. Test
npm start
# 3. Deploy
vercel --prod
```

### Backup Database
```sql
-- In Supabase Dashboard → Database → Backups
-- Click "Create Backup"
```

---

## 📚 DOCUMENTATION COMMANDS

### View Documentation
```bash
# Windows
start README.md

# Mac
open README.md

# Linux
xdg-open README.md
```

### Search in Files
```bash
# Windows
findstr /s "search_term" *.tsx

# Mac/Linux
grep -r "search_term" .
```

---

## 🎊 COMMON WORKFLOWS

### Adding a New User as Committee Head
```sql
-- 1. User signs up via UI
-- 2. Run this query
UPDATE profiles 
SET role = 'committee_head' 
WHERE email = 'newhead@email.com';

-- 3. Add to committee
INSERT INTO committee_members (user_id, committee_id, position)
VALUES (
  (SELECT id FROM profiles WHERE email = 'newhead@email.com'),
  (SELECT id FROM committees WHERE name = 'Program Committee'),
  'head'
);
```

### Approving Multiple Teams
```sql
UPDATE kickoff_teams 
SET approved = true 
WHERE id IN ('team_id_1', 'team_id_2', 'team_id_3');
```

### Creating a New Event
```sql
INSERT INTO events (title, description, committee_id, event_date, approved)
VALUES (
  'Workshop on Chemical Engineering',
  'Learn advanced concepts',
  (SELECT id FROM committees WHERE name = 'Program Committee'),
  '2026-06-15 10:00:00',
  true
);
```

---

## 🔗 USEFUL LINKS

- Supabase Dashboard: https://app.supabase.com
- Vercel Dashboard: https://vercel.com/dashboard
- Next.js Docs: https://nextjs.org/docs
- Tailwind Docs: https://tailwindcss.com/docs

---

**Keep this file handy for quick reference!** 📌
