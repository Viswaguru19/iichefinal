# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Setup Supabase

1. Create account at https://supabase.com
2. Create new project
3. Copy Project URL and API Keys

### Step 3: Configure Environment

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
```

### Step 4: Run Database Migrations

1. Open Supabase SQL Editor
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_seed_data.sql`

### Step 5: Create Storage Bucket

1. Go to Storage in Supabase
2. Create bucket named `payments`
3. Make it public

### Step 6: Start Development

```bash
npm run dev
```

Visit http://localhost:3000

### Step 7: Create Super Admin

1. Sign up first user
2. In Supabase SQL Editor:
```sql
UPDATE profiles SET role = 'super_admin' WHERE email = 'your@email.com';
```

## ✅ You're Ready!

- Login with super admin account
- Access dashboard at `/dashboard`
- Manage committees, events, and kickoff tournament

## 📚 Next Steps

- Read full README.md for detailed documentation
- Explore the admin panel
- Set up committee members
- Configure kickoff tournament

## 🆘 Troubleshooting

**Can't login?**
- Check Supabase project is active
- Verify environment variables
- Check browser console for errors

**Database errors?**
- Ensure migrations ran successfully
- Check RLS policies are enabled
- Verify table structure in Supabase

**Storage issues?**
- Confirm `payments` bucket exists
- Check bucket is public
- Verify storage policies
