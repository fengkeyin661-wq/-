# Pull Request

## Summary
- 

## Why
- 

## Scope
- [ ] Data layer (`services/dataService.ts`)
- [ ] Doctor flow (`App.tsx`, `components/FollowUpDashboard.tsx`)
- [ ] User flow (`components/user/*`)
- [ ] Supabase migration (`supabase/migrations/*`)
- [ ] Ops/Docs (`docs/*`, `supabase/sql/*`)

## Test Plan
- [ ] `npm install`
- [ ] `npx tsc --noEmit`
- [ ] Doctor follow-up saves and updates execution sheet
- [ ] User profile core metrics sync from same archive
- [ ] Follow-up reminder strategy (D-7 / D-3 / D0)
- [ ] Multi-end consistency check (doctor <-> user)

## Database Changes
- [ ] No DB change
- [ ] Migration added: `supabase/migrations/...`
- [ ] Rollback SQL prepared

## Deployment
- [ ] Preview deployed and verified
- [ ] Staging verified
- [ ] Production risk assessed

## Rollback Plan
- Code rollback:
- Data rollback:

## Screenshots / Evidence
- 
