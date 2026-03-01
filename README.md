# IIChE AVVU Portal

Full-stack production-ready web application for IIChE AVVU (Indian Institute of Chemical Engineers - AVVU Chapter).

## Features

- **8 Committees + Executive Committee** with role-based access
- **Event Management** with approval workflow
- **Kickoff Football Tournament** with live scoring system
- **Role-Based Authentication** (Super Admin, Secretary, Program Head, Committee Heads, etc.)
- **Real-time Updates** using Supabase Realtime
- **Mobile Responsive** UI with dark mode support

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Realtime)
- **Deployment**: Vercel (recommended)

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Git

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned (2-3 minutes)
3. Go to **Project Settings** → **API**
4. Copy the following:
   - Project URL
   - Anon/Public Key
   - Service Role Key (keep this secret!)

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Database Migration

1. Go to Supabase Dashboard → **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Repeat for `supabase/migrations/002_seed_data.sql`

### 5. Storage Bucket Setup

1. Go to Supabase Dashboard → **Storage**
2. Create a new bucket named `payments`
3. Set it to **Public**
4. Add policy: Allow public read access

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Creating Super Admin

After first user signs up:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query (replace with actual email):

```sql
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'admin@example.com';
```

## User Roles

- **super_admin**: Full system control (only 1 user)
- **secretary**: Same privileges as Program Head
- **program_head**: Same privileges as Secretary
- **committee_head**: Auto part of Executive Committee
- **committee_cohead**: Auto part of Executive Committee
- **committee_member**: Can manage own committee
- **student**: Basic access

## Key Features

### Committee Management
- 8 Regular Committees + 1 Executive Committee
- Heads and Co-Heads automatically join Executive Committee
- Dynamic member management

### Event System
- Create and manage events
- Approval workflow
- Committee-specific events

### Kickoff Tournament
- Team registration with payment upload
- Automatic Round Robin schedule generation
- Live scoring system with real-time updates
- Goal tracking with player attribution
- Automatic knockout stage generation

## Project Structure

```
├── app/
│   ├── (public)/          # Public pages
│   ├── dashboard/         # Protected dashboard
│   ├── api/              # API routes
│   └── layout.tsx        # Root layout
├── components/           # React components
├── lib/
│   ├── supabase/        # Supabase clients
│   └── permissions.ts   # Role utilities
├── types/               # TypeScript types
└── supabase/
    └── migrations/      # Database schemas
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

Add the same `.env.local` variables to your hosting platform.

## Database Schema

### Tables
- `profiles` - User profiles with roles
- `committees` - Committee information
- `committee_members` - Junction table for members
- `events` - Event management
- `kickoff_teams` - Tournament teams
- `kickoff_players` - Team players
- `kickoff_matches` - Match schedule
- `kickoff_goals` - Goal records

## Security Features

- Row Level Security (RLS) enabled on all tables
- Role-based access control
- Protected API routes
- Secure authentication flow
- Payment screenshot storage

## Support

For issues or questions, contact the development team.

## License

Proprietary - IIChE AVVU Chapter
