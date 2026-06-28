-- Fix: infinite recursion in the group_members SELECT policy.
--
-- 0003's "group_members_co_read" checked co-membership with an INLINE
-- `select 1 from public.group_members ...` inside the SELECT policy that is
-- itself ON public.group_members — so evaluating the policy re-triggers the
-- policy, forever. Postgres aborts with:
--   "infinite recursion detected in policy for relation group_members".
--
-- Because the runs / workouts / groups / group_goals read policies all subquery
-- group_members, that recursion aborted EVERY runs/workouts read for any user
-- who belongs to a group: GET /runs returned a 400 and the whole app (This Week,
-- Progress, Recent Activity) showed nothing — even though the rows were there.
--
-- Fix mirrors the existing shares_group_with() pattern: a SECURITY DEFINER
-- helper runs the membership check as the function owner, so RLS is not applied
-- inside it and the policy no longer recurses. Idempotent (create-or-replace +
-- drop/create policy), so it is safe to re-run.
--
-- (0010 is the Telegram migration arriving via PR #21; this fix follows it.)

create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = uid
  );
$$;

drop policy if exists "group_members_co_read" on public.group_members;
create policy "group_members_co_read"
  on public.group_members for select
  using (public.is_group_member(public.group_members.group_id, auth.uid()));
