# IIChE AVVU Portal - Complete Project Structure

## 📁 Directory Structure

```
IICHE PORTAL/
├── app/                          # Next.js App Router
│   ├── about/                    # About page
│   │   └── page.tsx
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   └── signout/
│   │   │       └── route.ts      # Logout endpoint
│   │   └── kickoff/
│   │       └── goals/
│   │           └── route.ts      # Goal recording API
│   ├── committees/               # Committee pages
│   │   ├── [id]/                 # Dynamic committee detail
│   │   │   └── page.tsx
│   │   └── page.tsx              # Committee listing
│   ├── dashboard/                # Protected dashboard
│   │   ├── admin/                # Admin panel
│   │   │   └── page.tsx
│   │   ├── kickoff/              # Kickoff control
│   │   │   └── page.tsx
│   │   └── page.tsx              # Main dashboard
│   ├── events/                   # Events pages
│   │   └── page.tsx
│   ├── kickoff/                  # Kickoff tournament
│   │   ├── register/             # Team registration
│   │   │   └── page.tsx
│   │   ├── schedule/             # Match schedule
│   │   │   └── page.tsx
│   │   └── page.tsx              # Kickoff home
│   ├── login/                    # Authentication
│   │   └── page.tsx
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Homepage
├── components/                   # React components
│   ├── dashboard/                # Dashboard components
│   ├── kickoff/                  # Kickoff components
│   ├── layout/                   # Layout components
│   └── ui/                       # UI components
├── lib/                          # Utilities
│   ├── supabase/
│   │   ├── client.ts             # Client-side Supabase
│   │   └── server.ts             # Server-side Supabase
│   └── permissions.ts            # Role utilities
├── supabase/                     # Database
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Main schema
│   │   └── 002_seed_data.sql         # Seed data
│   └── create_super_admin.sql        # Admin setup
├── types/                        # TypeScript types
│   └── database.ts               # Database types
├── .env.local.example            # Environment template
├── .gitignore
├── DEPLOYMENT.md                 # Deployment guide
├── middleware.ts                 # Auth middleware
├── next.config.js
├── package.json
├── postcss.config.mjs
├── QUICKSTART.md                 # Quick start guide
├── README.md                     # Main documentation
├── tailwind.config.ts
└── tsconfig.json
```

## 🗄️ Database Schema

### Tables Overview

1. **profiles** - User profiles with roles
2. **committees** - Committee information
3. **committee_members** - Committee membership
4. **events** - Event management
5. **kickoff_teams** - Tournament teams
6. **kickoff_players** - Team players
7. **kickoff_matches** - Match schedule
8. **kickoff_goals** - Goal records

### Key Relationships

- profiles ↔ committee_members (many-to-many via junction)
- committees ↔ committee_members
- committees ↔ events
- kickoff_teams ↔ kickoff_players (one-to-many)
- kickoff_teams ↔ kickoff_matches (many-to-many)
- kickoff_matches ↔ kickoff_goals (one-to-many)

## 🔐 Authentication Flow

1. User signs up → Profile created with 'student' role
2. Super admin assigns roles via SQL
3. Middleware protects routes based on role
4. RLS policies enforce data access

## 🎯 Role Hierarchy

```
super_admin (1 user only)
    ↓
secretary = program_head (same privileges)
    ↓
committee_head + committee_cohead (Executive Committee)
    ↓
committee_member
    ↓
student
```

## 📊 Key Features Implementation

### Committee Management
- **Location**: `/app/committees/`
- **Database**: committees, committee_members tables
- **Access**: Public read, admin write

### Event System
- **Location**: `/app/events/`
- **Database**: events table
- **Approval**: Executive Committee

### Kickoff Tournament
- **Location**: `/app/kickoff/`
- **Features**:
  - Team registration with payment upload
  - Automatic schedule generation (Round Robin)
  - Live scoring with real-time updates
  - Goal tracking
- **Database**: kickoff_* tables

### Dashboard
- **Location**: `/app/dashboard/`
- **Variants**:
  - Main dashboard (all users)
  - Admin panel (super_admin, secretary, program_head)
  - Kickoff control (admins + committee_heads)

## 🔧 Configuration Files

### Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Next.js Config
- Image optimization for Supabase storage
- App Router enabled
- TypeScript strict mode

### Tailwind Config
- Custom color palette
- Dark mode support
- Responsive breakpoints

## 🚀 Deployment Steps

1. **Setup Supabase**
   - Create project
   - Run migrations
   - Create storage bucket

2. **Configure Environment**
   - Add environment variables
   - Set up domain

3. **Deploy to Vercel**
   - Connect GitHub repo
   - Add env variables
   - Deploy

4. **Post-Deployment**
   - Create super admin
   - Test all features
   - Monitor logs

## 📝 API Routes

### Authentication
- `POST /api/auth/signout` - Logout user

### Kickoff
- `POST /api/kickoff/goals` - Record goal (protected)

## 🎨 UI Components

### Layout Components
- Navigation bar
- Sidebar (dashboard)
- Footer

### Feature Components
- Committee cards
- Event cards
- Match cards
- Team registration form
- Live score display

### UI Components
- Buttons
- Forms
- Cards
- Modals
- Toast notifications

## 🔒 Security Features

1. **Row Level Security (RLS)**
   - Enabled on all tables
   - Role-based policies

2. **Authentication**
   - Supabase Auth
   - Protected routes via middleware

3. **Authorization**
   - Role-based access control
   - Permission utilities

4. **Data Validation**
   - TypeScript types
   - Form validation
   - API input validation

## 📱 Responsive Design

- Mobile-first approach
- Tailwind responsive utilities
- Touch-friendly interfaces
- Optimized for all screen sizes

## 🔄 Real-time Features

- Live score updates (Supabase Realtime)
- Goal notifications
- Match status updates

## 📈 Performance Optimizations

- Server components by default
- Image optimization
- Code splitting
- Lazy loading
- Caching strategies

## 🧪 Testing Checklist

- [ ] User registration/login
- [ ] Role-based access
- [ ] Committee CRUD
- [ ] Event management
- [ ] Team registration
- [ ] Schedule generation
- [ ] Live scoring
- [ ] Payment upload
- [ ] Real-time updates
- [ ] Mobile responsiveness

## 📚 Documentation Files

- **README.md** - Complete documentation
- **QUICKSTART.md** - 5-minute setup guide
- **DEPLOYMENT.md** - Deployment checklist
- **PROJECT_STRUCTURE.md** - This file

## 🆘 Common Issues & Solutions

### Database Connection Failed
- Check Supabase project status
- Verify environment variables
- Check network connectivity

### Authentication Not Working
- Verify Supabase Auth is enabled
- Check email confirmation settings
- Review RLS policies

### Storage Upload Failed
- Confirm bucket exists
- Check bucket is public
- Verify storage policies

### Schedule Generation Issues
- Ensure teams are approved
- Check minimum team count
- Verify match table structure

## 🔮 Future Enhancements

- Email notifications
- Push notifications
- Advanced analytics
- Mobile app
- AI-powered features
- Social media integration
- Payment gateway integration
- Advanced tournament brackets
