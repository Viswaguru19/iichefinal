# 🚀 STEP-BY-STEP SETUP GUIDE

Follow these exact steps to get your IIChE AVVU Portal running.

## ⏱️ Estimated Time: 15 minutes

---

## STEP 1: Install Node.js Dependencies (2 min)

Open terminal in project folder and run:

```bash
npm install
```

Wait for all packages to install. You should see no errors.

---

## STEP 2: Create Supabase Account (3 min)

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Verify your email if needed

---

## STEP 3: Create Supabase Project (2 min)

1. Click "New Project"
2. Choose organization (or create one)
3. Fill in:
   - **Name**: iiche-avvu-portal
   - **Database Password**: (generate strong password - SAVE THIS!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait 2-3 minutes for database to provision

---

## STEP 4: Get Supabase Credentials (1 min)

1. In Supabase dashboard, click "Project Settings" (gear icon)
2. Click "API" in sidebar
3. Copy these values:
   - **Project URL** (starts with https://)
   - **anon public** key (long string)
   - **service_role** key (long string - keep secret!)

---

## STEP 5: Create Environment File (1 min)

1. In project root, create file named `.env.local`
2. Paste this and replace with your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

3. Save the file

---

## STEP 6: Run Database Migrations (3 min)

1. In Supabase dashboard, click "SQL Editor" in sidebar
2. Click "New query"
3. Open `supabase/migrations/001_initial_schema.sql` from project
4. Copy ALL content and paste in SQL Editor
5. Click "Run" (bottom right)
6. Wait for "Success" message

7. Click "New query" again
8. Open `supabase/migrations/002_seed_data.sql`
9. Copy ALL content and paste
10. Click "Run"
11. Wait for "Success"

---

## STEP 7: Create Storage Bucket (2 min)

1. In Supabase dashboard, click "Storage" in sidebar
2. Click "Create a new bucket"
3. Name it: `payments`
4. Make it **Public** (toggle on)
5. Click "Create bucket"

6. Click on the `payments` bucket
7. Click "Policies" tab
8. Click "New Policy"
9. Choose "Allow public read access"
10. Click "Review" then "Save policy"

---

## STEP 8: Start Development Server (1 min)

In terminal, run:

```bash
npm run dev
```

You should see:
```
✓ Ready in 2.5s
○ Local: http://localhost:3000
```

---

## STEP 9: Test the Application (2 min)

1. Open browser to http://localhost:3000
2. You should see the IIChE AVVU homepage
3. Click "Login" button
4. Click "Don't have an account? Sign Up"
5. Fill in:
   - Full Name: Your Name
   - Email: your@email.com
   - Password: (at least 6 characters)
6. Click "Sign Up"
7. You should be redirected to dashboard

---

## STEP 10: Create Super Admin (1 min)

1. Go back to Supabase dashboard
2. Click "SQL Editor"
3. Click "New query"
4. Paste this (replace with YOUR email):

```sql
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'your@email.com';
```

5. Click "Run"
6. You should see "Success. 1 rows affected"

---

## STEP 11: Verify Super Admin Access (1 min)

1. Go back to http://localhost:3000
2. Refresh the page
3. You should now see "SUPER_ADMIN" badge next to your name
4. Click "Admin Panel" - you should have access
5. Click "Kickoff Control" - you should have access

---

## ✅ SETUP COMPLETE!

Your portal is now fully functional with:
- ✅ Database configured
- ✅ Authentication working
- ✅ Super admin created
- ✅ All features accessible

---

## 🎯 What to Do Next

### Add Committee Members
1. Have team members sign up
2. Go to Supabase → SQL Editor
3. Update their roles:
```sql
UPDATE profiles 
SET role = 'committee_head' 
WHERE email = 'member@email.com';
```

### Create Events
1. Go to Dashboard
2. Navigate to events section
3. Create new event
4. Approve as admin

### Setup Kickoff Tournament
1. Go to Kickoff page
2. Register teams
3. Approve teams in Kickoff Control
4. Generate schedule
5. Record live scores

---

## 🐛 Troubleshooting

### "Cannot connect to database"
- Check `.env.local` file exists
- Verify Supabase URL and keys are correct
- Restart dev server: `Ctrl+C` then `npm run dev`

### "Authentication failed"
- Check Supabase project is active
- Verify email confirmation settings in Supabase Auth settings
- Try different email

### "Permission denied"
- Verify migrations ran successfully
- Check RLS policies are enabled
- Confirm super admin role was set

### "Storage upload failed"
- Verify `payments` bucket exists
- Check bucket is public
- Verify storage policies

---

## 📞 Need Help?

1. Check `README.md` for detailed documentation
2. Review `QUICKSTART.md` for quick reference
3. See `DEPLOYMENT.md` for production setup
4. Check Supabase logs in dashboard

---

## 🎉 Congratulations!

You now have a fully functional IIChE AVVU Portal running locally!

**Next Steps:**
- Customize committee details
- Add your team members
- Create events
- Launch kickoff tournament
- Deploy to production (see DEPLOYMENT.md)

---

**Built with ❤️ for IIChE AVVU**
