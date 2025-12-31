# LOOE ROOFING EXPERTS LTD — Full Synced Downloadable App (PWA)

This ZIP is the **full synced version**:
- ✅ Supabase multi-user sync (live updates)
- ✅ Roles: owner/admin/team_lead
- ✅ Invite codes
- ✅ Assigned-to dropdown (from team members)
- ✅ Van + Assigned filters
- ✅ Activity log per lead/job
- ✅ PWA install (Add to Home Screen / Install app)
- ✅ Your logo used as icon/thumbnail

## 1) Setup Supabase (required for sync)
1. Create a Supabase project
2. In Supabase **SQL Editor**, run `supabase.sql` (in this folder)
3. In Supabase **Authentication**:
   - Enable Email / Magic Link (OTP)
4. In Supabase **Project Settings → API**:
   - Copy `Project URL` and `anon public` key

## 2) Run locally
```bash
npm install
cp .env.example .env
# Fill in your Supabase values
npm run dev
```

## 3) Deploy (recommended)
Deploy to Vercel or Netlify:
- Add the same env vars there:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY

## 4) Install on phones
- iPhone: Safari → Share → **Add to Home Screen**
- Android: Chrome → Menu → **Install app**

## Notes
- Only **Owner/Admin** can delete leads and create invite codes.
- Team members can still edit leads and check off tasks.
