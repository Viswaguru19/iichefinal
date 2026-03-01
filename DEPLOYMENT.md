# Deployment Checklist

## Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Storage bucket created and configured
- [ ] Super admin account created
- [ ] Test all authentication flows
- [ ] Test committee management
- [ ] Test event creation and approval
- [ ] Test kickoff registration and scoring

## Supabase Configuration

### Required Tables
- profiles
- committees
- committee_members
- events
- kickoff_teams
- kickoff_players
- kickoff_matches
- kickoff_goals

### Required Storage Buckets
- payments (public)

### Required Policies
All RLS policies from migration file must be active

## Environment Variables

### Development (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Production (Vercel/Hosting)
Same variables as development

## Post-Deployment

- [ ] Verify homepage loads
- [ ] Test user registration
- [ ] Test login/logout
- [ ] Verify dashboard access
- [ ] Test committee pages
- [ ] Test event listing
- [ ] Test kickoff tournament pages
- [ ] Verify admin panel (super admin only)
- [ ] Test team registration
- [ ] Test schedule generation

## Performance Optimization

- [ ] Enable Vercel Analytics
- [ ] Configure caching headers
- [ ] Optimize images
- [ ] Enable compression

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] Service role key kept secret
- [ ] CORS configured properly
- [ ] Rate limiting configured
- [ ] Input validation on all forms

## Monitoring

- [ ] Setup error tracking
- [ ] Configure logging
- [ ] Monitor database performance
- [ ] Track API usage

## Backup Strategy

- [ ] Database backup schedule
- [ ] Storage backup plan
- [ ] Environment variable backup
- [ ] Code repository backup
