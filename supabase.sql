-- LOOE ROOFING EXPERTS LTD Pipeline (Supabase)
create extension if not exists pgcrypto;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','team_lead')),
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.org_invites (
  code text primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text not null check (role in ('admin','team_lead')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  redeemed_by uuid null references auth.users(id) on delete set null,
  redeemed_at timestamptz null
);

create table if not exists public.leads (
  id uuid primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  customer_name text,
  phone text,
  address text,
  source text,
  created_iso date,
  stage text,
  notes text,
  next_action_label text,
  next_action_due_iso date,
  checklist jsonb not null,
  assigned_to text,
  team text,
  van text,
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_email text,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activity enable row level security;

-- orgs: members can select; creator can insert
create policy "orgs_select_member"
on public.orgs for select
using (exists (select 1 from public.org_members m where m.org_id = orgs.id and m.user_id = auth.uid()));

create policy "orgs_insert_self"
on public.orgs for insert
with check (created_by = auth.uid());

-- org_members: members can read; user can insert self
create policy "members_select_member"
on public.org_members for select
using (exists (select 1 from public.org_members m where m.org_id = org_members.org_id and m.user_id = auth.uid()));

create policy "members_insert_self"
on public.org_members for insert
with check (user_id = auth.uid());

-- org_invites: anyone signed in can select/update; only owner/admin can insert
create policy "invites_select_any_signed_in"
on public.org_invites for select
using (auth.uid() is not null);

create policy "invites_insert_owner_admin"
on public.org_invites for insert
with check (
  exists (
    select 1 from public.org_members m
    where m.org_id = org_invites.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

create policy "invites_update_any_signed_in"
on public.org_invites for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- leads: members can read/write; only owner/admin can delete
create policy "leads_select_member"
on public.leads for select
using (exists (select 1 from public.org_members m where m.org_id = leads.org_id and m.user_id = auth.uid()));

create policy "leads_insert_member"
on public.leads for insert
with check (exists (select 1 from public.org_members m where m.org_id = leads.org_id and m.user_id = auth.uid()));

create policy "leads_update_member"
on public.leads for update
using (exists (select 1 from public.org_members m where m.org_id = leads.org_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.org_members m where m.org_id = leads.org_id and m.user_id = auth.uid()));

create policy "leads_delete_owner_admin"
on public.leads for delete
using (
  exists (
    select 1 from public.org_members m
    where m.org_id = leads.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

-- lead_activity: members can read; members can insert
create policy "activity_select_member"
on public.lead_activity for select
using (exists (select 1 from public.org_members m where m.org_id = lead_activity.org_id and m.user_id = auth.uid()));

create policy "activity_insert_member"
on public.lead_activity for insert
with check (exists (select 1 from public.org_members m where m.org_id = lead_activity.org_id and m.user_id = auth.uid()));
